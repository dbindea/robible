// El fallo real detrás de «lo que escribo en un dispositivo no se ve en el
// otro»: `syncFromServer` conservaba el contenido cacheado en local SIN mirar
// si el servidor tenía una versión más nueva. `contenidoSigueValido` es la
// función que decide eso, separada para poder probarla sin red ni sin el
// `USE_BACKEND` de Vite (que en un test de Node siempre sale a `false`).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { contenidoSigueValido } from '../src/services/sermons.service.js';

test('sin contenido local, nunca es válido: hay que pedirlo', () => {
  assert.equal(contenidoSigueValido({ content: null, updatedAt: '2026-09-10T10:00:00.000Z' }, { updatedAt: '2026-09-10T09:00:00.000Z' }), false);
  assert.equal(contenidoSigueValido(undefined, { updatedAt: '2026-09-10T09:00:00.000Z' }), false);
});

test('local más nuevo o igual que el remoto: sigue siendo válido', () => {
  const local = { content: '{"marks":[]}', updatedAt: '2026-09-10T10:00:00.000Z' };
  assert.equal(contenidoSigueValido(local, { updatedAt: '2026-09-10T10:00:00.000Z' }), true, 'misma fecha: es lo que YO acabo de subir');
  assert.equal(contenidoSigueValido(local, { updatedAt: '2026-09-10T09:00:00.000Z' }), true, 'local más nuevo: nadie más lo ha tocado desde entonces');
});

test('remoto más nuevo que el local: hay que olvidar el contenido cacheado', () => {
  // Éste es el caso que estaba roto: otro dispositivo editó la predicación
  // después de que ésta descargara su copia, y el servidor lo sabe porque su
  // `updated_at` es más nuevo. Sin esto, el contenido viejo se consideraba
  // bueno para siempre.
  const local = { content: '{"marks":[]}', updatedAt: '2026-09-10T09:00:00.000Z' };
  assert.equal(contenidoSigueValido(local, { updatedAt: '2026-09-10T10:00:00.000Z' }), false);
});

test('la comparación es de cadenas ISO 8601, no de objetos Date', () => {
  // Ambos lados usan `nowIso()`, así que la comparación lexicográfica de
  // cadenas basta — no hace falta parsear fechas para que esto sea correcto.
  const local = { content: 'x', updatedAt: '2026-09-09T23:59:59.999Z' };
  assert.equal(contenidoSigueValido(local, { updatedAt: '2026-09-10T00:00:00.000Z' }), false);
});
