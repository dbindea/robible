// Favorites service: API-first con cache localStorage.
// Mismo patrón que topics.service.js.

import { api, ApiError, translateApiError } from './apiClient.js';
import { USE_BACKEND } from '../config.js';

let currentUserId = null;
export const setCurrentUser = (userId) => { currentUserId = userId || null; };

const STORAGE_PREFIX = 'robible:favorites:v1';
const storageKey = () => currentUserId ? `${STORAGE_PREFIX}:${currentUserId}` : `${STORAGE_PREFIX}:anonymous`;

const readLS = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};
const writeLS = (favs) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(), JSON.stringify(favs));
};

const refEqual = (a, b) => a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;
const refKey = (r) => `${r.book}:${r.chapter}:${r.verse}`;

// ── Public API ─────────────────────────────────────────

export const loadFavorites = () => {
  const raw = readLS();
  return raw.map((f) => ({
    id: f.id,
    book: f.book,
    chapter: f.chapter,
    verse: f.verse,
    addedAt: f.addedAt,
  }));
};

export const syncFromServer = async () => {
  if (!USE_BACKEND) return null;
  try {
    const res = await api.get('/api/favorites');
    const list = (res.favorites || []).map((f) => ({
      id: f.id, book: f.book, chapter: f.chapter, verse: f.verse, addedAt: f.addedAt,
    }));
    writeLS(list);
    return list;
  } catch (e) {
    console.warn('favorites syncFromServer failed:', e.message);
    return null;
  }
};

export const isFavorite = (book, chapter, verse) => {
  const favs = readLS();
  return favs.some((f) => f.book === book && f.chapter === chapter && f.verse === verse);
};

export const addFavorite = async (book, chapter, verse) => {
  const ref = { book, chapter, verse };
  if (USE_BACKEND) {
    try {
      const res = await api.post('/api/favorites', ref);
      const favs = readLS();
      if (!favs.some((f) => refEqual(f, ref))) {
        favs.unshift({ id: res.favorite.id, book, chapter, verse, addedAt: res.favorite.addedAt });
        writeLS(favs);
      }
      return { ok: true, favorite: res.favorite };
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        return { ok: false, error: translateApiError(e.code) };
      }
      console.warn('addFavorite: backend failed, falling back');
    }
  }
  // Fallback localStorage
  const favs = readLS();
  if (favs.some((f) => refEqual(f, ref))) {
    return { ok: false, error: 'auth.errors.favorite_already_exists' };
  }
  const fav = { id: 'fav-' + crypto.randomUUID(), book, chapter, verse, addedAt: new Date().toISOString() };
  favs.unshift(fav);
  writeLS(favs);
  return { ok: true, favorite: fav };
};

export const removeFavorite = async (book, chapter, verse) => {
  const ref = { book, chapter, verse };
  if (USE_BACKEND) {
    try {
      await api.delete('/api/favorites', { body: ref });
      const favs = readLS().filter((f) => !refEqual(f, ref));
      writeLS(favs);
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        return { ok: false, error: translateApiError(e.code) };
      }
      console.warn('removeFavorite: backend failed, falling back');
    }
  }
  const favs = readLS();
  const before = favs.length;
  const after = favs.filter((f) => !refEqual(f, ref));
  if (after.length === before) return { ok: false, error: 'auth.errors.favorite_not_found' };
  writeLS(after);
  return { ok: true };
};

export const toggleFavorite = async (book, chapter, verse) => {
  if (isFavorite(book, chapter, verse)) {
    return removeFavorite(book, chapter, verse);
  }
  return addFavorite(book, chapter, verse);
};

export const resetAll = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey());
};

export { refKey };
