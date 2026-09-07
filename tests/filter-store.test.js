// El store `filter` no debe compartir referencias con quien le escribe.
//
// Por qué existe este test: Sidebar hace `bind:value={searchForm.searchText}`
// sobre su propio objeto y luego lo mete en el store; Result lee
// `$: searchForm = $filter`. Cuando el store guardaba el objeto tal cual, los
// dos componentes acababan apuntando al MISMO objeto y teclear en el buscador
// mutaba el estado de Result por la espalda, sin notificar a nadie.
//
// El síntoma real: buscabas por referencia, borrabas con el aspa, escribías
// otra vez y al pulsar la sugerencia la URL cambiaba pero el texto no se movía.
// Result veía un `searchText` que creía vacío y su guarda interna bloqueaba la
// sincronización del libro y el capítulo desde la URL.
//
// Es un fallo de los que no se ven leyendo el diff de ningún componente, así
// que la protección vive aquí, en el contrato del store.

globalThis.window ??= {};
globalThis.localStorage ??= {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { filter } from '../src/store/stores.js';

test('set() no guarda el objeto que recibe, sino una copia', () => {
  const mio = { searchText: null, searchType: 'reference', testament: 'all', book: [42], chapter: [2] };
  filter.set(mio);

  const guardado = get(filter);
  assert.notEqual(guardado, mio, 'el store no debe quedarse con la referencia');

  // Mutar el objeto original —que es lo que hace `bind:value`— no puede
  // cambiar lo que ve quien lee el store.
  mio.searchText = 'rom 8 28';
  assert.equal(get(filter).searchText, null, 'mutar el objeto original contaminó el store');
});

test('los arrays tampoco se comparten', () => {
  const libros = [42];
  const capitulos = [2];
  filter.set({ searchText: null, searchType: 'match', testament: 'all', book: libros, chapter: capitulos });

  libros.push(44);
  capitulos.push(7);

  assert.deepEqual(get(filter).book, [42], 'el array de libros se compartía');
  assert.deepEqual(get(filter).chapter, [2], 'el array de capítulos se compartía');
});

test('leer el store dos veces no permite contaminarlo desde fuera', () => {
  filter.set({ searchText: null, searchType: 'match', testament: 'all', book: [1], chapter: [0] });

  // Esto es exactamente lo que hacía Result: quedarse con el objeto del store.
  const comoLoLeeResult = get(filter);
  comoLoLeeResult.searchText = 'contaminado';

  // Un `set` posterior tiene que devolver el store a un estado limpio.
  filter.set({ searchText: null, searchType: 'match', testament: 'all', book: [1], chapter: [0] });
  assert.equal(get(filter).searchText, null);
});

test('normaliza los campos que faltan', () => {
  filter.set({});
  assert.deepEqual(get(filter), {
    searchText: null,
    searchType: 'match',
    testament: 'all',
    book: [],
    chapter: [],
  });
});

test('update() también copia', () => {
  filter.set({ searchText: null, searchType: 'match', testament: 'all', book: [5], chapter: [1] });

  let entregado;
  filter.update((actual) => {
    entregado = actual;
    return { ...actual, searchText: 'algo' };
  });

  assert.equal(get(filter).searchText, 'algo');
  // El objeto que recibió el callback no debe seguir enganchado al store.
  entregado.searchText = 'otra cosa';
  assert.equal(get(filter).searchText, 'algo');
});
