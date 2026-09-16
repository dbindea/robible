// El enlace de donación.
//
// Es la única parte del proyecto donde una errata cuesta dinero de verdad: un
// identificador mal compuesto manda a quien quiere donar a una página que no
// es, y el fallo no produce ningún síntoma del lado de la aplicación — nadie
// se entera salvo quien iba a donar y desistió.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONTACTO, PAYPAL_USUARIO, enlaceDonacion, hayDonaciones } from '../src/config/site.js';

test('el enlace de donación apunta a paypal.me sobre HTTPS', () => {
  const url = new URL(enlaceDonacion());
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'www.paypal.com');
  assert.equal(url.pathname, `/paypalme/${PAYPAL_USUARIO}`);
});

test('el enlace no lleva espacios ni queda a medias', () => {
  const url = enlaceDonacion();
  assert.ok(!/\s/.test(url), 'un espacio en el identificador rompe el enlace');
  assert.ok(!url.endsWith('/'), 'falta el identificador: el enlace acaba en la barra');
});

test('sin usuario configurado no hay donaciones ni enlace', () => {
  // El estado seguro: más vale un pie sin botón que un botón que no se sabe a
  // dónde cobra. Se comprueba con la función, no con la constante, porque es
  // la función la que decide si el componente se pinta.
  const vacio = (v) => v.trim().length > 0;
  assert.equal(vacio(''), false);
  assert.equal(vacio('   '), false);
  assert.equal(hayDonaciones(), vacio(PAYPAL_USUARIO));
});

test('el contacto del pie está completo', () => {
  // Sale en las cuatro páginas públicas y en los cuatro idiomas; un campo
  // vacío deja una línea en blanco en mitad de la columna.
  for (const clave of ['nombre', 'direccion', 'email']) {
    assert.ok(CONTACTO[clave]?.trim().length > 0, `falta ${clave}`);
  }
  assert.match(CONTACTO.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});
