// Genera la imagen de un versículo para compartir (estados de WhatsApp, etc.).
//
// Todo es procedural sobre <canvas>: degradados, halos y viñeta. No hay
// fotografías empaquetadas a propósito — habría que versionar varios MB de JPG,
// resolver licencias y precachearlos en el service worker, y el resultado no
// sería más legible. El mismo criterio que ya se siguió con music.service.js.
//
// La parte medible (partir el texto en líneas y elegir el cuerpo de letra) está
// separada del dibujo y se prueba en tests/verse-image.test.js.

// ── Formatos ────────────────────────────────────────────
// 9:16 es el de los estados de WhatsApp e Instagram; 1:1 sirve para un post
// o para pegarlo en un chat sin que se recorte la vista previa.
export const IMAGE_FORMATS = [
  { key: 'story', width: 1080, height: 1920 },
  { key: 'square', width: 1080, height: 1080 },
];

export const getFormat = (key) => IMAGE_FORMATS.find((f) => f.key === key) || IMAGE_FORMATS[0];

// ── Fondos ──────────────────────────────────────────────
// `stops` es el degradado en diagonal; `glow` el halo suave superpuesto;
// `ink` el color del texto y `accent` el de la referencia y la línea.
export const IMAGE_BACKGROUNDS = [
  {
    key: 'dawn',
    stops: ['#FDCB82', '#F2836B', '#6B4E71'],
    glow: 'rgba(255, 236, 200, 0.55)',
    ink: '#FFFFFF',
    accent: 'rgba(255, 255, 255, 0.82)',
  },
  {
    key: 'ocean',
    stops: ['#7EC8E3', '#2E7D9B', '#123B52'],
    glow: 'rgba(210, 240, 255, 0.45)',
    ink: '#FFFFFF',
    accent: 'rgba(255, 255, 255, 0.82)',
  },
  {
    key: 'night',
    stops: ['#1D3040', '#131E29', '#0A1017'],
    glow: 'rgba(126, 200, 227, 0.28)',
    ink: '#EDF3F7',
    accent: 'rgba(126, 200, 227, 0.9)',
  },
  {
    key: 'olive',
    stops: ['#F1EEDD', '#CFD2B2', '#8A9A5B'],
    glow: 'rgba(255, 255, 240, 0.5)',
    ink: '#2B3320',
    accent: 'rgba(43, 51, 32, 0.72)',
  },
  {
    key: 'lavender',
    stops: ['#F3EEFA', '#D8CBEE', '#9B8AC4'],
    glow: 'rgba(255, 255, 255, 0.55)',
    ink: '#2E2545',
    accent: 'rgba(46, 37, 69, 0.7)',
  },
  {
    key: 'sand',
    stops: ['#FFF8EF', '#FBE8D3', '#E0BE95'],
    glow: 'rgba(255, 255, 255, 0.6)',
    ink: '#4A3623',
    accent: 'rgba(74, 54, 35, 0.7)',
  },

  // ── Los tres siguientes no son otro degradado en diagonal ──────────────
  // Cambian el DIBUJO, no sólo la paleta: cada uno tiene su propio pintor en
  // `PINTORES`, y su `swatch` con la versión en CSS del mismo motivo. Los seis
  // de arriba comparten el pintor `gradient` y no necesitan `swatch`.

  {
    // Malla de manchas de color, sin forma reconocible. Es el más abstracto.
    key: 'aurora',
    style: 'aurora',
    stops: ['#161B3D', '#0B0E22'],
    blobs: ['#38D6C0', '#7A5CE0', '#E2588F', '#2F7BD8'],
    glow: 'rgba(140, 200, 255, 0.12)',
    ink: '#FFFFFF',
    accent: 'rgba(255, 255, 255, 0.86)',
    swatch:
      'radial-gradient(circle at 22% 24%, #38D6C0 0%, transparent 58%),' +
      'radial-gradient(circle at 78% 34%, #7A5CE0 0%, transparent 58%),' +
      'radial-gradient(circle at 46% 84%, #E2588F 0%, transparent 62%),' +
      'linear-gradient(140deg, #161B3D, #0B0E22)',
  },
  // ── Y estos dos, además, SE MUEVEN en la proyección ────────────────────
  // `animado` enciende una capa con `@keyframes` en `ProjectionSurface`. En la
  // imagen para compartir no se mueve nada, claro: ahí el pintor deja una foto
  // fija del mismo motivo. Sustituyen a `rays` y `arcs` (16 sep 2026), que eran
  // demasiado marcados —un abanico de luz y unos anillos de curva de nivel— y
  // le disputaban la atención al versículo en una pantalla de diez metros.

  {
    // Nubes de color a la deriva sobre cielo profundo, con estrellas.
    key: 'nebula',
    style: 'nebula',
    animado: 'nebula',
    stops: ['#0E1230', '#070A1A'],
    blobs: ['#6C5CE0', '#2E86D8', '#B455C8'],
    glow: 'rgba(150, 190, 255, 0.14)',
    ink: '#F4F7FF',
    accent: 'rgba(178, 206, 255, 0.92)',
    swatch:
      'radial-gradient(ellipse 46% 34% at 28% 34%, rgba(108,92,224,0.50) 0%, rgba(0,0,0,0) 70%),' +
      'radial-gradient(ellipse 40% 30% at 72% 62%, rgba(46,134,216,0.42) 0%, rgba(0,0,0,0) 70%),' +
      'radial-gradient(ellipse 34% 26% at 58% 18%, rgba(180,85,200,0.34) 0%, rgba(0,0,0,0) 70%),' +
      'linear-gradient(150deg, #0E1230, #070A1A)',
  },
  {
    // Agua: crestas de ola de verdad, no bandas de luz. Las bandas anchas que
    // tenía antes se leían como un degradado a rayas y no como agua.
    key: 'water',
    style: 'water',
    animado: 'water',
    stops: ['#0B3A4A', '#062430'],
    wave: '#5FD4E4',
    glow: 'rgba(120, 220, 240, 0.16)',
    ink: '#EAF7FB',
    accent: 'rgba(146, 226, 240, 0.92)',
    // La cresta se dibuja con una curva en un SVG embebido, la misma que usa la
    // capa animada. Dos reglas que no son opcionales:
    //
    //   `no-repeat`            repitiendo la baldosa, su borde inferior es una
    //                          línea perfectamente horizontal que cruza la
    //                          proyección de lado a lado.
    //   `0 100%` + relleno
    //   hasta el fondo del SVG el dibujo se ancla abajo y el color llega al
    //                          borde de la pantalla, así que no queda corte.
    //
    // Esto lo pinta `--fondo` a pantalla completa, no sólo la muestra de 44 px
    // del selector: lo que aquí sea una raya, allí es una raya de dos metros.
    swatch:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 80' preserveAspectRatio='none'%3E%3Cpath d='M0 26 C 22 12 44 32 68 24 S 104 8 132 26 S 172 38 198 22 S 226 14 240 28 V80 H0 Z' fill='%235FD4E4' fill-opacity='.20'/%3E%3C/svg%3E\") no-repeat 0 100% / 100% 44%," +
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 80' preserveAspectRatio='none'%3E%3Cpath d='M0 40 C 44 28 78 50 120 40 S 190 26 240 42 V80 H0 Z' fill='%235FD4E4' fill-opacity='.10'/%3E%3C/svg%3E\") no-repeat 0 100% / 100% 66%," +
      'linear-gradient(150deg, #0B3A4A, #062430)',
  },
  {
    // Cielo azul con nubes blancas, las de un día despejado.
    key: 'clouds',
    style: 'clouds',
    animado: 'clouds',
    // De arriba abajo: azul más profundo arriba y más claro hacia el horizonte,
    // que es como se ve un cielo de verdad.
    stops: ['#4E97CF', '#8FC5E8', '#DCEEF9'],
    glow: 'rgba(255, 255, 255, 0.5)',
    // Tinta OSCURA: el cielo es claro y las nubes son blancas, así que el texto
    // en blanco desaparecería justo encima de una nube.
    ink: '#0E2D45',
    accent: 'rgba(14, 45, 69, 0.8)',
    swatch:
      'radial-gradient(ellipse 26% 34% at 26% 42%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%),' +
      'radial-gradient(ellipse 30% 30% at 68% 32%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%),' +
      'radial-gradient(ellipse 22% 24% at 48% 66%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 72%),' +
      'linear-gradient(180deg, #4E97CF, #8FC5E8, #DCEEF9)',
  },
  {
    // Vapor levantándose de un campo verde, al amanecer.
    key: 'mist',
    style: 'mist',
    animado: 'mist',
    // Verde oscuro abajo para que el texto en blanco se lea: un campo a pleno
    // sol dejaría el versículo ilegible en una pantalla de iglesia.
    stops: ['#6E9B5B', '#41703C', '#1B3822'],
    mistColor: '#FFFFFF',
    glow: 'rgba(230, 245, 220, 0.3)',
    ink: '#F4FAF2',
    accent: 'rgba(214, 240, 200, 0.92)',
    // El humo es ruido fractal deformado (`feTurbulence` + `feDisplacementMap`),
    // no degradados: dos elipses difusas dan bruma, y lo que se pidió es humo —
    // con grano, con hebras y sin poder adivinar por dónde va. La misma receta
    // que las capas animadas de `ProjectionSurface`, donde está explicada al
    // detalle, para que el fondo quieto y el que se mueve sean el mismo dibujo.
    //
    // Con OTRA semilla, eso sí: éste es el fondo que va debajo de aquéllas, y
    // con la misma se superpondrían calcadas y el humo saldría al doble de
    // denso justo donde ya lo estaba.
    swatch:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='700' height='700'%3E%3Cfilter id='h' x='-30%25' y='-30%25' width='160%25' height='160%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.014 0.007' numOctaves='6' seed='5' result='humo'/%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.0035' numOctaves='2' seed='23' result='remolino'/%3E%3CfeDisplacementMap in='humo' in2='remolino' scale='110' xChannelSelector='R' yChannelSelector='G'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0'/%3E%3CfeComponentTransfer result='denso'%3E%3CfeFuncA type='table' tableValues='0 0 0.24 0.85 1'/%3E%3C/feComponentTransfer%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.3' numOctaves='2' seed='12' result='motas'/%3E%3CfeColorMatrix in='motas' type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.5 0 0 0 -0.25' result='grano'/%3E%3CfeComposite in='denso' in2='grano' operator='arithmetic' k1='1' k2='0' k3='0' k4='0'/%3E%3C/filter%3E%3Crect width='700' height='700' filter='url(%23h)' opacity='.5' mask='url(%23m)'/%3E%3Cmask id='m'%3E%3ClinearGradient id='g' x1='0' y1='1' x2='0' y2='0'%3E%3Cstop offset='.04' stop-color='%23fff'/%3E%3Cstop offset='.3' stop-color='%236b6b6b'/%3E%3Cstop offset='.7' stop-color='%23000'/%3E%3C/linearGradient%3E%3Crect width='700' height='700' fill='url(%23g)'/%3E%3C/mask%3E%3C/svg%3E\") no-repeat 50% 100% / 150% 120%," +
      'linear-gradient(180deg, #6E9B5B, #41703C, #1B3822)',
  },
];

