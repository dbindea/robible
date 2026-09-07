// Catálogo de paletas.
//
// Los valores de color NO viven aquí: están en `public/global.css`, que es la
// única fuente de verdad del sistema de diseño. Este archivo sólo dice qué
// paletas existen, cómo se llaman y qué muestra el selector. Duplicar los
// colores en JavaScript garantizaría que un día dejaran de coincidir.
//
// `swatch` es la excepción deliberada: son las tres muestras que pinta el
// selector. Se leerían del CSS con `getComputedStyle`, pero eso obliga a montar
// las cinco paletas en el DOM para poder dibujar el propio selector.

export const PALETTES = [
  {
    id: 'lumina',
    labelKey: 'app.palette.lumina',
    scheme: 'light',
    // Color de la barra del sistema en móvil: el del chrome superior.
    themeColor: '#3f5867',
    swatch: { page: '#f2f5f8', surface: '#ffffff', accent: '#2d96cd', ink: '#3f5867' },
  },
  {
    id: 'noapte',
    labelKey: 'app.palette.noapte',
    scheme: 'dark',
    themeColor: '#0f1720',
    swatch: { page: '#0f1720', surface: '#17212b', accent: '#4db2e6', ink: '#d8e6ee' },
  },
  {
    id: 'sepia',
    labelKey: 'app.palette.sepia',
    scheme: 'light',
    themeColor: '#5b4636',
    swatch: { page: '#f4ecd8', surface: '#fbf6e9', accent: '#a8552b', ink: '#5b4636' },
  },
  {
    id: 'cald',
    labelKey: 'app.palette.cald',
    scheme: 'light',
    themeColor: '#4f463c',
    swatch: { page: '#f5f0e6', surface: '#faf6ee', accent: '#b8763e', ink: '#4f463c' },
  },
  {
    id: 'nocturn',
    labelKey: 'app.palette.nocturn',
    scheme: 'dark',
    themeColor: '#000000',
    swatch: { page: '#000000', surface: '#141414', accent: '#38bdf8', ink: '#e4e4e7' },
  },
];

export const DEFAULT_PALETTE = 'lumina';

export const isValidPalette = (id) => PALETTES.some((p) => p.id === id);

export const getPalette = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];

// Las dos paletas que responden a la preferencia del sistema. Las otras tres
// son una elección estética: nadie tiene "sepia" configurado en su sistema
// operativo, así que no hay nada que heredar.
export const SYSTEM_LIGHT = 'lumina';
export const SYSTEM_DARK = 'noapte';

/**
 * Traduce lo que hubiera guardado antes de que existieran las paletas.
 *
 * Durante años el valor almacenado fue `'light'` o `'dark'`. Sin esta
 * traducción, cada usuario que ya tenía RoBible instalado abriría la
 * aplicación con la paleta por defecto y perdería su preferencia sin entender
 * por qué. Devuelve `null` si no hay nada válido guardado, para que quien
 * llama pueda caer en la preferencia del sistema.
 */
export const migratePalette = (guardado) => {
  if (isValidPalette(guardado)) return guardado;
  if (guardado === 'light') return SYSTEM_LIGHT;
  if (guardado === 'dark') return SYSTEM_DARK;
  return null;
};
