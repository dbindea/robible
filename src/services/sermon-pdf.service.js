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
 *     de la Biblia. Si no cabe en dos caras pasa a cuatro, a ocho… siempre en
 *     múltiplos de cuatro y con la imposición del cuadernillo — ver
 *     `definirSchita`.
 *
 * El folio de la predicación se rehízo el 2 nov 2026, después de llevar al
 * atril la primera predicación preparada con la aplicación. Lo que cambió y por
 * qué está en los comentarios de cada pieza; en resumen: cabecera centrada, el
 * pasaje impreso, una sola jerarquía de titulares (azul y en mayúsculas), los
 * rótulos del predicador en vez de las etiquetas del formulario, las citas como
 * bloque con su barra, y nada que empuje una sección a una página para ella
 * sola.
 */

import {
  bloquesDe,
  normalizeContent,
  normalizeOutline,
  quitarMarcas,
  segmentarTexto,
  sermonWordCount,
  sinMarcadorDeSubtitulo,
  estimatedMinutes,
} from './sermon-content.service.js';

// ── Medidas de la página ──────────────────────────────────────────────────
//
// En puntos, que es la unidad de pdfmake. Se calculan en vez de escribirse a
// mano porque los `canvas` (los filetes) llevan su ancho en el propio trazo:
// con el número suelto, cambiar el margen dejaba las líneas sobresaliendo por
// el lado derecho, que es exactamente lo que pasaba antes de esto (el filete
// medía 515 pt sobre un ancho útil de 495).
const A4_ANCHO = 595.28;
const A4_ALTO = 841.89;
const MARGEN = 52;
const ANCHO_UTIL = A4_ANCHO - MARGEN * 2;

// Apaisado y a dos columnas con un canal por el medio: el doblez.
const MARGEN_SCHITA = 34;
const CANAL_SCHITA = 30;
const ANCHO_COLUMNA_SCHITA = (A4_ALTO - MARGEN_SCHITA * 2 - CANAL_SCHITA) / 2;

// ── Tipografía ────────────────────────────────────────────────────────────
//
// Roboto es la fuente que trae pdfmake y cubre los diacríticos rumanos
// (ă ș ț î â) y los españoles. Se listan los tamaños aquí arriba para que
// cambiar el aire del documento sea tocar un sitio.
//
// La escala es la de un manuscrito, no la de una pantalla: cada nivel se
// distingue del siguiente por tamaño Y por tratamiento (color, mayúsculas,
// negrita), porque en una fotocopia en blanco y negro el color no está.
const T = {
  titulo: 23,
  referencia: 12,
  seccion: 13, // INTRODUCERE, los puntos numerados, ÎNCHEIERE: el mismo nivel.
  idea: 12.5,
  subpunto: 11.5,
  subtitulo: 10.5, // El rótulo que escribe el predicador (`## …`).
  cuerpo: 11,
  pericopa: 10.5,
  cita: 10,
  nota: 8.5,
  cabecera: 8, // La línea de cortesía de las páginas segunda y siguientes.
  // La schiță se mira de reojo desde el atril: todo un punto más grande.
  schitaTitulo: 16,
  schitaPunto: 13,
  schitaClave: 11,
};

// Interlineado del cuerpo. 1.35 era correcto y quedaba apretado para leer en
// voz alta: el ojo salta de línea, y en el atril un salto se nota.
const INTERLINEA = 1.45;

// El carril.
//
// El cuerpo y la Escritura arrancan 26 pt más adentro que los titulares, así
// que el número de cada punto queda colgado en el blanco del margen. Es la
// única señal de este folio que se encuentra SIN leer: el predicador levanta
// la vista, mira a la congregación y vuelve, y lo que busca es «¿por dónde
// iba?» — un número en un hueco blanco se ve antes de enfocar.
//
// Va por sangría y no por columnas a propósito: un nodo `columns` es invisible
// a la vez para `estimarAlto` y para el recorrido de los tests, así que un
// error de medida no lo cazaría nadie.
const CARRIL = 26;

// El aire entre dos párrafos del mismo campo. Es la mitad de un renglón
// vacío, que es lo que se imprimía antes cuando el predicador dejaba una línea
// en blanco para separar párrafos — ver `bloquesDe`.
const AIRE_PARRAFO = 7;

// Las citas van sangradas, además de llevar su barra. Lo pidió el propietario
// y además las separa del cuerpo sin necesidad de más tinta.
const SANGRIA_CITA = 12;

