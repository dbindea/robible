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
