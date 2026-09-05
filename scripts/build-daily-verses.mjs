// Genera public/data/daily-verses.json: la lista de referencias que rota el
// "versículo del día".
//
// Por qué un script y no un JSON escrito a mano: las referencias hay que
// validarlas contra TODAS las versiones instaladas. Un versículo que existe en
// la Cornilescu pero se sale del rango en la española dejaría la app sin nada
// que mostrar ese día, y el fallo aparecería meses después.
//
// Uso: node scripts/build-daily-verses.mjs
//
// La lista se guarda barajada con una semilla fija: la app elige por día del
// calendario (índice = días desde epoch % longitud), así que si el orden fuese
// el canónico saldrían cinco Génesis seguidos.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..');
const DIR_DATA = path.join(RAIZ, 'public', 'data');
const SALIDA = path.join(DIR_DATA, 'daily-verses.json');
const SEMILLA = 20260905;

// ── Referencias [libro (0-65), capítulo (1), versículo (1)] ──────────────
// Criterio: versículos conocidos, memorizables y que se sostienen fuera de su
// contexto inmediato. Repartidos por toda la Biblia, no solo Salmos y Juan.
const REFERENCIAS = [
  [0, 1, 1], [0, 1, 27], [0, 8, 22], [0, 12, 2], [0, 28, 15], [0, 50, 20],
  [1, 14, 14], [1, 15, 2], [1, 20, 12], [1, 33, 14],
  [2, 19, 18],
  [3, 6, 24], [3, 23, 19],
  [4, 6, 5], [4, 8, 3], [4, 31, 6], [4, 31, 8],
  [5, 1, 9], [5, 24, 15],
  [6, 6, 12],
  [7, 1, 16],
  [8, 12, 24], [8, 16, 7],
  [9, 22, 31],
  [10, 8, 23],
  [11, 6, 16],
  [12, 16, 11], [12, 29, 11],
  [13, 7, 14], [13, 20, 15],
  [14, 8, 22],
  [15, 8, 10],
  [16, 4, 14],
  [17, 19, 25], [17, 23, 10], [17, 42, 2],
  [18, 1, 1], [18, 16, 8], [18, 18, 2], [18, 19, 1], [18, 19, 14],
  [18, 23, 1], [18, 23, 4], [18, 27, 1], [18, 27, 14], [18, 32, 8],
  [18, 34, 8], [18, 34, 18], [18, 37, 4], [18, 37, 5], [18, 42, 1],
  [18, 46, 1], [18, 46, 10], [18, 51, 10], [18, 55, 22], [18, 56, 3],
  [18, 62, 1], [18, 71, 5], [18, 73, 26], [18, 84, 11], [18, 90, 12],
  [18, 91, 1], [18, 91, 11], [18, 94, 19], [18, 100, 4], [18, 103, 2],
  [18, 103, 12], [18, 118, 24], [18, 119, 105], [18, 121, 1], [18, 121, 2],
  [18, 126, 3], [18, 127, 1], [18, 133, 1], [18, 136, 1], [18, 139, 14],
  [18, 143, 8], [18, 145, 18], [18, 147, 3], [18, 150, 6],
  [19, 3, 5], [19, 3, 6], [19, 4, 23], [19, 11, 25], [19, 15, 1],
  [19, 16, 3], [19, 16, 9], [19, 17, 17], [19, 18, 10], [19, 22, 6],
  [19, 27, 17], [19, 31, 25],
  [20, 3, 1], [20, 3, 11], [20, 4, 9], [20, 12, 13],
  [21, 8, 7],
  [22, 6, 8], [22, 9, 6], [22, 26, 3], [22, 30, 21], [22, 40, 8],
  [22, 40, 29], [22, 40, 31], [22, 41, 10], [22, 41, 13], [22, 43, 2],
  [22, 43, 19], [22, 53, 5], [22, 54, 10], [22, 55, 8], [22, 55, 11],
  [22, 58, 11], [22, 61, 1],
  [23, 1, 5], [23, 17, 7], [23, 29, 11], [23, 29, 13], [23, 31, 3],
  [23, 32, 17], [23, 33, 3],
  [24, 3, 22], [24, 3, 23], [24, 3, 25],
  [25, 36, 26],
  [26, 2, 20], [26, 3, 17],
  [27, 6, 3],
  [28, 2, 13],
  [29, 5, 24],
  [30, 1, 15],
  [31, 2, 2],
  [32, 6, 8], [32, 7, 7],
  [33, 1, 7],
  [34, 2, 4], [34, 3, 19],
  [35, 3, 17],
  [36, 2, 9],
  [37, 4, 6],
  [38, 3, 10],
  [39, 5, 9], [39, 5, 14], [39, 5, 16], [39, 6, 21], [39, 6, 26],
  [39, 6, 33], [39, 7, 7], [39, 7, 12], [39, 11, 28], [39, 11, 29],
  [39, 16, 26], [39, 18, 20], [39, 19, 26], [39, 22, 37], [39, 22, 39],
  [39, 28, 19], [39, 28, 20],
  [40, 9, 23], [40, 10, 27], [40, 11, 24], [40, 12, 30], [40, 16, 15],
  [41, 1, 37], [41, 6, 31], [41, 6, 38], [41, 11, 9], [41, 12, 34], [41, 18, 27],
  [42, 1, 1], [42, 1, 12], [42, 3, 16], [42, 3, 17], [42, 8, 12],
  [42, 8, 32], [42, 10, 10], [42, 11, 25], [42, 13, 34], [42, 14, 1],
  [42, 14, 6], [42, 14, 27], [42, 15, 5], [42, 15, 13], [42, 16, 33],
  [43, 1, 8], [43, 2, 38], [43, 4, 12], [43, 16, 31], [43, 20, 35],
  [44, 1, 16], [44, 5, 8], [44, 6, 23], [44, 8, 1], [44, 8, 18],
  [44, 8, 28], [44, 8, 31], [44, 8, 38], [44, 10, 9], [44, 12, 2],
  [44, 12, 12], [44, 12, 21], [44, 15, 13],
  [45, 1, 9], [45, 2, 9], [45, 10, 13], [45, 13, 4], [45, 13, 13],
  [45, 15, 58], [45, 16, 14],
  [46, 1, 3], [46, 4, 16], [46, 4, 18], [46, 5, 7], [46, 5, 17],
  [46, 9, 7], [46, 12, 9],
  [47, 2, 20], [47, 5, 22], [47, 6, 9],
  [48, 2, 8], [48, 2, 10], [48, 3, 20], [48, 4, 32], [48, 6, 10],
  [49, 1, 6], [49, 2, 3], [49, 3, 14], [49, 4, 4], [49, 4, 6],
  [49, 4, 7], [49, 4, 8], [49, 4, 13], [49, 4, 19],
  [50, 3, 2], [50, 3, 12], [50, 3, 15], [50, 3, 23],
  [51, 5, 11], [51, 5, 16], [51, 5, 17], [51, 5, 18],
  [52, 3, 3],
  [53, 4, 12], [53, 6, 6],
  [54, 1, 7], [54, 3, 16],
  [55, 3, 5],
  [56, 1, 6],
  [57, 4, 12], [57, 4, 16], [57, 10, 23], [57, 11, 1], [57, 12, 1],
  [57, 12, 2], [57, 13, 5], [57, 13, 8],
  [58, 1, 2], [58, 1, 5], [58, 1, 12], [58, 1, 17], [58, 4, 8], [58, 5, 16],
  [59, 2, 9], [59, 3, 15], [59, 4, 10], [59, 5, 6], [59, 5, 7],
  [60, 1, 3], [60, 3, 9],
  [61, 1, 9], [61, 3, 1], [61, 4, 4], [61, 4, 7], [61, 4, 18],
  [61, 4, 19], [61, 5, 14],
  [62, 1, 6],
  [63, 1, 4],
  [64, 1, 24],
  [65, 1, 8], [65, 3, 20], [65, 21, 4], [65, 22, 13],
];

