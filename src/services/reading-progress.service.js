// Por dónde iba leyendo.
//
// Sólo localStorage, sin backend y sin `withFallback`: es una comodidad del
// dispositivo, no un dato del usuario. Sincronizarlo entre el móvil y el
// portátil sería incluso peor — quien lee en el sofá y estudia en el escritorio
// tiene dos hilos distintos, y hacerlos uno le pisaría uno de los dos.
//
// Se guarda la referencia, no el texto: la Biblia ya está en el dispositivo y
// duplicar el versículo aquí sólo serviría para que se quedara viejo al cambiar
// de versión.

const CLAVE = 'robible:reading:last';

/** Guarda dónde se estaba leyendo. Silencioso: nunca debe romper la lectura. */
export const saveLastRead = ({ version, book, chapter } = {}) => {
  if (typeof window === 'undefined') return;
  if (!Number.isInteger(book) || !Number.isInteger(chapter)) return;
  try {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ version: version || null, book, chapter, at: new Date().toISOString() }),
    );
  } catch {
    // Sin localStorage (modo privado, cuota llena) se sigue leyendo igual.
  }
};

/** Lo último leído, o `null` si no hay nada guardado o está corrupto. */
export const getLastRead = () => {
  if (typeof window === 'undefined') return null;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const d = JSON.parse(crudo);
    if (!Number.isInteger(d?.book) || !Number.isInteger(d?.chapter)) return null;
    return d;
  } catch {
    return null;
  }
};

export const clearLastRead = () => {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(CLAVE); } catch { /* da igual */ }
};
