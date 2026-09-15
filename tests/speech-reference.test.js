// De lo que se dice en voz alta a una referencia.
//
// Este módulo es el que decide si el dictado sirve o es un juguete. El
// reconocedor no devuelve «Ioan 3:16»: devuelve texto corrido con los números
// escritos con letra, en el idioma del reconocedor y con palabras de relleno
// por medio. Si la conversión falla, el buscador no encuentra nada y el
// predicador se queda mirando el micrófono delante de la congregación.
//
// Las frases de abajo están escritas como se dicen de verdad, incluyendo las
// formas que más se usan en el púlpito.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarDictado,
  normalizarDictadoLibre,
  idiomaDe,
} from '../src/services/speech-reference.service.js';

// ── Rumano ──────────────────────────────────────────────────────────────────

test('rumano: referencia simple', () => {
  assert.equal(normalizarDictado('Ioan trei șaisprezece', 'ro-RO'), 'ioan 3 16');
  assert.equal(normalizarDictado('Geneza unu unu', 'ro-RO'), 'geneza 1 1');
  assert.equal(normalizarDictado('Matei cinci', 'ro-RO'), 'matei 5');
});

test('rumano: con las palabras de relleno que se dicen al hablar', () => {
  assert.equal(normalizarDictado('Ioan capitolul trei versetul șaisprezece', 'ro-RO'), 'ioan 3 16');
  assert.equal(normalizarDictado('din cartea Psalmii douăzeci și trei', 'ro-RO'), 'psalmii 23');
});

test('rumano: decenas compuestas', () => {
  assert.equal(normalizarDictado('Psalmii douăzeci și trei', 'ro-RO'), 'psalmii 23');
  assert.equal(normalizarDictado('Romani opt douăzeci și opt', 'ro-RO'), 'romani 8 28');
  assert.equal(normalizarDictado('Isaia patruzeci și unu zece', 'ro-RO'), 'isaia 41 10');
});

test('rumano: Salmos pasa de cien, que es el único libro que lo hace', () => {
  assert.equal(normalizarDictado('Psalmii o sută nouăsprezece o sută cinci', 'ro-RO'), 'psalmii 119 105');
});

test('rumano: los ordinales de libro NO son un capítulo', () => {
  // El fallo que esto evita: «primul» convertido en un 1 suelto hace que el
  // buscador crea que el libro se llama «1» y no encuentre nada.
  assert.equal(normalizarDictado('primul Samuel douăzeci opt', 'ro-RO'), '1 samuel 20 8');
  assert.equal(normalizarDictado('a doua Timotei trei șaisprezece', 'ro-RO'), '2 timotei 3 16');
});

// ── Español ─────────────────────────────────────────────────────────────────

test('español: referencia simple y con relleno', () => {
  assert.equal(normalizarDictado('Juan tres dieciséis', 'es-ES'), 'juan 3 16');
  assert.equal(normalizarDictado('Juan capítulo tres versículo dieciséis', 'es-ES'), 'juan 3 16');
  assert.equal(normalizarDictado('Salmos veintitrés', 'es-ES'), 'salmos 23');
});

test('español: decenas compuestas y centena', () => {
  assert.equal(normalizarDictado('Romanos ocho veintiocho', 'es-ES'), 'romanos 8 28');
  assert.equal(normalizarDictado('Isaías cuarenta y uno diez', 'es-ES'), 'isaias 41 10');
  assert.equal(normalizarDictado('Salmos ciento diecinueve ciento cinco', 'es-ES'), 'salmos 119 105');
});

test('español: ordinales de libro', () => {
  assert.equal(normalizarDictado('primera de Corintios trece cuatro', 'es-ES'), '1 corintios 13 4');
  assert.equal(normalizarDictado('segunda de Timoteo tres dieciséis', 'es-ES'), '2 timoteo 3 16');
});

// ── Inglés ──────────────────────────────────────────────────────────────────

test('inglés: referencia, relleno y decenas', () => {
  assert.equal(normalizarDictado('John three sixteen', 'en-US'), 'john 3 16');
  assert.equal(normalizarDictado('John chapter three verse sixteen', 'en-US'), 'john 3 16');
  assert.equal(normalizarDictado('Romans eight twenty eight', 'en-US'), 'romans 8 28');
  assert.equal(normalizarDictado('first Samuel twenty eight', 'en-US'), '1 samuel 28');
});

// ── Chino ───────────────────────────────────────────────────────────────────

test('chino: los números se componen con 十, no se leen dígito a dígito', () => {
  // 十六 es dieciséis, no «uno seis». Y 二十三 es veintitrés.
  assert.equal(normalizarDictado('约翰福音三章十六节', 'zh-CN'), '约翰福音 3 16');
  assert.equal(normalizarDictado('诗篇二十三篇', 'zh-CN'), '诗篇 23');
  assert.equal(normalizarDictado('诗篇一百一十九篇一百零五节', 'zh-CN'), '诗篇 119 105');
});

// ── Lo que el reconocedor devuelve ya formateado ────────────────────────────

test('si el reconocedor ya escribe cifras, no se estropean', () => {
  // Chrome a veces devuelve «Ioan 3:16» directamente. Los dos caminos tienen
  // que acabar en lo mismo.
  assert.equal(normalizarDictado('Ioan 3:16', 'ro-RO'), 'ioan 3 16');
  assert.equal(normalizarDictado('Juan 3:16', 'es-ES'), 'juan 3 16');
  assert.equal(normalizarDictado('Ioan 3-16', 'ro-RO'), 'ioan 3 16');
});

// ── Bordes ──────────────────────────────────────────────────────────────────

test('entrada vacía o basura no revienta', () => {
  for (const malo of ['', '   ', null, undefined, 42]) {
    assert.equal(typeof normalizarDictado(malo, 'ro-RO'), 'string');
  }
});

test('una palabra que no reconoce se deja tal cual', () => {
  // Mejor pasarle al buscador algo imperfecto que una cadena vacía: él ya sabe
  // buscar por aproximación, y si falla queda la búsqueda por expresión.
  assert.equal(normalizarDictado('Habacuc', 'ro-RO'), 'habacuc');
  assert.match(normalizarDictado('bla bla trei', 'ro-RO'), /3$/);
});

test('idiomaDe saca el idioma base y cae a rumano si no lo conoce', () => {
  assert.equal(idiomaDe('ro-RO'), 'ro');
  assert.equal(idiomaDe('es-ES'), 'es');
  assert.equal(idiomaDe('en-US'), 'en');
  assert.equal(idiomaDe('de-DE'), 'ro');
  assert.equal(idiomaDe(undefined), 'ro');
});

// ── Búsqueda por expresión ──────────────────────────────────────────────────

test('la búsqueda por expresión NO convierte los números', () => {
  // Quien dicta «toate lucrurile» quiere esas palabras tal cual. Convertir un
  // «doi» en «2» aquí estropearía la búsqueda en vez de ayudarla.
  assert.equal(normalizarDictadoLibre('dragostea lui Dumnezeu'), 'dragostea lui Dumnezeu');
  assert.equal(normalizarDictadoLibre('doi sau trei'), 'doi sau trei');
});

test('la búsqueda por expresión quita la puntuación que añade el reconocedor', () => {
  assert.equal(normalizarDictadoLibre('dragostea lui Dumnezeu.'), 'dragostea lui Dumnezeu');
  assert.equal(normalizarDictadoLibre('¿dónde está?'), '¿dónde está');
  assert.equal(normalizarDictadoLibre('神的爱。'), '神的爱');
});
