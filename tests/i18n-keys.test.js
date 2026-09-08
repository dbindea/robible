// Paridad de claves entre los cuatro idiomas.
//
// Por qué existe este test: el traductor devuelve la clave cuando no la
// encuentra, así que una traducción que falta no rompe nada — simplemente sale
// "app.notes.title" en pantalla. El 4 sep 2026 la página de notas llevaba quién
// sabe cuánto en crudo en español (11 claves ausentes) y solo se descubrió
// navegando la app a mano.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIR_LANG = path.join(import.meta.dirname, '..', 'public', 'lang');

const IDIOMAS = readdirSync(DIR_LANG)
  .filter((f) => f.endsWith('.json'))
  .map((f) => path.basename(f, '.json'))
  .sort();

const cargar = (lang) => JSON.parse(readFileSync(path.join(DIR_LANG, `${lang}.json`), 'utf8'));

/** Aplana {a:{b:'x'}} → ['a.b'] */
function aplanar(obj, prefijo = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? aplanar(v, `${prefijo}${k}.`) : [`${prefijo}${k}`],
  );
}

const claves = Object.fromEntries(IDIOMAS.map((l) => [l, new Set(aplanar(cargar(l)))]));
const todas = new Set(Object.values(claves).flatMap((s) => [...s]));

test('hay al menos los cuatro idiomas esperados', () => {
  for (const esperado of ['ro', 'es', 'en', 'zh']) {
    assert.ok(IDIOMAS.includes(esperado), `falta public/lang/${esperado}.json`);
  }
});

for (const lang of IDIOMAS) {
  test(`${lang}.json no tiene claves ausentes`, () => {
    const faltan = [...todas].filter((k) => !claves[lang].has(k)).sort();
    assert.deepEqual(
      faltan,
      [],
      `${lang}.json no define ${faltan.length} clave(s) que sí existen en otros idiomas:\n  ${faltan.join('\n  ')}`,
    );
  });

  test(`${lang}.json no tiene valores vacíos`, () => {
    const datos = cargar(lang);
    const vacias = aplanar(datos).filter((clave) => {
      const valor = clave.split('.').reduce((v, k) => v?.[k], datos);
      return typeof valor === 'string' && valor.trim() === '';
    });
    assert.deepEqual(vacias, [], `claves con texto vacío: ${vacias.join(', ')}`);
  });
}

test('los marcadores {x} de una clave coinciden en todos los idiomas', () => {
  const marcadores = (s) => (typeof s === 'string' ? [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort() : []);
  const datos = Object.fromEntries(IDIOMAS.map((l) => [l, cargar(l)]));
  const problemas = [];

  for (const clave of todas) {
    const porIdioma = IDIOMAS.map((l) => ({
      lang: l,
      vars: marcadores(clave.split('.').reduce((v, k) => v?.[k], datos[l])),
    })).filter(({ lang }) => claves[lang].has(clave));

    const referencia = porIdioma[0];
    for (const otro of porIdioma.slice(1)) {
      if (referencia.vars.join(',') !== otro.vars.join(',')) {
        problemas.push(
          `${clave}: ${referencia.lang} usa {${referencia.vars.join('},{')}} pero ${otro.lang} usa {${otro.vars.join('},{')}}`,
        );
      }
    }
  }

  // Un marcador que no coincide sale literal en pantalla: "Hola {nickname}".
  assert.deepEqual(problemas, [], problemas.join('\n'));
});

// ── Claves usadas en el código pero que no existen en ninguna parte ─────────
//
// La paridad de arriba compara los cuatro idiomas entre sí, así que sólo caza
// la clave que está en unos ficheros y no en otros. Una clave que se escribe
// mal en el código y no existe en NINGUNO pasa desapercibida: los cuatro
// idiomas siguen cuadrando y en pantalla sale el identificador en crudo.
//
// Pasó el 8 sep 2026 con `app.topics.share.copy`, que en realidad se llama
// `copy_link`: el botón de copiar el enlace de una predicación publicada
// mostraba "app.topics.share.copy" y los tests estaban en verde.
const RAIZ_SRC = path.join(import.meta.dirname, '..', 'src');

/** Sólo literales estáticos: `$_('a.b.c')`. Lo dinámico no es verificable. */
const RE_CLAVE = /\$?_\(\s*'([a-zA-Z0-9_.]+)'/g;

function ficherosFuente(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    return e.isDirectory() ? ficherosFuente(f) : /\.(svelte|js)$/.test(f) ? [f] : [];
  });
}

test('toda clave usada en src/ existe en los ficheros de idioma', () => {
  const definidas = new Set(aplanar(cargar('ro')));
  const problemas = [];

  for (const fichero of ficherosFuente(RAIZ_SRC)) {
    // El propio servicio define `_(key)`: sus coincidencias son la firma, no uso.
    if (fichero.endsWith(path.join('services', 'i18n.service.js'))) continue;

    for (const [, clave] of readFileSync(fichero, 'utf8').matchAll(RE_CLAVE)) {
      // Un prefijo que se concatena con un sufijo dinámico
      // (`$_('app.sidebar.scope.' + ambito)`) no se puede comprobar entero.
      if (clave.endsWith('.')) continue;
      if (!definidas.has(clave)) {
        problemas.push(`${path.relative(RAIZ_SRC, fichero)}: ${clave}`);
      }
    }
  }

  assert.deepEqual(problemas, [], `claves inexistentes:\n  ${problemas.join('\n  ')}`);
});
