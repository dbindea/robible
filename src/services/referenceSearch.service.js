/**
 * Reference search service — busqueda por referencia flexible.
 * Acepta multiples formatos: "rom 3 5", "romani 3:5", "rom 3.5", "1 ioan 2 6", "io 1 5".
 *
 * Para "io 1 5" devuelve multiples matches (1 Ioan 1:5, 2 Ioan 1:5, 3 Ioan 1:5).
 * Para "1 ioan 2 6" devuelve solo 1 Ioan 2:6.
 *
 * Acepta además rangos ("ioan 3:16-18", "ioan 3-4") y la forma en que la gente
 * habla o escribe de corrido: "ioan capitolul 3 versetul 16", "psalmul 23",
 * "诗篇23".
 */

import { PALABRAS_DE_RELLENO } from './speech-reference.service.js';

// ── Normalizacion de texto ──────────────────────────────────────────
function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar diacriticos
    .replace(/[.,;:]/g, ' ') // . , ; : → espacio
    // El chino no lleva espacios: «诗篇23» es UNA palabra para el troceador y
    // por tanto el nombre de un libro que no existe. Se separan los dígitos de
    // los ideogramas y a partir de ahí es una referencia como cualquier otra.
    // Sólo con escritura Han: el caso latino pegado («1ioan») ya lo resuelve
    // `parseInput`, y separarlo aquí rompería su reconstrucción del libro
    // numerado.
    .replace(/(\p{Script=Han})(\d)/gu, '$1 $2')
    .replace(/(\d)(\p{Script=Han})/gu, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Rangos: "ioan 3:16-18", "ioan 3-4" ──────────────────────────────
//
// Antes esto no devolvía NADA. El guion no es separador para `normalize`, así
// que «16-18» llegaba entero al troceador, no pasaba por `/^\d+$/` y acababa
// dentro del nombre del libro: `matchBooks` buscaba un libro llamado «ioan
// 16-18» y el desplegable se quedaba vacío, sin ninguna pista de por qué.
//
// Se separa el número final y el resto se parsea como siempre. El patrón va
// anclado AL FINAL a propósito: así «1-2 Ioan» —que no es un rango, son dos
// libros— no se confunde con uno.
const RANGO_FINAL = /(\d+)\s*[-–—]\s*(\d+)\s*$/;

function separarRango(entrada) {
  const texto = String(entrada ?? '');
  const encontrado = texto.match(RANGO_FINAL);
  if (!encontrado) return { texto, fin: null };
  return {
    texto: texto.slice(0, encontrado.index) + encontrado[1],
    fin: parseInt(encontrado[2], 10),
  };
}

// ── Distancia Levenshtein (typo tolerance) ──────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j < b.length; j++) matrix[0][j + 1] = j + 1;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

/** Cuántas letras comparten dos cadenas por el principio. */
function prefijoComun(a, b) {
  const tope = Math.min(a.length, b.length);
  let i = 0;
  while (i < tope && a[i] === b[i]) i++;
  return i;
}

// ── Heuristica de prefijo plausible ─────────────────────────────────
//
// El problema que resuelve: con una query de 1-2 letras, cualquier libro que
// empiece por ahí es candidato, y la lista de sugerencias se vuelve inútil.
// Hace falta un filtro, pero tiene que dejar pasar las abreviaturas normales.
//
// La versión anterior lo medía por diferencia de longitud: si el nombre tenía
// más de 4 caracteres de más que la query, se descartaba. Eso tumbaba justo las
// abreviaturas que más se escriben, porque los nombres de libro son largos:
// "prov" → Proverbele (6 de más), "deut" → Deuteronomul (8), "apoc" →
// Apocalipsa (6), "fapte" → Faptele Apostolilor (14). Fallaban 8 de las 11
// abreviaturas habituales, incluida `prov 3 4`, que no devolvía nada.
//
// Lo que de verdad discrimina no es la longitud del nombre sino la de la query:
// con tres letras ya escritas, el usuario ha dicho bastante como para aceptar
// un nombre tan largo como haga falta. La guarda estricta sólo hace falta
// mientras la query es muy corta.
function isPlausiblePrefix(query, name) {
  // Si el nombre es igual al query, OK
  if (query === name) return true;

  const lengthDiff = name.length - query.length;

  // Si la query incluye un numero de libro (ej: "1 co"), el nombre
  // puede ser mucho más largo. Solo exigir que la query sea plausible.
  const hasNumberPrefix = /^([123])\s/.test(query) || /^([123])[a-z]/.test(query);
  if (hasNumberPrefix) {
    // Para "1 co" matching "1 Corinteni" — el resto del query debe ser al menos 1 letra
    const rest = query.replace(/^[123]\s?/, '').trim();
    if (rest.length < 1) return false;
    return true;
  }

  // Con 2 o más letras el prefijo es intencionado: se acepta sin mirar cuánto
  // más largo sea el nombre. Es lo que hace funcionar "prov", "deut", "apoc" y
  // también "ps" → Psalmii, que es de las abreviaturas más escritas.
  //
  // El umbral está en 2 y no en 3 porque el reparto real de los 66 libros lo
  // permite: con dos letras, el prefijo más ambiguo ("io") empareja 8 libros, y
  // la lista de sugerencias corta en 5 ya ordenados por score. Con una sola
  // letra el peor caso son 14 ("i"), que sí es ruido inservible.
  if (query.length >= 2) return true;

  // Una sola letra: se mantiene la guarda estricta.
  return lengthDiff <= 2;
}

// ── Buscar libro por nombre flexible ───────────────────────────────
function matchBooks(map, query) {
  if (!map || !query) return [];
  const q = normalize(query);

  const matches = [];
  const bookCount = (map.all || []).length;

  for (let i = 0; i < bookCount; i++) {
    const name = map[i];
    if (!name) continue;
    const nameNorm = normalize(name);

    // Quitar el prefijo numerico "1 ", "2 ", "3 " para comparar
    const stripped = nameNorm.replace(/^[123] /, '');

    let score = Infinity;
    let prefixLen = 0;

    // 1. Match exacto (sin prefijo)
    if (stripped === q || nameNorm === q) score = 0;
    // 2. Prefix match (el usuario escribe los primeros chars)
    // Comparar contra stripped (sin numero) y nameNorm (con numero)
    else if (stripped.startsWith(q) && isPlausiblePrefix(q, stripped)) {
      score = 1;
      prefixLen = q.length;
    }
    // 2b. Prefix match incluyendo el numero "1 ", "2 ", "3 "
    else if (nameNorm.startsWith(q) && isPlausiblePrefix(q, nameNorm)) {
      score = 1;
      prefixLen = q.length;
    }
    // 3. Prefix match: query "1 co" → "1 Corinteni"
    else {
      const numMatch = q.match(/^([123]) (.+)$/);
      if (numMatch) {
        const [, num, rest] = numMatch;
        const nameNum = nameNorm.match(/^([123]) /);
        if (nameNum && nameNum[1] === num && stripped.startsWith(rest) && isPlausiblePrefix(rest, stripped)) {
          score = 2;
          prefixLen = rest.length;
        }
      }
    }
    // 4. Match por numero solo: "1" → 1 Samuel, 1 Împărați, 1 Cronici...
    if (score === Infinity) {
      const numOnly = q.match(/^([123])$/);
      if (numOnly) {
        const num = numOnly[1];
        const nameNum = nameNorm.match(/^([123]) /);
        if (nameNum && nameNum[1] === num) {
          // Match todos los libros que empiezan con este numero
          score = 3;
          prefixLen = 0;
        }
      }
    }
    // 5. Typo tolerance (Levenshtein <= 1) para typos como "iona" → "ioan"
    if (score === Infinity) {
      // Solo aplicar si la longitud es >= 3 (no aceptar "a" → match aleatorio)
      if (q.length >= 3 && stripped.length >= 3) {
        const dist = levenshtein(q, stripped);
        if (dist <= 1) {
          score = 4;
          prefixLen = 0;
        }
      }
    }
    // 6. Mismo comienzo, terminación distinta: «psalmul» → «Psalmii».
    //
    // Es la forma en que se nombra un libro al hablar, y en rumano cambia la
    // desinencia entera: «psalmul» y «psalmii» se diferencian en DOS letras, así
    // que ni el prefijo ni la tolerancia de una errata las emparejaban.
    // «Psalmul 23» —de las referencias que más se escriben— no devolvía nada.
    //
    // No se sube el umbral de Levenshtein a 2 porque eso emparejaría libros
    // cortos que sólo se parecen por casualidad; lo que de verdad indica que se
    // está nombrando el mismo libro es compartir un comienzo largo y no
    // diferenciarse mucho en longitud. Va la última, así que un libro que
    // empareje de cualquier otra forma sigue saliendo antes.
    if (score === Infinity && q.length >= 5 && stripped.length >= 5 && Math.abs(q.length - stripped.length) <= 3) {
      if (prefijoComun(q, stripped) >= 5) {
        score = 5;
        prefixLen = 0;
      }
    }

    if (score !== Infinity) {
      matches.push({ book: i, name, score, prefixLen });
    }
  }

  // Ordenar: menor score primero, luego libros mas cortos
  matches.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.name.length - b.name.length;
  });

  return matches;
}

