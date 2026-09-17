// Genera los datos de una versión bíblica en el formato de RoBible.
//
//   node scripts/build-bible-data.mjs en_kjv
//   node scripts/build-bible-data.mjs zh_cuv
//   node scripts/build-bible-data.mjs            (todas)
//
// Produce public/data/<version>/bible.json y bible.map.json:
//   bible.json      array[66] de libros → capítulos → versículos (string)
//   bible.map.json  { "0": "Genesis", …, ot: [...], nt: [...], all: [...] }
//
// Los textos se descargan de fuentes de dominio público y se validan contra el
// canon (66 libros y su número de capítulos) antes de escribir nada: es
// preferible fallar aquí que publicar una Biblia incompleta.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_DATOS = path.join(RAIZ, 'public', 'data');

// Nombre y número de capítulos de los 66 libros protestantes, en orden.
// Es la referencia contra la que se valida cualquier descarga.
const CANON = [
  ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34],
  ['Joshua', 24], ['Judges', 21], ['Ruth', 4], ['1 Samuel', 31], ['2 Samuel', 24],
  ['1 Kings', 22], ['2 Kings', 25], ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10],
  ['Nehemiah', 13], ['Esther', 10], ['Job', 42], ['Psalms', 150], ['Proverbs', 31],
  ['Ecclesiastes', 12], ['Song of Solomon', 8], ['Isaiah', 66], ['Jeremiah', 52], ['Lamentations', 5],
  ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3], ['Amos', 9],
  ['Obadiah', 1], ['Jonah', 4], ['Micah', 7], ['Nahum', 3], ['Habakkuk', 3],
  ['Zephaniah', 3], ['Haggai', 2], ['Zechariah', 14], ['Malachi', 4],
  ['Matthew', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28],
  ['Romans', 16], ['1 Corinthians', 16], ['2 Corinthians', 13], ['Galatians', 6], ['Ephesians', 6],
  ['Philippians', 4], ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6],
  ['2 Timothy', 4], ['Titus', 3], ['Philemon', 1], ['Hebrews', 13], ['James', 5],
  ['1 Peter', 5], ['2 Peter', 3], ['1 John', 5], ['2 John', 1], ['3 John', 1],
  ['Jude', 1], ['Revelation', 22],
];

const INDICE_PRIMER_LIBRO_NT = 39; // Mateo

// ── USFX ────────────────────────────────────────────────────────────────────
//
// Cinco de las fuentes vienen en USFX, así que el conversor es uno solo:
//
//   <book id="GEN"><h>Génesis</h><c id="1"/><v id="1"/>texto<ve/>…
//
// Se parsea con expresiones regulares y no con un parser XML a propósito: son
// ficheros de 11-12 MB con una estructura plana y siempre la misma, y meter una
// dependencia de parseo para esto sería el único paquete del proyecto.
//
// **Las notas al pie se quitan ANTES de nada.** `<f caller="+">…</f>` va dentro
// del versículo, así que limpiando etiquetas a secas su contenido se quedaba
// pegado al texto — «Versión Biblia Libre» trae 4.492 notas y el resultado era
// un versículo con el comentario del traductor incrustado a media frase. No es
// teórico: se vio en la primera prueba.
const limpiarNotas = (xml) =>
  xml
    .replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, '')
    .replace(/<x\b[^>]*>[\s\S]*?<\/x>/g, '');

/**
 * Marcadores de versificación al FINAL de un capítulo.
 *
 * Las versiones no numeran igual. La Reina-Valera 1909 cierra Job 38 en el
 * versículo 38 y empieza el 39 con lo que otras numeran como 38:39-41, y el
 * fichero de origen lo refleja dejando `<v id="39"/><ve/>` vacíos al final del
 * capítulo — placeholders, no texto perdido.
 *
 * Se recortan sólo los del final, y a propósito: un hueco EN MEDIO sí sería
 * una descarga incompleta, y el validador tiene que seguir cazándolo. Si algún
 * día una fuente viene rota por el medio, quiero que el build falle.
 */
const recortarVaciosFinales = (versiculos) => {
  let fin = versiculos.length;
  while (fin > 0 && versiculos[fin - 1] === '') fin -= 1;
  return versiculos.slice(0, fin);
};

/**
 * Los 66 libros por su código USFX, en orden canónico.
 *
 * Hace falta porque un fichero USFX no contiene sólo los 66: «Versión Biblia
 * Libre» abre con `<book id="FRT">`, que es la introducción del traductor. Sin
 * filtrar, ese bloque entraba como libro 0 y **desplazaba la Biblia entera un
 * puesto** — Génesis salía vacío, Éxodo tenía 50 capítulos y el validador
 * escupía 1.239 problemas. Tomando sólo estos códigos y en este orden, da igual
 * lo que traiga de más la fuente: prólogos, apócrifos o glosarios.
 */
