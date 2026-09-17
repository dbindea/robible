/**
 * Las ediciones no numeran igual, y eso se nota al comparar y al proyectar.
 *
 * RoBible guarda cada Biblia como `array[libro][capítulo][versículo]`, con el
 * índice 0 = versículo 1. Eso es correcto en las siete versiones: se comprobó
 * capítulo a capítulo el 17 sep 2026 correlacionando la longitud de los
 * versículos entre versiones y leyendo a mano todo lo que salió sospechoso.
 *
 * Pero «correcto» no es «igual». En cuatro capítulos las ediciones **numeran de
 * otra manera**, siguiendo una tradición textual distinta, y ahí el mismo
 * número de versículo apunta a contenidos distintos:
 *
 *   Numeri 12:16 (vdc)     = Números 13:1 (RV1909)
 *   1 Samuel 23:29 (vdc)   = 1 Samuel 24:1 (RV1909)
 *   Iona 1:17 (vdc)        = Jonás 2:1 (RV1909)
 *   1 Cronici 22:1 (vdc)   = 1 Crónicas 21:31 (和合本)
 *
 * No es un fallo de la descarga: es así en las ediciones impresas. Lo que sí
 * sería un fallo es enseñar el versículo de al lado como si fuera el pedido —
 * **en la pantalla de una iglesia eso es lo peor que puede pasar**, y es
 * exactamente el mismo motivo por el que el segundo idioma de la proyección se
 * resuelve por referencia y no por posición.
 *
 * `vdc` es la numeración canónica del proyecto: es la de las rutas, la de las
 * referencias que se comparten y la de la versión por defecto.
 */

/**
 * Desplazamientos conocidos, por versión y `libro:capítulo` (capítulo en base 1).
 *
 * El valor es cuánto hay que correr el índice para encontrar, EN ESA VERSIÓN,
 * el versículo que la numeración canónica llama V:
 *
 *   índice = V - 1 + desplazamiento
 *
 * Un desplazamiento que deja el índice fuera del array significa que esa
 * edición no tiene ese versículo en ese capítulo (lo numera en el anterior).
 * Entonces no se pinta nada, que es lo correcto: mejor un hueco que una línea
 * equivocada.
 *
 * Los índices de libro son los del canon: 3 Números, 8 1 Samuel,
 * 12 1 Crónicas, 31 Jonás.
 */
export const DESPLAZAMIENTOS = {
  es_rv1909: {
    '3:13': 1, // Números 13 — RV1909 abre el capítulo con lo que vdc numera 12:16
    '8:24': 1, // 1 Samuel 24 — ídem con 23:29
    '31:2': 1, // Jonás 2 — ídem con 1:17
  },
  zh_cuv: {
    '12:22': -1, // 1 Crónicas 22 — el 和合本 numera 22:1 como 21:31
  },
};

/**
 * Cuánto se desplaza una versión respecto de la numeración canónica.
 * Cero para todo lo que no esté en la tabla, que es el 99,94 % de los casos.
 */
export const desplazamiento = (version, libro, capitulo) =>
  DESPLAZAMIENTOS[version]?.[`${libro}:${capitulo}`] ?? 0;

/**
 * El índice en el array de `version` del versículo canónico `versiculo`.
 * Puede salir negativo o pasarse del final: eso significa «aquí no está».
 */
export const indiceDeVersiculo = (version, libro, capitulo, versiculo) =>
  versiculo - 1 + desplazamiento(version, libro, capitulo);

/**
 * El texto de un versículo canónico en la versión que se pida, o cadena vacía.
 *
 * Es la función que hay que usar para sacar «el mismo versículo» de otra
 * Biblia. Leer `bible[libro][capitulo - 1][versiculo - 1]` a pelo funciona en
 * casi todas partes y falla justo en los cuatro capítulos de arriba.
 */
export const textoDeVersiculo = (bible, version, libro, capitulo, versiculo) => {
  const cap = bible?.[libro]?.[capitulo - 1];
  if (!Array.isArray(cap)) return '';
  const i = indiceDeVersiculo(version, libro, capitulo, versiculo);
  if (i < 0 || i >= cap.length) return '';
  return String(cap[i] || '').trim();
};

/**
 * Alinea dos versiones en la vista de comparación.
 *
 * Dado el índice `i` de la columna izquierda (versión `a`), devuelve qué índice
 * hay que enseñar en la derecha (versión `b`). Se pasa por la numeración
 * canónica: `i` es el versículo canónico `i + 1 - da`, y ese versículo está en
 * `b` en el índice `canónico - 1 + db`.
 */
export const indiceAlineado = (i, a, b, libro, capitulo) =>
  i - desplazamiento(a, libro, capitulo) + desplazamiento(b, libro, capitulo);
