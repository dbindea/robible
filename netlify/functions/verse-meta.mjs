import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getBibleVersionConfig } from '../../src/config/bible-versions.js';
import { buildBiblePath, getBookIdFromSlug, parseBiblePath } from '../../src/services/bible-route.service.js';
import { combinarIndexables, crearIndice, esIndexable } from '../../src/config/golden-verses.js';

const SITE_URL = 'https://robible.com';

/**
 * Un versículo se indexa sólo si está en la lista blanca; el resto van
 * `noindex`. Antes del 14 sep 2026 se indexaban los 124.400.
 *
 * Por qué: un versículo suelto es la definición de contenido fino —una frase
 * que ya está entera en la página de su capítulo— y esta página manda al
 * visitante a la aplicación completa, que se descarga la Biblia de 4,3 MB para
 * pintar esa frase. Rastrear el conjunto son unos 600 GB, y eso agotó el ancho
 * de banda del plan de Netlify en quince días.
 *
 * Pero cerrarlos todos tiraba también la cola larga que sí vale —quien busca
 * «Ioan 3:16» quiere esa página—, así que los conocidos siguen indexándose.
 * Quiénes son, en `src/config/golden-verses.js`.
 *
 * `follow` se mantiene en los dos casos: los enlaces siguen contando. Y el
 * enlace sigue sirviendo para compartir aunque no se indexe — las etiquetas
 * Open Graph no dependen de eso.
 */
const ROBOTS_NOINDEX = 'noindex, follow, max-image-preview:large';
const ROBOTS_INDEX = 'index, follow, max-image-preview:large';

const DATA_DIRECTORIES = [
  path.resolve(process.cwd(), 'public', 'data'),
  path.resolve(process.env.LAMBDA_TASK_ROOT || process.cwd(), 'public', 'data'),
];

// ── Lista blanca de versículos indexables ───────────────────────────────────
//
// Se construye una sola vez por contenedor, no en cada invocación: son ~400
// referencias y leer el JSON de los versículos del día en cada petición sería
// trabajo repetido para siempre. Netlify reutiliza el contenedor entre
// invocaciones, así que el coste es del primer arranque en frío.
//
// Si el fichero de los diarios no se puede leer, se sigue con la lista curada
// en vez de reventar: un versículo de más o de menos en el índice de Google no
// justifica devolver un 500 a quien abrió el enlace.
let indiceIndexables = null;

async function cargarIndiceIndexables() {
  if (indiceIndexables) return indiceIndexables;
  let diarios = [];
  try {
    for (const dataDirectory of [...new Set(DATA_DIRECTORIES)]) {
      try {
        const crudo = JSON.parse(await readFile(path.join(dataDirectory, 'daily-verses.json'), 'utf8'));
        diarios = Array.isArray(crudo?.verses) ? crudo.verses : [];
        break;
      } catch { /* se prueba el siguiente directorio */ }
    }
  } catch { /* nos quedamos con la lista curada */ }
  indiceIndexables = crearIndice(combinarIndexables(diarios));
  return indiceIndexables;
}

function isValidBibleVersion(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function truncateText(text = '', maxLength = 180) {
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, maxLength - 1).trim()}...`;
}

async function readJsonFromDataDirectory(version, fileName) {
  const errors = [];

  for (const dataDirectory of [...new Set(DATA_DIRECTORIES)]) {
    try {
      return JSON.parse(await readFile(path.join(dataDirectory, version, fileName), 'utf8'));
    } catch (error) {
      errors.push(error);
    }
  }

  throw errors[0];
}

function getVerseParams(event) {
  const query = event.queryStringParameters || {};

  if (query.version && query.book && query.chapter && query.verse) {
    return {
      version: query.version,
      book: Number(query.book),
      chapter: Number(query.chapter),
      verse: Number(query.verse),
    };
  }

  if (query.version && query.book_slug && query.chapter && query.verse) {
    return {
      version: query.version,
      bookSlug: query.book_slug,
      chapter: Number(query.chapter),
      verse: Number(query.verse),
    };
  }

  const bibleRoute = parseBiblePath(event.path);

  if (bibleRoute?.verse) {
    return {
      version: bibleRoute.version,
      bookSlug: bibleRoute.bookSlug,
      chapter: bibleRoute.chapter,
      verse: bibleRoute.verse,
    };
  }

  const pathname = event.path;
  const [, version, book, chapter, verse] = pathname.match(/^\/verse\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\/?$/) || [];

  return {
    version,
    book: Number(book),
    chapter: Number(chapter),
    verse: Number(verse),
  };
}

function buildHtml({
  canonicalUrl,
  redirectPath,
  title,
  description,
  locale,
  ogLocale,
  verseText,
  reference,
  bibleName,
  ogImage,
  indexable,
}) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const safeRedirectPath = escapeHtml(redirectPath);
  const safeLocale = escapeHtml(locale);
  const safeOgLocale = escapeHtml(ogLocale);
  const safeOgImage = escapeHtml(ogImage);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: reference,
    text: verseText,
    inLanguage: locale,
    isPartOf: {
      '@type': 'Book',
      name: bibleName,
    },
    url: canonicalUrl,
  };
  const safeSchema = JSON.stringify(schema).replaceAll('<', '\\u003c');

  // El comentario va aquí fuera y no dentro del HTML a propósito: esta cadena se
  // sirve 124.400 veces y no hay por qué mandar la explicación con cada una.
  return `<!doctype html>
