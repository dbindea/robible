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
  // Paso TEXT: el diagrama del pasaje. La perícopa volcada y sangrada a mano
  // con el tabulador para ver cómo está construida —qué depende de qué—, que
  // es un trabajo distinto del de apuntar ocurrencias. Como `notes`, es
  // material de trabajo: no se predica ni se publica.
  diagram: '',
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
  // La introducción se escribe dentro de DEZVOLTARE, antes de los puntos; la
  // conclusión, en FINALIZARE.
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
    try {
      obj = JSON.parse(raw);
    } catch {
      return base;
    }
  }
  if (!obj || typeof obj !== 'object') return base;

  return {
    version: CONTENT_VERSION,
    marks: Array.isArray(obj.marks) ? obj.marks : base.marks,
    notes: typeof obj.notes === 'string' ? obj.notes : '',
    // El diagrama del texto: la perícope volcada y tabulada a mano para ver la
    // estructura del pasaje. Campo aparte de `notes` porque son dos cosas
    // distintas — uno es el texto bíblico ordenado, el otro los apuntes — y
    // mezclados en el mismo campo el diagrama se pierde entre las ideas.
    diagram: typeof obj.diagram === 'string' ? obj.diagram : '',
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
// **Siete pasos desde el 15 sep 2026; antes eran ocho.** La introducción dejó
// de ser un paso propio y se escribe dentro de DEZVOLTARE, en la misma pantalla
// y antes de los puntos.
//
// Por qué: como paso suelto, entre STRUCTURĂ y DEZVOLTARE, obligaba a parar el
// trabajo de las divisiones para redactar un texto que depende justamente de
// ellas. Juntas se ve la predicación entera de un vistazo — se entra, se
// desarrolla — que es como se predica.
//
// El campo `content.intro` NO se toca: sigue existiendo, con lo que ya haya
// escrito cada uno. Lo que cambia es dónde se edita, no dónde se guarda, así
// que no hace falta migrar nada. `GUIA.intro` tampoco se toca: su guía se
// enseña ahora al lado del campo, dentro de DEZVOLTARE.
export const STEPS = ['text', 'observation', 'context', 'idea', 'structure', 'development', 'final'];

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
    text: c.marks.length > 0 || c.notes.trim().length > 0 || c.diagram.trim().length > 0,
    observation: algo(c.observation),
    context: algo(c.context),
    idea: algo(c.idea),
    structure: c.structure.length > 0 || c.transition.trim().length > 0,
    // La introducción ya no es un paso, pero su clave se conserva: la leen el
    // PDF y la vista pública para saber si hay algo que imprimir.
    intro: c.intro.trim().length > 0,
    // `algo` recorre los valores del objeto, así que vale igual para el
    // desarrollo de un punto (tres casillas) y para el de un subpunto (una).
    // Cuenta también la introducción, que ahora se escribe en este paso.
    development: c.intro.trim().length > 0 || Object.values(c.development).some((d) => algo(d || {})),
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

/**
 * Palabras de un texto de la predicación, sin la sintaxis de marcado.
 *
 * El `##` de un subtítulo contaría como una palabra más por rótulo, y nadie
 * predica un `##`. Los asteriscos y las llaves van pegados a sus palabras y no
 * cambiaban el recuento, pero pasar los tres por el mismo sitio ahorra tener
 * que acordarse la próxima vez que se añada una sintaxis.
 */
const palabrasPredicadas = (texto) => countWords(quitarMarcas(texto));

/** Palabras de todo lo que se predica: intro, puntos, desarrollo y conclusión. */
export const sermonWordCount = (content) => {
  const c = normalizeContent(content);
  // `notes` queda fuera a propósito: es el cuaderno de trabajo, no se predica.
  // Contarlo daría una duración inflada justo a quien más apunta.
  let total = palabrasPredicadas(c.intro) + palabrasPredicadas(c.transition) + palabrasPredicadas(c.conclusion);

  for (const punto of c.structure) {
    total += palabrasPredicadas(punto.title);
    for (const sub of punto.subpoints || []) {
      total += palabrasPredicadas(sub.title) + palabrasPredicadas(c.development[sub.id]?.text);
    }
    const d = c.development[punto.id];
    if (d) total += palabrasPredicadas(d.explain) + palabrasPredicadas(d.illustrate) + palabrasPredicadas(d.apply);
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

// ── Subtítulo del predicador ────────────────────────────
//
// La tercera sintaxis de marcado, y la única de LÍNEA: `## Zidirea casei` al
// principio de una línea la convierte en un rótulo —mayúsculas, negrita y aire
// antes y después—.
//
// Sustituye a las etiquetas fijas «EXPLICĂ / ILUSTREAZĂ / APLICĂ», que salían
// impresas encima de cada casilla del desarrollo. Eran andamio del curso de
// homilética, no de la predicación: quien la lee no necesita saber qué casilla
// del formulario rellenó el predicador, y quien la predica quiere sus propios
// rótulos («ZIDIREA CASEI», «TERMINAREA CASEI») donde de verdad hacen falta.
//
// Es de línea y no de delimitadores a propósito: un subtítulo ES una línea
// entera, así que no puede chocar con `*marca*` ni con `{{cita}}`, que marcan
// trozos de DENTRO de la frase. Se aceptan de DOS a seis almohadillas —quien
// pega desde Markdown escribe `##` o `###`— y se exige un espacio detrás.
//
// Dos y no una: con una sola, cualquier línea escrita antes de que esto
// existiera que empezara por `# ` —una nota numerada, algo pegado de otro
// sitio— se convertía en rótulo de golpe. Dos almohadillas es lo que pone el
// botón y lo que nadie escribe sin querer.
const SUBTITULO = /^[ \t]*#{2,6}[ \t]+(.*\S)[ \t]*$/;

// La misma cosa para limpiar un texto de varias líneas de golpe. Va aparte
// porque `replace` con una expresión global y una con `^…$` no son la misma
// herramienta: ésta tiene `m` para que `^` valga en cada línea.
const MARCADOR_SUBTITULO = /^[ \t]*#{2,6}[ \t]+/gm;

/**
 * El rótulo de una línea de subtítulo, o `''` si esa línea no lo es.
 *
 * Devuelve el texto TAL CUAL, con el marcado que lleve dentro: lo usa el botón
 * de la interfaz para quitar el `##`, y ahí borrar de paso los asteriscos del
 * predicador sería destruirle lo que escribió. Quien lo pinta ya lo limpia.
 */
export const subtituloDe = (linea) => (typeof linea === 'string' ? (linea.match(SUBTITULO)?.[1] || '').trim() : '');

/**
 * El texto sin el marcador de línea del subtítulo, conservando el resto del
 * marcado.
 *
 * Lo necesita quien pinta EN LÍNEA —`runsDeTexto`, en el PDF— porque ahí un
 * rótulo de línea no significa nada y el `##` salía impreso tal cual. Pasa en
 * los campos que no se trocean en bloques: la transición y los de la schiță,
 * que se editan a mano la noche antes de predicar.
 */
export const sinMarcadorDeSubtitulo = (texto) =>
  typeof texto === 'string' ? texto.replace(MARCADOR_SUBTITULO, '') : '';

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
  typeof texto === 'string' ? texto.replace(MARCADOR_SUBTITULO, '').replace(MARCA, '$1').replace(CITA, '$1: $2') : '';

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

// ── Bloques de presentación ─────────────────────────────
//
// El predicador escribe cada campo en un `textarea`, y ahí sólo tiene dos
// gestos: el salto de línea y la línea en blanco. Esta función los traduce a lo
// que se imprime, y es la capa que comparten el PDF, el documento en pantalla y
// la página pública — por el mismo motivo que `segmentarTexto`: tres troceados
// distintos acaban enseñando tres cosas distintas, y el que se descubre tarde
// es siempre el impreso.
//
// Una LÍNEA EN BLANCO era antes exactamente eso en el papel: un renglón vacío,
// mucho más aire del que separa dos párrafos de un libro. Ahora abre un párrafo
// nuevo y el aire lo pone el espaciado del bloque, que es la mitad. Un salto de
// línea simple sigue siendo un salto dentro del mismo párrafo.
//
// Devuelve bloques `{ tipo: 'parrafo' | 'subtitulo' | 'cita', texto, label? }`.
// El texto de un `parrafo` puede seguir trayendo `*marcas*` y hasta una
// `{{cita}}` en línea: de eso se encarga `segmentarTexto` después.

// Qué puede quedar detrás de una cita sin que cuente como texto: el punto que
// cierra la frase, una coma, un paréntesis o unas comillas.
const SOLO_CIERRE = /^[\s.,;:!?)\]»”"'…]*$/;

/**
 * Parte un párrafo sacando a bloque las citas que lo merecen.
 *
 * La regla es una: **una cita sale a bloque cuando no lleva nada detrás en su
 * línea**, más allá del punto que cierra la frase. Así salen a bloque las dos
 * formas en que se escribe casi siempre —sola en su línea, o detrás de
 * «Domnul spune:»— y ese punto final se queda pegado al versículo en vez de
 * abrir un párrafo nuevo con un carácter dentro.
 *
 * Si queda texto detrás, la cita se queda EN LÍNEA, aunque abra la línea:
 * sacarla dejaría ese texto huérfano en un párrafo que empieza por una coma o
 * por una raya.
 */
const bloquesDeParrafo = (parrafo) => {
  const bloques = [];
  let pendiente = '';
  let cursor = 0;

  const volcar = () => {
    const t = pendiente.trim();
    if (t) bloques.push({ tipo: 'parrafo', texto: t });
    pendiente = '';
  };

  for (const m of parrafo.matchAll(CITA)) {
    const antes = parrafo.slice(cursor, m.index);
    const finCita = m.index + m[0].length;
    const salto = parrafo.indexOf('\n', finCita);
    const finLinea = salto === -1 ? parrafo.length : salto;
    const restoLinea = parrafo.slice(finCita, finLinea);

    const cierraLinea = SOLO_CIERRE.test(restoLinea);

    if (!cierraLinea) {
      pendiente += antes + m[0];
      cursor = finCita;
      continue;
    }

    pendiente += antes;
    volcar();
    bloques.push({
      tipo: 'cita',
      label: m[1].trim(),
      texto: `${m[2]}${cierraLinea ? restoLinea : ''}`.trim(),
    });
    cursor = cierraLinea ? finLinea : finCita;
  }

  pendiente += parrafo.slice(cursor);
  volcar();
  return bloques;
};

export const bloquesDe = (texto) => {
  // Los saltos de Windows se normalizan aquí, en el único sitio por el que pasa
  // todo lo que se pinta. Un `textarea` ya devuelve `\n`, pero un texto que
  // llegue de fuera con `\r\n` dejaría un `\r` al final de cada línea y el
  // `##` del subtítulo no se reconocería — sin error y sin síntoma claro.
  const t = (typeof texto === 'string' ? texto : '').replace(/\r\n?/g, '\n');
  const bloques = [];

  for (const parrafo of t.split(/\n[ \t]*\n+/)) {
    let lineas = [];
    const volcar = () => {
      const unido = lineas.join('\n').trim();
      if (unido) bloques.push(...bloquesDeParrafo(unido));
      lineas = [];
    };
    for (const linea of parrafo.split('\n')) {
      // Un marcador sin texto detrás no es nada: se queda así al borrar el
      // rótulo recién creado, y se imprimía como un `##` suelto.
      if (/^[ \t]*#{2,6}[ \t]*$/.test(linea)) continue;

      const rotulo = subtituloDe(linea);
      if (rotulo) {
        // Un subtítulo a media línea parte el párrafo en dos: es un rótulo, no
        // una frase más.
        //
        // Y va LIMPIO de marcado: un rótulo se pinta entero en mayúsculas y
        // negrita, así que una `*marca*` dentro no significa nada y los
        // asteriscos salían impresos —marcar una palabra y convertir después
        // esa línea en subtítulo es un gesto de lo más normal—.
        volcar();
        bloques.push({ tipo: 'subtitulo', texto: quitarMarcas(rotulo) });
      } else {
        lineas.push(linea);
      }
    }
    volcar();
  }

  return bloques;
};

/**
 * La referencia bíblica *suelta* de una línea de schiță, sin su texto ni su
 * formato: «Ioan 3:16».
 *
 * Existe porque desde el 2 nov 2026 las referencias de apoyo se guardan con el
 * arranque del versículo (`{{Ioan 3:16|Fiindcă atât de mult…}}`) y hay un sitio
 * que necesita la etiqueta pelada: el Modo Amvon, donde la referencia es un
 * botón que abre el versículo entero buscándolo **por su `label`** en la copia
 * guardada en el dispositivo. Pasarle la línea con formato no encontraría nada
 * y el predicador se quedaría con el panel vacío delante de la congregación.
 */
export const etiquetaDeReferencia = (linea) => {
  const [bloque] = bloquesDe(linea || '');
  if (bloque?.tipo === 'cita') return bloque.label.trim();
  return quitarMarcas(linea || '').trim();
};

// ── Recorte para la schiță ──────────────────────────────
//
// La regla cambió el 2 nov 2026, a petición del propietario, después de llevar
// al púlpito la primera predicación preparada con la aplicación.
//
// Antes: dos frases del explicar, una del ilustrar y una del aplicar, cinco
// palabras cada una. Cinco palabras no bastaban para reconocer la frase desde
// el atril —«Una primera frase larga que…» no dice nada— y el tope de frases
// dejaba fuera la mitad del desarrollo sin avisar.
//
// Ahora entra CADA frase de cada campo, y cada una se recorta así:
//   - sin nada marcado → ocho palabras; si la frase acaba en diez o menos, va
//     entera, que es lo que significa «entre ocho y diez».
//   - con algo marcado → hasta cinco palabras de arranque, «…» y lo marcado.
// El arranque sitúa la frase; la marca conserva el matiz que el predicador
// quiso destacar. Las dos cosas, nunca una u otra.
const PALABRAS_CORTE = 8;
const PALABRAS_ENTERA = 10;
const PALABRAS_ARRANQUE = 5;

// Lo que cuenta como palabra: un signo de puntuación suelto no es una palabra
// que se haya dejado fuera, y contarlo ponía unos puntos suspensivos de más al
// final de cualquier frase marcada.
const ES_PALABRA = /[\p{L}\p{N}]/u;
const palabrasDe = (texto) =>
  String(texto || '')
    .split(/\s+/)
    .filter((p) => ES_PALABRA.test(p));

// Una coma o un punto y coma justo antes de los puntos suspensivos se lee como
// un borrón («lumea,…»): el recorte se queda sin ellos.
const recortar = (palabras, n) =>
  palabras
    .slice(0, n)
    .join(' ')
    .replace(/[,;:·—–-]+$/, '');

/**
 * Resume una frase para el púlpito, con la regla de arriba.
 */
const resumenDeFrase = (frase) => {
  const limpio = String(frase || '').trim();
  if (!limpio) return '';

  const marcas = marcadas(limpio);
  if (!marcas.length) {
    const palabras = palabrasDe(quitarMarcas(limpio));
    if (!palabras.length) return '';
    if (palabras.length <= PALABRAS_ENTERA) return palabras.join(' ');
    return `${recortar(palabras, PALABRAS_CORTE)}…`;
  }

  // El arranque es lo que hay ANTES de la primera marca: contar desde el
  // principio de la frase repetiría en el arranque las palabras que ya vienen
  // detrás en negrita.
  const arranque = palabrasDe(quitarMarcas(limpio.slice(0, limpio.indexOf('*'))));
  const abre = recortar(arranque, PALABRAS_ARRANQUE);
  const marcado = marcas.map((m) => `*${m}*`).join(' ');
  if (!abre) return marcado;

  // Los puntos suspensivos sólo si de verdad se ha quedado texto fuera: una
  // frase corta y marcada entera se lee tal cual.
  const alMargen = palabrasDe(quitarMarcas(limpio.replace(MARCA, ' ')));
  const dentro = Math.min(arranque.length, PALABRAS_ARRANQUE);
  return `${abre}${alMargen.length > dentro ? '…' : ''} ${marcado}`;
};

/**
 * Trocea un texto en frases, pero SIN partir por dentro de una `*marca*`.
 *
 * Con un `split(/[.;\n]+/)` a secas, marcar una frase entera con el ratón —que
 * se lleva el punto final dentro— dejaba un asterisco suelto a cada lado del
 * corte: número impar de asteriscos, y en el púlpito la negrita se comía el
 * resto de la línea. Desde que entra cada frase en la schiță, ese gesto es de
 * los más probables.
 */
const frasesDe = (texto) => {
  const frases = [];
  let actual = '';
  let dentro = false;

  for (const ch of String(texto || '')) {
    if (ch === '*') {
      const cerrando = dentro;
      dentro = !dentro;
      actual += ch;
      // Una marca que se ha tragado el punto final ES el final de la frase, y
      // se corta al cerrarla. Sin esto, la frase siguiente se quedaba pegada a
      // la marcada y el recorte la tiraba entera: el predicador marcaba una
      // frase y perdía la de al lado.
      if (cerrando && /[.;]$/.test(actual.slice(0, -1))) {
        frases.push(actual);
        actual = '';
      }
      continue;
    }
    if (!dentro && (ch === '.' || ch === ';' || ch === '\n')) {
      frases.push(actual);
      actual = '';
      continue;
    }
    actual += ch;
  }

  frases.push(actual);
  // Sin una sola letra no es una frase: con una lista numerada
  // («1. Zidirea casei.») el corte por puntos dejaba dos líneas de schiță que
  // decían «1» y «2», y en el atril eso es ruido puro.
  return frases.filter((f) => /\p{L}/u.test(f));
};

/** Una cita como línea de schiță: la referencia y el arranque del versículo,
 *  con la misma regla de recorte que cualquier otra frase.
 *
 *  Va con la sintaxis de cita (`{{ref|texto}}`) y no con una marca a secas
 *  (`*ref* texto`) desde el 2 nov 2026. No es cosmético: es lo que hace que la
 *  cita se distinga de una palabra cualquiera en negrita. `TextoFormateado` y
 *  `runsDeTexto` ya saben que una cita lleva **barra vertical a la izquierda**,
 *  así que con esto la tienen a la vez el Modo Amvon, el PDF de la schiță y la
 *  pantalla, sin una sola rama por sitio. Lo pidió el propietario después de
 *  llevar la cartilla al atril: desde ahí, un versículo y un énfasis se
 *  confundían.
 *
 *  Sin texto no hay cita que marcar —y el patrón `CITA` exige las dos partes—,
 *  así que entonces se queda en una marca normal. Las llaves se caen: una en
 *  el texto del versículo rompería el patrón por el medio. */
const lineaDeCita = (label, texto) => {
  const sinLlaves = (s) => String(s || '').replace(/[{}]/g, '');
  const ref = sinLlaves(label).replace(/\|/g, ' ').trim();
  const resumen = sinLlaves(resumenDeFrase(texto)).trim();
  return resumen ? `{{${ref}|${resumen}}}` : `*${ref}*`;
};

/**
 * Las citas insertadas en un texto, listas para ir de palabra clave en la
 * schiță: la referencia en negrita y el arranque del versículo.
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
  return [...texto.matchAll(CITA)].map((m) => lineaDeCita(m[1], m[2]));
};

/**
 * Las líneas de schiță de un campo: subtítulos, frases y citas, en el orden en
 * que están escritos.
 *
 * Conserva los asteriscos de lo marcado en vez de quitarlos: `TextoFormateado`
 * (en el púlpito, en el documento y en la página pública) y `runsDeTexto` (el
 * PDF) ya saben pintar esa negrita, así que el símbolo nunca llega a verse como
 * carácter. Un subtítulo se convierte en una marca entera en mayúsculas: es la
 * división que el predicador puso en su texto, y en la cartilla del atril vale
 * más que cualquier frase que se pudiera resumir de debajo.
 */
const fraseClaves = (texto) => {
  if (!texto || typeof texto !== 'string') return [];
  const salida = [];

  for (const bloque of bloquesDe(texto)) {
    if (bloque.tipo === 'subtitulo') {
      // Conserva el marcador `##` en vez de convertirlo en una marca entera.
      // Así quien lo pinta sabe que es un RÓTULO y no una frase marcada: en el
      // papel va sin el guion de las demás líneas, que es lo que lo distingue
      // de un elemento más de la lista.
      salida.push(`## ${bloque.texto.toUpperCase()}`);
      continue;
    }
    if (bloque.tipo === 'cita') {
      salida.push(lineaDeCita(bloque.label, bloque.texto));
      continue;
    }
    // El párrafo se recorre a trozos: lo que hay antes de cada cita, la cita, y
    // así hasta el final. Hay dos motivos para no trocear de una sola pasada:
    // el texto de la cita trae puntos propios y el corte por frases la partiría
    // a la mitad, y además la cita tiene que entrar en la schiță DONDE ESTÁ
    // ESCRITA. Sacándola aparte salía detrás de las frases que en el texto van
    // después de ella, y desde el atril eso se lee en el orden equivocado.
    let desde = 0;
    const añadirFrases = (trozo) => {
      for (const frase of frasesDe(trozo)) {
        const linea = resumenDeFrase(frase);
        if (linea) salida.push(linea);
      }
    };
    for (const m of bloque.texto.matchAll(CITA)) {
      añadirFrases(bloque.texto.slice(desde, m.index));
      salida.push(lineaDeCita(m[1], m[2]));
      desde = m.index + m[0].length;
    }
    añadirFrases(bloque.texto.slice(desde));
  }

  return salida;
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
      //
      // Se vuelve a trocear por dentro porque una marca puede ENVOLVER una
      // cita: se selecciona una frase entera que ya tenía un versículo
      // insertado y se pulsa «Marchează». Sin esto, las llaves y la barra
      // salían impresas dentro de la negrita. No hay recursión infinita: el
      // contenido de una marca no puede llevar otro asterisco.
      for (const s of segmentarTexto(m[1])) segmentos.push(s.cita ? s : { ...s, bold: true });
    } else {
      // {{ref|texto}} → la referencia en negrita, pegada al versículo en
      // cursiva. Así se lee como una cita dentro de la frase y no como un
      // trozo de código suelto. `cita: true` en los dos marca que van juntos,
      // para que quien pinte el texto (`TextoFormateado`) pueda envolverlos
      // en un solo bloque con su propia barra a la izquierda.
      //
      // El versículo se trocea por dentro por el mismo motivo que la marca:
      // se inserta la cita y después se pone en negrita una palabra DEL
      // versículo, que es justo lo que se hace para destacar la palabra sobre
      // la que va a ir el punto. Sin esto, el asterisco salía impreso.
      segmentos.push({ texto: `${m[2]} `, bold: true, cita: true });
      for (const s of segmentarTexto(m[3])) segmentos.push({ ...s, italica: true, cita: true });
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
 * Pone o quita el `##` de subtítulo en las líneas que toca el cursor.
 *
 * Trabaja por LÍNEAS ENTERAS y no por la selección exacta, al revés que
 * `alternarMarca`: un subtítulo es una línea completa, así que basta con que el
 * cursor esté dentro —no hay que seleccionar nada— y seleccionar media frase no
 * puede dejar medio rótulo. El mismo botón pone y quita, como el de la marca.
 */
export const alternarSubtitulo = (texto, desde = 0, hasta = desde) => {
  const t = typeof texto === 'string' ? texto : '';
  const a = Math.max(0, Math.min(desde, hasta));
  const b = Math.min(t.length, Math.max(desde, hasta));

  const ini = t.lastIndexOf('\n', Math.max(0, a - 1)) + 1;
  const salto = t.indexOf('\n', b);
  const fin = salto === -1 ? t.length : salto;

  const lineas = t.slice(ini, fin).split('\n');
  // Si TODO lo que se ha cogido ya son rótulos, el botón quita; si hay una sola
  // línea normal, pone. Así pulsar dos veces deja el texto como estaba.
  const todasSonRotulo = lineas.some((l) => l.trim()) && lineas.every((l) => !l.trim() || subtituloDe(l));

  const cambiadas = lineas.map((linea) => {
    if (!linea.trim()) return linea;
    // Al poner, se quita antes el marcador que ya hubiera: con una selección
    // de varias líneas donde una ya era rótulo, se quedaba `## ## Rótulo` —y
    // el segundo par de almohadillas sí se imprimía—.
    return todasSonRotulo ? subtituloDe(linea) : `## ${subtituloDe(linea) || linea.trim()}`;
  });

  const trozo = cambiadas.join('\n');
  return { texto: t.slice(0, ini) + trozo + t.slice(fin), desde: ini, hasta: ini + trozo.length };
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
    // La introducción pasa por la misma regla que el desarrollo. Antes tenía la
    // suya —tres frases de seis palabras, y los asteriscos quitados— así que lo
    // que el predicador marcaba en la introducción no llegaba al atril.
    intro: fraseClaves(c.intro),
    transition: quitarMarcas(c.transition).trim(),
    points: c.structure.map((punto) => {
      const d = c.development[punto.id] || {};
      const subpuntos = (punto.subpoints || []).map((s) => quitarMarcas(s.title).trim()).filter(Boolean);

      // El comienzo de cada frase (para situarse) MÁS lo marcado con
      // asteriscos (para no perder el matiz que el predicador quiso
      // destacar), los subtítulos que él mismo puso y las citas insertadas,
      // todo en el orden en que está escrito: `fraseClaves` recorre los
      // bloques del campo, así que una cita ya no sale al final de la lista
      // sino donde se va a leer.
      const desarrollo = [
        ...fraseClaves(d.explain),
        ...fraseClaves(d.illustrate),
        ...fraseClaves(d.apply),
        // El desarrollo de un subpunto se trata igual que el del punto.
        ...(punto.subpoints || []).flatMap((s) => fraseClaves(c.development[s.id]?.text)),
      ];

      return {
        id: punto.id,
        title: quitarMarcas(punto.title).trim().toUpperCase(),
        keywords: [...subpuntos, ...desarrollo].filter(Boolean),
        // Las del punto y las del desarrollo, en ese orden y sin repetir.
        //
        // **Con el arranque del versículo desde el 2 nov 2026**, no sólo la
        // etiqueta. Antes la schiță decía «Ioan 3:16» y nada más: en papel no
        // se puede tocar una referencia para abrirla, así que el predicador
        // tenía delante un código que no le decía qué dice el versículo. Van
        // con la misma regla de recorte que todo lo demás y con la sintaxis de
        // cita, que es la que les da la barra azul en los tres sitios que las
        // pintan.
        //
        // Siguen siendo **cadenas** y no objetos a propósito: así `mergeOutline`,
        // `outlineWordCount` y `normalizeOutline` no se enteran. Quien necesite
        // la etiqueta suelta —el Modo Amvon, para abrir el versículo— la saca
        // con `bloquesDe`.
        refs: [
          ...(punto.refs || []),
          ...(d.refs || []),
          ...(punto.subpoints || []).flatMap((s) => c.development[s.id]?.refs || []),
        ]
          .filter((r) => (r?.label || '').trim())
          .filter((r, i, todas) => todas.findIndex((o) => o.label.trim() === r.label.trim()) === i)
          .map((r) => lineaDeCita(r.label, r.text)),
      };
    }),
    // La aplicación sale del propósito, pero recortada como todo lo demás. El
    // propósito se escribe con calma en el estudio y puede ocupar un párrafo;
    // volcarlo entero aquí convertiría la schiță en el resumen largo que
    // justamente no debe ser. Si el predicador quiere la frase completa, la
    // schiță es editable.
    //
    // Las dos siguen siendo UN campo de texto y no una lista —cambiar su forma
    // obligaría a tocar `mergeOutline`, el recuento y el Modo Amvon—, pero sus
    // frases van separadas por una LÍNEA EN BLANCO desde el 2 nov 2026, no por
    // un punto medio. Una línea en blanco es lo que `bloquesDe` entiende como
    // separación de párrafos, así que cada frase se convierte en un bloque
    // propio y quien lo pinta la saca en su renglón, con la misma regla que las
    // claves de un punto. Con el punto medio, la conclusión salía en el papel
    // como un párrafo corrido de doce frases: desde el atril, ilegible.
    //
    // Pueden traer negrita y citas: quien las pinte tiene que pasar por
    // `TextoFormateado` o `runsDeTexto`, nunca por texto plano, o el asterisco
    // sale impreso.
    application: fraseClaves(c.idea.purpose).join('\n\n'),
    conclusion: fraseClaves(c.conclusion).join('\n\n'),
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
export const clavesATexto = (claves) => (Array.isArray(claves) ? claves : []).map((k) => `- ${k}`).join('\n');

/** Lo contrario: el texto del `textarea` de vuelta a array, sin viñetas. */
export const textoAClaves = (texto) =>
  String(texto ?? '')
    .split('\n')
    // El asterisco cuenta como viñeta sólo si lleva un espacio detrás («* idea»,
    // que es como se pega una lista desde otro sitio). Sin esa condición se
    // comía el asterisco que ABRE una marca, y muchas líneas generadas empiezan
    // por una: quedaba un número impar de asteriscos y la negrita se tragaba el
    // resto de la línea en el púlpito y en el PDF.
    //
    // Las almohadillas de un rótulo (`## ZIDIREA CASEI`) y las llaves de una
    // cita (`{{Ioan 3:16|…}}`) NO son viñetas y tienen que sobrevivir: son lo
    // que distingue esas dos líneas de una frase cualquiera al imprimir.
    .map((linea) => linea.replace(/^\s*(?:[-–—•·]+|\*(?=\s))\s*/, '').trim())
    .filter(Boolean);

export const normalizeOutline = (raw) => {
  const base = emptyOutline();
  if (!raw) return base;
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return base;
    }
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

const estaVacio = (v) => v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0);

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
  // Sobre el texto LIMPIO, igual que `sermonWordCount`: lo que se cuenta es lo
  // que se lee, no la sintaxis. Contando la cadena cruda, un rótulo sumaba una
  // palabra de más (`##`) y una cita una de menos, porque `3:16|Fiindcă` es un
  // solo token sin espacios. Con 73 claves, la cuenta se iba lo bastante como
  // para que el predicador no se fíe de ella.
  const cuenta = palabrasPredicadas;
  let total = cuenta(o.idea) + cuenta(o.transition) + cuenta(o.application) + cuenta(o.conclusion);
  for (const linea of o.intro) total += cuenta(linea);
  for (const p of o.points) {
    total += cuenta(p.title);
    for (const k of p.keywords || []) total += cuenta(k);
    for (const r of p.refs || []) total += cuenta(r);
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
    for (const r of d?.refs || []) añadir(r);
    // Las de los subpuntos también: en el púlpito no hay red, y una referencia
    // que se citó dentro de un subpunto se lee igual que las demás.
    for (const sub of punto.subpoints || []) {
      for (const r of c.development[sub.id]?.refs || []) añadir(r);
    }
  }
  return [...vistas.values()];
};
