// Cloudflare Worker entry: routing + CORS + error handling
import { Hono } from 'hono';
import * as auth from './auth.js';
import * as data from './data.js';
import { sendPush } from './push.js';
import * as sermons from './sermons.js';
import { checkRateLimit, corsHeaders, requireAuth } from './utils.js';

const app = new Hono();

// Helper: compute CORS headers for this request
const corsFor = (c) => corsHeaders(c.req.header('Origin'), c.env.ALLOWED_ORIGIN);

// Apply CORS headers to a response (mutates headers, then returns nothing)
const applyCors = (c) => {
  const h = corsFor(c);
  for (const [k, v] of Object.entries(h)) c.header(k, v);
};

// ── CORS preflight ──────────────────────────────────────
app.options('*', (c) => {
  applyCors(c);
  c.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  c.header('Access-Control-Max-Age', '86400');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Vary', 'Origin');
  return c.body(null, 204);
});

// ── Health ──────────────────────────────────────────────
app.get('/api/health', async (c) => {
  applyCors(c);
  const result = await data.health(c.env.DB);
  return c.json({ ok: true, ...result }, 200);
});

// ── Auth endpoints (no auth required) ──────────────────
app.post('/api/auth/register', async (c) => {
  applyCors(c);
  return auth.register(c.req.raw, c.env.DB, c.env, corsFor(c));
});
app.post('/api/auth/login', async (c) => {
  applyCors(c);
  return auth.login(c.req.raw, c.env.DB, c.env, corsFor(c));
});
app.post('/api/auth/recover/question', async (c) => {
  applyCors(c);
  return auth.getRecoverQuestion(c.req.raw, c.env.DB, c.env, corsFor(c));
});
app.post('/api/auth/recover/verify', async (c) => {
  applyCors(c);
  return auth.verifyRecoverAnswer(c.req.raw, c.env.DB, c.env, corsFor(c));
});
app.post('/api/auth/recover/reset', async (c) => {
  applyCors(c);
  return auth.resetPassword(c.req.raw, c.env.DB, c.env, corsFor(c));
});

// ── Auth endpoints (auth required) ─────────────────────
const requireAuthMw = async (c, next) => {
  const result = await requireAuth(c.req.raw, c.env.DB, c.env);
  if (!result.user) {
    applyCors(c);
    return c.json({ ok: false, error: result.error }, 401);
  }
  c.set('user', result.user);
  await next();
};

app.get('/api/auth/me', requireAuthMw, (c) => {
  const user = c.get('user');
  applyCors(c);
  return c.json({ ok: true, user }, 200);
});

app.post('/api/auth/logout', requireAuthMw, async (c) => {
  applyCors(c);
  return auth.logout(c.req.raw, c.env.DB, c.env, corsFor(c));
});

app.post('/api/auth/change-password', requireAuthMw, async (c) => {
  applyCors(c);
  return auth.changePassword(c.req.raw, c.env.DB, c.env, corsFor(c));
});

// Tipo de cuenta, email y pregunta de seguridad. Todo opcional: se actualiza
// sólo lo que venga en el cuerpo.
app.patch('/api/auth/me', requireAuthMw, async (c) => {
  applyCors(c);
  return auth.updateProfile(c.req.raw, c.env.DB, c.env, corsFor(c));
});

// ── Temas públicos (sin auth) ──────────────────────────
// Van con rate limit porque son los únicos endpoints de datos abiertos: sin él
// serían una invitación a barrer la base a base de peticiones.
app.get('/api/public/topics', async (c) => {
  applyCors(c);
  const rl = await checkRateLimit(c.env.DB, c.req.raw, 'public_topics', c.env);
  if (!rl.ok) {
    return c.json({ ok: false, error: rl.error }, 429, { 'Retry-After': String(rl.retryAfter || 60) });
  }
  return data.listPublicTopics(c.env.DB, corsFor(c));
});

app.get('/api/public/topics/:slug', async (c) => {
  applyCors(c);
  const rl = await checkRateLimit(c.env.DB, c.req.raw, 'public_topics', c.env);
  if (!rl.ok) {
    return c.json({ ok: false, error: rl.error }, 429, { 'Retry-After': String(rl.retryAfter || 60) });
  }
  return data.getPublicTopic(c.env.DB, c.req.param('slug'), corsFor(c));
});

// Predicaciones públicas. Mismo rate limit que los temas y por el mismo
// motivo: son endpoints de datos abiertos.
app.get('/api/public/sermons', async (c) => {
  applyCors(c);
  const rl = await checkRateLimit(c.env.DB, c.req.raw, 'public_topics', c.env);
  if (!rl.ok) {
    return c.json({ ok: false, error: rl.error }, 429, { 'Retry-After': String(rl.retryAfter || 60) });
  }
  return sermons.listPublicSermons(c.env.DB, corsFor(c));
});