<html lang="${safeLocale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="${indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX}" />
    <meta name="theme-color" content="#3f5867" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${safeCanonicalUrl}" />
    <meta property="og:locale" content="${safeOgLocale}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="RoBible" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeCanonicalUrl}" />
    <meta property="og:image" content="${safeOgImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(reference)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeOgImage}" />
    <script type="application/ld+json">
      ${safeSchema}
    </script>
    <script>window.location.replace(${JSON.stringify(safeRedirectPath)});</script>
  </head>
  <body>
    <p><a href="${safeRedirectPath}">${safeTitle}</a></p>
  </body>
</html>`;
}

export async function handler(event) {
  const params = getVerseParams(event);

  if (!isValidBibleVersion(params.version)) {
    return { statusCode: 404, body: 'Verse not found' };
  }

  const hasBookReference =
    (Number.isInteger(params.book) && params.book >= 0) || (typeof params.bookSlug === 'string' && params.bookSlug);

  if (!hasBookReference || ![params.chapter, params.verse].every((value) => Number.isInteger(value) && value > 0)) {
    return { statusCode: 404, body: 'Verse not found' };
  }

  const versionConfig = getBibleVersionConfig(params.version);

  if (!versionConfig) {
    return { statusCode: 404, body: 'Verse not found' };
  }
  try {
    const [map, bible] = await Promise.all([
      readJsonFromDataDirectory(versionConfig.value, 'bible.map.json'),
      readJsonFromDataDirectory(versionConfig.value, 'bible.json'),
    ]);

    const book = Number.isInteger(params.book) ? params.book : getBookIdFromSlug(map, params.bookSlug);
    const verseText = bible[book]?.[params.chapter - 1]?.[params.verse - 1];
    const bookName = map[book];

    if (!verseText || !bookName) {
      return { statusCode: 404, body: 'Verse not found' };
    }

    const reference = `${bookName} ${params.chapter}:${params.verse}`;
    const title = `${reference} | ${versionConfig.bibleName}`;
    const description = `${truncateText(verseText)} (${versionConfig.bibleName})`;
    const canonicalPath = buildBiblePath({
      version: versionConfig.value,
      map,
      book,
      chapter: params.chapter,
      verse: params.verse,
    });
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const redirectPath = event.path.startsWith('/verse/')
      ? canonicalPath
      : `/?version=${encodeURIComponent(versionConfig.value)}#verse-${book}-${params.chapter}-${params.verse}`;
    const ogImage = `${SITE_URL}/og/verse/${versionConfig.value}/${book}/${params.chapter}/${params.verse}.svg`;

    return {
      statusCode: 200,
      headers: {
        // Un versículo no cambia. Lo que se genera aquí sólo se mueve si se
        // toca esta función, así que la única razón para una caché corta sería
        // el miedo — y la cara es real: cada fallo de caché es una invocación
        // de función y tráfico de salida contra el plan.
        // `s-maxage` es para el CDN, `max-age` para el navegador; separados
        // porque el edge puede guardarlo mucho más tiempo sin riesgo.
        'Cache-Control': 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400',
        'Content-Type': 'text/html; charset=utf-8',
      },
      body: buildHtml({
        canonicalUrl,
        redirectPath,
        title,
        description,
        locale: versionConfig.locale,
        ogLocale: versionConfig.ogLocale,
        verseText,
        reference,
        bibleName: versionConfig.bibleName,
        indexable: esIndexable(await cargarIndiceIndexables(), book, params.chapter, params.verse),
        ogImage,
      }),
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: 'Unable to build verse metadata' };
  }
}