// ── Parsear entrada: extraer libro, capítulo, versículo ────────────
// Regla: el primer token numérico pequeño (1, 2 o 3) seguido de un word
// se interpreta como prefijo de libro numerado ("1 ioan" = 1 Ioan).
// Si no hay word, los números solos son query.
// "1ioan" o "1ioa" — split del dígito pegado.
// "rom 3 5" → bookQuery="rom", chapter=3, verse=5.
//
// El rango se separa ANTES de trocear y se devuelve aparte, en `fin`: qué
// significa ese número —último versículo o último capítulo— no se puede decidir
// aquí, depende de si la referencia acabó teniendo versículo o no.
function parseInput(input) {
  const { texto, fin } = separarRango(input);
  return { ...parseInputSinRango(texto), fin };
}

function parseInputSinRango(input) {
  if (!input) return { bookQuery: '', chapter: null, verse: null };

  const normalized = normalize(input);
  const tokens = normalized.split(' ').filter(Boolean);
  if (!tokens.length) return { bookQuery: '', chapter: null, verse: null };

  const numbers = [];
  const words = [];
  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      numbers.push(parseInt(token, 10));
    } else {
      words.push(token);
    }
  }

  // Solo numeros: "1" → "1 Samuel", "1 Împărați" (prefijo ambiguo)
  if (words.length === 0) {
    if (numbers.length > 0) {
      return { bookQuery: numbers[0].toString(), chapter: null, verse: null };
    }
    return { bookQuery: '', chapter: null, verse: null };
  }

  // Caso "1ioan", "1ioa" — split numero pegado al inicio
  const firstWord = words[0];
  if (/^\d/.test(firstWord) && !/^\d+$/.test(firstWord)) {
    const match = firstWord.match(/^(\d+)(.+)$/);
    if (match) {
      const [, num, rest] = match;
      const remainingWords = words.slice(1);
      const remainingNumbers = numbers;
      const bookQueryWithNum = [num, rest, ...remainingWords].filter(Boolean).join(' ');
      return {
        bookQuery: bookQueryWithNum,
        chapter: remainingNumbers[0] || null,
        verse: remainingNumbers[1] || null,
      };
    }
  }

  // Caso "1 ioan" — primer token es un numero pequeño, lo tratamos como prefijo de libro
  // Esto solo aplica si el primer token es un numero (no si hay un word primero)
  if (numbers.length > 0 && /^[123]$/.test(numbers[0].toString())) {
    // Determinar si el PRIMER token es un numero
    const firstTokenIsNumber = /^\d+$/.test(tokens[0]);
    if (firstTokenIsNumber && words.length >= 1) {
      const firstNum = numbers[0];
      const remainingNumbers = numbers.slice(1);
      const bookQueryWithNum = [firstNum, ...words].join(' ');
      return {
        bookQuery: bookQueryWithNum,
        chapter: remainingNumbers[0] || null,
        verse: remainingNumbers[1] || null,
      };
    }
  }

  // Caso normal: "rom 3 5" → bookQuery="rom", chapter=3, verse=5
  let chapter = null;
  let verse = null;
  if (numbers.length >= 1) {
    chapter = numbers[0];
    if (numbers.length >= 2) {
      verse = numbers[1];
    }
  }

  return { bookQuery: words.join(' '), chapter, verse };
}

