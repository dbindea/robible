/**
 * PDF de la predicación y de la schiță.
 *
 * Todo en el navegador: no hay función de servidor ni servicio externo. El
 * texto sale **seleccionable y buscable**, no como una foto de la pantalla —
 * por eso se compone el documento en vez de rasterizar el HTML.
 *
 * `pdfmake` se carga **bajo demanda**. Pesa cerca de un mega con sus fuentes, y
 * meterlo en el arranque le costaría esa descarga a todo el que abre la Biblia
 * a leer, que es casi todo el mundo. Así sólo lo paga quien pulsa el botón, una
 * vez: el trozo queda en la caché del service worker (regla `/assets/`) y a
 * partir de ahí funciona sin conexión.
 *
 * Cuándo se usa cada formato:
 *   - La predicación, en **vertical**: es texto seguido y se lee como un folio.
 *   - La schiță, en **apaisado a dos columnas**: cada columna es la mitad de la
 *     hoja, así que al doblar por el medio queda una cartilla que cabe dentro
 *     de la Biblia. Si no cabe en dos caras pasa a cuatro, con la imposición
 *     del cuadernillo (4|1 delante, 2|3 detrás) — ver `definirSchita`.
 */

import { normalizeContent, normalizeOutline, quitarMarcas, segmentarTexto, sermonWordCount, estimatedMinutes } from './sermon-content.service.js';

// ── Tipografía ────────────────────────────────────────────────────────────
//
// Roboto es la fuente que trae pdfmake y cubre los diacríticos rumanos
// (ă ș ț î â) y los españoles. Se listan los tamaños aquí arriba para que
// cambiar el aire del documento sea tocar un sitio.
const T = {
  titulo: 22,
  referencia: 12,
  seccion: 13,
  punto: 14,
  cuerpo: 11,
  nota: 9,
  // La schiță se mira de reojo desde el atril: todo un punto más grande.
  schitaTitulo: 16,
  schitaPunto: 13,
  schitaClave: 11,
};

const GRIS = '#555555';
const ACENTO = '#236f97';

let pdfMake = null;

/** Carga la librería la primera vez que hace falta. */
const cargar = async () => {
  if (pdfMake) return pdfMake;
  const [mod, fuentes] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const lib = mod.default || mod;

  // Las fuentes van en un "sistema de ficheros virtual". Desde pdfmake 0.3 se
  // registran con `addVirtualFileSystem`; asignar `.vfs` a secas —como se hacía
  // en 0.2— no las da de alta y la generación falla con «Roboto-Medium.ttf not
  // found». Se prueban las dos formas para no atarse a una versión.
  const vfs = fuentes.default?.vfs || fuentes.vfs || fuentes.default;
  if (vfs) {
    if (typeof lib.addVirtualFileSystem === 'function') lib.addVirtualFileSystem(vfs);
    else lib.vfs = vfs;
  }

  pdfMake = lib;
  return pdfMake;
};

/** Nombre de archivo sin caracteres que molesten a ningún sistema. */
export const nombreArchivo = (titulo, sufijo) => {
  const base = (titulo || 'predica')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60);
  return `${base || 'predica'}-${sufijo}.pdf`;
};

const lineaSuave = () => ({
  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }],
  margin: [0, 6, 0, 12],
});

// ── La predicación, en vertical ───────────────────────────────────────────

/**
 * Un texto libre (explicación, ilustración, aplicación, subpunto…) como array
 * de `text` runs de pdfmake: cada `*marca*` sale en negrita y cada
 * `{{cita}}` en cursiva, en el sitio exacto donde se escribieron — antes las
 * dos se limpiaban con `quitarMarcas` sin más y el formato desaparecía.
 */
const runsDeTexto = (texto, opciones = {}) =>
  segmentarTexto((texto || '').trim()).map((s) => ({
    text: s.texto,
    ...(s.bold || opciones.bold ? { bold: true } : {}),
    ...(s.italica ? { italics: true } : {}),
  }));

const bloqueDeTexto = (etiqueta, texto) => {
  if (!(texto || '').trim()) return [];
  return [
    { text: etiqueta, fontSize: T.nota, color: GRIS, characterSpacing: 0.6, margin: [0, 8, 0, 2] },
    // Alineado a la izquierda, no justificado: justificar con la tipografía y
    // el ancho de este documento abría ríos de espacio en blanco entre
    // palabras, que se notaban más que la ganancia estética del margen recto.
    { text: runsDeTexto(texto), fontSize: T.cuerpo, lineHeight: 1.35, alignment: 'left' },
  ];
};

