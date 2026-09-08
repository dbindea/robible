// Fusión de la schiță al regenerarla.
//
// Por qué existe: «Regenerează din structură» rehacía la schiță entera y se
// llevaba por delante lo que el predicador hubiera reescrito a mano. El botón
// está al lado de «Tipărește schița», así que pulsarlo sin querer costaba el
// trabajo de una tarde.
//
// Lo que se prueba aquí es la regla de las tres versiones: base (lo que generó
// la aplicación), actual (lo que hay ahora) y nueva (lo que se generaría hoy).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateOutline, mergeOutline, normalizeOutline } from '../src/services/sermon-content.service.js';

/** Preparación mínima con los puntos que se le pidan. */
const contenidoCon = (puntos) => ({
  idea: { central: 'Idea central', purpose: 'Propósito de la predicación' },
  intro: 'Apertura de la predicación.',
  conclusion: 'Cierre de la predicación.',
  structure: puntos.map((p) => ({
    id: p.id,
    title: p.title,
    subpoints: [],
    refs: [],
  })),
  development: Object.fromEntries(
    puntos.map((p) => [p.id, { explain: p.explain || 'Explicación del punto.', illustrate: '', apply: '', refs: [] }]),
  ),
});

test('una schiță recién generada trae su propia base', () => {
  const o = generateOutline(contenidoCon([{ id: 'p1', title: 'Punto uno' }]));
  assert.ok(o.base, 'sin base, la primera regeneración no podría distinguir nada');
  assert.equal(o.base.idea, o.idea);
  assert.equal(o.base.points.length, o.points.length);
});

test('lo que el predicador ha reescrito se conserva al regenerar', () => {
  const contenido = contenidoCon([{ id: 'p1', title: 'Punto uno' }]);
  const primera = generateOutline(contenido);

  // Reescribe a mano el título del punto y la idea.
  const editada = normalizeOutline(JSON.parse(JSON.stringify(primera)));
  editada.idea = 'MI PROPIA FORMULACIÓN';
  editada.points[0].title = 'MI PROPIO TÍTULO';

  const { outline, resumen } = mergeOutline(editada, generateOutline(contenido));

  assert.equal(outline.idea, 'MI PROPIA FORMULACIÓN');
  assert.equal(outline.points[0].title, 'MI PROPIO TÍTULO');
  assert.ok(resumen.conservados >= 2, `esperaba al menos 2 conservados, hubo ${resumen.conservados}`);
});

test('lo que NO se ha tocado se refresca desde la estructura', () => {
  const antes = contenidoCon([{ id: 'p1', title: 'Título viejo' }]);
  const primera = generateOutline(antes);
  const editada = normalizeOutline(JSON.parse(JSON.stringify(primera)));

  // Se cambia el título en la ESTRUCTURA, no en la schiță.
  const despues = contenidoCon([{ id: 'p1', title: 'Título nuevo' }]);
  const { outline, resumen } = mergeOutline(editada, generateOutline(despues));

  assert.equal(outline.points[0].title, 'TÍTULO NUEVO', 'debía traerse el título nuevo');
  assert.equal(resumen.conservados, 0);
  assert.ok(resumen.actualizados >= 1);
});

test('un punto nuevo en la estructura se añade sin tocar los demás', () => {
  const antes = contenidoCon([{ id: 'p1', title: 'Punto uno' }]);
  const editada = normalizeOutline(JSON.parse(JSON.stringify(generateOutline(antes))));
  editada.points[0].title = 'MI TÍTULO';

  const despues = contenidoCon([
    { id: 'p1', title: 'Punto uno' },
    { id: 'p2', title: 'Punto dos' },
  ]);
  const { outline, resumen } = mergeOutline(editada, generateOutline(despues));

  assert.equal(outline.points.length, 2);
  assert.equal(outline.points[0].title, 'MI TÍTULO', 'el punto viejo no se toca');
  assert.equal(resumen.nuevos, 1);
});

test('un punto borrado de la estructura sale de la schiță y se cuenta', () => {
  const antes = contenidoCon([
    { id: 'p1', title: 'Punto uno' },
    { id: 'p2', title: 'Punto dos' },
  ]);
  const editada = normalizeOutline(JSON.parse(JSON.stringify(generateOutline(antes))));
  editada.points[1].title = 'ESCRITO A MANO';

  const despues = contenidoCon([{ id: 'p1', title: 'Punto uno' }]);
  const { outline, resumen } = mergeOutline(editada, generateOutline(despues));

  assert.equal(outline.points.length, 1);
  assert.equal(resumen.eliminados, 1, 'hay que poder avisar de lo que se ha quitado');
});

test('el orden lo manda la estructura, no la schiță', () => {
  const antes = contenidoCon([
    { id: 'p1', title: 'Primero' },
    { id: 'p2', title: 'Segundo' },
  ]);
  const editada = normalizeOutline(JSON.parse(JSON.stringify(generateOutline(antes))));

  const despues = contenidoCon([
    { id: 'p2', title: 'Segundo' },
    { id: 'p1', title: 'Primero' },
  ]);
  const { outline } = mergeOutline(editada, generateOutline(despues));

  assert.deepEqual(outline.points.map((p) => p.id), ['p2', 'p1']);
});

test('una schiță anterior a la fusión (sin base) no se pisa nunca', () => {
  const contenido = contenidoCon([{ id: 'p1', title: 'Punto uno' }]);
  // Como las guardadas antes de que existiera `base`.
  const vieja = normalizeOutline({
    idea: 'ESCRITA A MANO HACE MESES',
    intro: [],
    points: [{ id: 'p1', title: 'TÍTULO SUYO', keywords: ['clave suya'], refs: [] }],
    application: '',
    conclusion: '',
  });
  assert.equal(vieja.base, null);

  const { outline } = mergeOutline(vieja, generateOutline(contenido));

  assert.equal(outline.idea, 'ESCRITA A MANO HACE MESES');
  assert.equal(outline.points[0].title, 'TÍTULO SUYO');
  assert.deepEqual(outline.points[0].keywords, ['clave suya']);
  // Los huecos vacíos sí se rellenan: ahí no hay nada que perder.
  assert.ok(outline.application.length > 0, 'un campo vacío sí puede completarse');
  // Y a partir de ahora ya hay base para la próxima vez.
  assert.ok(outline.base);
});

test('regenerar dos veces seguidas sin tocar nada no cambia la schiță', () => {
  const contenido = contenidoCon([{ id: 'p1', title: 'Punto uno' }]);
  const primera = normalizeOutline(JSON.parse(JSON.stringify(generateOutline(contenido))));

  const una = mergeOutline(primera, generateOutline(contenido));
  const dos = mergeOutline(una.outline, generateOutline(contenido));

  assert.deepEqual(dos.outline, una.outline, 'la fusión tiene que ser estable');
  assert.equal(dos.resumen.conservados, 0);
  assert.equal(dos.resumen.nuevos, 0);
  assert.equal(dos.resumen.eliminados, 0);
});

test('la fusión no pierde las palabras clave escritas a mano', () => {
  const contenido = contenidoCon([{ id: 'p1', title: 'Punto uno', explain: 'Una explicación cualquiera.' }]);
  const editada = normalizeOutline(JSON.parse(JSON.stringify(generateOutline(contenido))));
  editada.points[0].keywords = ['mía uno', 'mía dos', 'mía tres'];

  const { outline } = mergeOutline(editada, generateOutline(contenido));

  assert.deepEqual(outline.points[0].keywords, ['mía uno', 'mía dos', 'mía tres']);
});
