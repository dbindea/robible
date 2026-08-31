// Searches service: API-first con localStorage fallback.
// Guarda el historial de búsquedas del usuario (máx 25).
// Offline-first: funciona sin backend, sincroniza cuando hay token.

import { api, ApiError, translateApiError } from './apiClient.js';

let currentUserId = null;
export const setCurrentUser = (userId) => { currentUserId = userId || null; };

const STORAGE_KEY = 'robible:searches:v1';
const MAX_SEARCHES = 25;

const storageKey = () => `${STORAGE_KEY}:${currentUserId}`;

const readLS = () => {
  if (typeof window === 'undefined' || !currentUserId) return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const writeLS = (searches) => {
  if (typeof window === 'undefined' || !currentUserId) return;
  localStorage.setItem(storageKey(), JSON.stringify(searches));
};

const normalizeSearch = (s) => ({
  id: s.id,
  searchText: s.searchText,
  searchType: s.searchType || 'match',
  testament: s.testament || 'all',
  books: Array.isArray(s.books) ? s.books : null,
  chapters: Array.isArray(s.chapters) ? s.chapters : null,
  lastUsedAt: s.lastUsedAt,
  createdAt: s.createdAt,
});

// ── Public API ─────────────────────────────────────────

export const loadSearches = () => readLS().map(normalizeSearch);

// Pull desde backend y reemplaza cache
export const syncFromServer = async () => {
  if (!currentUserId) return [];
  try {
    const res = await api.get('/api/searches');
    const list = (res.searches || []).map(normalizeSearch);
    writeLS(list);
    return list;
  } catch (e) {
    console.warn('searches syncFromServer failed:', e.message);
    return readLS().map(normalizeSearch);
  }
};

// Guardar/actualizar una búsqueda en el historial.
// Se llama automáticamente cuando el usuario hace una búsqueda.
export const saveSearch = async ({ searchText, searchType, testament, books, chapters }) => {
  if (!currentUserId) return { ok: false, error: 'auth_required' };
  if (!searchText || typeof searchText !== 'string' || !searchText.trim()) {
    return { ok: false };
  }

  // Guardar siempre en localStorage primero (offline-first)
  const searches = readLS();
  const existingIdx = searches.findIndex(
    (s) => s.searchText.trim().toLowerCase() === searchText.trim().toLowerCase()
  );
  const now = new Date().toISOString();
  const normalized = normalizeSearch({
    id: existingIdx >= 0 ? searches[existingIdx].id : `search_local_${Date.now()}`,
    searchText: searchText.trim(),
    searchType: searchType || 'match',
    testament: testament || 'all',
    books: books || null,
    chapters: chapters || null,
    lastUsedAt: now,
    createdAt: existingIdx >= 0 ? searches[existingIdx].createdAt : now,
  });

  // Reordenar: mover al frente o mantener posición
  const filtered = searches.filter(
    (s) => s.searchText.trim().toLowerCase() !== searchText.trim().toLowerCase()
  );
  const updated = [normalized, ...filtered].slice(0, MAX_SEARCHES);
  writeLS(updated);

  // Sincronizar con backend
  try {
    const res = await api.post('/api/searches', {
      searchText: normalized.searchText,
      searchType: normalized.searchType,
      testament: normalized.testament,
      books: normalized.books,
      chapters: normalized.chapters,
    });
    // Actualizar con el ID real del servidor
    const serverSearch = normalizeSearch(res.search);
    const localIdx = updated.findIndex(
      (s) => s.searchText.trim().toLowerCase() === normalized.searchText.trim().toLowerCase()
    );
    if (localIdx >= 0) {
      updated[localIdx] = serverSearch;
      writeLS(updated);
    }
    return { ok: true, search: serverSearch };
  } catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
      return { ok: false, error: translateApiError(e.code) };
    }
    throw e; // errores de red son críticos
  }
};

// Eliminar una búsqueda del historial
export const removeSearch = async (id) => {
  if (!currentUserId) return { ok: false, error: 'auth_required' };
  // Siempre quitar de localStorage primero
  const searches = readLS().filter((s) => s.id !== id);
  writeLS(searches);

  try {
    await api.delete('/api/searches', { body: { id } });
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
      return { ok: false, error: translateApiError(e.code) };
    }
    throw e;
  }
};

export const resetAll = () => {
  if (typeof window === 'undefined' || !currentUserId) return;
  localStorage.removeItem(storageKey());
};
