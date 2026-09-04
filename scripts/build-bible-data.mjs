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
    // USFX: <book id="GEN"><h>创世纪</h><c id="1"/><v id="1"/>texto<ve/>…
    // El archivo solo usa las etiquetas book/h/c/v/ve, sin marcado anidado ni
    // notas al pie, así que un parseo por expresiones regulares es fiable aquí.
    async convertir(respuesta) {
      const xml = await respuesta.text();
      const libros = [];
      const nombres = [];

      const bloquesLibro = xml.split(/<book id="/).slice(1);
      for (const bloque of bloquesLibro) {
        nombres.push(bloque.match(/<h>(.*?)<\/h>/s)?.[1].trim() ?? '');

        const capitulos = [];
        // El texto anterior al primer <c/> es la cabecera del libro: se descarta.
        for (const trozoCapitulo of bloque.split(/<c id="\d+"\s*\/>/).slice(1)) {
          const versiculos = [...trozoCapitulo.matchAll(/<v id="[\d-]+"\s*\/>(.*?)<ve\s*\/>/gs)].map((m) =>
            m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
          );
          capitulos.push(versiculos);
        }
        libros.push(capitulos);
      }

      return { libros, nombres };
    },
  },
};

// ── Validación ──────────────────────────────────────────────────────────────

function validar(version, libros, nombres) {
  const problemas = [];

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
      const vacios = cap.filter((v) => typeof v !== 'string' || v.trim() === '').length;
      if (vacios) problemas.push(`${nombreCanon} ${c + 1}: ${vacios} versículo(s) sin texto`);
    });
    if (!nombres[i]?.trim()) problemas.push(`libro ${i} (${nombreCanon}) sin nombre`);
  });

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
  validar(version, libros, nombres);

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
