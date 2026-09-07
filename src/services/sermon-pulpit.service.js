// Modo Amvon: lo que hace falta para predicar sin conexión.
//
// La regla de este archivo es una sola: **durante la predicación no se toca la
// red**. Ni una petición, ni un reintento, ni un mensaje de "sin conexión". Todo
// lo que el Modo Amvon necesita se deja escrito en el dispositivo antes, al
// marcar la predicación como preparada.
//
// Por eso la instantánea guarda el TEXTO de las referencias y no sólo sus
// coordenadas: resolverlas contra la Biblia en memoria funcionaría casi
// siempre, pero "casi siempre" no vale en un púlpito. Si la Biblia no llegó a
// cargarse, el predicador se quedaría mirando un versículo vacío delante de la
// congregación.

const SNAPSHOT_PREFIX = 'robible:pulpit:v1';
const POSITION_PREFIX = 'robible:pulpit:pos:v1';
const FONT_KEY = 'robible:pulpit:fontSize';
const TIMER_KEY = 'robible:pulpit:minutes';
const ACTIVE_KEY = 'robible:pulpit:active';

const snapshotKey = (sermonId) => `${SNAPSHOT_PREFIX}:${sermonId}`;
const positionKey = (sermonId) => `${POSITION_PREFIX}:${sermonId}`;

const leer = (clave, porDefecto = null) => {
  if (typeof window === 'undefined') return porDefecto;
  try {
    const raw = localStorage.getItem(clave);
    return raw ? JSON.parse(raw) : porDefecto;
  } catch { return porDefecto; }
};

const escribir = (clave, valor) => {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (e) {
    // Cuota llena justo antes de predicar es el peor momento posible, así que
    // el fallo se propaga en vez de tragarse: quien llama debe poder avisar.
    console.error('[amvon] No se pudo guardar en el dispositivo:', e.message);
    return false;
  }
};

// ── Tamaño de letra ─────────────────────────────────────
// Tres tamaños y no un deslizador: en el púlpito no se afina, se elige.
export const FONT_SIZES = ['normal', 'large', 'xlarge'];

export const getFontSize = () => {
  if (typeof window === 'undefined') return 'large';
  const guardado = localStorage.getItem(FONT_KEY);
  // Por defecto 'large': el tamaño de lectura normal no se ve desde el atril.
  return FONT_SIZES.includes(guardado) ? guardado : 'large';
};

export const setFontSize = (valor) => {
  if (typeof window === 'undefined' || !FONT_SIZES.includes(valor)) return;
  try { localStorage.setItem(FONT_KEY, valor); } catch { /* cuota */ }
};

// ── Duración prevista ───────────────────────────────────
export const getPlannedMinutes = () => {
  if (typeof window === 'undefined') return 0;
  const n = Number(localStorage.getItem(TIMER_KEY));
  return Number.isFinite(n) && n > 0 && n <= 180 ? n : 0; // 0 = sin cronómetro
};

export const setPlannedMinutes = (minutos) => {
  if (typeof window === 'undefined') return;
  const n = Number(minutos);
  try { localStorage.setItem(TIMER_KEY, String(Number.isFinite(n) && n > 0 ? Math.min(n, 180) : 0)); }
  catch { /* cuota */ }
};

// ── Instantánea para el púlpito ─────────────────────────

/**
 * Deja en el dispositivo todo lo que el Modo Amvon va a necesitar.
 *
 * Se llama al marcar la predicación como preparada. No hay descarga manual: el
 * predicador pulsa un botón y ya está, que es lo que pide la especificación.
 *
 * `resolveVerse(book, chapter, verse)` la aporta el componente, que sí tiene la
 * Biblia cargada; así este servicio no depende de cómo se guarden los textos.
 */
