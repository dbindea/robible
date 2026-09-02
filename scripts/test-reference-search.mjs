// Test rapido del reference search service
import { searchReferences, formatReference } from '../src/services/referenceSearch.service.js';

const map = {
  0: 'Geneza',
  1: 'Exodul',
  5: 'Iosua',
  8: '1 Samuel',
  9: '2 Samuel',
  31: 'Iona',
  39: 'Matei',
  40: 'Marcu',
  41: 'Luca',
  42: 'Ioan',
  43: 'Faptele Apostolilor',
  44: 'Romani',
  45: '1 Corinteni',
  46: '2 Corinteni',
  59: '1 Petru',
  60: '2 Petru',
  61: '1 Ioan',
  62: '2 Ioan',
  63: '3 Ioan',
  64: 'Iuda',
  all: Array(66).fill(0).map((_, i) => i),
};

const tests = [
  // [input, predicate function]
  ['rom 3 5', (r) => r.length >= 1 && r[0].book === 44 && r[0].chapter === 3 && r[0].verse === 5, 'Romani 3:5'],
  ['romani 3 5', (r) => r.length >= 1 && r[0].book === 44 && r[0].chapter === 3 && r[0].verse === 5, 'Romani 3:5'],
  ['romani 3:5', (r) => r.length >= 1 && r[0].book === 44 && r[0].chapter === 3 && r[0].verse === 5, 'Romani 3:5'],
  ['rom 3.5', (r) => r.length >= 1 && r[0].book === 44 && r[0].chapter === 3 && r[0].verse === 5, 'Romani 3:5'],
  ['rom 3,5', (r) => r.length >= 1 && r[0].book === 44 && r[0].chapter === 3 && r[0].verse === 5, 'Romani 3:5'],
  ['rom 3;5', (r) => r.length >= 1 && r[0].book === 44 && r[0].chapter === 3 && r[0].verse === 5, 'Romani 3:5'],
  ['roman 3 5', (r) => r.length >= 1 && r[0].book === 44, 'Romani 3:5 (typo)'],
  ['Romani 3:5', (r) => r.length >= 1 && r[0].book === 44 && r[0].chapter === 3 && r[0].verse === 5, 'Romani 3:5 (case)'],
  ['1 ioan 2 6', (r) => r.length >= 1 && r[0].book === 61 && r[0].chapter === 2 && r[0].verse === 6, '1 Ioan 2:6'],
  ['1 ioan 2:6', (r) => r.length >= 1 && r[0].book === 61 && r[0].chapter === 2 && r[0].verse === 6, '1 Ioan 2:6'],
  ['1ioan 2 6', (r) => r.length >= 1 && r[0].book === 61 && r[0].chapter === 2 && r[0].verse === 6, '1 Ioan 2:6'],
  ['1 Ioan 2.6', (r) => r.length >= 1 && r[0].book === 61 && r[0].chapter === 2 && r[0].verse === 6, '1 Ioan 2:6'],
  ['io 1 5', (r) => r.length >= 3 && r.some(m => m.book === 42) && r.some(m => m.book === 61) && r.some(m => m.book === 62) && r.some(m => m.book === 63), 'multiples (Ioan + 1/2/3 Ioan)'],
  ['ioan 1 5', (r) => r.some(m => m.book === 42 && m.chapter === 1 && m.verse === 5), 'Ioan 1:5'],
  ['iona 1 5', (r) => r.length >= 1 && r[0].book === 31, 'Iona 1:5'],
  ['mat 5 1', (r) => r.length >= 1 && r[0].book === 39 && r[0].chapter === 5 && r[0].verse === 1, 'Matei 5:1'],
  ['matei 5 1', (r) => r.length >= 1 && r[0].book === 39, 'Matei 5:1'],
  ['1 sam 3 1', (r) => r.length >= 1 && r[0].book === 8 && r[0].chapter === 3 && r[0].verse === 1, '1 Samuel 3:1'],
  ['2 sam 3 1', (r) => r.length >= 1 && r[0].book === 9 && r[0].chapter === 3 && r[0].verse === 1, '2 Samuel 3:1'],
  ['1co 13 4', (r) => r.length >= 1 && r[0].book === 45 && r[0].chapter === 13 && r[0].verse === 4, '1 Corinteni 13:4'],
  ['geneza 1 1', (r) => r.length >= 1 && r[0].book === 0 && r[0].chapter === 1 && r[0].verse === 1, 'Geneza 1:1'],
  ['gen 1 1', (r) => r.length >= 1 && r[0].book === 0 && r[0].chapter === 1 && r[0].verse === 1, 'Geneza 1:1'],
];

let passed = 0;
let failed = 0;

for (const [input, predicate, expectedDesc] of tests) {
  const results = searchReferences(input, map, 5);
  const description = results.length === 0
    ? 'sin resultados'
    : results.map((r) => formatReference(r)).join(', ');

  const ok = predicate(results);
  if (ok) {
    passed++;
    console.log(`✓ "${input}" → ${description}`);
  } else {
    failed++;
    console.log(`✗ "${input}" → ${description} (esperado: ${expectedDesc})`);
  }
}

console.log(`\n${passed} OK, ${failed} FAIL`);
process.exit(failed > 0 ? 1 : 0);
