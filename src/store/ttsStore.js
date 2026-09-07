/**
 * Estado global de la lectura acompañada de música.
 *
 * Se sigue llamando `tts` por herencia: hubo una versión que leía en voz alta
 * con SpeechSynthesis. Se retiró por decisión de producto —la voz del navegador
 * no daba la calidad que pide un texto bíblico— y hoy la función es música de
 * fondo + resaltado del versículo que toca. **Aquí no hay síntesis de voz.**
 * El nombre se mantiene porque renombrarlo toca el store, el componente, las
 * claves de i18n y las de localStorage de todos los usuarios; sería un cambio
 * atómico o nada (ver CLAUDE.md, trampa 1, sobre `robibile:navigate`).
 *
 * Persiste velocidad, ambiente y volumen de música en localStorage.
 */

import { writable } from 'svelte/store';
import { migrateAmbience } from '../services/music.service.js';

const TTS_SPEED_KEY = 'robible:tts:speed';
const TTS_AMBIENT_KEY = 'robible:tts:ambient';
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
// 'none' | 'ebraica' | 'rugaciune' | 'liniste'.
//
// Se pasa por `migrateAmbience` al leerlo porque el valor guardado en los
// navegadores es el del catálogo antiguo ('prayer'), y quien lo tuviera se
// habría encontrado la música apagada sin explicación. Ahora cae en
// 'rugaciune', que es lo más parecido a lo que venía escuchando.
export const ttsAmbient = writable(migrateAmbience(loadString(TTS_AMBIENT_KEY, 'none')));
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

musicVolume.subscribe((v) => {
  try { localStorage.setItem(TTS_MUSIC_VOLUME_KEY, String(v)); } catch (_) {}
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
