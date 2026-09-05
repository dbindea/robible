// Highlights service: subrayados de color por versículo.
// API-first con cache localStorage, mismo patrón que favorites.service.js.
//
// A diferencia de las notas, un subrayado es un upsert por versículo: volver a
// pintarlo con otro color reemplaza el anterior en vez de acumular filas.

import { api, ApiError, translateApiError } from './apiClient.js';
import { USE_BACKEND } from '../config.js';
import { normalizeHighlightColor } from '../config/highlight-palette.js';

let currentUserId = null;
export const setCurrentUser = (userId) => { currentUserId = userId || null; };

const STORAGE_PREFIX = 'robible:highlights:v1';
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
const writeLS = (list) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(), JSON.stringify(list));
};

const refEqual = (a, b) => a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;

const normalize = (h) => ({
  id: h.id,
  book: h.book,
  chapter: h.chapter,
  verse: h.verse,
  color: h.color,
  createdAt: h.createdAt,
  updatedAt: h.updatedAt,
});

// Reemplaza el subrayado de un versículo en la cache, o lo añade si no existía.
const upsertLS = (highlight) => {
  const list = readLS().filter((h) => !refEqual(h, highlight));
  list.push(highlight);
  writeLS(list);
  return list;
};

// ── Public API ─────────────────────────────────────────

export const loadHighlights = () => readLS().map(normalize);

export const syncFromServer = async () => {
  if (!USE_BACKEND) return null;
  try {
    const res = await api.get('/api/highlights');
    const list = (res.highlights || []).map(normalize);
    writeLS(list);
    return list;
  } catch (e) {
    console.warn('highlights syncFromServer failed:', e.message);
    return null;
  }
};

export const getHighlight = (book, chapter, verse) =>
  readLS().find((h) => h.book === book && h.chapter === chapter && h.verse === verse) || null;

export const setHighlight = async (book, chapter, verse, color) => {
  const hex = normalizeHighlightColor(color);
  if (!hex) return { ok: false, error: 'auth.errors.invalid_color' };

  const ref = { book, chapter, verse };
  if (USE_BACKEND) {
    try {
      const res = await api.post('/api/highlights', { ...ref, color: hex });
      const highlight = normalize(res.highlight);
      upsertLS(highlight);
      return { ok: true, highlight };
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        return { ok: false, error: translateApiError(e.code) };
      }
      console.warn('setHighlight: backend failed, falling back');
    }
  }

  // Fallback localStorage
  const now = new Date().toISOString();
  const existing = getHighlight(book, chapter, verse);
  const highlight = {
    id: existing?.id || 'hl-' + crypto.randomUUID(),
    ...ref,
    color: hex,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  upsertLS(highlight);
  return { ok: true, highlight };
};

export const removeHighlight = async (book, chapter, verse) => {
  const ref = { book, chapter, verse };
  if (USE_BACKEND) {
    try {
      await api.delete('/api/highlights', { body: ref });
      writeLS(readLS().filter((h) => !refEqual(h, ref)));
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        // Un 404 en el servidor y una cache local con el subrayado ya borrado
        // son el mismo estado deseado; limpiamos igual para no dejar fantasmas.
        writeLS(readLS().filter((h) => !refEqual(h, ref)));
        return { ok: false, error: translateApiError(e.code) };
      }
      console.warn('removeHighlight: backend failed, falling back');
    }
  }

  const before = readLS();
  const after = before.filter((h) => !refEqual(h, ref));
  if (after.length === before.length) return { ok: false, error: 'auth.errors.highlight_not_found' };
  writeLS(after);
  return { ok: true };
};

/**
 * Pinta, repinta o borra en un solo paso: si el versículo ya estaba subrayado
 * con ese mismo color, la acción es quitarlo. Es lo que espera el usuario al
 * volver a pulsar el color que ya tiene puesto.
 */
export const toggleHighlight = async (book, chapter, verse, color) => {
  const hex = normalizeHighlightColor(color);
  const existing = getHighlight(book, chapter, verse);
  if (existing && normalizeHighlightColor(existing.color) === hex) {
    return removeHighlight(book, chapter, verse);
  }
  return setHighlight(book, chapter, verse, color);
};

export const resetAll = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey());
};
