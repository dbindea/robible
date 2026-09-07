// Auth service: API-first con fallback a localStorage (offline-first).
//
// Cuando USE_BACKEND=true (config.js), intenta el backend primero.
// Si el backend falla por red/5xx, cae a la versión localStorage
// (manteniendo compatibilidad con la Opción A del mock).
//
// Si USE_BACKEND=false, usa siempre localStorage (modo offline puro).

import { api, tokenStore, ApiError, translateApiError } from './apiClient.js';
import { USE_BACKEND } from '../config.js';
import { getBibleVersionConfigOrDefault } from '../config/bible-versions.js';

// Locale activo, derivado de la versión bíblica seleccionada. Se lee de
// localStorage y no del store para no acoplar el servicio a Svelte: authStore
// ya importa este módulo, así que importar stores.js aquí arrastraría sus
// efectos de arranque. Misma clave que usa stores.js.
const getCurrentLocale = () => {
  try {
    const version = localStorage.getItem('selectedBibleVersion');
    return getBibleVersionConfigOrDefault(version)?.locale || 'ro';
  } catch {
    return 'ro';
  }
};

// ── Validación de inputs (cliente-side, el server también valida) ──
const VALID_NICKNAME = /^[a-zA-Z0-9_.-]{3,24}$/;
const isValidNickname = (n) => typeof n === 'string' && VALID_NICKNAME.test(n.trim());
const isValidPassword = (p) => typeof p === 'string' && p.length >= 6 && p.length <= 128;
// La respuesta de seguridad ya no tiene que ser un número: la pregunta la
// escribe el usuario, así que exigir dígitos dejaba fuera casi cualquier
// pregunta con sentido. Los límites son los mismos que valida el backend.
const isValidSecurityAnswer = (a) => typeof a === 'string' && a.trim().length >= 1 && a.trim().length <= 100;
const isValidSecurityQuestionText = (q) => typeof q === 'string' && q.trim().length >= 5 && q.trim().length <= 120;
const isValidEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) && e.trim().length <= 254;

export const USER_TYPES = ['user', 'preacher'];
const isValidUserType = (t) => USER_TYPES.includes(t);

export const validators = {
  isValidNickname,
  isValidPassword,
  isValidSecurityAnswer,
  isValidSecurityQuestionText,
  isValidEmail,
  isValidUserType,
};

// Claves de las preguntas predefinidas de antes del schema 8.
//
// Ya no se ofrecen al registrarse —cada usuario escribe la suya—, pero las
// cuentas creadas antes las tienen guardadas y hay que poder traducirlas
// cuando el usuario recupera el acceso.
export const LEGACY_SECURITY_QUESTIONS = [
  { key: 'siblings', i18nKey: 'auth.questions.siblings' },
  { key: 'favorite_number', i18nKey: 'auth.questions.favorite_number' },
  { key: 'bible_start_year', i18nKey: 'auth.questions.bible_start_year' },
  { key: 'pets_count', i18nKey: 'auth.questions.pets_count' },
  { key: 'countries_visited', i18nKey: 'auth.questions.countries_visited' },
];

// ── LOCALSTORAGE FALLBACK (mock legacy, Opción A) ──
const USERS_KEY = 'robible:users:v1';
const SESSION_KEY = 'robible:session:v1';
const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out.buffer;
};
const randomSalt = () => {
  const s = new Uint8Array(16); crypto.getRandomValues(s); return toHex(s);
};
const hashValue = async (value, saltHex) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(value), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
};
const verifyHash = async (value, saltHex, expected) => (await hashValue(value, saltHex)) === expected;

const getLSUsers = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch { return {}; } };
const saveLSUsers = (u) => localStorage.setItem(USERS_KEY, JSON.stringify(u));
const saveLSSession = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
const clearLSSession = () => localStorage.removeItem(SESSION_KEY);

const publicUser = (u) => ({ id: u.id, nickname: u.nickname, createdAt: u.createdAt || u.created_at, updatedAt: u.updatedAt || u.updated_at });

const makeToken = (userId) => {
  const payload = { sub: userId, iat: Date.now(), exp: Date.now() + SESSION_TTL_MS };
  return 'rb.' + btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};
const readToken = (token) => {
  try {
    if (!token || !token.startsWith('rb.')) return null;
    const b64 = token.slice(3).replace(/-/g, '+').replace(/_/g, '/');
    const p = JSON.parse(atob(b64));
    return p.exp < Date.now() ? null : p;
  } catch { return null; }
};

// ── API pública ─────────────────────────────────────────