// ── Una regla sobre el color ──────────────────────────────────────────────
//
// **Cada señal de color va doblada con una señal sin color.** Este folio se
// fotocopia en la láser de una iglesia, donde el azul de la casa sale como un
// gris medio: si el color fuera la única diferencia entre un titular y un
// párrafo, la jerarquía desaparecería justo en la copia que se reparte. Por eso
// los titulares llevan además mayúsculas, interletraje y un filete; las citas,
// su barra y su sangría; y la idea central, la cursiva y el centrado.
//
// Vale también al contrario: nada que importe se dice SÓLO con color.
const GRIS = '#555555';
const ACENTO = '#236f97';
// Un azul muy claro para los filetes: en pantalla marca la sección y en una
// láser en blanco y negro sale como una línea gris fina, no como una banda.
const LINEA_ACENTO = '#a9c6d6';
const LINEA_SUAVE = '#d6d6d6';
// Casi negro, no negro: en papel el negro puro endurece el texto corrido. Va
// en `defaultStyle`, así que ningún nodo del cuerpo necesita decir su color —
// y los que llevan `color` puesto es porque de verdad son otra cosa.
const TINTA = '#1f2328';

let pdfMake = null;

/** Carga la librería la primera vez que hace falta. */
const cargar = async () => {
  if (pdfMake) return pdfMake;
  const [mod, fuentes] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
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

/** Un filete horizontal. El ancho va calculado, nunca a mano (ver arriba). */
const filete = (opciones = {}) => ({
  canvas: [
    {
      type: 'line',
      x1: opciones.x1 ?? 0,
      y1: 0,
      x2: opciones.x2 ?? ANCHO_UTIL,
      y2: 0,
      lineWidth: opciones.grosor ?? 0.5,
      lineColor: opciones.color ?? LINEA_SUAVE,
    },
  ],
  margin: opciones.margin ?? [0, 6, 0, 10],
});

// ── La predicación, en vertical ───────────────────────────────────────────

/**
 * Un texto libre (explicación, ilustración, aplicación, subpunto…) como array
 * de `text` runs de pdfmake: cada `*marca*` sale en negrita y cada
 * `{{cita}}` en cursiva, en el sitio exacto donde se escribieron — antes las
 * dos se limpiaban con `quitarMarcas` sin más y el formato desaparecía.
 */
const runsDeTexto = (texto, opciones = {}) =>
  // `sinMarcadorDeSubtitulo`: esto pinta EN LÍNEA, así que un `##` escrito a
  // mano —en la transición o en un campo de la schiță, que no pasan por
  // `bloquesDe`— no tiene aquí ningún significado y se imprimía tal cual.
  segmentarTexto(sinMarcadorDeSubtitulo(texto || '').trim()).map((s) => ({
    text: s.texto,
    ...(s.bold || opciones.bold ? { bold: true } : {}),
    ...(s.italica ? { italics: true } : {}),
  }));

/**
 * Un pasaje citado: la referencia encima y el texto debajo, con una barra
 * vertical azul a la izquierda y sangrado.
 *
 * Aquí no hay CSS, así que la barra se dibuja con el borde de una tabla de una
 * sola celda —el truco habitual de pdfmake para simular un `border-left`—. Es
 * la misma idea que `.texto-formateado__verso` en pantalla: lo que se ve en el
 * documento de la aplicación y lo que sale impreso tienen que ser la misma
 * cosa.
 *
 * `cuerpo` admite una cadena (un versículo suelto) o un array de runs (el
 * pasaje de la predicación, que lleva los números de versículo intercalados).
 */
const bloqueCitado = (label, cuerpo, opciones = {}) => {
  const nodo = {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              ...(label ? [{ text: label, bold: true, color: ACENTO, fontSize: T.nota, margin: [0, 0, 0, 3] }] : []),
              {
                text: cuerpo,
                fontSize: opciones.fontSize ?? T.cita,
                // El versículo citado va en cursiva; el pasaje de la predicación
                // NO, que son varios versículos seguidos y se leen en voz alta.
                ...(opciones.italics === false ? {} : { italics: true }),
                ...(opciones.color ? { color: opciones.color } : {}),
                lineHeight: opciones.lineHeight ?? 1.35,
              },
            ],
            // Sólo el borde IZQUIERDO, que es la barra. Con los cuatro en
            // `false` —como estaba— pdfmake no dibuja ninguno: el `border` de la
            // celda manda sobre el `vLineWidth` del layout, así que la barra
            // azul no se pintaba nunca. Era justo lo que el propietario pidió
            // que apareciera «también en el PDF».
            border: [true, false, false, false],
          },
        ],
      ],
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
    margin: [CARRIL + SANGRIA_CITA, AIRE_PARRAFO, 0, AIRE_PARRAFO],
  };

  // Un versículo no se parte entre dos páginas si cabe entero en una. Visto
  // impreso: al pie de la hoja quedaba la referencia sola, con la barra azul
  // cortada, y el texto empezaba en la siguiente. Se mide sobre el nodo ya
  // construido —no sobre una copia de sus medidas— porque `unbreakable` sobre
  // algo más alto que la página hace desaparecer el contenido (trampa 64), y
  // un pasaje entero de veinte versículos sí puede pasarse.
  return { ...nodo, unbreakable: cabeEnUnaPagina([nodo]) };
};

