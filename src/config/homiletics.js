/**
 * Guía de homilética: qué se explica en cada paso de la preparación.
 *
 * El contenido sale del curso de predicación expositiva del Institutul Teologic
 * Penticostal din București. Aquí sólo está el **esqueleto** —qué bloques tiene
 * la ayuda de cada paso—; el texto vive en `public/lang/*.json` bajo
 * `app.homiletics.*`, como todo lo demás.
 *
 * Por qué existe: el módulo lo va a abrir gente que nunca ha oído hablar de
 * "idea exegética" ni de "diviziuni simetrice". Sin una explicación al lado del
 * campo, el formulario se rellena a ojo y sale un comentario versículo a
 * versículo, que es justo lo que la predicación expositiva NO es.
 *
 * Regla de contención: esto son notas al margen, no el curso entero. Cada paso
 * tiene como mucho cinco viñetas y un ejemplo. Si hace falta más, es que el
 * paso está mal partido.
 */

/**
 * `bullets` es el número de viñetas (`b1`…`bN`) que tiene el paso.
 * `quote` / `warn` / `example` indican si además existen esas claves.
 *
 * El ejemplo es siempre el mismo pasaje —Tit 2:11-14— a propósito: el curso lo
 * usa de hilo conductor y ver la MISMA predicación avanzar paso a paso enseña
 * más que siete ejemplos sueltos.
 */
// `intro` y `final` fueron un solo paso (FINALIZARE) hasta el 10 sep 2026: se
// separaron para escribir la introducción ANTES de DEZVOLTARE, por decisión
// del propietario y en contra de lo que enseña el curso (que la escribe al
// final). Ver la nota de `STEPS` en `sermon-content.service.js`. `final` se
// queda sólo con la conclusión, por eso baja a una viñeta.
export const GUIA = {
  text: { bullets: 3 },
  observation: { bullets: 4 },
  context: { bullets: 5 },
  idea: { bullets: 4, quote: true, warn: true, example: 3 },
  structure: { bullets: 5, example: 4 },
  intro: { bullets: 4 },
  development: { bullets: 4 },
  final: { bullets: 1 },
};

/**
 * Avisos por tipo de predicación.
 *
 * El curso —y por tanto toda la guía de arriba— es de predicación
 * **expositiva**. Las otras dos formas comparten el recorrido pero no se
 * recorren igual, así que cada paso lleva su propia nota: el guía de arriba
 * explica el paso, y la nota dice qué cambia si lo que estás escribiendo es una
 * textual o una temática.
 *
 * Empezó cubriendo sólo `text`, `idea` y `structure`, que son donde es más fácil
 * acabar predicando otra cosa sin darte cuenta. Se extendió a los siete porque
 * quedarse a medias era peor que no estar: quien elige «tematică» leía consejo
 * a su medida en tres pantallas y en las otras cuatro la guía de un curso que
 * no es el suyo, sin nada que se lo advirtiera.
 *
 * `expositive` no aparece a propósito: la guía entera ya está escrita para ese
 * caso, y repetirlo en un recuadro aparte sería ruido. El aviso sale sólo
 * cuando lo que estás escribiendo NO es lo que la guía asume.
 */
const PASOS_CON_NOTA = ['text', 'observation', 'context', 'idea', 'structure', 'intro', 'development', 'final'];
export const TIPOS_CON_NOTA = ['textual', 'thematic'];

export const tieneNotaDeTipo = (tipo, paso) =>
  TIPOS_CON_NOTA.includes(tipo) && PASOS_CON_NOTA.includes(paso);

// ── Propoziția de tranziție ───────────────────────────────
//
// La frase que lleva de la introducción a las divisiones. Se formula con el
// número de divisiones, la **palabra clave en plural** (motive, pași, condiții…)
// y la pregunta analítica, y anuncia de qué se va a hablar sin adelantar
// todavía el primer punto.
//
// Aquí sólo está el recuento; las plantillas viven en `app.homiletics.transition.sN`
// de los cuatro ficheros de idioma, como todo el texto de la guía. Tres y no
// más: son moldes para arrancar, no un repertorio que haya que leerse.
export const SUGERENCIAS_TRANSICION = 3;

export const sugerenciasDeTransicion = () =>
  Array.from({ length: SUGERENCIAS_TRANSICION }, (_, i) => `s${i + 1}`);

/** Los pasos que tienen guía. Los demás no muestran el botón. */
export const tieneGuia = (paso) => Object.prototype.hasOwnProperty.call(GUIA, paso);

/** `['b1','b2',…]` para el paso pedido. */
export const vinetasDe = (paso) =>
  Array.from({ length: GUIA[paso]?.bullets || 0 }, (_, i) => `b${i + 1}`);

/** `['e1','e2',…]` — las líneas del ejemplo, si las hay. */
export const ejemploDe = (paso) =>
  Array.from({ length: GUIA[paso]?.example || 0 }, (_, i) => `e${i + 1}`);