/**
 * Un versículo citado, con una barra vertical a la izquierda — la misma idea
 * que `.predica__refs` en la página pública, pero en PDF: aquí no hay CSS, así
 * que la barra se dibuja con el borde de una tabla de una sola celda, el
 * truco habitual de pdfmake para simular un `border-left`.
 */
const bloqueVersiculo = (ref) => ({
  table: {
    widths: ['*'],
    body: [[
      {
        stack: [
          { text: ref.label, bold: true, color: ACENTO, fontSize: T.nota, margin: [0, 0, 0, 2] },
          // El texto del versículo va impreso: en papel no se puede tocar
          // para abrirlo, así que si no está aquí no está.
          { text: ref.text || '', italics: true, color: GRIS, fontSize: T.nota, lineHeight: 1.3 },
        ],
        border: [false, false, false, false],
      },
    ]],
  },
  layout: {
    hLineWidth: () => 0,
    vLineWidth: (i) => (i === 0 ? 2.5 : 0),
    vLineColor: () => ACENTO,
    paddingLeft: () => 10,
    paddingTop: () => 3,
    paddingRight: () => 0,
    paddingBottom: () => 3,
  },
  margin: [0, 4, 0, 4],
});

// ── ¿Cabe entero en una página? ────────────────────────────────────────────
//
// `unbreakable: true` le pide a pdfmake que no reparta un bloque entre dos
// páginas — bien para un punto corto, que si no cabe al pie de una hoja se
// mueve entero a la siguiente. El problema es cuando el bloque es más alto
// que UNA PÁGINA ENTERA: pdfmake no tiene dónde ponerlo completo y el
// resultado no es que lo reparta, es que el contenido se superpone con lo que
// viene después y, a simple vista, el punto ha desaparecido del PDF.
//
// La condición que había antes —`grupo.length <= 8`— contaba ELEMENTOS del
// array, no líneas impresas: una única explicación de doscientas palabras
// contaba como "un elemento", igual que un titular de tres. Un punto normal
// con explicación + ilustración + aplicación + un par de referencias con su
// texto ya se queda corto de 8 elementos aunque cada uno ocupe media página,
// y ahí es donde un punto entero se esfumaba.
//
// Esto es una estimación GRUESA a propósito: no hay forma de saber el alto
// real sin que pdfmake ya lo haya compuesto. Se peca de conservador —mejor
// partir un punto que arriesgarse a perderlo—.
const ANCHO_UTIL = 495; // pt — A4 (595) menos 50pt de margen a cada lado.
const ALTO_UTIL = 620; // pt — algo menos que el alto útil real (unos 700pt),
                        // como colchón de seguridad.

const textoDeRun = (n) => (Array.isArray(n.text) ? n.text.map((t) => t.text || '').join('') : (n.text || ''));

const estimarAlto = (nodos) => {
  let alto = 0;
  for (const n of nodos) {
    // `bloqueVersiculo` es una tabla de una celda, no un `text`: sin este
    // caso el alto de cada versículo citado contaba como 0 y un punto con
    // varias citas largas se declaraba «cabe entero» sin caber, que es
    // exactamente el bug que este heurístico existe para evitar (trampa 64).
    if (n.table) {
      const celdas = n.table.body.flat().flatMap((celda) => celda.stack || []);
      alto += estimarAlto(celdas) + (n.margin?.[1] || 0) + (n.margin?.[3] || 0);
      continue;
    }
    const texto = textoDeRun(n);
    const tamano = n.fontSize || T.cuerpo;
    // ~2 caracteres por punto de ancho a este tamaño, para 495pt de ancho útil.
    const porLinea = Math.max(20, Math.round((ANCHO_UTIL / tamano) * 2));
    const lineas = texto ? Math.ceil(texto.length / porLinea) : 1;
    alto += lineas * tamano * 1.35;
    alto += (n.margin?.[1] || 0) + (n.margin?.[3] || 0);
  }
  return alto;
};

const cabeEnUnaPagina = (nodos) => estimarAlto(nodos) < ALTO_UTIL;

