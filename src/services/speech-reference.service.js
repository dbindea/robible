// De lo que se dice en voz alta a algo que el buscador entienda.
//
// El problema: el reconocimiento de voz no devuelve «Ioan 3:16». Devuelve texto
// corrido, en el idioma del reconocedor, con los números **escritos con letra**
// y palabras de relleno por medio:
//
//   «ioan capitolul trei versetul șaisprezece»   → ioan 3 16
//   «juan tres dieciséis»                         → juan 3 16
//   «primul samuel douăzeci și opt»               → 1 samuel 20 8   ← ojo
//   «john chapter three verse sixteen»            → john 3 16
//
// Y hay un caso que parece igual y no lo es: los **ordinales de libro**. «primul
// Samuel» o «segunda de Corintios» no son un capítulo, son parte del nombre del
// libro. Si «primul» se convierte en un 1 suelto, `parseReference` cree que el
// libro es «1» y falla. Por eso los ordinales se traducen a su forma escrita
// («1 samuel») ANTES de tocar los números normales.
//
// Este módulo es puro a propósito: no toca el micrófono ni el DOM, así que se
// puede probar entero con las frases reales que devuelve cada reconocedor.

// ── Números hablados, por idioma ─────────────────────────────────────────────
//
// Sólo hasta lo que hace falta: el capítulo más alto de la Biblia es Salmos 150
// y el versículo más alto, Salmos 119:176. Las decenas y la centena se combinan
// con las unidades más abajo.

const UNIDADES = {
  ro: {
    zero: 0, unu: 1, una: 1, un: 1, doi: 2, doua: 2, trei: 3, patru: 4, cinci: 5,
    sase: 6, sapte: 7, opt: 8, noua: 9, zece: 10, unsprezece: 11, doisprezece: 12,
    douasprezece: 12, treisprezece: 13, paisprezece: 14, cincisprezece: 15,
    saisprezece: 16, saptesprezece: 17, optsprezece: 18, nouasprezece: 19,
  },
  es: {
    cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
    siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
    catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
    diecinueve: 19, veinte: 20, veintiuno: 21, veintiuna: 21, veintidos: 22,
    veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
    veintisiete: 27, veintiocho: 28, veintinueve: 29,
  },
  en: {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19,
  },
};

const DECENAS = {
  ro: { douazeci: 20, treizeci: 30, patruzeci: 40, cincizeci: 50, saizeci: 60, saptezeci: 70, optzeci: 80, nouazeci: 90 },
  es: { veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 },
  en: { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 },
};

const CIEN = {
  ro: ['suta'],
  es: ['cien', 'ciento'],
  en: ['hundred'],
};

// La conjunción que une decena y unidad: «douăzeci ȘI opt», «treinta Y uno».
const CONJUNCION = { ro: ['si'], es: ['y'], en: ['and'] };

/**
 * ¿Se pega una unidad a la decena anterior aunque NO haya conjunción?
 *
 * En inglés sí: «twenty eight» es 28 y nadie dice «twenty and eight». En
 * rumano y español no, y la diferencia importa mucho más de lo que parece:
 * «douăzeci opt» es *capítulo 20, versículo 8*, mientras que «douăzeci ȘI opt»
 * es 28. Componiendo siempre, no había forma de dictar «Samuel 20:8» sin decir
 * «capitolul» y «versetul» — y es justo la manera en que se dicta con prisa.
 */
const COMPONE_SIN_CONJUNCION = { ro: false, es: false, en: true };

// Artículo que precede a la centena: «O sută nouăsprezece». Suelto no significa
// nada en una referencia, pero sólo se descarta delante de «sută»: en otro sitio
// puede ser parte de lo dictado.
const ARTICULO_CENTENA = { ro: ['o'], es: [], en: ['a', 'one'] };

/**
 * Artículo del ordinal de libro en rumano: «A doua Timotei», «AL doilea Samuel».
 *
 * Hace falta porque en rumano el ordinal son dos palabras y la segunda coincide
 * con un número normal: «doua» es 2 en cualquier otro contexto. Lo que lo
 * convierte en ordinal es precisamente este artículo delante, así que se
 * detecta el par entero y se emite el número sin componerlo con nada.
 * En español el ordinal ya es una palabra propia («segunda»), y en inglés
 * también («second»), así que allí esto no hace falta.
 */
const ARTICULO_ORDINAL = { ro: ['a', 'al'], es: [], en: [] };

