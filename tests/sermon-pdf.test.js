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

// La schiță dejó de ser un cuadernillo el 2 nov 2026. Lo pidió el propietario
// después de imprimirla: la imposición para doblar obligaba a rellenar hasta un
// múltiplo de cuatro —sobraban medias páginas en blanco— y los bloques no
// caían en orden de lectura. Ahora las caras van seguidas, 1|2 y 3|4, y cada
// hoja lleva su número abajo a la derecha.
test('una schiță larga se reparte en varias hojas, de dos caras cada una', () => {
  const paginas = caras(esquemaDe(14, 4));
  assert.ok(paginas.length >= 2, `una schiță de 14 puntos no cabe en una hoja: salen ${paginas.length}`);
  assert.ok(
    paginas.every((p) => p.length === 2),
    'cada hoja tiene dos paneles',
  );
});

test('las caras van en ORDEN DE LECTURA, de izquierda a derecha', () => {
  // El invariante que importa: leyendo izquierda→derecha y hoja a hoja, los
  // puntos salen en orden. Si alguien devuelve la imposición de cuadernillo
  // (4|1 delante, 2|3 detrás), esto se pone rojo.
  const numeros = caras(esquemaDe(14, 4)).flat(2);

  assert.deepEqual(
    numeros,
    [...numeros].sort((a, b) => a - b),
    `leída de izquierda a derecha, la cartilla sale desordenada: ${numeros.join(', ')}`,
  );
});

test('no quedan medias páginas en blanco', () => {
  // Era la otra consecuencia del cuadernillo: como una hoja doblada aporta
  // cuatro páginas, el reparto rellenaba hasta el múltiplo de cuatro y podían
  // sobrar hasta tres caras vacías. En el PDF que envió el propietario había
  // cuatro caras escritas de diez.
  for (const puntos of [3, 7, 14]) {
    const definicion = definirSchita(SERMON, esquemaDe(puntos, 4), {});
    const panelesVacios = definicion.content
      .flatMap((pagina, i) => pagina.columns.filter((c) => c.stack).map((c, j) => ({ c, i, j })))
      .filter(({ c }) => c.stack.length === 0);

    // Como mucho puede quedar vacío el ÚLTIMO panel de la ÚLTIMA hoja: el
    // contenido acaba donde acaba, y una cara impar no se puede evitar.
    const ultimaHoja = definicion.content.length - 1;
    assert.ok(
      panelesVacios.every(({ i, j }) => i === ultimaHoja && j === 1),
      `con ${puntos} puntos quedan caras en blanco que no son la última: ` +
        JSON.stringify(panelesVacios.map(({ i, j }) => `hoja ${i + 1}, panel ${j + 1}`)),
    );
  }
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
      subpoints: [
        { id: 's_a', title: 'Prima diviziune' },
        { id: 's_b', title: 'A doua' },
      ],
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
  assert.ok(
    trozos.some((t) => t.text.includes('Ioan 3:16')),
    'se ha perdido la referencia del subpunto',
  );
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
    intro: '',
    conclusion: '',
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
        illustrate: '',
        apply: '',
        refs: [],
      },
    },
    intro: '',
    conclusion: '',
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

// ── Flujo continuo: nada se queda solo en una página, nada desaparece ─────
//
// Desde el 2 nov 2026 el punto YA NO se agrupa entero. Lo pidió el propietario
// —«que toată predica să aibă o continuitate»—: con el punto entero marcado
// indivisible, si no cabía en lo que quedaba de hoja se iba completo a la
// siguiente y dejaba INTRODUCERE sola con media página en blanco.
//
// Lo que se agrupa ahora es el titular con su primer bloque, que es lo más
// parecido a un «keep-with-next» que hay en pdfmake: el titular no puede
// quedarse solo al pie de una hoja y el resto fluye.

test('el titular va agrupado con su primer bloque, y el resto del punto fluye', () => {
  const contenido = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct', refs: [], subpoints: [] }],
    development: {
      p1: {
        explain: 'Primul paragraf.\n\nAl doilea paragraf.\n\nAl treilea paragraf.',
        illustrate: '',
        apply: '',
        refs: [],
      },
    },
    intro: '',
    conclusion: '',
  };

  const { content } = definirPredica({ title: 'T' }, contenido);
  const grupos = content.filter((n) => n.stack);
  assert.equal(grupos.length, 1, 'sólo el titular y su primer bloque van agrupados');

  const textos = trozosDe({ content: grupos }).map((t) => t.text);
  assert.ok(textos.includes('1. PUNCT'), `el grupo debería llevar el titular: ${JSON.stringify(textos)}`);
  assert.ok(textos.includes('Primul paragraf.'), 'y el primer párrafo, para que el titular no quede huérfano');
  assert.ok(!textos.includes('Al doilea paragraf.'), 'el segundo párrafo ya va suelto: el texto tiene que fluir');
});

