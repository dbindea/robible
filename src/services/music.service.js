/**
 * Music service — procedural ambient drone + optional ambient tracks.
 * Uses Web Audio API for real-time mixing with independent volume control.
 * No external dependencies, works offline once audio context is created.
 */

let audioContext = null;
let masterGain = null;
let musicGain = null;
let droneOscillators = [];
let droneGainNodes = [];
let reverbNode = null;
let currentTrack = null; // 'none' | 'procedural' | 'hymn'
let _initialized = false;

const PROCEDURAL_ROOT_FREQ = 130.81; // C3 — deep, calming

/**
 * Common "drone" frequencies for biblical/spiritual ambience.
 * Major chord with octave and fifth for a peaceful, open feel.
 */
const DRONE_FREQUENCIES = [
  PROCEDURAL_ROOT_FREQ, // root C3
  PROCEDURAL_ROOT_FREQ * 1.5, // perfect fifth G3
  PROCEDURAL_ROOT_FREQ * 2, // octave C4
  PROCEDURAL_ROOT_FREQ * 2.5, // major third E4
  PROCEDURAL_ROOT_FREQ * 3, // perfect fifth G4
];

const DRONE_VOLUMES = [0.12, 0.06, 0.04, 0.03, 0.02];

async function initContext() {
  if (_initialized) return;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioContext.createGain();
    masterGain.gain.value = 1.0;

    musicGain = audioContext.createGain();
    musicGain.gain.value = 0; // starts silent

    // Simple convolver reverb simulation via delay network
    reverbNode = audioContext.createConvolver();
    reverbNode.buffer = await buildReverbImpulse(audioContext, 3.5, 0.7);

    const dryGain = audioContext.createGain();
    dryGain.gain.value = 0.55;
    const wetGain = audioContext.createGain();
    wetGain.gain.value = 0.45;

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

/**
 * Build a synthetic reverb impulse response (exponential decay noise).
 */
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

/**
 * Start the procedural drone: layered sine oscillators.
 */
function startProceduralDrone() {
  if (!_initialized || droneOscillators.length > 0) return;

  const now = audioContext.currentTime;

  DRONE_FREQUENCIES.forEach((freq, i) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = i === 0 ? 'sine' : 'sine';
    osc.frequency.value = freq;

    // Slow vibrato on root note for warmth
    if (i === 0) {
      const lfo = audioContext.createOscillator();
      const lfoGain = audioContext.createGain();
      lfo.frequency.value = 0.15; // very slow
      lfoGain.gain.value = 0.3; // subtle depth
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      droneOscillators.push(lfo);
    }

    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(DRONE_VOLUMES[i], now + 2.5); // 2.5s fade in

    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(now);

    droneOscillators.push(osc);
    droneGainNodes.push(gain);
  });
}

/**
 * Stop the procedural drone.
 */
function stopProceduralDrone() {
  if (!_initialized || droneOscillators.length === 0) return;

  const now = audioContext.currentTime;

  droneGainNodes.forEach((gain) => {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 1.5);
  });

  const oscs = [...droneOscillators];
  droneOscillators = [];
  droneGainNodes = [];

  setTimeout(() => {
    oscs.forEach((osc) => {
      try { osc.stop(); } catch (_) {}
    });
  }, 1600);
}

/**
 * Resume audio context if suspended (browser autoplay policy).
 */
async function resumeContext() {
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

/**
 * Set music volume (0–1).
 */
function setVolume(vol) {
  if (musicGain) {
    musicGain.gain.value = Math.max(0, Math.min(1, vol));
  }
}

/**
 * Start playing a specific music type.
 * @param {'none'|'procedural'|'hymn'} track
 */
export async function play(track) {
  await initContext();
  await resumeContext();

  if (currentTrack === track) return;

  stop();
  currentTrack = track;

  if (track === 'procedural') {
    startProceduralDrone();
  }
  // hymn track: future — load audio file
}

/**
 * Stop all music.
 */
export function stop() {
  if (!_initialized) return;

  if (currentTrack === 'procedural') {
    stopProceduralDrone();
  }

  currentTrack = 'none';
}

/**
 * Set master volume (affects TTS too if routed through same context).
 * @param {number} vol 0–1
 */
export function setMasterVolume(vol) {
  if (masterGain) {
    masterGain.gain.value = Math.max(0, Math.min(1, vol));
  }
}

/**
 * Get current playing state.
 */
export function getCurrentTrack() {
  return currentTrack || 'none';
}

/**
 * Check if Web Audio is available.
 */
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
