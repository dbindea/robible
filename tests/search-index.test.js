// El índice de búsqueda tiene que dar EXACTAMENTE lo mismo que el recorrido
// ingenuo que sustituye. Es una optimización, no un cambio de comportamiento:
// si aquí aparece una diferencia, el buscador ha empezado a mentir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { indiceDeLibro, normalizar, quitarDiacriticos, estaIndexado } from '../src/services/search-index.service.js';
import { getFilterResult, replaceDiacritics } from '../src/services/filter.service.js';

const DATA = fileURLToPath(new URL('../public/data/', import.meta.url));
const leerBiblia = (version) => JSON.parse(readFileSync(join(DATA, version, 'bible.json'), 'utf8'));

const versionesInstaladas = readdirSync(DATA, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(DATA, e.name, 'bible.json')))
  .map((e) => e.name);

const vdc = leerBiblia('vdc');
const map = JSON.parse(readFileSync(join(DATA, 'vdc', 'bible.map.json'), 'utf8'));

// ── La invariante de la que depende el resaltado ────────────────────────────

test('quitar diacríticos no cambia la longitud del texto en NINGUNA versión', () => {
  // `Result.svelte` busca las palabras en el texto normalizado y luego corta el
  // texto ORIGINAL con esas posiciones. Eso sólo vale si las dos cadenas miden
  // lo mismo: si una versión trajera un carácter que al descomponerse deja algo
  // más que una marca combinante, el resaltado se desplazaría y marcaría media
  // palabra de al lado. Se comprueba sobre los ~217.000 versículos instalados.
  assert.ok(versionesInstaladas.length >= 4, 'deberían estar al menos las cuatro versiones públicas');

  for (const version of versionesInstaladas) {
    const biblia = leerBiblia(version);
    let revisados = 0;
    for (const libro of biblia) {
      for (const capitulo of libro) {
        for (const texto of capitulo) {
          revisados++;
          if (quitarDiacriticos(texto).length !== texto.length) {
            assert.fail(`«${version}» descuadra la longitud: ${texto.slice(0, 60)}`);
          }
        }
      }
    }
    assert.ok(revisados > 30000, `${version} debería tener más de 30.000 versículos, tiene ${revisados}`);
  }
});

test('normalizar es quitar diacríticos y bajar a minúsculas, nada más', () => {
  for (const texto of ['Mântuire', 'DRAGOSTE', 'Ioan', 'În', 'Señor', '神爱世人']) {
    assert.equal(normalizar(texto), replaceDiacritics(texto).toLowerCase());
  }
});

// ── El índice reproduce la Biblia, versículo a versículo ────────────────────

test('el índice de un libro casa con la Biblia, entrada por entrada', () => {
  const IOAN = 42;
  const { textos, capitulos, versiculos } = indiceDeLibro(vdc, IOAN);

  const total = vdc[IOAN].reduce((suma, capitulo) => suma + capitulo.length, 0);
  assert.equal(textos.length, total, 'el índice debe tener un hueco por versículo');
  assert.equal(capitulos.length, total);
  assert.equal(versiculos.length, total);

  for (let i = 0; i < textos.length; i++) {
    const original = vdc[IOAN][capitulos[i]][versiculos[i]];
    assert.equal(textos[i], normalizar(original), `descuadre en la posición ${i}`);
  }

  // En base 0 los dos, que es lo que espera `filter.service.js` al sumarles 1.
  assert.equal(capitulos[0], 0);
  assert.equal(versiculos[0], 0);
  assert.equal(vdc[IOAN][capitulos[0]][versiculos[0]], vdc[IOAN][0][0]);
});

test('un libro que no existe no revienta: devuelve null', () => {
  for (const malo of [-1, 66, 999, null, undefined, 'x']) {
    assert.equal(indiceDeLibro(vdc, malo), null, `con libro=${malo} debería ser null`);
  }
  assert.equal(indiceDeLibro(null, 0), null);
  assert.equal(indiceDeLibro(undefined, 0), null);
});

test('el índice se construye una sola vez y sólo de los libros que se tocan', () => {
  // Una Biblia recién parseada: nadie la ha indexado todavía.
  const otra = JSON.parse(JSON.stringify(vdc.slice(0, 3)));
  assert.equal(estaIndexado(otra, 0), false);

  const primero = indiceDeLibro(otra, 0);
  assert.equal(estaIndexado(otra, 0), true);
  assert.equal(estaIndexado(otra, 1), false, 'indexar Geneza no puede indexar Exodul');

  // La segunda llamada devuelve el MISMO objeto, no uno nuevo: es lo que hace
  // que buscar cueste 4 ms en vez de 65.
  assert.equal(indiceDeLibro(otra, 0), primero);
});