export const buildSnapshot = ({ sermon, outline, pericope, references, resolveVerse }) => {
  const refsConTexto = (references || []).map((r) => ({
    ...r,
    // Si una referencia no se puede resolver ahora, se guarda igualmente con
    // texto vacío: en el púlpito se verá "no disponible" en lugar de intentar
    // ir a buscarla, que es lo que no puede pasar.
    text: r.text || resolveVerse?.(r.book, r.chapter, r.verse) || '',
  }));

  const snapshot = {
    version: 1,
    sermonId: sermon.id,
    title: sermon.title || '',
    reference: sermon.reference || '',
    outline,
    pericope: pericope || [],
    references: refsConTexto,
    preparedAt: new Date().toISOString(),
  };

  return escribir(snapshotKey(sermon.id), snapshot) ? snapshot : null;
};

export const getSnapshot = (sermonId) => leer(snapshotKey(sermonId));

export const hasSnapshot = (sermonId) => !!getSnapshot(sermonId);

export const clearSnapshot = (sermonId) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(snapshotKey(sermonId));
};

// ── Posición del scroll ─────────────────────────────────
//
// Se guarda en local y no en el servidor a propósito: es información de esta
// sesión y de este dispositivo, y recuperarla no puede depender de la red.

export const savePosition = (sermonId, scrollTop) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(positionKey(sermonId), JSON.stringify({ scrollTop, at: Date.now() }));
  } catch { /* cuota */ }
};

export const getPosition = (sermonId) => {
  const pos = leer(positionKey(sermonId));
  return pos && Number.isFinite(pos.scrollTop) ? pos.scrollTop : 0;
};

export const clearPosition = (sermonId) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(positionKey(sermonId));
};

// ── Recuperación tras una interrupción ──────────────────
//
// Si el sistema mata la pestaña mientras se predica, al reabrir la aplicación
// se vuelve al Modo Amvon en lugar de a la pantalla de inicio.
//
// La ventana es de seis horas: una predicación no dura más, y sin límite un
// Modo Amvon olvidado hace meses secuestraría el arranque de la aplicación.
const VENTANA_MS = 6 * 60 * 60 * 1000;

export const markActive = (sermonId) => {
  escribir(ACTIVE_KEY, { sermonId, at: Date.now() });
};

export const clearActive = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACTIVE_KEY);
};

/** Devuelve el id de la predicación que se estaba predicando, o null. */
export const getActive = () => {
  const activo = leer(ACTIVE_KEY);
  if (!activo?.sermonId) return null;
  if (!Number.isFinite(activo.at) || Date.now() - activo.at > VENTANA_MS) {
    clearActive();
    return null;
  }
  return activo.sermonId;
};

// ── Pantalla encendida ──────────────────────────────────

/**
 * Impide que la pantalla se apague mientras se predica.
 *
 * Si el navegador no lo permite —Safari en iOS tardó años, y en algunos
 * contextos sigue sin estar— **no se bloquea el modo ni se avisa dos veces**.
 * Un predicador con un aviso rojo en pantalla está peor que uno que toca el
 * móvil de vez en cuando.
 *
 * Devuelve una función para soltarlo.
 */
export const keepScreenAwake = () => {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
    return { supported: false, release: () => {} };
  }

  let sentinel = null;
  let vivo = true;

  const pedir = async () => {
    if (!vivo) return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
    } catch {
      // Falla al pedirlo (batería baja, permiso denegado). Se calla: reintentar
      // en bucle llenaría la consola sin arreglar nada.
    }
  };

  // El navegador suelta el bloqueo al ocultar la pestaña. Al volver hay que
  // pedirlo otra vez o la pantalla se apaga a mitad de la predicación.
  const alVolver = () => {
    if (document.visibilityState === 'visible') pedir();
  };

  pedir();
  document.addEventListener('visibilitychange', alVolver);

  return {
    supported: true,
    release: () => {
      vivo = false;
      document.removeEventListener('visibilitychange', alVolver);
      try { sentinel?.release(); } catch { /* ya soltado */ }
      sentinel = null;
    },
  };
};

// ── Cronómetro ──────────────────────────────────────────

/** `18:42` a partir de milisegundos. Sin horas: nadie predica tanto. */
export const formatElapsed = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${String(seg).padStart(2, '0')}`;
};
