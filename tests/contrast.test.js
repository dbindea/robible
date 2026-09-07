// Contraste de texto en las cinco paletas.
//
// Por qué existe: una paleta se elige mirando una muestra de tres colores, y
// una muestra no dice si el texto secundario se va a leer sobre la tarjeta. Un
// contraste malo no rompe nada —la aplicación funciona, simplemente no se lee—
// y sólo se descubre abriendo cada paleta y mirándola. Ya pasó: los títulos del
// sidebar salían casi negros sobre casi negro y nadie lo vio hasta una captura.
//
// Los umbrales son los de WCAG 2.1 AA: 4.5:1 para texto normal, 3:1 para texto
// grande y para elementos de interfaz (iconos, bordes que comunican estado).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PALETTES } from '../src/config/palettes.js';

const CSS = readFileSync(path.join(import.meta.dirname, '..', 'public', 'global.css'), 'utf8').replace(/\r\n/g, '\n');

// ── Lectura de los tokens ───────────────────────────────

/** Todas las declaraciones `--x: y` dentro del bloque que empieza en `desde`. */
const declaracionesDe = (desde) => {
  const i = CSS.indexOf(desde);
  assert.ok(i >= 0, `no encuentro el bloque '${desde}'`);
  const cuerpo = CSS.slice(i, CSS.indexOf('\n}', i));
  return Object.fromEntries([...cuerpo.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));
};

// Las escalas crudas viven en el primer `:root` y no cambian con la paleta.
const ESCALAS = declaracionesDe(':root {');

const tokensDe = (id) => ({
  ...ESCALAS,
  ...declaracionesDe(id === 'lumina' ? ":root,\nhtml[data-theme='lumina'] {" : `html[data-theme='${id}'] {`),
});

// ── Color ───────────────────────────────────────────────

/** Resuelve `var(--x)` en cadena hasta llegar a un color literal. */
const resolver = (valor, tokens, saltos = 0) => {
  assert.ok(saltos < 10, `referencia circular en '${valor}'`);
  const ref = valor.match(/^var\((--[\w-]+)\)$/);
  return ref ? resolver(tokens[ref[1]], tokens, saltos + 1) : valor;
};

const aRgb = (valor) => {
  const hex = valor.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = valor.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  assert.ok(rgb, `no sé leer el color '${valor}'`);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
};

/** Luminancia relativa (WCAG 2.1). */
const luminancia = (valor) => {
  const [r, g, b] = aRgb(valor).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// ── Qué se compara ──────────────────────────────────────
//
// [tinta, fondo, mínimo, para qué]
// 4.5 = texto normal · 3 = texto grande o elemento de interfaz.
const PARES = [
  // Cuerpo de texto sobre cada superficie donde se lee de verdad.
  ['--color-ink', '--color-page', 4.5, 'texto sobre el fondo de página'],
  ['--color-ink', '--color-surface', 4.5, 'texto sobre tarjeta'],
  ['--color-ink', '--color-surface-raised', 4.5, 'texto sobre tarjeta elevada'],
  ['--color-ink', '--color-surface-sunken', 4.5, 'texto sobre fondo hundido'],
  ['--color-ink', '--color-field', 4.5, 'texto escrito en un input'],

  // Títulos y énfasis.
  ['--color-ink-strong', '--color-page', 4.5, 'títulos sobre la página'],
  ['--color-ink-strong', '--color-surface', 4.5, 'títulos sobre tarjeta'],

  // Texto secundario: es el que más se descuida y el que más se usa.
  ['--color-ink-soft', '--color-page', 4.5, 'texto secundario sobre la página'],
  ['--color-ink-soft', '--color-surface', 4.5, 'texto secundario sobre tarjeta'],
  ['--color-ink-soft', '--color-surface-raised', 4.5, 'texto secundario sobre tarjeta elevada'],

  // Acento como texto: enlaces, referencias, títulos de grupo.
  ['--color-accent-ink', '--color-surface', 4.5, 'acento como texto sobre tarjeta'],
  ['--color-accent-ink', '--color-page', 4.5, 'acento como texto sobre la página'],
  ['--color-link', '--color-page', 4.5, 'enlaces sobre la página'],
  ['--color-link', '--color-surface', 4.5, 'enlaces sobre tarjeta'],

  // Texto encima del color de acento: botones primarios.
  ['--color-on-primary', '--color-accent-solid', 4.5, 'texto de un botón de acento'],
  ['--color-on-primary', '--color-accent-solid-hover', 4.5, 'texto del botón de acento en hover'],

  // Chrome oscuro del sidebar, en las cinco paletas.
  ['--color-on-sidebar', '--color-sidebar', 4.5, 'texto del sidebar'],
  ['--color-accent-soft', '--color-sidebar', 3, 'acento sobre el chrome del sidebar'],

  // El botón verde de 'leer con música': mismo caso que el de acento.
  ['--color-on-primary', '--color-success-solid', 4.5, 'texto del botón verde'],

  // Mensajes.
  ['--color-success-ink', '--color-surface', 4.5, 'mensaje de confirmación'],
  ['--color-danger-ink', '--color-surface', 4.5, 'mensaje de error'],

  // Elementos de interfaz: iconos y bordes que comunican estado. 3:1 basta,
  // pero por debajo el color deja de significar nada.
  ['--color-accent', '--color-surface', 3, 'borde e icono de acento sobre tarjeta'],
  ['--color-accent', '--color-page', 3, 'borde e icono de acento sobre la página'],
  ['--color-success', '--color-surface', 3, 'verde de lectura sobre tarjeta'],
  ['--color-marked-favorite', '--color-surface', 3, 'ámbar de favorito sobre tarjeta'],
  ['--color-marked-note', '--color-surface', 3, 'verde de nota sobre tarjeta'],
  ['--color-danger', '--color-surface', 3, 'rojo de borrar sobre tarjeta'],
];

for (const paleta of PALETTES) {
  test(`paleta '${paleta.id}': todo el texto se lee`, () => {
    const tokens = tokensDe(paleta.id);
    const fallos = [];

    for (const [tinta, fondo, minimo, para] of PARES) {
      assert.ok(tokens[tinta], `'${paleta.id}' no define ${tinta}`);
      assert.ok(tokens[fondo], `'${paleta.id}' no define ${fondo}`);
      const ratio = contraste(resolver(tokens[tinta], tokens), resolver(tokens[fondo], tokens));
      if (ratio < minimo) {
        fallos.push(`  ${para}: ${ratio.toFixed(2)}:1 (mínimo ${minimo}:1) — ${tinta} sobre ${fondo}`);
      }
    }

    assert.equal(fallos.length, 0, `contraste insuficiente en '${paleta.id}':\n${fallos.join('\n')}`);
  });
}

test('las superficies se distinguen entre sí', () => {
  // Si la tarjeta y la página son el mismo color, lo único que separa los
  // bloques es el borde. Es una decisión legítima, pero entonces el borde tiene
  // que verse: este test obliga a elegir una de las dos cosas.
  for (const paleta of PALETTES) {
    const tokens = tokensDe(paleta.id);
    const pagina = resolver(tokens['--color-page'], tokens);
    const tarjeta = resolver(tokens['--color-surface'], tokens);
    const iguales = contraste(pagina, tarjeta) < 1.04;
    if (iguales) {
      // Sin diferencia de fondo, la línea tiene que ser visible sobre la página.
      const tinta = resolver(tokens['--color-ink'], tokens);
      assert.ok(
        contraste(tinta, pagina) >= 4.5,
        `'${paleta.id}': página y tarjeta son el mismo color y la tinta no compensa`,
      );
    }
  }
});
