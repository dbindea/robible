// `elegirVarias`, la selección al azar de "otras colecciones" en
// `CuratedTopic.svelte`. Antes de esto era siempre `.slice(0, 5)`: fijo, en el
// mismo orden, y las colecciones del final del JSON no se enlazaban jamás.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegirVarias } from '../src/services/curated-topics.service.js';

const LISTA = Array.from({ length: 10 }, (_, i) => ({ slug: `tema-${i}` }));

test('elegirVarias devuelve n elementos, sin repetir', () => {
  const elegidos = elegirVarias(LISTA, 5);
  assert.equal(elegidos.length, 5);
  const slugs = elegidos.map((t) => t.slug);
  assert.equal(new Set(slugs).size, 5, 'no debe repetir ningún elemento');
});

test('elegirVarias no muta la lista original', () => {
  const copia = [...LISTA];
  elegirVarias(LISTA, 5);
  assert.deepEqual(LISTA, copia);
});

test('elegirVarias no siempre da el mismo orden ni la misma selección', () => {
  // Estadístico, no criptográfico: con 10 elementos y 30 tiradas, la
  // probabilidad de que salgan siempre idénticas es astronómicamente baja.
  const resultados = new Set();
  for (let i = 0; i < 30; i += 1) {
    resultados.add(elegirVarias(LISTA, 5).map((t) => t.slug).join(','));
  }
  assert.ok(resultados.size > 1, 'siempre salió la misma selección/orden');
});

test('elegirVarias con n mayor que la lista devuelve toda la lista', () => {
  const elegidos = elegirVarias(LISTA, 50);
  assert.equal(elegidos.length, LISTA.length);
});

test('elegirVarias aguanta una lista vacía o no-array', () => {
  assert.deepEqual(elegirVarias([], 5), []);
  assert.deepEqual(elegirVarias(null, 5), []);
  assert.deepEqual(elegirVarias(undefined, 5), []);
});
