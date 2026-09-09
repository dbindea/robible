// Colecciones de versículos curadas por RoBible.
//
// Se diferencian de los temas de los usuarios en tres cosas y las tres
// importan: las escribe el proyecto, tienen un texto de presentación y **se
// indexan**. Un tema de usuario es una lista de versículos que ya tienen su
// propia página —contenido duplicado y fino, por eso va con `noindex`—;
// éstas traen algo que no existe en ninguna otra parte del sitio.
//
// Los datos son un JSON estático generado por scripts/build-curated-topics.mjs,
// precacheado por el service worker: funcionan sin conexión y sin pedirle nada
// al worker.

const DATA_URL = '/data/curated-topics.json';

let cache = null;
let enVuelo = null;

/** Todas las colecciones. Se pide una sola vez por sesión. */
export const loadCuratedTopics = async () => {
  if (cache) return cache;
  // Si dos componentes lo piden a la vez —la lista y una ficha— comparten la
  // misma petición en lugar de lanzar dos.
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`curated-topics ${res.status}`);
      const datos = await res.json();
      cache = Array.isArray(datos?.topics) ? datos.topics : [];
      return cache;
    } catch {
      // Sin las colecciones la aplicación sigue entera: es una sección más.
      cache = [];
      return cache;
    } finally {
      enVuelo = null;
    }
  })();

  return enVuelo;
};

export const getCuratedTopic = async (slug) => {
  const todos = await loadCuratedTopics();
  return todos.find((t) => t.slug === slug) || null;
};

/**
 * El nombre y la presentación en el idioma pedido, con vuelta al rumano.
 *
 * El rumano es el idioma por defecto del sitio y el único que se garantiza en
 * el generador; caer en él es preferible a enseñar el slug.
 */
export const textoDe = (topic, campo, locale = 'ro') =>
  topic?.[campo]?.[locale] || topic?.[campo]?.ro || '';

export const buildCuratedPath = (slug) => `/versete/${encodeURIComponent(slug)}`;
