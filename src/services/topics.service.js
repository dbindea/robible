// Topics service: API-first con cache localStorage.
//
// Cuando USE_BACKEND=true, sincroniza con el backend. El localStorage
// actúa como cache offline: las escrituras van primero al backend, y si
// falla, al cache local. En el siguiente login desde otro dispositivo,
// el cache se reemplaza con la respuesta del backend.
//
// Cuando USE_BACKEND=false, usa solo localStorage (modo offline puro).

import { api, ApiError, translateApiError } from './apiClient.js';
import { USE_BACKEND } from '../config.js';

// ── Estado del usuario actual (lo cambia el store) ──────
let currentUserId = null;
export const setCurrentUser = (userId) => { currentUserId = userId || null; };

const STORAGE_PREFIX = 'robible:topics:v1';
const storageKey = () => currentUserId ? `${STORAGE_PREFIX}:${currentUserId}` : `${STORAGE_PREFIX}:anonymous`;

// ── LocalStorage helpers ─────────────────────────────────
const readLS = () => {
  if (typeof window === 'undefined') return { topics: [], verseRefs: {} };
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.topics) && typeof parsed.verseRefs === 'object') {
      return parsed;
    }
  } catch {}
  return null;
};
const writeLS = (state) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(), JSON.stringify(state));
};

// ── Migración desde key legacy (sin namespace) ─────────
const migrateLegacy = () => {
  const legacy = localStorage.getItem(STORAGE_PREFIX);
  if (!legacy) return;
  if (storageKey() === `${STORAGE_PREFIX}:anonymous`) {
    const parsed = readLS();
    if (!parsed) {
      try {
        const data = JSON.parse(legacy);
        writeLS(data);
      } catch {}
    }
  }
  localStorage.removeItem(STORAGE_PREFIX);
};

// ── Defaults seed (cuando usuario nuevo, sin backend) ────
const DEFAULT_TOPICS = {
  ro: [
    { name: 'Mântuire', icon: '✝️', color: '#D4A853' },
    { name: 'Îndurare', icon: '🤲', color: '#2E7D9B' },
    { name: 'Vindecare', icon: '🩹', color: '#5BA89E' },
  ],
  es: [
    { name: 'Salvación', icon: '✝️', color: '#D4A853' },
    { name: 'Misericordia', icon: '🤲', color: '#2E7D9B' },
    { name: 'Sanación', icon: '🩹', color: '#5BA89E' },
  ],
};
const detectLocale = () => {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement?.lang || 'ro';
    return lang.startsWith('es') ? 'es' : 'ro';
  }
  return 'ro';
};
const slugify = (v = '') =>
  String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'topic';
