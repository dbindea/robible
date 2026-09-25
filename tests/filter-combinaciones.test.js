// Por qué una búsqueda que debería encontrar algo devuelve cero.
//
// El síntoma que se reportó: «hay veces que está seleccionado un libro y, sin
// darte cuenta, no sabes por qué no hay resultados». Es de los peores fallos
// que puede tener un buscador, porque **no falla**: devuelve una lista vacía,
// que es una respuesta perfectamente legítima, y no hay forma de distinguir
// «no existe» de «lo estás buscando donde no está».
//
// Este fichero recorre las combinaciones de `testament`, `book` y `searchType`
// con la Biblia de verdad, para dejar por escrito cuáles devuelven cero y por
// qué motivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { getFilterResult, UMBRAL_AMPLIACION } from '../src/services/filter.service.js';

const DATA = fileURLToPath(new URL('../public/data/vdc/', import.meta.url));
const bible = JSON.parse(readFileSync(join(DATA, 'bible.json'), 'utf8'));
const map = JSON.parse(readFileSync(join(DATA, 'bible.map.json'), 'utf8'));

const GENEZA = 0;   // Antiguo Testamento
const IOAN = 42;    // Nuevo Testamento

/** Un formulario como el que arma el panel lateral. */
const form = (extra = {}) => ({
  searchText: null,
  searchType: 'match',
  testament: 'all',
  book: [],
  chapter: [],
  ...extra,
});

const buscar = (extra) => getFilterResult(bible, map, form(extra));

// ── Lo que tiene que funcionar ──────────────────────────────────────────────

test('buscar una palabra en toda la Biblia devuelve resultados', () => {
  const r = buscar({ searchText: 'dragoste', searchType: 'match' });
  assert.ok(r.length > 50, `«dragoste» debería salir muchas veces, salieron ${r.length}`);
});

test('buscar acotando a un libro de ese testamento funciona', () => {
  const r = buscar({ searchText: 'dragoste', searchType: 'match', testament: 'nt', book: [IOAN] });
  assert.ok(r.length > 0, 'Ioan está en el NT y contiene «dragoste»');
  assert.ok(r.every((v) => v.book === IOAN), 'y sólo debería devolver versículos de Ioan');
});

test('los tres tipos de búsqueda devuelven algo con el mismo texto', () => {
  for (const searchType of ['match', 'every', 'some']) {
    const r = buscar({ searchText: 'dragoste', searchType });
    assert.ok(r.length > 0, `el tipo «${searchType}» no devolvió nada`);
  }
});

test('la búsqueda ignora diacríticos en los dos sentidos', () => {
  const con = buscar({ searchText: 'suferință', searchType: 'match' });
  const sin = buscar({ searchText: 'suferinta', searchType: 'match' });
  assert.ok(con.length > 0 && sin.length > 0);
  assert.equal(con.length, sin.length, 'escribir con o sin diacríticos debe dar lo mismo');
});

// ── EL FALLO: libro de un testamento, filtro del otro ───────────────────────

test('un libro seleccionado MANDA sobre el testamento filtrado', () => {
  // Éste es el caso que se reportó. `getFilterResult` cruzaba las dos listas:
  //
  //   _books = librosDelTestamento.filter((b) => librosSeleccionados.includes(b))
  //
  // y esa intersección puede ser vacía: con Geneza (Antiguo) seleccionada y el
  // filtro en Nuevo Testamento, la búsqueda devolvía CERO resultados para una
  // palabra que está en media Biblia, sin error ni aviso.
  //
  // Ahora gana el libro, que es lo más específico de los dos. La palabra es
  // «Dumnezeu» y no «dragoste» porque tiene que existir en Geneza: si no, el
  // test pasaría por el motivo equivocado.
  const cruzado = buscar({ searchText: 'Dumnezeu', searchType: 'match', testament: 'nt', book: [GENEZA] });
  assert.ok(cruzado.length > 0, 'el libro elegido manda: tiene que buscar en Geneza');
  assert.ok(cruzado.every((v) => v.book === GENEZA), 'y sólo en Geneza');
});

test('lo mismo al revés: libro del Nuevo con el filtro en Antiguo', () => {
  const cruzado = buscar({ searchText: 'Dumnezeu', searchType: 'match', testament: 'ot', book: [IOAN] });
  assert.ok(cruzado.length > 0);
  assert.ok(cruzado.every((v) => v.book === IOAN));
});

test('un libro fuera de rango no revienta ni devuelve basura', () => {
  // La Biblia tiene 66 libros; un índice corrupto en localStorage no puede
  // tumbar el buscador.
  for (const malo of [-1, 66, 999, null, undefined, 'x']) {
    const r = buscar({ searchText: 'Dumnezeu', searchType: 'match', book: [malo] });
    assert.ok(Array.isArray(r), `con book=[${malo}] debería devolver una lista`);
    assert.equal(r.length, 0, 'y estar vacía, porque ese libro no existe');
  }
});

test('un libro seleccionado con testament=all SIEMPRE funciona', () => {
  // `all` contiene los 66, así que el cruce nunca puede quedar vacío. Es la
  // razón de que el fallo sólo aparezca cuando alguien tocó el testamento.
  for (const libro of [GENEZA, IOAN]) {
    const r = buscar({ searchText: 'Dumnezeu', searchType: 'match', testament: 'all', book: [libro] });
    assert.ok(r.length > 0, `con testament=all y el libro ${libro} debería haber resultados`);
  }
});

// ── El libro que se queda pegado al cambiar de modo ─────────────────────────

