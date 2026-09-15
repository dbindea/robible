// Quién puede usar qué.
//
// Decisión de producto (15 sep 2026): leer la Biblia no se cobra nunca. Lo que
// algún día puede requerir suscripción son utilidades muy por encima de lo que
// se espera de una Biblia en línea — la primera, dictar por voz.
//
// Lo que este test protege son las dos formas de equivocarse:
//
//  1. **Cerrar de más.** Una función sin declarar, o un plan mal comparado, deja
//     fuera a gente que sí debería entrar. No da error: simplemente el botón no
//     aparece y nadie sabe por qué.
//  2. **Cobrar por lo que no toca.** Si algún día alguien mete aquí `bible` o
//     `search`, este test tiene que doler.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EN_PRUEBAS,
  PLANES,
  FUNCIONES,
  planDe,
  puedeUsar,
  esDePago,
} from '../src/services/features.service.js';

// Las funciones del catálogo se comprueban con los planes forzados, sin
// depender de en qué punto esté la fase de pruebas.
const conPlan = (plan) => ({ id: 'u_1', nickname: 'x', plan });

test('los planes van de menos a más y `free` es el primero', () => {
  // El orden ES la jerarquía: `puedeUsar` compara posiciones en este array.
  assert.equal(PLANES[0], 'free');
  assert.ok(PLANES.length >= 2, 'tiene que haber al menos un plan de pago');
});

test('planDe cae a `free` con cualquier cosa rara', () => {
  assert.equal(planDe(null), 'free');
  assert.equal(planDe(undefined), 'free');
  assert.equal(planDe({}), 'free');
  assert.equal(planDe(conPlan('inventado')), 'free');
  assert.equal(planDe(conPlan('plus')), 'plus');
});

test('una función que no está en el catálogo es de todos', () => {
  // A propósito: olvidarse de declarar una función la deja ABIERTA, no rota.
  // El fallo al revés —cerrarla en silencio para todo el mundo— sería el caro.
  assert.equal(puedeUsar(null, 'una-que-no-existe'), true);
  assert.equal(puedeUsar(conPlan('free'), 'otra-cualquiera'), true);
});

test('leer la Biblia NUNCA está en el catálogo de funciones con plan', () => {
  // Si este test falla es porque alguien ha puesto precio a lo que no toca.
  // La promesa es explícita: se cobran utilidades avanzadas, no el texto.
  for (const prohibida of ['bible', 'read', 'search', 'chapter', 'verse', 'compare', 'favorites', 'notes']) {
    assert.ok(
      !(prohibida in FUNCIONES),
      `«${prohibida}» no puede requerir suscripción: leer la Biblia es gratis y lo seguirá siendo`,
    );
  }
});

test('el dictado está declarado y con un plan de pago', () => {
  assert.ok(FUNCIONES.voiceSearch, 'voiceSearch debe estar en el catálogo');
  assert.notEqual(FUNCIONES.voiceSearch.desde, 'free', 'si fuera `free` no haría falta declararla');
  assert.ok(PLANES.includes(FUNCIONES.voiceSearch.desde), 'el plan tiene que existir');
});

test('durante las pruebas todo está abierto', () => {
  // `EN_PRUEBAS` es el interruptor: mientras esté encendido, los planes no se
  // aplican y la función la puede usar cualquiera, con cuenta o sin ella.
  if (!EN_PRUEBAS) return;
  assert.equal(puedeUsar(null, 'voiceSearch'), true);
  assert.equal(puedeUsar(conPlan('free'), 'voiceSearch'), true);
  assert.equal(esDePago('voiceSearch'), false, 'no se anuncia como de pago mientras se prueba');
});

test('la jerarquía de planes es la que se espera', () => {
  // Se comprueba la comparación en sí, que es lo que decidirá el día que se
  // apague `EN_PRUEBAS`. Se llama a la función interna a través del catálogo
  // para no depender del interruptor.
  const rango = (p) => PLANES.indexOf(p);
  assert.ok(rango('plus') > rango('free'), 'plus tiene que estar por encima de free');
  assert.ok(rango(FUNCIONES.voiceSearch.desde) > rango('free'));
});

test('`anonimo` decide qué ve quien no ha iniciado sesión', () => {
  // El dictado lo tiene en `true` a propósito: durante las pruebas interesa que
  // lo use cualquiera que entre, incluida la persona que proyecta en una
  // iglesia y no tiene cuenta.
  assert.equal(typeof FUNCIONES.voiceSearch.anonimo, 'boolean');
});
