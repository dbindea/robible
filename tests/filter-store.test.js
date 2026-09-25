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
import { createReferenceSearchForm, filter } from '../src/store/stores.js';

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
    searchType: 'smart',
    testament: 'all',
    book: [],
    chapter: [],
  });
});

// ── Irse a una referencia ───────────────────────────────────────────────────
//
// El fallo que cubre: desde la búsqueda por palabras se escribía «ioan 10 14»,
// el panel lo detectaba y ofrecía «Ioan 10:14», y al pulsarla NO PASABA NADA.
// La dirección cambiaba a /biblia/vdc/ioan/10/14 y la pantalla se quedaba con
// cero versículos y el título de la búsqueda.
//
// Eran dos guardas de `Result.svelte` en cadena: con `searchText` puesto se
// niega a sincronizar libro y capítulo desde la URL, y sin libro seleccionado
// `syncCurrentBiblePath` reescribe la dirección a `/`.

test('el formulario de una referencia deja de ser una búsqueda', () => {
  const buscando = { searchText: 'ioan 10 14', searchType: 'reference', testament: 'nt', book: [], chapter: [] };
  const enDestino = createReferenceSearchForm(buscando, { book: 42, chapter: 10 }, 'smart');

  assert.equal(enDestino.searchText, null, 'con texto, Result no sincroniza desde la URL');
  assert.deepEqual(enDestino.book, [42], 'sin libro, la URL se reescribe a /');
  assert.deepEqual(enDestino.chapter, [9], 'el capítulo va en base 0 en el formulario');
  assert.equal(enDestino.searchType, 'smart', 'el modo se puede devolver al que tenía el usuario');
  assert.equal(enDestino.testament, 'nt', 'el ámbito no es cosa de esto y se conserva');
});

test('una referencia sin capítulo no inventa uno', () => {
  const soloLibro = createReferenceSearchForm({}, { book: 0, chapter: null });
  assert.deepEqual(soloLibro.book, [0], 'Geneza es el libro 0 y no puede perderse por ser falsy');
  assert.deepEqual(soloLibro.chapter, []);
});

test('sin modo nuevo se conserva el que había', () => {
  const previo = { searchType: 'reference' };
  assert.equal(createReferenceSearchForm(previo, { book: 1, chapter: 2 }).searchType, 'reference');
});

test('el formulario de referencia también es una copia', () => {
  // Misma razón que el resto del fichero: si devolviera los arrays del objeto
  // que recibe, el alias de la trampa 26 volvería a formarse por otro sitio.
  const previo = { book: [5], chapter: [1] };
  const nuevo = createReferenceSearchForm(previo, { book: 7, chapter: 3 });
  nuevo.book.push(99);
  assert.deepEqual(previo.book, [5]);
});

test('los tipos de búsqueda viejos se traducen al modo único', () => {
  // `match`, `every` y `some` eran tres radios; hoy son uno solo que decide por
  // su cuenta. Lo que llega de una búsqueda guardada en el servidor o de un
  // localStorage anterior al cambio tiene que caer en el modo nuevo: con el
  // valor viejo, los radios se quedaban los dos sin marcar y no había forma de
  // saber en qué modo se estaba buscando.
  for (const viejo of ['match', 'every', 'some', 'loquesea', undefined, null]) {
    filter.set({ searchType: viejo });
    assert.equal(get(filter).searchType, 'smart', `«${viejo}» debería caer en smart`);
  }

  // El único que sobrevive, porque sigue siendo un modo aparte.
  filter.set({ searchType: 'reference' });
  assert.equal(get(filter).searchType, 'reference');
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