/**
 * Devuelve TODAS las interpretaciones posibles del input.
 * Por ejemplo, "io 1 5" puede ser:
 *   1) bookQuery="io", chapter=1, verse=5 → Ioan 1:5, 1 Ioan 1:5, 2 Ioan 1:5, 3 Ioan 1:5
 *   2) bookQuery="1 io", chapter=1, verse=5 → 1 Ioan 1:5
 */
function parseInputAll(input) {
  const interpretations = [];
  const base = parseInput(input);
  if (base.bookQuery) {
    interpretations.push(base);
  }

  if (!input) return interpretations;

  const { texto: sinRango, fin } = separarRango(input);
  const normalized = normalize(sinRango);
  const tokens = normalized.split(' ').filter(Boolean);
  if (!tokens.length) return interpretations;

  // Detectar si el primer token es un numero y el segundo un word
  // Generar interpretacion alternativa: numero como prefijo de libro
  const numbers = [];
  const words = [];
  for (const token of tokens) {
    if (/^\d+$/.test(token)) numbers.push(parseInt(token, 10));
    else words.push(token);
  }

  // Si hay al menos un numero y un word, generar version con numero como prefijo
  if (numbers.length >= 1 && words.length >= 1) {
    const firstNum = numbers[0];
    const remainingNumbers = numbers.slice(1);
    interpretations.push({
      bookQuery: [firstNum, ...words].join(' '),
      chapter: remainingNumbers[0] || null,
      verse: remainingNumbers[1] || null,
      fin,
    });
  }

  // Si el primer word empieza con numero pegado
  const firstWord = words[0];
  if (firstWord && /^\d/.test(firstWord) && !/^\d+$/.test(firstWord)) {
    const match = firstWord.match(/^(\d+)(.+)$/);
    if (match) {
      const [, num, rest] = match;
      const remainingWords = words.slice(1);
      const remainingNumbers = numbers;
      interpretations.push({
        bookQuery: [num, rest, ...remainingWords].filter(Boolean).join(' '),
        chapter: remainingNumbers[0] || null,
        verse: remainingNumbers[1] || null,
        fin,
      });
    }
  }

  // ── Y por último, lo mismo sin las palabras de relleno ────────────────────
  //
  // «ioan capitolul 3 versetul 16» es como se dicta y como mucha gente escribe,
  // y hasta ahora no devolvía nada: «capitolul» y «versetul» se iban con el
  // nombre del libro y `matchBooks` buscaba un libro llamado «ioan capitolul
  // versetul». La lista de palabras es la misma que usa el dictado, para que no
  // vivan en dos sitios.
  //
  // Va LA ÚLTIMA y como interpretación añadida, no como sustitución: si la
  // frase entera ya emparejaba un libro, esto no llega a mirarse. Importa
  // porque hay nombres que llevan dentro una de esas palabras —«Cantar de los
  // Cantares»— y quitársela los estropearía.
  // Se vuelve a parsear la frase limpia entera en vez de recomponerla a mano:
  // así «1 ioan capitolul 2 versetul 6» pasa por las mismas reglas de libro
  // numerado que «1 ioan 2 6», sin duplicarlas aquí.
  // Y sólo si después de quitarlas queda algún nombre: «1 The» —camino de
  // «1 Thessalonians»— se quedaba en «1», que empareja los cinco libros
  // numerados y llenaba el desplegable de sugerencias que nadie había pedido.
  const limpios = tokens.filter((t) => !PALABRAS_DE_RELLENO.has(t));
  const quedaNombre = limpios.some((t) => !/^\d+$/.test(t));
  if (quedaNombre && limpios.length < tokens.length) {
    const alterna = parseInputSinRango(limpios.join(' '));
    if (alterna.bookQuery) interpretations.push({ ...alterna, fin });
  }

  return interpretations;
}