const validateRegister = (d) => {
  if (!isValidNickname(d.nickname)) return 'invalid_nickname';
  if (!isValidPassword(d.password)) return 'invalid_password';
  if (!isValidSecurityQuestionText(d.securityQuestionText)) return 'invalid_security_question';
  if (!isValidSecurityAnswer(d.securityAnswer)) return 'invalid_security_answer';
  if (d.userType !== undefined && !isValidUserType(d.userType)) return 'invalid_user_type';
  // El email es opcional: sólo molesta si viene relleno y mal escrito.
  if (d.email?.trim() && !isValidEmail(d.email)) return 'invalid_email';
  return null;
};

export const register = async (data) => {
  const validationError = validateRegister(data);
  if (validationError) return { ok: false, error: translateApiError(validationError) };

  if (USE_BACKEND) {
    try {
      const res = await api.post('/api/auth/register', {
        nickname: data.nickname.trim(),
        password: data.password,
        securityQuestionText: data.securityQuestionText.trim(),
        securityAnswer: data.securityAnswer.trim(),
        userType: data.userType || 'user',
        email: data.email?.trim() || undefined,
        // El backend seedea las categorías por defecto en este idioma.
        locale: getCurrentLocale(),
      });
      tokenStore.set(res.token, res.user);
      saveLSSession({ token: res.token, userId: res.user.id, exp: Date.now() + SESSION_TTL_MS });
      return { ok: true, user: res.user, token: res.token };
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        return { ok: false, error: translateApiError(e.code) };
      }
      console.warn('register: backend failed, falling back to localStorage');
    }
  }

  // Fallback localStorage
  const users = getLSUsers();
  const normalized = data.nickname.trim().toLowerCase();
  if (users[normalized]) return { ok: false, error: 'auth.errors.nickname_taken' };
  const userId = 'u_' + crypto.randomUUID();
  const passwordSalt = randomSalt();
  const passwordHash = await hashValue(data.password, passwordSalt);
  const answerSalt = randomSalt();
  const answerHash = await hashValue(data.securityAnswer.trim(), answerSalt);
  const now = new Date().toISOString();
  users[normalized] = {
    id: userId, nickname: data.nickname.trim(),
    passwordSalt, passwordHash,
    securityQuestion: data.securityQuestion,
    securityAnswerSalt: answerSalt, securityAnswerHash: answerHash,
    createdAt: now, updatedAt: now,
  };
  saveLSUsers(users);
  const token = makeToken(userId);
  saveLSSession({ token, userId, exp: Date.now() + SESSION_TTL_MS });
  const user = publicUser(users[normalized]);
  tokenStore.set(token, user);
  return { ok: true, user, token };
};

export const login = async (nickname, password) => {
  if (!nickname || !password) return { ok: false, error: 'auth.errors.missing_credentials' };

  if (USE_BACKEND) {
    try {
      const res = await api.post('/api/auth/login', { nickname: nickname.trim(), password });
      tokenStore.set(res.token, res.user);
      saveLSSession({ token: res.token, userId: res.user.id, exp: Date.now() + SESSION_TTL_MS });
      return { ok: true, user: res.user, token: res.token };
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        return { ok: false, error: translateApiError(e.code) };
      }
      console.warn('login: backend failed, falling back to localStorage');
    }
  }

  // Fallback
  const users = getLSUsers();
  const user = users[nickname.trim().toLowerCase()];
  if (!user) return { ok: false, error: 'auth.errors.invalid_credentials' };
  if (!(await verifyHash(password, user.passwordSalt, user.passwordHash))) {
    return { ok: false, error: 'auth.errors.invalid_credentials' };
  }
  const token = makeToken(user.id);
  saveLSSession({ token, userId: user.id, exp: Date.now() + SESSION_TTL_MS });
  const pub = publicUser(user);
  tokenStore.set(token, pub);
  return { ok: true, user: pub, token };
};

export const getSecurityQuestion = async (nickname) => {
  if (USE_BACKEND) {
    try {
      const res = await api.post('/api/auth/recover/question', { nickname: nickname.trim() }, { auth: false });
      return { ok: true, securityQuestion: res.securityQuestion, securityQuestionText: res.securityQuestionText };
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        return { ok: false, error: translateApiError(e.code) };
      }
      console.warn('getSecurityQuestion: backend failed, falling back');
    }
  }
  const users = getLSUsers();
  const user = users[(nickname || '').trim().toLowerCase()];
  if (!user) return { ok: false, error: 'auth.errors.user_not_found' };
  return { ok: true, securityQuestion: user.securityQuestion };
};

