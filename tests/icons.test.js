// Los iconos.
//
// Por qué existe: los dos fallos de iconos del 7 sep no los habría cazado
// ningún test. El primero —17 reglas `.contenedor svg { width }` que dejaron de
// alcanzar al icono cuando pasó a ser un componente— lo delató el aviso de
// "Unused CSS selector" del build. El segundo —`size="18"` sin unidad, que
// dejaba el icono a su tamaño intrínseco y reventaba los botones de la landing—
// lo vio el usuario en pantalla.
//
// Los dos son del mismo tipo: **el icono se dibuja, pero con la forma o el
// tamaño equivocados**. No rompen nada, no dan error en consola y sólo se ven
// mirando. Esto vigila lo que se puede vigilar sin navegador.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..');
const ICONO = readFileSync(path.join(RAIZ, 'src', 'components', 'Icon.svelte'), 'utf8');

const recorrer = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    return e.isDirectory() ? recorrer(f) : e.name.endsWith('.svelte') ? [f] : [];
  });

const COMPONENTES = recorrer(path.join(RAIZ, 'src')).filter((f) => !f.endsWith('Icon.svelte'));
const FUENTES = COMPONENTES.map((f) => ({ f, s: readFileSync(f, 'utf8') }));

/** Los nombres que `Icon.svelte` sabe dibujar. */
const disponibles = new Set([...ICONO.matchAll(/^\s*'([\w-]+)': \{/gm)].map((m) => m[1]));

// ── El catálogo ─────────────────────────────────────────

test('Icon.svelte declara iconos y todos traen el trazo normal', () => {
  assert.ok(disponibles.size >= 40, `sólo hay ${disponibles.size} iconos`);
  for (const nombre of disponibles) {
    const bloque = ICONO.slice(ICONO.indexOf(`'${nombre}': {`));
    assert.ok(/regular: `<(path|circle|rect|line|polyline|polygon)/.test(bloque), `'${nombre}' no tiene trazo`);
  }
});

test('todo `<Icon name="x">` usa un nombre que existe', () => {
  // Un nombre inventado no falla: `Icon` cae en el marcador. El usuario ve un
  // icono equivocado y nadie se entera.
  const fallos = [];
  for (const { f, s } of FUENTES) {
    for (const m of s.matchAll(/<Icon\s[^>]*name="([\w-]+)"/g)) {
      if (!disponibles.has(m[1])) fallos.push(`${path.basename(f)}: ${m[1]}`);
    }
  }
  assert.deepEqual(fallos, [], `nombres que no existen: ${fallos.join(', ')}`);
});

// ── Tamaños ─────────────────────────────────────────────

test('`size` siempre lleva unidad', () => {
  // `size="18"` produce `width: 18`, que el navegador descarta: el icono se
  // dibuja a su tamaño intrínseco, enorme. Reventó los dos botones de la
  // landing, que quedaron con el texto a una letra por línea. Pasó
  // desapercibido porque antes el tamaño iba como atributo del <svg>, donde un
  // número sin unidad sí es válido.
  const fallos = [];
  for (const { f, s } of FUENTES) {
    for (const m of s.matchAll(/<Icon\s[^>]*size="([^"{]+)"/g)) {
      const v = m[1].trim();
      if (/^\d+(\.\d+)?$/.test(v)) fallos.push(`${path.basename(f)}: size="${v}"`);
    }
  }
  assert.deepEqual(fallos, [], `tamaños sin unidad: ${fallos.join(', ')}`);
});

test('Icon.svelte convierte un número suelto a píxeles de todos modos', () => {
  // Cinturón y tirantes: aunque el test de arriba lo impida en el repo, un
  // `size` calculado en tiempo de ejecución podría llegar sin unidad.
  assert.match(ICONO, /\/\^\\d\+\(\\\.\\d\+\)\?\$\/\.test\(String\(size\)\)/);
});

test('el icono es cuadrado y no lo recorta el max-width global', () => {
  // `global.css` da `max-width: 100%` a todo `svg`, pensando en imágenes. En un
  // icono con tamaño propio eso recorta el ancho pero no el alto: dentro de un
  // botón estrecho salía a 13×16 px, aplastado.
  assert.match(ICONO, /max-width:\s*none/);
  const ancho = ICONO.match(/width:\s*var\(--icon-size,\s*var\(--icon-fallback\)\)/);
  const alto = ICONO.match(/height:\s*var\(--icon-size,\s*var\(--icon-fallback\)\)/);
  assert.ok(ancho && alto, 'ancho y alto deben salir de la misma variable');
});

test('nadie intenta dimensionar el icono con una regla `svg` desde fuera', () => {
  // El scoping de Svelte le pone al <svg> la clase de Icon.svelte, así que una
  // regla `.mi-boton svg { width: … }` del padre **no le alcanza**. Es un fallo
  // silencioso: el icono vuelve al tamaño por defecto y nada avisa. Para eso
  // está `--icon-size` en el contenedor.
  const fallos = [];
  for (const { f, s } of FUENTES) {
    // Bloques `svg { … }` anidados que fijan medidas.
    for (const m of s.matchAll(/(^|\n)[ \t]*svg\s*\{([^{}]*)\}/g)) {
      if (/(^|[\s;])(width|height)\s*:/.test(m[2])) {
        fallos.push(`${path.basename(f)}: svg { ${m[2].trim().slice(0, 40)} }`);
      }
    }
  }
  assert.deepEqual(fallos, [], `usa --icon-size en el contenedor: ${fallos.join(' · ')}`);
});

// ── Estados ─────────────────────────────────────────────

test('todo `weight="fill"` pide un icono que tenga relleno', () => {
  // Sin versión rellena, `Icon` cae al contorno: el estado marcado se queda
  // igual que el normal y deja de comunicar nada.
  const conRelleno = new Set(
    [...ICONO.matchAll(/^\s*'([\w-]+)': \{[\s\S]*?\n\s*\},/gm)]
      .filter((m) => m[0].includes('fill: `'))
      .map((m) => m[1]),
  );

  const fallos = [];
  for (const { f, s } of FUENTES) {
    // `<Icon name="x" weight="fill">` literal; los dinámicos no se pueden mirar.
    for (const m of s.matchAll(/<Icon\s[^>]*name="([\w-]+)"[^>]*weight="fill"/g)) {
      if (!conRelleno.has(m[1])) fallos.push(`${path.basename(f)}: ${m[1]}`);
    }
  }
  assert.deepEqual(fallos, [], `sin versión rellena: ${fallos.join(', ')}`);
});

// ── Las claves guardadas en la base de datos ────────────

test('los catorce iconos de tema existen y no se han renombrado', async () => {
  // Están en la columna `icon` de `topics` en D1. Renombrar uno deja sin icono
  // a los temas que ya lo usaban, y no hay forma de recuperarlo.
  const { TOPIC_ICONS, DEFAULT_TOPIC_ICON, resolveTopicIcon } = await import('../src/config/topic-icons.js');

  assert.equal(TOPIC_ICONS.length, 14);
  for (const { key } of TOPIC_ICONS) {
    assert.ok(disponibles.has(key), `el icono de tema '${key}' no existe en Icon.svelte`);
  }
  assert.ok(disponibles.has(DEFAULT_TOPIC_ICON));

  // Un tema guardado con una clave vieja —o con el emoji que fue el valor por
  // defecto de la columna— cae en el marcador, no en un hueco.
  assert.equal(resolveTopicIcon('📌'), DEFAULT_TOPIC_ICON);
  assert.equal(resolveTopicIcon('no-existe'), DEFAULT_TOPIC_ICON);
  assert.equal(resolveTopicIcon('cross'), 'cross');
});