// ── ¿Existe de verdad esa referencia? ───────────────────────────────
//
// El nombre del libro lo valida `map`, pero el capítulo y el versículo no los
// valida nadie: con «ioan 4 4» salían las cuatro combinaciones —Ioan, 1, 2 y
// 3 Ioan— y dos de ellas **no existen**, porque 2 Ioan y 3 Ioan tienen un solo
// capítulo. En el buscador de la aplicación es ruido; en el modo proyección es
// peor, porque se pulsa con prisa y delante de la congregación.
//
// Se comprueba contra la Biblia cargada y no contra una tabla de longitudes:
// cada versión numera a su manera (CLAUDE.md, trampa 96) y una tabla se
// quedaría vieja en cuanto se añada una edición.
/**
 * @param {Array} bible - la Biblia cargada: libros → capítulos → versículos
 * @param {number} book - índice de libro (0-65)
 * @param {number|null} chapter - número de capítulo (base 1), o null
 * @param {number|null} verse - número de versículo (base 1), o null
 */
export function referenceExists(bible, book, chapter, verse) {
  const chapters = bible?.[book];
  if (!Array.isArray(chapters) || !chapters.length) return false;
  if (chapter == null) return true;
  const verses = chapters[chapter - 1];
  if (!Array.isArray(verses) || !verses.length) return false;
  if (verse == null) return true;
  return verse >= 1 && verse <= verses.length;
}