test('un titular corto se marca indivisible; uno con un primer bloque larguísimo NO', () => {
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
    intro: '',
    conclusion: '',
  };
  const largo = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct foarte lung', refs: [], subpoints: [] }],
    development: { p1: { explain: parrafoLargo, illustrate: '', apply: '', refs: [] } },
    intro: '',
    conclusion: '',
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
    if (n.table) {
      salida.push(n);
      return recorrer(n.table.body);
    }
    if (n.stack) return recorrer(n.stack);
    // La cartilla reparte su contenido en columnas: sin esta rama, sus citas
    // son invisibles para este recorrido.
    if (n.columns) return recorrer(n.columns);
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
    intro: '',
    conclusion: '',
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

  // Y la celda tiene que PEDIR su borde izquierdo. Con los cuatro en `false`
  // —como estuvo desde que se escribió— el `border` de la celda gana al
  // `vLineWidth` del layout y la barra no se dibujaba nunca: el truco estaba
  // escrito, comentado y probado, y en el papel no se veía.
  const celda = tabla.table.body[0][0];
  assert.deepEqual(celda.border, [true, false, false, false], 'la celda sólo pide el borde de la barra');

  const trozos = trozosDe(definirPredica({ title: 'T' }, contenido));
  const etiqueta = trozos.find((t) => t.text === 'Ioan 3:16');
  const texto = trozos.find((t) => t.text === 'Fiindcă atât de mult…');
  assert.ok(etiqueta?.bold, 'la referencia va en negrita');
  assert.ok(texto?.italics, 'el texto del versículo va en cursiva');
});

test('un versículo citado larguísimo SÍ cuenta para decidir si el grupo es indivisible', () => {
  // Antes de contar el alto de la tabla, `estimarAlto` le daba 0 a cada
  // versículo citado (no es un nodo `text`, es un nodo `table`), así que un
  // bloque con una cita larga se declaraba «cabe entero» sin caber —el mismo
  // bug que ya se arregló una vez para la explicación/ilustración.
  //
  // Sigue importando aunque el punto ya no vaya agrupado entero: el primer
  // bloque del punto, que es el que se agrupa con el titular, puede ser
  // justamente una cita.
  const versiculoLargo = 'palabra '.repeat(900).trim();
  const contenido = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct', refs: [], subpoints: [] }],
    development: {
      p1: { explain: `{{Ref 1|${versiculoLargo}}}`, illustrate: '', apply: '', refs: [] },
    },
    intro: '',
    conclusion: '',
  };
  const bloque = definirPredica({ title: 'T' }, contenido).content.find((n) => n.stack);
  assert.equal(bloque.unbreakable, false, 'una cita más alta que la página no puede ir en un grupo indivisible');

  // Y la misma cita, corta, sí: si no, el titular se quedaría solo al pie.
  const corto = structuredClone(contenido);
  corto.development.p1.explain = '{{Ref 1|Isus a plâns}}';
  assert.equal(definirPredica({ title: 'T' }, corto).content.find((n) => n.stack).unbreakable, true);
});

// ── Centrado y alineación (item 4 y 5) ──────────────────────────────────────

