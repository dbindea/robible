/**
 * Los versículos que SÍ se indexan uno a uno.
 *
 * Por qué existe esta lista: las 124.400 URLs de versículo (31.100 × 4
 * versiones) están cerradas en `robots.txt` desde el 14 sep 2026, porque
 * rastrearlas son ~600 GB y agotaron el ancho de banda del plan de Netlify en
 * quince días. Pero cerrarlas TODAS tira también la cola larga que sí vale:
 * quien busca «Ioan 3:16» quiere esa página, no el capítulo entero.
 *
 * La solución es una lista blanca corta. Lo que hay aquí se marca `index,
 * follow` en `verse-meta`, entra en `sitemaps/verses.xml` y recibe su `Allow`
 * en el `robots.txt` generado — las tres cosas salen de este mismo fichero, así
 * que no pueden desincronizarse.
 *
 * A esto se le suman los 283 del versículo del día (`public/data/daily-verses.json`),
 * que ya están elegidos por el mismo criterio. La unión la hace quien la
 * necesita: `combinarIndexables()`, aquí abajo.
 *
 * **El tamaño importa.** Cada referencia son cuatro líneas de `Allow` (una por
 * versión) en un fichero que Google se lee entero. Si esta lista se va a varios
 * miles, el `robots.txt` se hace impracticable y además se pierde el sentido:
 * una lista blanca de todo no es una lista blanca. `tests/golden-verses.test.js`
 * vigila el tope.
 *
 * Criterio para añadir: que alguien pueda teclear la referencia de memoria.
 * Predominan el Nuevo Testamento y los Salmos, que es donde está la búsqueda
 * real. No es una lista de los versículos «más importantes» —eso no lo decide
 * un fichero de configuración— sino de los más buscados.
 *
 * Los índices de libro son los del proyecto: 0 = Geneza … 65 = Apocalipsa.
 */

