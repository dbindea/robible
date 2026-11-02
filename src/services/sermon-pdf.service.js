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

// Apaisado y a dos columnas con un canal por el medio.
//
// El margen bajó de 34 a 14 pt el 2 nov 2026, a petición del propietario:
// «no dejes márgenes para aprovechar todo el papel». No es cero y no puede
// serlo — prácticamente ninguna impresora doméstica imprime hasta el borde, y
// con cero lo que pasa no es que se aproveche más papel, es que la primera
// línea de cada cara sale CORTADA. 14 pt son 5 mm, que es el borde muerto
// típico. El canal del medio, en cambio, se mantiene: es el único aire que
// separa las dos columnas y sin él se leen como una sola.
const MARGEN_SCHITA = 14;
const CANAL_SCHITA = 30;
const ANCHO_COLUMNA_SCHITA = (A4_ALTO - MARGEN_SCHITA * 2 - CANAL_SCHITA) / 2;

// ── La serif de la cartilla ───────────────────────────────────────────────
//
// Tinos: Times New Roman de licencia abierta, misma métrica. Se empotra desde
// `pdf-font.js`, que genera `scripts/build-pdf-font.mjs`. El porqué de todo
// —por qué no las fuentes estándar del PDF, por qué WOFF y no WOFF2— está en
// la cabecera de ese script.
const SERIF = 'Tinos';
const FICHEROS_SERIF = {
  normal: 'Tinos-Regular.woff',
  bold: 'Tinos-Bold.woff',
  italics: 'Tinos-Italic.woff',
  bolditalics: 'Tinos-BoldItalic.woff',
};

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
  // ── La schiță ──
  //
  // 15 pt lo pidió el propietario después de llevar la cartilla al atril, y es
  // una medida con un motivo físico detrás: en el púlpito el papel está a unos
  // 70 cm y la mirada va y viene de la congregación al folio, así que lo que
  // importa no es leer con comodidad sino **reconocer la línea de un vistazo**.
  // A 11 pt había que buscarla. Es un documento distinto del folio de la
  // predicación, que se lee de cerca y sigue en 11.
  schitaTitulo: 21,
  schitaPunto: 17,
  schitaClave: 15,
  schitaNota: 11, // Los «Versete de sprijin» de cada punto.
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
  const [mod, fuentes, serif] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
    // Dinámico igual que la librería: son 115 KB y sólo hacen falta cuando
    // alguien imprime. Así no entran en el bundle de arranque.
    import('./pdf-font.js'),
  ]);
  const lib = mod.default || mod;

  // Las fuentes van en un "sistema de ficheros virtual". Desde pdfmake 0.3 se
  // registran con `addVirtualFileSystem`; asignar `.vfs` a secas —como se hacía
  // en 0.2— no las da de alta y la generación falla con «Roboto-Medium.ttf not
  // found». Se prueban las dos formas para no atarse a una versión.
  const registrar = (ficheros) => {
    if (!ficheros) return;
    if (typeof lib.addVirtualFileSystem === 'function') lib.addVirtualFileSystem(ficheros);
    else lib.vfs = { ...(lib.vfs || {}), ...ficheros };
  };
  registrar(fuentes.default?.vfs || fuentes.vfs || fuentes.default);

  // La serif de la schiță, aparte de la Roboto que trae pdfmake. Son dos
  // documentos con dos trabajos distintos: el folio de la predicación se lee
  // de cerca y va en palo seco; la cartilla se mira de reojo desde el atril y
  // va en Tinos, que es Times New Roman con otro nombre (ver `pdf-font.js`).
  registrar({
    [FICHEROS_SERIF.normal]: serif.TINOS.normal,
    [FICHEROS_SERIF.bold]: serif.TINOS.bold,
    [FICHEROS_SERIF.italics]: serif.TINOS.italics,
    [FICHEROS_SERIF.bolditalics]: serif.TINOS.bolditalics,
  });
  if (typeof lib.addFonts === 'function') lib.addFonts({ [SERIF]: FICHEROS_SERIF });

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
              ...(label
                ? [
                    {
                      text: label,
                      bold: true,
                      color: ACENTO,
                      fontSize: opciones.labelFontSize ?? T.nota,
                      margin: [0, 0, 0, 3],
                    },
                  ]
                : []),
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
    margin: opciones.margin ?? [CARRIL + SANGRIA_CITA, AIRE_PARRAFO, 0, AIRE_PARRAFO],
  };

  // En la cartilla el reparto en caras ya decide dónde cae cada trozo, así que
  // marcar esto indivisible sólo puede estorbar (y `cabeEnUnaPagina` mide
  // contra la página vertical, que allí no existe).
  if (opciones.unbreakable === false) return nodo;

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
    // `runsDeTexto` y no la cadena pelada: el predicador inserta el versículo
    // y después pone en negrita una palabra DE DENTRO, que es el gesto para
    // señalar sobre qué palabra va el punto. Era la única rama de este
    // troceado que no pasaba por la segmentación, así que ahí —y sólo ahí—
    // el asterisco salía impreso, mientras en pantalla se veía la negrita.
    if (b.tipo === 'cita') return bloqueCitado(b.label, runsDeTexto(b.texto), { color: GRIS });
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

