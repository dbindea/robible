// Forma del documento de preparación, recuento y generación de la schiță.
//
// Todo lo de este archivo es puro: entra un objeto, sale otro. Vive separado de
// los componentes para poder probarlo sin navegador, que es donde de verdad
// duele equivocarse — si la generación de la schiță pierde un punto, el
// predicador lo descubre en el púlpito.
//
// El documento se guarda como JSON en `sermons.content_json`. Nunca se consulta
// por dentro desde SQL: se carga entero, se edita y se vuelve a guardar entero.

export const CONTENT_VERSION = 1;

/**
 * Documento vacío. Se crea con TODAS las claves presentes aunque estén en
 * blanco: así los componentes no tienen que comprobar si existen y un
 * documento viejo al que le falte algo se completa al pasar por `normalize`.
 */
export const emptyContent = () => ({
  version: CONTENT_VERSION,
  // Paso TEXT: palabras o expresiones marcadas dentro de la perícopa.
  marks: [],
  // Paso OBSERVARE: cinco preguntas, todas opcionales.
  observation: { repeats: '', contrasts: '', actions: '', tension: '', truth: '' },
  // Paso CONTEXT.
  context: { before: '', after: '', historical: '' },
  // Paso IDEEA CENTRALĂ.
  idea: { central: '', purpose: '', question: '' },
  // Paso STRUCTURA: puntos con subpuntos. Máximo dos niveles.
  structure: [],
  // Paso DEZVOLTARE: por id de punto.
  development: {},
  // Paso FINALIZARE.
  intro: '',
  conclusion: '',
});

/**
 * Completa un documento con lo que le falte.
 *
 * Hace falta porque el documento se guarda en el dispositivo del usuario y
 * puede venir de una versión anterior de la app: acceder a
 * `content.idea.central` sobre un documento sin `idea` reventaría la pantalla
 * de preparación con el trabajo del predicador dentro.
 */
export const normalizeContent = (raw) => {
  const base = emptyContent();
  if (!raw) return base;

  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return base; }
  }
  if (!obj || typeof obj !== 'object') return base;

  return {
    version: CONTENT_VERSION,
    marks: Array.isArray(obj.marks) ? obj.marks : base.marks,
    observation: { ...base.observation, ...(obj.observation || {}) },
    context: { ...base.context, ...(obj.context || {}) },
    idea: { ...base.idea, ...(obj.idea || {}) },
    structure: Array.isArray(obj.structure) ? obj.structure : base.structure,
    development: obj.development && typeof obj.development === 'object' ? obj.development : base.development,
    intro: typeof obj.intro === 'string' ? obj.intro : '',
    conclusion: typeof obj.conclusion === 'string' ? obj.conclusion : '',
  };
};

// ── Pasos ───────────────────────────────────────────────
// El orden importa: es el recorrido que propone la aplicación. Se puede
// retroceder y saltar, pero no reordenar.
export const STEPS = ['text', 'observation', 'context', 'idea', 'structure', 'development', 'final'];

/**
 * Cuánto hay hecho de cada paso. Alimenta la línea de progreso.
 * No sirve para bloquear nada: ningún paso es obligatorio.
 */
export const stepCompletion = (content) => {
  const c = normalizeContent(content);
  const algo = (o) => Object.values(o).some((v) => String(v || '').trim().length > 0);
  return {
    text: c.marks.length > 0,
    observation: algo(c.observation),
    context: algo(c.context),
    idea: algo(c.idea),
    structure: c.structure.length > 0,
    development: Object.values(c.development).some((d) => algo(d || {})),
    final: !!(c.intro.trim() || c.conclusion.trim()),
  };
};

// ── Estructura ──────────────────────────────────────────

export const newPoint = (title = '') => ({
  id: `p_${crypto.randomUUID().slice(0, 8)}`,
  title,
  refs: [],
  subpoints: [],
});

export const newSubpoint = (title = '') => ({
  id: `s_${crypto.randomUUID().slice(0, 8)}`,
  title,
});

/**
 * Mueve un punto arriba o abajo. Devuelve un array nuevo; si el movimiento se
 * sale de los extremos, devuelve el mismo orden sin tocar nada.
 */
export const movePoint = (structure, index, delta) => {
  const destino = index + delta;
  if (destino < 0 || destino >= structure.length) return structure;
  const copia = [...structure];
  [copia[index], copia[destino]] = [copia[destino], copia[index]];
  return copia;
};

// ── Recuento ────────────────────────────────────────────

