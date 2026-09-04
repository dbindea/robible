// Auth endpoints: register, login, recover (3 steps), me, logout
import {
  hashValue,
  verifyHash,
  makeToken,
  readToken,
  validators,
  nowIso,
  genId,
  saveSession,
  deleteSession,
  requireAuth,
  checkRateLimit,
  json,
  error,
  RESET_TOKEN_TTL_MS,
} from './utils.js';

// Preguntas de seguridad predefinidas (mismas que el frontend)
export const SECURITY_QUESTIONS = ['siblings', 'favorite_number', 'bible_start_year', 'pets_count', 'countries_visited'];

// ── REGISTER ────────────────────────────────────────────
export async function register(request, db, env, cors) {
  const rl = await checkRateLimit(db, request, 'register', env);
  if (!rl.ok) return error(rl.error, 429, { ...cors, 'Retry-After': String(rl.retryAfter || 60) });

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }

  const { nickname, password, securityQuestion, securityQuestionText, securityAnswer, locale } = body || {};

  if (!validators.nickname(nickname)) return error('invalid_nickname', 400, cors);
  if (!validators.password(password)) return error('invalid_password', 400, cors);
  if (!securityQuestion || !SECURITY_QUESTIONS.includes(securityQuestion)) {
    return error('invalid_security_question', 400, cors);
  }
  if (securityQuestion === 'custom' && (!securityQuestionText || !securityQuestionText.trim())) {
    return error('security_question_required', 400, cors);
  }
  if (!validators.numericAnswer(securityAnswer)) return error('invalid_security_answer', 400, cors);

  const normalized = nickname.trim().toLowerCase();

  // Verificar duplicado
  const existing = await db
    .prepare('SELECT id FROM users WHERE nickname = ?')
    .bind(normalized)
    .first();
  if (existing) return error('nickname_taken', 409, cors);

  const userId = genId('u');
  const passwordSalt = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  const passwordHash = await hashValue(password, passwordSalt);
  const answerSalt = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  const answerHash = await hashValue(securityAnswer.trim(), answerSalt);

  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO users (id, nickname, password_salt, password_hash, sec_question, sec_question_text, sec_answer_salt, sec_answer_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      normalized,
      passwordSalt,
      passwordHash,
      securityQuestion,
      securityQuestion === 'custom' ? securityQuestionText.trim() : null,
      answerSalt,
      answerHash,
      now,
      now,
    )
    .run();

  const token = await makeToken(userId, env.JWT_SECRET);
  await saveSession(db, token, userId, request);

  // Seed de topics default (Mântuire/Îndurare/Vindecare o equivalentes).
  // El locale lo manda el cliente, que sí lo conoce (sale de la versión bíblica
  // activa). Antes se deducía de la inicial de la clave de la pregunta de
  // seguridad — de las cinco posibles solo 'bible_start_year' empieza por 'b',
  // así que el idioma dependía de una elección que nada tenía que ver con él.
  await seedDefaultTopics(db, userId, normalizeLocale(locale), now);

  return json({
    ok: true,
    user: { id: userId, nickname: normalized, createdAt: now, updatedAt: now },
    token,
  }, 201, cors);
}

// Locales con categorías por defecto traducidas. Cualquier otro cae a 'ro'.
const SEED_LOCALES = ['ro', 'es'];
const normalizeLocale = (value) =>
  typeof value === 'string' && SEED_LOCALES.includes(value.trim().toLowerCase())
    ? value.trim().toLowerCase()
    : 'ro';

