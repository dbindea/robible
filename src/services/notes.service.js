// Notes service: API-first. Solo usuarios autenticados.
// localStorage actúa como cache para display (sync on login).

import { api, ApiError, translateApiError } from './apiClient.js';

let currentUserId = null;
export const setCurrentUser = (userId) => { currentUserId = userId || null; };

const STORAGE_PREFIX = 'robible:notes:v1';
const storageKey = () => `${STORAGE_PREFIX}:${currentUserId}`;

const readLS = () => {
  if (typeof window === 'undefined' || !currentUserId) return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};
const writeLS = (notes) => {
  if (typeof window === 'undefined' || !currentUserId) return;
  localStorage.setItem(storageKey(), JSON.stringify(notes));
};

const refEqual = (a, b) => a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;

const normalizeNote = (n) => ({
  id: n.id,
  book: n.book,
  chapter: n.chapter,
  verse: n.verse,
  text: n.text,
  color: n.color || null,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

// ── Public API ─────────────────────────────────────────

export const loadNotes = () => readLS().map(normalizeNote);

// Pull desde backend y reemplaza cache
export const syncFromServer = async () => {
  if (!currentUserId) return [];
  try {
    const res = await api.get('/api/notes');
    const list = (res.notes || []).map(normalizeNote);
    writeLS(list);
    return list;
  } catch (e) {
    console.warn('notes syncFromServer failed:', e.message);
    return readLS().map(normalizeNote);
  }
};

// Requiere que currentUserId esté seteado (usuario autenticado)
export const saveNote = async (book, chapter, verse, text, color = null) => {
  if (!currentUserId) {
    return { ok: false, error: 'auth_required' };
  }
  try {
    const res = await api.post('/api/notes', { book, chapter, verse, text, color });
    const note = normalizeNote(res.note);
    const notes = readLS();
    const idx = notes.findIndex((n) => n.book === book && n.chapter === chapter && n.verse === verse);
    if (idx !== -1) notes.splice(idx, 1);
    notes.unshift(note);
    writeLS(notes);
    return { ok: true, note };
  } catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
      return { ok: false, error: translateApiError(e.code) };
    }
    throw e; // errores de red son errores críticos
  }
};

export const deleteNote = async (book, chapter, verse) => {
  if (!currentUserId) {
    return { ok: false, error: 'auth_required' };
  }
  try {
    await api.delete('/api/notes', { body: { book, chapter, verse } });
    const notes = readLS().filter((n) => !refEqual(n, { book, chapter, verse }));
    writeLS(notes);
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
