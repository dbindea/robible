// Cloudflare Worker entry: routing + CORS + error handling
import { Hono } from 'hono';
import { corsHeaders, requireAuth } from './utils.js';
import * as auth from './auth.js';
import * as data from './data.js';

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
  return c.json(
    { ok: false, error: 'internal_error', message: err.message || 'Unknown error' },
    500,
  );
});

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
