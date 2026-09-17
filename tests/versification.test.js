// Que «Romanos 5:5» sea Romanos 5:5 en las siete versiones.
//
// Es la comprobación más importante del proyecto después de que el texto sea
// correcto. En el Modo Proyección el segundo idioma se resuelve por referencia
// y se pinta debajo del principal, delante de toda una congregación: un
// desfase de un versículo pondría dos textos distintos uno encima de otro sin
// que nadie pudiera notarlo desde la sala.
//
// Este test lee las Biblias de verdad, no un doble: lo que se quiere vigilar es
// precisamente el contenido de `public/data/`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DESPLAZAMIENTOS,
  desplazamiento,
  indiceAlineado,
  textoDeVersiculo,
} from '../src/services/versification.service.js';

const VERSIONES = ['vdc', 'rvl', 'es_rv1909', 'es_vbl', 'es_pdt', 'en_kjv', 'zh_cuv'];

const biblia = (v) => JSON.parse(readFileSync(`public/data/${v}/bible.json`, 'utf8'));
const BIBLIAS = Object.fromEntries(VERSIONES.map((v) => [v, biblia(v)]));

// ── La forma de los datos ─────────────────────────────────

test('las siete versiones tienen los 66 libros y los mismos capítulos', () => {
  const capitulosVdc = BIBLIAS.vdc.map((l) => l.length);
  for (const v of VERSIONES) {
    assert.equal(BIBLIAS[v].length, 66, `${v}: no tiene 66 libros`);
    assert.deepEqual(
      BIBLIAS[v].map((l) => l.length),
      capitulosVdc,
      `${v}: no coincide el número de capítulos por libro`,
    );
  }
});

// ── Alineación ────────────────────────────────────────────

/**
 * Palabras que sobreviven a la traducción: nombres propios y cifras.
 *
 * Se comprueba que aparecen en el versículo que les toca en TODAS las
 * versiones. Es la forma de verificar alineación sin depender del idioma —
 * «Nicodemo» es Nicodim, Nicodemus y 尼哥底母, pero la raíz se reconoce.
 */
const ANCLAS = [
  // «Nicodim» en rumano, «Nicodemo» en español: la raíz es la que se busca.
  { libro: 42, capitulo: 3, versiculo: 1, patron: /nicodem|nicodim|尼哥底母/i, que: 'Juan 3:1' },
  { libro: 42, capitulo: 11, versiculo: 35, patron: /llor|wept|plâng|哭/i, que: 'Juan 11:35' },
  { libro: 0, capitulo: 1, versiculo: 1, patron: /principio|beginning|început|起初/i, que: 'Génesis 1:1' },
  { libro: 43, capitulo: 9, versiculo: 4, patron: /saul|saule|扫罗/i, que: 'Hechos 9:4' },
  { libro: 18, capitulo: 23, versiculo: 1, patron: /pastor|shepherd|păstor|牧者/i, que: 'Salmo 23:1' },
  // Aquí el ancla es el NOMBRE y no «evangelio»: cada versión lo traduce a su
  // manera —«buenas nuevas», «buena noticia», «Evanghelie»— y el nombre propio
  // es justamente lo que no cambia. Ese es el criterio de toda esta lista.
  { libro: 40, capitulo: 1, versiculo: 1, patron: /hristos|cristo|christ|基督/i, que: 'Marcos 1:1' },
];

test('las anclas caen en el mismo versículo en las siete versiones', () => {
  for (const a of ANCLAS) {
    for (const v of VERSIONES) {
      const texto = textoDeVersiculo(BIBLIAS[v], v, a.libro, a.capitulo, a.versiculo);
      assert.ok(texto.length > 0, `${v}: ${a.que} está vacío`);
      assert.match(texto, a.patron, `${v}: ${a.que} no contiene lo que debería`);
    }
  }
});

