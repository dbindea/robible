// Subrayados de color: paleta y servicio en su modo sin backend.
//
// Sin VITE_API_BASE_URL, USE_BACKEND es false y el servicio funciona solo
// contra localStorage — que es exactamente el camino que recorre un usuario
// sin conexión, así que conviene tenerlo cubierto.

globalThis.window ??= {};
globalThis.localStorage ??= {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};
globalThis.crypto ??= (await import('node:crypto')).webcrypto;

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_HIGHLIGHT_COLOR,
  HIGHLIGHT_COLORS,
  highlightColorKey,
  normalizeHighlightColor,
} from '../src/config/highlight-palette.js';
import {
  getHighlight,
  loadHighlights,
  removeHighlight,
  resetAll,
  setCurrentUser,
  setHighlight,
  toggleHighlight,
} from '../src/services/highlights.service.js';

// ── Paleta ──────────────────────────────────────────────

test('todos los colores de la paleta son hex de seis dígitos', () => {
  for (const c of HIGHLIGHT_COLORS) {
    assert.match(c.hex, /^#[0-9A-Fa-f]{6}$/, `${c.key}: ${c.hex} no es un hex válido`);
    assert.match(c.key, /^[a-z]+$/, `clave inválida: ${c.key}`);
  }
});

test('no hay colores repetidos en la paleta', () => {
  const hexes = HIGHLIGHT_COLORS.map((c) => c.hex.toUpperCase());
  const keys = HIGHLIGHT_COLORS.map((c) => c.key);
  assert.equal(new Set(hexes).size, hexes.length);
  assert.equal(new Set(keys).size, keys.length);
});

// Tono en grados (0 = rojo, 120 = verde, 240 = azul).
const tono = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) % 360 + 360) % 360;
};

test('la paleta evita la franja verde-turquesa', () => {
  // En esta app el verde significa "versículo en lectura" (--color-success) y
  // no debe usarse para otra cosa. El subrayado se pinta como un lavado muy
  // suave, así que también hay que dejar fuera los turquesas: a esa intensidad
  // no se distinguen del verde de lectura. Ver CLAUDE.md, trampa 13.
  for (const { key, hex } of HIGHLIGHT_COLORS) {
    const h = tono(hex);
    assert.ok(
      h < 75 || h > 200,
      `${key} (${hex}) cae en la franja verde-turquesa (tono ${Math.round(h)}°)`,
    );
  }
});

test('los colores de la paleta se distinguen entre sí', () => {
  // Como fondo al 26 % dos tonos cercanos dan lavados casi idénticos y el
  // usuario no puede separar sus propias categorías.
  const tonos = HIGHLIGHT_COLORS.map((c) => ({ ...c, h: tono(c.hex) }));
  for (let i = 0; i < tonos.length; i++) {
    for (let j = i + 1; j < tonos.length; j++) {
      const bruto = Math.abs(tonos[i].h - tonos[j].h);
      const distancia = Math.min(bruto, 360 - bruto);
      assert.ok(
        distancia >= 40,
        `${tonos[i].key} y ${tonos[j].key} están a ${Math.round(distancia)}° y se confundirán`,
      );
    }
  }
});

test('el color por defecto pertenece a la paleta', () => {
  assert.ok(HIGHLIGHT_COLORS.some((c) => c.hex === DEFAULT_HIGHLIGHT_COLOR));
});

test('normalizeHighlightColor acepta hex válidos y rechaza lo demás', () => {
  assert.equal(normalizeHighlightColor('#f2cc36'), '#F2CC36');
  assert.equal(normalizeHighlightColor('  #F2CC36  '), '#F2CC36');
  assert.equal(normalizeHighlightColor('#fff'), null);
  assert.equal(normalizeHighlightColor('rojo'), null);
  assert.equal(normalizeHighlightColor(''), null);
  assert.equal(normalizeHighlightColor(null), null);
  assert.equal(normalizeHighlightColor(123), null);
});

test('highlightColorKey identifica los colores de la paleta', () => {
  assert.equal(highlightColorKey('#f2cc36'), 'yellow');
  assert.equal(highlightColorKey('#123456'), null);
  assert.equal(highlightColorKey('no-es-un-color'), null);
});

