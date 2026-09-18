// Preferencias del Modo Proyección: ocupación de pantalla y geometría.
//
// La parte pura. Lo que toca `localStorage` cae en la rama de «sin window» al
// correr en Node, que es justamente la que garantiza que la proyección funcione
// aunque el almacenamiento no esté disponible.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OCUPACION_MAXIMA,
  OCUPACION_MINIMA,
  OCUPACION_POR_DEFECTO,
  POR_DEFECTO,
  acotarOcupacion,
  cargarPreferencias,
  esGeometria,
} from '../src/services/projection.service.js';

// ── Ocupación ───────────────────────────────────────────────────────────────

test('la ocupación por defecto es el 70 % de la pantalla', () => {
  // Es el valor que se pidió y el que ve alguien que abre esto por primera vez.
  assert.equal(OCUPACION_POR_DEFECTO, 70);
  assert.equal(POR_DEFECTO.ocupacion, 70);
  assert.equal(cargarPreferencias().ocupacion, 70);
});

test('se acota al rango utilizable', () => {
  assert.equal(acotarOcupacion(200), OCUPACION_MAXIMA);
  assert.equal(acotarOcupacion(0), OCUPACION_MINIMA);
  assert.equal(acotarOcupacion(-30), OCUPACION_MINIMA);
  assert.equal(acotarOcupacion(65), 65);
});

test('se redondea a entero: es un porcentaje que se enseña en pantalla', () => {
  // La rueda del ratón suma de dos en dos, pero un decimal colado daría
  // «73.00000000001 %» en la barra del operador.
  assert.equal(acotarOcupacion(72.4), 72);
  assert.equal(Number.isInteger(acotarOcupacion(80.6)), true);
});

test('lo que no es un número cae al valor por defecto', () => {
  // Incluye lo guardado por la versión anterior, que tenía `escala` (0,5-2) y
  // no `ocupacion`: no se convierte, porque son dos magnitudes distintas.
  for (const basura of [undefined, null, NaN, Infinity, '80', {}]) {
    assert.equal(acotarOcupacion(basura), OCUPACION_POR_DEFECTO);
  }
});

test('ya no queda rastro de la escala vieja en los valores por defecto', () => {
  assert.equal('escala' in POR_DEFECTO, false);
});

// ── Geometría del proyector ─────────────────────────────────────────────────

test('una geometría válida necesita las cuatro medidas y un tamaño positivo', () => {
  assert.ok(esGeometria({ left: 1920, top: 0, width: 1920, height: 1080 }));
  // Negativo sí vale en left/top: un segundo monitor a la izquierda del
  // principal tiene coordenadas negativas, y ahí es donde acaba el proyector
  // más de una vez.
  assert.ok(esGeometria({ left: -1920, top: -200, width: 1280, height: 720 }));

  assert.equal(esGeometria(null), false);
  assert.equal(esGeometria({ left: 0, top: 0, width: 0, height: 720 }), false);
  assert.equal(esGeometria({ left: 0, top: 0, width: 1280 }), false);
  assert.equal(esGeometria({ left: '0', top: 0, width: 1280, height: 720 }), false);
});