// Palabras por minuto predicando. Es bastante más lento que leer en voz alta:
// hay pausas, énfasis y miradas al auditorio. El valor sale de la referencia de
// la especificación (1.927 palabras ≈ 29 minutos) y es **orientativo**: sirve
// para saber si una predicación se va de largo, no para cronometrarla.
export const WORDS_PER_MINUTE = 66;

export const countWords = (texto) => {
  if (!texto || typeof texto !== 'string') return 0;
  const limpio = texto.trim();
  return limpio ? limpio.split(/\s+/).length : 0;
};

/** Palabras de todo lo que se predica: intro, puntos, desarrollo y conclusión. */
export const sermonWordCount = (content) => {
  const c = normalizeContent(content);
  let total = countWords(c.intro) + countWords(c.conclusion);

  for (const punto of c.structure) {
    total += countWords(punto.title);
    for (const sub of punto.subpoints || []) total += countWords(sub.title);
    const d = c.development[punto.id];
    if (d) total += countWords(d.explain) + countWords(d.illustrate) + countWords(d.apply);
  }
  return total;
};

export const estimatedMinutes = (palabras) => Math.max(1, Math.round(palabras / WORDS_PER_MINUTE));

// ── Schiță ──────────────────────────────────────────────

export const OUTLINE_VERSION = 1;

export const emptyOutline = () => ({
  version: OUTLINE_VERSION,
  idea: '',
  intro: [],
  points: [],
  application: '',
  conclusion: '',
});

/**
 * Saca de un texto largo unas pocas expresiones cortas para el púlpito.
 *
 * **No es un resumen.** Una schiță no se lee: se mira de reojo para recuperar
 * el hilo. Por eso se cogen las primeras frases y se recortan a unas pocas
 * palabras; meter párrafos enteros la convertiría en la predicación otra vez,
 * que es justo lo que hay que evitar.
 */
const claves = (texto, maxLineas = 3, maxPalabras = 6) => {
  if (!texto || typeof texto !== 'string') return [];
  return quitarMarcas(texto)
    .split(/[.;\n]+/)
    .map((frase) => frase.trim())
    .filter(Boolean)
    .slice(0, maxLineas)
    .map((frase) => {
      const palabras = frase.split(/\s+/);
      return palabras.length <= maxPalabras ? frase : `${palabras.slice(0, maxPalabras).join(' ')}…`;
    });
};

// ── Marcado manual ──────────────────────────────────────
//
// Lo que va entre asteriscos sale tal cual en la schiță. El corte automático de
// arriba adivina, y adivinar sobre el texto de una predicación sale mal: se
// queda con el principio de la frase, que casi nunca es lo que el predicador
// quiere ver desde el atril.
//
// El asterisco se eligió porque ya es el gesto de "esto va destacado" en
// WhatsApp, y porque sobrevive a copiar y pegar entre dispositivos. La interfaz
// los pone por ti al seleccionar y pulsar el botón; escribirlos a mano funciona
// igual.
const MARCA = /\*([^*\n]+)\*/g;

/** Las expresiones marcadas de un texto, en el orden en que aparecen. */
export const marcadas = (texto) => {
  if (!texto || typeof texto !== 'string') return [];
  return [...texto.matchAll(MARCA)].map((m) => m[1].trim()).filter(Boolean);
};

/** El texto sin los asteriscos, para leerlo o contarlo. */
export const quitarMarcas = (texto) =>
  typeof texto === 'string' ? texto.replace(MARCA, '$1') : '';

/**
 * Envuelve entre asteriscos el trozo `[desde, hasta)` de un texto.
 *
 * Devuelve el texto nuevo y dónde queda la selección después, para que el
 * cursor no salte al final del campo. Si el trozo ya estaba marcado, lo
 * desmarca: el mismo botón pone y quita.
 */
export const alternarMarca = (texto, desde, hasta) => {
  const t = typeof texto === 'string' ? texto : '';
  if (desde === hasta) return { texto: t, desde, hasta };

  const seleccion = t.slice(desde, hasta).trim();
  if (!seleccion) return { texto: t, desde, hasta };

  // Recorta los espacios que hayan entrado en la selección: marcar " palabra "
  // dejaría los asteriscos separados y la marca no valdría.
  const iniReal = desde + t.slice(desde, hasta).indexOf(seleccion);
  const finReal = iniReal + seleccion.length;

  const yaMarcado = t[iniReal - 1] === '*' && t[finReal] === '*';
  if (yaMarcado) {
    const nuevo = t.slice(0, iniReal - 1) + seleccion + t.slice(finReal + 1);
    return { texto: nuevo, desde: iniReal - 1, hasta: finReal - 1 };
  }

  const nuevo = `${t.slice(0, iniReal)}*${seleccion}*${t.slice(finReal)}`;
  return { texto: nuevo, desde: iniReal, hasta: finReal + 2 };
};

