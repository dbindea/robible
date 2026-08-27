/**
 * Auth service — API mock con localStorage.
 *
 * Esta es la implementación de la Opción A: una API completa de
 * register/login/recover/me que persiste en localStorage. Cuando se
 * añada el backend (Cloudflare Workers + D1), solo cambia la
 * implementación interna de estas funciones — el resto de la app
 * sigue usando la misma interfaz.
 *
 * Hashing: usamos PBKDF2 vía SubtleCrypto (nativo del browser, no
 * requiere librería). En backend se cambiará a bcrypt/argon2.
 *
 * Datos sensibles: NO se guarda email, nombre real, ni nada de PII.
 * Solo nickname + hash(password) + pregunta/respuesta de seguridad.
 */

const USERS_KEY = 'robible:users:v1';
const SESSION_KEY = 'robible:session:v1';
const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// ── Helpers crypto ─────────────────────────────────────────
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

const randomSalt = () => {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toHex(salt);
};

const hashValue = async (value, saltHex) => {
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
};

// Verifica valor contra hash existente
const verifyHash = async (value, saltHex, expectedHashHex) => {
  const actual = await hashValue(value, saltHex);
  return actual === expectedHashHex;
};

// Genera token mock (base64url con timestamp)
const makeToken = (userId) => {
  const payload = {
    sub: userId,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  return 'rb.' + btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const readToken = (token) => {
  try {
    if (!token || !token.startsWith('rb.')) return null;
    const b64 = token.slice(3).replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

// ── Storage helpers ────────────────────────────────────────
const getUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const getSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.exp < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

const saveSession = (session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

// ── Validación de nickname ──────────────────────────────────
const isValidNickname = (nickname) => {
  if (typeof nickname !== 'string') return false;
  const trimmed = nickname.trim();
  if (trimmed.length < 3 || trimmed.length > 24) return false;
  return /^[a-zA-Z0-9_.\-]+$/.test(trimmed);
};

const isValidPassword = (password) => {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128;
};

const isValidSecurityAnswer = (answer) => {
  // Solo dígitos, 1-6 caracteres
  return typeof answer === 'string' && /^\d{1,6}$/.test(answer.trim());
};

// ── API pública ─────────────────────────────────────────────

/**
 * Registro de nuevo usuario.
 * @param {{nickname: string, password: string, securityQuestion: string, securityAnswer: string}} data
 * @returns {{ok: true, user: PublicUser, token: string} | {ok: false, error: string}}
 */
export const register = async (data) => {
  const { nickname, password, securityQuestion, securityAnswer } = data;

  // Validaciones
  if (!isValidNickname(nickname)) {
    return { ok: false, error: 'auth.errors.invalid_nickname' };
  }
  if (!isValidPassword(password)) {
    return { ok: false, error: 'auth.errors.invalid_password' };
  }
  if (!securityQuestion || !securityQuestion.trim()) {
    return { ok: false, error: 'auth.errors.security_question_required' };
  }
  if (!isValidSecurityAnswer(securityAnswer)) {
    return { ok: false, error: 'auth.errors.invalid_security_answer' };
  }

  const users = getUsers();
  const normalizedNick = nickname.trim().toLowerCase();

  if (users[normalizedNick]) {
    return { ok: false, error: 'auth.errors.nickname_taken' };
  }

  const passwordSalt = randomSalt();
  const passwordHash = await hashValue(password, passwordSalt);
  const answerSalt = randomSalt();
  const answerHash = await hashValue(securityAnswer.trim(), answerSalt);

  const userId = 'u_' + crypto.randomUUID();
  const user = {
    id: userId,
    nickname: nickname.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users[normalizedNick] = {
    ...user,
    passwordSalt,
    passwordHash,
    securityQuestion,
    securityAnswerSalt: answerSalt,
    securityAnswerHash: answerHash,
  };
  saveUsers(users);

  const token = makeToken(userId);
  saveSession({ token, userId, exp: Date.now() + SESSION_TTL_MS });

  return { ok: true, user: publicUser(user), token };
};

/**
 * Login con nickname + password.
 */
export const login = async (nickname, password) => {
  if (!nickname || !password) {
    return { ok: false, error: 'auth.errors.missing_credentials' };
  }

  const users = getUsers();
  const user = users[nickname.trim().toLowerCase()];

  if (!user) {
    return { ok: false, error: 'auth.errors.invalid_credentials' };
  }

  const valid = await verifyHash(password, user.passwordSalt, user.passwordHash);
  if (!valid) {
    return { ok: false, error: 'auth.errors.invalid_credentials' };
  }

  const token = makeToken(user.id);
  saveSession({ token, userId: user.id, exp: Date.now() + SESSION_TTL_MS });

  return { ok: true, user: publicUser(user), token };
};

/**
 * Paso 1 de recover: dado un nickname, devuelve la pregunta de seguridad.
 * NO valida la respuesta, solo obtiene la pregunta.
 */
export const getSecurityQuestion = (nickname) => {
  const users = getUsers();
  const user = users[(nickname || '').trim().toLowerCase()];
  if (!user) return { ok: false, error: 'auth.errors.user_not_found' };
  return { ok: true, securityQuestion: user.securityQuestion };
};

/**
 * Paso 2 de recover: verifica la respuesta numérica.
 */
export const verifySecurityAnswer = async (nickname, answer) => {
  if (!isValidSecurityAnswer(answer)) {
    return { ok: false, error: 'auth.errors.invalid_security_answer' };
  }
  const users = getUsers();
  const user = users[(nickname || '').trim().toLowerCase()];
  if (!user) return { ok: false, error: 'auth.errors.user_not_found' };

  const valid = await verifyHash(answer.trim(), user.securityAnswerSalt, user.securityAnswerHash);
  if (!valid) return { ok: false, error: 'auth.errors.invalid_security_answer' };

  // Devuelve un token temporal de "reset" que autoriza el cambio de password
  const resetToken = 'rb.reset.' + btoa(JSON.stringify({
    sub: user.id,
    iat: Date.now(),
    exp: Date.now() + 5 * 60 * 1000, // 5 minutos
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return { ok: true, resetToken };
};

/**
 * Paso 3 de recover: cambiar password usando el resetToken.
 */
export const resetPassword = async (resetToken, newPassword) => {
  const tokenData = readResetToken(resetToken);
  if (!tokenData) return { ok: false, error: 'auth.errors.reset_token_expired' };
  if (!isValidPassword(newPassword)) return { ok: false, error: 'auth.errors.invalid_password' };

  const users = getUsers();
  const nickKey = Object.keys(users).find((k) => users[k].id === tokenData.sub);
  if (!nickKey) return { ok: false, error: 'auth.errors.user_not_found' };

  const passwordSalt = randomSalt();
  const passwordHash = await hashValue(newPassword, passwordSalt);

  users[nickKey] = {
    ...users[nickKey],
    passwordSalt,
    passwordHash,
    updatedAt: new Date().toISOString(),
  };
  saveUsers(users);

  // Crear sesión nueva
  const token = makeToken(users[nickKey].id);
  saveSession({ token, userId: users[nickKey].id, exp: Date.now() + SESSION_TTL_MS });

  return { ok: true, user: publicUser(users[nickKey]), token };
};

const readResetToken = (token) => {
  try {
    if (!token || !token.startsWith('rb.reset.')) return null;
    const b64 = token.slice(9).replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

/**
 * Devuelve el usuario actual desde la sesión, o null.
 */
export const me = () => {
  const session = getSession();
  if (!session) return null;

  const users = getUsers();
  const nickKey = Object.keys(users).find((k) => users[k].id === session.userId);
  if (!nickKey) {
    clearSession();
    return null;
  }
  return publicUser(users[nickKey]);
};

/**
 * Cierra la sesión actual.
 */
export const logout = () => {
  clearSession();
};

/**
 * Quita campos sensibles del usuario antes de devolverlo.
 */
const publicUser = (user) => ({
  id: user.id,
  nickname: user.nickname,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ── Preguntas de seguridad predefinidas ─────────────────────
export const SECURITY_QUESTIONS = [
  { key: 'siblings', i18nKey: 'auth.questions.siblings' },
  { key: 'favorite_number', i18nKey: 'auth.questions.favorite_number' },
  { key: 'bible_start_year', i18nKey: 'auth.questions.bible_start_year' },
  { key: 'pets_count', i18nKey: 'auth.questions.pets_count' },
  { key: 'countries_visited', i18nKey: 'auth.questions.countries_visited' },
];

// ── Validadores exportados (para formularios) ───────────────
export const validators = {
  isValidNickname,
  isValidPassword,
  isValidSecurityAnswer,
};
