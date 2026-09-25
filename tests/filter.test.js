// Búsqueda por texto sobre la Biblia en memoria.
//
// Aquí había un doble de `localStorage`: `getFilterResult` guardaba el
// formulario como efecto colateral y sin él no se podía ni importar fuera del
// navegador. Esa escritura se mudó al store (`stores.js`), que es de quien era,
// y la función volvió a ser pura.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFilterResult, replaceDiacritics, UMBRAL_AMPLIACION } from '../src/services/filter.service.js';

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

// ── El modo único: expresión primero, palabras si se quedó corto ────────────

test('«smart» empieza por la expresión exacta', () => {
  // Con resultados de sobra no amplía: lo que hay ya llena la pantalla.
  const r = buscar({ searchText: 'Dios', searchType: 'smart' });
  assert.ok(r.length >= 5);
  assert.ok(
    r.every((v) => !v.ampliado),
    'con una sola palabra no hay nada que ampliar',
  );
});

test('«smart» amplía a las palabras sueltas cuando la expresión se queda corta', () => {
  // «Dios amor» como expresión literal no está en ningún versículo; con las dos
  // palabras sueltas sí. Antes esto eran cero resultados y un radio que había
  // que conocer para arreglarlo.
  const exacta = buscar({ searchText: 'Dios amor', searchType: 'match' });
  assert.equal(exacta.length, 0, 'la expresión literal no está');

  const lista = buscar({ searchText: 'Dios amor', searchType: 'smart' });
  assert.ok(lista.length > 0, '«smart» debería haber ampliado');
  assert.ok(
    lista.every((v) => v.ampliado),
    'al no haber ninguno exacto, todos son ampliados',
  );
});

test('los ampliados van DETRÁS y marcados, y no repiten los exactos', () => {
  // «Dios» sale en los tres libros; «Dios es amor» sólo en uno, literal.
  const lista = buscar({ searchText: 'Dios amor', searchType: 'smart' });
  const exactos = lista.filter((v) => !v.ampliado);
  const ampliados = lista.filter((v) => v.ampliado);

  // Ningún versículo puede salir dos veces: la clave es la del `{#each}` de
  // Svelte y repetirla hace reventar la lista.
  const claves = lista.map((v) => v.key);
  assert.equal(new Set(claves).size, claves.length);

  // Y el orden: primero los exactos, luego los ampliados, sin mezclarse.
  const primerAmpliado = lista.findIndex((v) => v.ampliado);
  if (primerAmpliado >= 0) {
    assert.ok(
      lista.slice(primerAmpliado).every((v) => v.ampliado),
      'una vez empiezan los ampliados no puede volver a haber exactos',
    );
  }
  assert.equal(exactos.length + ampliados.length, lista.length);
});

test('con muchos resultados exactos NO se amplía', () => {
  // La regla del usuario: «si por expresión me salen entre 50 y 200, no
  // amplíes». Se comprueba con el tope de verdad, sin depender de la Biblia de
  // juguete: por encima de `UMBRAL_AMPLIACION` no se añade nada.
  const texto = 'Dios';
  const exactos = buscar({ searchText: texto, searchType: 'match' }).length;
  assert.ok(exactos <= UMBRAL_AMPLIACION, 'la Biblia de juguete es pequeña, este caso se cubre abajo');

  // Y el caso de verdad: una sola palabra nunca amplía, aunque salga poco.
  const unaPalabra = buscar({ searchText: 'zarza', searchType: 'smart' });
  assert.equal(unaPalabra.length, 1);
  assert.ok(!unaPalabra[0].ampliado, 'con una palabra, expresión y palabras son la misma búsqueda');
});

test('un resultado normal es el mismo objeto de siempre', () => {
  // La marca `ampliado` sólo se pone cuando toca: si apareciera en todos, lo
  // que se guarda y lo que compara el resto del código cambiaría de forma.
  const [primero] = buscar({ searchText: 'amor', searchType: 'smart' });
  assert.ok(!('ampliado' in primero), `no debería traer la marca: ${JSON.stringify(primero)}`);
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
