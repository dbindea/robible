/**
 * Topics / themed-favorites service.
 *
 * Persists user-defined categories and the verses assigned to them.
 * Currently uses localStorage. The interface is designed so we can swap
 * the storage backend (e.g. a REST API when we add users + DB) without
 * touching the consumers.
 *
 * Data shape (v1):
 * {
 *   topics: [
 *     { id, name, icon, color, isDefault, createdAt }
 *   ],
 *   verseRefs: {
 *     [topicId]: [
 *       { book, chapter, verse, addedAt }
 *     ]
 *   }
 * }
 */

const STORAGE_KEY = 'robible:topics:v1';

const DEFAULT_TOPIC_TEMPLATES = {
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

const slugify = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'topic';

const generateId = (name) => {
  const base = slugify(name);
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}-${random}`;
};

const nowIso = () => new Date().toISOString();

const seedDefaults = (locale) => {
  const templates = DEFAULT_TOPIC_TEMPLATES[locale] || DEFAULT_TOPIC_TEMPLATES.es;
  const createdAt = nowIso();
  const topics = templates.map((t) => ({
    id: generateId(t.name),
    name: t.name,
    icon: t.icon,
    color: t.color,
    isDefault: true,
    createdAt,
  }));
  return { topics, verseRefs: {} };
};

const safeParse = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.topics) && typeof parsed.verseRefs === 'object') {
      return parsed;
    }
  } catch {
    // fallthrough
  }
  return null;
};

const readState = () => {
  if (typeof window === 'undefined') return { topics: [], verseRefs: {} };
  const existing = safeParse(localStorage.getItem(STORAGE_KEY));
  if (existing) return existing;
  const locale = (typeof document !== 'undefined' && document.documentElement?.lang) || 'es';
  const seeded = seedDefaults(locale);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
};

const writeState = (state) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

// === PUBLIC API ===

export const loadTopics = () => readState().topics;

export const loadVerseRefs = () => readState().verseRefs;

export const createTopic = ({ name, icon = '📌', color = '#2E7D9B' }) => {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Topic name is required');
  }
  const state = readState();
  const id = generateId(name);
  const topic = { id, name: name.trim(), icon, color, isDefault: false, createdAt: nowIso() };
  state.topics.push(topic);
  state.verseRefs[id] = state.verseRefs[id] || [];
  writeState(state);
  return topic;
};

export const updateTopic = (id, patch) => {
  const state = readState();
  const idx = state.topics.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const merged = { ...state.topics[idx], ...patch, id, isDefault: state.topics[idx].isDefault };
  if (patch.name !== undefined) merged.name = String(patch.name).trim() || state.topics[idx].name;
  state.topics[idx] = merged;
  writeState(state);
  return merged;
};

export const deleteTopic = (id) => {
  const state = readState();
  const topic = state.topics.find((t) => t.id === id);
  if (!topic) return false;
  if (topic.isDefault) return false; // No borrar defaults
  state.topics = state.topics.filter((t) => t.id !== id);
  delete state.verseRefs[id];
  writeState(state);
  return true;
};

const refsEqual = (a, b) =>
  a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;

export const addVerseRef = (topicId, ref) => {
  const state = readState();
  if (!state.topics.some((t) => t.id === topicId)) {
    throw new Error(`Topic ${topicId} not found`);
  }
  state.verseRefs[topicId] = state.verseRefs[topicId] || [];
  const exists = state.verseRefs[topicId].some((v) => refsEqual(v, ref));
  if (exists) return false;
  state.verseRefs[topicId].push({ ...ref, addedAt: nowIso() });
  writeState(state);
  return true;
};

export const removeVerseRef = (topicId, ref) => {
  const state = readState();
  if (!state.verseRefs[topicId]) return false;
  const before = state.verseRefs[topicId].length;
  state.verseRefs[topicId] = state.verseRefs[topicId].filter((v) => !refsEqual(v, ref));
  if (state.verseRefs[topicId].length === before) return false;
  writeState(state);
  return true;
};

export const getTopicsContaining = (ref) => {
  const state = readState();
  return state.topics.filter((t) =>
    (state.verseRefs[t.id] || []).some((v) => refsEqual(v, ref)),
  );
};

export const resetAll = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
};
