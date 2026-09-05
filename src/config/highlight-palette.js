// Paleta de subrayado de versículos.
//
// Ojo: esto NO son tokens del sistema de diseño, son *datos*. El usuario elige
// uno y el hex viaja al backend (columna `highlights.color`), igual que pasa
// con el color de un tema del índice. Por eso viven aquí como literales y no
// en public/global.css.
//
// Qué colores hay y cuáles faltan: toda la franja verde-turquesa está
// deliberadamente fuera. En esta app el verde significa "versículo en lectura"
// (--color-success) y es lo único que lo usa; el subrayado se pinta como un
// lavado del fondo al 26 %, y a esa intensidad un turquesa y el verde de
// lectura se distinguen mal. Ver CLAUDE.md, trampa 13.
//
// Son cinco y no seis por una razón concreta: descontada la franja prohibida
// queda un arco de unos 210°, y repartir seis colores ahí dejaba el amarillo y
// el naranja a 16° — como lavado al 26 % daban el mismo color y el usuario no
// podía separar sus propias categorías. Con cinco quedan a más de 45° cada uno.
// El test tests/highlights.test.js vigila las dos condiciones.
//
// `key` es lo que se usa en las claves de i18n (app.highlights.colors.<key>).

export const HIGHLIGHT_COLORS = [
  { key: 'yellow', hex: '#F2CC36' },
  { key: 'red', hex: '#E25450' },
  { key: 'pink', hex: '#D864C5' },
  { key: 'purple', hex: '#977BE0' },
  { key: 'blue', hex: '#3C9ADD' },
];

export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0].hex;

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Normaliza un color de subrayado a hex en mayúsculas.
 * Devuelve null si no es un hex de 6 dígitos: el backend rechaza cualquier
 * otra cosa (validators.color), así que más vale no llegar a mandarlo.
 */
export const normalizeHighlightColor = (color) => {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  return HEX.test(trimmed) ? trimmed.toUpperCase() : null;
};

/** Clave i18n del color, o null si es un hex fuera de la paleta. */
export const highlightColorKey = (hex) => {
  const normalized = normalizeHighlightColor(hex);
  if (!normalized) return null;
  const found = HIGHLIGHT_COLORS.find((c) => c.hex.toUpperCase() === normalized);
  return found ? found.key : null;
};
