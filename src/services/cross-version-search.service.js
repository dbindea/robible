/**
 * «Cero resultados» que en realidad son un idioma equivocado.
 *
 * El caso, contado por el usuario: es rumano, busca una palabra en rumano y sin
 * darse cuenta tiene puesta una Biblia en español. El buscador devuelve cero, y
 * cero es una respuesta legítima: no hay forma de distinguir «esa palabra no
 * está en la Biblia» de «estás buscando en el idioma que no es». Es el mismo
 * fallo silencioso que el libro que se queda pegado en el filtro, y se arregla
 * igual: diciéndoselo y ofreciendo el cambio en un clic.
 *
 * ── Lo caro es bajarse otra Biblia, así que casi nunca se baja ──────
 * Cada versión pesa entre 1 y 4 MB (CLAUDE.md, trampa 5) y hay siete. La regla:
 *
 *   1. Se prueban las versiones que el usuario tiene activas, no las siete.
 *   2. Las que YA están en la caché del navegador salen gratis, sin red. El
 *      service worker precachea `vdc` y `rvl` para todo el mundo y guarda
 *      cualquier otra que se haya abierto (`cacheFirst` sobre `/data/`), así que
 *      el caso de arriba —rumano con el español puesto— se resuelve sin
 *      descargar nada.
 *   3. De las que no están, se baja COMO MUCHO UNA: la que mejor encaja con el
 *      idioma del navegador. Y sólo después de que la búsqueda se haya quedado
 *      quieta en cero, que es lo raro.
 *
 * Y se para en la primera que tenga resultados: la pregunta es «¿dónde sí?», no
 * «¿cuántas hay?».
 *
 * ── Por qué se cuenta con el buscador de verdad ─────────────────────
 * Se usa `getFilterResult` con el MISMO formulario, libro y ámbito incluidos, en
 * vez de un recuento aparte más barato. Si el aviso promete 171 resultados, al
 * cambiar de versión tienen que salir 171: un recuento que no fuese exactamente
 * el mismo cálculo acabaría mintiendo el día que uno de los dos cambie.
 */

import { getFilterResult } from './filter.service.js';
import { getBibleVersionConfig } from '../config/bible-versions.js';

const rutaDe = (version, fichero) => `/data/${encodeURIComponent(version)}/${fichero}`;

// Se guarda UNA versión consultada, no todas: son 1-4 MB de texto más su índice
// de búsqueda, y el sentido de esto es responder una pregunta puntual, no
// convertirse en una segunda Biblia en memoria. Al sustituirla, la anterior se
// queda sin referencias y con ella se va su índice, que cuelga de un WeakMap.
let ultima = null; // { version, bible, map }

/** ¿Está ya descargada? Se mira la Cache API, que es donde la deja el SW. */
async function estaGuardada(version) {
  if (typeof caches === 'undefined') return false;
  try {
    return Boolean(await caches.match(rutaDe(version, 'bible.json')));
  } catch {
    return false;
  }
}

async function leerJson(version, fichero, senal) {
  const respuesta = await fetch(rutaDe(version, fichero), { signal: senal });
  if (!respuesta.ok) throw new Error(`No se pudo leer ${rutaDe(version, fichero)}: ${respuesta.status}`);
  return respuesta.json();
}

async function cargarVersion(version, senal) {
  if (ultima?.version === version) return ultima;
  const [map, bible] = await Promise.all([
    leerJson(version, 'bible.map.json', senal),
    leerJson(version, 'bible.json', senal),
  ]);
  if (!Array.isArray(bible) || !bible.length) return null;
  ultima = { version, bible, map };
  return ultima;
}

/**
 * En qué orden se prueban las versiones.
 *
 * Primero las del idioma del NAVEGADOR, que es el único indicio independiente
 * que hay de cuál es la lengua del usuario: el idioma de la interfaz no sirve
 * porque lo fija la versión elegida (`loadLocaleForBibleVersion`), así que con
 * el español puesto la interfaz también está en español. El resto van en el
 * orden del catálogo, que es como salen en el selector.
 */
export function ordenarCandidatas(versionActual, disponibles) {
  const idiomaNavegador = (typeof navigator !== 'undefined' ? navigator.language || '' : '').slice(0, 2).toLowerCase();
  const otras = (disponibles || []).filter((v) => v !== versionActual);
  if (!idiomaNavegador) return otras;
  const suyas = otras.filter((v) => getBibleVersionConfig(v)?.locale === idiomaNavegador);
  return [...suyas, ...otras.filter((v) => !suyas.includes(v))];
}

/**
 * La primera versión activa que sí tiene resultados para esta búsqueda.
 *
 * @param {object} form        el formulario tal cual, con su libro y su ámbito
 * @param {string[]} candidatas versiones a probar, ya ordenadas
 * @param {AbortSignal} [senal] para soltarlo si el usuario sigue escribiendo
 * @returns {Promise<{version: string, bibleName: string, count: number}|null>}
 */
export async function primeraVersionConResultados(form, candidatas, senal) {
  if (!form?.searchText || form.searchText.trim().length < 3) return null;

  // Una sola descarga por consulta, y para la mejor candidata. Las demás sólo
  // cuentan si ya estaban guardadas.
  let quedaDescarga = true;

  for (const version of candidatas || []) {
    if (senal?.aborted) return null;
    const config = getBibleVersionConfig(version);
    if (!config) continue;

    const guardada = ultima?.version === version || (await estaGuardada(version));
    if (!guardada) {
      if (!quedaDescarga) continue;
      quedaDescarga = false;
    }

    let datos = null;
    try {
      datos = await cargarVersion(version, senal);
    } catch {
      continue; // sin red o fichero que falta: no es un error que enseñar
    }
    if (!datos || senal?.aborted) return null;

    const encontrados = getFilterResult(datos.bible, datos.map, form);
    if (encontrados.length) {
      return { version, bibleName: config.bibleName, count: encontrados.length };
    }
  }

  return null;
}

/** Suelta la Biblia consultada. La llama el panel al desmontarse. */
export function olvidarVersionConsultada() {
  ultima = null;
}
