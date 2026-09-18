// Búsqueda por referencia: "rom 3 5", "1 ioan 2:6", "gen 1.1"…
//
// Sustituye a scripts/test-reference-search.mjs, que hacía las mismas
// comprobaciones pero imprimiendo y llamando a process.exit: no se podía
// integrar con el resto de la suite ni decía qué había fallado exactamente.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  searchReferences,
  formatReference,
  parseReference,
  referenceExists,
} from '../src/services/referenceSearch.service.js';

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
  //
  // Se pide un límite alto a propósito. Con el corte por defecto de 5 esta
  // comprobación medía dos cosas a la vez —qué empareja y qué se trunca— y se
  // rompía sola: al aceptar prefijos de 2 letras contra nombres largos, "io"
  // pasó a encontrar también Iosua y algún miembro de la familia Ioan quedaba
  // fuera del top 5. Lo que importa aquí es el emparejamiento; del truncado se
  // encarga "respeta el número máximo de resultados".
  const r = searchReferences('io 1 5', MAPA, 20);
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

// ── Abreviaturas sobre el mapa real ─────────────────────────────────────────
//
// Estas comprobaciones usan el bible.map.json de producción y no el mapa de
// juguete de arriba, porque el fallo que cubren dependía de la longitud de los
// nombres reales: `isPlausiblePrefix` descartaba un prefijo cuando el nombre
// del libro era más de 4 caracteres más largo que lo escrito. Con nombres
// cortos no se notaba; con "Proverbele" o "Faptele Apostolilor", sí.
//
// El síntoma era que `prov 3 4` no devolvía absolutamente nada.

const MAPA_REAL = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'public', 'data', 'vdc', 'bible.map.json'), 'utf8'),
);

const buscarReal = (texto, max = 5) => searchReferences(texto, MAPA_REAL, max);

test('las abreviaturas habituales encuentran su libro', () => {
  const esperado = {
    prov: 'Proverbele',
    deut: 'Deuteronomul',
    apoc: 'Apocalipsa',
    ecl: 'Eclesiastul',
    gal: 'Galateni',
    judec: 'Judecătorii',
    fapte: 'Faptele Apostolilor',
    plang: 'Plângerile lui Ieremia',
    efes: 'Efeseni',
    filip: 'Filipeni',
    colos: 'Coloseni',
    ps: 'Psalmii',
  };
  for (const [abreviatura, libro] of Object.entries(esperado)) {
    const r = buscarReal(abreviatura);
    assert.ok(r.length >= 1, `"${abreviatura}" no devolvió nada`);
    assert.equal(r[0].name, libro, `"${abreviatura}" → ${r[0].name}, se esperaba ${libro}`);
  }
});

test('prov 3 4 resuelve a Proverbele 3:4', () => {
  // El ejemplo exacto de la especificación, y el que estaba roto.
  for (const entrada of ['prov 3 4', 'prov 3:4', 'Prov 3:4', 'proverbe 3:4']) {
    const r = buscarReal(entrada);
    assert.ok(r.length >= 1, `"${entrada}" no devolvió nada`);
    assert.equal(r[0].name, 'Proverbele');
    assert.equal(r[0].chapter, 3);
    assert.equal(r[0].verse, 4);
  }
});

test('una sola letra no empareja media Biblia', () => {
  // Sin esta guarda, "i" devolvía 14 libros y la lista era inservible.
  assert.equal(buscarReal('a').length, 0);
  assert.equal(buscarReal('x').length, 0);
});

test('nunca se devuelven más de 5 sugerencias', () => {
  // La interfaz muestra como mucho 5: el usuario afina, no elige entre veinte.
  for (const entrada of ['i', 'io', 'ioan', '1', 'ps']) {
    assert.ok(buscarReal(entrada).length <= 5, `"${entrada}" devolvió demasiadas`);
  }
});