test('la idea central del PDF va centrada, no a la izquierda', () => {
  const contenido = {
    version: 1,
    idea: { exegetical: '', purpose: '', central: 'Dios cuida de los suyos', question: '' },
    structure: [],
    development: {},
    intro: '',
    conclusion: '',
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

// ── El folio rehecho el 2 nov 2026 ─────────────────────────────────────────
//
// Ocho peticiones del propietario después de llevar al atril la primera
// predicación preparada con la aplicación. Cada test de aquí abajo es una.

const CONTENIDO_COMPLETO = {
  version: 1,
  idea: { exegetical: '', purpose: '', central: 'Numai ascultarea ține casa', question: '' },
  structure: [{ id: 'p1', title: 'Zidirea casei', refs: [], subpoints: [] }],
  development: {
    p1: {
      explain:
        'Primul paragraf.\n\n## Zidirea temeliei\nAl doilea paragraf.\n\n{{Matei 7:24|Pe oricine aude aceste cuvinte}}',
      illustrate: '',
      apply: '',
      refs: [],
    },
  },
  intro: 'Fiecare om zidește ceva.',
  conclusion: 'Furtuna vine pentru toți.',
};

const PERICOPA = [
  { numero: 24, texto: 'De aceea, pe oricine aude aceste cuvinte ale Mele' },
  { numero: 25, texto: 'A dat ploaia, au venit șuvoaiele' },
];

test('el título de la predicación va centrado', () => {
  const trozos = trozosDe(
    definirPredica({ title: 'Casa zidită pe stâncă', reference: 'Matei 7:24-27' }, CONTENIDO_COMPLETO),
  );
  const titulo = trozos.find((t) => t.text === 'Casa zidită pe stâncă');
  assert.equal(titulo?.alignment, 'center');
  // Y la referencia debajo, también centrada y en el acento.
  const ref = trozos.find((t) => t.text === 'Matei 7:24-27');
  assert.equal(ref?.alignment, 'center');
});

test('el pasaje de la predicación se imprime, con su rótulo y sus números de versículo', () => {
  const definicion = definirPredica(
    { title: 'T', reference: 'Matei 7:24-27', pericope: PERICOPA },
    CONTENIDO_COMPLETO,
    { passage: 'TEXTUL BIBLIC' },
  );
  const trozos = trozosDe(definicion);
  const textos = trozos.map((t) => t.text);

  assert.ok(textos.includes('TEXTUL BIBLIC'), `falta el rótulo del pasaje: ${JSON.stringify(textos.slice(0, 8))}`);
  assert.ok(
    trozos.some((t) => t.text.includes('De aceea, pe oricine aude')),
    'el pasaje no se ha impreso',
  );
  const numero = trozos.find((t) => t.text === '24 ');
  assert.ok(numero?.bold, 'el número de versículo va en negrita y en el acento');

  // Sin perícopa no se inventa un bloque vacío.
  const sinPasaje = trozosDe(definirPredica({ title: 'T' }, CONTENIDO_COMPLETO, { passage: 'TEXTUL BIBLIC' }));
  assert.ok(!sinPasaje.some((t) => t.text === 'TEXTUL BIBLIC'));
});

test('las etiquetas EXPLICĂ / ILUSTREAZĂ / APLICĂ ya no se imprimen', () => {
  // Eran los nombres de las casillas del formulario de preparación. Quien lee
  // la predicación no tiene por qué saber en cuál se escribió cada párrafo, y
  // el documento final de la aplicación ya iba sin ellas.
  const contenido = structuredClone(CONTENIDO_COMPLETO);
  contenido.development.p1.illustrate = 'O ilustrație.';
  contenido.development.p1.apply = 'O aplicație.';

  const textos = trozosDe(definirPredica({ title: 'T' }, contenido)).map((t) => t.text);
  for (const etiqueta of ['EXPLICĂ', 'ILUSTREAZĂ', 'APLICĂ']) {
    assert.ok(!textos.includes(etiqueta), `sigue saliendo la etiqueta ${etiqueta}`);
  }
  // Pero los textos siguen ahí, seguidos.
  assert.ok(textos.includes('O ilustrație.') && textos.includes('O aplicație.'));
});

test('los titulares numerados salen como INTRODUCERE: en mayúsculas y en el acento', () => {
  const trozos = trozosDe(definirPredica({ title: 'T' }, CONTENIDO_COMPLETO, { intro: 'INTRODUCERE' }));
  const intro = trozos.find((t) => t.text === 'INTRODUCERE');
  const punto = trozos.find((t) => t.text.startsWith('1. '));

  assert.ok(intro && punto, `faltan titulares: ${JSON.stringify(trozos.map((t) => t.text))}`);
  assert.equal(punto.text, '1. ZIDIREA CASEI', 'el titular del punto va en mayúsculas');
  assert.equal(punto.color, intro.color, 'y en el mismo azul que INTRODUCERE');
  assert.equal(punto.fontSize, intro.fontSize, 'mismo nivel, mismo cuerpo');
  assert.ok(punto.bold && intro.bold);

  // El subpunto NO: es un nivel por debajo y se distingue por la caja.
  const conSub = structuredClone(CONTENIDO_COMPLETO);
  conSub.structure[0].subpoints = [{ id: 's1', title: 'Prima diviziune' }];
  const sub = trozosDe(definirPredica({ title: 'T' }, conSub)).find((t) => t.text.startsWith('1.1'));
  assert.equal(sub.text, '1.1 Prima diviziune');
});

test('un subtítulo del predicador sale en mayúsculas, en negrita y con aire', () => {
  const trozos = trozosDe(definirPredica({ title: 'T' }, CONTENIDO_COMPLETO));
  const rotulo = trozos.find((t) => t.text === 'ZIDIREA TEMELIEI');
  assert.ok(rotulo, `el subtítulo no llegó al PDF: ${JSON.stringify(trozos.map((t) => t.text))}`);
  assert.equal(rotulo.bold, true);
  assert.ok(rotulo.margin[1] > 0 && rotulo.margin[3] > 0, 'espacio de párrafo antes y después');
  // Y no queda ni una almohadilla en todo el documento.
  assert.ok(!trozos.some((t) => t.text.includes('#')), 'se coló la sintaxis del subtítulo');
});

test('una línea en blanco abre un párrafo nuevo, no un renglón vacío', () => {
  const trozos = trozosDe(definirPredica({ title: 'T' }, CONTENIDO_COMPLETO));
  const primero = trozos.find((t) => t.text === 'Primul paragraf.');
  const segundo = trozos.find((t) => t.text === 'Al doilea paragraf.');
  assert.ok(primero && segundo, 'los dos párrafos tienen que existir por separado');
  assert.ok(segundo.text !== '', 'y ninguno puede ser un nodo vacío');
  assert.ok(!trozos.some((t) => t.text.trim() === ''), 'no debe quedar ningún nodo de texto vacío');
});

test('un campo escrito con una frase por línea no se declara «cabe» sin caber', () => {
  // El salto de línea cuenta como línea impresa aunque no llene el ancho. Sin
  // eso, un campo escrito así —que es como escribe mucha gente— se medía en
  // menos de la mitad de lo que ocupa: el grupo se marcaba indivisible,
  // pdfmake descartaba lo que no cabía y la sección DESAPARECÍA del folio.
  const unaFrasePorLinea = Array.from({ length: 60 }, (_, i) => `Fraza numărul ${i + 1} a predicii.`).join('\n');
  const contenido = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct', refs: [], subpoints: [] }],
    development: { p1: { explain: unaFrasePorLinea, illustrate: '', apply: '', refs: [] } },
    intro: '',
    conclusion: '',
  };

  const grupo = definirPredica({ title: 'T' }, contenido).content.find((n) => n.stack);
  assert.equal(grupo.unbreakable, false, 'sesenta líneas no caben en una página');
});

test('un `##` escrito a mano donde no hay bloques tampoco se imprime', () => {
  // La transición y los campos de la schiță no pasan por `bloquesDe` —son una
  // frase, no un campo con estructura—, así que un `##` escrito a mano salía
  // impreso tal cual mientras en pantalla se veía como un rótulo.
  const contenido = structuredClone(CONTENIDO_COMPLETO);
  contenido.transition = '## PROPOZIȚIA DE TRANZIȚIE';
  const textos = trozosDe(definirPredica({ title: 'T' }, contenido)).map((t) => t.text);
  assert.ok(textos.includes('PROPOZIȚIA DE TRANZIȚIE'), JSON.stringify(textos));
  assert.ok(!textos.some((t) => t.includes('#')), 'no debe quedar la almohadilla');
});

test('una cita suelta sale como bloque con barra azul y sangrada', () => {
  const definicion = definirPredica({ title: 'T' }, CONTENIDO_COMPLETO);
  const tablas = tablasDe(definicion);
  const cita = tablas.find((t) => JSON.stringify(t).includes('Matei 7:24'));

  assert.ok(cita, 'la cita del texto no salió como bloque');
  assert.equal(cita.layout.vLineWidth(0), 2.5, 'la barra de la izquierda');
  assert.equal(cita.layout.vLineWidth(1), 0, 'y sólo la de la izquierda');
  assert.ok(cita.margin[0] > 0, 'con un poco de sangría, como se pidió');
});

test('ningún nodo indivisible se pasa del alto de una página', () => {
  // El invariante que de verdad importa: `unbreakable` sobre un bloque más alto
  // que la caja no lo reparte — pdfmake se queda con la primera página y
  // DESCARTA el resto («no support for multi-page unbreakableBlocks»), así que
  // el contenido desaparece sin ningún error. Es la trampa 64.
  const largo = 'palabra '.repeat(400).trim();
  const contenido = structuredClone(CONTENIDO_COMPLETO);
  contenido.intro = largo;
  contenido.conclusion = largo;
  contenido.development.p1.explain = largo;
  // Un punto corto además del larguísimo: así hay de las dos clases, grupos
  // que sí caben y grupos que no.
  contenido.structure.push({ id: 'p2', title: 'Punct scurt', refs: [], subpoints: [] });
  contenido.development.p2 = {
    explain: 'O frază scurtă. {{Ioan 11:35|Isus a plâns}}',
    illustrate: '',
    apply: '',
    refs: [],
  };

  const definicion = definirPredica({ title: 'T', reference: 'R', pericope: PERICOPA }, contenido);
  // Los hay de dos clases: el grupo [titular + primer bloque] y cada versículo
  // citado, que tampoco se parte si cabe.
  const indivisibles = [];
  const recorrer = (n) => {
    if (Array.isArray(n)) return n.forEach(recorrer);
    if (!n || typeof n !== 'object') return;
    if (n.unbreakable) indivisibles.push(n);
    if (n.stack) recorrer(n.stack);
    if (n.table) recorrer(n.table.body);
  };
  recorrer(definicion.content);

  assert.ok(indivisibles.length >= 2, 'tiene que haber grupos indivisibles que comprobar');
  for (const nodo of indivisibles) {
    assert.ok(
      estimarAltoDePrueba([nodo]) < 620,
      `un nodo indivisible mide más que la página: ${JSON.stringify(nodo).slice(0, 160)}`,
    );
  }
});

/** El mismo heurístico que usa el servicio, para poder comprobar el invariante
 *  desde fuera sin exportarlo. Si los dos se separan, este test deja de valer:
 *  por eso es grosero a propósito y sólo comprueba el orden de magnitud. */
const estimarAltoDePrueba = (nodos, ancho = 491) => {
  let alto = 0;
  for (const n of nodos || []) {
    if (!n || typeof n !== 'object') continue;
    const margenes = (n.margin?.[1] || 0) + (n.margin?.[3] || 0);
    const dentro = Math.max(120, ancho - (n.margin?.[0] || 0) - (n.margin?.[2] || 0));
    if (n.canvas) {
      alto += margenes + 1;
      continue;
    }
    if (n.table) {
      alto +=
        margenes +
        estimarAltoDePrueba(
          n.table.body.flat().flatMap((c) => c.stack || []),
          dentro - 10,
        );
      continue;
    }
    if (n.stack) {
      alto += margenes + estimarAltoDePrueba(n.stack, dentro);
      continue;
    }
    const texto = Array.isArray(n.text) ? n.text.map((t) => t.text || '').join('') : n.text || '';
    const tamano = n.fontSize || 11;
    const porLinea = Math.max(20, Math.round((dentro / tamano) * 2));
    alto += Math.max(1, Math.ceil(texto.length / porLinea)) * tamano * (n.lineHeight || 1.45) + margenes;
  }
  return alto;
};

// ── La schiță con la regla nueva: más caras, mismo plegado ─────────────────

test('una schiță larguísima crece en hojas sin perder el orden ni un punto', () => {
  // Desde que entra CADA frase del desarrollo, una predicación de las largas
  // ocupa varias hojas. Lo que no puede pasar es que se pierda un punto por el
  // camino —el reparto reserva caras para los que no caben en una— ni que el
  // orden se rompa al crecer.
  const paginas = caras(esquemaDe(16, 6));
  assert.ok(paginas.length >= 4, `16 puntos de 6 claves necesitan varias hojas, salen ${paginas.length}`);

  const numeros = paginas.flat(2);
  assert.deepEqual(
    numeros,
    [...numeros].sort((a, b) => a - b),
    `la cartilla larga sale desordenada: ${numeros.join(', ')}`,
  );
  assert.deepEqual(
    [...new Set(numeros)],
    Array.from({ length: 16 }, (_, i) => i + 1),
    'falta algún punto, o alguno sale dos veces',
  );
});

test('un punto de schiță más alto que la columna NO se marca indivisible', () => {
  // Misma lección que la trampa 64, en la schiță: un `unbreakable` que no cabe
  // hace que pdfmake descarte lo que sobra y el punto desaparezca del papel.
  // Antes de la regla nueva no podía pasar —un punto eran cinco líneas—.
  const definicion = definirSchita(SERMON, esquemaDe(1, 60), {});

  const indivisibles = [];
  const recorrer = (n) => {
    if (Array.isArray(n)) return n.forEach(recorrer);
    if (!n || typeof n !== 'object') return;
    if (n.unbreakable) indivisibles.push(n);
    if (n.stack) recorrer(n.stack);
    if (n.columns) recorrer(n.columns);
  };
  recorrer(definicion.content);

  // Desde el 2 nov 2026 la garantía es más fuerte que «el punto largo no se
  // marca»: en la cartilla **no se marca nada**. El reparto en caras trabaja
  // línea a línea, así que no hay ningún nodo que pueda no caber — y con eso
  // la trampa 64 deja de poder morder aquí.
  assert.deepEqual(indivisibles, [], 'en la schiță no puede quedar ningún nodo indivisible');

  // Y lo que importa de verdad: que no se haya perdido ni una línea.
  const impreso = JSON.stringify(definicion.content);
  for (let k = 1; k <= 60; k++) {
    assert.ok(impreso.includes(`clave 1.${k}`), `la clave ${k} de un punto de sesenta se perdió por el camino`);
  }
});

// ── Marca de agua ───────────────────────────────────────────────────────────
//
// RoBible es gratis, y un PDF de predicación se imprime, se reparte y se
// reenvía: quien lo recibe debería poder saber de dónde salió. Es toda la
// publicidad que lleva la aplicación, así que si alguien la quita conviene que
// sea a propósito y no de rebote al tocar el pie.

test('el documento lleva robible.com en el pie, junto a la numeración', () => {
  const pie = definirPredica(SERMON, CONTENIDO_CON_SUBPUNTOS).footer(2, 5);
  const textos = pie.columns.map((c) => c.text);
  assert.ok(textos.includes('robible.com'), `el pie no lleva la marca: ${JSON.stringify(textos)}`);
  assert.ok(textos.includes('2 / 5'), 'y tiene que seguir numerando las páginas');

  // La marca a la derecha y el número al centro: en una hoja que se lee de pie,
  // lo que se busca de un vistazo es en qué página vas.
  const marca = pie.columns.find((c) => c.text === 'robible.com');
  const numero = pie.columns.find((c) => c.text === '2 / 5');
  assert.equal(marca.alignment, 'right');
  assert.equal(numero.alignment, 'center');
});

test('los versículos de apoyo salen en la schiță con su barra y su texto', () => {
  // Hasta el 2 nov 2026 eran una tira de etiquetas pegadas con puntos medios
  // («Iacov 1:22 · Ioan 14:15») y nada más. En papel no se puede tocar una
  // referencia para abrirla: si el texto no está impreso, no está.
  const esquema = {
    points: [
      {
        id: 'p0',
        title: 'PUNCT',
        keywords: ['una clave'],
        refs: ['{{Iacov 1:22|Fiţi împlinitori ai Cuvântului, nu numai…}}'],
      },
    ],
  };

  const tablas = [];
  const recorrer = (n) => {
    if (Array.isArray(n)) return n.forEach(recorrer);
    if (!n || typeof n !== 'object') return;
    if (n.table) tablas.push(n);
    if (n.stack) recorrer(n.stack);
    if (n.columns) recorrer(n.columns);
  };
  recorrer(definirSchita(SERMON, esquema, {}).content);

  const cita = tablas.find((t) => JSON.stringify(t).includes('Iacov 1:22'));
  assert.ok(cita, 'el versículo de apoyo no se dibujó como cita');

  // La barra: sólo el borde izquierdo, y pedido por la celda. Con los cuatro
  // bordes en `false` pdfmake no dibuja ninguno aunque el layout lo pida —es
  // lo que tuvo la barra escrita y sin pintar durante una tanda entera.
  assert.equal(cita.layout.vLineWidth(0), 2.5, 'la barra de la izquierda');
  assert.equal(cita.layout.vLineWidth(1), 0, 'y nada por la derecha');
  assert.deepEqual(cita.table.body[0][0].border, [true, false, false, false]);

  // Y el texto del versículo tiene que estar impreso, no sólo la referencia.
  assert.ok(JSON.stringify(cita).includes('Fiţi împlinitori'), 'falta el arranque del versículo');
});

test('en la cartilla el guion es del PÁRRAFO, no de la línea', () => {
  // Las tres formas que conviven en un mismo campo y NO se tratan igual: una
  // frase lleva guion, un `## rótulo` no —es la división que puso el
  // predicador, no un elemento más de la lista— y una cita tampoco, que ya se
  // distingue por su barra.
  //
  // Está aquí porque el mismo reparto gobierna la pantalla: el Modo Amvon
  // ponía el guion en el `<p>` entero en vez de en el párrafo, y como el
  // subtítulo y la cita se pintan como BLOQUE, el guion se quedaba solo en su
  // renglón encima de cada rótulo y de cada versículo. Se vio en una
  // predicación real llevada al atril el 3 nov 2026. Si alguien vuelve a
  // mover el guion de sitio, que se rompa por este lado también.
  const esquema = {
    points: [
      {
        id: 'p0',
        title: 'PUNCT',
        keywords: ['## TESTUL LUCRARII', 'O frază oarecare', '{{Iacov 1:22|Fiţi împlinitori…}}'],
        refs: [],
      },
    ],
  };

  const textos = [];
  const recorrer = (n) => {
    if (Array.isArray(n)) return n.forEach(recorrer);
    if (!n || typeof n !== 'object') return;
    if (typeof n.text === 'string') textos.push(n.text);
    if (Array.isArray(n.text)) textos.push(n.text.map((t) => (typeof t === 'string' ? t : t.text)).join(''));
    if (n.text) recorrer(n.text);
    if (n.stack) recorrer(n.stack);
    if (n.columns) recorrer(n.columns);
    if (n.table) recorrer(n.table.body);
  };
  recorrer(definirSchita(SERMON, esquema, {}).content);

  const frase = textos.find((t) => t.includes('O frază oarecare'));
  const rotulo = textos.find((t) => t.includes('TESTUL LUCRARII'));
  const cita = textos.find((t) => t.includes('Fiţi împlinitori'));

  assert.ok(frase?.startsWith('- '), `la frase tiene que llevar su guion: ${JSON.stringify(frase)}`);
  assert.ok(!rotulo?.startsWith('- '), `el subtítulo NO lleva guion: ${JSON.stringify(rotulo)}`);
  assert.ok(!cita?.startsWith('- '), `la cita NO lleva guion: ${JSON.stringify(cita)}`);
  assert.ok(!textos.some((t) => t.includes('#')), 'y la almohadilla no se imprime');
});

/** Los textos sueltos del pie de una hoja, con su alineación. */
const piezasDelPie = (pie) => {
  const salida = [];
  const recorrer = (n) => {
    if (Array.isArray(n)) return n.forEach(recorrer);
    if (!n || typeof n !== 'object') return;
    if (typeof n.text === 'string') salida.push(n);
    if (n.columns) recorrer(n.columns);
  };
  recorrer(pie.columns);
  return salida;
};

test('la schiță numera las CARAS, no las hojas: una A4 son dos páginas', () => {
  // Llevó marca sin número hasta el 2 nov 2026, porque era un cuadernillo que
  // se doblaba. Desde que las hojas van sueltas y en orden de lectura, el
  // número es lo único que las ordena — lo pidió el propietario: «debajo de
  // todo ponme en pie de página a la derecha el número para ir buscando las
  // páginas en orden».
  //
  // Y desde el 27 nov 2026 lo que se numera es la CARA: «una página A4 en
  // realidad tiene 2 páginas». Lo que se lee es la columna, así que con el
  // número de la hoja las caras 5 y 6 eran las dos «3 / 4» y, cortadas por la
  // línea de puntos del medio, no había forma de ordenarlas.
  const definicion = definirSchita(SERMON, esquemaDe(14, 4), {});
  assert.ok(definicion.footer, 'la schiță también tiene que llevar pie');

  const caras = definicion.content.flatMap((p) => p.columns.filter((c) => c.stack?.length)).length;
  assert.ok(caras >= 4, `hacen falta varias caras para comprobar la numeración: ${caras}`);

  const pie = definicion.footer(2, definicion.content.length);
  const textos = piezasDelPie(pie).map((c) => c.text);

  assert.ok(textos.includes('robible.com'), `el pie no lleva la marca: ${JSON.stringify(textos)}`);
  // La segunda hoja lleva las caras 3 y 4, cada una bajo su columna.
  assert.ok(textos.includes(`3 / ${caras}`), `falta el número de la cara izquierda: ${JSON.stringify(textos)}`);
  assert.ok(textos.includes(`4 / ${caras}`), `falta el número de la cara derecha: ${JSON.stringify(textos)}`);

  // Cada número al pie de SU columna, a la derecha: es lo que se busca al
  // recoger las hojas.
  for (const cara of [3, 4]) {
    assert.equal(piezasDelPie(pie).find((c) => c.text === `${cara} / ${caras}`).alignment, 'right');
  }
});

test('una cara que no existe no se numera', () => {
  // Con un número impar de caras, la última hoja lleva la columna derecha en
  // blanco: numerarla anunciaría una página que no está.
  const definicion = definirSchita(SERMON, esquemaDe(3), {});
  const caras = definicion.content.flatMap((p) => p.columns.filter((c) => c.stack?.length)).length;
  const ultima = definicion.content.length;
  const textos = piezasDelPie(definicion.footer(ultima, ultima)).map((c) => c.text);

  assert.ok(!textos.includes(`${caras + 1} / ${caras}`), `numera una cara que no existe: ${JSON.stringify(textos)}`);
});

// ── La cita de la cartilla, en UNA línea (27 nov 2026) ─────────────────────

test('en la schiță la referencia y el versículo van en el MISMO renglón', () => {
  // Lo pidió el propietario después de imprimirla: «las referencias ocupan
  // mucho». Cada versículo gastaba dos renglones —la referencia arriba, el
  // texto debajo— y una cartilla normal lleva una docena. La barra azul se
  // queda: es lo que distingue un versículo de una palabra marcada.
  const esquema = {
    points: [{ id: 'p0', title: 'PUNCT', keywords: ['{{1 Corinteni 2:12|Şi noi n-am primit duhul lumii…}}'], refs: [] }],
  };
  const tablas = tablasDe(definirSchita(SERMON, esquema, {}));
  const cita = tablas.find((t) => JSON.stringify(t).includes('1 Corinteni 2:12'));
  assert.ok(cita, 'la cita no se dibujó');

  // Un solo nodo de texto dentro de la celda: si fueran dos, serían dos
  // renglones.
  const dentro = cita.table.body[0][0].stack;
  assert.equal(dentro.length, 1, `la cita de la cartilla es un solo renglón: ${JSON.stringify(dentro)}`);

  const [etiqueta, , texto] = dentro[0].text;
  assert.equal(etiqueta.text, '1 Corinteni 2:12');
  assert.equal(etiqueta.bold, true, 'la referencia va en negrita');
  assert.ok(texto.italics, 'y el texto del versículo en cursiva, como siempre');
  assert.ok(dentro[0].fontSize < 15, 'un par de puntos por debajo de las ideas');
  assert.deepEqual(cita.table.body[0][0].border, [true, false, false, false], 'la barra se queda');
});

test('en el folio de la predicación la cita SIGUE siendo de dos renglones', () => {
  // Son dos documentos con dos trabajos distintos: la cartilla se mira de reojo
  // desde el atril y la referencia es un recordatorio; el folio se lee de cerca
  // y la referencia encabeza el pasaje.
  const contenido = {
    version: 1,
    structure: [{ id: 'p1', title: 'Punct', refs: [], subpoints: [] }],
    development: {
      p1: { explain: '', illustrate: '', apply: '', refs: [{ label: 'Ioan 3:16', text: 'Fiindcă atât de mult…' }] },
    },
    intro: '',
    conclusion: '',
  };
  const [cita] = tablasDe(definirPredica({ title: 'T' }, contenido));
  assert.equal(cita.table.body[0][0].stack.length, 2, 'la referencia encima y el texto debajo');
});

// ── El hueco en blanco del pie de cada cara ────────────────────────────────

test('las caras se llenan: una schiță normal no gasta hojas de más', () => {
  // El estimador de altura venía calibrado para Roboto («1,9 caracteres por
  // punto de ancho») y Tinos es bastante más estrecha: contaba 50 caracteres
  // por renglón donde caben 64, así que una frase de una línea se declaraba de
  // dos y cada cara se daba por llena con cuatro quintos de texto. El
  // propietario lo vio impreso el 27 nov 2026 — un palmo en blanco al pie de
  // las dos columnas de todas las hojas.
  //
  // Hace falta texto de longitud REAL para que se note: con líneas de diez
  // caracteres los dos modelos cuentan lo mismo. Las frases de aquí abajo son
  // de una predicación de verdad.
  const FRASES = [
    'Folosim adesea in limbajul nostru de zi cu zi expresii de acest fel',
    'Am o casa, am o familie, am o masina si multe altele asemenea',
    'Sau, avem o biserica, avem o credinta, avem mantuire',
    'Si se aud tot felul de afirmatii care ne fac sa ne gandim la ce avem',
    'Intrebarea predicii din seara aceasta suna asa: "Cine te face deosebit?"',
    '## CE SUNTEM NOI?',
    'Noi fiecare am fost in necunostinta de Dumnezeu si fara nicio speranta',
    '{{1 Corinteni 2:7|Noi propovăduim înţelepciunea lui Dumnezeu, cea tainică şi…}}',
    'Printr-o minune pe care nimeni n-o poate explica am ajuns la El',
  ];
  const esquema = {
    version: 1,
    idea: 'Trebuie sa fim responsabili cu ceea ce am primit in dar.',
    intro: FRASES.slice(0, 6),
    points: Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      title: `PUNCTUL NUMARUL ${i + 1} AL PREDICII`,
      keywords: Array.from({ length: 6 }, (_, k) => FRASES[(i + k) % FRASES.length]),
      refs: [`{{Ioan 1:${i + 1}|La inceput era Cuvantul si Cuvantul era cu Dumnezeu…}}`],
    })),
    application: FRASES.slice(0, 4).join('\n\n'),
    conclusion: FRASES.slice(2, 6).join('\n\n'),
  };

  const definicion = definirSchita(SERMON, esquema, {});
  const caras = definicion.content.flatMap((p) => p.columns.filter((c) => c.stack?.length)).length;

  // Esta schiță ocupaba 10 caras con el estimador viejo y ocupa 8 con el
  // calibrado. El número no es sagrado —cambiar un tamaño lo mueve— pero si
  // vuelve a 10 es que alguien ha devuelto el estimador a contar de más.
  assert.ok(caras <= 8, `la cartilla vuelve a desperdiciar media columna por cara: ${caras} caras`);
});
