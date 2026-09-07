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

/**
 * Devuelve una clave que `Icon.svelte` sepa dibujar.
 *
 * Un tema guardado con una clave que ya no existe —o con el emoji '📌' que fue
 * el valor por defecto de la columna— cae en el marcador en lugar de dejar un
 * hueco: en una lista de temas, un icono ausente parece un fallo de carga.
 */
export const resolveTopicIcon = (clave) =>
  TOPIC_ICONS.some((i) => i.key === clave) ? clave : DEFAULT_TOPIC_ICON;