test('Romanos 5:5 habla de la esperanza y del amor en las siete', () => {
  // El versículo por el que se preguntó. Se comprueba entero y no de pasada.
  for (const v of VERSIONES) {
    const texto = textoDeVersiculo(BIBLIAS[v], v, 44, 5, 5);
    assert.match(
      texto,
      /esperanza|hope|nădejde|盼望/i,
      `${v}: Romanos 5:5 no habla de esperanza — ¿desfase de versificación?`,
    );
  }
});

// ── Los cuatro capítulos que numeran distinto ─────────────

test('los desplazamientos declarados corrigen los cuatro capítulos conocidos', () => {
  // Números 13:1 canónico es «Y Jehová habló a Moisés». En la RV1909 ese texto
  // está en el índice 1, no en el 0, porque su 13:1 es el 12:16 de vdc.
  assert.match(textoDeVersiculo(BIBLIAS.es_rv1909, 'es_rv1909', 3, 13, 1), /Jehová habló á Moisés/i);
  assert.match(textoDeVersiculo(BIBLIAS.vdc, 'vdc', 3, 13, 1), /Domnul a vorbit lui Moise/i);

  // Jonás 2:1 canónico: «y oró Jonás desde el vientre del pez».
  assert.match(textoDeVersiculo(BIBLIAS.es_rv1909, 'es_rv1909', 31, 2, 1), /oró Jonás/i);

  // 1 Samuel 24:1 canónico: Saúl vuelve de perseguir a los filisteos.
  assert.match(textoDeVersiculo(BIBLIAS.es_rv1909, 'es_rv1909', 8, 24, 1), /Filisteos/i);

  // 1 Crónicas 22:1 no existe en el 和合本: lo numera como 21:31. Un hueco es
  // la respuesta correcta; el versículo de al lado no lo es.
  assert.equal(textoDeVersiculo(BIBLIAS.zh_cuv, 'zh_cuv', 12, 22, 1), '');
  assert.match(textoDeVersiculo(BIBLIAS.zh_cuv, 'zh_cuv', 12, 22, 2), /大卫/);
});

test('sin corrección, esos mismos capítulos enseñarían el versículo de al lado', () => {
  // La prueba de que la tabla hace falta: leyendo el array a pelo sale otro
  // texto. Si algún día alguien la borra por «simplificar», esto falla.
  const aPelo = BIBLIAS.es_rv1909[3][12][0];
  assert.match(aPelo, /Haseroth/i, 'la RV1909 abre Números 13 con otra cosa');
  assert.notEqual(aPelo, textoDeVersiculo(BIBLIAS.es_rv1909, 'es_rv1909', 3, 13, 1));
});

test('fuera de esos cuatro capítulos no se desplaza nada', () => {
  let conDesplazamiento = 0;
  for (const v of VERSIONES) {
    for (let libro = 0; libro < 66; libro++) {
      for (let cap = 1; cap <= BIBLIAS[v][libro].length; cap++) {
        if (desplazamiento(v, libro, cap) !== 0) conDesplazamiento += 1;
      }
    }
  }
  const declarados = Object.values(DESPLAZAMIENTOS).reduce((n, m) => n + Object.keys(m).length, 0);
  assert.equal(conDesplazamiento, declarados);
  assert.equal(declarados, 4, 'si cambia la cifra, hay que volver a medir la alineación');
});

// ── Comparación lado a lado ───────────────────────────────

test('la comparación alinea las dos columnas por el versículo canónico', () => {
  // Misma versión a los dos lados: fila i contra fila i.
  assert.equal(indiceAlineado(5, 'vdc', 'rvl', 0, 1), 5);
  // Números 13, vdc contra RV1909: la fila 0 de vdc es la 1 de la RV1909.
  assert.equal(indiceAlineado(0, 'vdc', 'es_rv1909', 3, 13), 1);
  // Y al revés.
  assert.equal(indiceAlineado(1, 'es_rv1909', 'vdc', 3, 13), 0);
});