/**
 * Un versículo de apoyo, con su texto impreso: en papel no se puede tocar la
 * referencia para abrirla, así que si el texto no está aquí no está.
 */
const bloqueVersiculo = (ref) => bloqueCitado(ref.label, ref.text || '', { color: GRIS });

/**
 * El pasaje de la predicación, al principio del folio.
 *
 * Es el único texto del documento que no ha escrito el predicador, y hasta el
 * 2 nov 2026 no se imprimía: el folio llevaba la referencia y había que abrir
 * la Biblia al lado para seguir el texto que se estaba explicando. Va alineado
 * a la izquierda como el resto del cuerpo y con la referencia encima.
 *
 * Los números de versículo van en azul y pequeños, intercalados: el pasaje se
 * lee de corrido, no como una lista.
 */
const bloquePericopa = (etiqueta, versiculos) => {
  const runs = [];
  for (const v of versiculos || []) {
    if (!v?.texto) continue;
    if (runs.length) runs.push({ text: '  ' });
    // El número va en línea, en negrita y en azul, un par de puntos por debajo
    // del cuerpo. No se usa `sup`: pdfmake multiplica el tamaño por 0,58, y un
    // 10,5 se queda en 6 pt, que salido de una fotocopiadora es una mancha.
    runs.push({ text: `${v.numero} `, bold: true, color: ACENTO, fontSize: T.nota });
    runs.push({ text: v.texto });
  }
  if (!runs.length) return [];
  return [bloqueCitado(etiqueta || '', runs, { fontSize: T.pericopa, italics: false, lineHeight: 1.4 })];
};

/**
 * El titular de una sección: INTRODUCERE, cada punto numerado y ÎNCHEIERE.
 *
 * Los tres son el MISMO nivel y por eso comparten tratamiento —azul, en
 * mayúsculas, con su filete debajo—. Antes los puntos iban en tinta y en caja
 * baja, un tamaño más grandes, así que el folio parecía tener dos jerarquías
 * distintas cuando siempre fue una. Es el mismo subrayado que lleva el titular
 * de un punto en la página pública.
 *
 * Devuelve los dos nodos sueltos para poder agruparlos con el primer bloque del
 * cuerpo: un titular no puede quedarse solo al pie de una hoja.
 */
const tituloDeSeccion = (texto) => [
  {
    text: (texto || '').toUpperCase(),
    fontSize: T.seccion,
    bold: true,
    color: ACENTO,
    characterSpacing: 0.7,
    // El aire de arriba es seis veces el de abajo a propósito: un titular
    // pertenece a lo que viene DESPUÉS, y con el mismo espacio a los dos lados
    // flota entre dos bloques sin decir cuál abre.
    margin: [0, 18, 0, 3],
  },
  filete({ color: LINEA_ACENTO, grosor: 1, margin: [0, 0, 0, 8] }),
];

/**
 * Un campo de texto libre, ya convertido en nodos de pdfmake.
 *
 * Aquí es donde se ven los tres marcados en papel:
 *   - una línea en blanco deja de ser un renglón vacío y pasa a ser el aire
 *     entre dos párrafos;
 *   - `## rótulo` sale en mayúsculas y negrita, con aire antes y después;
 *   - una `{{cita}}` que esté sola en su línea sale como bloque con su barra
 *     azul, y si está en mitad de una frase se queda en línea y en cursiva.
 */
const cuerpoDeCampo = (texto, opciones = {}) =>
  bloquesDe(texto || '').map((b, i) => {
    if (b.tipo === 'subtitulo') {
      // En el carril, con los titulares: es un rótulo, no cuerpo. Y un punto
      // por debajo del subpunto, porque la caja alta ya pesa de por sí; en azul
      // competiría con el titular de la sección.
      return {
        text: b.texto.toUpperCase(),
        fontSize: T.subtitulo,
        bold: true,
        characterSpacing: 0.8,
        margin: [0, 15, 0, 5],
      };
    }
    if (b.tipo === 'cita') return bloqueCitado(b.label, b.texto, { color: GRIS });
    return {
      // Alineado a la izquierda, no justificado: justificar con la tipografía y
      // el ancho de este documento abría ríos de espacio en blanco entre
      // palabras, que se notaban más que la ganancia estética del margen recto.
      text: runsDeTexto(b.texto, opciones),
      fontSize: T.cuerpo,
      lineHeight: INTERLINEA,
      alignment: 'left',
      // El primer párrafo de un campo lleva el doble de aire encima: sin las
      // etiquetas EXPLICĂ / ILUSTREAZĂ / APLICĂ, una predicación que no use
      // rótulos —todas las escritas hasta hoy— imprimía los tres campos del
      // punto como una tira de párrafos indistinguibles. Así se nota dónde
      // acaba uno y empieza el otro sin reintroducir ningún rótulo.
      margin: [CARRIL, i === 0 ? AIRE_PARRAFO * 2 : AIRE_PARRAFO, 0, 0],
    };
  });