// ── La schiță, apaisada y a dos columnas ──────────────────────────────────
//
// Dejó de ser un cuadernillo el 2 nov 2026. Antes se imponía para doblar —la
// hoja doblada da cuatro páginas y NO en orden—, y eso tenía dos consecuencias
// que el propietario vio impresas: las caras se rellenaban en múltiplos de
// cuatro, así que sobraban medias páginas en blanco, y los bloques no se leían
// de izquierda a derecha. Ahora las caras van seguidas (1|2, 3|4, …) y cada
// hoja lleva su número abajo a la derecha, que es lo que las ordena.

const columnaDeSchita = (trozos) => ({ stack: trozos, width: '*' });

// El alto útil de una cara.
//
// A4 apaisado son 595 pt de alto; menos el margen de arriba y la banda del pie
// quedan ~555. Se cuentan 520: la estimación es gruesa y pasarse significa que
// pdfmake añade una página por su cuenta, con lo que la cuenta de caras deja de
// cuadrar con lo impreso.
//
// Calibrado barriendo el valor y generando el PDF de VERDAD cada vez, con tres
// predicaciones —una real y dos sintéticas—, y comparando las caras planeadas
// con las páginas impresas. Desde la definición esto no se ve. El barrido
// empezaba a descuadrar en 545, así que 520 deja un colchón de media línea.
const ALTO_CARA = 520;

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
  // Una cita lleva su barra dibujada con el borde de una tabla de una celda
  // (ver `bloqueCitado`). Sin esta rama, cada versículo citado mediría CERO y
  // la cara se declararía medio vacía estando llena: es la trampa 71, otra vez
  // y en el otro documento. Los 8 pt son el relleno de la celda.
  if (nodo.table) {
    return nodo.table.body.flat().reduce((a, celda) => a + altoDeSchita(celda), 0) + margenes + 8;
  }
  const texto = textoDeRun(nodo);
  const tamano = nodo.fontSize || T.schitaClave;
  const porLinea = Math.max(16, Math.round((ANCHO_COLUMNA_SCHITA / tamano) * 1.9));
  // Los saltos escritos cuentan como líneas, igual que en el folio.
  const lineas = texto.split('\n').reduce((a, linea) => a + Math.max(1, Math.ceil(linea.length / porLinea)), 0);
  return Math.max(1, lineas) * tamano * (nodo.lineHeight || 1.25) + margenes;
};