export const definirPredica = (sermon, contenido, etiquetas = {}) => {
  const c = normalizeContent(contenido);
  const palabras = sermonWordCount(c);
  const e = {
    explain: 'EXPLICĂ', illustrate: 'ILUSTREAZĂ', apply: 'APLICĂ',
    intro: 'INTRODUCERE', conclusion: 'ÎNCHEIERE', refs: 'REFERINȚE',
    idea: 'IDEEA CENTRALĂ', minutos: 'min', palabras: 'cuvinte',
    ...etiquetas,
  };

  const cuerpo = [];

  cuerpo.push({ text: sermon.title || '', fontSize: T.titulo, bold: true, margin: [0, 0, 0, 2] });
  if (sermon.reference) {
    cuerpo.push({ text: sermon.reference, fontSize: T.referencia, color: ACENTO, bold: true });
  }
  cuerpo.push({
    text: `${palabras} ${e.palabras} · ~${estimatedMinutes(palabras)} ${e.minutos}`,
    fontSize: T.nota,
    color: GRIS,
    margin: [0, 4, 0, 0],
  });
  cuerpo.push(lineaSuave());

  if (c.idea.central.trim()) {
    // Centrada: es la frase de la que cuelga todo el sermón, y centrarla la
    // distingue de un vistazo de las secciones normales, que van a la
    // izquierda como el resto del cuerpo.
    cuerpo.push({ text: e.idea, fontSize: T.nota, color: GRIS, characterSpacing: 0.6, alignment: 'center' });
    cuerpo.push({
      text: quitarMarcas(c.idea.central).trim(),
      fontSize: T.seccion,
      italics: true,
      alignment: 'center',
      margin: [0, 2, 0, 10],
    });
  }

  if (c.intro.trim()) {
    cuerpo.push({ text: e.intro, fontSize: T.seccion, bold: true, color: ACENTO, margin: [0, 6, 0, 4] });
    cuerpo.push({ text: runsDeTexto(c.intro), fontSize: T.cuerpo, lineHeight: 1.35, alignment: 'left' });
  }

  // La transición, entre la introducción y el primer punto: sin encabezado
  // propio, porque no es una sección — es la frase con la que se pasa de una a
  // otro. En negrita para encontrarla de un golpe de vista desde el atril.
  if (c.transition.trim()) {
    cuerpo.push({
      text: runsDeTexto(c.transition, { bold: true }),
      fontSize: T.cuerpo,
      lineHeight: 1.35,
      margin: [0, 10, 0, 0],
    });
  }

  c.structure.forEach((punto, i) => {
    const d = c.development[punto.id] || {};
    // Un punto no debería quedar partido entre el pie de una hoja y la
    // siguiente: se agrupa para que pdfmake lo mueva entero si no cabe —salvo
    // que sea más alto que una página entera, ver `cabeEnUnaPagina`.
    const grupo = [
      // Los asteriscos del marcado manual no se imprimen: en papel no hay nada
      // que puedan aportar y ensucian el título.
      { text: `${i + 1}. ${quitarMarcas(punto.title).trim()}`, fontSize: T.punto, bold: true, margin: [0, 14, 0, 2] },
    ];

    // Los subpuntos van PRIMERO, justo después del título: son la división
    // analítica del punto, y explicación/ilustración/aplicación cierran ese
    // punto ya dividido. Antes iban después de las tres casillas, y leído de
    // corrido parecía que la predicación volvía atrás a subdividir algo que
    // ya se había explicado, ilustrado y aplicado.
    (punto.subpoints || []).forEach((sub, j) => {
      const titulo = quitarMarcas(sub.title || '').trim();
      const texto = (c.development[sub.id]?.text || '').trim();
      if (!titulo && !texto) return;
      grupo.push({
        text: `${i + 1}.${j + 1} ${titulo}`.trim(),
        fontSize: T.cuerpo,
        bold: true,
        margin: [0, 10, 0, 3],
      });
      if (texto) grupo.push({ text: runsDeTexto(texto), fontSize: T.cuerpo, lineHeight: 1.35, alignment: 'left' });
    });

    grupo.push(...bloqueDeTexto(e.explain, d.explain));
    grupo.push(...bloqueDeTexto(e.illustrate, d.illustrate));
    grupo.push(...bloqueDeTexto(e.apply, d.apply));

    const refs = [
      ...(punto.refs || []),
      ...(d.refs || []),
      ...(punto.subpoints || []).flatMap((sub) => c.development[sub.id]?.refs || []),
    ].filter((r) => r?.label);
    if (refs.length) {
      grupo.push({ text: e.refs, fontSize: T.nota, color: GRIS, characterSpacing: 0.6, margin: [0, 8, 0, 2] });
      for (const r of refs) grupo.push(bloqueVersiculo(r));
    }

    cuerpo.push({ stack: grupo, unbreakable: cabeEnUnaPagina(grupo) });
  });

  if (c.conclusion.trim()) {
    cuerpo.push(lineaSuave());
    cuerpo.push({ text: e.conclusion, fontSize: T.seccion, bold: true, color: ACENTO, margin: [0, 4, 0, 4] });
    cuerpo.push({ text: runsDeTexto(c.conclusion), fontSize: T.cuerpo, lineHeight: 1.35, alignment: 'left' });
  }

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [50, 45, 50, 50],
    defaultStyle: { font: 'Roboto', fontSize: T.cuerpo },
    content: cuerpo,
    footer: (pagina, total) => ({
      text: `${pagina} / ${total}`,
      alignment: 'center',
      fontSize: T.nota,
      color: GRIS,
      margin: [0, 12, 0, 0],
    }),
  };
};

