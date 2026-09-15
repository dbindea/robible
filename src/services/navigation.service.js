// Navegar entre páginas de la aplicación.
//
// Por qué existe: no hay router (CLAUDE.md, trampa 11), así que cada pantalla
// se escribía su propio `irA` con `pushState` + los dos eventos. Diez copias de
// tres líneas, y en ocho de ellas faltaba lo mismo: **subir al principio**. El
// síntoma es que llegas a una página nueva por su mitad, y como el scroll lo
// heredas de la página anterior, parece que el enlace no ha hecho nada.
//
// El evento `robibile:navigate` va con la errata del resto del proyecto
// —`bibile`, no `bible`— y está así en una decena de sitios: escribirlo bien
// aquí sería justo el error.

/**
 * Va a una ruta interna.
 *
 * @param {string} href
 * @param {object} [opciones]
 * @param {boolean} [opciones.scrollTop=true] Subir arriba del todo. Se pone a
 *   `false` cuando el destino es un versículo concreto: allí manda el scroll
 *   que hace `Result.svelte` hasta el versículo, y subir a la vez deja al
 *   usuario mirando el principio del capítulo en vez de lo que pidió.
 * @param {boolean} [opciones.suave=true] `smooth` salvo que el usuario haya
 *   pedido menos movimiento en el sistema.
 */
export const navegarA = (href, { scrollTop = true, suave = true } = {}) => {
  if (!href || typeof window === 'undefined') return;

  // `/landing` se sirve como documento aparte, no desde la SPA: hay que dejar
  // que el navegador cargue la página entera.
  if (href === '/landing') {
    window.location.href = href;
    return;
  }

  if (window.location.pathname !== href) {
    window.history.pushState(null, '', href);
  }
  window.dispatchEvent(new CustomEvent('robibile:navigate'));
  window.dispatchEvent(new PopStateEvent('popstate'));

  if (!scrollTop) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  window.scrollTo({ top: 0, behavior: suave && !reduce ? 'smooth' : 'auto' });
};
