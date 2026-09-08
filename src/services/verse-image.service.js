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

export const getFormat = (key) =>
  IMAGE_FORMATS.find((f) => f.key === key) || IMAGE_FORMATS[0];

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
  // `PINTORES`. Los seis de arriba comparten el de `gradient`.

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
  {
    // Haces de luz abriéndose desde una esquina, como por una claraboya.
    key: 'rays',
    style: 'rays',
    stops: ['#123049', '#08131E'],
    beam: '#FFD98C',
    glow: 'rgba(255, 217, 140, 0.16)',
    ink: '#F5FAFD',
    accent: 'rgba(255, 217, 140, 0.92)',
    swatch:
      'repeating-conic-gradient(from 200deg at 82% -6%,' +
      'rgba(255,217,140,0.30) 0deg 5deg, rgba(255,217,140,0) 5deg 13deg),' +
      'linear-gradient(160deg, #123049, #08131E)',
  },
  {
    // Anillos concéntricos finos, tipo curva de nivel. Claro y muy sobrio.
    key: 'arcs',
    style: 'arcs',
    stops: ['#FAF7F1', '#EBE3D6'],
    line: '#5A4A3A',
    glow: 'rgba(255, 255, 255, 0.5)',
    ink: '#3A2E22',
    accent: 'rgba(58, 46, 34, 0.75)',
    swatch:
      'repeating-radial-gradient(circle at 18% 108%,' +
      'rgba(90,74,58,0.22) 0 1px, rgba(90,74,58,0) 1px 9px),' +
      'linear-gradient(150deg, #FAF7F1, #EBE3D6)',
  },
];

export const getBackground = (key) =>
  IMAGE_BACKGROUNDS.find((b) => b.key === key) || IMAGE_BACKGROUNDS[0];

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
    { x: 0.14, y: 0.16, r: 0.70, a: 0.55 },
    { x: 0.88, y: 0.28, r: 0.58, a: 0.45 },
    { x: 0.22, y: 0.86, r: 0.66, a: 0.42 },
    { x: 0.86, y: 0.92, r: 0.60, a: 0.38 },
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

/** Haces de luz abriéndose desde una esquina, como por una claraboya. */
const pintarRayos = (ctx, bg, w, h) => {
  const base = ctx.createLinearGradient(0, 0, w * 0.4, h);
  bg.stops.forEach((color, i) => base.addColorStop(i / (bg.stops.length - 1), color));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Origen fuera del lienzo: así los haces entran ya abiertos y no se ve el
  // vértice, que delataría que son triángulos.
  const ox = w * 0.88;
  const oy = -h * 0.10;
  const largo = Math.hypot(w, h) * 1.6;

  ctx.save();
  ctx.translate(ox, oy);
  // Abanico hacia abajo y a la izquierda.
  const desde = Math.PI * 0.55;
  const hasta = Math.PI * 1.02;
  const haces = 11;
  for (let i = 0; i < haces; i++) {
    const t = i / (haces - 1);
    const centro = desde + (hasta - desde) * t;
    // Anchos y opacidades irregulares: unos haces iguales parecen un ventilador.
    const ancho = (0.014 + ((i * 7) % 5) * 0.006) * Math.PI;
    const alfa = 0.05 + ((i * 3) % 4) * 0.028;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(centro - ancho) * largo, Math.sin(centro - ancho) * largo);
    ctx.lineTo(Math.cos(centro + ancho) * largo, Math.sin(centro + ancho) * largo);
    ctx.closePath();
    ctx.fillStyle = conAlfa(bg.beam, alfa);
    ctx.fill();
  }
  ctx.restore();

  // Resplandor en el foco, para que la luz parezca venir de algún sitio.
  const foco = ctx.createRadialGradient(ox, oy, 0, ox, oy, w * 0.85);
  foco.addColorStop(0, bg.glow);
  foco.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = foco;
  ctx.fillRect(0, 0, w, h);
};

/** Anillos concéntricos finos, tipo curva de nivel. El más sobrio de los tres. */
const pintarArcos = (ctx, bg, w, h) => {
  const base = ctx.createLinearGradient(0, 0, w * 0.5, h);
  bg.stops.forEach((color, i) => base.addColorStop(i / (bg.stops.length - 1), color));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Centro fuera del lienzo, abajo a la izquierda: dentro se verían anillos
  // completos y parecería una diana.
  const cx = w * 0.16;
  const cy = h * 1.06;
  const paso = w * 0.058;
  const maximo = Math.hypot(w, h) * 1.25;

  ctx.save();
  ctx.lineCap = 'round';
  for (let r = paso, i = 0; r < maximo; r += paso, i++) {
    // Se desvanecen al alejarse y el grosor alterna: así se lee como relieve
    // y no como una rejilla.
    const lejania = r / maximo;
    ctx.globalAlpha = Math.max(0.04, 0.20 * (1 - lejania));
    ctx.lineWidth = (i % 4 === 0 ? 2.2 : 1.1) * Math.max(1, w / 540);
    ctx.strokeStyle = bg.line;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

const PINTORES = {
  gradient: pintarDegradado,
  aurora: pintarAurora,
  rays: pintarRayos,
  arcs: pintarArcos,
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
export const drawVerseImage = (canvas, {
  text,
  reference,
  versionName = '',
  footer = 'robible.com',
  formatKey = 'story',
  backgroundKey = 'dawn',
}) => {
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

  // Pie de marca.
  const footerSize = Math.round(w * 0.026);
  ctx.save();
  ctx.font = `600 ${footerSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = bg.ink;
  ctx.globalAlpha = 0.6;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(footer, w / 2, h - padding * 0.55);
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
  const slug = String(reference || 'versiculo')
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
