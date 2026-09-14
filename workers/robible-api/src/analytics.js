// Contador de visitas propio para el panel de admin.
//
// Deliberadamente sin IP: `visitor_hash` es un SHA-256 de
// `día|IP|user-agent|secreto del servidor` (ver schema.sql, tabla
// `page_views`). Cambia cada día y no se puede revertir a la IP original, así
// que sirve para contar "visitantes únicos por día" sin tratar la IP como un
// dato persistido. `country` sale de `request.cf.country`, que Cloudflare
// añade gratis a cada petición en el borde — no hace falta geolocalizar nada.

import { sha256Hex, getClientIp, checkRateLimit, requireAuth, nowIso, json, error } from './utils.js';

const hoy = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' UTC

// ── Bots ────────────────────────────────────────────────────────────────────
//
// Qué se quiere contar: personas. Alguien que llega desde Google, teclea la
// dirección o abre la PWA que tiene en la pantalla de inicio.
//
// Un rastreador que no ejecuta JavaScript nunca llega aquí — el beacon lo
// dispara el bundle. Pero Googlebot y Bingbot SÍ renderizan la página para ver
// qué pinta, así que ejecutan el beacon como cualquier navegador y hasta el 14
// sep 2026 se contaban como visitas. Los dos se identifican en su User-Agent,
// que es por donde se cortan.
//
// Dos reglas, y el orden importa poco porque son independientes:
//
// 1. Sin `Mozilla/` no es un navegador. `curl`, `python-requests`, `axios`,
//    `Go-http-client` y compañía no lo mandan; todos los navegadores reales sí,
//    incluidos los que no tienen nada que ver con Netscape — es un fósil que
//    arrastra todo el mundo. Un User-Agent vacío cae aquí también.
// 2. Lista de nombres conocidos. Va por subcadena y en minúsculas.
//
// Ojo con el genérico: buscar 'bot' a secas parece tentador y es un error.
// Hay móviles Android de la marca CUBOT cuyo User-Agent lleva `CUBOT_NOTE_7`,
// y esa persona dejaría de contarse para siempre sin que nadie se entere. Por
// eso la lista es explícita y los comodines llevan delimitador.
const PATRONES_BOT = [
  // Buscadores
  'googlebot', 'google-inspectiontool', 'googleother', 'google-extended', 'apis-google',
  'adsbot-google', 'mediapartners-google', 'feedfetcher-google', 'storebot-google',
  'bingbot', 'bingpreview', 'adidxbot', 'msnbot', 'yandex', 'baiduspider', 'duckduckbot',
  'slurp', 'sogou', 'exabot', 'seznambot', 'naver', 'petalbot', 'applebot', 'amazonbot',
  'ia_archiver', 'archive.org_bot', 'qwantify', 'mojeekbot',
  // SEO y scraping comercial
  'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'dataforseobot', 'blexbot', 'serpstatbot',
  'rogerbot', 'screaming frog', 'sitebulb', 'zoominfobot', 'barkrowler', 'linkdexbot',
  // Modelos de lenguaje. Rastrean mucho y no son visitas de nadie.
  'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-web', 'anthropic-ai',
  'perplexitybot', 'youbot', 'ccbot', 'bytespider', 'diffbot', 'omgili', 'imagesiftbot',
  'meta-externalagent', 'cohere-ai', 'timpibot',
  // Vistas previas de enlaces al compartir (WhatsApp, Telegram, redes)
  'facebookexternalhit', 'facebookcatalog', 'facebot', 'twitterbot', 'linkedinbot',
  'pinterest', 'redditbot', 'slackbot', 'slack-imgproxy', 'discordbot', 'telegrambot',
  'whatsapp', 'skypeuripreview', 'embedly', 'quora link preview', 'vkshare', 'tumblr',
  'flipboard', 'nuzzel', 'outbrain', 'bitlybot',
  // Monitorización y auditoría
  'uptimerobot', 'pingdom', 'statuscake', 'site24x7', 'newrelicpinger', 'datadog',
  'betteruptime', 'freshping', 'lighthouse', 'pagespeed', 'gtmetrix', 'w3c_validator',
  'validator.nu', 'headlesschrome', 'phantomjs', 'puppeteer', 'playwright',
  // Bibliotecas HTTP con `Mozilla/` falso y genéricos
  'python-requests', 'python-urllib', 'aiohttp', 'scrapy', 'libwww-perl', 'okhttp',
  'go-http-client', 'node-fetch', 'guzzlehttp', 'postmanruntime', 'apache-httpclient',
  'java/', 'curl/', 'wget/', 'axios/', 'httpx/',
  // Comodines con delimitador: 'crawler' y 'spider' no aparecen dentro de
  // ninguna palabra de un User-Agent de navegador.
  'crawler', 'crawling', 'spider', 'scraper', 'feedburner', 'feedly', 'fetcher',
];

