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
    // `bloqueVersiculo` es una tabla de una celda (la barra a la izquierda es
    // el borde de la tabla), no un `text` ni un `stack`: sin este caso el
    // texto del versículo citado se volvía invisible para este recorrido.
    if (n.table) return recorrer(n.table.body);
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

test('el subpunto sale ANTES de explicación/ilustración/aplicación', () => {
  // Es la división analítica del punto: si va después de explicar, ilustrar y
  // aplicar, leído de corrido parece que la predicación vuelve atrás a
  // subdividir algo que ya se cerró.
  const trozos = trozosDe(definirPredica({ title: 'T' }, CONTENIDO_CON_SUBPUNTOS));
  const iSubpunto = trozos.findIndex((t) => t.text.startsWith('1.1'));
  const iExplica = trozos.findIndex((t) => t.text.includes('Explicația punctului'));
  assert.ok(iSubpunto !== -1 && iExplica !== -1, 'faltan piezas para comparar el orden');
  assert.ok(iSubpunto < iExplica, `el subpunto (${iSubpunto}) debería ir antes que EXPLICĂ (${iExplica})`);
});

// ── Negrita para lo marcado, cursiva para la cita en línea (item 5 y 4) ────

test('una *marca* sale en negrita en el PDF, no como asterisco plano', () => {
  const contenido = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct', refs: [], subpoints: [] }],
    development: { p1: { explain: 'Nu o *credință oarecare*, ci una vie.', illustrate: '', apply: '', refs: [] } },
    intro: '', conclusion: '',
  };
  const trozos = trozosDe(definirPredica({ title: 'T' }, contenido));
  const marca = trozos.find((t) => t.text === 'credință oarecare');
  assert.ok(marca, 'no se encontró el segmento marcado');
  assert.equal(marca.bold, true, 'lo marcado tiene que salir en negrita');
  assert.ok(!trozos.some((t) => t.text.includes('*')), 'no debe quedar ningún asterisco suelto');
});

test('una {{cita}} en línea sale en cursiva, en el sitio donde se escribió', () => {
  const contenido = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct', refs: [], subpoints: [] }],
    development: {
      p1: {
        explain: 'Textul spune că {{Ioan 3:16|Fiindcă atât de mult a iubit Dumnezeu lumea}}, și asta schimbă tot.',
        illustrate: '', apply: '', refs: [],
      },
    },
    intro: '', conclusion: '',
  };
  const trozos = trozosDe(definirPredica({ title: 'T' }, contenido));
  const cita = trozos.find((t) => t.text === 'Fiindcă atât de mult a iubit Dumnezeu lumea');
  assert.ok(cita, 'no se encontró el texto de la cita');
  assert.equal(cita.italica ?? cita.italics, true, 'la cita tiene que salir en cursiva');
  const referencia = trozos.find((t) => t.text.startsWith('Ioan 3:16'));
  assert.ok(referencia?.bold, 'la referencia de la cita tiene que destacarse');
  assert.ok(!trozos.some((t) => t.text.includes('{{')), 'no debe quedar la sintaxis de llaves en el PDF');
});

// ── Un punto no puede desaparecer por ser demasiado largo (item 2) ─────────

test('un punto corto se marca indivisible; uno larguísimo NO, para que no desaparezca', () => {
  // Éste fue el fallo real: `unbreakable: true` sobre un bloque más alto que
  // una página entera hace que pdfmake lo superponga con lo que viene
  // después en vez de repartirlo, y a simple vista el punto se esfuma. La
  // condición vieja contaba ELEMENTOS del array (`grupo.length <= 8`), no
  // líneas impresas, así que un punto con una explicación de mil palabras
  // seguía marcándose indivisible.
  const parrafoLargo = 'palabra '.repeat(1200).trim(); // ~1200 palabras, varias páginas de A4.

  const corto = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct scurt', refs: [], subpoints: [] }],
    development: { p1: { explain: 'Una explicación breve.', illustrate: '', apply: '', refs: [] } },
    intro: '', conclusion: '',
  };
  const largo = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct foarte lung', refs: [], subpoints: [] }],
    development: { p1: { explain: parrafoLargo, illustrate: '', apply: '', refs: [] } },
    intro: '', conclusion: '',
  };

  const bloqueCorto = definirPredica({ title: 'T' }, corto).content.find((n) => n.stack);
  const bloqueLargo = definirPredica({ title: 'T' }, largo).content.find((n) => n.stack);

  assert.equal(bloqueCorto.unbreakable, true, 'un punto corto debe seguir yendo entero si cabe');
  assert.equal(bloqueLargo.unbreakable, false, 'un punto larguísimo NO debe marcarse indivisible: se perdería');
});

