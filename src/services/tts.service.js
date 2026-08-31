/**
 * TTS service — wraps SpeechSynthesis API with word-level highlighting.
 *
 * Strategy:
 * - Primary: estimate timing per word based on text length + rate
 * - Enhancement: onboundary event fires in Chrome/Safari for precise timing
 * - Calibration: measure first sentence duration to refine estimates
 */

import { musicService } from './music.service.js';

const SPEECH_LANG_MAP = {
  ro: 'ro-RO',
  es: 'es-ES',
};

// Words per second estimates per language (empirical baseline)
const WORDS_PER_SECOND = {
  'ro-RO': 2.6,
  'es-ES': 2.8,
  default: 2.5,
};

let synth = null;
let utterance = null;
let words = [];
let wordTimings = []; // { start, end } in seconds
let wordIndex = -1;
let startTime = 0;
let pausedAt = 0; // offset in seconds when paused
let _rate = 1.0;
let _volume = 1.0;
let _voice = null;
let _lang = 'ro-RO';
let _onWord = null;
let _onEnd = null;
let _onStart = null;
let _onPause = null;
let _onResume = null;
let _calibrationFactor = 1.0; // adjusted after first sentence
let _tickInterval = null;
let _currentText = '';

function getSynth() {
  if (!synth) {
    synth = window.speechSynthesis;
  }
  return synth;
}

/**
 * Split text into words (preserving punctuation boundaries).
 */