/**
 * ¿Esta visita la hace un programa? Exportada para que `tests/analytics.test.js`
 * pueda pasarle los User-Agent reales que se quieren cortar y los de navegador
 * que NO se pueden perder — es la única forma de comprobarlo sin desplegar.
 */
export function esVisitaDeBot(userAgent) {
  const ua = String(userAgent || '').toLowerCase().trim();
  if (!ua) return true;
  if (!ua.includes('mozilla/')) return true;
  return PATRONES_BOT.some((patron) => ua.includes(patron));
}

/**
 * POST /api/analytics/pageview — beacon público, sin autenticación: lo llama
 * el navegador de cualquier visitante en cada cambio de ruta.
 *
 * Si la petición trae un Bearer válido de un admin, la visita NO se cuenta —
 * si no, el propio admin navegando su panel inflaría sus estadísticas.
 */
export async function recordPageView(request, db, env, cors) {
  const rl = await checkRateLimit(db, request, 'pageview', env);
  if (!rl.ok) return error(rl.error, 429, { ...cors, 'Retry-After': String(rl.retryAfter || 60) });

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const path = typeof body?.path === 'string' ? body.path.trim().slice(0, 200) : '';
  if (!path) return error('invalid_path', 400, cors);

  const ua = request.headers.get('User-Agent') || '';
  // Se descarta ANTES de mirar la sesión: un rastreador no tiene token y
  // preguntárselo a la base de datos por cada visita suya es trabajo tirado.
  if (esVisitaDeBot(ua)) return json({ ok: true, recorded: false }, 200, cors);

  const auth = await requireAuth(request, db, env).catch(() => ({ user: null }));
  if (auth.user?.isAdmin) return json({ ok: true, recorded: false }, 200, cors);

  const dia = hoy();
  const ip = getClientIp(request);
  const pais = request.cf?.country || null;
  const hash = await sha256Hex(`${dia}|${ip}|${ua}|${env.JWT_SECRET || ''}`);

  await db
    .prepare('INSERT INTO page_views (day, path, country, visitor_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(dia, path, pais, hash, nowIso())
    .run();

  return json({ ok: true, recorded: true }, 200, cors);
}

/** Cifras de tráfico para `GET /api/admin/stats`. */
export async function getViewStats(db) {
  const dia = hoy();

  const hoyRow = await db
    .prepare('SELECT COUNT(*) AS total, COUNT(DISTINCT visitor_hash) AS unicos FROM page_views WHERE day = ?')
    .bind(dia)
    .first();
  const totalRow = await db.prepare('SELECT COUNT(*) AS total FROM page_views').first();

  const paises = await db
    .prepare(
      `SELECT country, COUNT(*) AS total FROM page_views
       WHERE day = ? AND country IS NOT NULL
       GROUP BY country ORDER BY total DESC LIMIT 5`,
    )
    .bind(dia)
    .all();

  const paginas = await db
    .prepare(
      `SELECT path, COUNT(*) AS total FROM page_views
       WHERE day = ?
       GROUP BY path ORDER BY total DESC LIMIT 5`,
    )
    .bind(dia)
    .all();

  return {
    viewsToday: hoyRow?.total || 0,
    uniqueVisitorsToday: hoyRow?.unicos || 0,
    viewsTotal: totalRow?.total || 0,
    topCountriesToday: (paises.results || []).map((r) => ({ country: r.country, count: r.total })),
    topPagesToday: (paginas.results || []).map((r) => ({ path: r.path, count: r.total })),
  };
}
