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
  // Paso TEXT: el cuaderno de servilleta. Ocurrencias, versículos que vienen a
  // la memoria, una ilustración que se acaba de oír — lo que se apunta ANTES de
  // saber qué predicación va a salir. No se predica ni se publica: no entra en
  // el recuento de palabras, ni en el documento, ni en el PDF, ni en la página
  // pública. Se escribe aquí y se relee plegado en los pasos siguientes.
  notes: '',
  // Paso OBSERVARE: cinco preguntas, todas opcionales.
  observation: { repeats: '', contrasts: '', actions: '', tension: '', truth: '' },
  // Paso CONTEXT.
  context: { before: '', after: '', historical: '' },
  // Paso IDEE. El orden de las claves es el del curso y no es decorativo: la
  // idea exegética (lo que el texto dijo a SUS destinatarios) y el propósito
  // (lo que Dios quiere cambiar hoy) son los dos insumos con los que se
  // formula `central`, la idea homilética. Sin el primer paso se predica lo
  // que a uno le apetece; sin el segundo, una clase de historia antigua.
  //
  // `exegetical` se añadió después: los documentos anteriores no la traen y
  // `normalizeContent` la rellena en blanco. Por eso se mezcla con `base.idea`
  // en vez de sustituirla.
  idea: { exegetical: '', purpose: '', central: '', question: '' },
  // Paso STRUCTURA: puntos con subpuntos. Máximo dos niveles.
  structure: [],
  // Paso STRUCTURA: la propoziția de tranziție, la frase que enlaza la idea
  // omiletică con las divisiones. Va suelta y no dentro de `idea` porque se
  // escribe aquí, mirando ya los puntos: se formula con el número, la palabra
  // clave en plural y la pregunta analítica, y sin ella el auditorio pasa de la
  // introducción al primer punto sin saber qué le van a contar.
  transition: '',
  // Paso DEZVOLTARE. El mapa va por id, y admite **las dos clases de id**: la
  // de un punto (`p_…`) guarda `{ explain, illustrate, apply, refs }`, la de un
  // subpunto (`s_…`) guarda `{ text, refs }`. Un subpunto se desarrolla en un
  // solo texto seguido a propósito: es una división del punto, no un punto
  // entero, y repetirle las tres casillas convertía la pantalla en un
  // formulario interminable. Los ids no chocan porque `newPoint` y
  // `newSubpoint` los prefijan distinto.
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
    notes: typeof obj.notes === 'string' ? obj.notes : '',
    observation: { ...base.observation, ...(obj.observation || {}) },
    context: { ...base.context, ...(obj.context || {}) },
    idea: { ...base.idea, ...(obj.idea || {}) },
    structure: Array.isArray(obj.structure) ? obj.structure : base.structure,
    transition: typeof obj.transition === 'string' ? obj.transition : '',
    development: obj.development && typeof obj.development === 'object' ? obj.development : base.development,
    intro: typeof obj.intro === 'string' ? obj.intro : '',
    conclusion: typeof obj.conclusion === 'string' ? obj.conclusion : '',
  };
};

// ── Pasos ───────────────────────────────────────────────
// El orden importa: es el recorrido que propone la aplicación. Se puede
// retroceder y saltar, pero no reordenar.
//
// `intro` va ANTES de `development` por decisión explícita del propietario, y
// no es lo que enseña el curso: el curso dice que la introducción se escribe
// AL FINAL, cuando ya se sabe adónde lleva la predicación (era el texto de
// `final.why` hasta el 10 sep 2026). Se cambia a propósito, para escribirla en
// el hueco entre STRUCTURĂ y DEZVOLTARE y no perder el hilo del orden en que
// se predica. `final` se queda sólo con la conclusión y la serie — sigue
// siendo el último paso, pero ya no combina las dos cosas.
export const STEPS = ['text', 'observation', 'context', 'idea', 'structure', 'intro', 'development', 'final'];

/**
 * Cuánto hay hecho de cada paso. Alimenta la línea de progreso.
 * No sirve para bloquear nada: ningún paso es obligatorio.
 */
