// Servicio del panel de admin.
//
// Sin fallback a localStorage, a propósito: un admin sin conexión al backend
// no tiene nada que administrar (no hay copia local de "todos los usuarios").
// Mismo criterio que `updateProfile` en auth.service.js.

import { api, ApiError, translateApiError } from './apiClient.js';
import { USE_BACKEND } from '../config.js';

const fallo = (e, defecto = 'auth.errors.unknown') =>
  e instanceof ApiError && e.status >= 400 && e.status < 500
    ? { ok: false, error: translateApiError(e.code) }
    : { ok: false, error: defecto };

const sinBackend = () => ({ ok: false, error: 'auth.errors.unknown' });

export const getStats = async () => {
  if (!USE_BACKEND) return sinBackend();
  try {
    const res = await api.get('/api/admin/stats');
    return { ok: true, stats: res.stats };
  } catch (e) {
    return fallo(e);
  }
};

export const searchUsers = async (q = '', page = 1) => {
  if (!USE_BACKEND) return sinBackend();
  try {
    const query = new URLSearchParams({ q: q.trim(), page: String(page) });
    const res = await api.get(`/api/admin/users?${query}`);
    return { ok: true, users: res.users, page: res.page };
  } catch (e) {
    return fallo(e);
  }
};

export const setUserDisabled = async (id, disabled) => {
  if (!USE_BACKEND) return sinBackend();
  try {
    const res = await api.patch(`/api/admin/users/${encodeURIComponent(id)}`, { disabled });
    return { ok: true, user: res.user };
  } catch (e) {
    return fallo(e);
  }
};

export const setUserAdmin = async (id, isAdmin) => {
  if (!USE_BACKEND) return sinBackend();
  try {
    const res = await api.patch(`/api/admin/users/${encodeURIComponent(id)}`, { isAdmin });
    return { ok: true, user: res.user };
  } catch (e) {
    return fallo(e);
  }
};

export const deleteUser = async (id) => {
  if (!USE_BACKEND) return sinBackend();
  try {
    await api.delete(`/api/admin/users/${encodeURIComponent(id)}`);
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
};

/** Devuelve `{ ok: true, newPassword }` — la contraseña sólo viaja esta vez. */
export const resetUserPassword = async (id) => {
  if (!USE_BACKEND) return sinBackend();
  try {
    const res = await api.post(`/api/admin/users/${encodeURIComponent(id)}/reset-password`);
    return { ok: true, newPassword: res.newPassword };
  } catch (e) {
    return fallo(e);
  }
};

export const searchSermons = async (q = '', page = 1) => {
  if (!USE_BACKEND) return sinBackend();
  try {
    const query = new URLSearchParams({ q: q.trim(), page: String(page) });
    const res = await api.get(`/api/admin/sermons?${query}`);
    return { ok: true, sermons: res.sermons, page: res.page };
  } catch (e) {
    return fallo(e);
  }
};

/** Despublica de oficio (restringe visibilidad). No se puede volver a publicar desde aquí. */
export const unpublishSermon = async (id) => {
  if (!USE_BACKEND) return sinBackend();
  try {
    await api.patch(`/api/admin/sermons/${encodeURIComponent(id)}`, { isPublic: false });
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
};

export const deleteSermon = async (id) => {
  if (!USE_BACKEND) return sinBackend();
  try {
    await api.delete(`/api/admin/sermons/${encodeURIComponent(id)}`);
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
};