// ── ¿Cabe entero en una página? ────────────────────────────────────────────
//
// `unbreakable: true` le pide a pdfmake que no reparta un bloque entre dos
// páginas. El problema es cuando el bloque es más alto que UNA PÁGINA ENTERA:
// pdfmake no tiene dónde ponerlo completo y el resultado no es que lo reparta,
// es que el contenido se superpone con lo que viene después y, a simple vista,
// el punto ha desaparecido del PDF.
//
// Desde el 2 nov 2026 ya no se agrupa el punto entero, sólo el titular con su
// primer bloque: lo que el propietario pidió es que la predicación fluya y que
// ninguna sección se quede sola en una hoja, y agrupar el punto completo hacía
// justo lo contrario —si el punto no cabía en lo que quedaba de página, se iba
// entero a la siguiente y dejaba INTRODUCERE sola con media hoja en blanco—.
// La comprobación se queda igualmente, porque un titular con un primer párrafo
// larguísimo también puede pasarse de página.
//
// Esto es una estimación GRUESA a propósito: no hay forma de saber el alto
// real sin que pdfmake ya lo haya compuesto. Se peca de conservador —mejor
// partir un bloque que arriesgarse a perderlo—.
// pt. Algo menos que el alto útil real (unos 700), como colchón de seguridad.
const ALTO_UTIL = 620;

const textoDeRun = (n) => (Array.isArray(n.text) ? n.text.map((t) => t.text || '').join('') : n.text || '');

const estimarAlto = (nodos, anchoDisponible = ANCHO_UTIL) => {
  let alto = 0;
  for (const n of nodos) {
    if (!n || typeof n !== 'object') continue;
    const margenes = (n.margin?.[1] || 0) + (n.margin?.[3] || 0);
    const ancho = Math.max(120, anchoDisponible - (n.margin?.[0] || 0) - (n.margin?.[2] || 0));

    // Un filete es un `canvas`: no tiene texto, pero ocupa su margen. Sin este
    // caso, cada titular de sección contaba ocho puntos menos de lo que mide.
    if (n.canvas) {
      alto += margenes + n.canvas.reduce((a, t) => a + (t.y2 || 0) + (t.lineWidth || 0), 0);
      continue;
    }
    // `bloqueCitado` es una tabla de una celda (la barra de la izquierda es su
    // borde), no un `text`: sin este caso el alto de cada versículo citado
    // contaba como 0 y un punto con varias citas largas se declaraba «cabe
    // entero» sin caber, que es exactamente el bug que este heurístico existe
    // para evitar (trampa 64).
    if (n.table) {
      // El ancho de dentro de la celda: la tabla ya va sangrada por su margen y
      // además tiene 10 pt de relleno a la izquierda (la barra). Sin descontarlo
      // se miden las líneas más anchas de lo que se imprimen.
      const celdas = n.table.body.flat().flatMap((celda) => celda.stack || []);
      alto += estimarAlto(celdas, ancho - 10) + margenes;
      continue;
    }
    if (n.stack) {
      alto += estimarAlto(n.stack, ancho) + margenes;
      continue;
    }
    const texto = textoDeRun(n);
    const tamano = n.fontSize || T.cuerpo;
    // El ancho es el del NODO, no el de la página: el cuerpo va sangrado al
    // carril y las citas un poco más, así que con el ancho de la página entera
    // saldrían menos líneas de las que se imprimen — y subestimar es la
    // dirección que resucita la trampa 64.
    // ~2 caracteres por punto de ancho a este tamaño.
    const porLinea = Math.max(20, Math.round((ancho / tamano) * 2));
    // Cada salto de línea escrito es una línea impresa, aunque no llene el
    // ancho. Contando sólo los caracteres, un campo escrito con una frase por
    // línea —que es como escribe mucha gente— se medía en la mitad de lo que
    // ocupa: el grupo se declaraba «cabe» y pdfmake descartaba lo que sobraba,
    // o sea que la sección entera desaparecía del folio.
    const lineas = texto
      ? texto.split('\n').reduce((a, linea) => a + Math.max(1, Math.ceil(linea.length / porLinea)), 0)
      : 1;
    alto += lineas * tamano * (n.lineHeight || INTERLINEA) + margenes;
  }
  return alto;
};

const cabeEnUnaPagina = (nodos) => estimarAlto(nodos) < ALTO_UTIL;