// ── Versículos citados: barra a la izquierda (item 3) ──────────────────────

/** Todas las tablas de la definición, aplanadas (una tabla por versículo citado). */
const tablasDe = (definicion) => {
  const salida = [];
  const recorrer = (n) => {
    if (Array.isArray(n)) return n.forEach(recorrer);
    if (!n || typeof n !== 'object') return;
    if (n.table) { salida.push(n); return recorrer(n.table.body); }
    if (n.stack) return recorrer(n.stack);
  };
  recorrer(definicion.content);
  return salida;
};

test('un versículo citado se imprime en una tabla con barra a la izquierda', () => {
  const contenido = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct', refs: [], subpoints: [] }],
    development: {
      p1: { explain: '', illustrate: '', apply: '', refs: [{ label: 'Ioan 3:16', text: 'Fiindcă atât de mult…' }] },
    },
    intro: '', conclusion: '',
  };
  const tablas = tablasDe(definirPredica({ title: 'T' }, contenido));
  assert.equal(tablas.length, 1, 'debería haber una tabla por referencia citada');

  const [tabla] = tablas;
  // Sólo el borde izquierdo dibuja línea: `vLineWidth(0)` es la barra,
  // `vLineWidth(1)` (el borde derecho de la única columna) tiene que ser 0 o
  // no sería una barra, sería un recuadro completo.
  assert.equal(tabla.layout.vLineWidth(0), 2.5);
  assert.equal(tabla.layout.vLineWidth(1), 0);
  assert.equal(tabla.layout.hLineWidth(), 0, 'sin líneas horizontales: no es una tabla con rejilla');

  const trozos = trozosDe(definirPredica({ title: 'T' }, contenido));
  const etiqueta = trozos.find((t) => t.text === 'Ioan 3:16');
  const texto = trozos.find((t) => t.text === 'Fiindcă atât de mult…');
  assert.ok(etiqueta?.bold, 'la referencia va en negrita');
  assert.ok(texto?.italics, 'el texto del versículo va en cursiva');
});

test('varios versículos citados largos SÍ cuentan para decidir si el punto es indivisible', () => {
  // Antes de contar el alto de la tabla, `estimarAlto` le daba 0 a cada
  // versículo citado (no es un nodo `text`, es un nodo `table`), así que un
  // punto con varias citas largas se declaraba «cabe entero» sin caber —el
  // mismo bug que ya se arregló una vez para la explicación/ilustración.
  const versiculoLargo = 'palabra '.repeat(150).trim();
  const contenido = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct', refs: [], subpoints: [] }],
    development: {
      p1: {
        explain: '', illustrate: '', apply: '',
        refs: Array.from({ length: 8 }, (_, i) => ({ label: `Ref ${i + 1}`, text: versiculoLargo })),
      },
    },
    intro: '', conclusion: '',
  };
  const bloque = definirPredica({ title: 'T' }, contenido).content.find((n) => n.stack);
  assert.equal(bloque.unbreakable, false, 'ocho citas largas no caben en una página: no puede ser indivisible');
});

// ── Centrado y alineación (item 4 y 5) ──────────────────────────────────────

test('la idea central del PDF va centrada, no a la izquierda', () => {
  const contenido = {
    version: 1,
    idea: { exegetical: '', purpose: '', central: 'Dios cuida de los suyos', question: '' },
    structure: [], development: {}, intro: '', conclusion: '',
  };
  const trozos = trozosDe(definirPredica({ title: 'T' }, contenido));
  const idea = trozos.find((t) => t.text === 'Dios cuida de los suyos');
  assert.equal(idea?.alignment, 'center');
});

test('el cuerpo de la predicación va a la izquierda, no justificado', () => {
  const contenido = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct', refs: [], subpoints: [] }],
    development: { p1: { explain: 'Un texto cualquiera de cuerpo.', illustrate: '', apply: '', refs: [] } },
    intro: 'Una introducción cualquiera.',
    conclusion: 'Una conclusión cualquiera.',
  };
  const definicion = definirPredica({ title: 'T' }, contenido);
  const nodosConAlineacion = [];
  const recorrer = (n) => {
    if (Array.isArray(n)) return n.forEach(recorrer);
    if (!n || typeof n !== 'object') return;
    if (n.alignment) nodosConAlineacion.push(n.alignment);
    if (n.stack) recorrer(n.stack);
  };
  recorrer(definicion.content);
  assert.ok(nodosConAlineacion.length > 0, 'no se encontró ningún nodo con alineación para comprobar');
  assert.ok(!nodosConAlineacion.includes('justify'), 'no debería quedar texto justificado en el PDF');
});