/**
 * Una línea de la cartilla. Son tres formas y se distinguen SOLAS, por la
 * sintaxis con la que `generateOutline` las escribió:
 *
 *   - `## RÓTULO`        el subtítulo del predicador. **Sin guion**: no es un
 *                        elemento más de la lista, es la división que él puso.
 *   - `{{ref|texto}}`    un versículo citado. Con su barra azul a la
 *                        izquierda, igual que en el folio y en pantalla.
 *   - cualquier otra     una frase, con su guion.
 *
 * El reparto lo hace `bloquesDe`, que es el mismo que usa `TextoFormateado`
 * en pantalla. Por eso la cartilla impresa y el Modo Amvon no pueden
 * discrepar: no hay dos lectores de esta sintaxis, hay uno.
 */
const nodosDeBloques = (bloques) =>
  bloques.map((b) => {
    if (b.tipo === 'subtitulo') {
      return {
        text: b.texto.toUpperCase(),
        fontSize: T.schitaClave,
        bold: true,
        characterSpacing: 0.4,
        margin: [0, 7, 0, 3],
      };
    }
    if (b.tipo === 'cita') {
      return bloqueCitado(b.label, runsDeTexto(b.texto), {
        fontSize: T.schitaClave,
        labelFontSize: T.schitaNota,
        color: GRIS,
        lineHeight: 1.2,
        margin: [0, 3, 0, 3],
        unbreakable: false,
      });
    }
    // `runsDeTexto` y no texto plano: una línea puede traer lo marcado con
    // asteriscos, y sin esto el símbolo saldría impreso tal cual.
    return {
      text: ['- ', ...runsDeTexto(b.texto)],
      fontSize: T.schitaClave,
      margin: [0, 0, 0, 2],
      lineHeight: 1.25,
    };
  });

/** Las líneas de una lista de claves (las de un punto). */
const nodosDeClaves = (claves) => (claves || []).flatMap((k) => nodosDeBloques(bloquesDe(k)));

/** Las líneas de un campo de texto (la aplicación, la conclusión), cuyas
 *  frases van separadas por una línea en blanco desde el 2 nov 2026. */
const nodosDeCampo = (texto) => nodosDeBloques(bloquesDe(texto || ''));

/**
 * El titular de una sección de la cartilla.
 *
 * Lo comparten los puntos numerados, APLICAȚIE y CONCLUZIE: son **el mismo
 * nivel**, igual que en el folio de la predicación (ver la trampa 72). Antes
 * la conclusión llevaba una etiqueta gris diminuta y su contenido salía como
 * un párrafo corrido; el propietario pidió «escríbela como si fuera un punto
 * más». Sin número, eso sí: en homilética la conclusión no es una división
 * del texto, y numerarla diría algo que no es verdad.
 */
const titularDeSchita = (texto) => ({
  text: texto,
  fontSize: T.schitaPunto,
  bold: true,
  color: ACENTO,
  margin: [0, 9, 0, 3],
});

/**
 * Una sección de la cartilla, aplanada en trozos sueltos.
 *
 * APLANADA, y esto es lo único importante de esta función. La sección no se
 * agrupa en un nodo indivisible, aunque sería lo natural y es lo que se hacía
 * hasta el 2 nov 2026. El motivo se midió sobre la primera predicación real
 * llevada al atril: su segundo punto medía **808 pt contra 555 de caja**. Una
 * sección más alta que una cara no se puede meter en una cara, y lo que hace
 * pdfmake entonces es derramarla en una página nueva **por su cuenta** — la
 * columna izquierda continúa en la hoja siguiente mientras la derecha se queda
 * en la actual. Resultado: el orden de lectura de izquierda a derecha, que es
 * justo lo que se pidió, se rompe precisamente en las predicaciones largas.
 *
 * Repartiendo trozo a trozo no hay nada que se derrame: cada cara se llena
 * hasta donde cabe y la sección continúa en la siguiente, que es como se
 * comporta cualquier texto.
 */