// ── El final de un rango ────────────────────────────────────────────
//
// Qué significa el número de después del guion depende de lo que haya antes:
// con versículo («ioan 3:16-18») es el último VERSÍCULO; sin él («ioan 3-4»),
// el último CAPÍTULO. Se decide aquí y no al trocear porque al trocear todavía
// no se sabe qué libro es, y sin libro no hay con qué comprobarlo.
//
// El final se recorta a lo que de verdad existe en lugar de descartarse:
// «ioan 3:16-99» es alguien que quiere hasta el final del capítulo, y
// ofrecerle «Ioan 3:16-36» es más útil que dejarle sólo «Ioan 3:16» sin decir
// por qué. Un final menor que el principio sí se descarta: no es un rango.
function finalDelRango(bible, book, chapter, verse, fin) {
  const vacio = { verse, verseEnd: null, chapterEnd: null };
  if (fin == null) return vacio;
  const capitulos = Array.isArray(bible) && bible.length ? bible[book] : null;

  if (verse != null) {
    if (fin <= verse) return vacio;
    const versiculos = capitulos?.[chapter - 1];
    const tope = Array.isArray(versiculos) ? versiculos.length : null;
    const final = tope ? Math.min(fin, tope) : fin;
    // Recortado hasta el propio principio ya no es un rango: «Ioan 3:36-36» no
    // se escribe en ningún sitio.
    return final > verse ? { verse, verseEnd: final, chapterEnd: null } : vacio;
  }

  if (chapter != null) {
    if (fin <= chapter) return vacio;
    const tope = Array.isArray(capitulos) ? capitulos.length : null;
    const final = tope ? Math.min(fin, tope) : fin;
    return final > chapter ? { verse, verseEnd: null, chapterEnd: final } : vacio;
  }

  return vacio;
}