// Las series ya usadas, para que el selector de tema proponga en vez de dejar
// escribir a mano. Va antes de `/api/public/sermons/:slug` no haría falta —no
// choca, porque el segmento es distinto— pero se deja junto a su hermano.
app.get('/api/public/sermon-series', async (c) => {
  applyCors(c);
  const rl = await checkRateLimit(c.env.DB, c.req.raw, 'public_topics', c.env);
  if (!rl.ok) {
    return c.json({ ok: false, error: rl.error }, 429, { 'Retry-After': String(rl.retryAfter || 60) });
  }
  return sermons.listPublicSeries(c.env.DB, corsFor(c));
});

app.get('/api/public/sermons/:slug', async (c) => {
  applyCors(c);
  const rl = await checkRateLimit(c.env.DB, c.req.raw, 'public_topics', c.env);
  if (!rl.ok) {
    return c.json({ ok: false, error: rl.error }, 429, { 'Retry-After': String(rl.retryAfter || 60) });
  }
  return sermons.getPublicSermon(c.env.DB, c.req.param('slug'), corsFor(c));
});

// ── Topics (auth required) ──────────────────────────────
app.get('/api/topics', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  const result = await data.listTopics(c.env.DB, user.id);
  return c.json({ ok: true, ...result }, 200);
});

app.post('/api/topics', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.createTopic(c.req.raw, c.env.DB, user.id, corsFor(c));
});

// Antes que `/api/topics/:id`: si fuera después, Hono emparejaría «order»
// como si fuera el id de un tema y la reordenación caería en el PATCH.
app.put('/api/topics/order', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.reorderTopics(c.req.raw, c.env.DB, user.id, corsFor(c));
});

app.patch('/api/topics/:id', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.updateTopic(c.req.raw, c.env.DB, user.id, c.req.param('id'), corsFor(c));
});

app.delete('/api/topics/:id', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.deleteTopic(c.env.DB, user.id, c.req.param('id'), corsFor(c));
});

app.post('/api/topics/:id/verses', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.addVerseRef(c.req.raw, c.env.DB, user.id, c.req.param('id'), corsFor(c));
});

app.delete('/api/topics/:id/verses', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.removeVerseRef(c.req.raw, c.env.DB, user.id, c.req.param('id'), corsFor(c));
});

// ── Favorites (auth required) ──────────────────────────
app.get('/api/favorites', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  const result = await data.listFavorites(c.env.DB, user.id);
  return c.json({ ok: true, ...result }, 200);
});

app.post('/api/favorites', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.addFavorite(c.req.raw, c.env.DB, user.id, corsFor(c));
});

app.delete('/api/favorites', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.removeFavorite(c.req.raw, c.env.DB, user.id, corsFor(c));
});

// ── Notes (auth required) ──────────────────────────────
app.get('/api/notes', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  const result = await data.listNotes(c.env.DB, user.id);
  return c.json({ ok: true, ...result }, 200);
});

app.post('/api/notes', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.upsertNote(c.req.raw, c.env.DB, user.id, corsFor(c));
});

app.delete('/api/notes', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.removeNote(c.req.raw, c.env.DB, user.id, corsFor(c));
});

// ── Push (auth required) ───────────────────────────────
app.get('/api/push', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  const result = await data.listPushSubscriptions(c.env.DB, user.id);
  return c.json({ ok: true, ...result }, 200);
});

app.post('/api/push', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.savePushSubscription(c.req.raw, c.env.DB, user.id, corsFor(c));
});

app.delete('/api/push', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.removePushSubscription(c.req.raw, c.env.DB, user.id, corsFor(c));
});

// La clave pública VAPID, para que el cliente pueda suscribirse sin llevarla
// compilada dentro. Es pública por definición y va sin autenticación: sin ella
// el navegador no puede ni pedir permiso.
app.get('/api/push/key', (c) => {
  applyCors(c);
  return c.json({ ok: true, publicKey: c.env.VAPID_PUBLIC_KEY || null }, 200);
});

// ── Memorizations (auth required) ──────────────────────
app.get('/api/memorizations', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  const result = await data.listMemorizations(c.env.DB, user.id);
  return c.json({ ok: true, ...result }, 200);
});

app.post('/api/memorizations', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.addMemorization(c.req.raw, c.env.DB, user.id, corsFor(c));
});

// Antes que la ruta sin sufijo no hace falta —Hono casa por path completo—,
// pero se deja junta para que el trío se lea de una vez.
app.post('/api/memorizations/review', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.reviewMemorization(c.req.raw, c.env.DB, user.id, corsFor(c));
});