// ── La regresión que de verdad importa ──────────────────────────────────────

/** El recorrido de antes del índice, tal cual estaba escrito. */
const buscarIngenuo = (bible, mapa, form) => {
  const salida = [];
  const librosTestamento = mapa[form.testament] || mapa.all || [];
  const elegidos = Array.isArray(form.book) ? form.book : [];
  const libros = elegidos.length
    ? elegidos.filter((v) => Number.isInteger(v) && v >= 0 && v < bible.length)
    : librosTestamento;
  const texto = form.searchText?.trim();
  if (!texto || texto.length <= 2) return salida;
  const buscado = replaceDiacritics(texto).toLowerCase();
  const palabras = buscado.split(/[ ,.-]+/).filter(Boolean);

  bible.forEach((libro, indexBook) => {
    if (!libros.includes(indexBook)) return;
    libro.forEach((capitulo, indexChapter) => {
      capitulo.forEach((verso, indexVerse) => {
        const normalizado = replaceDiacritics(verso).toLowerCase();
        let vale = false;
        if (form.searchType === 'match') vale = normalizado.includes(buscado);
        else if (form.searchType === 'every') vale = palabras.every((p) => normalizado.includes(p));
        else if (form.searchType === 'some') vale = palabras.some((p) => normalizado.includes(p));
        if (vale) {
          salida.push({
            book: indexBook,
            chapter: indexChapter + 1,
            index: indexVerse + 1,
            text: verso,
            key: `${indexBook}-${indexChapter}-${indexVerse}`,
          });
        }
      });
    });
  });
  return salida;
};

test('buscar con índice da exactamente lo mismo que el recorrido de antes', () => {
  const casos = [];
  for (const searchText of ['dragoste', 'Dumnezeu', 'suferință', 'har', 'dragostea lui Dumnezeu', 'ADEVĂRUL']) {
    for (const searchType of ['match', 'every', 'some']) {
      for (const ambito of [{}, { testament: 'nt' }, { testament: 'ot' }, { book: [42] }]) {
        casos.push({ searchText, searchType, testament: 'all', book: [], chapter: [], ...ambito });
      }
    }
  }

  for (const form of casos) {
    const conIndice = getFilterResult(vdc, map, form);
    const ingenuo = buscarIngenuo(vdc, map, form);
    const etiqueta = `«${form.searchText}» / ${form.searchType} / ${form.testament} / ${JSON.stringify(form.book)}`;
    assert.equal(conIndice.length, ingenuo.length, `distinto número de resultados en ${etiqueta}`);
    // Mismo orden y mismos campos, no sólo el mismo recuento: el orden canónico
    // es lo que hace que la lista se lea de Geneza a Apocalipsa.
    assert.deepEqual(conIndice, ingenuo, `distinto contenido en ${etiqueta}`);
  }
});

test('un searchType desconocido sigue devolviendo lista vacía', () => {
  // El modo proyección depende de esto: sin `searchType` cae aquí (trampa 87).
  for (const searchType of [undefined, null, '', 'reference', 'loquesea']) {
    const r = getFilterResult(vdc, map, { searchText: 'dragoste', searchType, testament: 'all', book: [], chapter: [] });
    assert.equal(r.length, 0, `«${searchType}» no debería devolver nada`);
  }
});

test('un libro repetido en el formulario no duplica resultados', () => {
  // El recorrido va ahora por la lista de libros y no por la Biblia entera, así
  // que un duplicado sacaría el mismo versículo dos veces —y dos veces la misma
  // `key`, que es lo que hace reventar al `{#each}` de Svelte.
  const una = getFilterResult(vdc, map, { searchText: 'dragoste', searchType: 'match', testament: 'all', book: [42], chapter: [] });
  const dos = getFilterResult(vdc, map, { searchText: 'dragoste', searchType: 'match', testament: 'all', book: [42, 42], chapter: [] });
  assert.deepEqual(dos, una);

  // Y desordenados, salen igualmente en orden canónico.
  const desordenados = getFilterResult(vdc, map, { searchText: 'dragoste', searchType: 'match', testament: 'all', book: [42, 0], chapter: [] });
  const libros = desordenados.map((v) => v.book);
  assert.deepEqual(libros, [...libros].sort((a, b) => a - b), 'los libros deberían salir en orden');
});
