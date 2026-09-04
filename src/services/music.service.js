/**
 * Music service — música ambiental de fondo para la lectura.
 *
 * Pista principal: un MP3 en bucle infinito (`/assets/audio/prayer-ambient.mp3`),
 * reproducido con Web Audio (`AudioBufferSourceNode.loop = true`), que empalma
 * el final con el principio de forma exacta a nivel de muestra. Con un
 * `<audio loop>` normal se oiría un pequeño hueco en cada vuelta.
 *
 * Fallback: si el MP3 no se puede cargar o decodificar (offline en la primera
 * visita, formato no soportado), cae a un pad sintético generado con
 * osciladores. Suena peor, pero evita quedarse sin música.
 *
 * Créditos y licencia de la pista: public/assets/audio/CREDITS.md
 */

// ── Pista de audio ────────────────────────────────────────────────────────────
export const PRAYER_TRACK_URL = '/assets/audio/prayer-ambient.mp3';

// Silencio al entrar y al salir, para que no "arranque" de golpe.
const FADE_IN_SEC = 1.5;
const FADE_OUT_SEC = 1.0;

// ── Fallback procedural ───────────────────────────────────────────────────────
// Acordes suaves y sostenidos. Solo se usa si el MP3 falla.
const FALLBACK_PROGRESSION = [
  { root: 0, type: 'maj7' },
  { root: 5, type: 'maj7' },
  { root: 9, type: 'min7' },
  { root: 7, type: 'sus4' },
];

const CHORD_INTERVALS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
};

const BASE_OCTAVE = 3;
const BASE_KEY = 0; // C
const CHORD_DURATION = 8; // acordes largos: ambiente, no canción

let audioContext = null;
let masterGain = null;
let musicGain = null;
let _initialized = false;
let desiredVolume = 0.5;

// Estado de la pista MP3
let trackBuffer = null; // AudioBuffer decodificado (se cachea entre plays)
let trackLoadPromise = null; // evita descargas simultáneas
let sourceNode = null; // AudioBufferSourceNode en curso

// Estado del fallback procedural
let activeVoices = [];
let progressionTimer = null;
let progressionIndex = 0;

let currentTrack = 'none';

const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// ── Contexto de audio ─────────────────────────────────────────────────────────
async function initContext() {
  if (_initialized) return;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioContext.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(audioContext.destination);

    musicGain = audioContext.createGain();
    musicGain.gain.value = 0; // se sube con el fade-in
    musicGain.connect(masterGain);

    _initialized = true;
  } catch (err) {
    console.warn('[music] Web Audio API no disponible:', err.message);
  }
}

