// Utilidades comunes: hashing, tokens, validación, rate limit

// ── Constantes ───────────────────────────────────────────
export const PBKDF2_ITERATIONS = 100_000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;     // 30 días
export const RESET_TOKEN_TTL_MS = 5 * 60 * 1000;             // 5 min

const VALID_NICKNAME = /^[a-zA-Z0-9_.-]{3,24}$/;
const VALID_PASSWORD = (p) => typeof p === 'string' && p.length >= 6 && p.length <= 128;

// Tipos de cuenta. `preacher` es un `user` con las herramientas de predicación
// añadidas: no se le retira nada, así que cambiar de tipo no toca ningún dato.
export const USER_TYPES = ['user', 'preacher'];

// Comprobación de email deliberadamente laxa: algo@algo.algo sin espacios. El
// email es opcional y sólo sirve para recuperar la cuenta; validarlo con una
// expresión estricta rechaza direcciones perfectamente válidas y no aporta
// seguridad. Quien se equivoque al escribirlo se queda sin ese camino de
// recuperación, que es exactamente lo mismo que no ponerlo.
const VALID_EMAIL = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) && e.trim().length <= 254;

/**
 * Normaliza la respuesta de seguridad antes de hashearla.
 *
 * **Tiene que usarse en los dos sitios** —al registrar y al verificar—, porque
 * lo que se guarda es un hash: si las dos rutas normalizan distinto, el usuario
 * escribe la respuesta correcta y no entra nunca. Por eso vive aquí y no
 * duplicada en auth.js.
 *
 * Se quitan mayúsculas, diacríticos y espacios de más: la pregunta la escribe
 * el propio usuario y meses después nadie recuerda si respondió "Rex", "rex" o
 * " Rex ". Con respuestas numéricas —las de los usuarios antiguos— la
 * normalización no cambia nada, así que sus hashes siguen siendo válidos.
 */
export const normalizeSecurityAnswer = (answer) =>
  String(answer ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');

// ── Encoding helpers ────────────────────────────────────
const toHex = (buf) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const fromHex = (hex) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out.buffer;
};

// ── PBKDF2 hashing (compatible con frontend mock) ──────
export async function hashValue(value, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(value),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const salt = fromHex(saltHex);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return toHex(bits);
}

export async function verifyHash(value, saltHex, expectedHashHex) {
  const actual = await hashValue(value, saltHex);
  return actual === expectedHashHex;
}

// ── Tokens (HMAC-SHA256 firmado) ────────────────────────
const b64urlEncode = (str) =>
  btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const b64urlDecode = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (str.length % 4)) % 4);
  return atob(b64);
};

async function hmacSign(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64urlEncode(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(data, signature, secret) {
  const expected = await hmacSign(data, secret);
  return expected === signature;
}

export async function makeToken(userId, secret, ttlMs = SESSION_TTL_MS) {
  const payload = {
    sub: userId,
    iat: Date.now(),
    exp: Date.now() + ttlMs,
  };
  const data = b64urlEncode(JSON.stringify(payload));
  const sig = await hmacSign(data, secret);
  return `rb.${data}.${sig}`;
}

export async function readToken(token, secret) {
  if (!token || !token.startsWith('rb.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, data, sig] = parts;
  const valid = await hmacVerify(data, sig, secret);
  if (!valid) return null;
  try {
    const payload = JSON.parse(b64urlDecode(data));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Validación de inputs ────────────────────────────────
export const validators = {
  nickname: (n) => typeof n === 'string' && VALID_NICKNAME.test(n.trim()),
  password: VALID_PASSWORD,
  topicName: (n) => typeof n === 'string' && n.trim().length >= 1 && n.trim().length <= 40,
  // Icon: acepta 1-4 chars (emoji como 📌) o 1-20 chars (slug como 'bookmark', 'cross')
  icon: (i) => typeof i === 'string' && i.length >= 1 && i.length <= 20,
  color: (c) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c),
  verseRef: (r) => (
    r && Number.isInteger(r.book) && r.book >= 0 && r.book <= 65 &&
    Number.isInteger(r.chapter) && r.chapter >= 1 &&
    Number.isInteger(r.verse) && r.verse >= 1
  ),
  noteText: (t) => typeof t === 'string' && t.trim().length >= 1 && t.trim().length <= 500,
  bibleVersion: (v) => typeof v === 'string' && /^[a-z0-9_]{2,12}$/.test(v),
  email: VALID_EMAIL,
  userType: (t) => typeof t === 'string' && USER_TYPES.includes(t),
  // La pregunta la escribe el usuario: una línea, ni vacía ni un ensayo.
  securityQuestionText: (q) => typeof q === 'string' && q.trim().length >= 5 && q.trim().length <= 120,
  // La respuesta ya no tiene por qué ser un número. Se mide sobre el texto
  // normalizado, que es lo que acaba hasheándose.
  securityAnswer: (a) => {
    const limpia = normalizeSecurityAnswer(a);
    return limpia.length >= 1 && limpia.length <= 100;
  },
  publicSlug: (s) => typeof s === 'string' && s.length >= 1 && s.length <= 80 && !/[/?#\s]/.test(s),
};

// ── Helpers de respuesta ────────────────────────────────
const corsHeaders = (origin, allowedOrigins) => {
  const allowed = (allowedOrigins || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : (allowed[0] || '*');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
};

export const json = (data, status = 200, cors = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });

export const error = (message, status = 400, cors = {}) =>
  json({ ok: false, error: message }, status, cors);

export const handleCors = (request, env) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get('Origin'), env.ALLOWED_ORIGIN),
    });
  }
  return null;
};

export { corsHeaders };

// ── Rate limiting (persistente en D1) ────────────────────
const RATE_WINDOWS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
};

