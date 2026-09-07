// Predicaciones: la parte que no puede fallar es la de no perder trabajo.
//
// Este servicio invierte el patrón del resto de la app: escribe primero en el
// dispositivo y sincroniza después. El motivo es el Modo Amvon — un predicador
// en el púlpito no puede depender de la cobertura, y un guardado perdido por
// un wifi malo es trabajo tirado.
//
// Sin VITE_API_BASE_URL, USE_BACKEND es false y se recorre exactamente el
// camino sin conexión, que es justo el que hay que proteger.

globalThis.window ??= {};
globalThis.localStorage ??= {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
  get length() { return this._d.size; },
  key(i) { return [...this._d.keys()][i]; },
};
globalThis.crypto ??= (await import('node:crypto')).webcrypto;

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SERMON_STATUSES,
  SERMON_TYPES,
  createSermon,
  deleteSermon,
  duplicateSermon,
  getSermon,
  loadSermons,
  pendingCount,
  resetAll,
  setCurrentUser,
  updateSermon,
} from '../src/services/sermons.service.js';

const limpiar = () => {
  setCurrentUser('u_predicador');
  resetAll();
};

const nueva = (extra = {}) => createSermon({
  title: 'Casa zidită pe stâncă',
  book: 39, chapter: 7, verseStart: 24, verseEnd: 27,
  version: 'vdc', type: 'expositive',
  ...extra,
});

// ── Catálogos ───────────────────────────────────────────

test('los tipos y estados son los previstos, sin inventos', () => {
  assert.deepEqual(SERMON_TYPES, ['expositive', 'textual', 'thematic']);
  assert.deepEqual(SERMON_STATUSES, ['draft', 'ready', 'preached']);
});

// ── Creación ────────────────────────────────────────────

test('crear guarda en el dispositivo y arranca en borrador', async () => {
  limpiar();
  const res = await nueva();
  assert.equal(res.ok, true);
  assert.equal(res.sermon.status, 'draft');
  assert.equal(res.sermon.verseEnd, 27);
  assert.equal(loadSermons().length, 1);
});

test('sin versículo final se usa el inicial', async () => {
  limpiar();
  const res = await nueva({ verseStart: 16, verseEnd: undefined });
  assert.equal(res.sermon.verseEnd, 16);
});

test('sin conexión la predicación recibe un id local y queda pendiente', async () => {
  limpiar();
  const res = await nueva();
  assert.ok(res.sermon.id.startsWith('local_'), `id inesperado: ${res.sermon.id}`);
  assert.equal(loadSermons().length, 1, 'debe estar en el dispositivo aunque no haya servidor');
});

// ── Guardado ────────────────────────────────────────────

test('guardar devuelve ok aunque no haya llegado al servidor', async () => {
  limpiar();
  const { sermon } = await nueva();
  const res = await updateSermon(sermon.id, { content: '{"idea":"Auzirea plus împlinirea"}' });

  // Para el usuario el trabajo ESTÁ guardado: decirle lo contrario le haría
  // repetirlo sin necesidad. `synced` es lo que distingue los dos casos.
  assert.equal(res.ok, true);
  assert.equal(res.synced, false);
  assert.equal(getSermon(sermon.id).content, '{"idea":"Auzirea plus împlinirea"}');
});

test('el guardado es parcial: no borra lo que no se manda', async () => {
  limpiar();
  const { sermon } = await nueva();
  await updateSermon(sermon.id, { content: '{"a":1}' });
  await updateSermon(sermon.id, { outline: '{"b":2}' });

  const guardada = getSermon(sermon.id);
  assert.equal(guardada.content, '{"a":1}', 'el contenido no debería haberse perdido');
  assert.equal(guardada.outline, '{"b":2}');
});

test('marcar como preparada o predicada pone su fecha', async () => {
  limpiar();
  const { sermon } = await nueva();

  await updateSermon(sermon.id, { status: 'ready' });
  assert.ok(getSermon(sermon.id).preparedAt, 'falta preparedAt');

  await updateSermon(sermon.id, { status: 'preached' });
  assert.ok(getSermon(sermon.id).preachedAt, 'falta preachedAt');
});

test('guardar en una predicación que no existe no crea una nueva', async () => {
  limpiar();
  const res = await updateSermon('sermon_inventado', { content: '{}' });
  assert.equal(res.ok, false);
  assert.equal(loadSermons().length, 0);
});

// ── Cola de pendientes ──────────────────────────────────

test('lo que no se ha subido queda contado', async () => {
  limpiar();
  assert.equal(pendingCount(), 0);
  const { sermon } = await nueva();
  await updateSermon(sermon.id, { content: '{"x":1}' });
  assert.ok(pendingCount() >= 1, 'un cambio sin subir debería contarse');
});

test('borrar limpia también su marca de pendiente', async () => {
  limpiar();
  const { sermon } = await nueva();
  await updateSermon(sermon.id, { content: '{"x":1}' });
  await deleteSermon(sermon.id);
  assert.equal(loadSermons().length, 0);
  assert.equal(pendingCount(), 0);
});

// ── Lista ───────────────────────────────────────────────

test('la lista no arrastra el contenido de cada predicación', async () => {
  limpiar();
  const { sermon } = await nueva();
  await updateSermon(sermon.id, { content: 'x'.repeat(5000) });

  const [cabecera] = loadSermons();
  assert.equal(cabecera.content, undefined, 'la lista no debe traer el contenido');
  assert.equal(cabecera.outline, undefined);
  assert.ok(cabecera.title, 'pero sí lo que se pinta en la tarjeta');
});

test('la lista se ordena por lo último tocado', async () => {
  limpiar();
  const a = await nueva({ title: 'Primera' });
  await new Promise((r) => setTimeout(r, 5));
  await nueva({ title: 'Segunda' });
  await new Promise((r) => setTimeout(r, 5));
  await updateSermon(a.sermon.id, { content: '{}' });

  assert.equal(loadSermons()[0].title, 'Primera', 'la recién tocada va primero');
});

// ── Copias ──────────────────────────────────────────────

test('duplicar copia la preparación pero vuelve a borrador', async () => {
  limpiar();
  const { sermon } = await nueva();
  await updateSermon(sermon.id, {
    content: '{"idea":"x"}', outline: '{"puntos":1}', status: 'preached',
  });

  const copia = await duplicateSermon(sermon.id);
  assert.equal(copia.ok, true);
  assert.notEqual(copia.sermon.id, sermon.id, 'debe ser otra predicación');
  assert.equal(copia.sermon.status, 'draft', 'la copia empieza de cero en el ciclo');
  assert.equal(copia.sermon.content, '{"idea":"x"}', 'la preparación es lo que se reaprovecha');
  assert.equal(copia.sermon.outline, '{"puntos":1}');
  assert.equal(copia.sermon.preachedAt, null, 'no se hereda haber sido predicada');

  // Y el original no se toca.
  assert.equal(getSermon(sermon.id).status, 'preached');
});

// ── Aislamiento entre usuarios ──────────────────────────

test('las predicaciones de un usuario no se ven desde otro', async () => {
  setCurrentUser('u_uno');
  resetAll();
  await nueva({ title: 'De uno' });

  setCurrentUser('u_dos');
  resetAll();
  assert.deepEqual(loadSermons(), [], 'el segundo no debería ver nada');

  setCurrentUser('u_uno');
  assert.equal(loadSermons().length, 1, 'el primero conserva la suya');
  resetAll();
});
