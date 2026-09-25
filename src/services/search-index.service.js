/**
 * Índice de búsqueda: la Biblia normalizada UNA vez, no en cada tecla.
 *
 * El problema que resuelve: `getFilterResult` normalizaba los 31.102 versículos
 * —`normalize('NFD')` + regex + `toLowerCase()`— en **cada** llamada, y se llama
 * en cada pulsación del teclado. Medido en la VDC: 65 ms por búsqueda en un
 * portátil, que en un móvil de gama media son 200-400. El tecleo iba a tirones y
 * la causa no era el buscar, era el volver a normalizar lo que ya se había
 * normalizado un instante antes.
 *
 * Con el texto ya normalizado, la misma búsqueda baja a 3,7 ms (18×). El índice
 * completo cuesta 71 ms de construcción y ~4 MB, así que se construye **libro a
 * libro y sólo cuando hace falta**: quien busca dentro de Ioan no paga los otros
 * 65 libros, y nadie paga nada hasta la primera búsqueda.
 *
 * ── Por qué un WeakMap sobre el array de la Biblia ──────────────────
 * La clave es el propio array, no el código de versión. Al cambiar de versión,
 * `App.svelte` sustituye el array entero: el índice viejo se queda sin
 * referencias y el recolector se lo lleva solo. Con una clave de texto habría
 * que acordarse de invalidarlo a mano, y son 4 MB por versión — hay siete
 * (CLAUDE.md, trampa 5).
 *
 * ── Por qué las posiciones sirven para los dos textos ───────────────
 * Quitar los diacríticos **no cambia la longitud** de la cadena: se comprobó
 * sobre los 217.547 versículos de las siete versiones instaladas y no hay ni uno
 * que se descuadre (`tests/search-index.test.js` lo vigila). Por eso un índice
 * hallado en el texto normalizado se puede usar tal cual para cortar el texto
 * original, que es lo que necesita el resaltado de las palabras buscadas.
 */

// El bloque de marcas combinantes (U+0300–U+036F), que es lo que deja `NFD` al
// descomponer una letra acentuada. Se arma con `fromCharCode` a propósito:
// escrito en crudo dentro de unos corchetes, el fichero acaba con dos
// caracteres combinantes invisibles pegados al `[` y al `-`, y cualquiera que
// lo edite después los rompe sin verlos.
const MARCAS_COMBINANTES = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');

/** Quita los diacríticos sin tocar mayúsculas ni el resto. */
export const quitarDiacriticos = (texto) => String(texto).normalize('NFD').replace(MARCAS_COMBINANTES, '');

/** Forma en la que se compara todo: sin diacríticos y en minúsculas. */
export const normalizar = (texto) => quitarDiacriticos(texto).toLowerCase();

// Biblia (array) → índices por libro. Ver la cabecera: la clave es el array.
const indices = new WeakMap();

/**
 * El libro `libro` de `biblia`, aplanado y normalizado.
 *
 * Devuelve tres listas en paralelo —texto normalizado, capítulo y versículo, los
 * dos en base 0— porque recorrer una lista plana es bastante más rápido que
 * bajar por capítulos, y porque el llamante necesita saber de dónde salió cada
 * acierto. `Int16Array` basta de sobra: el capítulo más alto es el 150 de los
 * Salmos y el versículo más alto, el 176 del 119.
 *
 * @param {Array} biblia libros → capítulos → versículos
 * @param {number} libro índice de libro (0-65)
 * @returns {{textos: string[], capitulos: Int16Array, versiculos: Int16Array}|null}
 */
export function indiceDeLibro(biblia, libro) {
  if (!Array.isArray(biblia)) return null;
  const contenido = biblia[libro];
  if (!Array.isArray(contenido)) return null;

  let porLibro = indices.get(biblia);
  if (!porLibro) {
    porLibro = [];
    indices.set(biblia, porLibro);
  }
  const guardado = porLibro[libro];
  if (guardado) return guardado;

  const textos = [];
  const capitulos = [];
  const versiculos = [];
  for (let c = 0; c < contenido.length; c++) {
    const capitulo = contenido[c];
    if (!Array.isArray(capitulo)) continue;
    for (let v = 0; v < capitulo.length; v++) {
      textos.push(normalizar(capitulo[v]));
      capitulos.push(c);
      versiculos.push(v);
    }
  }

  const indice = {
    textos,
    capitulos: Int16Array.from(capitulos),
    versiculos: Int16Array.from(versiculos),
  };
  porLibro[libro] = indice;
  return indice;
}

/** ¿Está ya construido el índice de ese libro? Sólo para los tests. */
export function estaIndexado(biblia, libro) {
  return Boolean(indices.get(biblia)?.[libro]);
}
