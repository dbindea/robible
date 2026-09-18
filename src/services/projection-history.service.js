// Historial de versículos proyectados.
//
// Por qué existe: en mitad del culto el predicador vuelve a un versículo que ya
// se puso —«como veíamos antes en Romani 5:5»— y encontrarlo otra vez cuesta lo
// mismo que la primera vez, pero ahora con prisa y con la congregación mirando.
// Aquí queda la lista de lo que se ha ido proyectando, a un clic.
//
// Sólo localStorage y sin backend, por lo mismo que las preferencias: describe
// **el equipo que proyecta**, no a la persona (ver `projection.service.js`).
// Sincronizarlo con el móvil del pastor no serviría para nada y metería en el
// portátil de la iglesia lo que otro haya proyectado en otro sitio.
//
// **Se apunta lo que el operador ELIGE, no cada versículo que cruza la
// pantalla.** Avanzando por un capítulo se proyectan cuarenta y ninguno de
// ellos es una referencia que nadie vaya a buscar de nuevo: lo que se busca es
// justamente aquello a lo que se saltó a propósito.

const CLAVE = 'robible:projection:history';

/** Cuántas se guardan. Un culto largo no llega a veinte o treinta saltos. */
export const MAX_HISTORIAL = 60;

/**
 * Cuánto texto se guarda de cada una. Lo justo para reconocerla en la lista:
 * la lee el operador de reojo, no la congregación.
 */
export const MAX_TEXTO = 180;

const esEntero = (n) => Number.isInteger(n);

/** Dos entradas son la misma si apuntan al mismo versículo. */
export const mismaReferencia = (a, b) =>
  !!a && !!b && a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;

/**
 * Devuelve la lista NUEVA con la entrada al principio, sin repetirla.
 *
 * Pura a propósito: así se puede probar sin doblar `localStorage`, y el
 * componente se limita a guardar lo que devuelve. Volver a un versículo que ya
 * estaba **lo sube al principio** en vez de duplicarlo — si el predicador
 * vuelve dos veces al mismo sitio, la segunda es la que importa.
 */
export const anadirEntrada = (lista, entrada) => {
  const previa = Array.isArray(lista) ? lista : [];
  if (!entrada || !esEntero(entrada.book) || !esEntero(entrada.chapter) || !esEntero(entrada.verse)) {
    return previa;
  }
  const limpia = {
    book: entrada.book,
    chapter: entrada.chapter,
    verse: entrada.verse,
    referencia: String(entrada.referencia || '').trim(),
    texto: String(entrada.texto || '')
      .trim()
      .slice(0, MAX_TEXTO),
    version: String(entrada.version || ''),
    ts: Number.isFinite(entrada.ts) ? entrada.ts : Date.now(),
  };
  return [limpia, ...previa.filter((e) => !mismaReferencia(e, limpia))].slice(0, MAX_HISTORIAL);
};

/**
 * Se queda con lo que tenga forma de entrada y tira el resto.
 *
 * Lo guardado puede venir de una versión anterior o estar a medio escribir: una
 * entrada sin `book` reventaría al pintar la lista, y eso pasaría al abrir la
 * proyección, que es el peor momento posible.
 */
export const normalizarHistorial = (crudo) => {
  if (!Array.isArray(crudo)) return [];
  return crudo
    .filter((e) => e && esEntero(e.book) && esEntero(e.chapter) && esEntero(e.verse))
    .slice(0, MAX_HISTORIAL)
    .map((e) => ({
      book: e.book,
      chapter: e.chapter,
      verse: e.verse,
      referencia: String(e.referencia || '').trim(),
      texto: String(e.texto || '')
        .trim()
        .slice(0, MAX_TEXTO),
      version: String(e.version || ''),
      ts: Number.isFinite(e.ts) ? e.ts : 0,
    }));
};

// ── Persistencia ────────────────────────────────────────────────────────────
// Todo silencioso: sin localStorage (modo privado, cuota llena) se proyecta
// igual, sólo que sin historial. Una excepción a mitad de culto, no.

export const cargarHistorial = () => {
  if (typeof window === 'undefined') return [];
  try {
    return normalizarHistorial(JSON.parse(localStorage.getItem(CLAVE) || '[]'));
  } catch {
    return [];
  }
};

export const guardarHistorial = (lista) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(normalizarHistorial(lista)));
  } catch {
    /* sin sitio: se proyecta igual */
  }
};

export const limpiarHistorial = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* da igual: la lista en memoria ya se ha vaciado */
  }
};