// ── PRNG con semilla (mulberry32) ───────────────────────
// Necesitamos que el barajado sea reproducible: si cada build reordenase la
// lista, el versículo de hoy cambiaría con cada despliegue.
const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const barajar = (lista, semilla) => {
  const rnd = mulberry32(semilla);
  const out = [...lista];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// ── Validación contra cada versión instalada ────────────
const versionesInstaladas = readdirSync(DIR_DATA, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(path.join(DIR_DATA, d.name, 'bible.json')))
  .map((d) => d.name);

if (!versionesInstaladas.length) {
  console.error('No hay ninguna versión bíblica en public/data/. Nada que validar.');
  process.exit(1);
}

const problemas = [];

for (const version of versionesInstaladas) {
  const biblia = JSON.parse(readFileSync(path.join(DIR_DATA, version, 'bible.json'), 'utf8'));
  const mapa = JSON.parse(readFileSync(path.join(DIR_DATA, version, 'bible.map.json'), 'utf8'));

  for (const [libro, capitulo, versiculo] of REFERENCIAS) {
    const texto = biblia[libro]?.[capitulo - 1]?.[versiculo - 1];
    if (typeof texto !== 'string' || !texto.trim()) {
      problemas.push(`${version}: ${mapa[libro] || libro} ${capitulo}:${versiculo} no existe`);
    }
  }
}

// Duplicados: una referencia repetida saldría dos veces en el mismo ciclo.
const vistas = new Set();
for (const [l, c, v] of REFERENCIAS) {
  const clave = `${l}:${c}:${v}`;
  if (vistas.has(clave)) problemas.push(`referencia duplicada: ${clave}`);
  vistas.add(clave);
}

if (problemas.length) {
  console.error(`\n  ${problemas.length} problema(s):\n`);
  for (const p of problemas) console.error(`    - ${p}`);
  process.exit(1);
}

const barajadas = barajar(REFERENCIAS, SEMILLA).map(([book, chapter, verse]) => ({ book, chapter, verse }));

writeFileSync(
  SALIDA,
  `${JSON.stringify({ version: 1, seed: SEMILLA, verses: barajadas })}\n`,
  'utf8',
);

console.log(`\n  daily-verses.json generado`);
console.log(`  ─────────────────────────`);
console.log(`  Referencias:  ${REFERENCIAS.length}`);
console.log(`  Validadas en: ${versionesInstaladas.join(', ')}`);
console.log(`  Salida:       ${path.relative(RAIZ, SALIDA)}\n`);
