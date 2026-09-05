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
];

export const getBackground = (key) =>
  IMAGE_BACKGROUNDS.find((b) => b.key === key) || IMAGE_BACKGROUNDS[0];

// ── Maquetación del texto (pura, sin canvas) ────────────

/**
 * Parte un texto en líneas que quepan en `maxWidth`.
 * `measure(str)` devuelve el ancho en px de esa cadena.
 * Una palabra más ancha que la caja se deja sola en su línea: partirla por la
 * mitad se lee peor que dejar que sobresalga un poco.
 */
export const wrapTextLines = (text, maxWidth, measure) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
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
  kept[kept.length - 1] = `${kept[kept.length - 1].replace(/[.,;:]$/, '')}…`;
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

const paintBackground = (ctx, bg, w, h) => {
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

  // Viñeta: oscurece los bordes para que el texto centrado gane contraste.
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
