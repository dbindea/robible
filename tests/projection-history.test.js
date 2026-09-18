// El historial de versículos proyectados.
//
// Se prueba la parte pura —añadir y normalizar—, que es donde está toda la
// lógica. Lo que toca `localStorage` es una envoltura de tres líneas y ahí lo
// que se probaría es el doble, no el código.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_HISTORIAL,
  MAX_TEXTO,
  anadirEntrada,
  mismaReferencia,
  normalizarHistorial,
} from '../src/services/projection-history.service.js';

const verso = (book, chapter, verse, extra = {}) => ({
  book,
  chapter,
  verse,
  referencia: `Libro ${chapter}:${verse}`,
  texto: 'Un versículo cualquiera.',
  version: 'vdc',
  ...extra,
});

test('lo último proyectado queda lo primero', () => {
  let lista = [];
  lista = anadirEntrada(lista, verso(0, 1, 1));
  lista = anadirEntrada(lista, verso(42, 3, 16));

  assert.equal(lista.length, 2);
  assert.equal(lista[0].chapter, 3);
  assert.equal(lista[0].verse, 16);
});

test('volver a un versículo lo sube, no lo duplica', () => {
  // Es el caso para el que existe todo esto: el predicador vuelve sobre algo
  // que ya se puso. Duplicado, la lista se llenaría de la misma referencia y
  // las demás se saldrían por abajo.
  let lista = [];
  lista = anadirEntrada(lista, verso(42, 3, 16));
  lista = anadirEntrada(lista, verso(0, 1, 1));
  lista = anadirEntrada(lista, verso(42, 3, 16));

  assert.equal(lista.length, 2);
  assert.ok(mismaReferencia(lista[0], { book: 42, chapter: 3, verse: 16 }));
});

test('el mismo capítulo en otro versículo es otra entrada', () => {
  let lista = anadirEntrada([], verso(18, 23, 1));
  lista = anadirEntrada(lista, verso(18, 23, 4));
  assert.equal(lista.length, 2);
});

test('no crece sin límite', () => {
  let lista = [];
  for (let i = 1; i <= MAX_HISTORIAL + 25; i += 1) lista = anadirEntrada(lista, verso(0, 1, i));
  assert.equal(lista.length, MAX_HISTORIAL);
  // Y lo que sobra es lo más viejo, no lo más reciente.
  assert.equal(lista[0].verse, MAX_HISTORIAL + 25);
});

test('el texto se recorta: es un recordatorio, no el versículo entero', () => {
  const largo = 'a'.repeat(MAX_TEXTO + 200);
  const [entrada] = anadirEntrada([], verso(0, 1, 1, { texto: largo }));
  assert.equal(entrada.texto.length, MAX_TEXTO);
});

test('una entrada sin coordenadas no entra', () => {
  // Sin `book` no se puede volver a ella y al pintarla reventaría la columna,
  // justo al abrir la proyección.
  const lista = anadirEntrada([], { referencia: 'Ioan 3:16', texto: 'Fiindcă atât de mult…' });
  assert.equal(lista.length, 0);
});

test('lo guardado de una versión anterior se limpia al leerlo', () => {
  const crudo = [
    verso(42, 3, 16),
    { referencia: 'basura sin coordenadas' },
    null,
    { book: 1, chapter: '2', verse: 3 }, // capítulo como cadena
  ];
  const limpio = normalizarHistorial(crudo);
  assert.equal(limpio.length, 1);
  assert.equal(limpio[0].book, 42);
});

test('lo que no es una lista se lee como lista vacía', () => {
  assert.deepEqual(normalizarHistorial(null), []);
  assert.deepEqual(normalizarHistorial('{}'), []);
});

test('`anadirEntrada` no muta la lista que recibe', () => {
  // El componente asigna el resultado (`historial = anadirEntrada(historial, …)`)
  // porque así es como Svelte se entera. Si además mutara, el estado cambiaría
  // por la espalda sin repintar — el mismo fallo que tuvo el store `filter`.
  const previa = [verso(0, 1, 1)];
  const nueva = anadirEntrada(previa, verso(42, 3, 16));
  assert.equal(previa.length, 1);
  assert.equal(nueva.length, 2);
  assert.notEqual(previa, nueva);
});
