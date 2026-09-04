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
/**
 * Marca el versículo que se está leyendo.
 *
 * `item` es un elemento de la lista que se está pintando en pantalla
 * (`{ book, chapter, index, text, key }`). Se guarda su `key` tal cual porque
 * es la que usa la plantilla de Result.svelte para decidir el resaltado: así
 * funciona igual leyendo un capítulo que leyendo resultados de búsqueda, que
 * construyen la key de forma distinta.
 */
export function setTtsVerse(item) {
  ttsState.update((s) => ({
    ...s,
    playing: true,
    paused: false,
    wordIndex: -1,
    wordCount: item.text.trim().split(/\s+/).length,
    currentBook: item.book,
    currentChapter: item.chapter,
    currentVerse: item.index,
    verseText: item.text,
    verseKey: item.key,
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

/**
 * Reset completo: se usa al parar y al terminar la lista. Limpia también el
 * versículo actual — al parar, el usuario suele irse a otro capítulo, y dejar
 * la posición vieja hacía que reapareciera un resaltado fantasma.
 */
function resetState(s) {
  return {
    ...s,
    playing: false,
    paused: false,
    wordIndex: -1,
    wordCount: 0,
    currentBook: null,
    currentChapter: null,
    currentVerse: null,
    verseText: '',
    verseKey: '',
  };
}

export function stopTts() {
  ttsState.update(resetState);
}

export function endTts() {
  ttsState.update(resetState);
}