export const getBackground = (key) => IMAGE_BACKGROUNDS.find((b) => b.key === key) || IMAGE_BACKGROUNDS[0];

/**
 * La viñeta: oscurece los bordes para que el texto centrado gane contraste.
 * En el canvas se aplica a TODOS los estilos, fuera de los pintores; aquí va
 * como primera capa —la de más arriba— por el mismo motivo.
 */
const VINETA_CSS = 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.22) 100%)';

/**
 * El mismo fondo, pero como valor CSS en vez de dibujado en un canvas.
 *
 * Lo usa el Modo Proyección, que no genera una imagen: pinta un `<div>` a
 * pantalla completa. Vive aquí y no allí para que los fondos sigan teniendo un
 * solo dueño — si alguien añade uno nuevo a `IMAGE_BACKGROUNDS`, aparece en los
 * dos sitios sin tocar nada más.
 *
 * **Tiene que reproducir TODAS las capas del pintor, no sólo el degradado.**
 * Hasta el 16 sep 2026 devolvía un `linear-gradient` pelado y se notaba al
 * poner las dos cosas lado a lado: en la imagen compartida hay un halo de luz
 * arriba a la izquierda y dos círculos tenues tipo bokeh que en la proyección
 * no estaban, y el fondo se veía plano. Orden de capas: viñeta, bokeh, halo y
 * degradado — al revés que en el canvas, donde lo último dibujado queda encima.
 *
 * Los que traen dibujo propio ya tienen `swatch`, que es la aproximación en CSS
 * de lo que su pintor hace; sólo se les añade la viñeta.
 *
 * Las medidas van en PORCENTAJE y no en `vmin`: este mismo valor pinta la
 * muestra de 44 px del selector y la pantalla entera del proyector, y con
 * unidades de viewport la muestra saldría con un círculo gigante.
 *
 * El ángulo es 150° igual que en el canvas, para que la muestra del selector y
 * la pantalla real no se vean distintas.
 */