// Palabras que sobran. El reconocedor las mete porque la gente las dice.
const RELLENO = {
  ro: ['capitolul', 'capitol', 'versetul', 'verset', 'cartea', 'din', 'la', 'cu'],
  es: ['capitulo', 'capitulos', 'versiculo', 'versiculos', 'verso', 'libro', 'de', 'del', 'la', 'el'],
  en: ['chapter', 'chapters', 'verse', 'verses', 'book', 'of', 'the'],
};

/**
 * Las mismas palabras, todas juntas y sin idioma.
 *
 * Las usa también el buscador escrito (`referenceSearch.service.js`): quien
 * dicta «ioan capitolul 3 versetul 16» lo escribe igual cuando teclea, y la
 * lista no puede vivir en dos sitios. Va sin separar por idioma porque allí no
 * se sabe en cuál está escribiendo el usuario, y sólo se usa como SEGUNDO
 * intento: si la frase entera ya emparejaba un libro, no llega a mirarse.
 */
export const PALABRAS_DE_RELLENO = new Set([...RELLENO.ro, ...RELLENO.es, ...RELLENO.en]);

/**
 * Ordinales de libro → su forma escrita.
 *
 * Va antes que todo lo demás y por eso importa el orden: «primul samuel» tiene
 * que acabar en «1 samuel», no en «1 1 samuel» ni en un capítulo 1 fantasma.
 * Las formas femeninas están porque en español se dice «segunda de Corintios».
 */
const ORDINALES = {
  ro: { primul: '1', prima: '1', intai: '1', intaia: '1', aldoilea: '2', adoua: '2', doilea: '2', altreilea: '3', atreia: '3', treilea: '3' },
  es: { primer: '1', primera: '1', primero: '1', segunda: '2', segundo: '2', tercera: '3', tercero: '3', tercer: '3' },
  en: { first: '1', second: '2', third: '3' },
};

/** Quita diacríticos y baja a minúsculas. Mismo criterio que el buscador. */
const normalizar = (texto) =>
  String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    // La `ș`/`ț` rumanas con coma no siempre se descomponen: se mapean a mano.
    .replace(/[şș]/g, 's')
    .replace(/[ţț]/g, 't')
    .trim();

/** El idioma base ('ro', 'es', 'en') a partir de un locale tipo 'ro-RO'. */
export const idiomaDe = (locale) => {
  const base = String(locale || '').slice(0, 2).toLowerCase();
  return UNIDADES[base] ? base : 'ro';
};

