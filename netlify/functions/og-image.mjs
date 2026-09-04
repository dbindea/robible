import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getBibleVersionConfig } from '../../src/config/bible-versions.js';

const DATA_DIRECTORIES = [
  path.resolve(process.cwd(), 'public', 'data'),
  path.resolve(process.env.LAMBDA_TASK_ROOT || process.cwd(), 'public', 'data'),
];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getParams(event) {
  const query = event.queryStringParameters || {};

  if (query.version && query.book && query.chapter && query.verse) {
    return {
      version: query.version,
      book: Number(query.book),
      chapter: Number(query.chapter),
      verse: Number(query.verse),
    };
  }

  const [, version, book, chapter, verse] =
    event.path.match(/^\/og\/verse\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\.svg$/) || [];

  return {
    version,
    book: Number(book),
    chapter: Number(chapter),
    verse: Number(verse),
  };
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

function splitLines(text = '', maxLineLength = 44, maxLines = 5) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;

    if (nextLine.length > maxLineLength && line) {
      lines.push(line);
      line = word;
      return;
    }

    line = nextLine;
  });

  if (line) {
    lines.push(line);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  return [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].slice(0, maxLineLength - 1).trim()}...`];
}

function buildSvg({ reference, text, bibleName }) {
  const lines = splitLines(text);
  const lineHeight = 58;
  const firstLineY = 225 - Math.max(0, lines.length - 3) * 16;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeHtml(reference)}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#f5f8fb"/>
      <stop offset="1" stop-color="#dcebf2"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="70" y="70" width="1060" height="490" rx="28" fill="#ffffff" stroke="#b8d7e8" stroke-width="2"/>
  <text x="105" y="140" fill="#2d96cd" font-family="Segoe UI, Open Sans, Arial, sans-serif" font-size="30" font-weight="700">RoBible</text>
  <text x="105" y="192" fill="#3f5867" font-family="Segoe UI, Open Sans, Arial, sans-serif" font-size="42" font-weight="700">${escapeHtml(reference)}</text>
  ${lines
    .map(
      (line, index) =>
        `<text x="105" y="${firstLineY + index * lineHeight}" fill="#22313a" font-family="Segoe UI, Open Sans, Arial, sans-serif" font-size="42" font-weight="400">${escapeHtml(line)}</text>`,
    )
    .join('')}
  <text x="105" y="510" fill="#607985" font-family="Segoe UI, Open Sans, Arial, sans-serif" font-size="28" font-weight="600">${escapeHtml(bibleName)}</text>
  <path d="M998 462c34-52 54-106 60-162-44 10-78 34-101 72-22-38-56-62-100-72 7 56 27 110 61 162 15 23 65 23 80 0z" fill="#2d96cd" opacity="0.14"/>
</svg>`;
}

export async function handler(event) {
  const params = getParams(event);
  const versionConfig = getBibleVersionConfig(params.version);

  if (
    !versionConfig ||
    !(Number.isInteger(params.book) && params.book >= 0) ||
    ![params.chapter, params.verse].every((value) => Number.isInteger(value) && value > 0)
  ) {
    return { statusCode: 404, body: 'OG image not found' };
  }

  try {
    const [map, bible] = await Promise.all([
      readJsonFromDataDirectory(versionConfig.value, 'bible.map.json'),
      readJsonFromDataDirectory(versionConfig.value, 'bible.json'),
    ]);
    const text = bible[params.book]?.[params.chapter - 1]?.[params.verse - 1];
    const bookName = map[params.book];

    if (!text || !bookName) {
      return { statusCode: 404, body: 'OG image not found' };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Content-Type': 'image/svg+xml; charset=utf-8',
      },
      body: buildSvg({
        reference: `${bookName} ${params.chapter}:${params.verse}`,
        text,
        bibleName: versionConfig.bibleName,
      }),
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: 'Unable to build OG image' };
  }
}