test('el libro de una búsqueda por referencia acota la búsqueda por texto siguiente', () => {
  // La secuencia que lo produce: buscas «Ioan 3» por referencia —el panel
  // lateral deja `book: [42]`—, cambias a búsqueda por palabras y escribes algo
  // que no está en Ioan. Cero resultados, y el campo de texto no enseña por
  // ningún lado que sigues dentro de un solo libro.
  const enTodaLaBiblia = buscar({ searchText: 'Faraon', searchType: 'match' });
  assert.ok(enTodaLaBiblia.length > 0, '«Faraon» sale en el Antiguo Testamento');

  const soloEnIoan = buscar({ searchText: 'Faraon', searchType: 'match', book: [IOAN] });
  assert.equal(soloEnIoan.length, 0, 'documenta el fallo: sigue acotado al libro anterior');
});

// ── Capítulo fuera de rango ─────────────────────────────────────────────────

test('un capítulo que el libro no tiene no rompe nada, pero da cero', () => {
  // Ioan tiene 21 capítulos. El panel lateral limpia `chapter` al cambiar de
  // libro, pero si algo lo dejara pegado, el resultado es el mismo silencio.
  const r = getFilterResult(bible, map, form({ book: [IOAN], chapter: [40] }));
  assert.equal(r.length, 0);
});

// ── Barrido ─────────────────────────────────────────────────────────────────

test('barrido: sólo las combinaciones cruzadas devuelven cero', () => {
  const palabra = 'Dumnezeu'; // está en los dos testamentos
  const casos = [];
  for (const testament of ['all', 'ot', 'nt']) {
    for (const libro of [null, GENEZA, IOAN]) {
      const r = buscar({
        searchText: palabra,
        searchType: 'match',
        testament,
        book: libro === null ? [] : [libro],
      });
      casos.push({ testament, libro, n: r.length });
    }
  }

  // NINGUNA combinación puede quedarse sin resultados con una palabra que está
  // en los dos testamentos. Antes eran dos —Geneza con filtro NT e Ioan con
  // filtro OT— y ese cero silencioso es justo lo que se vino a arreglar.
  const vacios = casos.filter((c) => c.n === 0);
  assert.deepEqual(vacios, [], `combinaciones sin resultados: ${JSON.stringify(vacios)}`);
});

// ── El modo único sobre la Biblia de verdad ─────────────────────────────────
//
// La regla la puso el usuario: «se busca la expresión y, si sale poco, se
// amplía a las palabras; si salen entre 50 y 200, no». Aquí se comprueba con
// frases reales, porque el tope sólo significa algo contra textos de verdad.

test('una frase que no está literalmente sí encuentra sus palabras', () => {
  // El caso que justificaba el radio «conține cuvintele»: «dragoste Dumnezeu»
  // no está en ningún versículo tal cual, y con las dos palabras sueltas está
  // en decenas. Antes eran cero resultados salvo que supieras cambiar el radio.
  const exacta = buscar({ searchText: 'dragoste Dumnezeu', searchType: 'match' });
  assert.equal(exacta.length, 0, 'la expresión literal no existe');

  const lista = buscar({ searchText: 'dragoste Dumnezeu', searchType: 'smart' });
  assert.ok(lista.length > 20, `debería ampliar y encontrar bastantes, encontró ${lista.length}`);
  assert.ok(lista.every((v) => v.ampliado));
});

test('una frase que sale poco se completa con las parecidas', () => {
  const exacta = buscar({ searchText: 'dragostea lui Dumnezeu', searchType: 'match' });
  assert.ok(exacta.length > 0 && exacta.length <= UMBRAL_AMPLIACION, `salieron ${exacta.length} exactos`);

  const lista = buscar({ searchText: 'dragostea lui Dumnezeu', searchType: 'smart' });
  assert.ok(lista.length > exacta.length, 'tendría que haber añadido los de las palabras sueltas');
  // Los exactos siguen estando y siguen siendo los primeros.
  assert.deepEqual(
    lista.slice(0, exacta.length).map((v) => v.key),
    exacta.map((v) => v.key),
  );
});

test('una frase con muchos resultados NO se amplía', () => {
  // «Duhul Sfânt» sale decenas de veces: la pantalla ya está llena y añadir
  // todos los versículos que dicen «duhul» por un lado y «sfânt» por otro sólo
  // sería ruido debajo de lo que ya estaba bien.
  for (const frase of ['lui Dumnezeu', 'Duhul Sfant', 'imparatia cerurilor']) {
    const exacta = buscar({ searchText: frase, searchType: 'match' });
    assert.ok(exacta.length > UMBRAL_AMPLIACION, `«${frase}» debería tener más de ${UMBRAL_AMPLIACION} exactos`);
    const lista = buscar({ searchText: frase, searchType: 'smart' });
    assert.equal(lista.length, exacta.length, `«${frase}» no debería ampliarse`);
    assert.ok(lista.every((v) => !v.ampliado));
  }
});

test('borrar el texto devuelve el capítulo por defecto, no una lista vacía', () => {
  // Al vaciar el campo, el buscador enseña el capítulo seleccionado. Es lo que
  // hace que la pantalla no se quede en blanco al borrar con el aspa.
  const r = buscar({ searchText: null, book: [IOAN], chapter: [2] });
  assert.ok(r.length > 0, 'sin texto tiene que devolver el capítulo');
  assert.ok(r.every((v) => v.book === IOAN && v.chapter === 3), 'Ioan 3 (el índice 2 es base 0)');
});
