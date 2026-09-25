// «Cero resultados» que en realidad son un idioma equivocado.
//
// Lo que hay que vigilar aquí no es tanto que encuentre —eso es el buscador de
// siempre— sino lo que CUESTA encontrarlo: cada versión pesa entre 1 y 4 MB, y
// un aviso que se baje tres Biblias para decir que no hay nada es peor que no
// tenerlo. Estas pruebas doblan `fetch` y la Cache API para contar descargas.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ordenarCandidatas,
  primeraVersionConResultados,
  olvidarVersionConsultada,
} from '../src/services/cross-version-search.service.js';

// ── Biblias de juguete, una por versión ─────────────────────────────────────
const MAPA = { 0: 'Geneza', 1: 'Exodul', ot: [0], nt: [1], all: [0, 1] };

const BIBLIAS = {
  vdc: [[['La început a făcut Dumnezeu cerurile.']], [['Dragostea este îndelung răbdătoare.']]],
  rvl: [[['En el principio creó Dios los cielos.']], [['El amor es paciente.']]],
  en_kjv: [[['In the beginning God created the heaven.']], [['Charity suffereth long.']]],
};

let descargas = [];
let enCache = new Set();

const respuesta = (datos) => ({ ok: true, json: async () => datos });

beforeEach(() => {
  olvidarVersionConsultada();
  descargas = [];
  enCache = new Set();

  globalThis.fetch = async (url, opciones) => {
    if (opciones?.signal?.aborted) throw new Error('abortado');
    const [, , version, fichero] = url.split('/');
    descargas.push(`${version}/${fichero}`);
    if (fichero === 'bible.map.json') return respuesta(MAPA);
    const biblia = BIBLIAS[version];
    if (!biblia) return { ok: false, status: 404, json: async () => null };
    return respuesta(biblia);
  };

  globalThis.caches = {
    match: async (url) => {
      const version = url.split('/')[2];
      return enCache.has(version) ? respuesta(null) : undefined;
    },
  };
});

const formulario = (texto, extra = {}) => ({
  searchText: texto,
  searchType: 'match',
  testament: 'all',
  book: [],
  chapter: [],
  ...extra,
});

/** Cuántas versiones distintas se han bajado (el mapa no cuenta, son 2 KB). */
const versionesDescargadas = () => new Set(descargas.filter((d) => d.endsWith('bible.json')).map((d) => d.split('/')[0]));

// ── El caso del usuario ─────────────────────────────────────────────────────

test('encuentra la versión que sí tiene la palabra', async () => {
  // Con el español puesto, buscando una palabra rumana.
  const r = await primeraVersionConResultados(formulario('dragostea'), ['vdc', 'en_kjv']);
  assert.ok(r, 'debería encontrar la rumana');
  assert.equal(r.version, 'vdc');
  assert.equal(r.count, 1);
  assert.equal(r.bibleName, 'Biblia Română');
});

test('si no está en ninguna, no inventa un aviso', async () => {
  const r = await primeraVersionConResultados(formulario('zzzzz'), ['vdc', 'rvl', 'en_kjv']);
  assert.equal(r, null);
});

test('se para en la PRIMERA con resultados, no las prueba todas', async () => {
  enCache = new Set(['vdc', 'rvl', 'en_kjv']);
  const r = await primeraVersionConResultados(formulario('Dios'), ['rvl', 'vdc', 'en_kjv']);
  assert.equal(r.version, 'rvl');
  assert.deepEqual([...versionesDescargadas()], ['rvl'], 'no debería mirar más allá de la primera que acierta');
});

// ── Lo que cuesta ───────────────────────────────────────────────────────────

test('de las que no están guardadas se baja COMO MUCHO una', async () => {
  // Ninguna en caché y la palabra no está en ninguna: el peor caso posible.
  const r = await primeraVersionConResultados(formulario('zzzzz'), ['vdc', 'rvl', 'en_kjv']);
  assert.equal(r, null);
  assert.equal(versionesDescargadas().size, 1, `se bajó ${[...versionesDescargadas()]}`);
});

