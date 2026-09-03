/**
 * Music service — ambient pad sintetico tipo piano/organo.
 * Procedural: genera acordes suaves con multiples armonicos.
 * Random start position por reproduccion.
 *
 * NO usa archivos externos — todo generado con Web Audio API.
 */

// Acordes relajantes para capitulo de Biblia (mayor, menor, suspension 4)
const CHORD_PROGRESSIONS = [
  // I - V - vi - IV (pop clasico)
  [
    { root: 0, type: 'maj' },
    { root: 7, type: 'maj' },
    { root: 9, type: 'min' },
    { root: 5, type: 'maj' },
  ],
  // vi - IV - I - V (relajante)
  [
    { root: 9, type: 'min' },
    { root: 5, type: 'maj' },
    { root: 0, type: 'maj' },
    { root: 7, type: 'maj' },
  ],
  // I - vi - IV - V (50s progression)
  [
    { root: 0, type: 'maj' },
    { root: 9, type: 'min' },
    { root: 5, type: 'maj' },
    { root: 7, type: 'maj' },
  ],
  // I - iii - IV - iv (bossa style)
  [
    { root: 0, type: 'maj' },
    { root: 4, type: 'min' },
    { root: 5, type: 'maj' },
    { root: 5, type: 'min' },
  ],
  // I - V/V - V - I (clasicismo)
  [
    { root: 0, type: 'maj' },
    { root: 2, type: 'maj' },
    { root: 7, type: 'maj' },
    { root: 0, type: 'maj' },
  ],
];

// Tono base aleatorio por sesion (C, D, Eb, F, G, A — tonalidades calidas)
const BASE_KEYS = [0, 2, 3, 5, 7, 9]; // C, D, Eb, F, G, A
let currentBaseKey = BASE_KEYS[Math.floor(Math.random() * BASE_KEYS.length)];

// Octava base (frecuencias bajas, mas calidas)
const BASE_OCTAVE = 3;

// Intervalos para construir acordes
const CHORD_INTERVALS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
};

let audioContext = null;
let masterGain = null;
let musicGain = null;
let reverbNode = null;
let dryGain = null;
let wetGain = null;
let activeVoices = [];
let currentTrack = 'none';
let currentPosition = 0;
let currentProgression = null;
let progressionTimer = null;
let _initialized = false;
let desiredVolume = 0.5; // volumen pendiente, se aplica al inicializar

// Frecuencia de MIDI a Hz
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Construir un acorde a partir de root (en semitonos desde C0) y tipo
function buildChord(rootMidi, type) {
  const intervals = CHORD_INTERVALS[type] || CHORD_INTERVALS.maj;
  return intervals.map((iv) => rootMidi + iv);
}

// Selecciona una progresion aleatoria y un root aleatorio
function pickProgressionAndRoot() {
  const progression = CHORD_PROGRESSIONS[Math.floor(Math.random() * CHORD_PROGRESSIONS.length)];
  // Root aleatorio dentro de la tonalidad actual
  const rootMidi = 12 * (BASE_OCTAVE + 1) + currentBaseKey;
  return { progression, rootMidi };
}

/**
 * Crea un acorde con ADSR suave (tipo piano/organ)
 * rootMidi: MIDI base de la tonalidad actual (ej: 48 = C3)
 * rootOffset: desplazamiento en semitonos desde la base (ej: 0=I, 7=V)
 * type: tipo de acorde ('maj', 'min', 'maj7', etc.)
 * when: tiempo de inicio (audioContext.currentTime + delta)
 * duration: duracion en segundos
 */