export const backgroundCss = (background) => {
  const bg = typeof background === 'string' ? getBackground(background) : background;
  if (!bg) return '';

  const capas = bg.swatch
    ? [bg.swatch]
    : [
        // Los dos círculos tipo bokeh, en la tinta del fondo y al 7 %.
        `radial-gradient(ellipse 24% 18% at 86% 16%, ${conAlfa(bg.ink, 0.07)} 0%, rgba(0,0,0,0) 72%)`,
        `radial-gradient(ellipse 32% 24% at 12% 82%, ${conAlfa(bg.ink, 0.07)} 0%, rgba(0,0,0,0) 72%)`,
        // El halo de luz arriba a la izquierda.
        `radial-gradient(ellipse 90% 72% at 24% 20%, ${bg.glow} 0%, rgba(0,0,0,0) 70%)`,
        `linear-gradient(150deg, ${bg.stops.join(', ')})`,
      ];

  return [VINETA_CSS, ...capas].join(', ');
};

// ── Maquetación del texto (pura, sin canvas) ────────────

// ── Dónde se puede cortar una línea ─────────────────────
//
// Partir por espacios funciona en las cuatro lenguas latinas del proyecto y NO
// funciona en chino, que no los usa: el versículo entero salía como una sola
// «palabra» y por tanto como una sola línea, con el principio y el final fuera
// de la imagen. En chino el corte se puede hacer entre casi cualquier par de
// caracteres, así que cada ideograma es una oportunidad de corte propia.

const RE_CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/;

/** Puntuación china y japonesa: también corta, y además manda en el kinsoku. */
const RE_PUNTUACION_CJK = /[、-〿！-＠［-｀｛-･]/;

/**
 * Kinsoku shori: reglas de qué no puede quedar al borde de una línea.
 * Una coma o un punto abriendo línea es el error que más se nota.
 */
const NO_ABREN_LINEA = '、。，．・：；！？）〕］｝〉》」』】〙〗〟’”｠»ーぁぃぅぇぉっゃゅょァィゥェォッャュョー';
const NO_CIERRAN_LINEA = '（〔［｛〈《「『【〘〖〝‘“｟«';

