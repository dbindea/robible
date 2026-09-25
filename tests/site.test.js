// Los datos del sitio que salen en los dos pies.
//
// Era `donation.test.js` y vigilaba sobre todo el enlace de PayPal. Las
// donaciones se retiraron el 25 sep 2026 y aquí queda lo que sigue saliendo a
// pantalla: el contacto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CONTACTO } from '../src/config/site.js';

test('el contacto del pie está completo', () => {
  // Sale en las cuatro páginas públicas y en los cuatro idiomas; un campo
  // vacío deja una línea en blanco en mitad de la columna.
  for (const clave of ['nombre', 'direccion', 'email']) {
    assert.ok(CONTACTO[clave]?.trim().length > 0, `falta ${clave}`);
  }
  assert.match(CONTACTO.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});

test('no queda ninguna pasarela de pago en los datos del sitio', () => {
  // Se comprueba sobre el fichero y no sobre las exportaciones porque lo que
  // se quiere evitar es que vuelva a aparecer un enlace de pago aunque nadie
  // lo pinte todavía: el fallo de ayer fue tener el dato antes que la
  // decisión. Si algún día se reabre, este test se borra a propósito.
  const fuente = readFileSync(fileURLToPath(new URL('../src/config/site.js', import.meta.url)), 'utf8');
  const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/paypal|stripe|ncp\/payment/i.test(codigo), 'ha vuelto un enlace de pago');
});
