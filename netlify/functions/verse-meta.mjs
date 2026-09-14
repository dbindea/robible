import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getBibleVersionConfig } from '../../src/config/bible-versions.js';
import { buildBiblePath, getBookIdFromSlug, parseBiblePath } from '../../src/services/bible-route.service.js';

const SITE_URL = 'https://robible.com';

/**
 * `noindex, follow` desde el 14 sep 2026; antes era `index, follow`.
 *
 * Un versículo suelto es la definición de contenido fino: una frase que ya está
 * entera en la página de su capítulo, multiplicada por 124.400 URLs (31.100 ×
 * 4 versiones). Y pedir que se indexaran salía carísimo, porque esta página
 * manda al visitante a la aplicación completa, que se descarga la Biblia de
 * 4,3 MB para pintar esa frase: rastrear el conjunto son unos 600 GB. Es lo que
 * agotó el ancho de banda del plan de Netlify en quince días.
 *
 * `follow` se mantiene — los enlaces siguen contando— y el enlace sigue
 * sirviendo para compartir, que es su función real: las etiquetas Open Graph no
 * dependen de que la página se indexe.
 *
 * Ojo: mientras `robots.txt` mantenga cerradas las rutas de versículo (las de
 * cuatro segmentos bajo `/biblia/`), Google no llegará a leer esta etiqueta.
 * Las dos cosas se pusieron a la vez a propósito — el `Disallow` corta el gasto
 * hoy, y este `noindex` es lo que desindexa si algún día se levanta el bloqueo.
 */
const ROBOTS = 'noindex, follow, max-image-preview:large';

const DATA_DIRECTORIES = [
  path.resolve(process.cwd(), 'public', 'data'),
  path.resolve(process.env.LAMBDA_TASK_ROOT || process.cwd(), 'public', 'data'),
];

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
    <meta name="robots" content="${ROBOTS}" />
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
        ogImage,
      }),
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: 'Unable to build verse metadata' };
  }
}
