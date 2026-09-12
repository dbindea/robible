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

  const auth = await requireAuth(request, db, env).catch(() => ({ user: null }));
  if (auth.user?.isAdmin) return json({ ok: true, recorded: false }, 200, cors);

  const dia = hoy();
  const ip = getClientIp(request);
  const ua = request.headers.get('User-Agent') || '';
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