// ── Referencias que no existen ──────────────────────────────────────────────
//
// El nombre del libro lo valida el mapa; el capítulo y el versículo no los
// validaba nadie. «ioan 4 4» ofrecía las cuatro combinaciones —Ioan, 1, 2 y
// 3 Ioan— y dos de ellas son imposibles: 2 Ioan y 3 Ioan tienen UN capítulo.
// En el Modo Proyección se pulsa con prisa y delante de la congregación, así
// que una sugerencia que no lleva a ninguna parte es peor que una de menos.

const BIBLIA_REAL = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'public', 'data', 'vdc', 'bible.json'), 'utf8'),
);

test('sin Biblia no se filtra nada: es el comportamiento de siempre', () => {
  // Mientras la Biblia se descarga, `bible` llega vacía. Quedarse sin
  // sugerencias sería peor que enseñar alguna de más.
  const r = searchReferences('ioan 4 4', MAPA_REAL, 6);
  assert.ok(
    r.some((m) => m.name === '3 Ioan'),
    'sin Biblia, el filtro no debe actuar',
  );
});

test('con la Biblia delante, 2 Ioan 4:4 y 3 Ioan 4:4 desaparecen', () => {
  const r = searchReferences('ioan 4 4', MAPA_REAL, 6, BIBLIA_REAL);
  const nombres = r.map((m) => m.name);
  assert.ok(nombres.includes('Ioan'), 'Ioan 4:4 sí existe');
  assert.ok(nombres.includes('1 Ioan'), '1 Ioan 4:4 sí existe');
  assert.ok(!nombres.includes('2 Ioan'), '2 Ioan tiene un solo capítulo');
  assert.ok(!nombres.includes('3 Ioan'), '3 Ioan tiene un solo capítulo');
});

test('un versículo que se sale del capítulo tampoco se sugiere', () => {
  // Psalmul 23 tiene 6 versículos.
  const bueno = searchReferences('psalmii 23 6', MAPA_REAL, 6, BIBLIA_REAL);
  assert.ok(bueno.length >= 1);
  const malo = searchReferences('psalmii 23 40', MAPA_REAL, 6, BIBLIA_REAL);
  assert.equal(malo.length, 0);
});

test('un capítulo que no existe tampoco', () => {
  const malo = searchReferences('iuda 5 1', MAPA_REAL, 6, BIBLIA_REAL);
  assert.equal(malo.length, 0, 'Iuda tiene un solo capítulo');
});

test('el filtro no se come las sugerencias buenas por el corte de maxResults', () => {
  // El corte a `maxResults` es lo primero que se hace, así que si el filtro
  // fuera posterior las combinaciones imposibles se comerían el sitio de las
  // buenas: con maxResults=2, «ioan 4 4» habría devuelto lista vacía.
  const r = searchReferences('ioan 4 4', MAPA_REAL, 2, BIBLIA_REAL);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((m) => m.name).sort(), ['1 Ioan', 'Ioan']);
});

test('referenceExists distingue libro, capítulo y versículo', () => {
  // `map.all` son índices, no nombres: los nombres están en `map[i]`.
  const ioan = MAPA_REAL.all.find((i) => MAPA_REAL[i] === 'Ioan');
  assert.ok(referenceExists(BIBLIA_REAL, ioan, 3, 16));
  assert.ok(referenceExists(BIBLIA_REAL, ioan, 3, null), 'sin versículo basta con que exista el capítulo');
  assert.ok(referenceExists(BIBLIA_REAL, ioan, null, null), 'sin capítulo basta con que exista el libro');
  assert.ok(!referenceExists(BIBLIA_REAL, ioan, 99, 1));
  assert.ok(!referenceExists(BIBLIA_REAL, ioan, 3, 999));
  assert.ok(!referenceExists(BIBLIA_REAL, 999, 1, 1));
  assert.ok(!referenceExists([], ioan, 3, 16), 'sin Biblia, nada existe');
});