export const GOLDEN_VERSES = [
  // ── Antiguo Testamento ────────────────────────────────────────────────────
  { book: 0, chapter: 1, verse: 1 },      // Geneza 1:1
  { book: 0, chapter: 1, verse: 27 },     // Geneza 1:27
  { book: 1, chapter: 14, verse: 14 },    // Exod 14:14
  { book: 4, chapter: 6, verse: 5 },      // Deuteronom 6:5
  { book: 5, chapter: 1, verse: 9 },      // Iosua 1:9
  { book: 18, chapter: 1, verse: 1 },     // Psalmii 1:1
  { book: 18, chapter: 23, verse: 1 },    // Psalmii 23:1
  { book: 18, chapter: 23, verse: 4 },    // Psalmii 23:4
  { book: 18, chapter: 27, verse: 1 },    // Psalmii 27:1
  { book: 18, chapter: 34, verse: 8 },    // Psalmii 34:8
  { book: 18, chapter: 37, verse: 4 },    // Psalmii 37:4
  { book: 18, chapter: 46, verse: 1 },    // Psalmii 46:1
  { book: 18, chapter: 46, verse: 10 },   // Psalmii 46:10
  { book: 18, chapter: 51, verse: 10 },   // Psalmii 51:10
  { book: 18, chapter: 91, verse: 1 },    // Psalmii 91:1
  { book: 18, chapter: 103, verse: 2 },   // Psalmii 103:2
  { book: 18, chapter: 118, verse: 24 },  // Psalmii 118:24
  { book: 18, chapter: 119, verse: 105 }, // Psalmii 119:105
  { book: 18, chapter: 121, verse: 1 },   // Psalmii 121:1
  { book: 18, chapter: 127, verse: 1 },   // Psalmii 127:1
  { book: 18, chapter: 139, verse: 14 },  // Psalmii 139:14
  { book: 19, chapter: 3, verse: 5 },     // Proverbele 3:5
  { book: 19, chapter: 3, verse: 6 },     // Proverbele 3:6
  { book: 19, chapter: 16, verse: 3 },    // Proverbele 16:3
  { book: 19, chapter: 22, verse: 6 },    // Proverbele 22:6
  { book: 20, chapter: 3, verse: 1 },     // Eclesiastul 3:1
  { book: 22, chapter: 40, verse: 31 },   // Isaia 40:31
  { book: 22, chapter: 41, verse: 10 },   // Isaia 41:10
  { book: 22, chapter: 53, verse: 5 },    // Isaia 53:5
  { book: 23, chapter: 29, verse: 11 },   // Ieremia 29:11
  { book: 25, chapter: 3, verse: 22 },    // Plângerile 3:22
  { book: 32, chapter: 6, verse: 8 },     // Mica 6:8

  // ── Evangelios ────────────────────────────────────────────────────────────
  { book: 39, chapter: 5, verse: 14 },    // Matei 5:14
  { book: 39, chapter: 5, verse: 16 },    // Matei 5:16
  { book: 39, chapter: 6, verse: 9 },     // Matei 6:9 — Tatăl nostru
  { book: 39, chapter: 6, verse: 33 },    // Matei 6:33
  { book: 39, chapter: 7, verse: 7 },     // Matei 7:7
  { book: 39, chapter: 11, verse: 28 },   // Matei 11:28
  { book: 39, chapter: 19, verse: 26 },   // Matei 19:26
  { book: 39, chapter: 22, verse: 37 },   // Matei 22:37
  { book: 39, chapter: 28, verse: 19 },   // Matei 28:19
  { book: 40, chapter: 11, verse: 24 },   // Marcu 11:24
  { book: 40, chapter: 16, verse: 15 },   // Marcu 16:15
  { book: 41, chapter: 1, verse: 37 },    // Luca 1:37
  { book: 41, chapter: 6, verse: 31 },    // Luca 6:31
  { book: 42, chapter: 1, verse: 1 },     // Ioan 1:1
  { book: 42, chapter: 1, verse: 12 },    // Ioan 1:12
  { book: 42, chapter: 3, verse: 16 },    // Ioan 3:16
  { book: 42, chapter: 8, verse: 12 },    // Ioan 8:12
  { book: 42, chapter: 8, verse: 32 },    // Ioan 8:32
  { book: 42, chapter: 10, verse: 10 },   // Ioan 10:10
  { book: 42, chapter: 11, verse: 25 },   // Ioan 11:25
  { book: 42, chapter: 13, verse: 34 },   // Ioan 13:34
  { book: 42, chapter: 14, verse: 1 },    // Ioan 14:1
  { book: 42, chapter: 14, verse: 6 },    // Ioan 14:6
  { book: 42, chapter: 14, verse: 27 },   // Ioan 14:27
  { book: 42, chapter: 15, verse: 5 },    // Ioan 15:5
  { book: 42, chapter: 15, verse: 13 },   // Ioan 15:13
  { book: 42, chapter: 16, verse: 33 },   // Ioan 16:33

  // ── Hechos y cartas ───────────────────────────────────────────────────────
  { book: 43, chapter: 1, verse: 8 },     // Faptele 1:8
  { book: 43, chapter: 2, verse: 38 },    // Faptele 2:38
  { book: 43, chapter: 4, verse: 12 },    // Faptele 4:12
  { book: 44, chapter: 1, verse: 16 },    // Romani 1:16
  { book: 44, chapter: 3, verse: 23 },    // Romani 3:23
  { book: 44, chapter: 5, verse: 8 },     // Romani 5:8
  { book: 44, chapter: 6, verse: 23 },    // Romani 6:23
  { book: 44, chapter: 8, verse: 1 },     // Romani 8:1
  { book: 44, chapter: 8, verse: 28 },    // Romani 8:28
  { book: 44, chapter: 8, verse: 38 },    // Romani 8:38
  { book: 44, chapter: 10, verse: 9 },    // Romani 10:9
  { book: 44, chapter: 12, verse: 2 },    // Romani 12:2
  { book: 44, chapter: 15, verse: 13 },   // Romani 15:13
  { book: 45, chapter: 10, verse: 13 },   // 1 Corinteni 10:13
  { book: 45, chapter: 13, verse: 4 },    // 1 Corinteni 13:4
  { book: 45, chapter: 13, verse: 13 },   // 1 Corinteni 13:13
  { book: 45, chapter: 15, verse: 3 },    // 1 Corinteni 15:3
  { book: 46, chapter: 5, verse: 17 },    // 2 Corinteni 5:17
  { book: 46, chapter: 12, verse: 9 },    // 2 Corinteni 12:9
  { book: 47, chapter: 2, verse: 20 },    // Galateni 2:20
  { book: 47, chapter: 5, verse: 22 },    // Galateni 5:22
  { book: 48, chapter: 2, verse: 8 },     // Efeseni 2:8
  { book: 48, chapter: 2, verse: 10 },    // Efeseni 2:10
  { book: 48, chapter: 4, verse: 32 },    // Efeseni 4:32
  { book: 48, chapter: 6, verse: 10 },    // Efeseni 6:10
  { book: 49, chapter: 1, verse: 6 },     // Filipeni 1:6
  { book: 49, chapter: 2, verse: 3 },     // Filipeni 2:3
  { book: 49, chapter: 4, verse: 6 },     // Filipeni 4:6
  { book: 49, chapter: 4, verse: 7 },     // Filipeni 4:7
  { book: 49, chapter: 4, verse: 13 },    // Filipeni 4:13
  { book: 50, chapter: 3, verse: 23 },    // Coloseni 3:23
  { book: 51, chapter: 5, verse: 16 },    // 1 Tesaloniceni 5:16
  { book: 54, chapter: 1, verse: 7 },     // 2 Timotei 1:7
  { book: 54, chapter: 3, verse: 16 },    // 2 Timotei 3:16
  { book: 57, chapter: 4, verse: 12 },    // Evrei 4:12
  { book: 57, chapter: 11, verse: 1 },    // Evrei 11:1
  { book: 57, chapter: 12, verse: 1 },    // Evrei 12:1
  { book: 57, chapter: 13, verse: 8 },    // Evrei 13:8
  { book: 58, chapter: 1, verse: 2 },     // Iacov 1:2
  { book: 58, chapter: 1, verse: 5 },     // Iacov 1:5
  { book: 58, chapter: 4, verse: 7 },     // Iacov 4:7
  { book: 59, chapter: 5, verse: 7 },     // 1 Petru 5:7
  { book: 61, chapter: 1, verse: 9 },     // 1 Ioan 1:9
  { book: 61, chapter: 4, verse: 8 },     // 1 Ioan 4:8
  { book: 61, chapter: 4, verse: 19 },    // 1 Ioan 4:19
  { book: 65, chapter: 3, verse: 20 },    // Apocalipsa 3:20
  { book: 65, chapter: 21, verse: 4 },    // Apocalipsa 21:4
];