const seccionDeSchita = (titular, lineas) => [
  // El titular se marca para que el reparto no lo deje solo al pie de una
  // columna: es el «keep-with-next» que pdfmake no tiene.
  { nodo: titular, titular: true },
  ...lineas.map((nodo) => ({ nodo })),
];

export const definirSchita = (sermon, esquema, etiquetas = {}) => {
  const o = normalizeOutline(esquema);
  const e = { intro: 'INTRODUCERE', application: 'APLICAȚIE', conclusion: 'ÎNCHEIERE', ...etiquetas };

  // Todo el contenido, en orden, como una lista plana de trozos —cada uno con
  // su nodo y si es un titular—. Después se reparte entre las caras.
  const trozos = [];
  const suelto = (nodo) => trozos.push({ nodo });

  // Cabecera centrada, como el folio de la predicación: es la portada de la
  // cartilla, y a la izquierda se leía como la primera línea de la lista.
  suelto({
    text: sermon.title || '',
    fontSize: T.schitaTitulo,
    bold: true,
    alignment: 'center',
    margin: [0, 0, 0, 2],
  });
  if (sermon.reference) {
    suelto({ text: sermon.reference, fontSize: T.schitaNota, color: ACENTO, bold: true, alignment: 'center' });
  }
  if (o.idea) {
    suelto({
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

  // La introducción lleva titular desde el 2 nov 2026, como los puntos y la
  // conclusión: así la cartilla entera se recorre por titulares azules y no
  // hay un bloque suelto al principio. Es el mismo orden del folio.
  if ((o.intro || []).length) {
    trozos.push(...seccionDeSchita(titularDeSchita(e.intro), nodosDeClaves(o.intro)));
  }

  // La transición va entera y en negrita, sin el guion de las demás líneas: el
  // resto de la schiță son recortes que se miran de reojo, y ésta es la única
  // frase que se lee tal cual está escrita.
  if (o.transition) {
    suelto({ text: runsDeTexto(o.transition, { bold: true }), fontSize: T.schitaClave, margin: [0, 5, 0, 3] });
  }

  o.points.forEach((p, i) => {
    // Guion y sin sangría: las ideas quedan alineadas a la izquierda, en
    // columna. Con el punto medio y 8 pt de sangría se leían como una
    // continuación del título en vez de como una lista.
    const lineas = nodosDeClaves(p.keywords);
    if ((p.refs || []).length) {
      lineas.push({
        text: (p.refs || []).join('  ·  '),
        fontSize: T.schitaNota,
        color: ACENTO,
        bold: true,
        margin: [8, 3, 0, 0],
      });
    }
    trozos.push(...seccionDeSchita(titularDeSchita(`${i + 1}. ${quitarMarcas(p.title)}`), lineas));
  });

  // La aplicación y la conclusión son secciones como las demás: mismo titular,
  // mismas líneas, misma regla de recorte. Antes llevaban una etiqueta gris
  // diminuta y su contenido salía como un párrafo corrido de doce frases, que
  // desde el atril no se lee.
  if (o.application) trozos.push(...seccionDeSchita(titularDeSchita(e.application), nodosDeCampo(o.application)));
  if (o.conclusion) trozos.push(...seccionDeSchita(titularDeSchita(e.conclusion), nodosDeCampo(o.conclusion)));

  // ── Reparto en caras ──
  //
  // Se llena cara a cara hasta donde cabe, trozo a trozo. Dos cosas que
  // costaron y conviene no deshacer:
  //
  //   - **Se mide en PUNTOS, no en líneas.** Contar líneas se quedaba corto por
  //     dos sitios a la vez —cada trozo lleva sus márgenes, y un titular es un
  //     cuerpo y medio— y el resultado era medible: se planificaban dos hojas y
  //     pdfmake imprimía tres.
  //   - **El trozo es la LÍNEA, no la sección.** Ver `seccionDeSchita`: una
  //     sección más alta que una cara la derrama pdfmake por su cuenta en una
  //     página nueva, y eso rompe el orden de lectura.
  const caras = [[]];
  let altoCara = 0;
  for (let i = 0; i < trozos.length; i++) {
    const { nodo, titular } = trozos[i];
    const alto = altoDeSchita(nodo);

    // Un titular no se queda solo al pie de una columna: si no caben él y al
    // menos su primera línea, se empieza cara. Es el «keep-with-next» que
    // pdfmake no tiene, el mismo de `seccion()` en el folio.
    const conSuPrimera = titular && trozos[i + 1] ? alto + altoDeSchita(trozos[i + 1].nodo) : alto;

    if (altoCara && altoCara + conSuPrimera > ALTO_CARA) {
      caras.push([]);
      altoCara = 0;
    }
    caras[caras.length - 1].push(nodo);
    altoCara += alto;
  }

  // Las caras van SEGUIDAS, de izquierda a derecha: 1|2 en la primera hoja,
  // 3|4 en la segunda. Se lee como un libro abierto y se busca por el número
  // del pie.
  //
  // Antes esto era una imposición de cuadernillo —la hoja doblada da cuatro
  // páginas y no en orden— y arrastraba dos defectos que el propietario vio
  // impresos: había que rellenar hasta un múltiplo de cuatro, así que sobraban
  // medias páginas en blanco, y los bloques no caían en orden de lectura. Lo
  // único que se pierde es poder grapar por el lomo, y eso ya no hacía falta:
  // con el número a la vista, la cartilla se ordena sola.
  const paginas = [];
  for (let i = 0; i < caras.length; i += 2) paginas.push([caras[i], caras[i + 1] || []]);

  const content = paginas.map(([izquierda, derecha], i) => ({
    columns: [columnaDeSchita(izquierda), { text: '', width: CANAL_SCHITA }, columnaDeSchita(derecha)],
    columnGap: 0,
    ...(i > 0 ? { pageBreak: 'before' } : {}),
  }));

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    // Abajo hace falta algo más que el margen: el pie de pdfmake se dibuja
    // DENTRO de esa banda, y con 14 pt el número se montaría sobre la última
    // línea del texto.
    pageMargins: [MARGEN_SCHITA, MARGEN_SCHITA, MARGEN_SCHITA, MARGEN_SCHITA + 12],
    defaultStyle: { font: SERIF, fontSize: T.schitaClave, color: TINTA },
    content,
    // La línea del medio. Ya no marca un doblez —la cartilla no se dobla—,
    // pero sigue haciendo falta: separa las dos columnas, que a 15 pt y con
    // los márgenes al mínimo quedan muy juntas, y marca por dónde cortar a
    // quien prefiera medias cuartillas.
    background: () => ({
      canvas: [
        {
          type: 'line',
          x1: A4_ALTO / 2,
          y1: 10,
          x2: A4_ALTO / 2,
          y2: A4_ANCHO - 10,
          lineWidth: 0.5,
          dash: { length: 3 },
          lineColor: LINEA_SUAVE,
        },
      ],
    }),
    // El número de página, abajo a la derecha. Lo pidió el propietario al
    // dejar de ser un cuadernillo: desde que las hojas van sueltas y en orden
    // de lectura, el número es lo único que las ordena si se caen al suelo —y
    // «¿voy por la tres o por la cuatro?» es una pregunta que no se puede
    // estar haciendo delante de la congregación. Va `n / total` y no sólo `n`
    // porque así además se ve si falta una hoja.
    //
    // La marca se queda a la izquierda: es toda la publicidad de la
    // aplicación y esta hoja se imprime y se reparte (ver la trampa 94).
    footer: (pagina, total) => ({
      columns: [
        { text: 'robible.com', alignment: 'left', width: '*' },
        { text: `${pagina} / ${total}`, alignment: 'right', width: 'auto', bold: true },
      ],
      fontSize: T.schitaNota - 1.5,
      color: GRIS,
      margin: [MARGEN_SCHITA, 4, MARGEN_SCHITA, 0],
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