/**
 * Trocea el texto en piezas con su separador delante.
 *
 * Una pieza es una palabra latina o un único carácter CJK. El separador es el
 * espacio que hay que reponer al volver a unirlas: entre palabras latinas sí,
 * entre ideogramas no. Así el mismo algoritmo de ajuste sirve para las cinco
 * lenguas sin ramas por idioma.
 */
const trocear = (texto) => {
  const piezas = [];
  let palabra = '';
  let separador = '';

  const cerrarPalabra = () => {
    if (!palabra) return;
    piezas.push({ texto: palabra, sep: piezas.length ? separador : '' });
    palabra = '';
    separador = '';
  };

  for (const ch of String(texto ?? '')) {
    if (/\s/.test(ch)) {
      cerrarPalabra();
      // Varios espacios seguidos o un salto de línea cuentan como uno solo.
      separador = ' ';
      continue;
    }
    if (RE_CJK.test(ch) || RE_PUNTUACION_CJK.test(ch)) {
      cerrarPalabra();
      piezas.push({ texto: ch, sep: piezas.length ? separador : '' });
      separador = '';
      continue;
    }
    palabra += ch;
  }
  cerrarPalabra();
  return piezas;
};

/**
 * Parte un texto en líneas que quepan en `maxWidth`.
 * `measure(str)` devuelve el ancho en px de esa cadena.
 * Una palabra más ancha que la caja se deja sola en su línea: partirla por la
 * mitad se lee peor que dejar que sobresalga un poco.
 */
export const wrapTextLines = (text, maxWidth, measure) => {
  const piezas = trocear(text);
  if (!piezas.length) return [];

  const lines = [];
  let current = piezas[0].texto;

  for (let i = 1; i < piezas.length; i++) {
    const pieza = piezas[i];
    const candidate = current + pieza.sep + pieza.texto;

    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    // No cabe: hay que cortar aquí, salvo que el kinsoku lo impida.
    if (NO_ABREN_LINEA.includes(pieza.texto) && current.length > 1) {
      // 。 、 」 no pueden abrir línea: baja con ellas el carácter anterior.
      lines.push(current.slice(0, -1));
      current = current.slice(-1) + pieza.texto;
    } else if (NO_CIERRAN_LINEA.includes(current.slice(-1)) && current.length > 1) {
      // 「 （ no pueden cerrar línea: sube con ellas a la siguiente.
      lines.push(current.slice(0, -1));
      current = current.slice(-1) + pieza.sep + pieza.texto;
    } else {
      lines.push(current);
      current = pieza.texto;
    }
  }
  lines.push(current);
  return lines;
};

/**
 * Busca el cuerpo de letra más grande con el que el texto entra en la caja.
 * Baja de `maxFontSize` a `minFontSize` en pasos de `step`; si ni con el mínimo
 * cabe (hay capítulos con versículos larguísimos), recorta por líneas y cierra
 * con puntos suspensivos, que es preferible a que el texto se salga de la imagen.
 *
 * `measureAt(fontSize)` devuelve la función de medida para ese cuerpo.
 */
export const fitTextBlock = ({
  text,
  maxWidth,
  maxHeight,
  maxFontSize,
  minFontSize,
  lineHeightRatio = 1.36,
  step = 2,
  measureAt,
}) => {
  let fontSize = maxFontSize;
  let lines = [];

  for (; fontSize >= minFontSize; fontSize -= step) {
    lines = wrapTextLines(text, maxWidth, measureAt(fontSize));
    if (lines.length * fontSize * lineHeightRatio <= maxHeight) {
      return { fontSize, lines, truncated: false };
    }
  }

  fontSize = minFontSize;
  lines = wrapTextLines(text, maxWidth, measureAt(fontSize));
  const maxLines = Math.max(1, Math.floor(maxHeight / (fontSize * lineHeightRatio)));
  if (lines.length <= maxLines) {
    return { fontSize, lines, truncated: false };
  }

  const kept = lines.slice(0, maxLines);
  // La puntuación china es distinta de la latina: sin 。，、；： aquí, un
  // versículo recortado en chino acababa en «。…», que se lee como un error.
  kept[kept.length - 1] = `${kept[kept.length - 1].replace(/[.,;:。，、；：]$/, '')}…`;
  return { fontSize, lines: kept, truncated: true };
};

// ── Dibujo ──────────────────────────────────────────────

const FONT_FAMILY = '"Open Sans", "Segoe UI", system-ui, sans-serif';

/**
 * Espera a que Open Sans esté disponible. Sin esto, el primer render sale con
 * la tipografía de sistema: el canvas no espera a las webfonts como sí hace el
 * layout de la página.
 */
export const ensureFontsReady = async () => {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`600 64px ${FONT_FAMILY}`),
      document.fonts.load(`italic 400 40px ${FONT_FAMILY}`),
      document.fonts.load(`700 32px ${FONT_FAMILY}`),
    ]);
    await document.fonts.ready;
  } catch {
    // Si falla la carga seguimos: el fallback de sistema es legible.
  }
};

/**
 * Un lienzo suelto para dibujar aparte y pegarlo después.
 *
 * `OffscreenCanvas` primero porque no toca el DOM; donde no exista, un
 * `<canvas>` que nunca se inserta. Devuelve `null` si no hay ninguno de los dos
 * —los tests corren en Node, sin ventana— y el pintor que lo pida se queda sin
 * esa capa en vez de reventar.
 */