async function resumeContext() {
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

// ── Carga del MP3 ─────────────────────────────────────────────────────────────
/**
 * Descarga y decodifica la pista. Cachea el AudioBuffer, así que a partir de la
 * segunda reproducción arranca al instante. Devuelve null si falla.
 */
async function loadTrack() {
  if (trackBuffer) return trackBuffer;
  if (trackLoadPromise) return trackLoadPromise;

  trackLoadPromise = (async () => {
    try {
      const response = await fetch(PRAYER_TRACK_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      trackBuffer = await audioContext.decodeAudioData(arrayBuffer);
      return trackBuffer;
    } catch (err) {
      console.warn('[music] No se pudo cargar la pista, usando fallback:', err.message);
      return null;
    } finally {
      trackLoadPromise = null;
    }
  })();

  return trackLoadPromise;
}

/**
 * Precarga la pista sin reproducirla. Útil para llamarla al abrir el panel,
 * de modo que al pulsar play ya esté decodificada.
 */
export async function preload() {
  await initContext();
  if (!audioContext) return false;
  return !!(await loadTrack());
}

// ── Fallback procedural ───────────────────────────────────────────────────────
function playChord(rootMidi, rootOffset, type, when, duration) {
  if (!audioContext) return;

  const intervals = CHORD_INTERVALS[type] || CHORD_INTERVALS.maj;
  for (const interval of intervals) {
    const freq = midiToFreq(rootMidi + rootOffset + interval);

    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = audioContext.createGain();
    const peak = 0.05;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + 1.5);
    gain.gain.setValueAtTime(peak, when + duration - 2);
    gain.gain.linearRampToValueAtTime(0, when + duration);

    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(when);
    osc.stop(when + duration + 0.1);

    activeVoices.push({ osc, gain });
  }
}

function startFallbackProgression() {
  if (!audioContext) return;
  const rootMidi = 12 * (BASE_OCTAVE + 1) + BASE_KEY;

  const playNext = () => {
    if (currentTrack === 'none' || !audioContext) return;
    const chord = FALLBACK_PROGRESSION[progressionIndex];
    playChord(rootMidi, chord.root, chord.type, audioContext.currentTime + 0.05, CHORD_DURATION);
    progressionIndex = (progressionIndex + 1) % FALLBACK_PROGRESSION.length;
    progressionTimer = setTimeout(playNext, (CHORD_DURATION - 1.5) * 1000);
  };

  playNext();
}

function clearFallbackVoices() {
  for (const voice of activeVoices) {
    try { voice.osc.stop(); } catch { /* ya parado */ }
    try { voice.gain.disconnect(); } catch { /* ya desconectado */ }
  }
  activeVoices = [];
  if (progressionTimer) {
    clearTimeout(progressionTimer);
    progressionTimer = null;
  }
}

// ── API pública ───────────────────────────────────────────────────────────────
/**
 * Arranca la música. `track` acepta:
 *   'prayer'     → MP3 en bucle (con fallback procedural si falla)
 *   'procedural' → fuerza el pad sintético
 *   'none'       → no hace nada
 *
 * Debe llamarse desde un gesto del usuario (click): los navegadores bloquean
 * el audio automático.
 */
export async function play(track = 'prayer') {
  if (track === 'none') return;

  await initContext();
  if (!audioContext) return;
  await resumeContext();

  if (currentTrack === track && (sourceNode || progressionTimer)) return;

  stop();
  currentTrack = track;

  const buffer = track === 'procedural' ? null : await loadTrack();

  // stop() pudo haberse llamado mientras se descargaba
  if (currentTrack !== track) return;

  if (buffer) {
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = true; // bucle infinito, sin hueco entre vueltas
    sourceNode.connect(musicGain);
    sourceNode.start(0);
  } else {
    startFallbackProgression();
  }

  // Fade-in
  const now = audioContext.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(0, now);
  musicGain.gain.linearRampToValueAtTime(desiredVolume, now + FADE_IN_SEC);
}

/**
 * Congela el audio. `suspend()` para el reloj del contexto, así que al reanudar
 * la pista sigue exactamente donde estaba.
 */
export function pause() {
  if (progressionTimer) {
    clearTimeout(progressionTimer);
    progressionTimer = null;
  }
  if (audioContext && audioContext.state === 'running') {
    audioContext.suspend();
  }
}

export async function resume() {
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  // El fallback necesita que se reprograme el temporizador; el MP3 no, porque
  // el AudioBufferSourceNode sigue vivo dentro del contexto suspendido.
  if (currentTrack !== 'none' && !sourceNode && !progressionTimer) {
    startFallbackProgression();
  }
}

export function stop() {
  clearFallbackVoices();

  if (sourceNode) {
    const node = sourceNode;
    sourceNode = null;
    // Fade-out corto y luego parar, para no cortar en seco.
    if (audioContext && musicGain) {
      const now = audioContext.currentTime;
      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(musicGain.gain.value, now);
      musicGain.gain.linearRampToValueAtTime(0, now + FADE_OUT_SEC);
      try { node.stop(now + FADE_OUT_SEC + 0.05); } catch { /* ya parado */ }
    } else {
      try { node.stop(); } catch { /* ya parado */ }
    }
  }

  currentTrack = 'none';
  progressionIndex = 0;
}

export function setVolume(vol) {
  desiredVolume = Math.max(0, Math.min(1, vol));
  if (musicGain && audioContext) {
    // Rampa corta para que el slider no produzca clicks.
    const now = audioContext.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(desiredVolume, now + 0.1);
  }
}

export function setMasterVolume(vol) {
  if (masterGain) {
    masterGain.gain.value = Math.max(0, Math.min(1, vol));
  }
}

export function getCurrentTrack() {
  return currentTrack || 'none';
}

export function isAvailable() {
  return !!(window.AudioContext || window.webkitAudioContext);
}

export const musicService = {
  play,
  pause,
  resume,
  stop,
  preload,
  setVolume,
  setMasterVolume,
  getCurrentTrack,
  isAvailable,
};
