// Paridad entre las cinco paletas.
//
// Por qué existe este test: una paleta a la que le falta un token no falla —
// hereda el valor de `:root`, que es el de LUMINĂ. El síntoma es un panel
// blanco en mitad de la paleta nocturna, o una tinta azul sobre papel sepia, y
// sólo se ve abriendo la aplicación y cambiando de paleta una por una. Es el
// mismo razonamiento que `i18n-keys.test.js`: lo que degrada en silencio hay
// que vigilarlo desde fuera.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PALETTES, DEFAULT_PALETTE, isValidPalette, migratePalette, getPalette } from '../src/config/palettes.js';

const CSS = readFileSync(path.join(import.meta.dirname, '..', 'public', 'global.css'), 'utf8');

/** Extrae los tokens declarados dentro del bloque de una paleta. */
const tokensDe = (id) => {
  // LUMINĂ comparte bloque con `:root` porque es también el valor por defecto.
  const selector = id === 'lumina' ? `:root,\nhtml[data-theme='lumina'] {` : `html[data-theme='${id}'] {`;
  const i = CSS.replace(/\r\n/g, '\n').indexOf(selector);
  assert.ok(i >= 0, `no encuentro el bloque de la paleta '${id}' en global.css`);
  const cuerpo = CSS.replace(/\r\n/g, '\n').slice(i, CSS.replace(/\r\n/g, '\n').indexOf('\n}', i));
  return new Set([...cuerpo.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]));
};

// ── El catálogo y el CSS dicen lo mismo ─────────────────

test('las cinco paletas del catálogo tienen bloque en global.css', () => {
  assert.equal(PALETTES.length, 5);
  for (const p of PALETTES) {
    assert.ok(tokensDe(p.id).size > 0, `la paleta '${p.id}' no declara ningún token`);
  }
});

test('no queda ningún rastro del interruptor claro/oscuro', () => {
  // `html[data-theme='dark']` fue el único selector de tema durante años. Si
  // reaparece, es que alguien ha vuelto a escribir una regla por tema en lugar
  // de usar un token.
  assert.ok(!CSS.includes("data-theme='dark'"), 'global.css sigue teniendo reglas para el tema "dark"');
  assert.ok(!CSS.includes("data-theme='light'"));
});

// ── Ninguna paleta se queda coja ────────────────────────

test('todas las paletas declaran exactamente los mismos tokens', () => {
  const referencia = tokensDe('lumina');
  // LUMINĂ comparte bloque con `:root`, que además trae los derivados y las
  // escalas; sólo se comparan los tokens de paleta.
  const dePaleta = [...referencia].filter((t) => !t.startsWith('--grey-') && !t.startsWith('--blue-') && !t.startsWith('--green-'));

  for (const p of PALETTES.filter((x) => x.id !== 'lumina')) {
    const suyos = tokensDe(p.id);
    const faltan = dePaleta.filter((t) => !suyos.has(t));
    assert.deepEqual(faltan, [], `a la paleta '${p.id}' le faltan tokens: ${faltan.join(', ')}`);
  }
});

test('los tokens que cada componente da por hechos existen en las cinco', () => {
  // Si se añade un token nuevo a una paleta y se olvida en otra, el componente
  // que lo use se verá bien en una y roto en cuatro.
  const IMPRESCINDIBLES = [
    '--color-page', '--color-surface', '--color-surface-raised', '--color-surface-sunken', '--color-field',
    '--color-ink', '--color-ink-soft', '--color-ink-strong',
    '--color-accent', '--color-accent-hover', '--color-accent-ink', '--color-accent-soft',
    '--color-accent-solid', '--color-accent-solid-hover',
    '--color-success', '--color-success-ink', '--color-success-solid', '--color-danger', '--color-danger-ink',
    '--color-marked-favorite', '--color-marked-note',
    '--color-link', '--color-on-primary', '--color-sidebar', '--color-on-sidebar',
    '--shadow-tint', '--shadow-tint-strong', '--glass-tint', '--glass-line', '--color-scrim',
    '--wash-reading',
  ];
  for (const p of PALETTES) {
    const suyos = tokensDe(p.id);
    for (const t of IMPRESCINDIBLES) {
      assert.ok(suyos.has(t), `la paleta '${p.id}' no define ${t}`);
    }
  }
});