/**
 * Agrupa un titular con el primer bloque de su cuerpo y deja el resto suelto.
 *
 * Es lo más parecido a un «keep-with-next» que hay en pdfmake: el grupo es
 * pequeño, así que casi siempre cabe y el titular nunca se queda solo al pie de
 * una hoja; y como lo demás va suelto, el texto sigue fluyendo de una página a
 * la siguiente sin saltos ni huecos.
 */
const seccion = (titular, cuerpo) => {
  const grupo = [...titular, ...cuerpo.slice(0, 1)];
  return [{ stack: grupo, unbreakable: cabeEnUnaPagina(grupo) }, ...cuerpo.slice(1)];
};

export const definirPredica = (sermon, contenido, etiquetas = {}) => {
  const c = normalizeContent(contenido);
  const palabras = sermonWordCount(c);
  const e = {
    intro: 'INTRODUCERE',
    conclusion: 'ÎNCHEIERE',
    refs: 'REFERINȚE',
    idea: 'IDEEA CENTRALĂ',
    passage: 'TEXTUL BIBLIC',
    minutos: 'min',
    palabras: 'cuvinte',
    ...etiquetas,
  };

  const cuerpo = [];

  // ── Cabecera, centrada ──
  //
  // Centrada a petición del propietario, y de paso resuelve algo que no se veía
  // bien: con el título a la izquierda, el folio empezaba igual que cualquier
  // párrafo y la primera página no parecía la primera.
  cuerpo.push({
    text: sermon.title || '',
    fontSize: T.titulo,
    bold: true,
    alignment: 'center',
    lineHeight: 1.15,
    margin: [0, 0, 0, 5],
  });
  if (sermon.reference) {
    cuerpo.push({
      text: sermon.reference,
      fontSize: T.referencia,
      color: ACENTO,
      bold: true,
      alignment: 'center',
    });
  }
  cuerpo.push({
    text: `${palabras} ${e.palabras} · ~${estimatedMinutes(palabras)} ${e.minutos}`,
    fontSize: T.nota,
    color: GRIS,
    alignment: 'center',
    margin: [0, 5, 0, 0],
  });
  // Un filete corto y centrado en vez de una raya de margen a margen: cierra la
  // cabecera sin partir la hoja en dos.
  cuerpo.push(
    filete({
      x1: ANCHO_UTIL / 2 - 45,
      x2: ANCHO_UTIL / 2 + 45,
      grosor: 1.5,
      color: ACENTO,
      margin: [0, 12, 0, 14],
    }),
  );

  // ── El pasaje ──
  //
  // Con el rótulo «TEXTUL BIBLIC» y no con la referencia: la referencia ya está
  // tres líneas más arriba, debajo del título, y repetirla aquí la convertía en
  // lo único que se lee dos veces en todo el folio.
  cuerpo.push(...bloquePericopa(e.passage, sermon.pericope));

  // ── La idea central ──
  //
  // Centrada y entre dos filetes: es la frase de la que cuelga todo el sermón y
  // conviene encontrarla sin buscarla. Se eligieron filetes y no un recuadro
  // con fondo porque esto se fotocopia en una láser de iglesia, donde un fondo
  // claro sale tramado y gasta tóner para nada.
  if (c.idea.central.trim()) {
    cuerpo.push(filete({ color: LINEA_ACENTO, margin: [0, 12, 0, 8] }));
    cuerpo.push({
      text: e.idea,
      fontSize: T.nota,
      color: GRIS,
      characterSpacing: 0.6,
      alignment: 'center',
    });
    cuerpo.push({
      text: quitarMarcas(c.idea.central).trim(),
      fontSize: T.idea,
      italics: true,
      alignment: 'center',
      lineHeight: 1.3,
      margin: [0, 3, 0, 8],
    });
    cuerpo.push(filete({ color: LINEA_ACENTO, margin: [0, 0, 0, 4] }));
  }

  // ── Introducción ──
  if (c.intro.trim()) {
    cuerpo.push(...seccion(tituloDeSeccion(e.intro), cuerpoDeCampo(c.intro)));
  }

  // La transición, entre la introducción y el primer punto: sin encabezado
  // propio, porque no es una sección — es la frase con la que se pasa de una a
  // otro. En negrita para encontrarla de un golpe de vista desde el atril.
  if (c.transition.trim()) {
    cuerpo.push({
      text: runsDeTexto(c.transition, { bold: true }),
      fontSize: T.cuerpo,
      lineHeight: INTERLINEA,
      margin: [CARRIL, 12, 0, 0],
    });
  }

  c.structure.forEach((punto, i) => {
    const d = c.development[punto.id] || {};
    const bloques = [];

    // Los subpuntos van PRIMERO, justo después del título: son la división
    // analítica del punto, y explicación/ilustración/aplicación cierran ese
    // punto ya dividido. Antes iban después de las tres casillas, y leído de
    // corrido parecía que la predicación volvía atrás a subdividir algo que
    // ya se había explicado, ilustrado y aplicado.
    (punto.subpoints || []).forEach((sub, j) => {
      const titulo = quitarMarcas(sub.title || '').trim();
      const texto = (c.development[sub.id]?.text || '').trim();
      if (!titulo && !texto) return;
      bloques.push({
        text: `${i + 1}.${j + 1} ${titulo}`.trim(),
        fontSize: T.subpunto,
        bold: true,
        margin: [0, 13, 0, 3],
      });
      bloques.push(...cuerpoDeCampo(texto));
    });

    // Sin las etiquetas EXPLICĂ / ILUSTREAZĂ / APLICĂ: eran los nombres de las
    // casillas del formulario de preparación —andamio del curso de homilética—
    // y en el folio no significaban nada para quien lo lee. Lo que sale ahora
    // son los rótulos que escribe el predicador (`## rótulo`), donde él los
    // pone.
    bloques.push(...cuerpoDeCampo(d.explain));
    bloques.push(...cuerpoDeCampo(d.illustrate));
    bloques.push(...cuerpoDeCampo(d.apply));

    const refs = [
      ...(punto.refs || []),
      ...(d.refs || []),
      ...(punto.subpoints || []).flatMap((sub) => c.development[sub.id]?.refs || []),
    ].filter((r) => r?.label);
    if (refs.length) {
      bloques.push({
        text: e.refs,
        fontSize: T.nota,
        color: GRIS,
        characterSpacing: 0.6,
        margin: [CARRIL + SANGRIA_CITA, 12, 0, 2],
      });
      for (const r of refs) bloques.push(bloqueVersiculo(r));
    }

    // Los asteriscos del marcado manual no se imprimen: en papel no hay nada
    // que puedan aportar y ensucian el título.
    cuerpo.push(...seccion(tituloDeSeccion(`${i + 1}. ${quitarMarcas(punto.title).trim()}`), bloques));
  });

  if (c.conclusion.trim()) {
    cuerpo.push(...seccion(tituloDeSeccion(e.conclusion), cuerpoDeCampo(c.conclusion)));
  }

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [MARGEN, MARGEN + 2, MARGEN, MARGEN],
    defaultStyle: { font: 'Roboto', fontSize: T.cuerpo, color: TINTA, lineHeight: INTERLINEA },
    content: cuerpo,
    header: cabeceraDePagina(sermon),
    footer: pieDePagina,
  };
};

