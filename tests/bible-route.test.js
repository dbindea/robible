// Rutas de la Biblia: construir, parsear y los slugs de libro.
//
// Es el módulo con más superficie de fallo silencioso de la app: todas las URLs
// pasan por aquí, los slugs dependen del idioma activo (Geneza / Génesis), y un
// desajuste no lanza error — simplemente lleva al capítulo equivocado o a la
// portada.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIBLE_ROUTE_PREFIX,
  slugifyBookName,
  getBookSlug,
  getBookIdFromSlug,
  buildBiblePath,
  parseBiblePath,
  parseLegacyVersePath,
} from '../src/services/bible-route.service.js';

// Mapa mínimo con los casos que importan: diacríticos rumanos y españoles,
// nombres con número delante y con espacios.
const MAPA = {
  0: 'Geneza',
  4: 'Deuteronomul',
  8: '1 Samuel',
  9: '2 Samuel',
  18: 'Psalmii',
  42: 'Ioan',
  44: 'Romani',
  61: '1 Ioan',
  65: 'Apocalipsa',
  all: [0, 4, 8, 9, 18, 42, 44, 61, 65],
};

const MAPA_ES = {
  0: 'Génesis',
  8: '1 Samuel',
  42: 'Juan',
  all: [0, 8, 42],
};

// Chino: no tiene alfabeto latino. Con el filtro antiguo `[^a-z0-9]` estos
// nombres se vaciaban enteros, los 66 libros compartían el slug '' y toda ruta
// caía en Génesis.
const MAPA_ZH = {
  0: '创世纪',
  18: '诗篇',
  42: '约翰福音',
  65: '启示录',
  all: [0, 18, 42, 65],
};

test('slugifyBookName quita diacríticos y normaliza', () => {
  assert.equal(slugifyBookName('Geneza'), 'geneza');
  assert.equal(slugifyBookName('Génesis'), 'genesis');
  assert.equal(slugifyBookName('Psalmii'), 'psalmii');
  assert.equal(slugifyBookName('1 Samuel'), '1-samuel');
  assert.equal(slugifyBookName('Faptele Apostolilor'), 'faptele-apostolilor');
  // Sin guiones sueltos en los extremos
  assert.equal(slugifyBookName('  Ioan  '), 'ioan');
  assert.equal(slugifyBookName('¿Qué?'), 'que');
  assert.equal(slugifyBookName(''), '');
  assert.equal(slugifyBookName(undefined), '');
});

test('getBookSlug y getBookIdFromSlug son inversos en todos los libros del mapa', () => {
  for (const id of MAPA.all) {
    const slug = getBookSlug(MAPA, id);
    assert.equal(getBookIdFromSlug(MAPA, slug), id, `ida y vuelta rota para ${MAPA[id]} (slug "${slug}")`);
  }
});

test('getBookIdFromSlug tolera acentos y mayúsculas en la entrada', () => {
  assert.equal(getBookIdFromSlug(MAPA_ES, 'génesis'), 0);
  assert.equal(getBookIdFromSlug(MAPA_ES, 'Genesis'), 0);
  assert.equal(getBookIdFromSlug(MAPA_ES, 'GÉNESIS'), 0);
});

test('getBookIdFromSlug devuelve undefined si el libro no existe', () => {
  assert.equal(getBookIdFromSlug(MAPA, 'libro-inventado'), undefined);
});

test('los nombres en alfabetos no latinos producen slugs distintos y no vacíos', () => {
  const slugs = MAPA_ZH.all.map((id) => getBookSlug(MAPA_ZH, id));
  for (const [i, slug] of slugs.entries()) {
    assert.notEqual(slug, '', `el libro ${MAPA_ZH[MAPA_ZH.all[i]]} produce un slug vacío`);
  }
  assert.equal(new Set(slugs).size, slugs.length, 'los slugs deben ser únicos entre libros');
  assert.equal(getBookSlug(MAPA_ZH, 42), '约翰福音');
});

test('ida y vuelta en chino: cada libro se recupera desde su slug', () => {
  for (const id of MAPA_ZH.all) {
    const ruta = buildBiblePath({ version: 'zh_cuv', map: MAPA_ZH, book: id, chapter: 3, verse: 16 });
    const parseada = parseBiblePath(ruta);
    assert.equal(getBookIdFromSlug(MAPA_ZH, parseada.bookSlug), id, `ida y vuelta rota para ${MAPA_ZH[id]}`);
  }
});

