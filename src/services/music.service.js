/**
 * Music service — música ambiental de fondo para la lectura.
 *
 * Tres ambientes, cada uno con dos formas de sonar:
 *
 *   1. **Pista de audio**, si el fichero existe en `/assets/audio/`. Se reproduce
 *      con Web Audio (`AudioBufferSourceNode.loop = true`), que empalma el final
 *      con el principio a nivel de muestra; con un `<audio loop>` normal se oiría
 *      un hueco en cada vuelta.
 *   2. **Síntesis procedural**, si no hay fichero o falla al cargar.
 *
 * El fichero es OPCIONAL a propósito. Los tres ambientes suenan hoy sin ningún
 * MP3 en el repositorio: cero problemas de licencia, cero bytes añadidos a la
 * instalación y funcionan sin conexión desde el primer día. Cuando haya pistas
 * con licencia clara, basta con dejarlas en la ruta que indica cada ambiente y
 * pasan a usarse solas, sin tocar código. Ver `public/assets/audio/CREDITS.md`.
 *
 * Ojo: la síntesis no pretende imitar una grabación. Busca dar a cada ambiente
 * un carácter propio y reconocible, y sobre todo no competir con la lectura.
 */

// ── Ambientes ─────────────────────────────────────────────────────────────────
//
// `url`          ruta de la pista, si algún día existe. Si no está, se sintetiza.
// `octave`       registro base: más bajo = más envolvente y menos presente.
// `chordSeconds` cuánto dura cada acorde. Largo = ambiente; corto = canción.
// `peak`         volumen de cada voz. El conjunto se regula aparte con setVolume.
// `drone`        nota tenida bajo la progresión, para dar cuerpo.
// `progression`  grados sobre la tónica, con el tipo de acorde.
export const AMBIENCES = [
  {
    key: 'ebraica',
    url: '/assets/audio/ebraica.mp3',
    octave: 3,
    chordSeconds: 10,
    peak: 0.045,
    drone: true,
    waveform: 'triangle',
    // Frigia dominante, el modo *Ahava Raba* de la liturgia judía:
    // 1 - b2 - 3 - 4 - 5 - b6 - b7. Lo que da ese color tan reconocible es la
    // segunda aumentada entre la b2 y la 3ª mayor, y el movimiento I → bII → I.
    progression: [
      { root: 0, type: 'maj' },
      { root: 1, type: 'maj' },
      { root: 0, type: 'maj' },
      { root: 5, type: 'min' },
    ],
  },
  {
    key: 'rugaciune',
    url: '/assets/audio/rugaciune.mp3',
    // Dos octavas por debajo del ambiente neutro: es lo que pide "más grave,
    // más envolvente, menos aguda". Acordes muy largos y casi sin melodía, para
    // que se pueda orar o escuchar la Biblia sin que la música tire de la atención.
    octave: 2,
    chordSeconds: 14,
    peak: 0.05,
    drone: true,
    waveform: 'sine',
    progression: [
      { root: 0, type: 'min7' },
      { root: 0, type: 'sus4' },
      { root: 8, type: 'maj7' },
      { root: 5, type: 'min7' },
    ],
  },
  {
    key: 'liniste',
    url: '/assets/audio/liniste.mp3',
    // El más discreto de los tres: pads suaves, sin dramatismo, pensado para
    // dejarlo puesto de fondo mientras se lee.
    octave: 4,
    chordSeconds: 8,
    peak: 0.035,
    drone: false,
    waveform: 'sine',
    progression: [
      { root: 0, type: 'maj7' },
      { root: 5, type: 'maj7' },
      { root: 9, type: 'min7' },
      { root: 7, type: 'sus4' },
    ],
  },
];

export const getAmbience = (key) => AMBIENCES.find((a) => a.key === key) || null;

/**
 * Traduce el valor guardado en localStorage al catálogo actual.
 *
 * Antes sólo había dos opciones: 'prayer' (el MP3) y 'none'. El comentario del
 * store hablaba además de 'procedural', que el player nunca llegó a usar. Quien
 * tenga cualquiera de esas dos cae en 'rugaciune', que es lo más parecido a lo
 * que venía escuchando; así nadie se encuentra la música apagada de repente.
 */
export const migrateAmbience = (value) => {
  if (value === 'none') return 'none';
  if (getAmbience(value)) return value;
  if (value === 'prayer' || value === 'procedural') return 'rugaciune';
  return 'none';
};

// Silencio al entrar y al salir, para que no "arranque" de golpe.
const FADE_IN_SEC = 1.5;
const FADE_OUT_SEC = 1.0;

const CHORD_INTERVALS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
};

const BASE_KEY = 0; // C

let audioContext = null;
let masterGain = null;
let musicGain = null;
let _initialized = false;
let desiredVolume = 0.5;

// Buffers por ambiente. Se cachean para que la segunda reproducción arranque al
// instante, y se recuerda cuáles no existen para no volver a pedirlos.
const trackBuffers = new Map();
const trackMissing = new Set();
const trackLoading = new Map();

let sourceNode = null;

// Estado de la síntesis
let activeVoices = [];
let progressionTimer = null;
let progressionIndex = 0;
let droneVoices = [];

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