/**
 * Línea de cortesía de las páginas segunda y siguientes: título y referencia,
 * pequeños y en gris.
 *
 * En la primera no hace falta —el título está ahí, a 23 puntos— y en las demás
 * resuelve el problema de una grapa que se suelta: una hoja sola no dice de qué
 * predicación es. Va dentro del margen superior, así que no le quita sitio al
 * texto.
 */
const cabeceraDePagina = (sermon) => (pagina) => {
  if (pagina < 2) return null;
  const titulo = [sermon?.title, sermon?.reference].filter(Boolean).join(' · ');
  if (!titulo) return null;
  return {
    text: titulo,
    fontSize: T.cabecera,
    color: GRIS,
    alignment: 'right',
    margin: [MARGEN, 22, MARGEN, 0],
  };
};

/**
 * Pie de página de los dos PDF: la numeración y la marca.
 *
 * `robible.com` va a la derecha y el número al centro. Es toda la publicidad
 * que lleva la aplicación: es gratuita, y un PDF de predicación se imprime, se
 * reparte y se reenvía — quien lo recibe debería poder saber de dónde salió.
 *
 * Gris y pequeño a propósito: en la hoja que el predicador tiene delante en el
 * púlpito, nada que no sea su texto puede llamar la atención.
 */
const pieDePagina = (pagina, total) => ({
  columns: [
    { text: '', width: '*' },
    { text: `${pagina} / ${total}`, alignment: 'center', width: 'auto' },
    { text: 'robible.com', alignment: 'right', width: '*' },
  ],
  fontSize: T.nota,
  color: GRIS,
  margin: [MARGEN, 12, MARGEN, 0],
});

// ── La schiță, apaisada y para doblar ─────────────────────────────────────

const columnaDeSchita = (trozos) => ({ stack: trozos, width: '*' });

// A4 apaisado menos márgenes son 527 pt de alto útil por cara. Se cuentan 495
// como colchón: pasarse mete una página que el plegado no espera, y entonces
// el cuadernillo sale desordenado.
const ALTO_CARA = 460;