const genId = (name) => {
  const base = slugify(name);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}-${rand}`;
};
const nowIso = () => new Date().toISOString();

const seedDefaultsIfEmpty = () => {
  const existing = readLS();
  if (existing) return existing;
  const locale = detectLocale();
  const createdAt = nowIso();
  const topics = (DEFAULT_TOPICS[locale] || DEFAULT_TOPICS.es).map((t) => ({
    id: genId(t.name),
    name: t.name,
    icon: t.icon,
    color: t.color,
    isDefault: true,
    createdAt,
  }));
  const state = { topics, verseRefs: {} };
  writeLS(state);
  return state;
};

// ── Helpers API → local ─────────────────────────────────
const normalizeFromApi = (apiData) => ({
  topics: (apiData.topics || []).map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon || '📌',
    color: t.color || '#2E7D9B',
    isDefault: !!t.isDefault,
    createdAt: t.createdAt,
  })),
  verseRefs: apiData.verseRefs || {},
});
const verseRefEqual = (a, b) => a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;

// ── Public API: cada función intenta API y cae a LS ─────

export const loadTopics = () => {
  migrateLegacy();
  return (readLS() || seedDefaultsIfEmpty()).topics;
};

export const loadVerseRefs = () => {
  migrateLegacy();
  return (readLS() || seedDefaultsIfEmpty()).verseRefs;
};

// Pull desde backend y reemplaza cache
export const syncFromServer = async () => {
  if (!USE_BACKEND) return null;
  try {
    const res = await api.get('/api/topics');
    const state = normalizeFromApi(res);
    writeLS(state);
    return state;
  } catch (e) {
    console.warn('syncFromServer failed:', e.message);
    return null;
  }
};

export const createTopic = async ({ name, icon = '📌', color = '#2E7D9B' }) => {
  if (!name?.trim()) throw new Error('Topic name is required');

  if (USE_BACKEND) {
    try {
      const res = await api.post('/api/topics', { name: name.trim(), icon, color });
      const state = readLS() || { topics: [], verseRefs: {} };
      const topic = { id: res.topic.id, name: res.topic.name, icon: res.topic.icon, color: res.topic.color, isDefault: !!res.topic.isDefault, createdAt: res.topic.createdAt };
      state.topics.push(topic);
      state.verseRefs[topic.id] = state.verseRefs[topic.id] || [];
      writeLS(state);
      return topic;
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        throw new Error(translateApiError(e.code));
      }
      console.warn('createTopic: backend failed, falling back');
    }
  }

  // Fallback localStorage
  const state = readLS() || seedDefaultsIfEmpty();
  const id = genId(name);
  const topic = { id, name: name.trim(), icon, color, isDefault: false, createdAt: nowIso() };
  state.topics.push(topic);
  state.verseRefs[id] = state.verseRefs[id] || [];
  writeLS(state);
  return topic;
};

export const updateTopic = async (id, patch) => {
  if (USE_BACKEND) {
    try {
      const res = await api.patch(`/api/topics/${id}`, patch);
      const state = readLS();
      if (state) {
        const idx = state.topics.findIndex((t) => t.id === id);
        if (idx !== -1) {
          state.topics[idx] = {
            ...state.topics[idx],
            name: res.topic.name,
            icon: res.topic.icon,
            color: res.topic.color,
          };
          writeLS(state);
        }
      }
      return res.topic;
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        throw new Error(translateApiError(e.code));
      }
      console.warn('updateTopic: backend failed, falling back');
    }
  }

  const state = readLS();
  if (!state) return null;
  const idx = state.topics.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const old = state.topics[idx];
  const merged = {
    ...old,
    ...patch,
    id,
    isDefault: old.isDefault,
    name: patch.name !== undefined ? (patch.name?.trim() || old.name) : old.name,
  };
  state.topics[idx] = merged;
  writeLS(state);
  return merged;
};

export const deleteTopic = async (id) => {
  if (USE_BACKEND) {
    try {
      await api.delete(`/api/topics/${id}`);
      const state = readLS();
      if (state) {
        state.topics = state.topics.filter((t) => t.id !== id);
        delete state.verseRefs[id];
        writeLS(state);
      }
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        throw new Error(translateApiError(e.code));
      }
      console.warn('deleteTopic: backend failed, falling back');
    }
  }

  const state = readLS();
  if (!state) return false;
  const topic = state.topics.find((t) => t.id === id);
  if (!topic) return false;
  if (topic.isDefault) return false;
  state.topics = state.topics.filter((t) => t.id !== id);
  delete state.verseRefs[id];
  writeLS(state);
  return true;
};

export const addVerseRef = async (topicId, ref) => {
  if (USE_BACKEND) {
    try {
      await api.post(`/api/topics/${topicId}/verses`, ref);
      const state = readLS() || { topics: [], verseRefs: {} };
      state.verseRefs[topicId] = state.verseRefs[topicId] || [];
      if (!state.verseRefs[topicId].some((v) => verseRefEqual(v, ref))) {
        state.verseRefs[topicId].push({ ...ref, addedAt: nowIso() });
        writeLS(state);
      }
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        throw new Error(translateApiError(e.code));
      }
      console.warn('addVerseRef: backend failed, falling back');
    }
  }

  const state = readLS();
  if (!state) return false;
  if (!state.topics.some((t) => t.id === topicId)) throw new Error(`Topic ${topicId} not found`);
  state.verseRefs[topicId] = state.verseRefs[topicId] || [];
  if (state.verseRefs[topicId].some((v) => verseRefEqual(v, ref))) return false;
  state.verseRefs[topicId].push({ ...ref, addedAt: nowIso() });
  writeLS(state);
  return true;
};

export const removeVerseRef = async (topicId, ref) => {
  if (USE_BACKEND) {
    try {
      await api.delete(`/api/topics/${topicId}/verses`, { body: ref });
      const state = readLS();
      if (state && state.verseRefs[topicId]) {
        state.verseRefs[topicId] = state.verseRefs[topicId].filter((v) => !verseRefEqual(v, ref));
        writeLS(state);
      }
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        throw new Error(translateApiError(e.code));
      }
      console.warn('removeVerseRef: backend failed, falling back');
    }
  }

  const state = readLS();
  if (!state?.verseRefs[topicId]) return false;
  const before = state.verseRefs[topicId].length;
  state.verseRefs[topicId] = state.verseRefs[topicId].filter((v) => !verseRefEqual(v, ref));
  if (state.verseRefs[topicId].length === before) return false;
  writeLS(state);
  return true;
};

export const getTopicsContaining = (ref) => {
  const state = readLS();
  if (!state) return [];
  return state.topics.filter((t) =>
    (state.verseRefs[t.id] || []).some((v) => verseRefEqual(v, ref)),
  );
};

export const resetAll = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey());
};
