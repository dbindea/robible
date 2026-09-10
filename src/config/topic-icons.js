// Catálogo de iconos del índice temático.
//
// Estas catorce claves están **guardadas en la base de datos**: son los valores
// de la columna `icon` de la tabla `topics` en D1. Renombrar una deja sin icono
// a todos los temas que ya la usaban, y no hay forma de recuperarlo desde el
// cliente. Se pueden añadir claves; no quitarlas ni renombrarlas.
//
// Antes esta lista estaba copiada —con los SVG enteros dentro— en
// `IconPicker.svelte`, `Index.svelte` y `Result.svelte`. Las tres copias tenían
// que coincidir y nadie lo comprobaba.

export const TOPIC_ICONS = [
  { key: 'cross', labelKey: 'app.topics.icons.cross' },
  { key: 'heart', labelKey: 'app.topics.icons.heart' },
  { key: 'bookmark', labelKey: 'app.topics.icons.bookmark' },
  { key: 'sun', labelKey: 'app.topics.icons.sun' },
  { key: 'moon', labelKey: 'app.topics.icons.moon' },
  { key: 'shield', labelKey: 'app.topics.icons.shield' },
  { key: 'crown', labelKey: 'app.topics.icons.crown' },
  { key: 'dove', labelKey: 'app.topics.icons.dove' },
  { key: 'hands', labelKey: 'app.topics.icons.hands' },
  { key: 'flame', labelKey: 'app.topics.icons.flame' },
  { key: 'water', labelKey: 'app.topics.icons.water' },
  { key: 'home', labelKey: 'app.topics.icons.home' },
  { key: 'light', labelKey: 'app.topics.icons.light' },
  { key: 'peace', labelKey: 'app.topics.icons.peace' },
];

export const DEFAULT_TOPIC_ICON = 'bookmark';

// ── Iconos heredados ────────────────────────────────────────────────────────
//
// Antes de los trazos de Phosphor, la columna `icon` guardaba **emoji**: el
// valor por defecto del schema era '📌' y el selector de entonces ofrecía una
// lista de caracteres. Esos temas siguen en D1 con su emoji dentro, así que sin
// esta tabla caían todos en el marcador y el índice de un usuario antiguo se
// veía como una fila de iconos idénticos.
//
// La lista sale de mirar qué hay de verdad en producción —había '✝️', '🩹' y
// '🤲'— más el resto de emoji que tienen un equivalente evidente entre las
// catorce claves, por si algún usuario conserva alguno.
//
// Ojo con el selector de variación: '✝️' es U+271D seguido de U+FE0F, y '✝' a
// secas es sólo U+271D. Son cadenas distintas y hay que reconocer las dos, así
// que se normaliza quitando el U+FE0F antes de buscar.
const ICONOS_HEREDADOS = {
  '✝': 'cross',
  '❤': 'heart',
  '♥': 'heart',
  '🩹': 'heart',
  '🤲': 'hands',
  '🙌': 'hands',
  '🙏': 'hands',
  '📌': 'bookmark',
  '⭐': 'bookmark',
  '☀': 'sun',
  '🌙': 'moon',
  '🛡': 'shield',
  '👑': 'crown',
  '🕊': 'dove',
  '🔥': 'flame',
  '💧': 'water',
  '🏠': 'home',
  '💡': 'light',
  '☮': 'peace',
};

/** Sin el selector de variación, que no cambia el significado del emoji. */
const sinVariacion = (valor) => String(valor ?? '').replace(/️/g, '');

/**
 * Devuelve una clave que `Icon.svelte` sepa dibujar.
 *
 * Tres casos, en este orden: la clave ya es buena; es un emoji de la época
 * anterior y se traduce; o no se reconoce y cae en el marcador — porque en una
 * lista de temas un icono ausente parece un fallo de carga.
 *
 * La traducción se hace **al leer**, no migrando la base: así funciona también
 * para lo que quedó en la cache de `localStorage` de cada dispositivo, que no
 * se puede tocar desde el servidor. La fila de D1 se limpia sola en cuanto el
 * usuario edita el tema.
 */
export const resolveTopicIcon = (clave) => {
  if (TOPIC_ICONS.some((i) => i.key === clave)) return clave;
  return ICONOS_HEREDADOS[sinVariacion(clave)] || DEFAULT_TOPIC_ICON;
};
