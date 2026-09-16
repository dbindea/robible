// El enlace de donación.
//
// Es la única parte del proyecto donde una errata cuesta dinero de verdad: un
// identificador mal compuesto manda a quien quiere donar a una página que no
// es, y el fallo no produce ningún síntoma del lado de la aplicación — nadie
// se entera salvo quien iba a donar y desistió.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONTACTO, PAYPAL_ENLACE, enlaceDonacion, hayDonaciones } from '../src/config/site.js';

test('el enlace de donación va a paypal.com sobre HTTPS', () => {
  // El dominio se comprueba con `hostname` y no con `includes`: una cadena
  // como `https://paypal.com.example.net/...` contiene «paypal.com» y no es
  // PayPal. Es la comprobación que separa el enlace bueno de una suplantación.
  const url = new URL(enlaceDonacion());
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'www.paypal.com');
});

test('el enlace lleva el identificador de la página de pago', () => {
  const url = new URL(enlaceDonacion());
  assert.match(url.pathname, /^\/ncp\/payment\/[A-Z0-9]+$/, 'no es una página de pago de PayPal');
});

test('el enlace no lleva espacios ni queda a medias', () => {
  const url = enlaceDonacion();
  assert.ok(!/\s/.test(url), 'un espacio rompe el enlace');
  assert.ok(!url.endsWith('/'), 'falta el identificador: el enlace acaba en la barra');
});

test('sin enlace configurado no hay donaciones', () => {
  // El estado seguro: más vale un pie sin botón que un botón que no se sabe a
  // dónde cobra. Se comprueba con la función, no con la constante, porque es
  // la función la que decide si el componente se pinta.
  const vacio = (v) => v.trim().length > 0;
  assert.equal(vacio(''), false);
  assert.equal(vacio('   '), false);
  assert.equal(hayDonaciones(), vacio(PAYPAL_ENLACE));
});

test('el contacto del pie está completo', () => {
  // Sale en las cuatro páginas públicas y en los cuatro idiomas; un campo
  // vacío deja una línea en blanco en mitad de la columna.
  for (const clave of ['nombre', 'direccion', 'email']) {
    assert.ok(CONTACTO[clave]?.trim().length > 0, `falta ${clave}`);
  }
  assert.match(CONTACTO.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});
