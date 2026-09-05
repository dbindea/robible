// API client: fetch wrapper que añade Authorization y maneja errores.
// Usado por auth.service.js, topics.service.js y favorites.service.js.

import { API_BASE_URL, USE_BACKEND } from '../config.js';

const TOKEN_KEY = 'robible:auth:token';
const USER_KEY = 'robible:auth:user';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token, user) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  getUser: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  },
};

class ApiError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
  get isRateLimited() { return this.code?.startsWith?.('rate_limit_exceeded'); }
  get retryAfter() {
    const m = this.code?.match?.(/^rate_limit_exceeded:(\w+)$/);
    if (!m) return 60;
    return m[1] === 'hour' ? 3600 : 60;
  }
}

export { ApiError };

// Convierte errores i18n del backend a claves traducibles en el frontend
// (mismas que en el auth.service mock para compatibilidad).
const ERROR_KEYS = {
  invalid_nickname: 'auth.errors.invalid_nickname',
  invalid_password: 'auth.errors.invalid_password',
  invalid_security_question: 'auth.errors.invalid_security_question',
  invalid_security_answer: 'auth.errors.invalid_security_answer',
  nickname_taken: 'auth.errors.nickname_taken',
  user_not_found: 'auth.errors.user_not_found',
  invalid_credentials: 'auth.errors.invalid_credentials',
  missing_credentials: 'auth.errors.missing_credentials',
  security_question_required: 'auth.errors.security_question_required',
  reset_token_expired: 'auth.errors.reset_token_expired',
  invalid_json: 'auth.errors.invalid_json',
  topic_not_found: 'auth.errors.topic_not_found',
  topic_name_taken: 'auth.errors.topic_name_taken',
  cannot_delete_default: 'auth.errors.cannot_delete_default',
  verse_already_in_topic: 'auth.errors.verse_already_in_topic',
  verse_not_found: 'auth.errors.verse_not_found',
  favorite_already_exists: 'auth.errors.favorite_already_exists',
  favorite_not_found: 'auth.errors.favorite_not_found',
  highlight_not_found: 'auth.errors.highlight_not_found',
  invalid_verse_ref: 'auth.errors.invalid_verse_ref',
  invalid_name: 'auth.errors.invalid_name',
  invalid_icon: 'auth.errors.invalid_icon',
  invalid_color: 'auth.errors.invalid_color',
  invalid_current_password: 'auth.errors.invalid_current_password',
  missing_fields: 'auth.errors.missing_fields',
  missing_token: 'auth.errors.missing_token',
  invalid_or_expired_token: 'auth.errors.invalid_or_expired_token',
};

export const translateApiError = (code) => ERROR_KEYS[code] || 'auth.errors.unknown';

const request = async (method, path, { body, auth = true } = {}) => {
  if (!USE_BACKEND) {
    throw new ApiError('backend_disabled', 0, 'Backend disabled');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = tokenStore.get();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = { ok: false, error: 'invalid_response' }; }
  if (!res.ok || !data?.ok) {
    throw new ApiError(data?.error || `http_${res.status}`, res.status, data?.message);
  }
  return data;
};

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
  isEnabled: () => USE_BACKEND,
};

// Helper: intentar backend, caer a fallback si falla
export const withFallback = async (apiCall, fallback) => {
  if (!USE_BACKEND) return fallback();
  try {
    return await apiCall();
  } catch (e) {
    if (e instanceof ApiError && (e.code === 'backend_disabled' || e.status === 0)) {
      return fallback();
    }
    // Si es un 5xx o network error, fallback
    if (e.status >= 500 || e.status === 0) {
      console.warn('API call failed, using fallback:', e.message);
      return fallback();
    }
    throw e; // 4xx: error real del API, no fallback
  }
};
