// Versículo del día: elige una referencia por fecha y recuerda si ya se mostró.
//
// La elección es determinista a partir del calendario local, no aleatoria: dos
// dispositivos del mismo usuario ven el mismo versículo el mismo día, y el
// versículo no cambia si se recarga la página. La lista viene ya barajada de
// scripts/build-daily-verses.mjs (ver allí el porqué).

const DATA_URL = '/data/daily-verses.json';

const KEY_LAST_SHOWN = 'robible:dailyVerse:lastShown';
const KEY_ENABLED = 'robible:dailyVerse:enabled';

// ── Selección por fecha (pura, testeable) ───────────────

/** 'YYYY-MM-DD' en hora local. */
export const dateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Días transcurridos desde el epoch, contando por fecha local.
 * Se pasa por Date.UTC a propósito: usar el timestamp local directamente hace
 * que el número salte una unidad al cambiar el horario de verano.
 */
export const dayNumber = (date = new Date()) =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);

/** Referencia que toca para esa fecha, o null si la lista está vacía. */
export const pickVerseForDate = (verses, date = new Date()) => {
  if (!Array.isArray(verses) || !verses.length) return null;
  const index = ((dayNumber(date) % verses.length) + verses.length) % verses.length;
  return verses[index];
};

// ── Carga de la lista ───────────────────────────────────

let cache = null;

export const loadDailyVerses = async () => {
  if (cache) return cache;
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`daily-verses ${res.status}`);
    const data = await res.json();
    cache = Array.isArray(data?.verses) ? data.verses : [];
    return cache;
  } catch (e) {
    console.warn('No se pudo cargar el versículo del día:', e.message);
    return [];
  }
};

// ── Preferencia y "ya visto hoy" ────────────────────────

/** El usuario puede desactivarlo para siempre desde el propio diálogo. */
export const isEnabled = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY_ENABLED) !== 'false';
};

export const setEnabled = (enabled) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_ENABLED, enabled ? 'true' : 'false');
};

export const wasShownToday = (date = new Date()) => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(KEY_LAST_SHOWN) === dateKey(date);
};

export const markShownToday = (date = new Date()) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_LAST_SHOWN, dateKey(date));
};

/**
 * Devuelve la referencia a mostrar hoy, o null si no toca.
 * No marca nada: el componente decide cuándo darla por vista (al abrirla), para
 * que un fallo de render no queme el versículo del día.
 */
export const getVerseForToday = async (date = new Date()) => {
  if (!isEnabled() || wasShownToday(date)) return null;
  const verses = await loadDailyVerses();
  return pickVerseForDate(verses, date);
};