function playChord(rootMidi, rootOffset, type, when, duration) {
  if (!audioContext) return;
  if (!Number.isFinite(rootMidi) || !Number.isFinite(when) || !Number.isFinite(duration) || duration <= 0) return;

  const notes = buildChord(rootMidi + rootOffset, type);
  const now = when;

  for (const note of notes) {
    const freq = midiToFreq(note);

    // Oscilador principal (triangle para calidez)
    const osc = audioContext.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    // Sub-oscilador (octava abajo, mas suave)
    const subOsc = audioContext.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = freq / 2;

    // Gain principal con ADSR
    const noteGain = audioContext.createGain();
    const peakGain = 0.06;
    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(peakGain, now + 0.3);
    noteGain.gain.linearRampToValueAtTime(peakGain * 0.7, now + 0.8);
    noteGain.gain.setValueAtTime(peakGain * 0.7, now + duration - 0.5);
    noteGain.gain.linearRampToValueAtTime(0, now + duration);

    // Sub-octava mas bajo
    const subGain = audioContext.createGain();
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(peakGain * 0.4, now + 0.5);
    subGain.gain.linearRampToValueAtTime(0, now + duration);

    // Conectar
    osc.connect(noteGain);
    subOsc.connect(subGain);
    noteGain.connect(musicGain);
    subGain.connect(musicGain);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + duration + 0.1);
    subOsc.stop(now + duration + 0.1);

    activeVoices.push({ osc, subOsc, noteGain, subGain });
  }
}

function clearActiveVoices() {
  for (const v of activeVoices) {
    try { v.osc.stop(); } catch (_) {}
    try { v.subOsc.stop(); } catch (_) {}
    try { v.noteGain.disconnect(); } catch (_) {}
    try { v.subGain.disconnect(); } catch (_) {}
  }
  activeVoices = [];
}

async function initContext() {
  if (_initialized) return;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioContext.createGain();
    masterGain.gain.value = 1.0;

    musicGain = audioContext.createGain();
    musicGain.gain.value = desiredVolume;

    // Reverb simple via convolver
    reverbNode = audioContext.createConvolver();
    reverbNode.buffer = await buildReverbImpulse(audioContext, 4.0, 0.5);

    dryGain = audioContext.createGain();
    dryGain.gain.value = 0.65;
    wetGain = audioContext.createGain();
    wetGain.gain.value = 0.35;

    masterGain.connect(dryGain);
    masterGain.connect(reverbNode);
    reverbNode.connect(wetGain);
    dryGain.connect(audioContext.destination);
    wetGain.connect(audioContext.destination);

    musicGain.connect(masterGain);
    _initialized = true;
  } catch (err) {
    console.warn('[music] Web Audio API not available:', err.message);
  }
}

async function buildReverbImpulse(ctx, durationSec, decay) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * durationSec;
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

async function resumeContext() {
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

/**
 * Reproduce una progresion de acordes en bucle.
 * Comienza desde un punto aleatorio dentro de la progresion.
 */
function startProgression() {
  if (!audioContext) return;

  clearActiveVoices();
  if (progressionTimer) clearTimeout(progressionTimer);

  // Seleccionar nueva progresion con root aleatorio
  const { progression, rootMidi } = pickProgressionAndRoot();
  currentProgression = progression;

  // Posicion aleatoria inicial
  currentPosition = Math.floor(Math.random() * progression.length);
  const CHORD_DURATION = 8;

  function playNext() {
    if (currentTrack !== 'procedural' || !audioContext) return;

    const chord = progression[currentPosition];
    if (!chord || !Number.isFinite(rootMidi)) return;
    const startTime = audioContext.currentTime + 0.05;
    playChord(rootMidi, chord.root, chord.type, startTime, CHORD_DURATION);

    currentPosition = (currentPosition + 1) % progression.length;

    progressionTimer = setTimeout(playNext, (CHORD_DURATION - 0.5) * 1000);
  }

  playNext();
}

export async function play(track) {
  await initContext();
  await resumeContext();

  if (currentTrack === track) return;

  stop();
  currentTrack = track;

  if (track === 'procedural') {
    startProgression();
  }
}

export function stop() {
  if (progressionTimer) clearTimeout(progressionTimer);
  progressionTimer = null;
  clearActiveVoices();
  currentTrack = 'none';
  currentProgression = null;
  currentPosition = 0;
}

export function setVolume(vol) {
  desiredVolume = Math.max(0, Math.min(1, vol));
  if (musicGain) {
    musicGain.gain.value = desiredVolume;
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
  stop,
  setVolume,
  setMasterVolume,
  getCurrentTrack,
  isAvailable,
};
