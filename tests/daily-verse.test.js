// Versículo del día: la elección tiene que ser determinista por fecha local.
//
// Por qué importa: si el índice dependiese del reloj y no del calendario, el
// versículo cambiaría al recargar la página a medianoche o al cruzar el cambio
// de hora, y los dos dispositivos del mismo usuario verían cosas distintas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { dateKey, dayNumber, pickVerseForDate } from '../src/services/daily-verse.service.js';

const LISTA = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'public', 'data', 'daily-verses.json'), 'utf8'),
);

test('dateKey usa la fecha local en formato YYYY-MM-DD', () => {
  assert.equal(dateKey(new Date(2026, 8, 5)), '2026-09-05');
  assert.equal(dateKey(new Date(2026, 0, 1)), '2026-01-01');
  assert.equal(dateKey(new Date(2026, 11, 31)), '2026-12-31');
});

test('dayNumber avanza de uno en uno por día natural', () => {
  const hoy = dayNumber(new Date(2026, 8, 5));
  assert.equal(dayNumber(new Date(2026, 8, 6)), hoy + 1);
  assert.equal(dayNumber(new Date(2026, 8, 4)), hoy - 1);
});

test('dayNumber ignora la hora del día', () => {
  // Las dos son el mismo día natural: si contásemos con el timestamp local, la
  // de las 23:59 caería en el día siguiente en cuanto hubiese offset horario.
  assert.equal(
    dayNumber(new Date(2026, 8, 5, 0, 1)),
    dayNumber(new Date(2026, 8, 5, 23, 59)),
  );
});

test('el mismo día devuelve siempre el mismo versículo', () => {
  const a = pickVerseForDate(LISTA.verses, new Date(2026, 8, 5, 7, 0));
  const b = pickVerseForDate(LISTA.verses, new Date(2026, 8, 5, 22, 30));
  assert.deepEqual(a, b);
});

test('días consecutivos devuelven versículos distintos', () => {
  const a = pickVerseForDate(LISTA.verses, new Date(2026, 8, 5));
  const b = pickVerseForDate(LISTA.verses, new Date(2026, 8, 6));
  assert.notDeepEqual(a, b);
});

test('recorre toda la lista antes de repetir', () => {
  const vistos = new Set();
  const inicio = new Date(2026, 0, 1);
  for (let i = 0; i < LISTA.verses.length; i++) {
    const fecha = new Date(2026, 0, 1 + i);
    const ref = pickVerseForDate(LISTA.verses, fecha);
    vistos.add(`${ref.book}:${ref.chapter}:${ref.verse}`);
  }
  assert.equal(vistos.size, LISTA.verses.length, 'debería cubrir la lista entera sin repetir');
  assert.ok(inicio instanceof Date);
});

test('una lista vacía o inválida no revienta', () => {
  assert.equal(pickVerseForDate([], new Date()), null);
  assert.equal(pickVerseForDate(null, new Date()), null);
  assert.equal(pickVerseForDate(undefined, new Date()), null);
});

test('la lista generada tiene referencias bien formadas', () => {
  assert.ok(LISTA.verses.length > 100, 'pocas referencias para rotar un año');
  for (const ref of LISTA.verses) {
    assert.ok(Number.isInteger(ref.book) && ref.book >= 0 && ref.book <= 65, `libro fuera de rango: ${ref.book}`);
    assert.ok(Number.isInteger(ref.chapter) && ref.chapter >= 1, `capítulo inválido: ${ref.chapter}`);
    assert.ok(Number.isInteger(ref.verse) && ref.verse >= 1, `versículo inválido: ${ref.verse}`);
  }
});

test('no hay referencias duplicadas', () => {
  const claves = LISTA.verses.map((r) => `${r.book}:${r.chapter}:${r.verse}`);
  assert.equal(new Set(claves).size, claves.length);
});