// ── La schiță, apaisada y para doblar ─────────────────────────────────────

const columnaDeSchita = (trozos) => ({ stack: trozos, width: '*' });

export const definirSchita = (sermon, esquema, etiquetas = {}) => {
  const o = normalizeOutline(esquema);
  const e = { application: 'APLICAȚIE', conclusion: 'ÎNCHEIERE', ...etiquetas };

  // Todo el contenido, en orden, como una lista de trozos. Después se reparte
  // entre las dos mitades de la hoja.
  const trozos = [];

  trozos.push({ text: sermon.title || '', fontSize: T.schitaTitulo, bold: true, margin: [0, 0, 0, 1] });
  if (sermon.reference) trozos.push({ text: sermon.reference, fontSize: T.nota, color: ACENTO, bold: true });
  if (o.idea) trozos.push({ text: o.idea, fontSize: T.schitaClave, italics: true, color: GRIS, margin: [0, 4, 0, 6] });

  for (const linea of o.intro || []) {
    // `runsDeTexto` y no texto plano: una línea puede traer una cita
    // insertada (`*Referencia* primeras palabras…`), y sin esto el asterisco
    // saldría impreso tal cual en vez de en negrita.
    trozos.push({ text: ['- ', ...runsDeTexto(linea)], fontSize: T.schitaClave, color: GRIS, margin: [0, 0, 0, 2] });
  }

  // La transición va entera y en negrita, sin el guion de las demás líneas: el
  // resto de la schiță son recortes que se miran de reojo, y ésta es la única
  // frase que se lee tal cual está escrita.
  if (o.transition) {
    trozos.push({ text: o.transition, fontSize: T.schitaClave, bold: true, margin: [0, 5, 0, 3] });
  }

  o.points.forEach((p, i) => {
    const grupo = [
      { text: `${i + 1}. ${quitarMarcas(p.title)}`, fontSize: T.schitaPunto, bold: true, margin: [0, 8, 0, 3] },
    ];
    // Guion y sin sangría: las ideas quedan alineadas a la izquierda, en
    // columna. Con el punto medio y 8 pt de sangría se leían como una
    // continuación del título en vez de como una lista.
    for (const k of p.keywords || []) {
      // Igual que en el Modo Amvon: una palabra clave puede traer lo marcado
      // con asteriscos o una cita insertada, y `runsDeTexto` es quien lo
      // convierte en negrita/cursiva en vez de imprimir el símbolo suelto.
      grupo.push({ text: ['- ', ...runsDeTexto(k)], fontSize: T.schitaClave, margin: [0, 0, 0, 2], lineHeight: 1.25 });
    }
    if ((p.refs || []).length) {
      grupo.push({ text: (p.refs || []).join('  ·  '), fontSize: T.nota, color: ACENTO, bold: true, margin: [8, 2, 0, 0] });
    }
    // Un punto entero no se parte entre las dos mitades: en el atril, medio
    // punto a cada lado del doblez es peor que dejar hueco.
    trozos.push({ stack: grupo, unbreakable: true });
  });

  if (o.application) {
    trozos.push({ text: e.application, fontSize: T.nota, color: GRIS, characterSpacing: 0.6, margin: [0, 10, 0, 2] });
    trozos.push({ text: o.application, fontSize: T.schitaClave, margin: [0, 0, 0, 4] });
  }
  if (o.conclusion) {
    trozos.push({ text: e.conclusion, fontSize: T.nota, color: GRIS, characterSpacing: 0.6, margin: [0, 8, 0, 2] });
    // Puede traer una cita insertada (ver `generateOutline`), de ahí
    // `runsDeTexto` en vez del texto a secas.
    trozos.push({ text: runsDeTexto(o.conclusion), fontSize: T.schitaClave });
  }

  // Reparto en caras. No se puede medir el alto antes de componer, así que se
  // estima por líneas: es aproximado a propósito, y errar por poco sólo mueve
  // un punto de cara — nunca lo parte, porque los puntos van agrupados.
  const peso = (t) => (t.stack ? t.stack.length + 1 : 1);
  const total = trozos.reduce((a, t) => a + peso(t), 0);

  /** Reparte los trozos en `n` caras de peso parecido, respetando el orden. */
  const repartir = (n) => {
    const caras = Array.from({ length: n }, () => []);
    const porCara = total / n;
    let acumulado = 0;
    for (const t of trozos) {
      // `Math.min` evita que un redondeo mande el último trozo a una cara que
      // no existe cuando el peso estimado se pasa del total.
      caras[Math.min(n - 1, Math.floor(acumulado / porCara))].push(t);
      acumulado += peso(t);
    }
    return caras;
  };

  // A4 apaisado menos márgenes ≈ 527 pt de alto útil; a ~13 pt por línea salen
  // unas 40. Se deja margen y se cuentan 34: pasarse parte la schiță en una
  // página que el plegado no espera, así que conviene quedarse corto.
  const CABEN_POR_CARA = 34;

  // Con poco contenido, una hoja a una cara doblada por el medio ya es el
  // cuadernillo: dos caras escritas y ni una en blanco. Sólo cuando no cabe se
  // pasa a cuatro, que obliga a imprimir a doble cara.
  const cuatroCaras = total > CABEN_POR_CARA * 2;

  const paginas = [];
  if (cuatroCaras) {
    // Imposición de cuadernillo: una hoja doblada por el lado corto da cuatro
    // páginas, pero NO en orden. Al doblar, la mitad izquierda del anverso
    // queda detrás de todo, así que la hoja se compone 4|1 delante y 2|3
    // detrás. Con el orden natural (1|2 y 3|4) el cuadernillo sale desordenado.
    const [c1, c2, c3, c4] = repartir(4);
    paginas.push([c4, c1], [c2, c3]);
  } else {
    const [c1, c2] = repartir(2);
    paginas.push([c1, c2]);
  }

  const content = paginas.map(([izquierda, derecha], i) => ({
    columns: [columnaDeSchita(izquierda), { text: '', width: 30 }, columnaDeSchita(derecha)],
    columnGap: 0,
    ...(i > 0 ? { pageBreak: 'before' } : {}),
  }));

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [34, 34, 34, 34],
    defaultStyle: { font: 'Roboto', fontSize: T.schitaClave },
    content,
    // La línea del doblez, por el medio exacto de la hoja apaisada.
    background: () => ({
      canvas: [{ type: 'line', x1: 421, y1: 24, x2: 421, y2: 571, lineWidth: 0.5, dash: { length: 3 }, lineColor: '#cccccc' }],
    }),
  };
};

// ── API ───────────────────────────────────────────────────────────────────

const descargar = async (definicion, nombre) => {
  const lib = await cargar();
  lib.createPdf(definicion).download(nombre);
};

export const descargarPredica = async (sermon, contenido, etiquetas) =>
  descargar(definirPredica(sermon, contenido, etiquetas), nombreArchivo(sermon?.title, 'predica'));

export const descargarSchita = async (sermon, esquema, etiquetas) =>
  descargar(definirSchita(sermon, esquema, etiquetas), nombreArchivo(sermon?.title, 'schita'));
