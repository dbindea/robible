// El service worker elige el versículo del día por su cuenta.
//
// Tiene que hacerlo: cuando llega el push la aplicación está cerrada, y un
// service worker clásico no comparte módulos con el bundle. Así que la
// aritmética de daily-verse.service.js está **copiada** dentro de public/sw.js.
//
// Una copia que nadie compara se separa del original. Y el síntoma sería de los
// peores: la notificación anuncia un versículo y, al tocarla, la aplicación
// abre otro distinto. Este test extrae la función del service worker y la
// compara con la de verdad, día a día, durante más de un año.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { dayNumber, pickVerseForDate } from '../src/services/daily-verse.service.js';

const RAIZ = path.join(import.meta.dirname, '..');
const sw = readFileSync(path.join(RAIZ, 'public', 'sw.js'), 'utf8');

// Se extrae por el nombre, que es un ancla estable: si alguien la renombra, el
// test falla y eso también es información.
const extraer = (nombre) => {
  const m = sw.match(new RegExp(`const ${nombre} = ([^;]+);`));
  assert.ok(m, `public/sw.js ya no define ${nombre}`);
  return new Function(`return ${m[1]}`)();
};

test('public/sw.js sigue definiendo su propio cálculo del día', () => {
  assert.ok(sw.includes('numeroDeDia'), 'falta numeroDeDia en el service worker');
  assert.ok(sw.includes('daily-verses.json'), 'el service worker ya no lee la lista de versículos');
});

test('el número de día del service worker coincide con el de la aplicación', () => {
  const numeroDeDia = extraer('numeroDeDia');

  // Se recorre más de un año e incluye los dos cambios de hora de Europa, que
  // es donde este cálculo se rompería si alguien usara el timestamp local en
  // lugar de Date.UTC.
  const inicio = new Date('2026-01-01T12:00:00');
  for (let i = 0; i < 400; i += 1) {
    const fecha = new Date(inicio.getTime() + i * 86400000);
    assert.equal(
      numeroDeDia(fecha),
      dayNumber(fecha),
      `discrepancia el ${fecha.toISOString().slice(0, 10)}`,
    );
  }
});

test('los dos eligen el mismo versículo de la lista real', () => {
  const numeroDeDia = extraer('numeroDeDia');
  const datos = JSON.parse(readFileSync(path.join(RAIZ, 'public', 'data', 'daily-verses.json'), 'utf8'));
  const lista = datos.verses;

  const inicio = new Date('2026-03-01T12:00:00');
  for (let i = 0; i < 400; i += 1) {
    const fecha = new Date(inicio.getTime() + i * 86400000);

    // Réplica exacta de la indexación del service worker.
    const n = numeroDeDia(fecha);
    const delSw = lista[((n % lista.length) + lista.length) % lista.length];
    const deLaApp = pickVerseForDate(lista, fecha);

    assert.deepEqual(
      delSw,
      deLaApp,
      `el ${fecha.toISOString().slice(0, 10)} la notificación y la aplicación no coinciden`,
    );
  }
});

test('el cambio de horario de verano no salta un día', () => {
  const numeroDeDia = extraer('numeroDeDia');
  // Último domingo de marzo y de octubre de 2026: los dos saltos europeos.
  for (const dia of ['2026-03-29', '2026-10-25']) {
    const antes = numeroDeDia(new Date(`${dia}T01:00:00`));
    const despues = numeroDeDia(new Date(`${dia}T23:00:00`));
    assert.equal(antes, despues, `el ${dia} el número de día cambia dentro del mismo día`);
  }
});