/**
 * El alto de un trozo de la schiță, en puntos.
 *
 * Se mide en puntos y no «en líneas» desde el 2 nov 2026. Contar líneas se
 * quedaba corto por dos sitios a la vez —cada trozo lleva sus márgenes, y el
 * titular de un punto es un cuerpo y medio— y el resultado era medible: una
 * predicación normal planificaba dos páginas y pdfmake imprimía tres, con lo
 * que el plegado dejaba de cuadrar.
 *
 * El ancho es el de media hoja apaisada menos el canal del doblez; se cuentan
 * 1,9 caracteres por punto de ancho, un pelo conservador, porque en negrita y
 * en mayúsculas la letra es más ancha que en el texto corrido.
 */
const altoDeSchita = (nodo) => {
  const margenes = (nodo.margin?.[1] || 0) + (nodo.margin?.[3] || 0);
  if (nodo.stack) return nodo.stack.reduce((a, n) => a + altoDeSchita(n), 0) + margenes;
  const texto = textoDeRun(nodo);
  const tamano = nodo.fontSize || T.schitaClave;
  const porLinea = Math.max(16, Math.round((ANCHO_COLUMNA_SCHITA / tamano) * 1.9));
  // Los saltos escritos cuentan como líneas, igual que en el folio.
  const lineas = texto.split('\n').reduce((a, linea) => a + Math.max(1, Math.ceil(linea.length / porLinea)), 0);
  return Math.max(1, lineas) * tamano * (nodo.lineHeight || 1.25) + margenes;
};