app.delete('/api/memorizations', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.removeMemorization(c.req.raw, c.env.DB, user.id, corsFor(c));
});

// ── Highlights (auth required) ─────────────────────────
app.get('/api/highlights', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  const result = await data.listHighlights(c.env.DB, user.id);
  return c.json({ ok: true, ...result }, 200);
});

app.post('/api/highlights', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.upsertHighlight(c.req.raw, c.env.DB, user.id, corsFor(c));
});

app.delete('/api/highlights', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.removeHighlight(c.req.raw, c.env.DB, user.id, corsFor(c));
});

// ── Searches (auth required) ────────────────────────────
app.get('/api/searches', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  const result = await data.listSearches(c.env.DB, user.id);
  return c.json({ ok: true, ...result }, 200);
});

app.post('/api/searches', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.upsertSearch(c.req.raw, c.env.DB, user.id, corsFor(c));
});

app.delete('/api/searches', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return data.removeSearch(c.req.raw, c.env.DB, user.id, corsFor(c));
});

// ── Predicaciones (auth required) ──────────────────────
// Ver la nota de sermons.js: NO se filtra por tipo de cuenta. El tipo decide
// qué menús se ven; los datos siguen siendo del usuario aunque cambie de tipo.
app.get('/api/sermons', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  const result = await sermons.listSermons(c.env.DB, user.id);
  return c.json({ ok: true, ...result }, 200);
});

app.post('/api/sermons', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return sermons.createSermon(c.req.raw, c.env.DB, user.id, corsFor(c));
});

app.get('/api/sermons/:id', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return sermons.getSermonResponse(c.env.DB, user.id, c.req.param('id'), corsFor(c));
});

app.patch('/api/sermons/:id', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return sermons.updateSermon(c.req.raw, c.env.DB, user.id, c.req.param('id'), corsFor(c));
});

app.delete('/api/sermons/:id', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  return sermons.removeSermon(c.env.DB, user.id, c.req.param('id'), corsFor(c));
});

// ── Export (sync) ──────────────────────────────────────
app.get('/api/data/export', requireAuthMw, async (c) => {
  const user = c.get('user');
  applyCors(c);
  const result = await data.exportUserData(c.env.DB, user.id);
  return c.json({ ok: true, ...result }, 200);
});

// ── 404 ─────────────────────────────────────────────────
app.notFound((c) => {
  applyCors(c);
  return c.json({ ok: false, error: 'not_found', path: c.req.path }, 404);
});

// ── Error handler global ──────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  applyCors(c);
  return c.json({ ok: false, error: 'internal_error', message: err.message || 'Unknown error' }, 500);
});

// ── Aviso diario por push ─────────────────────────────
//
// El cron corre CADA HORA (ver [triggers] en wrangler.toml) y despierta sólo a
// los dispositivos cuya hora coincide. Cada dispositivo guarda su propia hora en
// UTC, calculada en el cliente desde la hora local que eligió el usuario: así
// hay una única consulta indexada por hora y ninguna aritmética de zonas
// horarias aquí dentro.
//
// El push va **vacío**. El versículo lo calcula el service worker a partir de la
// fecha, que es determinista, con el JSON que ya tiene precacheado (ver push.js).
const enviarAvisosDiarios = async (env) => {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn('push: faltan las claves VAPID, no se envía nada');
    return;
  }

  const hora = new Date().getUTCHours();
  const suscripciones = await data.listPushDueAt(env.DB, hora);
  if (!suscripciones.length) return;

  const opciones = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || 'mailto:dbindea@gmail.com',
  };

  const enviados = [];
  const muertos = [];

  // En serie y no con Promise.all: son cientos como mucho, y una ráfaga
  // simultánea contra el mismo servidor de push invita a que nos limite.
  for (const s of suscripciones) {
    try {
      const res = await sendPush(s.endpoint, opciones);
      if (res.gone) muertos.push(s.id);
      else if (res.ok) enviados.push(s.id);
      else console.warn(`push: ${s.id} respondió ${res.status}`);
    } catch (e) {
      // Un endpoint que falla no puede cortar el envío a los demás.
      console.warn(`push: fallo enviando a ${s.id}: ${e.message}`);
    }
  }

  const ahora = new Date().toISOString();
  await data.markPushSent(env.DB, enviados, ahora);
  // Las suscripciones que el navegador ya tiró se borran: si no, la lista crece
  // para siempre con destinos muertos y cada hora se gastan envíos en ellos.
  await data.deletePushSubscriptions(env.DB, muertos);

  console.log(`push: hora ${hora} UTC — ${enviados.length} enviados, ${muertos.length} caducados`);
};

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(enviarAvisosDiarios(env));
  },
};
