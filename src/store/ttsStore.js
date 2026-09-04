/**
 * TTS store — global state for karaoke playback.
 * Persists speed, ambient, volume in localStorage.
 */

import { writable, derived } from 'svelte/store';

const TTS_SPEED_KEY = 'robible:tts:speed';
const TTS_AMBIENT_KEY = 'robible:tts:ambient';
const TTS_VOLUME_KEY = 'robible:tts:volume';
const TTS_MUSIC_VOLUME_KEY = 'robible:tts:musicVolume';

// ─── Load persisted values ────────────────────────────────────────────────────
const loadNumber = (key, fallback) => {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? Number(val) : fallback;
  } catch (_) {
    return fallback;
  }
};

const loadString = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (_) {
    return fallback;
  }
};

// ─── Stores ──────────────────────────────────────────────────────────────────
export const ttsSpeed = writable(loadNumber(TTS_SPEED_KEY, 1.0));
export const ttsAmbient = writable(loadString(TTS_AMBIENT_KEY, 'none')); // 'none' | 'procedural' | 'hymn'
export const ttsVolume = writable(loadNumber(TTS_VOLUME_KEY, 1.0));
export const musicVolume = writable(loadNumber(TTS_MUSIC_VOLUME_KEY, 0.15));

// Playback state (not persisted)
export const ttsState = writable({
  playing: false,
  paused: false,
  wordIndex: -1,
  wordCount: 0,
  currentBook: null,
  currentChapter: null,
  currentVerse: null,
  // Track which verse is currently being spoken
  verseText: '',
  verseKey: '', // "book-chapter-verse" for diffing
});

// Panel open/closed
export const ttsPanelOpen = writable(false);

// ─── Persist on change ───────────────────────────────────────────────────────
ttsSpeed.subscribe((v) => {
  try { localStorage.setItem(TTS_SPEED_KEY, String(v)); } catch (_) {}
});

ttsAmbient.subscribe((v) => {
  try { localStorage.setItem(TTS_AMBIENT_KEY, v); } catch (_) {}
});

ttsVolume.subscribe((v) => {
  try { localStorage.setItem(TTS_VOLUME_KEY, String(v)); } catch (_) {}
});

musicVolume.subscribe((v) => {
  try { localStorage.setItem(TTS_MUSIC_VOLUME_KEY, String(v)); } catch (_) {}
});

// ─── Derived ─────────────────────────────────────────────────────────────────
export const ttsProgress = derived(ttsState, ($s) => {
  if ($s.wordCount === 0 || $s.wordIndex < 0) return 0;
  return Math.min(1, ($s.wordIndex + 1) / $s.wordCount);
});

export const ttsDisplayState = derived(ttsState, ($s) => {
  if ($s.paused) return 'paused';
  if ($s.playing) return 'playing';
  return 'idle';
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Sin llamadas hoy: TtsPlayer hace este mismo `ttsState.update()` en línea.
// Se conserva junto con el resto de la ruta de TTS pendiente de reconectar
// (ver docs/AUDITORIA-2026-09-04.md, hallazgo 13).
export function startTtsVerse(book, chapter, verse, text) {
  ttsState.update((s) => ({
    ...s,
    playing: true,
    paused: false,
    wordIndex: -1,
    wordCount: text.trim().split(/\s+/).length,
    currentBook: book,
    currentChapter: chapter,
    currentVerse: verse,
    verseText: text,
    verseKey: `${book}-${chapter}-${verse}`,
  }));
}

export function updateTtsWord(index, count) {
  ttsState.update((s) => ({
    ...s,
    wordIndex: index,
    wordCount: count,
  }));
}

export function pauseTts() {
  ttsState.update((s) => ({ ...s, paused: true, playing: false }));
}

export function resumeTts() {
  ttsState.update((s) => ({ ...s, paused: false, playing: true }));
}

export function stopTts() {
  ttsState.update((s) => ({
    ...s,
    playing: false,
    paused: false,
    wordIndex: -1,
    wordCount: 0,
    verseText: '',
    verseKey: '',
  }));
}

export function endTts() {
  ttsState.update((s) => ({
    ...s,
    playing: false,
    paused: false,
    wordIndex: -1,
  }));
}
