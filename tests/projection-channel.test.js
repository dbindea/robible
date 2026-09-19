// El contrato entre la ventana de control y la ventana proyectada.
//
// Son dos documentos distintos que se hablan por `BroadcastChannel`, así que
// no hay compilador que avise si dejan de entenderse: el síntoma sería una
// pantalla de iglesia en negro, o —peor— la consola del operador proyectada
// delante de la congregación.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MENSAJES,
  NOMBRE_CANAL,
  NOMBRE_VENTANA,
  RUTA_PANTALLA,
  abrirCanal,
  soportaCanal,
} from '../src/services/projection-channel.service.js';

test('la ruta de la ventana proyectada lleva el parámetro que la identifica', () => {
  // `Projection.svelte` decide qué pintar con `ecran === '1'`. Si esta ruta y
  // esa comprobación se separan, la ventana que se manda al proyector abre la
  // consola del operador: la congregación vería el buscador y los controles.
  const url = new URL(RUTA_PANTALLA, 'https://robible.com');
  assert.equal(url.pathname, '/proiectie');
  assert.equal(url.searchParams.get('ecran'), '1');
});

test('la ventana tiene nombre, para no abrir dos proyecciones', () => {
  // `window.open` reutiliza por nombre: sin él, cada clic abriría otra ventana
  // y habría dos discutiendo por el mismo proyector.
  assert.ok(NOMBRE_VENTANA.trim().length > 0);
  assert.ok(!/\s/.test(NOMBRE_VENTANA), 'un nombre con espacios lo ignoran algunos navegadores');
});

test('el canal lleva el prefijo del proyecto', () => {
  // Es un nombre global del origen: sin prefijo podría chocar con el de otra
  // aplicación servida desde el mismo dominio.
  assert.ok(NOMBRE_CANAL.startsWith('robible:'));
});

test('los cinco tipos de mensaje son distintos entre sí', () => {
  // Eran cuatro hasta el 19 sep 2026; `ceder` es el quinto. Si dos compartieran
  // nombre, cada extremo procesaría mensajes que no son suyos.
  const valores = Object.values(MENSAJES);
  assert.equal(valores.length, 5);
  assert.equal(new Set(valores).size, 5, 'dos mensajes con el mismo nombre se confundirían');
});

test('sin BroadcastChannel el canal es inerte, no null', () => {
  // Quien lo usa no comprueba nada: llama a `enviar` y `cerrar` sin más. Si
  // aquí volviera `null`, la proyección en UNA pantalla —que no necesita canal
  // para nada— reventaría en un navegador viejo.
  const original = globalThis.BroadcastChannel;
  try {
    delete globalThis.BroadcastChannel;
    assert.equal(soportaCanal(), false);
    const canal = abrirCanal(() => {});
    assert.equal(typeof canal.enviar, 'function');
    assert.equal(typeof canal.cerrar, 'function');
    canal.enviar({ tipo: MENSAJES.ESTADO });
    canal.cerrar();
  } finally {
    if (original) globalThis.BroadcastChannel = original;
  }
});

test('con BroadcastChannel, dos extremos se entienden', async () => {
  if (!soportaCanal()) return; // Node sin la API: nada que comprobar

  const recibidos = [];
  const receptor = abrirCanal((m) => recibidos.push(m));
  const emisor = abrirCanal();

  emisor.enviar({ tipo: MENSAJES.ESTADO, estado: { indice: 3 } });
  // `BroadcastChannel` entrega en un turno posterior del bucle de eventos.
  await new Promise((r) => setTimeout(r, 30));

  assert.equal(recibidos.length, 1);
  assert.equal(recibidos[0].tipo, MENSAJES.ESTADO);
  assert.equal(recibidos[0].estado.indice, 3);

  emisor.cerrar();
  receptor.cerrar();
});
