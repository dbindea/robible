// La schiță se dobla, y doblar tiene un orden.
//
// `definirSchita` es pura: compone la definición que se le pasa a pdfmake, sin
// tocar la librería (se carga bajo demanda dentro de `descargar`). Eso permite
// comprobar aquí lo único que no se ve revisando el PDF por encima: que las
// caras van en el orden del cuadernillo y no en el natural.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { definirSchita } from '../src/services/sermon-pdf.service.js';

const SERMON = { title: 'Domnul este pastorul meu', reference: 'Psalmii 23:1-6' };

/** Un esquema con `n` puntos, cada uno con `claves` palabras clave. */
const esquemaDe = (n, claves = 1) => ({
  version: 1,
  idea: 'Idea central',
  intro: ['apertura'],
  points: Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    title: `PUNCT ${i + 1}`,
    keywords: Array.from({ length: claves }, (_, k) => `clave ${i + 1}.${k + 1}`),
    refs: [`Ioan 1:${i + 1}`],
  })),
  application: 'Aplicación',
  conclusion: 'Conclusión',
});

/** Los números de punto que caen en cada columna de cada página. */
const caras = (esquema) =>
  definirSchita(SERMON, esquema, {}).content.map((pagina) =>
    pagina.columns
      .filter((c) => c.stack)
      .map((c) => [...JSON.stringify(c.stack).matchAll(/PUNCT (\d+)/g)].map((m) => Number(m[1]))),
  );

test('una schiță corta cabe en una hoja a una cara', () => {
  const paginas = caras(esquemaDe(3));
  assert.equal(paginas.length, 1, 'no debería necesitar una segunda hoja');
  assert.equal(paginas[0].length, 2, 'la hoja tiene dos paneles');
});

test('una schiță larga se reparte en cuatro caras', () => {
  const paginas = caras(esquemaDe(12, 6));
  assert.equal(paginas.length, 2, 'cuatro caras son dos hojas físicas (doble cara)');
  assert.equal(paginas[0].length, 2);
  assert.equal(paginas[1].length, 2);
});

test('las cuatro caras van en orden de cuadernillo, no en orden natural', () => {
  // Al doblar por el lado corto, el panel izquierdo del anverso queda el
  // último. Por eso la hoja se compone 4|1 delante y 2|3 detrás: leído en el
  // orden en que se pasan las páginas, el contenido sale seguido.
  const [[anversoIzq, anversoDer], [reversoIzq, reversoDer]] = caras(esquemaDe(12, 6));

  const leidoAlDoblar = [anversoDer, reversoIzq, reversoDer, anversoIzq].flat();

  assert.deepEqual(
    leidoAlDoblar,
    [...leidoAlDoblar].sort((a, b) => a - b),
    `al doblar, los puntos salen desordenados: ${leidoAlDoblar.join(', ')}`,
  );

  // Y en orden natural (1|2, 3|4) NO saldría seguido: si alguien "simplifica"
  // la imposición, este test tiene que ponerse rojo.
  const ordenNatural = [anversoIzq, anversoDer, reversoIzq, reversoDer].flat();
  assert.notDeepEqual(
    ordenNatural,
    [...ordenNatural].sort((a, b) => a - b),
    'la imposición parece haber vuelto al orden natural',
  );
});