/**
 * Construye una schiță a partir de la preparación ya escrita.
 *
 * No hay IA ni hace falta: todo sale de lo que el predicador ha tecleado. La
 * schiță generada es un punto de partida y **se edita a mano** después; por eso
 * `generateOutline` no se vuelve a llamar sola, o pisaría los retoques.
 */
export const generateOutline = (content) => {
  const c = normalizeContent(content);

  return {
    version: OUTLINE_VERSION,
    idea: c.idea.central.trim(),
    intro: claves(c.intro),
    points: c.structure.map((punto) => {
      const d = c.development[punto.id] || {};
      const subpuntos = (punto.subpoints || []).map((s) => (s.title || '').trim()).filter(Boolean);

      // Lo que el predicador ha marcado con asteriscos manda. El corte
      // automático sólo entra cuando no ha marcado nada: adivinar es el peor
      // resultado posible, pero es mejor que dejarle la schiță en blanco.
      const suyas = [...marcadas(d.explain), ...marcadas(d.illustrate), ...marcadas(d.apply)];
      const keywords = suyas.length
        ? [...subpuntos, ...suyas]
        : [...subpuntos, ...claves(d.explain, 2, 4), ...claves(d.illustrate, 1, 4)];

      return {
        id: punto.id,
        title: (punto.title || '').trim().toUpperCase(),
        keywords: keywords.filter(Boolean),
        // Las del punto y las del desarrollo, en ese orden y sin repetir. En la
        // schiță sólo se ve la cita; el texto entero es cosa del Modo Amvon.
        refs: [...(punto.refs || []), ...(d.refs || [])]
          .map((r) => (r?.label || '').trim())
          .filter((label, i, todas) => label && todas.indexOf(label) === i),
      };
    }),
    // La aplicación sale del propósito, pero recortada como todo lo demás. El
    // propósito se escribe con calma en el estudio y puede ocupar un párrafo;
    // volcarlo entero aquí convertiría la schiță en el resumen largo que
    // justamente no debe ser. Si el predicador quiere la frase completa, la
    // schiță es editable.
    application: claves(c.idea.purpose, 1, 8).join(' '),
    conclusion: claves(c.conclusion, 2, 8).join(' · '),
  };
};

export const normalizeOutline = (raw) => {
  const base = emptyOutline();
  if (!raw) return base;
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return base; }
  }
  if (!obj || typeof obj !== 'object') return base;
  return {
    version: OUTLINE_VERSION,
    idea: typeof obj.idea === 'string' ? obj.idea : '',
    intro: Array.isArray(obj.intro) ? obj.intro : [],
    points: Array.isArray(obj.points) ? obj.points : [],
    application: typeof obj.application === 'string' ? obj.application : '',
    conclusion: typeof obj.conclusion === 'string' ? obj.conclusion : '',
  };
};

/** Palabras de la schiță. Sirve para avisar si se está alargando de más. */
export const outlineWordCount = (outline) => {
  const o = normalizeOutline(outline);
  let total = countWords(o.idea) + countWords(o.application) + countWords(o.conclusion);
  for (const linea of o.intro) total += countWords(linea);
  for (const p of o.points) {
    total += countWords(p.title);
    for (const k of p.keywords || []) total += countWords(k);
    for (const r of p.refs || []) total += countWords(r);
  }
  return total;
};

/**
 * Todas las referencias bíblicas citadas, para poder dejarlas disponibles sin
 * conexión antes de subir al púlpito.
 */
export const collectReferences = (content) => {
  const c = normalizeContent(content);
  const vistas = new Map();
  const añadir = (r) => {
    if (!r || !Number.isInteger(r.book)) return;
    const clave = `${r.book}:${r.chapter}:${r.verse}`;
    if (!vistas.has(clave)) vistas.set(clave, r);
  };
  for (const punto of c.structure) {
    for (const r of punto.refs || []) añadir(r);
    const d = c.development[punto.id];
    for (const r of (d?.refs || [])) añadir(r);
  }
  return [...vistas.values()];
};