// ── API principal ───────────────────────────────────────────────────
/**
 * Busca referencias que coincidan con el input.
 * Devuelve hasta maxResults matches combinando todas las interpretaciones posibles.
 * @param {string} input - Texto del usuario
 * @param {object} map - bible.map.json (libro → nombre)
 * @param {number} [maxResults=5] - Maximo de resultados a devolver
 * @param {Array} [bible=null] - Biblia cargada. Si se pasa, se descartan las
 *   referencias que no existen en ella. El filtro va DENTRO y no en el
 *   llamante porque el corte a `maxResults` es lo primero que se hace: filtrando
 *   después, las combinaciones imposibles se comían el sitio de las buenas.
 * @returns {Array<{book: number, name: string, chapter: number|null, verse: number|null,
 *   verseEnd: number|null, chapterEnd: number|null}>}
 */
export function searchReferences(input, map, maxResults = 5, bible = null) {
  if (!input || !map) return [];

  // Generar TODAS las interpretaciones posibles
  const interpretations = parseInputAll(input);
  if (!interpretations.length) return [];

  // Sin Biblia cargada no se filtra nada: es lo que pasa mientras se descarga,
  // y quedarse sin sugerencias sería peor que enseñar alguna de más.
  const validate = Array.isArray(bible) && bible.length > 0;

  const seen = new Set();
  const results = [];

  for (const { bookQuery, chapter, verse, fin } of interpretations) {
    if (!bookQuery) continue;

    const matches = matchBooks(map, bookQuery);
    for (const m of matches) {
      const key = `${m.book}-${chapter}-${verse}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (validate && !referenceExists(bible, m.book, chapter, verse)) continue;
      results.push({
        book: m.book,
        name: m.name,
        chapter,
        ...finalDelRango(bible, m.book, chapter, verse, fin),
      });
      if (results.length >= maxResults) break;
    }
    if (results.length >= maxResults) break;
  }

  return results;
}

/**
 * Parsea una entrada y devuelve un match unico si es inequivoco.
 * @returns {object|null} - Si solo hay 1 match con libro+cap+vers, lo devuelve
 */
export function parseReference(input, map, bible = null) {
  const results = searchReferences(input, map, 5, bible);
  if (results.length === 1 && results[0].chapter && results[0].verse) {
    return results[0];
  }
  return null;
}

/**
 * Formatea una referencia como string legible.
 * Ej: {name: 'Romani', chapter: 3, verse: 5} → 'Romani 3:5'
 *     con rango → 'Ioan 3:16-18', 'Ioan 3-4'
 *
 * Lo pintan la sugerencia del panel lateral y la del modo proyección, que antes
 * componían cada una su etiqueta a mano y por eso ninguna de las dos sabía
 * enseñar un rango.
 */
export function formatReference(match) {
  if (!match) return '';
  const numeros = formatChapterVerse(match);
  return numeros ? `${match.name} ${numeros}` : match.name;
}

/**
 * Sólo la parte numérica: '3:16', '3:16-18', '3-4', o '' si no hay capítulo.
 *
 * Existe porque el panel lateral pinta el nombre y los números en dos cajas
 * distintas —el número va en una píldora de acento— y necesita la segunda mitad
 * por separado. Antes se la componía a mano y por eso no sabía enseñar un rango.
 */
export function formatChapterVerse(match) {
  if (!match || match.chapter == null) return '';
  if (match.verse != null) {
    return `${match.chapter}:${match.verse}${match.verseEnd ? `-${match.verseEnd}` : ''}`;
  }
  return `${match.chapter}${match.chapterEnd ? `-${match.chapterEnd}` : ''}`;
}

export { normalize, matchBooks, parseInput, parseInputAll, levenshtein };