async function seedDefaultTopics(db, userId, locale, now) {
  const defaults = locale === 'es'
    ? [
        { name: 'Salvación', icon: '✝️', color: '#D4A853' },
        { name: 'Misericordia', icon: '🤲', color: '#2E7D9B' },
        { name: 'Sanación', icon: '🩹', color: '#5BA89E' },
      ]
    : [
        { name: 'Mântuire', icon: '✝️', color: '#D4A853' },
        { name: 'Îndurare', icon: '🤲', color: '#2E7D9B' },
        { name: 'Vindecare', icon: '🩹', color: '#5BA89E' },
      ];
  const stmt = db.prepare(
    `INSERT INTO topics (id, user_id, name, icon, color, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
  );
  for (const t of defaults) {
    const id = genId('topic');
    await stmt.bind(id, userId, t.name, t.icon, t.color, now).run();
  }
}

// ── LOGIN ───────────────────────────────────────────────
export async function login(request, db, env, cors) {
  const rl = await checkRateLimit(db, request, 'login', env);
  if (!rl.ok) return error(rl.error, 429, { ...cors, 'Retry-After': String(rl.retryAfter || 60) });

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }

  const { nickname, password } = body || {};
  if (!nickname || !password) return error('missing_credentials', 400, cors);

  const user = await db
    .prepare(
      `SELECT id, nickname, password_salt, password_hash, created_at, updated_at
       FROM users WHERE nickname = ?`,
    )
    .bind(nickname.trim().toLowerCase())
    .first();
  if (!user) return error('invalid_credentials', 401, cors);

  const valid = await verifyHash(password, user.password_salt, user.password_hash);
  if (!valid) return error('invalid_credentials', 401, cors);

  const token = await makeToken(user.id, env.JWT_SECRET);
  await saveSession(db, token, user.id, request);

  return json({
    ok: true,
    user: {
      id: user.id,
      nickname: user.nickname,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    token,
  }, 200, cors);
}

// ── RECOVER STEP 1: get security question ───────────────
export async function getRecoverQuestion(request, db, _env, cors) {
  const rl = await checkRateLimit(db, request, 'recover', _env);
  if (!rl.ok) return error(rl.error, 429, { ...cors, 'Retry-After': String(rl.retryAfter || 60) });

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { nickname } = body || {};
  if (!validators.nickname(nickname)) return error('invalid_nickname', 400, cors);

  const user = await db
    .prepare('SELECT sec_question, sec_question_text FROM users WHERE nickname = ?')
    .bind(nickname.trim().toLowerCase())
    .first();
  if (!user) return error('user_not_found', 404, cors);

  // Devolvemos la clave (frontend la traduce con i18n) o el texto custom
  return json({
    ok: true,
    securityQuestion: user.sec_question,
    securityQuestionText: user.sec_question_text,
  }, 200, cors);
}

// ── RECOVER STEP 2: verify answer → reset token ─────────
export async function verifyRecoverAnswer(request, db, env, cors) {
  const rl = await checkRateLimit(db, request, 'recover', env);
  if (!rl.ok) return error(rl.error, 429, { ...cors, 'Retry-After': String(rl.retryAfter || 60) });

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { nickname, answer } = body || {};
  if (!validators.nickname(nickname)) return error('invalid_nickname', 400, cors);
  if (!validators.numericAnswer(answer)) return error('invalid_security_answer', 400, cors);

  const user = await db
    .prepare(
      'SELECT id, sec_answer_salt, sec_answer_hash FROM users WHERE nickname = ?',
    )
    .bind(nickname.trim().toLowerCase())
    .first();
  if (!user) return error('user_not_found', 404, cors);

  const valid = await verifyHash(answer.trim(), user.sec_answer_salt, user.sec_answer_hash);
  if (!valid) return error('invalid_security_answer', 401, cors);

  const resetToken = await makeToken(user.id, env.JWT_SECRET, RESET_TOKEN_TTL_MS);
  return json({ ok: true, resetToken }, 200, cors);
}

// ── RECOVER STEP 3: reset password ─────────────────────
export async function resetPassword(request, db, env, cors) {
  const rl = await checkRateLimit(db, request, 'recover', env);
  if (!rl.ok) return error(rl.error, 429, { ...cors, 'Retry-After': String(rl.retryAfter || 60) });

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { resetToken, newPassword } = body || {};
  if (!resetToken || !newPassword) return error('missing_fields', 400, cors);
  if (!validators.password(newPassword)) return error('invalid_password', 400, cors);

  const payload = await readToken(resetToken, env.JWT_SECRET);
  if (!payload) return error('reset_token_expired', 401, cors);

  const newSalt = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  const newHash = await hashValue(newPassword, newSalt);

  const now = nowIso();
  const result = await db
    .prepare(
      'UPDATE users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?',
    )
    .bind(newSalt, newHash, now, payload.sub)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return error('user_not_found', 404, cors);
  }

  // Generar nueva sesión automáticamente
  const token = await makeToken(payload.sub, env.JWT_SECRET);
  await saveSession(db, token, payload.sub, request);

  const user = await db
    .prepare('SELECT id, nickname, created_at, updated_at FROM users WHERE id = ?')
    .bind(payload.sub)
    .first();

  return json({
    ok: true,
    user: {
      id: user.id,
      nickname: user.nickname,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    token,
  }, 200, cors);
}

// ── ME (current user) ──────────────────────────────────
export async function me(request, db, env, cors) {
  const auth = await requireAuth(request, db, env);
  if (!auth.user) return error(auth.error, 401, cors);
  return json({ ok: true, user: auth.user }, 200, cors);
}

// ── LOGOUT ──────────────────────────────────────────────
export async function logout(request, db, env, cors) {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match) {
    await deleteSession(db, match[1].trim());
  }
  return json({ ok: true }, 200, cors);
}

// ── CHANGE PASSWORD (autenticado) ──────────────────────
export async function changePassword(request, db, env, cors) {
  const auth = await requireAuth(request, db, env);
  if (!auth.user) return error(auth.error, 401, cors);

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { currentPassword, newPassword } = body || {};
  if (!currentPassword || !validators.password(newPassword)) {
    return error('invalid_password', 400, cors);
  }

  const user = await db
    .prepare('SELECT password_salt, password_hash FROM users WHERE id = ?')
    .bind(auth.user.id)
    .first();
  const valid = await verifyHash(currentPassword, user.password_salt, user.password_hash);
  if (!valid) return error('invalid_current_password', 401, cors);

  const newSalt = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  const newHash = await hashValue(newPassword, newSalt);
  await db
    .prepare('UPDATE users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(newSalt, newHash, nowIso(), auth.user.id)
    .run();

  return json({ ok: true }, 200, cors);
}
