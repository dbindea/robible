// Beacon de visitas para las analíticas del panel de admin.
//
// Fire-and-forget a propósito: un fallo de red aquí no puede interrumpir la
// navegación de nadie. Se manda el token si hay sesión (lo añade `api.post`
// solo) para que el worker pueda excluir la propia navegación de un admin por
// su panel — ver `analytics.js` en el worker.

import { api } from './apiClient.js';
import { USE_BACKEND } from '../config.js';

// ── Una visita por llegada, no una por evento ───────────────────────────────
//
// `navegarA` despacha `robibile:navigate` Y `popstate`, y `Main.svelte` registra
// la visita escuchando LOS DOS. Resultado: cada navegación interna se contaba
// dos veces y «Vizite totale» del panel enseñaba el doble. No afectaba a la
// cuota de la base —son unas quince visitas reales al día— pero el número que
// se lee no era el número que pasaba.
//
// Se arregla aquí y no quitando uno de los dos listeners porque hay
// navegaciones que sólo emiten un evento: el botón de atrás del navegador sólo
// emite `popstate`, y las copias de `pushState` que quedan repartidas por el
// proyecto (trampa 89) emiten una u otra según quién las escribiera. Quitando
// cualquiera de los dos se perderían visitas de verdad; deduplicando por ruta
// no se pierde ninguna.
//
// La ventana es de un segundo: los dos eventos de una misma navegación se
// despachan seguidos, en el mismo turno, así que basta de sobra. Y volver a la
// misma ruta en menos de un segundo no es una segunda visita de nadie.
const MISMA_VISITA_MS = 1000;

/**
 * Crea el filtro que decide si una llegada ya se contó.
 *
 * Se exporta como fábrica para poder probarlo sin red ni reloj: cada instancia
 * lleva su propio estado y recibe el instante por parámetro.
 *
 * @returns {(path: string, ahora: number) => boolean} true si hay que contarla
 */
export const creaFiltroDeVisitas = (ventanaMs = MISMA_VISITA_MS) => {
  let ultimaRuta = null;
  let ultimaMarca = 0;
  return (path, ahora) => {
    if (path === ultimaRuta && ahora - ultimaMarca < ventanaMs) return false;
    ultimaRuta = path;
    ultimaMarca = ahora;
    return true;
  };
};

const esLlegadaNueva = creaFiltroDeVisitas();

export const registrarVisita = (path) => {
  if (!USE_BACKEND || typeof path !== 'string' || !path) return;
  if (!esLlegadaNueva(path, Date.now())) return;
  api.post('/api/analytics/pageview', { path }).catch(() => {
    // Sin conexión o backend caído: no hay nada que reintentar, la próxima
    // visita ya manda la suya.
  });
};