const getClientIp = (request) => {
  // Cloudflare añade el header real
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
};

export async function checkRateLimit(db, request, endpoint, env) {
  const ip = getClientIp(request);
  const perMinute = parseInt(env.RATE_LIMIT_PER_MINUTE || '30', 10);
  const perHour = parseInt(env.RATE_LIMIT_PER_HOUR || '500', 10);

  // Limpieza best-effort de entradas viejas (> 1h)
  await db
    .prepare('DELETE FROM rate_limits WHERE window_start < ?')
    .bind(Date.now() - RATE_WINDOWS.hour)
    .run()
    .catch(() => {}); // No bloquear si falla

  for (const [window, limit] of [['minute', perMinute], ['hour', perHour]]) {
    const windowMs = RATE_WINDOWS[window];
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;

    // Upsert: si existe, +1; sino, crear
    await db
      .prepare(
        `INSERT INTO rate_limits (ip, endpoint, window_start, count)
         VALUES (?, ?, ?, 1)
         ON CONFLICT (ip, endpoint, window_start)
         DO UPDATE SET count = count + 1`,
      )
      .bind(ip, endpoint, windowStart)
      .run();

    const row = await db
      .prepare(
        'SELECT count FROM rate_limits WHERE ip = ? AND endpoint = ? AND window_start = ?',
      )
      .bind(ip, endpoint, windowStart)
      .first();

    if (row.count > limit) {
      return {
        ok: false,
        error: `rate_limit_exceeded:${window}`,
        retryAfter: Math.ceil((windowStart + windowMs - Date.now()) / 1000),
      };
    }
  }

  return { ok: true };
}

// ── Helpers de DB ────────────────────────────────────────
export const nowIso = () => new Date().toISOString();

export async function requireAuth(request, db, env) {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return { user: null, error: 'missing_token' };

  const token = match[1].trim();
  // 1) Verificar firma del token (HMAC)
  const payload = await readToken(token, env.JWT_SECRET);
  if (!payload) return { user: null, error: 'invalid_token' };

  // 2) Verificar que la sesión existe en DB y no está expirada.
  //    Si el usuario hizo logout, esta fila se elimina y la sesión queda inválida
  //    aunque la firma HMAC siga siendo válida.
  const session = await db
    .prepare('SELECT user_id, expires_at FROM auth_sessions WHERE token = ?')
    .bind(token)
    .first()
    .catch(() => null);
  if (!session || session.expires_at < Date.now()) {
    return { user: null, error: 'invalid_or_expired_token' };
  }

  // 3) Cargar usuario
  const user = await db
    .prepare(
      'SELECT id, nickname, user_type, email, created_at, updated_at FROM users WHERE id = ?',
    )
    .bind(payload.sub)
    .first();
  if (!user) return { user: null, error: 'user_not_found' };

  // Normalize snake_case (DB) → camelCase (API)
  return {
    user: {
      id: user.id,
      nickname: user.nickname,
      userType: user.user_type || 'user',
      email: user.email || null,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    token,
    error: null,
  };
}

export async function saveSession(db, token, userId, request) {
  const ua = request.headers.get('User-Agent') || '';
  await db
    .prepare(
      `INSERT OR REPLACE INTO auth_sessions (token, user_id, expires_at, created_at, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(token, userId, Date.now() + SESSION_TTL_MS, nowIso(), ua.substring(0, 200))
    .run();
}

export async function deleteSession(db, token) {
  if (!token) return;
  await db
    .prepare('DELETE FROM auth_sessions WHERE token = ?')
    .bind(token)
    .run()
    .catch(() => {});
}

/**
 * Slug legible para la URL pública de un tema: `ansiedad-a3f2`.
 *
 * Filtra con `\p{L}\p{N}` y no con `[a-z0-9]` por lo mismo que
 * `slugifyBookName` en el frontend (CLAUDE.md, trampa 6): con lo segundo, un
 * tema con nombre en chino o en rumano con diacríticos se quedaba vacío y
 * todos acababan compartiendo el mismo slug. El sufijo aleatorio garantiza
 * unicidad aunque dos usuarios publiquen "Ansiedad".
 */
export const genPublicSlug = (name = '') => {
  const base = String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const rand = crypto.randomUUID().split('-')[0].slice(0, 4);
  return base ? `${base}-${rand}` : rand;
};

export const genId = (prefix) => `${prefix}_${crypto.randomUUID()}`;
export const genShortId = (prefix, name = '') => {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 24) || 'x';
  const rand = crypto.randomUUID().split('-')[0];
  return `${prefix}_${slug}-${rand}`;
};