test('la ruta en chino sobrevive a la codificación de URL del navegador', () => {
  // El navegador percent-encodea el path; parseBiblePath tiene que decodificar.
  const ruta = buildBiblePath({ version: 'zh_cuv', map: MAPA_ZH, book: 42, chapter: 3, verse: 16 });
  const comoLaDevuelveElNavegador = ruta.split('/').map(encodeURIComponent).join('/');
  const parseada = parseBiblePath(comoLaDevuelveElNavegador);
  assert.equal(getBookIdFromSlug(MAPA_ZH, parseada.bookSlug), 42);
  assert.equal(parseada.chapter, 3);
  assert.equal(parseada.verse, 16);
});

test('buildBiblePath monta la ruta con versión, libro, capítulo y versículo', () => {
  assert.equal(buildBiblePath({ version: 'vdc', map: MAPA, book: 42, chapter: 3, verse: 16 }), '/biblia/vdc/ioan/3/16');
  assert.equal(buildBiblePath({ version: 'vdc', map: MAPA, book: 42, chapter: 3 }), '/biblia/vdc/ioan/3');
  assert.equal(buildBiblePath({ version: 'vdc', map: MAPA, book: 42 }), '/biblia/vdc/ioan');
  assert.equal(buildBiblePath({ version: 'rvl', map: MAPA_ES, book: 0, chapter: 1, verse: 1 }), '/biblia/rvl/genesis/1/1');
});

test('buildBiblePath cae a la portada sin versión o sin libro', () => {
  assert.equal(buildBiblePath({ map: MAPA, book: 42, chapter: 3 }), '/');
  assert.equal(buildBiblePath({ version: 'vdc', map: MAPA, book: null }), '/');
  assert.equal(buildBiblePath({ version: 'vdc', map: MAPA, book: undefined }), '/');
});

test('buildBiblePath acepta el libro 0 (Génesis), que es falsy', () => {
  // Un `if (!book)` en vez de comprobar null/undefined rompería justo aquí.
  assert.equal(buildBiblePath({ version: 'vdc', map: MAPA, book: 0, chapter: 1 }), '/biblia/vdc/geneza/1');
});

test('parseBiblePath entiende las cuatro formas de la ruta', () => {
  assert.deepEqual(parseBiblePath('/biblia/vdc/ioan/3/16'), {
    version: 'vdc',
    bookSlug: 'ioan',
    chapter: 3,
    verse: 16,
  });
  assert.deepEqual(parseBiblePath('/biblia/vdc/ioan/3'), {
    version: 'vdc',
    bookSlug: 'ioan',
    chapter: 3,
    verse: null,
  });
  assert.deepEqual(parseBiblePath('/biblia/vdc/ioan'), {
    version: 'vdc',
    bookSlug: 'ioan',
    chapter: null,
    verse: null,
  });
  // Con barra final y con .html (las páginas SEO estáticas)
  assert.equal(parseBiblePath('/biblia/vdc/ioan/3/').chapter, 3);
  assert.equal(parseBiblePath('/biblia/vdc/ioan/3.html').chapter, 3);
});

test('parseBiblePath devuelve null en rutas que no son de Biblia', () => {
  for (const ruta of ['/', '/landing', '/compara', '/indice', '/biblia', '/biblia/vdc', '/otra/vdc/ioan/3']) {
    assert.equal(parseBiblePath(ruta), null, `debería ignorar ${ruta}`);
  }
});

test('ida y vuelta completa: buildBiblePath → parseBiblePath → mismo libro', () => {
  for (const id of MAPA.all) {
    const ruta = buildBiblePath({ version: 'vdc', map: MAPA, book: id, chapter: 2, verse: 7 });
    const parseada = parseBiblePath(ruta);
    assert.equal(getBookIdFromSlug(MAPA, parseada.bookSlug), id);
    assert.equal(parseada.chapter, 2);
    assert.equal(parseada.verse, 7);
  }
});

test('parseLegacyVersePath solo acepta la forma antigua completa', () => {
  assert.deepEqual(parseLegacyVersePath('/verse/vdc/42/3/16'), {
    version: 'vdc',
    book: 42,
    chapter: 3,
    verse: 16,
  });
  assert.equal(parseLegacyVersePath('/verse/vdc/42/3'), null);
  assert.equal(parseLegacyVersePath('/biblia/vdc/ioan/3/16'), null);
});

test('el prefijo de ruta es el esperado', () => {
  assert.equal(BIBLE_ROUTE_PREFIX, '/biblia');
});
