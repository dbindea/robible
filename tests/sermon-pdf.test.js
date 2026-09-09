// La schiță se dobla, y doblar tiene un orden.
//
// `definirSchita` es pura: compone la definición que se le pasa a pdfmake, sin
// tocar la librería (se carga bajo demanda dentro de `descargar`). Eso permite
// comprobar aquí lo único que no se ve revisando el PDF por encima: que las
// caras van en el orden del cuadernillo y no en el natural.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { definirPredica, definirSchita } from '../src/services/sermon-pdf.service.js';

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

// ── Los subpuntos, en la predicación impresa ──────────────────────────────
//
// Un subpunto se imprime como el punto que lo contiene: titular numerado y
// texto de cuerpo. Fue una petición explícita —antes era una línea gris con un
// guion, sin numerar y sin desarrollo— así que conviene que se ponga rojo si
// alguien lo devuelve a un estilo aparte.

const CONTENIDO_CON_SUBPUNTOS = {
  version: 1,
  structure: [
    {
      id: 'p_uno',
      title: 'Primul punct',
      refs: [],
      subpoints: [{ id: 's_a', title: 'Prima diviziune' }, { id: 's_b', title: 'A doua' }],
    },
  ],
  development: {
    p_uno: { explain: 'Explicația punctului', illustrate: '', apply: '', refs: [] },
    s_a: { text: 'Dezvoltarea *primei* diviziuni', refs: [{ label: 'Ioan 3:16', text: '…' }] },
    s_b: { text: '', refs: [] },
  },
  intro: '',
  conclusion: '',
};

/** Todos los trozos de texto de la definición, aplanados. */
const trozosDe = (definicion) => {
  const salida = [];
  const recorrer = (n) => {
    if (Array.isArray(n)) return n.forEach(recorrer);
    if (!n || typeof n !== 'object') return;
    if (n.stack) return recorrer(n.stack);
    if (typeof n.text === 'string') salida.push(n);
    else if (Array.isArray(n.text)) recorrer(n.text);
  };
  recorrer(definicion.content);
  return salida;
};

test('el subpunto sale numerado 1.1 y con su texto de cuerpo', () => {
  const trozos = trozosDe(definirPredica({ title: 'T' }, CONTENIDO_CON_SUBPUNTOS));

  const titular = trozos.find((t) => t.text.startsWith('1.1'));
  assert.ok(titular, 'falta el titular numerado del subpunto');
  assert.equal(titular.text, '1.1 Prima diviziune');
  assert.equal(titular.bold, true);

  const cuerpo = trozos.find((t) => t.text.includes('primei'));
  assert.ok(cuerpo, 'falta el desarrollo del subpunto');
  // Ni cursiva ni gris: se lee igual que el resto del texto de la predicación.
  assert.ok(!cuerpo.italics, 'el texto del subpunto no va en cursiva');
  assert.equal(cuerpo.color, undefined, 'el texto del subpunto no va en gris');
  assert.ok(!cuerpo.text.includes('*'), 'los asteriscos del marcado no se imprimen');
});

test('un subpunto sin título ni texto no deja un titular vacío', () => {
  const trozos = trozosDe(definirPredica({ title: 'T' }, CONTENIDO_CON_SUBPUNTOS));
  assert.equal(trozos.filter((t) => t.text.startsWith('1.2')).length, 1, 'el 1.2 tiene título');

  const sinNada = structuredClone(CONTENIDO_CON_SUBPUNTOS);
  sinNada.structure[0].subpoints[1].title = '';
  const mudos = trozosDe(definirPredica({ title: 'T' }, sinNada));
  assert.equal(mudos.filter((t) => t.text.startsWith('1.2')).length, 0);
});

test('las referencias de un subpunto se imprimen con las del punto', () => {
  const trozos = trozosDe(definirPredica({ title: 'T' }, CONTENIDO_CON_SUBPUNTOS));
  assert.ok(trozos.some((t) => t.text.includes('Ioan 3:16')), 'se ha perdido la referencia del subpunto');
});
