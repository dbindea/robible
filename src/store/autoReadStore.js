/**
 * Auto-read store — timer con auto-advance al siguiente capítulo.
 *
 * Persiste la velocidad en localStorage. El callback `onChapterAdvance`
 * se registra desde Result.svelte (onMount) para navegar al siguiente
 * capítulo cuando el timer llega a cero.
 */

import { writable, derived, get } from 'svelte/store';

// ── Constantes ─────────────────────────────────────────────
export const AUTO_READ_SPEEDS = [
  { label: '30s',    value: 30  },
  { label: '1 min',  value: 60  },
  { label: '1.5 min',value: 90  },
  { label: '2 min',  value: 120 },
  { label: '5 min',  value: 300 },
];

const STORAGE_KEY = 'robible:autoRead';

// ── Helpers de persistence ─────────────────────────────────
const getSavedSpeed = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const n = parseInt(saved, 10);
    if (AUTO_READ_SPEEDS.some((s) => s.value === n)) return n;
  } catch { /* ignore */ }
  return 60; // default: 1 minuto
};

// ── Estado ─────────────────────────────────────────────────
export const autoReadIsPlaying  = writable(false);
export const autoReadSpeed     = writable(getSavedSpeed());
export const autoReadTimeLeft  = writable(getSavedSpeed()); // segundos restantes

// Progreso 0→100
export const autoReadProgress = derived(
  [autoReadTimeLeft, autoReadSpeed],
  ([$timeLeft, $speed]) =>
    $speed > 0 ? Math.round(((($speed - $timeLeft) / $speed) * 100) * 10) / 10 : 0,
);

// ── Timer intern ───────────────────────────────────────────
let _intervalId = null;
let _onAdvance  = null;

const _clearTimer = () => {
  if (_intervalId !== null) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
};

const _tick = () => {
  const current = get(autoReadTimeLeft);
  const next = current - 1;
  if (next <= 0) {
    // Timer expirado
    _clearTimer();
    autoReadIsPlaying.set(false);
    autoReadTimeLeft.set(get(autoReadSpeed)); // resetea para la próxima vez
    if (typeof _onAdvance === 'function') {
      _onAdvance();
    }
  } else {
    autoReadTimeLeft.set(next);
  }
};

// ── Acciones públicas ─────────────────────────────────────

/** Registrar el callback que avanza al siguiente capítulo. */
export const registerAutoReadCallback = (fn) => {
  _onAdvance = fn;
};

/** Quitar el callback (cleanup). */
export const unregisterAutoReadCallback = () => {
  _onAdvance = null;
};

/** Iniciar / reanudar el timer. */
export const autoReadPlay = () => {
  if (_intervalId !== null) return; // ya corriendo
  autoReadIsPlaying.set(true);
  _intervalId = setInterval(_tick, 1000);
};

/** Pausar el timer. */
export const autoReadPause = () => {
  _clearTimer();
  autoReadIsPlaying.set(false);
};

/** Resetear el timer (sin parar). */
export const autoReadReset = () => {
  _clearTimer();
  autoReadTimeLeft.set(get(autoReadSpeed));
  if (get(autoReadIsPlaying)) {
    _intervalId = setInterval(_tick, 1000);
  }
};

/** Cambiar velocidad y reiniciar el timer. */
export const autoReadSetSpeed = (seconds) => {
  if (!AUTO_READ_SPEEDS.some((s) => s.value === seconds)) return;
  try {
    localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch { /* ignore */ }
  autoReadSpeed.set(seconds);
  autoReadTimeLeft.set(seconds);
  // Si estaba corriendo, reiniciar con la nueva velocidad
  if (_intervalId !== null) {
    _clearTimer();
    _intervalId = setInterval(_tick, 1000);
  }
};

/** Formatear segundos como "1:30". */
export const formatAutoReadTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Persistir la velocidad cuando cambia
autoReadSpeed.subscribe((val) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(val));
  } catch { /* ignore */ }
});