const CODIGOS_USFX = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
  '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
  'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
  'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH',
  'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS',
  '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
];

const convertirUsfx = async (respuesta) => {
  const xml = limpiarNotas(await respuesta.text());
  const porCodigo = new Map();

  const bloquesLibro = xml.split(/<book id="/).slice(1);
  for (const bloque of bloquesLibro) {
    const codigo = bloque.slice(0, bloque.indexOf('"'));
    if (!CODIGOS_USFX.includes(codigo)) continue;

    const capitulos = [];
    // El texto anterior al primer <c/> es la cabecera del libro: se descarta.
    for (const trozoCapitulo of bloque.split(/<c id="\d+"\s*\/>/).slice(1)) {
      // `[^>]*` y no `\s*`: hay fuentes que añaden atributos al marcador de
      // versículo —«Versión Biblia Libre» escribe `<v id="1" bcv="GEN.1.1" />`—
      // y con la expresión pegada al id no casaba ninguno. El síntoma era
      // desconcertante: 66 libros correctos y todos los capítulos vacíos.
      const versiculos = [...trozoCapitulo.matchAll(/<v id="[\d-]+"[^>]*\/>(.*?)<ve\s*\/>/gs)].map((m) =>
        m[1]
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim(),
      );
      capitulos.push(recortarVaciosFinales(versiculos));
    }

    // El nombre del libro, por orden de preferencia. No todas las fuentes
    // traen `<h>`: «Versión Biblia Libre» lo deja fuera en doce libros y sólo
    // pone `<toc level="1">`, así que sin la cadena de alternativas Génesis,
    // Éxodo o Isaías salían sin nombre.
    const nombre =
      bloque.match(/<h>(.*?)<\/h>/s)?.[1] ??
      bloque.match(/<toc level="1">(.*?)<\/toc>/s)?.[1] ??
      bloque.match(/<p sfm="mt"[^>]*>(.*?)<\/p>/s)?.[1] ??
      '';

    porCodigo.set(codigo, { capitulos, nombre: nombre.trim() });
  }

  return {
    libros: CODIGOS_USFX.map((c) => porCodigo.get(c)?.capitulos ?? []),
    nombres: CODIGOS_USFX.map((c) => porCodigo.get(c)?.nombre ?? ''),
  };
};

// ── Fuentes ─────────────────────────────────────────────────────────────────

const FUENTES = {
  en_kjv: {
    etiqueta: 'King James Version (inglés)',
    url: 'https://raw.githubusercontent.com/churchstudio-org/openbible/main/KJV/bible.json',
    origen: 'churchstudio-org/openbible (MIT); el texto de la KJV es de dominio público',
    // Ya viene como array[libro][capítulo][versículo]: solo hay que leerlo.
    async convertir(respuesta) {
      const libros = JSON.parse(await respuesta.text());
      return { libros, nombres: CANON.map(([n]) => n) };
    },
  },

  zh_cuv: {
    etiqueta: '和合本 Chinese Union Version (chino simplificado)',
    url: 'https://raw.githubusercontent.com/seven1m/open-bibles/master/chi-cuv-simp.usfx.xml',
    origen: 'seven1m/open-bibles; la CUV (1919) es de dominio público',
    convertir: convertirUsfx,
  },

  // ── Español: tres más, todas con licencia comprobada ─────────────────────
  //
  // Se añadieron el 17 sep 2026. Antes el español tenía UNA sola versión —la
  // Biblia en Español Sencillo, que el código llama `rvl` y que no es una
  // Reina-Valera (CLAUDE.md, trampa 4)—, así que «comparar versiones» no servía
  // de nada para quien lee en español.

  es_rv1909: {
    etiqueta: 'Reina-Valera 1909 (español)',
    url: 'https://raw.githubusercontent.com/seven1m/open-bibles/master/spa-rv1909.usfx.xml',
    origen: 'seven1m/open-bibles; la Reina-Valera 1909 es de dominio público',
    convertir: convertirUsfx,
  },

  es_vbl: {
    etiqueta: 'Versión Biblia Libre (español)',
    url: 'https://raw.githubusercontent.com/seven1m/open-bibles/master/spa-vbl.usfx.xml',
    origen: 'seven1m/open-bibles; Versión Biblia Libre, CC BY-SA 4.0',
    convertir: convertirUsfx,
    // Traducción del texto crítico: omite a propósito los versículos que no
    // están en los manuscritos más antiguos (Mateo 17:21, 18:11, 23:14…). Ver
    // `omitidos` en la validación.
    omitidos: 20,
  },

  es_pdt: {
    etiqueta: 'Palabra de Dios para ti (español)',
    url: 'https://raw.githubusercontent.com/seven1m/open-bibles/master/spa-pddpt.usfx.xml',
    origen: 'seven1m/open-bibles; Palabra de Dios para ti, CC BY-SA 4.0',
    convertir: convertirUsfx,
    omitidos: 5,
  },
};

// ── Validación ──────────────────────────────────────────────────────────────

/**
 * `omitidos` — cuántos versículos en blanco se aceptan en toda la versión.
 *
 * Un versículo vacío no siempre es una descarga rota. Las traducciones hechas
 * sobre el texto crítico **omiten a propósito** los pasajes que no están en los
 * manuscritos más antiguos (Mateo 17:21, 18:11, 23:14, Marcos 9:44…), y dejan
 * el hueco para no descolocar la numeración. Borrar el hueco desalinearía la
 * versión con las demás, y en el Modo Proyección el segundo idioma se resuelve
 * POR REFERENCIA: un desfase pondría dos versículos distintos en la pantalla de
 * la iglesia, uno debajo del otro.
 *
 * Así que se aceptan, pero contados y declarados por la fuente. El guardia
 * sigue sirviendo para lo que se puso: si una descarga se rompe, no salen tres
 * huecos, salen miles.
 */
function validar(version, libros, nombres, omitidosPermitidos = 0) {
  const problemas = [];
  const huecos = [];

  if (libros.length !== 66) problemas.push(`${libros.length} libros en vez de 66`);
  if (nombres.length !== 66) problemas.push(`${nombres.length} nombres de libro en vez de 66`);

  CANON.forEach(([nombreCanon, capsEsperados], i) => {
    const libro = libros[i];
    if (!Array.isArray(libro)) {
      problemas.push(`libro ${i} (${nombreCanon}) no es un array`);
      return;
    }
    if (libro.length !== capsEsperados) {
      problemas.push(`${nombreCanon}: ${libro.length} capítulos, se esperaban ${capsEsperados}`);
    }
    libro.forEach((cap, c) => {
      if (!Array.isArray(cap) || cap.length === 0) {
        problemas.push(`${nombreCanon} ${c + 1}: capítulo vacío`);
        return;
      }
      cap.forEach((v, indice) => {
        if (typeof v !== 'string' || v.trim() === '') {
          huecos.push(`${nombreCanon} ${c + 1}:${indice + 1}`);
        }
      });
    });
    if (!nombres[i]?.trim()) problemas.push(`libro ${i} (${nombreCanon}) sin nombre`);
  });

  if (huecos.length > omitidosPermitidos) {
    problemas.push(
      `${huecos.length} versículo(s) sin texto, se permitían ${omitidosPermitidos}: ${huecos.slice(0, 10).join(', ')}`,
    );
  } else if (huecos.length) {
    console.log(`  · ${huecos.length} versículo(s) omitidos por la traducción: ${huecos.join(', ')}`);
  }

  if (problemas.length) {
    const muestra = problemas.slice(0, 15).join('\n  ');
    throw new Error(`${version}: ${problemas.length} problema(s)\n  ${muestra}`);
  }
}

// ── Escritura ───────────────────────────────────────────────────────────────

async function generar(version) {
  const fuente = FUENTES[version];
  if (!fuente) throw new Error(`versión desconocida: ${version}`);

  console.log(`\n${version} — ${fuente.etiqueta}`);
  console.log(`  descargando ${fuente.url}`);

  const respuesta = await fetch(fuente.url);
  if (!respuesta.ok) throw new Error(`${version}: HTTP ${respuesta.status} al descargar`);

  const { libros, nombres } = await fuente.convertir(respuesta);
  validar(version, libros, nombres, fuente.omitidos || 0);

  const mapa = Object.fromEntries(nombres.map((n, i) => [String(i), n]));
  mapa.ot = Array.from({ length: INDICE_PRIMER_LIBRO_NT }, (_, i) => i);
  mapa.nt = Array.from({ length: 66 - INDICE_PRIMER_LIBRO_NT }, (_, i) => i + INDICE_PRIMER_LIBRO_NT);
  mapa.all = Array.from({ length: 66 }, (_, i) => i);

  const destino = path.join(DIR_DATOS, version);
  await mkdir(destino, { recursive: true });
  await writeFile(path.join(destino, 'bible.json'), JSON.stringify(libros));
  await writeFile(path.join(destino, 'bible.map.json'), JSON.stringify(mapa));

  const versiculos = libros.reduce((n, l) => n + l.reduce((m, c) => m + c.length, 0), 0);
  const mb = (JSON.stringify(libros).length / 1048576).toFixed(1);
  console.log(`  ✓ 66 libros · ${versiculos.toLocaleString('es')} versículos · ${mb} MB`);
  console.log(`  origen: ${fuente.origen}`);
}

const solicitadas = process.argv.slice(2);
const versiones = solicitadas.length ? solicitadas : Object.keys(FUENTES);

for (const v of versiones) {
  await generar(v);
}
console.log('\nListo. Recuerda marcar `available: true` en src/config/bible-versions.js.');