test('cada paleta declara si es clara u oscura', () => {
  // `color-scheme` es lo que pinta las barras de scroll y los controles
  // nativos. Sin él, un formulario del sistema sale blanco sobre nocturn.
  for (const p of PALETTES) {
    assert.ok(['light', 'dark'].includes(p.scheme), `'${p.id}' tiene scheme '${p.scheme}'`);
    const cuerpo = CSS.replace(/\r\n/g, '\n');
    const i = cuerpo.indexOf(p.id === 'lumina' ? ":root,\nhtml[data-theme='lumina'] {" : `html[data-theme='${p.id}'] {`);
    const bloque = cuerpo.slice(i, cuerpo.indexOf('\n}', i));
    assert.ok(bloque.includes(`color-scheme: ${p.scheme}`), `'${p.id}' no declara color-scheme: ${p.scheme}`);
  }
});

// ── Migración desde el interruptor antiguo ──────────────

test('quien tenía light o dark guardado conserva su preferencia', () => {
  // Sin esto, todos los usuarios con la PWA instalada abrirían la aplicación
  // con la paleta por defecto y sin entender por qué.
  assert.equal(migratePalette('light'), 'lumina');
  assert.equal(migratePalette('dark'), 'noapte');
});

test('una paleta válida guardada se respeta tal cual', () => {
  for (const p of PALETTES) assert.equal(migratePalette(p.id), p.id);
});

test('lo que no se reconoce devuelve null, para poder caer en el sistema', () => {
  // `null` y no la paleta por defecto: quien llama tiene que poder distinguir
  // "no ha elegido nunca" de "eligió LUMINĂ".
  for (const basura of ['', null, undefined, 'azul', '{}', 42]) {
    assert.equal(migratePalette(basura), null, `'${basura}' debería no reconocerse`);
  }
});

// ── Catálogo ────────────────────────────────────────────

test('isValidPalette sólo acepta las cinco', () => {
  for (const p of PALETTES) assert.equal(isValidPalette(p.id), true);
  for (const x of ['dark', 'light', 'sepiaa', '']) assert.equal(isValidPalette(x), false);
});

test('getPalette nunca devuelve undefined', () => {
  // Se usa al arrancar para poner `data-theme` y el color de la barra del
  // sistema: si devolviera undefined, la aplicación arrancaría sin tema.
  assert.equal(getPalette('nocturn').id, 'nocturn');
  assert.equal(getPalette('no-existe').id, DEFAULT_PALETTE);
  assert.equal(getPalette(undefined).id, DEFAULT_PALETTE);
});

test('cada paleta trae muestra y color de barra para el selector', () => {
  for (const p of PALETTES) {
    assert.match(p.themeColor, /^#[0-9a-f]{6}$/i, `'${p.id}' tiene un themeColor raro`);
    for (const capa of ['page', 'surface', 'accent', 'ink']) {
      assert.match(p.swatch[capa], /^#[0-9a-f]{6}$/i, `'${p.id}'.swatch.${capa} no es un hex`);
    }
  }
});

test('las etiquetas del selector existen en los cuatro idiomas', () => {
  const dir = path.join(import.meta.dirname, '..', 'public', 'lang');
  for (const lang of ['ro', 'es', 'en', 'zh']) {
    const j = JSON.parse(readFileSync(path.join(dir, `${lang}.json`), 'utf8'));
    for (const p of PALETTES) {
      const clave = p.labelKey.split('.').reduce((o, k) => o?.[k], j);
      assert.ok(clave, `falta ${p.labelKey} en ${lang}.json`);
      // La pista es lo que hace elegible un nombre como "Nocturn".
      const pista = `${p.labelKey}_hint`.split('.').reduce((o, k) => o?.[k], j);
      assert.ok(pista, `falta ${p.labelKey}_hint en ${lang}.json`);
    }
  }
});
