// Búsqueda por texto sobre la Biblia en memoria.
//
// `getFilterResult` guarda el formulario en localStorage como efecto colateral,
// así que hace falta un doble mínimo para poder ejecutarlo fuera del navegador.
globalThis.localStorage ??= {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFilterResult, replaceDiacritics } from '../src/services/filter.service.js';

// Biblia de juguete: 3 libros × 2 capítulos × 3 versículos.
const BIBLIA = [
  [
    ['En el principio creó Dios los cielos y la tierra.', 'La tierra estaba desordenada.', 'Y dijo Dios: sea la luz.'],
    ['Y vio Dios que era bueno.', 'Hubo tarde y mañana.', 'Descansó en el día séptimo.'],
  ],
  [
    ['Estos son los nombres.', 'Y creció el pueblo.', 'El Señor oyó su clamor.'],
    ['Moisés apacentaba el rebaño.', 'La zarza ardía sin consumirse.', 'Quítate las sandalias.'],
  ],
  [
    ['Porque de tal manera amó Dios al mundo.', 'El amor es paciente.', 'Dios es amor.'],
    ['Amaos los unos a los otros.', 'Nadie tiene mayor amor.', 'Permaneced en mi amor.'],
  ],
];

const MAPA = { 0: 'Genesis', 1: 'Exodo', 2: 'Juan', ot: [0, 1], nt: [2], all: [0, 1, 2] };

const buscar = (extra = {}) =>
  getFilterResult(BIBLIA, MAPA, { searchType: 'match', testament: 'all', book: [], chapter: [], ...extra });

test('replaceDiacritics quita acentos sin tocar el resto', () => {
  assert.equal(replaceDiacritics('Génesis'), 'Genesis');
  assert.equal(replaceDiacritics('Mântuire'), 'Mantuire');
  assert.equal(replaceDiacritics('creó'), 'creo');
  assert.equal(replaceDiacritics('sin acentos'), 'sin acentos');
});

test('sin texto de búsqueda devuelve el capítulo seleccionado', () => {
  const r = buscar({ searchText: null, book: [2], chapter: [1] });
  assert.equal(r.length, 3);
  assert.equal(r[0].book, 2);
  assert.equal(r[0].chapter, 2, 'el capítulo se devuelve en base 1');
  assert.equal(r[0].index, 1, 'los versículos también empiezan en 1');
  assert.equal(r[0].text, 'Amaos los unos a los otros.');
});

test('busca la expresión completa en toda la Biblia', () => {
  const r = buscar({ searchText: 'Dios' });
  assert.ok(r.length >= 5);
  assert.ok(r.every((v) => v.text.includes('Dios')));
  // Debe cruzar libros, no quedarse en el primero
  assert.ok(new Set(r.map((v) => v.book)).size > 1, 'los resultados deberían abarcar varios libros');
});

test('la búsqueda ignora acentos y mayúsculas', () => {
  const conAcento = buscar({ searchText: 'creó' });
  const sinAcento = buscar({ searchText: 'creo' });
  const mayusculas = buscar({ searchText: 'CREÓ' });
  assert.equal(conAcento.length, 1);
  assert.equal(sinAcento.length, 1);
  assert.equal(mayusculas.length, 1);
  assert.equal(conAcento[0].text, sinAcento[0].text);
});

test('el filtro por testamento acota los libros', () => {
  const at = buscar({ searchText: 'Dios', testament: 'ot' });
  const nt = buscar({ searchText: 'Dios', testament: 'nt' });
  assert.ok(at.every((v) => MAPA.ot.includes(v.book)), 'AT no debería traer libros del NT');
  assert.ok(nt.every((v) => MAPA.nt.includes(v.book)), 'NT no debería traer libros del AT');
});

test('el filtro por libro acota a ese libro', () => {
  const r = buscar({ searchText: 'amor', book: [2] });
  assert.ok(r.length > 0);
  assert.ok(r.every((v) => v.book === 2));
});

test('searchType "every" exige todas las palabras, "some" cualquiera', () => {
  const every = buscar({ searchText: 'Dios amor', searchType: 'every' });
  const some = buscar({ searchText: 'Dios amor', searchType: 'some' });

  assert.ok(every.every((v) => {
    const t = v.text.toLowerCase();
    return t.includes('dios') && t.includes('amor');
  }), '"every" solo debe traer versículos con las dos palabras');

  assert.ok(some.length > every.length, '"some" debería ser más permisivo que "every"');
});

test('una búsqueda de 2 caracteres o menos no devuelve nada', () => {
  // Guarda deliberada: buscar "a" recorrería la Biblia entera para nada.
  assert.equal(buscar({ searchText: 'a' }).length, 0);
  assert.equal(buscar({ searchText: 'de' }).length, 0);
  assert.ok(buscar({ searchText: 'amor' }).length > 0);
});

test('cada resultado trae los campos que la interfaz necesita', () => {
  const [primero] = buscar({ searchText: 'amor' });
  for (const campo of ['book', 'chapter', 'index', 'text', 'key']) {
    assert.ok(campo in primero, `falta el campo "${campo}"`);
  }
  // `key` es lo que usa Result.svelte para el resaltado y como clave del #each:
  // si deja de ser única, Svelte lanza y la lectura con música resalta el
  // versículo equivocado.
  const claves = buscar({ searchText: 'Dios' }).map((v) => v.key);
  assert.equal(new Set(claves).size, claves.length, 'las claves deben ser únicas');
});