// ── Servicio (modo localStorage) ────────────────────────

const limpiar = () => {
  setCurrentUser('u_test');
  resetAll();
};

test('sin subrayados, la lista está vacía', () => {
  limpiar();
  assert.deepEqual(loadHighlights(), []);
  assert.equal(getHighlight(42, 3, 16), null);
});

test('setHighlight guarda y getHighlight lo encuentra', async () => {
  limpiar();
  const res = await setHighlight(42, 3, 16, '#F2CC36');
  assert.equal(res.ok, true);
  assert.equal(res.highlight.color, '#F2CC36');

  const guardado = getHighlight(42, 3, 16);
  assert.equal(guardado.book, 42);
  assert.equal(guardado.chapter, 3);
  assert.equal(guardado.verse, 16);
  assert.equal(guardado.color, '#F2CC36');
});

test('repintar el mismo versículo no crea una segunda fila', async () => {
  limpiar();
  await setHighlight(42, 3, 16, '#F2CC36');
  await setHighlight(42, 3, 16, '#3C9ADD');

  const lista = loadHighlights();
  assert.equal(lista.length, 1, 'debería haber un único subrayado para ese versículo');
  assert.equal(lista[0].color, '#3C9ADD');
});

test('repintar conserva createdAt y actualiza updatedAt', async () => {
  limpiar();
  const primero = await setHighlight(42, 3, 16, '#F2CC36');
  await new Promise((r) => setTimeout(r, 5));
  const segundo = await setHighlight(42, 3, 16, '#D864C5');

  assert.equal(segundo.highlight.createdAt, primero.highlight.createdAt);
  assert.notEqual(segundo.highlight.updatedAt, primero.highlight.createdAt);
});

test('setHighlight rechaza un color que no es hex', async () => {
  limpiar();
  const res = await setHighlight(42, 3, 16, 'amarillo');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'auth.errors.invalid_color');
  assert.deepEqual(loadHighlights(), []);
});

test('toggleHighlight con el mismo color quita el subrayado', async () => {
  limpiar();
  await setHighlight(42, 3, 16, '#F2CC36');
  const res = await toggleHighlight(42, 3, 16, '#F2CC36');
  assert.equal(res.ok, true);
  assert.equal(getHighlight(42, 3, 16), null);
});

test('toggleHighlight con otro color repinta en vez de quitar', async () => {
  limpiar();
  await setHighlight(42, 3, 16, '#F2CC36');
  await toggleHighlight(42, 3, 16, '#977BE0');
  assert.equal(getHighlight(42, 3, 16).color, '#977BE0');
});

test('toggleHighlight ignora las diferencias de mayúsculas del hex', async () => {
  limpiar();
  await setHighlight(42, 3, 16, '#f2cc36');
  const res = await toggleHighlight(42, 3, 16, '#F2CC36');
  assert.equal(res.ok, true);
  assert.equal(getHighlight(42, 3, 16), null, 'el mismo color en otra caja debería quitarlo');
});

test('removeHighlight sobre un versículo sin subrayar informa del fallo', async () => {
  limpiar();
  const res = await removeHighlight(42, 3, 16);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'auth.errors.highlight_not_found');
});

test('los subrayados de un usuario no se ven desde otro', async () => {
  setCurrentUser('u_uno');
  resetAll();
  await setHighlight(42, 3, 16, '#F2CC36');

  setCurrentUser('u_dos');
  resetAll();
  assert.deepEqual(loadHighlights(), [], 'el segundo usuario no debería ver nada');

  setCurrentUser('u_uno');
  assert.equal(loadHighlights().length, 1, 'el primero debería conservar el suyo');
  resetAll();
});

test('varios versículos conviven', async () => {
  limpiar();
  await setHighlight(42, 3, 16, '#F2CC36');
  await setHighlight(42, 3, 17, '#3C9ADD');
  await setHighlight(18, 23, 1, '#D864C5');

  assert.equal(loadHighlights().length, 3);
  await removeHighlight(42, 3, 17);
  assert.equal(loadHighlights().length, 2);
  assert.equal(getHighlight(42, 3, 16).color, '#F2CC36');
  assert.equal(getHighlight(18, 23, 1).color, '#D864C5');
});
