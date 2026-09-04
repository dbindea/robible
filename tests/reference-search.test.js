// Búsqueda por referencia: "rom 3 5", "1 ioan 2:6", "gen 1.1"…
//
// Sustituye a scripts/test-reference-search.mjs, que hacía las mismas
// comprobaciones pero imprimiendo y llamando a process.exit: no se podía
// integrar con el resto de la suite ni decía qué había fallado exactamente.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchReferences, formatReference, parseReference } from '../src/services/referenceSearch.service.js';

const MAPA = {
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
  all: Array.from({ length: 66 }, (_, i) => i),
};

const buscar = (texto) => searchReferences(texto, MAPA, 5);

/** Comprueba que el primer resultado es exactamente ese libro/capítulo/versículo. */
function primerResultado(entrada, book, chapter, verse) {
  const r = buscar(entrada);
  assert.ok(r.length >= 1, `"${entrada}" no devolvió resultados`);
  const encontrado = `${r[0].book}:${r[0].chapter}:${r[0].verse}`;
  assert.equal(encontrado, `${book}:${chapter}:${verse}`, `"${entrada}" → ${formatReference(r[0])}`);
}

test('acepta los distintos separadores entre capítulo y versículo', () => {
  // Espacio, dos puntos, punto, coma y punto y coma: la gente escribe de todo.
  for (const entrada of ['rom 3 5', 'rom 3:5', 'rom 3.5', 'rom 3,5', 'rom 3;5']) {
    primerResultado(entrada, 44, 3, 5);
  }
});

test('acepta el nombre abreviado y completo, con y sin mayúsculas', () => {
  primerResultado('rom 3 5', 44, 3, 5);
  primerResultado('romani 3 5', 44, 3, 5);
  primerResultado('Romani 3:5', 44, 3, 5);
  primerResultado('ROMANI 3 5', 44, 3, 5);
});

test('tolera erratas en el nombre del libro', () => {
  // Distancia de Levenshtein: "roman" por "romani".
  const r = buscar('roman 3 5');
  assert.ok(r.length >= 1 && r[0].book === 44, 'debería reconocer "roman" como Romani');
});

test('distingue los libros numerados', () => {
  primerResultado('1 ioan 2 6', 61, 2, 6);
  primerResultado('1ioan 2 6', 61, 2, 6);
  primerResultado('1 Ioan 2.6', 61, 2, 6);
  primerResultado('1 sam 3 1', 8, 3, 1);
  primerResultado('2 sam 3 1', 9, 3, 1);
  primerResultado('1co 13 4', 45, 13, 4);
});

test('una entrada ambigua devuelve varios candidatos', () => {
  // "io" encaja con Ioan y con 1/2/3 Ioan: hay que ofrecerlos todos, no elegir.
  const r = buscar('io 1 5');
  const libros = new Set(r.map((m) => m.book));
  for (const esperado of [42, 61, 62, 63]) {
    assert.ok(libros.has(esperado), `falta el libro ${esperado} (${MAPA[esperado]}) entre los candidatos`);
  }
});

test('no confunde libros de nombre parecido', () => {
  // Ioan e Iona se diferencian en una letra.
  primerResultado('iona 1 5', 31, 1, 5);
  const ioan = buscar('ioan 1 5');
  assert.ok(ioan.some((m) => m.book === 42 && m.chapter === 1 && m.verse === 5));
});

test('Génesis, el libro 0, se encuentra igual que los demás', () => {
  // El índice 0 es falsy: una comprobación descuidada lo dejaría fuera.
  primerResultado('geneza 1 1', 0, 1, 1);
  primerResultado('gen 1 1', 0, 1, 1);
});

test('acepta la referencia sin versículo o sin capítulo', () => {
  const soloCapitulo = buscar('ioan 3');
  assert.ok(soloCapitulo.length >= 1);
  assert.equal(soloCapitulo[0].chapter, 3);

  const soloLibro = buscar('ioan');
  assert.ok(soloLibro.length >= 1);
  assert.equal(soloLibro[0].book, 42);
});

test('no inventa resultados con texto que no es una referencia', () => {
  for (const entrada of ['', '   ', 'xyzzy 1 1']) {
    assert.equal(buscar(entrada).length, 0, `"${entrada}" no debería encontrar nada`);
  }
});

test('formatReference escribe la referencia en forma legible', () => {
  const [m] = buscar('romani 3 5');
  assert.equal(formatReference(m), 'Romani 3:5');

  const [soloCapitulo] = buscar('romani 3');
  assert.equal(formatReference(soloCapitulo), 'Romani 3');

  assert.equal(formatReference(null), '');
});

test('parseReference resuelve solo cuando la referencia es inequívoca', () => {
  // Este es su contrato: la Sidebar navega directa cuando devuelve algo, así
  // que devolver un candidato cualquiera ante una entrada ambigua llevaría al
  // usuario a un versículo que no ha pedido.
  const claro = parseReference('romani 3 5', MAPA);
  assert.equal(claro?.book, 44);
  assert.equal(claro?.chapter, 3);
  assert.equal(claro?.verse, 5);

  // "ioan" también encaja con 1/2/3 Ioan → ambigua, no debe resolver.
  assert.equal(parseReference('ioan 3 16', MAPA), null, 'una entrada ambigua no debe navegar sola');
  // Sin versículo tampoco: hace falta la referencia completa.
  assert.equal(parseReference('romani 3', MAPA), null);
  assert.equal(parseReference('xyzzy 1 1', MAPA), null);
});

test('respeta el número máximo de resultados', () => {
  assert.ok(searchReferences('io', MAPA, 2).length <= 2);
});
