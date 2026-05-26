/* global process */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getBibleVersionConfig } from '../../src/config/bible-versions.js';

const SITE_URL = 'https://robible.com';
const DEFAULT_IMAGE = `${SITE_URL}/assets/img/logo.png`;

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
}) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const safeRedirectPath = escapeHtml(redirectPath);
  const safeLocale = escapeHtml(locale);
  const safeOgLocale = escapeHtml(ogLocale);
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

  return `<!doctype html>
<html lang="${safeLocale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
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
    <meta property="og:image" content="${DEFAULT_IMAGE}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:image:alt" content="RoBible" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${DEFAULT_IMAGE}" />
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

  if (![params.book, params.chapter, params.verse].every((value) => Number.isInteger(value) && value >= 0)) {
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

    const verseText = bible[params.book]?.[params.chapter - 1]?.[params.verse - 1];
    const bookName = map[params.book];

    if (!verseText || !bookName) {
      return { statusCode: 404, body: 'Verse not found' };
    }

    const reference = `${bookName} ${params.chapter}:${params.verse}`;
    const title = `${reference} | ${versionConfig.bibleName}`;
    const description = `${truncateText(verseText)} (${versionConfig.bibleName})`;
    const canonicalUrl = `${SITE_URL}/verse/${versionConfig.value}/${params.book}/${params.chapter}/${params.verse}`;
    const redirectPath = `/?version=${encodeURIComponent(versionConfig.value)}#verse-${params.book}-${params.chapter}-${params.verse}`;

    return {
      statusCode: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600',
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
      }),
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: 'Unable to build verse metadata' };
  }
}