// ── Carga de la pista ─────────────────────────────────────────────────────────
/**
 * Intenta descargar y decodificar la pista de un ambiente. Devuelve null si no
 * existe o no se puede decodificar, que es el caso normal mientras no haya
 * ficheros: entonces suena la síntesis.
 *
 * El fallo se recuerda en `trackMissing` para no repetir la petición en cada
 * play; sin eso, cada arranque pagaría un 404.
 */
async function loadTrack(ambience) {
  if (!ambience?.url) return null;
  if (trackBuffers.has(ambience.key)) return trackBuffers.get(ambience.key);
  if (trackMissing.has(ambience.key)) return null;
  if (trackLoading.has(ambience.key)) return trackLoading.get(ambience.key);

  const promesa = (async () => {
    try {
      const response = await fetch(ambience.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      trackBuffers.set(ambience.key, buffer);
      return buffer;
    } catch {
      // Silencio deliberado: no tener fichero es el estado normal, no un error.
      trackMissing.add(ambience.key);
      return null;
    } finally {
      trackLoading.delete(ambience.key);
    }
  })();

  trackLoading.set(ambience.key, promesa);
  return promesa;
}

/** Precarga sin reproducir, para que al pulsar play ya esté decodificada. */
export async function preload(key) {
  await initContext();
  if (!audioContext) return false;
  return !!(await loadTrack(getAmbience(key)));
}

// ── Síntesis ──────────────────────────────────────────────────────────────────
function playChord(rootMidi, rootOffset, type, when, duration, ambience) {
  if (!audioContext) return;

  const intervals = CHORD_INTERVALS[type] || CHORD_INTERVALS.maj;
  for (const interval of intervals) {
    const freq = midiToFreq(rootMidi + rootOffset + interval);

    const osc = audioContext.createOscillator();
    osc.type = ambience.waveform || 'sine';
    osc.frequency.value = freq;

    const gain = audioContext.createGain();
    const peak = ambience.peak;
    // Ataque y caída largos: lo que evita que se oiga como una canción.
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

/**
 * Nota tenida bajo la progresión. Da cuerpo y hace que los cambios de acorde no
 * se perciban como cortes. Se arranca una vez y dura hasta el stop.
 */
function startDrone(rootMidi, ambience) {
  if (!audioContext) return;
  for (const offset of [0, 12]) {
    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midiToFreq(rootMidi + offset);

    const gain = audioContext.createGain();
    const peak = ambience.peak * (offset === 0 ? 0.9 : 0.35);
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(peak, audioContext.currentTime + 3);

    osc.connect(gain);
    gain.connect(musicGain);
    osc.start();

    droneVoices.push({ osc, gain });
  }
}

function startProgression(ambience) {
  if (!audioContext) return;
  const rootMidi = 12 * (ambience.octave + 1) + BASE_KEY;

  if (ambience.drone && !droneVoices.length) startDrone(rootMidi, ambience);

  const playNext = () => {
    if (currentTrack === 'none' || !audioContext) return;
    const chord = ambience.progression[progressionIndex];
    playChord(rootMidi, chord.root, chord.type, audioContext.currentTime + 0.05, ambience.chordSeconds, ambience);
    progressionIndex = (progressionIndex + 1) % ambience.progression.length;
    progressionTimer = setTimeout(playNext, (ambience.chordSeconds - 1.5) * 1000);
  };

  playNext();
}

function clearSynthVoices() {
  for (const voice of [...activeVoices, ...droneVoices]) {
    try { voice.osc.stop(); } catch { /* ya parado */ }
    try { voice.gain.disconnect(); } catch { /* ya desconectado */ }
  }
  activeVoices = [];
  droneVoices = [];
  if (progressionTimer) {
    clearTimeout(progressionTimer);
    progressionTimer = null;
  }
}

// ── API pública ───────────────────────────────────────────────────────────────
/**
 * Arranca la música. `track` es la clave de un ambiente ('ebraica',
 * 'rugaciune', 'liniste') o 'none'.
 *
 * Debe llamarse desde un gesto del usuario (click): los navegadores bloquean
 * el audio automático.
 */
export async function play(track = 'liniste') {
  const key = migrateAmbience(track);
  if (key === 'none') return;

  const ambience = getAmbience(key);
  if (!ambience) return;

  await initContext();
  if (!audioContext) return;
  await resumeContext();

  if (currentTrack === key && (sourceNode || progressionTimer)) return;

  stop();
  currentTrack = key;

  const buffer = await loadTrack(ambience);

  // stop() pudo haberse llamado mientras se descargaba
  if (currentTrack !== key) return;

  if (buffer) {
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = true; // bucle infinito, sin hueco entre vueltas
    sourceNode.connect(musicGain);
    sourceNode.start(0);
  } else {
    startProgression(ambience);
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
  // La síntesis necesita que se reprograme el temporizador; la pista no, porque
  // el AudioBufferSourceNode sigue vivo dentro del contexto suspendido.
  if (currentTrack !== 'none' && !sourceNode && !progressionTimer) {
    const ambience = getAmbience(currentTrack);
    if (ambience) startProgression(ambience);
  }
}

export function stop() {
  clearSynthVoices();

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

/** true si ese ambiente está sonando desde un fichero y no sintetizado. */
export function isUsingTrackFile(key) {
  return trackBuffers.has(key);
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
  isUsingTrackFile,
  isAvailable,
};
