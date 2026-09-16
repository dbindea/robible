// El suelo de estilos de los botones de un diálogo.
//
// `Modal.svelte` daba la disposición del pie pero ningún aspecto a los botones:
// cada pantalla tenía que ponérselo, y donde no se hacía salían los botones
// grises del navegador con su borde `outset`. El panel de administración
// enseñaba así sus cuatro diálogos de confirmación, incluido el de borrar una
// predicación para siempre — un botón destructivo con pinta de formulario de
// 1998 no transmite lo que hace.
//
// La regla base vive en `Modal.svelte` con especificidad CERO (`:where`), así
// que es un suelo y no una imposición: cualquier clase que el componente le
// ponga a su botón gana sin pelearse con `!important`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const modal = readFileSync(new URL('../src/components/Modal.svelte', import.meta.url), 'utf8');

test('el pie del diálogo da estilo base a sus botones', () => {
  assert.match(
    modal,
    /:where\(\.modal__footer\)\s*:global\(button\)/,
    'sin esta regla, cualquier diálogo cuyo botón no lleve clase propia sale con '
    + 'la apariencia nativa del navegador',
  );
});

test('la regla base va con `:where`, que es lo que la hace ceder', () => {
  // Si alguien la reescribe como `.modal__footer :global(button)`, su
  // especificidad sube a 0-2-1 y empieza a pisar los estilos propios de los
  // diálogos que sí los tienen: el del versículo del día, el de compartir una
  // imagen, el de la nota, el de borrar un tema y los dos de predicaciones.
  const linea = modal.split(/\r?\n/).find((l) => l.includes(':global(button)'));
  assert.ok(linea, 'debería existir la regla');
  assert.ok(
    linea.includes(':where('),
    `la regla tiene que ir en :where() para no pisar los estilos propios; está así: ${linea.trim()}`,
  );
});

test('el estilo base cubre también el estado deshabilitado', () => {
  // Media aplicación deshabilita el botón de confirmar mientras guarda. Sin
  // esta regla, el botón sigue con pinta de pulsable mientras no hace nada.
  assert.match(modal, /:global\(button:disabled\)/);
});

// ── Los diálogos que ya traen lo suyo ───────────────────────────────────────

test('los pies con estilos propios siguen usando sus clases', () => {
  // Esto no comprueba el aspecto —eso se ve en el navegador— sino que nadie los
  // haya vaciado confiando en el suelo. Un botón principal y uno de cancelar no
  // pueden verse igual, y el suelo por sí solo los deja idénticos.
  const DIR = fileURLToPath(new URL('../src/', import.meta.url));
  const archivos = [];
  (function rec(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (e.name.endsWith('.svelte')) archivos.push(p);
    }
  })(DIR);

  const sinDistinguir = [];
  for (const f of archivos) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<svelte:fragment slot="footer">([\s\S]*?)<\/svelte:fragment>/g)) {
      const botones = [...m[1].matchAll(/<button\b[^>]*?>/gs)];
      if (botones.length < 2) continue;
      // Con dos o más botones, al menos uno tiene que llevar clase propia: es
      // lo que distingue «confirmar» de «cancelar».
      const conClase = botones.filter((b) => /class="/.test(b[0])).length;
      if (conClase === 0) sinDistinguir.push(f.replace(DIR, ''));
    }
  }
  assert.deepEqual(
    sinDistinguir,
    [],
    `estos diálogos tienen dos botones y ninguno se distingue del otro: ${sinDistinguir.join(', ')}`,
  );
});