/**
 * Tope de referencias indexables. No es un número mágico: cada una son cuatro
 * líneas de `Allow` en el `robots.txt` que Google se descarga entero, y una
 * lista blanca que crece sin freno deja de serlo. Con 500 el fichero ronda los
 * 90 KB, muy por debajo del límite de 500 KB de Google, y sigue siendo una
 * selección y no un catálogo.
 */
export const MAXIMO_INDEXABLES = 500;

const clave = ({ book, chapter, verse }) => `${book}-${chapter}-${verse}`;

/**
 * Une los versículos de oro con los del versículo del día y quita repetidos.
 *
 * Los del día entran porque ya están elegidos con el mismo criterio y porque
 * son los que la aplicación enseña a diario: es el contenido que más gente ve y
 * más probablemente busca después.
 *
 * @param {Array<{book:number,chapter:number,verse:number}>} diarios
 * @returns {Array<{book:number,chapter:number,verse:number}>} ordenados
 */
export function combinarIndexables(diarios = []) {
  const vistos = new Set();
  const salida = [];
  for (const ref of [...GOLDEN_VERSES, ...diarios]) {
    if (!ref || !Number.isInteger(ref.book) || !Number.isInteger(ref.chapter) || !Number.isInteger(ref.verse)) continue;
    const k = clave(ref);
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push({ book: ref.book, chapter: ref.chapter, verse: ref.verse });
  }
  // Orden canónico: hace que el robots.txt y el sitemap generados sean estables
  // entre builds, y un diff de dos líneas se lee.
  salida.sort((a, b) => a.book - b.book || a.chapter - b.chapter || a.verse - b.verse);
  return salida;
}

/** Índice de búsqueda rápida a partir de una lista ya combinada. */
export function crearIndice(refs) {
  return new Set(refs.map(clave));
}

/** ¿Este versículo se indexa? `indice` sale de `crearIndice`. */
export function esIndexable(indice, book, chapter, verse) {
  return indice.has(`${book}-${chapter}-${verse}`);
}