// ── Chino ───────────────────────────────────────────────────────────────────
//
// Aparte porque no funciona por palabras: no hay espacios y los números se
// componen con 十 (diez) de forma multiplicativa — 二十三 es 23, 十六 es 16.
const CIFRAS_ZH = { 〇: 0, 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

const numeroChino = (texto) => {
  let total = 0;
  let actual = 0;
  let vacio = true;
  for (const c of texto) {
    if (c in CIFRAS_ZH) { actual = CIFRAS_ZH[c]; vacio = false; }
    else if (c === '十') { actual = (actual || 1) * 10; total += actual; actual = 0; vacio = false; }
    else if (c === '百') { actual = (actual || 1) * 100; total += actual; actual = 0; vacio = false; }
    else return null;
  }
  return vacio ? null : total + actual;
};

const convertirChino = (texto) =>
  String(texto ?? '')
    // 约翰福音三章十六节 → 约翰福音 3 章 16 节
    .replace(/[〇零一二两三四五六七八九十百]+/g, (m) => {
      const n = numeroChino(m);
      return n === null ? m : ` ${n} `;
    })
    // Los clasificadores se quitan SÓLO detrás de un número. 篇 es clasificador
    // de capítulo, pero también la segunda mitad de 诗篇 (Salmos): borrándolo a
    // secas, «诗篇二十三篇» se quedaba en «诗 23» y el libro dejaba de existir.
    .replace(/(\d)\s*[章节節篇]/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Convierte lo dictado en una cadena para `parseReference` / `searchReferences`.
 *
 * No intenta adivinar el libro ni validar nada: sólo deja el texto en la forma
 * que el buscador ya sabe leer («ioan 3 16»). Si no reconoce un número, lo deja
 * como está — el buscador de referencias aguanta texto suelto y, si no encuentra
 * nada, siempre queda la búsqueda por expresión.
 *
 * @param {string} dictado Lo que devolvió el reconocedor.
 * @param {string} locale  'ro-RO', 'es-ES', 'en-US', 'zh-CN'…
 */
export function normalizarDictado(dictado, locale = 'ro-RO') {
  const crudo = String(dictado ?? '').trim();
  if (!crudo) return '';

  if (String(locale).slice(0, 2).toLowerCase() === 'zh') return convertirChino(crudo);

  const lang = idiomaDe(locale);
  const unidades = UNIDADES[lang];
  const decenas = DECENAS[lang];
  const cien = CIEN[lang];
  const conjuncion = CONJUNCION[lang];
  const relleno = RELLENO[lang];
  const ordinales = ORDINALES[lang];

  // Los dos puntos y los guiones de «3:16» o «3-16» se vuelven espacios: el
  // reconocedor a veces ya formatea, y así los dos caminos acaban igual.
  const palabras = normalizar(crudo).replace(/[:.\-–—,]/g, ' ').split(/\s+/).filter(Boolean);

  const salida = [];
  let acumulado = null;      // número a medio componer (decena esperando unidad)
  let huboConjuncion = false; // ¿se dijo «și» / «y» entre la decena y la unidad?

  const volcar = () => {
    if (acumulado !== null) { salida.push(String(acumulado)); acumulado = null; }
    huboConjuncion = false;
  };

  for (let i = 0; i < palabras.length; i += 1) {
    const p = palabras[i];
    const siguiente = palabras[i + 1];

    // 0) Artículo de la centena: «o sută». Se descarta sólo aquí, pegado a
    //    «sută»; en cualquier otro sitio puede ser parte de lo dictado.
    if (ARTICULO_CENTENA[lang].includes(p) && cien.includes(siguiente)) continue;

    // 0b) Artículo del ordinal rumano: «a doua Timotei», «al doilea Samuel».
    //     El par se consume entero y emite el número del libro, sin pasar por
    //     la composición de decenas: si no, «a» acababa en la salida como si
    //     fuese parte del nombre y «doua» como un capítulo 2.
    if (ARTICULO_ORDINAL[lang].includes(p) && siguiente && i + 2 < palabras.length) {
      const comoOrdinal = ordinales[siguiente] ?? (unidades[siguiente] <= 3 ? String(unidades[siguiente]) : undefined);
      if (comoOrdinal !== undefined) {
        volcar();
        salida.push(comoOrdinal);
        i += 1; // la segunda palabra del par ya está consumida
        continue;
      }
    }

    // 1) Ordinal de libro: sólo cuenta al principio o si lo sigue una palabra,
    //    porque «primul» suelto al final no es el nombre de ningún libro.
    if (ordinales[p] && i + 1 < palabras.length) {
      volcar();
      salida.push(ordinales[p]);
      continue;
    }

    // 2) Relleno: fuera. Pero NO corta un número a medias, así que no vuelca.
    if (relleno.includes(p)) continue;

    // 3) Ya es un número escrito con cifras.
    if (/^\d+$/.test(p)) { volcar(); salida.push(p); continue; }

    // 4) Conjunción entre decena y unidad. Se anota: es lo que distingue
    //    «douăzeci și opt» (28) de «douăzeci opt» (capítulo 20, versículo 8).
    if (conjuncion.includes(p)) {
      if (acumulado !== null) huboConjuncion = true;
      continue;
    }

    // 5) Centena: sólo Salmos pasa de 100, y siempre es «ciento y algo».
    if (cien.includes(p)) {
      acumulado = (acumulado || 1) * 100;
      continue;
    }

    // 6) Decena: se queda esperando por si viene una unidad detrás.
    if (decenas[p] !== undefined) {
      if (acumulado !== null && acumulado % 100 === 0) acumulado += decenas[p];
      else { volcar(); acumulado = decenas[p]; }
      continue;
    }

    // 7) Unidad. Se pega a la decena anterior sólo si la lengua lo permite sin
    //    conjunción (inglés) o si de verdad se dijo la conjunción. Si no, son
    //    dos números distintos: capítulo y versículo.
    if (unidades[p] !== undefined) {
      if (acumulado !== null && (huboConjuncion || COMPONE_SIN_CONJUNCION[lang] || acumulado % 100 === 0)) {
        acumulado += unidades[p];
        volcar();
      } else {
        volcar();
        salida.push(String(unidades[p]));
      }
      continue;
    }

    // 8) Cualquier otra cosa es parte del nombre del libro.
    volcar();
    salida.push(p);
  }

  volcar();
  return salida.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Lo mismo, pero para el campo de búsqueda por expresión.
 *
 * Aquí NO se tocan los números: quien dicta «toate lucrurile» quiere esas
 * palabras tal cual, y convertir un «doi» en «2» estropearía la búsqueda. Sólo
 * se limpia la puntuación final, que el reconocedor añade por su cuenta.
 */
export function normalizarDictadoLibre(dictado) {
  return String(dictado ?? '')
    .replace(/[.。,，!！?？]+\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}