test('las que ya están en la caché se miran todas y salen gratis', async () => {
  // Es el caso real: el service worker precachea `vdc` y `rvl`, así que el
  // rumano con el español puesto se resuelve sin tocar la red.
  enCache = new Set(['vdc', 'rvl']);
  const r = await primeraVersionConResultados(formulario('dragostea'), ['rvl', 'vdc']);
  assert.equal(r.version, 'vdc');
  // Se leen las dos —rvl no tiene la palabra, vdc sí— y ninguna gasta la
  // descarga única, que sigue disponible para una tercera sin guardar.
  assert.deepEqual([...versionesDescargadas()].sort(), ['rvl', 'vdc']);
});

test('una consulta corta no mira nada', async () => {
  for (const texto of ['', '  ', 'dr']) {
    const r = await primeraVersionConResultados(formulario(texto), ['vdc']);
    assert.equal(r, null, `«${texto}» no debería disparar nada`);
  }
  assert.equal(descargas.length, 0);
});

test('la versión consultada se reutiliza en vez de volver a bajarse', async () => {
  await primeraVersionConResultados(formulario('dragostea'), ['vdc']);
  const antes = descargas.length;
  await primeraVersionConResultados(formulario('Dumnezeu'), ['vdc']);
  assert.equal(descargas.length, antes, 'la segunda consulta no debería descargar nada');
});

// ── Que el aviso no mienta ──────────────────────────────────────────────────

test('cuenta con el MISMO filtro, no con la Biblia entera', async () => {
  // Si el aviso promete N resultados, al cambiar de versión tienen que salir N.
  // Con el ámbito en Antiguo Testamento, la palabra del libro 1 no cuenta.
  enCache = new Set(['vdc']);
  const enTodo = await primeraVersionConResultados(formulario('dragostea'), ['vdc']);
  assert.equal(enTodo.count, 1);

  olvidarVersionConsultada();
  const soloAntiguo = await primeraVersionConResultados(formulario('dragostea', { testament: 'ot' }), ['vdc']);
  assert.equal(soloAntiguo, null, 'en el Antiguo Testamento de juguete no está');
});

test('si se aborta a media búsqueda no devuelve nada', async () => {
  const control = new AbortController();
  control.abort();
  const r = await primeraVersionConResultados(formulario('dragostea'), ['vdc'], control.signal);
  assert.equal(r, null);
});

test('una versión que no se puede leer se salta sin romper nada', async () => {
  // `xx` no existe: el fetch devuelve 404 y el aviso sigue su camino.
  enCache = new Set(['xx', 'vdc']);
  const r = await primeraVersionConResultados(formulario('dragostea'), ['xx', 'vdc']);
  assert.equal(r?.version, 'vdc');
});

// ── El orden en que se prueban ──────────────────────────────────────────────

// En Node 24 `globalThis.navigator` existe y es de sólo lectura, así que se
// sustituye con `defineProperty` y se deja como estaba al terminar.
function conNavegador(idioma, prueba) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { language: idioma }, configurable: true });
  try {
    prueba();
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete globalThis.navigator;
  }
}

test('ordenarCandidatas pone delante las del idioma del navegador', () => {
  conNavegador('ro-RO', () => {
    const orden = ordenarCandidatas('rvl', ['vdc', 'rvl', 'en_kjv', 'zh_cuv']);
    assert.equal(orden[0], 'vdc', 'con el navegador en rumano, la rumana primero');
    assert.ok(!orden.includes('rvl'), 'la versión que se está leyendo no es candidata');
    assert.equal(orden.length, 3);
  });
});

test('sin pista del navegador se respeta el orden del catálogo', () => {
  conNavegador('', () => {
    assert.deepEqual(ordenarCandidatas('vdc', ['vdc', 'rvl', 'en_kjv']), ['rvl', 'en_kjv']);
  });
});