function splitWords(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Estimate duration of a sentence in seconds.
 */
function estimateDuration(text, rate, lang) {
  const wps = WORDS_PER_SECOND[lang] || WORDS_PER_SECOND.default;
  const wordCount = splitWords(text).length;
  const baseDuration = (wordCount / wps) * _calibrationFactor;
  return baseDuration / rate;
}

/**
 * Build word timings array from estimated durations.
 */
function buildTimings(text, rate, lang) {
  const wordList = splitWords(text);
  const totalDuration = estimateDuration(text, rate, lang);
  const totalChars = wordList.reduce((sum, w) => sum + w.length, 0);

  const timings = [];
  let currentTime = 0;

  wordList.forEach((word) => {
    const charFraction = totalChars > 0 ? word.length / totalChars : 1 / wordList.length;
    const wordDuration = totalDuration * charFraction * 1.15; // slight padding between words
    timings.push({ start: currentTime, end: currentTime + wordDuration, word });
    currentTime += wordDuration;
  });

  return timings;
}

/**
 * Load and select the best voice for a language.
 */
function selectVoice(lang) {
  const synthInstance = getSynth();
  if (!synthInstance) return null;

  // Wait for voices if not loaded yet
  let voices = synthInstance.getVoices();
  if (!voices || voices.length === 0) {
    voices = synthInstance.getVoices() || [];
  }

  const langPrefix = lang.split('-')[0];

  // Priority: localService voices (offline-capable) first, then by quality keywords
  const preferred = voices
    .filter((v) => v.lang.startsWith(langPrefix))
    .sort((a, b) => {
      const aLocal = a.localService ? 1 : 0;
      const bLocal = b.localService ? 1 : 0;
      if (aLocal !== bLocal) return bLocal - aLocal;
      // Prefer Google/Microsoft/Apple branded voices
      const aQuality = (a.name.includes('Google') ? 3 : 0) + (a.name.includes('Microsoft') ? 2 : 0);
      const bQuality = (b.name.includes('Google') ? 3 : 0) + (b.name.includes('Microsoft') ? 2 : 0);
      return bQuality - aQuality;
    });

  return preferred[0] || null;
}

/**
 * Start speaking a verse text.
 * @param {string} text — full verse text to speak
 * @param {string} lang — language code 'ro' or 'es'
 * @param {object} callbacks
 */
export function speak(text, lang, callbacks = {}) {
  stop();

  _currentText = text;
  _lang = SPEECH_LANG_MAP[lang] || lang || 'ro-RO';
  _onWord = callbacks.onWord || null;
  _onEnd = callbacks.onEnd || null;
  _onStart = callbacks.onStart || null;
  _onPause = callbacks.onPause || null;
  _onResume = callbacks.onResume || null;

  const synthInstance = getSynth();
  if (!synthInstance) {
    console.warn('[tts] SpeechSynthesis not available');
    return;
  }

  words = splitWords(text);
  wordTimings = buildTimings(text, _rate, _lang);
  wordIndex = -1;
  pausedAt = 0;
  _calibrationFactor = 1.0;

  utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = _lang;
  utterance.rate = _rate;
  utterance.volume = _volume;

  _voice = selectVoice(_lang);
  if (_voice) {
    utterance.voice = _voice;
  }

  utterance.onstart = () => {
    startTime = performance.now() / 1000;
    startTick();
    if (_onStart) _onStart();
  };

  utterance.onend = () => {
    stopTick();
    wordIndex = words.length - 1;
    if (_onWord) _onWord(words.length - 1, words.length - 1);
    if (_onEnd) _onEnd();
  };

  utterance.onerror = (e) => {
    stopTick();
    console.warn('[tts] error:', e.error, e);
  };

  // Chrome/Safari: onboundary fires at word boundaries
  utterance.onboundary = (event) => {
    if (event.name === 'word' && wordTimings.length > 0) {
      // Use actual browser timing for calibration
      const elapsed = performance.now() / 1000 - startTime;
      const charIndex = event.charIndex;
      // Find which word this charIndex belongs to
      let charCount = 0;
      for (let i = 0; i < words.length; i++) {
        const wlen = words[i].length + (i < words.length - 1 ? 1 : 0);
        if (charCount + wlen > charIndex) {
          // Recalibrate: this word's actual start time vs estimated
          const estimated = wordTimings[i]?.start || 0;
          if (i === 0 && estimated > 0) {
            _calibrationFactor = Math.min(2, Math.max(0.3, elapsed / estimated));
            // Rebuild remaining timings with new factor
            wordTimings = buildTimings(text, _rate, _lang);
          }
          // Update word index based on actual timing
          wordIndex = i;
          if (_onWord) _onWord(i, words.length);
          return;
        }
        charCount += wlen;
      }
    }
  };

  synthInstance.speak(utterance);
}

/**
 * Internal tick: update word index based on estimated time.
 */
function startTick() {
  stopTick();
  _tickInterval = setInterval(() => {
    if (!startTime || !wordTimings.length) return;

    const elapsed = performance.now() / 1000 - startTime;
    let newIndex = -1;

    for (let i = 0; i < wordTimings.length; i++) {
      if (elapsed >= wordTimings[i].start) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex !== wordIndex) {
      wordIndex = newIndex;
      if (_onWord) _onWord(newIndex, words.length);
    }
  }, 50); // 50ms resolution
}

function stopTick() {
  if (_tickInterval !== null) {
    clearInterval(_tickInterval);
    _tickInterval = null;
  }
}

/**
 * Pause current speech.
 */
export function pause() {
  const synthInstance = getSynth();
  if (!synthInstance) return;

  synthInstance.pause();
  stopTick();
  pausedAt = performance.now() / 1000 - startTime;
  if (_onPause) _onPause();
}

/**
 * Resume paused speech.
 */
export function resume() {
  const synthInstance = getSynth();
  if (!synthInstance) return;

  // Adjust startTime to account for pause duration
  startTime = performance.now() / 1000 - pausedAt;
  synthInstance.resume();
  startTick();
  if (_onResume) _onResume();
}

/**
 * Stop speech completely.
 */
export function stop() {
  const synthInstance = getSynth();
  if (!synthInstance) return;

  stopTick();
  synthInstance.cancel();
  wordIndex = -1;
  words = [];
  wordTimings = [];
  utterance = null;
  pausedAt = 0;
  startTime = 0;
  _currentText = '';
}

/**
 * Check if currently speaking.
 */
export function isSpeaking() {
  const synthInstance = getSynth();
  return synthInstance ? synthInstance.speaking : false;
}

/**
 * Check if paused.
 */
export function isPaused() {
  const synthInstance = getSynth();
  return synthInstance ? synthInstance.paused : false;
}

/**
 * Set speech rate.
 * @param {number} rate — 0.5 to 2.0
 */
export function setRate(rate) {
  _rate = Math.max(0.5, Math.min(2.0, rate));
  if (utterance) {
    utterance.rate = _rate;
    // Rebuild timings with new rate
    if (_currentText) {
      wordTimings = buildTimings(_currentText, _rate, _lang);
    }
  }
}

/**
 * Get current rate.
 */
export function getRate() {
  return _rate;
}

/**
 * Set volume (0–1). Routes through musicService for mixed playback.
 */
export function setVolume(vol) {
  _volume = Math.max(0, Math.min(1, vol));
  if (utterance) {
    utterance.volume = _volume;
  }
  musicService.setVolume(vol * 0.15); // background music at 15% of TTS volume
}

/**
 * Get available voices for a language.
 */
export function getVoices(lang) {
  const synthInstance = getSynth();
  if (!synthInstance) return [];

  const langPrefix = lang.split('-')[0];
  return synthInstance.getVoices().filter((v) => v.lang.startsWith(langPrefix));
}

/**
 * Get current word index.
 */
export function getCurrentWordIndex() {
  return wordIndex;
}

/**
 * Get total word count.
 */
export function getWordCount() {
  return words.length;
}

/**
 * Check if TTS is available.
 */
export function isAvailable() {
  return !!(window.speechSynthesis);
}

export const ttsService = {
  speak,
  pause,
  resume,
  stop,
  isSpeaking,
  isPaused,
  setRate,
  getRate,
  setVolume,
  getVoices,
  getCurrentWordIndex,
  getWordCount,
  isAvailable,
};
