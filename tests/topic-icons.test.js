// Iconos del índice temático, incluidos los emoji heredados.
//
// Por qué importa: la columna `icon` de D1 guarda la clave literal, y antes de
// los trazos de Phosphor guardaba **emoji**. Esos temas siguen ahí. Si el
// resolutor deja de reconocerlos, el índice de un usuario antiguo se convierte
// en una fila de iconos idénticos sin que falle nada ni salga ningún error.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TOPIC_ICONS, DEFAULT_TOPIC_ICON, resolveTopicIcon } from '../src/config/topic-icons.js';

const claves = new Set(TOPIC_ICONS.map((i) => i.key));

test('las claves válidas se devuelven tal cual', () => {
  for (const { key } of TOPIC_ICONS) {
    assert.equal(resolveTopicIcon(key), key);
  }
});

test('los emoji que hay en producción se traducen', () => {
  // Consultado contra D1 el 10 sep 2026: los únicos valores guardados eran
  // '🩹', '✝️', '🤲' y 'water'. Los tres primeros son de antes de Phosphor.
  assert.equal(resolveTopicIcon('✝️'), 'cross');
  assert.equal(resolveTopicIcon('🩹'), 'heart');
  assert.equal(resolveTopicIcon('🤲'), 'hands');
  assert.equal(resolveTopicIcon('water'), 'water');
});

test('el selector de variación no cambia el resultado', () => {
  // '✝️' es U+271D seguido de U+FE0F y '✝' es sólo U+271D: son cadenas
  // distintas y las dos tienen que resolver igual.
  assert.equal(resolveTopicIcon('✝️'), 'cross');
  assert.equal(resolveTopicIcon('✝'), 'cross');
  assert.equal(resolveTopicIcon('☀️'), 'sun');
  assert.equal(resolveTopicIcon('☀'), 'sun');
});

test('todo emoji heredado apunta a una clave que existe de verdad', () => {
  // Un mapeo a una clave inventada saldría como el marcador sin avisar, que es
  // exactamente el fallo que esta tabla venía a arreglar.
  const heredados = ['✝️', '❤️', '♥️', '🩹', '🤲', '🙌', '🙏', '📌', '⭐', '☀️', '🌙', '🛡️', '👑', '🕊️', '🔥', '💧', '🏠', '💡', '☮️'];
  for (const emoji of heredados) {
    const resuelto = resolveTopicIcon(emoji);
    assert.ok(claves.has(resuelto), `'${emoji}' resuelve a '${resuelto}', que no está en TOPIC_ICONS`);
  }
});

test('lo desconocido cae en el marcador, no en un hueco', () => {
  assert.equal(resolveTopicIcon('no-existe'), DEFAULT_TOPIC_ICON);
  assert.equal(resolveTopicIcon(''), DEFAULT_TOPIC_ICON);
  assert.equal(resolveTopicIcon(null), DEFAULT_TOPIC_ICON);
  assert.equal(resolveTopicIcon(undefined), DEFAULT_TOPIC_ICON);
});