const lienzoAuxiliar = (w, h) => {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** `#RRGGBB` + alfa → `rgba(...)`. Los pintores necesitan desvanecer colores. */
const conAlfa = (hex, alfa) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
};

/** El degradado en diagonal de siempre. Lo comparten los seis primeros fondos. */
const pintarDegradado = (ctx, bg, w, h) => {
  const gradient = ctx.createLinearGradient(0, 0, w * 0.65, h);
  bg.stops.forEach((color, i) => gradient.addColorStop(i / (bg.stops.length - 1), color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Halo suave arriba a la izquierda: rompe el degradado plano y da la
  // sensación de luz que se buscaba con una foto de fondo.
  const glow = ctx.createRadialGradient(w * 0.24, h * 0.2, 0, w * 0.24, h * 0.2, w * 0.9);
  glow.addColorStop(0, bg.glow);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Dos círculos muy tenues, tipo bokeh.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = bg.ink;
  ctx.beginPath();
  ctx.arc(w * 0.86, h * 0.16, w * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.12, h * 0.82, w * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/**
 * Malla de manchas de color sobre base oscura: el fondo abstracto.
 *
 * Se componen con alfa normal y no con `lighter`: sumando luz, cuatro manchas
 * se acercan al blanco por el centro y ahí es justo donde va el texto.
 */
const pintarAurora = (ctx, bg, w, h) => {
  const base = ctx.createLinearGradient(0, 0, w * 0.3, h);
  bg.stops.forEach((color, i) => base.addColorStop(i / (bg.stops.length - 1), color));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Repartidas por las esquinas, lejos de la banda central del versículo.
  const manchas = [
    { x: 0.14, y: 0.16, r: 0.7, a: 0.55 },
    { x: 0.88, y: 0.28, r: 0.58, a: 0.45 },
    { x: 0.22, y: 0.86, r: 0.66, a: 0.42 },
    { x: 0.86, y: 0.92, r: 0.6, a: 0.38 },
  ];
  manchas.forEach((m, i) => {
    const color = bg.blobs[i % bg.blobs.length];
    const g = ctx.createRadialGradient(w * m.x, h * m.y, 0, w * m.x, h * m.y, w * m.r);
    g.addColorStop(0, conAlfa(color, m.a));
    g.addColorStop(0.55, conAlfa(color, m.a * 0.35));
    g.addColorStop(1, conAlfa(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
};

/**
 * Nebulosa: nubes de color a la deriva sobre cielo profundo, con estrellas.
 *
 * En la proyección se mueve (ver `ProjectionSurface`); aquí es la foto fija del
 * mismo motivo. Las estrellas salen de un generador pseudoaleatorio con semilla
 * fija y NO de `Math.random()`: la misma referencia tiene que dar la misma
 * imagen dos veces seguidas, o compartir el mismo versículo dos días distintos
 * produciría dos fondos y parecería un fallo.
 */
const pintarNebulosa = (ctx, bg, w, h) => {
  const base = ctx.createLinearGradient(0, 0, w * 0.6, h);
  bg.stops.forEach((color, i) => base.addColorStop(i / (bg.stops.length - 1), color));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Tres nubes anchas y muy difusas. Las posiciones son las mismas que las del
  // `swatch` en CSS, para que la muestra del selector no engañe.
  const nubes = [
    { x: 0.28, y: 0.34, r: 0.62, a: 0.5 },
    { x: 0.72, y: 0.62, r: 0.56, a: 0.42 },
    { x: 0.58, y: 0.18, r: 0.48, a: 0.34 },
  ];
  nubes.forEach((n, i) => {
    const color = bg.blobs[i % bg.blobs.length];
    const g = ctx.createRadialGradient(w * n.x, h * n.y, 0, w * n.x, h * n.y, w * n.r);
    g.addColorStop(0, conAlfa(color, n.a));
    g.addColorStop(0.5, conAlfa(color, n.a * 0.4));
    g.addColorStop(1, conAlfa(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // Estrellas. Generador congruencial lineal con semilla fija: barato,
  // determinista y más que suficiente para repartir puntos.
  let semilla = 20260916;
  const aleatorio = () => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    return semilla / 2147483648;
  };

  ctx.save();
  ctx.fillStyle = bg.ink;
  for (let i = 0; i < 90; i++) {
    const x = aleatorio() * w;
    const y = aleatorio() * h;
    // Tamaños y brillos desiguales: todas iguales parecen una trama impresa.
    const r = (0.4 + aleatorio() * 1.3) * Math.max(1, w / 540);
    ctx.globalAlpha = 0.25 + aleatorio() * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/**
 * Agua: olas de verdad, con cresta y valle.
 *
 * Antes eran tres bandas de luz difusas y no se leían como agua sino como un
 * degradado a rayas — lo dijo el propietario viéndolo en la pantalla de la
 * iglesia. Ahora cada capa es una superficie ondulada rellena: una senoide
 * cerrada por abajo, con su propia frecuencia, amplitud y fase. Superpuestas y
 * desfasadas entre sí es como se forma el relieve de un mar en calma.
 */
const pintarAgua = (ctx, bg, w, h) => {
  const base = ctx.createLinearGradient(0, 0, w * 0.5, h);
  bg.stops.forEach((color, i) => base.addColorStop(i / (bg.stops.length - 1), color));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // De lejos a cerca: las de abajo son más grandes, más marcadas y más
  // espaciadas, que es lo que da la sensación de profundidad.
  const capas = [
    { y: 0.52, amp: 0.012, ciclos: 5.0, fase: 0.0, a: 0.1 },
    { y: 0.63, amp: 0.018, ciclos: 3.6, fase: 1.3, a: 0.14 },
    { y: 0.76, amp: 0.026, ciclos: 2.7, fase: 2.4, a: 0.18 },
    { y: 0.9, amp: 0.034, ciclos: 1.9, fase: 0.7, a: 0.22 },
  ];

  const paso = Math.max(2, w / 400);
  for (const c of capas) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += paso) {
      const t = x / w;
      ctx.lineTo(x, h * c.y + Math.sin(t * Math.PI * 2 * c.ciclos + c.fase) * h * c.amp);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = conAlfa(bg.wave, c.a);
    ctx.fill();

    // Un filo claro sobre la cresta: es lo que hace que se vea el borde del
    // agua y no una mancha.
    ctx.beginPath();
    for (let x = 0; x <= w; x += paso) {
      const t = x / w;
      const y = h * c.y + Math.sin(t * Math.PI * 2 * c.ciclos + c.fase) * h * c.amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = Math.max(1, w / 700);
    ctx.strokeStyle = conAlfa(bg.wave, Math.min(0.55, c.a + 0.2));
    ctx.stroke();
  }
};

/**
 * Cielo despejado con nubes blancas.
 *
 * Cada nube son varios círculos difusos solapados con la base más plana que la
 * cúspide: un cúmulo de verdad se apoya sobre una línea horizontal. Con un solo
 * círculo por nube parecían pompas.
 */
const pintarNubes = (ctx, bg, w, h) => {
  // Vertical y no en diagonal: un cielo se aclara hacia el horizonte, no hacia
  // una esquina.
  const cielo = ctx.createLinearGradient(0, 0, 0, h);
  bg.stops.forEach((color, i) => cielo.addColorStop(i / (bg.stops.length - 1), color));
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, w, h);

  const nube = (cx, cy, escala, alfa) => {
    // Los bultos de un cúmulo: el del medio más alto, los de los lados
    // menores, y todos apoyados en la misma base.
    const bultos = [
      { dx: -0.9, dy: 0.1, r: 0.55 },
      { dx: -0.35, dy: -0.25, r: 0.8 },
      { dx: 0.3, dy: -0.15, r: 0.7 },
      { dx: 0.95, dy: 0.12, r: 0.5 },
      { dx: 0, dy: 0.22, r: 0.75 },
    ];
    for (const b of bultos) {
      const x = cx + b.dx * escala;
      const y = cy + b.dy * escala;
      const r = b.r * escala;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, conAlfa(bg.mistColor || '#FFFFFF', alfa));
      g.addColorStop(0.6, conAlfa(bg.mistColor || '#FFFFFF', alfa * 0.55));
      g.addColorStop(1, conAlfa(bg.mistColor || '#FFFFFF', 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  };

  // Las de arriba, más grandes y opacas; las de abajo se van al horizonte.
  nube(w * 0.24, h * 0.2, w * 0.17, 0.92);
  nube(w * 0.72, h * 0.31, w * 0.2, 0.85);
  nube(w * 0.45, h * 0.58, w * 0.14, 0.6);
  nube(w * 0.86, h * 0.72, w * 0.12, 0.45);
  nube(w * 0.12, h * 0.8, w * 0.1, 0.35);
};

/* ── Ruido fractal ───────────────────────────────────────────────────────
   El equivalente en canvas del `feTurbulence` que usa el fondo animado. Canvas
   2D no tiene primitiva de ruido, así que se calcula a mano: `ruidoValor` hace
   la interpolación suave entre los valores de una retícula, y `ruidoFractal`
   suma varias octavas —cada una al doble de frecuencia y a la mitad de
   amplitud—, que es lo que produce detalle a todas las escalas a la vez. Eso
   es lo que distingue el humo de una mancha difusa.

   Es DETERMINISTA a propósito: misma semilla, misma imagen. La vista previa se
   repinta en cada tecla (trampa 19), y con ruido aleatorio el fondo parpadearía
   mientras se escribe. */
const hashRuido = (x, y, semilla) => {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(semilla, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

// Smoothstep. Sin él, la interpolación lineal deja la retícula a la vista como
// un enrejado de rombos.
const suavizar = (t) => t * t * (3 - 2 * t);

const ruidoValor = (x, y, semilla) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = suavizar(x - xi);
  const fy = suavizar(y - yi);
  const a = hashRuido(xi, yi, semilla);
  const b = hashRuido(xi + 1, yi, semilla);
  const c = hashRuido(xi, yi + 1, semilla);
  const d = hashRuido(xi + 1, yi + 1, semilla);
  const arriba = a + (b - a) * fx;
  const abajo = c + (d - c) * fx;
  return arriba + (abajo - arriba) * fy;
};

const ruidoFractal = (x, y, semilla, octavas) => {
  let suma = 0;
  let total = 0;
  let amplitud = 1;
  let fx = x;
  let fy = y;
  for (let o = 0; o < octavas; o += 1) {
    suma += ruidoValor(fx, fy, semilla + o * 131) * amplitud;
    total += amplitud;
    fx *= 2;
    fy *= 2;
    amplitud *= 0.5;
  }
  return suma / total;
};

/**
 * Vapor levantándose de un campo verde.
 *
 * El campo es el propio degradado —verde y más oscuro abajo— y encima va humo
 * de ruido fractal: denso junto al suelo, con hebras verticales y deshecho
 * arriba. Antes eran cinco elipses difuminadas y el resultado era bruma, no
 * humo: lo que se pidió es «más definido y más granulado», y eso no sale de un
 * degradado radial por muchos que se solapen.
 */
const pintarVapor = (ctx, bg, w, h) => {
  const campo = ctx.createLinearGradient(0, 0, 0, h);
  bg.stops.forEach((color, i) => campo.addColorStop(i / (bg.stops.length - 1), color));
  ctx.fillStyle = campo;
  ctx.fillRect(0, 0, w, h);

  // El humo se calcula a la MITAD de resolución y se estira al pintarlo: son
  // cuatro veces menos píxeles que evaluar —el formato vertical tiene dos
  // millones— y el grano sale de dos píxeles, que es justo lo que se quiere
  // ver. A resolución completa el cálculo se notaba en la vista previa.
  const nw = Math.ceil(w / 2);
  const nh = Math.ceil(h / 2);
  const humo = lienzoAuxiliar(nw, nh);
  if (!humo) return;
  const hctx = humo.getContext('2d');
  const datos = hctx.createImageData(nw, nh);
  const px = datos.data;

  const m = /^#?([0-9a-f]{6})$/i.exec(String(bg.mistColor || '#FFFFFF'));
  const tinta = m ? parseInt(m[1], 16) : 0xffffff;
  const rojo = (tinta >> 16) & 255;
  const verde = (tinta >> 8) & 255;
  const azul = tinta & 255;

  for (let y = 0; y < nh; y += 1) {
    const t = y / nh;
    // Denso abajo y sin nada en el tercio superior. Al cuadrado para que la
    // transición no sea una banda recta.
    const mascara = t <= 0.18 ? 0 : Math.min(1, (t - 0.18) / 0.62) ** 2;
    if (mascara === 0) continue;

    for (let x = 0; x < nw; x += 1) {
      const u = x / nw;

      // La misma deformación que hace `feDisplacementMap` en el fondo animado:
      // un ruido de escala grande que mueve el punto de muestreo. Sin ella, un
      // ruido estirado sale peinado —una empalizada de rayas verticales— en vez
      // de humo, y ese fue el primer intento fallido de los dos.
      const ondaX = (ruidoValor(u * 2.2, t * 2.2, 71) - 0.5) * 2.6;
      const ondaY = (ruidoValor(u * 1.7, t * 1.7, 113) - 0.5) * 1.3;

      // CATORCE ciclos de ancho contra cuatro y medio de alto: las manchas salen
      // estrechas y largas, que es la forma de un penacho que sube. Ojo con
      // invertirlo, que da bandas horizontales cruzando la pantalla.
      const n = ruidoFractal(u * 14 + ondaX, t * 4.5 + ondaY, 17, 5);

      // Umbral: lo que queda por debajo se va a cero en vez de quedarse en un
      // velo gris. Es lo que abre huecos y deja los jirones DEFINIDOS.
      const densidad = (n - 0.44) / 0.56;
      if (densidad <= 0) continue;

      // Y el grano: ruido fino que MULTIPLICA al humo, igual que el
      // `feComposite operator='arithmetic'` del fondo animado. Las octavas
      // afinan la forma, pero el humo seguiría siendo una mancha continua; la
      // textura de partículas sólo sale de multiplicar por algo fino.
      const grano = 0.35 + ruidoValor(u * 170, t * 170, 4) * 0.85;

      const i = (y * nw + x) * 4;
      px[i] = rojo;
      px[i + 1] = verde;
      px[i + 2] = azul;
      px[i + 3] = Math.min(255, densidad ** 1.3 * mascara * grano * 245);
    }
  }

  hctx.putImageData(datos, 0, 0);
  ctx.drawImage(humo, 0, 0, w, h);
};

const PINTORES = {
  gradient: pintarDegradado,
  aurora: pintarAurora,
  nebula: pintarNebulosa,
  water: pintarAgua,
  clouds: pintarNubes,
  mist: pintarVapor,
};

const paintBackground = (ctx, bg, w, h) => {
  (PINTORES[bg.style] || pintarDegradado)(ctx, bg, w, h);

  // Viñeta: oscurece los bordes para que el texto centrado gane contraste.
  // Se aplica a todos los estilos, y por eso vive fuera de los pintores.
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.78);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
};

/**
 * Pinta el versículo en el canvas dado.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 * @param {string} opts.text        texto del versículo
 * @param {string} opts.reference   'Ioan 3:16'
 * @param {string} opts.versionName nombre de la versión bíblica
 * @param {string} opts.footer      pie (dominio)
 * @param {string} opts.formatKey   'story' | 'square'
 * @param {string} opts.backgroundKey
 */
export const drawVerseImage = (
  canvas,
  { text, reference, versionName = '', footer = 'robible.com', formatKey = 'story', backgroundKey = 'dawn' },
) => {
  const format = getFormat(formatKey);
  const bg = getBackground(backgroundKey);
  const { width: w, height: h } = format;

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  paintBackground(ctx, bg, w, h);

  const padding = w * 0.11;
  const contentWidth = w - padding * 2;

  // Comillas decorativas arriba del texto.
  const quoteSize = w * 0.16;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = bg.ink;
  ctx.font = `700 ${quoteSize}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('“', w / 2, h * (format.key === 'story' ? 0.235 : 0.245));
  ctx.restore();

  // El bloque de texto ocupa la banda central; arriba quedan las comillas y
  // abajo la referencia y el pie.
  const textTop = h * (format.key === 'story' ? 0.27 : 0.3);
  const textBottom = h * (format.key === 'story' ? 0.72 : 0.7);
  const maxTextHeight = textBottom - textTop;

  const measureAt = (fontSize) => (str) => {
    ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`;
    return ctx.measureText(str).width;
  };

  const lineHeightRatio = 1.38;
  const { fontSize, lines } = fitTextBlock({
    text,
    maxWidth: contentWidth,
    maxHeight: maxTextHeight,
    maxFontSize: Math.round(w * 0.072),
    minFontSize: Math.round(w * 0.03),
    lineHeightRatio,
    measureAt,
  });

  const lineHeight = fontSize * lineHeightRatio;
  const blockHeight = lines.length * lineHeight;
  let y = textTop + (maxTextHeight - blockHeight) / 2 + lineHeight * 0.78;

  ctx.save();
  ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = bg.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur = fontSize * 0.22;
  ctx.shadowOffsetY = fontSize * 0.04;
  for (const line of lines) {
    ctx.fillText(line, w / 2, y);
    y += lineHeight;
  }
  ctx.restore();

  // Filete + referencia.
  const ruleY = textBottom + h * 0.03;
  ctx.save();
  ctx.strokeStyle = bg.accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(2, w * 0.003);
  ctx.beginPath();
  ctx.moveTo(w / 2 - w * 0.09, ruleY);
  ctx.lineTo(w / 2 + w * 0.09, ruleY);
  ctx.stroke();
  ctx.restore();

  const refSize = Math.round(w * 0.046);
  ctx.save();
  ctx.font = `700 ${refSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = bg.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(reference, w / 2, ruleY + refSize * 1.55);

  if (versionName) {
    const versionSize = Math.round(w * 0.028);
    ctx.font = `italic 400 ${versionSize}px ${FONT_FAMILY}`;
    ctx.globalAlpha = 0.72;
    ctx.fillText(versionName, w / 2, ruleY + refSize * 1.55 + versionSize * 1.9);
  }
  ctx.restore();

  // Marca de agua, abajo a la DERECHA.
  //
  // Estaba centrada y se movió el 15 sep 2026. En un estado de WhatsApp, el
  // centro inferior es donde caen los controles de la propia aplicación y donde
  // mira el pulgar para pasar al siguiente: la marca quedaba tapada justo en la
  // pantalla para la que se hizo la imagen. En la esquina se ve entera.
  //
  // Hereda la tinta del fondo, así que se lee sobre los nueve sin comprobarlo
  // a mano, y va al 60 % para que acompañe al versículo en vez de competir.
  const footerSize = Math.round(w * 0.026);
  ctx.save();
  ctx.font = `600 ${footerSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = bg.ink;
  ctx.globalAlpha = 0.6;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(footer, w - padding, h - padding * 0.55);
  ctx.restore();

  return format;
};

// ── Exportar y compartir ────────────────────────────────

export const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas_to_blob_failed'));
    }, 'image/png');
  });

export const buildFileName = (reference) => {
  const slug =
    String(reference || 'versiculo')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'versiculo';
  return `robible-${slug}.png`;
};

/**
 * Comparte la imagen con la hoja nativa del sistema (la que ofrece "Estado de
 * WhatsApp" en el móvil). Devuelve el canal usado para que la UI ajuste el aviso.
 *
 * @returns {Promise<'shared'|'cancelled'|'downloaded'>}
 */
export const shareVerseImage = async (blob, { reference, text = '' }) => {
  const fileName = buildFileName(reference);
  const file = typeof File !== 'undefined' ? new File([blob], fileName, { type: 'image/png' }) : null;

  // navigator.share con ficheros solo existe en móvil (y en Safari/Chrome
  // recientes). canShare es la única comprobación fiable: hay navegadores con
  // navigator.share que rechazan los ficheros.
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      // AbortError = el usuario cerró la hoja de compartir. No es un fallo.
      if (e?.name === 'AbortError') return 'cancelled';
      // Cualquier otro error cae a la descarga.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Dar tiempo a que el navegador arranque la descarga antes de revocar.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
};