export const verifySecurityAnswer = async (nickname, answer) => {
  if (!isValidSecurityAnswer(answer)) return { ok: false, error: 'auth.errors.invalid_security_answer' };

  if (USE_BACKEND) {
    try {
      const res = await api.post('/api/auth/recover/verify', { nickname: nickname.trim(), answer: answer.trim() }, { auth: false });
      return { ok: true, resetToken: res.resetToken };
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        return { ok: false, error: translateApiError(e.code) };
      }
      console.warn('verifySecurityAnswer: backend failed, falling back');
    }
  }

  const users = getLSUsers();
  const user = users[(nickname || '').trim().toLowerCase()];
  if (!user) return { ok: false, error: 'auth.errors.user_not_found' };
  if (!(await verifyHash(answer.trim(), user.securityAnswerSalt, user.securityAnswerHash))) {
    return { ok: false, error: 'auth.errors.invalid_security_answer' };
  }
  const resetToken = 'rb.reset.' + btoa(JSON.stringify({ sub: user.id, iat: Date.now(), exp: Date.now() + 5 * 60 * 1000 }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return { ok: true, resetToken };
};

export const resetPassword = async (resetToken, newPassword) => {
  if (!isValidPassword(newPassword)) return { ok: false, error: 'auth.errors.invalid_password' };

  if (USE_BACKEND) {
    try {
      const res = await api.post('/api/auth/recover/reset', { resetToken, newPassword }, { auth: false });
      tokenStore.set(res.token, res.user);
      saveLSSession({ token: res.token, userId: res.user.id, exp: Date.now() + SESSION_TTL_MS });
      return { ok: true, user: res.user, token: res.token };
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        return { ok: false, error: translateApiError(e.code) };
      }
      console.warn('resetPassword: backend failed, falling back');
    }
  }

  const tokenData = readToken(resetToken);
  if (!tokenData || !tokenData.sub) return { ok: false, error: 'auth.errors.reset_token_expired' };
  const users = getLSUsers();
  const nickKey = Object.keys(users).find((k) => users[k].id === tokenData.sub);
  if (!nickKey) return { ok: false, error: 'auth.errors.user_not_found' };
  const newSalt = randomSalt();
  const newHash = await hashValue(newPassword, newSalt);
  users[nickKey].passwordSalt = newSalt;
  users[nickKey].passwordHash = newHash;
  users[nickKey].updatedAt = new Date().toISOString();
  saveLSUsers(users);
  const token = makeToken(users[nickKey].id);
  saveLSSession({ token, userId: users[nickKey].id, exp: Date.now() + SESSION_TTL_MS });
  const pub = publicUser(users[nickKey]);
  tokenStore.set(token, pub);
  return { ok: true, user: pub, token };
};

export const me = () => {
  const lsUser = tokenStore.getUser();
  if (!lsUser) return null;
  return lsUser;
};

/**
 * Cambia tipo de cuenta, email o pregunta de seguridad. Todo opcional: se manda
 * sólo lo que se quiere cambiar.
 *
 * Necesita backend: el perfil vive en D1. En modo sin conexión no hay nada que
 * actualizar, porque el usuario local no tiene ni tipo ni email.
 */
export const updateProfile = async (cambios) => {
  if (!USE_BACKEND) return { ok: false, error: 'auth.errors.unknown' };

  if (cambios.userType !== undefined && !isValidUserType(cambios.userType)) {
    return { ok: false, error: translateApiError('invalid_user_type') };
  }
  if (cambios.email?.trim() && !isValidEmail(cambios.email)) {
    return { ok: false, error: translateApiError('invalid_email') };
  }
  // La pregunta y la respuesta viajan juntas o no viajan: dejar una pregunta
  // nueva con la respuesta vieja deja al usuario sin poder recuperar la cuenta.
  const tocaSeguridad = cambios.securityQuestionText !== undefined || cambios.securityAnswer !== undefined;
  if (tocaSeguridad) {
    if (!isValidSecurityQuestionText(cambios.securityQuestionText)) {
      return { ok: false, error: translateApiError('invalid_security_question') };
    }
    if (!isValidSecurityAnswer(cambios.securityAnswer)) {
      return { ok: false, error: translateApiError('invalid_security_answer') };
    }
  }

  try {
    const res = await api.patch('/api/auth/me', cambios);
    // Refrescar el usuario guardado: el tipo decide qué menús se ven.
    tokenStore.set(null, res.user);
    return { ok: true, user: res.user };
  } catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
      return { ok: false, error: translateApiError(e.code) };
    }
    return { ok: false, error: 'auth.errors.unknown' };
  }
};

export const logout = async () => {
  if (USE_BACKEND) {
    try { await api.post('/api/auth/logout'); } catch (e) { /* ignore */ }
  }
  tokenStore.clear();
  clearLSSession();
};

// Verifica el token contra el backend (en background, no bloquea la UI)
export const verifySession = async () => {
  if (!USE_BACKEND) return tokenStore.getUser();
  try {
    const res = await api.get('/api/auth/me');
    tokenStore.set(tokenStore.get(), res.user);
    return res.user;
  } catch (e) {
    if (e.status === 401) {
      tokenStore.clear();
      clearLSSession();
      return null;
    }
    return tokenStore.getUser();
  }
};