export const definirSchita = (sermon, esquema, etiquetas = {}) => {
  const o = normalizeOutline(esquema);
  const e = { application: 'APLICAȚIE', conclusion: 'ÎNCHEIERE', ...etiquetas };

  // Todo el contenido, en orden, como una lista de trozos. Después se reparte
  // entre las caras de la hoja.
  const trozos = [];

  // Cabecera centrada, como el folio de la predicación: es la portada de la
  // cartilla, y a la izquierda se leía como la primera línea de la lista.
  trozos.push({
    text: sermon.title || '',
    fontSize: T.schitaTitulo,
    bold: true,
    alignment: 'center',
    margin: [0, 0, 0, 2],
  });
  if (sermon.reference) {
    trozos.push({ text: sermon.reference, fontSize: T.nota, color: ACENTO, bold: true, alignment: 'center' });
  }
  if (o.idea) {
    trozos.push({
      // La idea puede traer negrita: la schiță se retoca a mano antes de
      // predicar, así que cualquiera de sus campos puede llevar una `*marca*`.
      text: runsDeTexto(o.idea),
      fontSize: T.schitaClave,
      italics: true,
      color: GRIS,
      alignment: 'center',
      margin: [0, 5, 0, 7],
    });
  }

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
    trozos.push({ text: runsDeTexto(o.transition, { bold: true }), fontSize: T.schitaClave, margin: [0, 5, 0, 3] });
  }

  o.points.forEach((p, i) => {
    const grupo = [
      {
        text: `${i + 1}. ${quitarMarcas(p.title)}`,
        fontSize: T.schitaPunto,
        bold: true,
        color: ACENTO,
        margin: [0, 8, 0, 3],
      },
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
      grupo.push({
        text: (p.refs || []).join('  ·  '),
        fontSize: T.nota,
        color: ACENTO,
        bold: true,
        margin: [8, 2, 0, 0],
      });
    }
    // Un punto entero no se parte entre las dos mitades: en el atril, medio
    // punto a cada lado del doblez es peor que dejar hueco.
    //
    // Pero sólo si cabe en una cara. `unbreakable` sobre un bloque más alto que
    // la caja no lo reparte: pdfmake lo superpone con lo que venga después y el
    // punto DESAPARECE del papel (es la trampa 64, en la schiță). Hasta la
    // regla nueva no podía pasar —un punto eran cinco líneas—; ahora, con cada
    // frase del desarrollo, un punto largo se pasa de la columna entera.
    //
    // El margen es del 85 % de la cara y no del 100: la estimación es gruesa, y
    // en el filo —un punto que mide «justo lo que cabe»— equivocarse por poco
    // significa perder el punto entero, mientras que pasarse de prudente sólo
    // significa que se parte por el doblez.
    trozos.push({ stack: grupo, unbreakable: altoDeSchita({ stack: grupo }) <= ALTO_CARA * 0.85 });
  });

  if (o.application) {
    trozos.push({ text: e.application, fontSize: T.nota, color: GRIS, characterSpacing: 0.6, margin: [0, 10, 0, 2] });
    // Puede traer negrita y citas desde que sale del propósito con la misma
    // regla que el resto (2 nov 2026), así que tampoco va como texto plano.
    trozos.push({ text: runsDeTexto(o.application), fontSize: T.schitaClave, margin: [0, 0, 0, 4] });
  }
  if (o.conclusion) {
    trozos.push({ text: e.conclusion, fontSize: T.nota, color: GRIS, characterSpacing: 0.6, margin: [0, 8, 0, 2] });
    trozos.push({ text: runsDeTexto(o.conclusion), fontSize: T.schitaClave });
  }

  // ── Reparto en caras ──
  //
  // Se llena cara a cara hasta donde cabe, NO repartiendo el total a partes
  // iguales. La media engaña: los trozos son de tamaños muy distintos —un
  // punto entero frente a una línea de introducción— y una cara se pasaba de
  // la caja mientras la de al lado quedaba a medias. Medido con una
  // predicación normal: se planificaban dos páginas y pdfmake imprimía tres,
  // y a partir de ahí el plegado del cuadernillo ya no cuadra con nada.
  const caras = [[]];
  let altoCara = 0;
  for (const t of trozos) {
    const alto = altoDeSchita(t);
    if (altoCara && altoCara + alto > ALTO_CARA) {
      caras.push([]);
      altoCara = 0;
    }
    caras[caras.length - 1].push(t);
    altoCara += alto;

    // Un punto más alto que la cara entera se va a partir de todas formas (por
    // eso tampoco es indivisible): se le reservan las caras que va a ocupar de
    // más, o la cuenta de páginas sale corta y el plegado se descuadra. Con un
    // punto así la schiță ya se ha ido de madre y lo que toca es recortarla a
    // mano, pero al menos no desaparece nada ni salen hojas de sobra.
    const deMas = Math.ceil(altoCara / ALTO_CARA) - 1;
    if (deMas > 0) {
      for (let i = 0; i < deMas; i++) caras.push([]);
      altoCara = 0;
    }
  }

  // Con poco contenido, una hoja a una cara doblada por el medio ya es el
  // cuadernillo: dos caras escritas y ni una en blanco. Si no cabe, se pasa a
  // cuatro caras (una hoja a doble cara), a ocho (dos hojas), etc. Siempre en
  // múltiplos de cuatro, porque una hoja doblada aporta cuatro páginas y las
  // hojas se meten una dentro de otra. Las caras que sobran van vacías: en un
  // cuadernillo son las páginas en blanco del final, que es lo normal.
  const nCaras = caras.length <= 2 ? 2 : 4 * Math.ceil(caras.length / 4);
  while (caras.length < nCaras) caras.push([]);
  const paginas = [];
  if (nCaras === 2) {
    paginas.push([caras[0], caras[1]]);
  } else {
    // Imposición de cuadernillo: una hoja doblada por el lado corto da cuatro
    // páginas, pero NO en orden. Al doblar, la mitad izquierda del anverso
    // queda detrás de todo, así que con una sola hoja se compone 4|1 delante y
    // 2|3 detrás; con el orden natural (1|2 y 3|4) sale desordenado.
    //
    // Con varias hojas es la misma cuenta hacia dentro, porque van metidas una
    // dentro de otra: la hoja `i` lleva delante la última cara que queda y la
    // primera, y detrás las dos siguientes. Para ocho caras: 8|1 y 2|7 en la
    // primera hoja, 6|3 y 4|5 en la segunda.
    for (let i = 0; i < nCaras / 4; i++) {
      paginas.push([caras[nCaras - 1 - 2 * i], caras[2 * i]]);
      paginas.push([caras[2 * i + 1], caras[nCaras - 2 - 2 * i]]);
    }
  }

  const content = paginas.map(([izquierda, derecha], i) => ({
    columns: [columnaDeSchita(izquierda), { text: '', width: CANAL_SCHITA }, columnaDeSchita(derecha)],
    columnGap: 0,
    ...(i > 0 ? { pageBreak: 'before' } : {}),
  }));

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [MARGEN_SCHITA, MARGEN_SCHITA, MARGEN_SCHITA, MARGEN_SCHITA],
    defaultStyle: { font: 'Roboto', fontSize: T.schitaClave, color: TINTA },
    content,
    // La línea del doblez, por el medio exacto de la hoja apaisada.
    background: () => ({
      canvas: [
        {
          type: 'line',
          x1: A4_ALTO / 2,
          y1: 24,
          x2: A4_ALTO / 2,
          y2: A4_ANCHO - 24,
          lineWidth: 0.5,
          dash: { length: 3 },
          lineColor: LINEA_SUAVE,
        },
      ],
    }),
    // La marca va sólo a la derecha del todo, que en la hoja doblada es el
    // borde exterior de la mitad derecha. Sin número de página: la schiță es
    // una hoja que se dobla y se lleva al púlpito, no un documento paginado.
    footer: () => ({
      text: 'robible.com',
      alignment: 'right',
      fontSize: T.nota,
      color: GRIS,
      margin: [0, 6, MARGEN_SCHITA, 0],
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
