// Preferencias del Modo Proyección.
//
// Sólo localStorage, sin backend y a propósito: describen **el equipo que
// proyecta**, no a la persona. El portátil de la iglesia quiere su fondo, su
// tamaño de letra y su segundo idioma, y sincronizar eso con el móvil del
// pastor le cambiaría la pantalla a mitad de culto desde otro dispositivo. Es
// el mismo razonamiento que en `reading-progress.service.js`.
//
// Todo silencioso: si localStorage no está disponible (modo privado, cuota
// llena) se proyecta igual con los valores por defecto. Una preferencia que no
// se guarda es una molestia; una excepción a mitad del culto, no.

const CLAVE = 'robible:projection:prefs';

/**
 * Dónde estaba la ventana del proyector la última vez.
 *
 * Va en su propia clave y no dentro de las preferencias porque no es un gusto
 * del usuario: es una medida del equipo —las coordenadas del segundo monitor—
 * y se reescribe sola cada vez que se coloca la ventana.
 */
const CLAVE_PANTALLA = 'robible:projection:screen';

/** Cómo entra el versículo al cambiar. `none` es el que no distrae. */
export const ANIMACIONES = ['none', 'fade', 'slide', 'zoom'];

/**
 * Dónde va el segundo idioma respecto al principal. No es sólo estética: en una
 * pantalla 16:9 el texto apilado deja menos alto para cada uno, y en una
 * congregación mixta interesa que el idioma de la mayoría sea el grande.
 */
/**
 * Cuánto de la pantalla ocupa el texto, en por ciento.
 *
 * NO es un tamaño de letra: la lámina mide cada versículo y busca el cuerpo más
 * grande que quepa en ese porcentaje de la pantalla. Un multiplicador fijo no
 * servía, porque un versículo de seis palabras y otro de sesenta salían con la
 * misma letra y el corto se perdía en mitad de una pantalla vacía.
 *
 * El suelo es 30 y no 0: por debajo de eso no se lee desde la última fila, que
 * es la única razón de ser de este modo.
 *
 * El 70 salió de verlo proyectado: al 80 el texto llegaba casi al borde y
 * resultaba invasivo —una pantalla de iglesia se mira de lejos y necesita aire
 * alrededor—. Se sube con la rueda o escribiéndolo cuando el pasaje lo pide.
 */
export const OCUPACION_POR_DEFECTO = 70;
export const OCUPACION_MINIMA = 30;
export const OCUPACION_MAXIMA = 100;

export const POR_DEFECTO = {
  fondo: 'night', // de IMAGE_BACKGROUNDS
  animacion: 'fade',
  ocupacion: OCUPACION_POR_DEFECTO, // % de la pantalla que llena el texto
  segundoIdioma: false, // apagado: cargarlo baja otra Biblia de ~4 MB
  invertido: false, // true = el secundario pasa a ser el grande
};

const esFinito = (n) => typeof n === 'number' && Number.isFinite(n);

/** Acota la ocupación al rango utilizable. Se usa al leer y al cambiarla. */
export const acotarOcupacion = (n) =>
  esFinito(n) ? Math.min(Math.max(Math.round(n), OCUPACION_MINIMA), OCUPACION_MAXIMA) : OCUPACION_POR_DEFECTO;

/** Lee las preferencias guardadas, completadas con los valores por defecto. */
export const cargarPreferencias = () => {
  if (typeof window === 'undefined') return { ...POR_DEFECTO };
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return { ...POR_DEFECTO };
    const guardado = JSON.parse(crudo);
    return {
      ...POR_DEFECTO,
      ...guardado,
      // Se valida lo que puede llegar corrupto de una versión anterior: una
      // animación que ya no existe dejaría la pantalla sin transición, y una
      // escala absurda haría que el texto no quepa y nadie sabría por qué.
      animacion: ANIMACIONES.includes(guardado?.animacion) ? guardado.animacion : POR_DEFECTO.animacion,
      // Lo guardado antes del 18 sep 2026 era `escala`, un multiplicador entre
      // 0,5 y 2. No se convierte: son dos cosas distintas y un 2 traducido a
      // porcentaje no significa nada. Se cae al 80 % por defecto, que es lo que
      // querría cualquiera que abra esto la primera vez.
      ocupacion: acotarOcupacion(guardado?.ocupacion),
      segundoIdioma: !!guardado?.segundoIdioma,
      invertido: !!guardado?.invertido,
    };
  } catch {
    return { ...POR_DEFECTO };
  }
};

/** Guarda. Se llama en cada cambio: son cuatro campos, no hace falta debounce. */
export const guardarPreferencias = (prefs) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(prefs));
  } catch {
    // Sin localStorage se proyecta igual, sólo que sin recordar los ajustes.
  }
};

// ── Dónde está el proyector ─────────────────────────────────────────────────
//
// Colocar la ventana en el segundo monitor es lo único caro de todo esto: o lo
// hace la API de gestión de ventanas, o lo arrastra el operador delante de la
// congregación. Recordando las coordenadas, la segunda vez es gratis — y hay
// una segunda vez cada vez que se cede la pantalla a otro programa.

/** Las cuatro medidas tienen que ser números y el tamaño, positivo. */
export const esGeometria = (g) =>
  !!g &&
  Number.isFinite(g.left) &&
  Number.isFinite(g.top) &&
  Number.isFinite(g.width) &&
  Number.isFinite(g.height) &&
  g.width > 0 &&
  g.height > 0;

export const cargarGeometriaPantalla = () => {
  if (typeof window === 'undefined') return null;
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_PANTALLA) || 'null');
    return esGeometria(g) ? g : null;
  } catch {
    return null;
  }
};

export const guardarGeometriaPantalla = (g) => {
  if (typeof window === 'undefined' || !esGeometria(g)) return;
  try {
    localStorage.setItem(
      CLAVE_PANTALLA,
      JSON.stringify({ left: g.left, top: g.top, width: g.width, height: g.height }),
    );
  } catch {
    /* se vuelve a colocar a mano, como antes */
  }
};