export const stepCompletion = (content) => {
  const c = normalizeContent(content);
  const algo = (o) => Object.values(o).some((v) => String(v || '').trim().length > 0);
  return {
    // Las notas cuentan tanto como las marcas: hay quien llega al texto con una
    // página de apuntes y todavía ninguna palabra subrayada.
    text: c.marks.length > 0 || c.notes.trim().length > 0,
    observation: algo(c.observation),
    context: algo(c.context),
    idea: algo(c.idea),
    structure: c.structure.length > 0 || c.transition.trim().length > 0,
    intro: c.intro.trim().length > 0,
    // `algo` recorre los valores del objeto, así que vale igual para el
    // desarrollo de un punto (tres casillas) y para el de un subpunto (una).
    development: Object.values(c.development).some((d) => algo(d || {})),
    final: c.conclusion.trim().length > 0,
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
  // `notes` queda fuera a propósito: es el cuaderno de trabajo, no se predica.
  // Contarlo daría una duración inflada justo a quien más apunta.
  let total = countWords(c.intro) + countWords(c.transition) + countWords(c.conclusion);

  for (const punto of c.structure) {
    total += countWords(punto.title);
    for (const sub of punto.subpoints || []) {
      total += countWords(sub.title) + countWords(c.development[sub.id]?.text);
    }
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
  // La frase con la que se pasa de la introducción a las divisiones. Va entera
  // y no recortada como el resto: es lo único de la schiță que se dice tal cual
  // está escrito, y media frase desde el atril no sirve de nada.
  transition: '',
  points: [],
  application: '',
  conclusion: '',
  // Instantánea de la última generación, para poder distinguir después lo que
  // ha escrito el predicador de lo que puso la aplicación. Ver `mergeOutline`.
  base: null,
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

// ── Cita en línea ───────────────────────────────────────
//
// El asterisco destaca una PALABRA suelta para la schiță; esto es otra cosa:
// mete el VERSÍCULO ENTERO dentro del párrafo, en el sitio exacto donde se va
// a leer en voz alta. Referencia y texto van entre llaves dobles, separados
// por una barra — `{{Ioan 3:16|Fiindcă atât de mult a iubit Dumnezeu…}}` —
// porque el asterisco ya está cogido y una coma o un guion aparecen todo el
// rato dentro de una cita bíblica; la barra, no.
//
// Se inserta con el buscador de referencias (el mismo que ya existía para
// añadir una referencia al pie del punto), no escribiéndola a mano: nadie
// debería teclear el texto de un versículo entero letra a letra.
const CITA = /\{\{([^{}|]+)\|([^{}]+)\}\}/g;

/** El texto sin los asteriscos NI las citas, para leerlo, contarlo o generar
 *  la schiță a partir de él. Una cita se aplana a «referencia: versículo»
 *  para que no desaparezca de un plumazo — en `countWords` cuenta como lo que
 *  se predica, y en la schiță puede servir de material para el resumen
 *  automático si no hay nada marcado con asteriscos. */
export const quitarMarcas = (texto) =>
  typeof texto === 'string' ? texto.replace(MARCA, '$1').replace(CITA, '$1: $2') : '';

/**
 * Inserta una cita en la posición `[desde, hasta)` de un texto.
 *
 * Si había algo seleccionado, la cita lo sustituye — sirve para rellenar un
 * hueco ya escrito («aquí la cita») sin dejar el texto viejo al lado. Si no
 * había selección, se inserta en el cursor. Devuelve dónde queda el cursor
 * después, para no tener que ir a buscarlo.
 */
export const insertarCita = (texto, desde, hasta, ref) => {
  const t = typeof texto === 'string' ? texto : '';
  const bloque = `{{${ref.label}|${ref.text}}}`;
  const nuevo = t.slice(0, desde) + bloque + t.slice(hasta);
  return { texto: nuevo, cursor: desde + bloque.length };
};

const primerasPalabras = (texto, n = 5) => {
  const palabras = texto.trim().split(/\s+/);
  return palabras.length <= n ? palabras.join(' ') : `${palabras.slice(0, n).join(' ')}…`;
};

/**
 * Las citas insertadas en un texto, listas para ir de palabra clave en la
 * schiță: la referencia en negrita y las primeras palabras del versículo.
 *
 * Antes de esto una cita insertada en el desarrollo no llegaba NUNCA al
 * púlpito: `generateOutline` sólo miraba lo marcado con asteriscos y, si no
 * había nada marcado, el corte automático caía sobre el texto ya aplanado por
 * `quitarMarcas` (que convierte la cita en «referencia: versículo» corrido) y
 * normalmente ni siquiera sobrevivía al recorte. El predicador insertaba el
 * versículo a propósito y desaparecía de la guía que se lleva al atril.
 */
export const citasDe = (texto) => {
  if (!texto || typeof texto !== 'string') return [];
  return [...texto.matchAll(CITA)].map(
    (m) => `*${m[1].trim()}* ${primerasPalabras(m[2].trim())}`,
  );
};

/**
 * Alarga un recorte de palabras hasta no dejar una `*marca*` a medias.
 *
 * Cortar por número de palabras es ciego a los asteriscos: si la marca
 * empieza dentro del recorte y cierra después, el resultado lleva un `*`
 * suelto y `TextoFormateado` (o el PDF) leería negrita el resto del párrafo
 * entero. Se alarga palabra a palabra hasta que el recuento de asteriscos
 * vuelve a ser par.
 */
const extenderHastaCerrarMarca = (palabras, maxPalabras) => {
  let n = Math.min(maxPalabras, palabras.length);
  while (n < palabras.length) {
    const asteriscos = (palabras.slice(0, n).join(' ').match(/\*/g) || []).length;
    if (asteriscos % 2 === 0) break;
    n += 1;
  }
  return n;
};

/**
 * Resume una frase para el púlpito: el comienzo (unas pocas palabras) MÁS
 * cualquier `*marca*` que tenga, aunque quede más allá del corte.
 *
 * Antes, en cuanto había algo marcado en el texto, `generateOutline`
 * enseñaba SÓLO lo marcado y tiraba el comienzo de la frase; sin marcar nada
 * hacía lo contrario, sólo el comienzo. El predicador quiere las dos cosas a
 * la vez — el arranque de la frase para situarse, y la palabra que se marcó
 * para no perder el matiz — así que las dos van en la misma línea.
 */
const resumenDeFrase = (frase, maxPalabras = 5) => {
  const limpio = frase.trim();
  if (!limpio) return '';
  const palabras = limpio.split(/\s+/);
  let abre = limpio;
  if (palabras.length > maxPalabras) {
    const n = extenderHastaCerrarMarca(palabras, maxPalabras);
    abre = palabras.slice(0, n).join(' ');
    if (n < palabras.length) abre += '…';
  }
  const marcasFuera = marcadas(limpio).filter((m) => !abre.includes(m));
  return marcasFuera.length ? `${abre} ${marcasFuera.map((m) => `*${m}*`).join(' ')}` : abre;
};

/**
 * Como `claves()`, pero conservando los asteriscos de lo marcado en vez de
 * quitarlos: son las palabras clave de un punto, y `TextoFormateado` (en el
 * púlpito, en el documento y en la página pública) y el PDF ya saben pintar
 * esa negrita. Las citas se quitan antes de trocear en frases — van aparte,
 * por `citasDe` — porque su texto tiene sus propios espacios y el corte por
 * palabras las partiría a la mitad.
 */
const fraseClaves = (texto, maxLineas = 3, maxPalabras = 5) => {
  if (!texto || typeof texto !== 'string') return [];
  return texto
    .replace(CITA, '')
    .split(/[.;\n]+/)
    .map((frase) => frase.trim())
    .filter(Boolean)
    .slice(0, maxLineas)
    .map((frase) => resumenDeFrase(frase, maxPalabras))
    .filter(Boolean);
};

/**
 * Divide un texto en segmentos con formato, para imprimirlo o mostrarlo sin
 * perder la negrita de un `*marca*` ni la cursiva de una `{{cita}}`.
 *
 * Antes los dos se limpiaban con `quitarMarcas` sin más, y el formato se
 * perdía en el camino: la negrita nunca llegaba al papel y la cita salía
 * como texto plano pegado a la frase, indistinguible del resto. Un
 * `segmento` es `{ texto, bold? }` o `{ texto, italica? }`; sirve igual para
 * pdfmake (un array de `text` con estilos) que para el HTML del documento —
 * los dos necesitan lo mismo: texto plano intercalado con trozos que llevan
 * otro formato.
 */
const PATRON_MIXTO = /\*([^*\n]+)\*|\{\{([^{}|]+)\|([^{}]+)\}\}/g;

export const segmentarTexto = (texto) => {
  const t = typeof texto === 'string' ? texto : '';
  const segmentos = [];
  let ultimo = 0;
  for (const m of t.matchAll(PATRON_MIXTO)) {
    if (m.index > ultimo) segmentos.push({ texto: t.slice(ultimo, m.index) });
    if (m[1] !== undefined) {
      // *palabra* → negrita. Es justo lo que se marcó para verlo desde el
      // atril; en papel tiene sentido que se note lo mismo.
      segmentos.push({ texto: m[1], bold: true });
    } else {
      // {{ref|texto}} → la referencia en negrita, pegada al versículo en
      // cursiva. Así se lee como una cita dentro de la frase y no como un
      // trozo de código suelto. `cita: true` en los dos marca que van juntos,
      // para que quien pinte el texto (`TextoFormateado`) pueda envolverlos
      // en un solo bloque con su propia barra a la izquierda.
      segmentos.push({ texto: `${m[2]} `, bold: true, cita: true });
      segmentos.push({ texto: m[3], italica: true, cita: true });
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < t.length) segmentos.push({ texto: t.slice(ultimo) });
  return segmentos.length ? segmentos : [{ texto: t }];
};

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

  const generada = {
    version: OUTLINE_VERSION,
    // La schiță se guarda ya limpia: los asteriscos son la sintaxis con la que
    // se marca en la preparación, y a partir de aquí el texto sólo se lee —en
    // el púlpito, en el PDF o en el enlace público—. Si se colaran, habría que
    // acordarse de quitarlos en cada uno de esos sitios.
    idea: quitarMarcas(c.idea.central).trim(),
    // Las citas de la introducción se añaden aparte: `claves()` aplana la
    // cita a texto corrido y el recorte por frases casi nunca la deja
    // entera. `citasDe` la entrega ya lista como línea propia.
    intro: [...claves(c.intro), ...citasDe(c.intro)],
    transition: quitarMarcas(c.transition).trim(),
    points: c.structure.map((punto) => {
      const d = c.development[punto.id] || {};
      const subpuntos = (punto.subpoints || [])
        .map((s) => quitarMarcas(s.title).trim())
        .filter(Boolean);

      // El comienzo de cada frase (para situarse) MÁS lo marcado con
      // asteriscos (para no perder el matiz que el predicador quiso
      // destacar) y las citas insertadas (siempre, se haya marcado algo o
      // no): las tres cosas conviven en la misma lista de palabras clave.
      const desarrollo = [
        ...fraseClaves(d.explain, 2, 5),
        ...citasDe(d.explain),
        ...fraseClaves(d.illustrate, 1, 5),
        ...citasDe(d.illustrate),
        ...fraseClaves(d.apply, 1, 5),
        ...citasDe(d.apply),
        // El desarrollo de un subpunto se trata igual que el del punto.
        ...(punto.subpoints || []).flatMap((s) => [
          ...fraseClaves(c.development[s.id]?.text, 1, 5),
          ...citasDe(c.development[s.id]?.text),
        ]),
      ];

      return {
        id: punto.id,
        title: quitarMarcas(punto.title).trim().toUpperCase(),
        keywords: [...subpuntos, ...desarrollo].filter(Boolean),
        // Las del punto y las del desarrollo, en ese orden y sin repetir. En la
        // schiță sólo se ve la cita; el texto entero es cosa del Modo Amvon.
        refs: [
          ...(punto.refs || []),
          ...(d.refs || []),
          ...(punto.subpoints || []).flatMap((s) => c.development[s.id]?.refs || []),
        ]
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
    conclusion: [...claves(c.conclusion, 2, 8), ...citasDe(c.conclusion)].join(' · '),
  };

  // Recién generada, todo lo que hay lo puso la aplicación: la referencia para
  // la próxima fusión es ella misma. Sin esto, la primera schiță nacería sin
  // base y `mergeOutline` no podría distinguir nada la primera vez que se
  // regenerase.
  return { ...generada, base: contenidoDeSchita(generada) };
};

// ── La schiță se edita como texto ───────────────────────
//
// Las palabras clave son un array, pero editarlas como tal —un campo por
// palabra, o uno solo separado por puntos medios— es incómodo justo cuando más
// se toca: la schiță se retoca la noche antes de predicar, añadiendo, quitando
// y reordenando líneas. En un `textarea` eso es escribir; en un `input` con
// separadores, un rompecabezas.
//
// El guion delante lo pone la aplicación al mostrar y lo quita al leer, así que
// el predicador ve una lista y el documento guarda palabras limpias. Se acepta
// cualquier viñeta al leer (–, —, •, *, ·) porque el texto se pega desde otros
// sitios, y también una línea sin viñeta ninguna.

/** El array de claves, como texto para un `textarea`: una por línea, con guion. */
export const clavesATexto = (claves) =>
  (Array.isArray(claves) ? claves : []).map((k) => `- ${k}`).join('\n');

/** Lo contrario: el texto del `textarea` de vuelta a array, sin viñetas. */
export const textoAClaves = (texto) =>
  String(texto ?? '')
    .split('\n')
    .map((linea) => linea.replace(/^\s*[-–—•*·]+\s*/, '').trim())
    .filter(Boolean);

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
    transition: typeof obj.transition === 'string' ? obj.transition : '',
    points: Array.isArray(obj.points) ? obj.points : [],
    application: typeof obj.application === 'string' ? obj.application : '',
    conclusion: typeof obj.conclusion === 'string' ? obj.conclusion : '',
    // Las schițe guardadas antes de que existiera la fusión no la traen. Sin
    // ella no se puede saber qué tocó el predicador, y `mergeOutline` se pone
    // en el lado prudente: no pisa nada.
    base: obj.base && typeof obj.base === 'object' ? obj.base : null,
  };
};

// ── Fusión de la schiță ─────────────────────────────────
//
// El problema: «Regenerează din structură» rehacía la schiță entera. Si el
// predicador había reescrito un punto a mano —que es lo normal, la generada es
// un punto de partida— lo perdía, y bastaba con pulsar el botón sin querer.
//
// La solución es la misma que usa git al hacer merge: comparar TRES estados.
//
//   base   → lo que la aplicación generó la última vez
//   actual → lo que hay ahora en pantalla (base + lo que haya escrito él)
//   nueva  → lo que se generaría hoy desde la estructura
//
// Campo a campo: si `actual` sigue igual que `base`, nadie lo tocó y se puede
// refrescar con `nueva` sin perder nada. Si difiere, lo escribió él y se
// respeta. Así el botón deja de ser destructivo: pulsado por error, lo peor que
// hace es actualizar lo que al predicador le daba igual.
//
// Sin `base` (schițe anteriores a esto) no hay forma de distinguir, así que se
// asume que todo es suyo y sólo se rellenan los huecos vacíos.

/** Los campos que se comparan. Deja fuera `version` y la propia `base`. */
const contenidoDeSchita = (o) => ({
  idea: o.idea,
  intro: o.intro,
  transition: o.transition,
  points: o.points,
  application: o.application,
  conclusion: o.conclusion,
});

const mismo = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const estaVacio = (v) =>
  v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0);

/**
 * Decide un campo. Devuelve el valor y qué se hizo, para poder contarlo.
 *  - `igual`: no había nada que decidir.
 *  - `actualizado`: se coge lo nuevo (nadie lo había tocado, o estaba vacío).
 *  - `conservado`: se respeta lo que escribió el predicador.
 */
const elegirCampo = (actual, valorBase, nueva, hayBase) => {
  if (mismo(actual, nueva)) return { valor: nueva, estado: 'igual' };
  if (estaVacio(actual)) return { valor: nueva, estado: 'actualizado' };
  if (!hayBase) return { valor: actual, estado: 'conservado' };
  if (mismo(actual, valorBase)) return { valor: nueva, estado: 'actualizado' };
  return { valor: actual, estado: 'conservado' };
};

/**
 * Funde la schiță que hay con la que se generaría ahora.
 *
 * Devuelve la schiță fundida y un resumen para poder decirle al predicador qué
 * ha pasado: un botón que cambia cosas en silencio no es de fiar.
 */
export const mergeOutline = (actual, nueva) => {
  const a = normalizeOutline(actual);
  const n = normalizeOutline(nueva);
  const hayBase = !!a.base;
  const base = a.base || {};

  const resumen = { nuevos: 0, conservados: 0, actualizados: 0, eliminados: 0 };
  const contar = (estado) => {
    if (estado === 'conservado') resumen.conservados += 1;
    if (estado === 'actualizado') resumen.actualizados += 1;
  };

  const campo = (clave) => {
    const r = elegirCampo(a[clave], base[clave], n[clave], hayBase);
    contar(r.estado);
    return r.valor;
  };

  // Los puntos se emparejan por `id`, que viene de `content.structure`: es
  // estable aunque se reordenen o se renombren.
  const porId = (lista) => new Map((lista || []).filter((p) => p?.id).map((p) => [p.id, p]));
  const actualesPorId = porId(a.points);
  const basePorId = porId(base.points);

  const puntos = (n.points || []).map((puntoNuevo) => {
    const puntoActual = actualesPorId.get(puntoNuevo.id);
    if (!puntoActual) {
      // Punto que ha aparecido en la estructura desde la última generación.
      resumen.nuevos += 1;
      return puntoNuevo;
    }
    const puntoBase = basePorId.get(puntoNuevo.id) || {};
    const fundido = { ...puntoNuevo };
    for (const clave of ['title', 'keywords', 'refs']) {
      const r = elegirCampo(puntoActual[clave], puntoBase[clave], puntoNuevo[clave], hayBase);
      contar(r.estado);
      fundido[clave] = r.valor;
    }
    return fundido;
  });

  // El orden lo manda la estructura, no la schiță: si el predicador movió un
  // punto en STRUCTURĂ, es que quiere predicarlo en ese orden.
  //
  // Un punto que ya no está en la estructura se va, aunque tuviera texto suyo:
  // ha dejado de formar parte de la predicación, y una schiță con puntos que no
  // se van a predicar es peor en el púlpito que una a la que le falte algo. Se
  // cuenta para poder avisar, y «Anulează» lo devuelve.
  const idsNuevos = new Set((n.points || []).map((p) => p.id));
  resumen.eliminados = (a.points || []).filter((p) => p?.id && !idsNuevos.has(p.id)).length;

  const fundida = {
    version: OUTLINE_VERSION,
    idea: campo('idea'),
    intro: campo('intro'),
    transition: campo('transition'),
    points: puntos,
    application: campo('application'),
    conclusion: campo('conclusion'),
    // La referencia para la próxima vez es SIEMPRE lo recién generado, se haya
    // aplicado o no: es lo que la aplicación «propuso» esta vez, y contra eso
    // hay que comparar la próxima.
    base: contenidoDeSchita(n),
  };

  return { outline: fundida, resumen };
};

/** Palabras de la schiță. Sirve para avisar si se está alargando de más. */
export const outlineWordCount = (outline) => {
  const o = normalizeOutline(outline);
  let total = countWords(o.idea) + countWords(o.transition) + countWords(o.application) + countWords(o.conclusion);
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
    // Las de los subpuntos también: en el púlpito no hay red, y una referencia
    // que se citó dentro de un subpunto se lee igual que las demás.
    for (const sub of punto.subpoints || []) {
      for (const r of (c.development[sub.id]?.refs || [])) añadir(r);
    }
  }
  return [...vistas.values()];
};
