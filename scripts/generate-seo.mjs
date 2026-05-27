/* global process */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIBLE_VERSIONS } from '../src/config/bible-versions.js';
import { buildBiblePath } from '../src/services/bible-route.service.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DATA_DIR = path.join(ROOT_DIR, 'public', 'data');
const SITEMAP_CHUNK_SIZE = 45000;
const TODAY = new Date().toISOString().slice(0, 10);
const SITE_URL = 'https://robible.com';
const DEFAULT_IMAGE = `${SITE_URL}/assets/img/logo.png`;

const TOPICS = [
  {
    version: 'rvl',
    path: '/versiculos/amor',
    title: 'Versiculos sobre amor | Biblia Online',
    description: 'Lee versiculos sobre amor en la Biblia online y comparte referencias biblicas para estudiar y meditar.',
    references: [
      [42, 3, 16],
      [45, 13, 4],
      [45, 13, 13],
      [61, 4, 8],
      [61, 4, 18],
      [44, 5, 8],
      [42, 13, 34],
      [42, 15, 13],
      [47, 5, 22],
      [50, 3, 14],
    ],
  },
  {
    version: 'rvl',
    path: '/versiculos/esperanza',
    title: 'Versiculos sobre esperanza | Biblia Online',
    description: 'Encuentra versiculos biblicos sobre esperanza para leer, estudiar y compartir.',
    references: [
      [23, 29, 11],
      [44, 15, 13],
      [44, 5, 5],
      [57, 11, 1],
      [18, 42, 11],
      [22, 40, 31],
      [24, 3, 24],
      [59, 1, 3],
    ],
  },
  {
    version: 'rvl',
    path: '/versiculos/fe',
    title: 'Versiculos sobre fe | Biblia Online',
    description: 'Versiculos sobre fe en la Biblia, con referencias listas para lectura y estudio.',
    references: [
      [57, 11, 1],
      [44, 10, 17],
      [48, 2, 8],
      [40, 11, 24],
      [39, 17, 20],
      [46, 5, 7],
      [58, 2, 17],
      [47, 2, 20],
    ],
  },
  {
    version: 'rvl',
    path: '/versiculos/matrimonio',
    title: 'Versiculos sobre matrimonio | Biblia Online',
    description: 'Lee versiculos biblicos sobre matrimonio, amor y familia en la Biblia online.',
    references: [
      [0, 2, 24],
      [39, 19, 6],
      [48, 5, 25],
      [48, 5, 33],
      [45, 13, 4],
      [50, 3, 14],
      [19, 18, 22],
      [57, 13, 4],
    ],
  },
  {
    version: 'vdc',
    path: '/versete/dragoste',
    title: 'Versete despre dragoste | Biblia Online',
    description: 'Citeste versete biblice despre dragoste, credinta si viata crestina.',
    references: [
      [42, 3, 16],
      [45, 13, 4],
      [45, 13, 13],
      [61, 4, 8],
      [61, 4, 18],
      [44, 5, 8],
      [42, 13, 34],
      [42, 15, 13],
      [47, 5, 22],
      [50, 3, 14],
    ],
  },
  {
    version: 'vdc',
    path: '/versete/speranta',
    title: 'Versete despre speranta | Biblia Online',
    description: 'Gaseste versete biblice despre speranta pentru citire, meditatie si partajare.',
    references: [
      [23, 29, 11],
      [44, 15, 13],
      [44, 5, 5],
      [57, 11, 1],
      [18, 42, 11],
      [22, 40, 31],
      [24, 3, 24],
      [59, 1, 3],
    ],
  },
  {
    version: 'vdc',
    path: '/versete/credinta',
    title: 'Versete despre credinta | Biblia Online',
    description: 'Versete despre credinta in Biblia online, cu trimiteri rapide catre context.',
    references: [
      [57, 11, 1],
      [44, 10, 17],
      [48, 2, 8],
      [40, 11, 24],
      [39, 17, 20],
      [46, 5, 7],
      [58, 2, 17],
      [47, 2, 20],
    ],
  },
  {
    version: 'vdc',
    path: '/versete/casatorie',
    title: 'Versete despre casatorie | Biblia Online',
    description: 'Citeste versete biblice despre casatorie, familie si dragoste.',
    references: [
      [0, 2, 24],
      [39, 19, 6],
      [48, 5, 25],
      [48, 5, 33],
      [45, 13, 4],
      [50, 3, 14],
      [19, 18, 22],
      [57, 13, 4],
    ],
  },
];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function truncateText(text = '', maxLength = 160) {
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, maxLength - 1).trim()}...`;
}

function absoluteUrl(pathname = '/') {
  return new URL(pathname, SITE_URL).toString();
}

function replaceTag(html, matcher, replacement) {
  if (matcher.test(html)) {
    return html.replace(matcher, replacement);
  }

  return html.replace('</head>', `  ${replacement}\n  </head>`);
}

function setTitle(html, title) {
  return replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

function setMetaName(html, name, content) {
  const tag = `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}" />`;
  return replaceTag(html, new RegExp(`<meta\\b(?=[^>]*\\bname=["']${name}["'])[^>]*>`, 'i'), tag);
}

function setMetaProperty(html, property, content) {
  const tag = `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}" />`;
  return replaceTag(html, new RegExp(`<meta\\b(?=[^>]*\\bproperty=["']${property}["'])[^>]*>`, 'i'), tag);
}

function setCanonical(html, canonicalUrl) {
  const tag = `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`;
  return replaceTag(html, /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i, tag);
}

function setAlternates(html, alternates = []) {
  const links = alternates
    .map(
      (alternate) =>
        `<link rel="alternate" hreflang="${escapeHtml(alternate.hreflang)}" href="${escapeHtml(alternate.href)}" />`,
    )
    .join('\n    ');

  const withoutAlternates = html.replace(/\s*<link\b(?=[^>]*\brel=["']alternate["'])[^>]*>\s*/gi, '\n');
  return withoutAlternates.replace(/(<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>)/i, `$1\n    ${links}`);
}

function setSchema(html, schema) {
  const script = `<script type="application/ld+json" id="schema-org">${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>`;
  return replaceTag(
    html,
    /<script\b(?=[^>]*\bid=["']schema-org["'])(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/i,
    script,
  );
}

function setHtmlLang(html, lang) {
  return html.replace(/<html\b[^>]*>/i, `<html lang="${escapeHtml(lang)}">`);
}

function setAppContent(html, content) {
  return html.replace('<div id="app"></div>', `<div id="app">${content}</div>`);
}

function injectSeo(html, seo) {
  const canonicalUrl = absoluteUrl(seo.canonicalPath);
  const image = seo.image || DEFAULT_IMAGE;
  const imageWidth = seo.imageWidth || (image === DEFAULT_IMAGE ? '512' : '1200');
  const imageHeight = seo.imageHeight || (image === DEFAULT_IMAGE ? '512' : '630');

  let nextHtml = setHtmlLang(html, seo.locale);
  nextHtml = setTitle(nextHtml, seo.title);
  nextHtml = setMetaName(nextHtml, 'description', seo.description);
  nextHtml = setMetaName(nextHtml, 'robots', seo.robots || 'index, follow, max-image-preview:large');
  nextHtml = setCanonical(nextHtml, canonicalUrl);
  nextHtml = setAlternates(nextHtml, seo.alternates || []);
  nextHtml = setMetaProperty(nextHtml, 'og:locale', seo.ogLocale);
  nextHtml = setMetaProperty(nextHtml, 'og:type', seo.type || 'website');
  nextHtml = setMetaProperty(nextHtml, 'og:site_name', 'RoBible');
  nextHtml = setMetaProperty(nextHtml, 'og:title', seo.title);
  nextHtml = setMetaProperty(nextHtml, 'og:description', seo.description);
  nextHtml = setMetaProperty(nextHtml, 'og:url', canonicalUrl);
  nextHtml = setMetaProperty(nextHtml, 'og:image', image);
  nextHtml = setMetaProperty(nextHtml, 'og:image:width', imageWidth);
  nextHtml = setMetaProperty(nextHtml, 'og:image:height', imageHeight);
  nextHtml = setMetaProperty(nextHtml, 'og:image:alt', seo.imageAlt || seo.title);
  nextHtml = setMetaName(nextHtml, 'twitter:card', seo.twitterCard || 'summary');
  nextHtml = setMetaName(nextHtml, 'twitter:title', seo.title);
  nextHtml = setMetaName(nextHtml, 'twitter:description', seo.description);
  nextHtml = setMetaName(nextHtml, 'twitter:image', image);
  nextHtml = setSchema(nextHtml, seo.schema);
  if (seo.staticOnly) {
    nextHtml = nextHtml.replace(/\s*<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\/assets\/[^"']+["'])[^>]*><\/script>/i, '');
  }
  return setAppContent(nextHtml, seo.content);
}

async function writeRoute(pathname, html) {
  const filePath = path.join(DIST_DIR, `${pathname.replace(/^\/+/, '')}.html`);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, html);
}

function getWebsiteSchema(versionData) {
  return [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'RoBible',
      url: `${SITE_URL}/`,
      inLanguage: versionData.config.locale,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'RoBible',
      url: `${SITE_URL}/`,
      logo: DEFAULT_IMAGE,
    },
    {
      '@type': 'Book',
      '@id': `${SITE_URL}/#bible-${versionData.config.value}`,
      name: versionData.config.bibleName,
      alternateName: versionData.config.shortName,
      inLanguage: versionData.config.locale,
      isAccessibleForFree: true,
      url: `${SITE_URL}/`,
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ];
}

function getAlternates(versionDataList, { book, chapter, verse }) {
  if (book === null || book === undefined) {
    return [];
  }

  const alternates = versionDataList.map((versionData) => ({
    hreflang: versionData.config.hreflang,
    href: absoluteUrl(
      buildBiblePath({
        version: versionData.config.value,
        map: versionData.map,
        book,
        chapter,
        verse,
      }),
    ),
  }));

  return [...alternates, { hreflang: 'x-default', href: alternates[0]?.href || `${SITE_URL}/` }];
}

function getBookContent(versionData, book) {
  const bookName = versionData.map[book];
  const chapters = versionData.bible[book] || [];
  const chapterLinks = chapters
    .map(
      (_chapter, index) =>
        `<li><a href="${buildBiblePath({ version: versionData.config.value, map: versionData.map, book, chapter: index + 1 })}">${escapeHtml(
          `${versionData.config.chapterLabel} ${index + 1}`,
        )}</a></li>`,
    )
    .join('');

  return `<article class="seo-prerender">
    <nav><a href="/">RoBible</a> / <span>${escapeHtml(versionData.config.bibleName)}</span></nav>
    <h1>${escapeHtml(bookName)} - ${escapeHtml(versionData.config.bibleName)}</h1>
    <p>${escapeHtml(versionData.config.seo.bookDescription(bookName, versionData.config.bibleName))}</p>
    <ol>${chapterLinks}</ol>
  </article>`;
}

function getChapterContent(versionData, book, chapter) {
  const bookName = versionData.map[book];
  const verses = versionData.bible[book]?.[chapter - 1] || [];
  const verseLinks = verses
    .map(
      (text, index) =>
        `<p id="v${index + 1}"><a href="${buildBiblePath({
          version: versionData.config.value,
          map: versionData.map,
          book,
          chapter,
          verse: index + 1,
        })}">${index + 1}</a>. ${escapeHtml(text)}</p>`,
    )
    .join('');

  return `<article class="seo-prerender">
    <nav>
      <a href="/">RoBible</a> /
      <a href="${buildBiblePath({ version: versionData.config.value, map: versionData.map, book })}">${escapeHtml(bookName)}</a>
    </nav>
    <h1>${escapeHtml(`${bookName} ${chapter}`)}</h1>
    <p>${escapeHtml(versionData.config.seo.chapterDescription(bookName, chapter, versionData.config.bibleName))}</p>
    ${verseLinks}
  </article>`;
}

function getAdjacentVerse(versionData, book, chapter, verse, direction) {
  let nextBook = book;
  let nextChapterIndex = chapter - 1;
  let nextVerseIndex = verse - 1 + direction;

  while (nextBook >= 0 && nextBook < versionData.bible.length) {
    const chapterList = versionData.bible[nextBook] || [];

    while (nextChapterIndex >= 0 && nextChapterIndex < chapterList.length) {
      const verseList = chapterList[nextChapterIndex] || [];

      if (nextVerseIndex >= 0 && nextVerseIndex < verseList.length) {
        return {
          book: nextBook,
          chapter: nextChapterIndex + 1,
          verse: nextVerseIndex + 1,
        };
      }

      nextChapterIndex += direction;
      nextVerseIndex = direction > 0 ? 0 : (chapterList[nextChapterIndex]?.length || 0) - 1;
    }

    nextBook += direction;
    nextChapterIndex = direction > 0 ? 0 : (versionData.bible[nextBook]?.length || 0) - 1;
    nextVerseIndex = direction > 0 ? 0 : (versionData.bible[nextBook]?.[nextChapterIndex]?.length || 0) - 1;
  }

  return null;
}

function getVerseLink(versionData, target, label) {
  if (!target) {
    return '';
  }

  const bookName = versionData.map[target.book];
  return `<a href="${buildBiblePath({
    version: versionData.config.value,
    map: versionData.map,
    book: target.book,
    chapter: target.chapter,
    verse: target.verse,
  })}">${escapeHtml(label || `${bookName} ${target.chapter}:${target.verse}`)}</a>`;
}

function getVerseContent(versionData, versionDataList, book, chapter, verse) {
  const bookName = versionData.map[book];
  const text = versionData.bible[book]?.[chapter - 1]?.[verse - 1] || '';
  const previous = getAdjacentVerse(versionData, book, chapter, verse, -1);
  const next = getAdjacentVerse(versionData, book, chapter, verse, 1);
  const versionLinks = versionDataList
    .filter((item) => item.config.value !== versionData.config.value)
    .map((item) => {
      const otherText = item.bible[book]?.[chapter - 1]?.[verse - 1];

      if (!otherText) {
        return '';
      }

      return `<li><a href="${buildBiblePath({
        version: item.config.value,
        map: item.map,
        book,
        chapter,
        verse,
      })}">${escapeHtml(item.config.bibleName)}</a></li>`;
    })
    .filter(Boolean)
    .join('');

  return `<article class="seo-prerender">
    <nav>
      <a href="/">RoBible</a> /
      <a href="${buildBiblePath({ version: versionData.config.value, map: versionData.map, book })}">${escapeHtml(bookName)}</a> /
      <a href="${buildBiblePath({ version: versionData.config.value, map: versionData.map, book, chapter })}">${escapeHtml(
        `${versionData.config.chapterLabel} ${chapter}`,
      )}</a>
    </nav>
    <h1>${escapeHtml(`${bookName} ${chapter}:${verse}`)}</h1>
    <blockquote>${escapeHtml(text)}</blockquote>
    <p>${escapeHtml(versionData.config.bibleName)}</p>
    <nav>
      ${getVerseLink(versionData, previous, 'Anterior')}
      ${getVerseLink(versionData, next, 'Siguiente')}
    </nav>
    ${versionLinks ? `<h2>Otras versiones</h2><ul>${versionLinks}</ul>` : ''}
  </article>`;
}

function getBreadcrumbSchema(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.href,
    })),
  };
}

function getSitemapUrlXml(item) {
  return `  <url>
    <loc>${escapeHtml(item.loc)}</loc>
    <lastmod>${escapeHtml(item.lastmod || TODAY)}</lastmod>
    <changefreq>${escapeHtml(item.changefreq || 'monthly')}</changefreq>
    <priority>${escapeHtml(item.priority || '0.6')}</priority>
  </url>`;
}

async function writeSitemap(fileName, urls) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(getSitemapUrlXml).join('\n')}
</urlset>
`;
  const filePath = path.join(DIST_DIR, fileName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, xml);
}

async function writeSitemapIndex(entries) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <sitemap>
    <loc>${escapeHtml(absoluteUrl(entry))}</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>
`;

  await writeFile(path.join(DIST_DIR, 'sitemap.xml'), xml);
}

function getTopicMatches(versionData, topic) {
  if (Array.isArray(topic.references)) {
    return topic.references
      .map(([book, chapter, verse]) => ({
        book,
        chapter,
        verse,
        text: versionData.bible[book]?.[chapter - 1]?.[verse - 1] || '',
      }))
      .filter((match) => match.text);
  }

  const keywords = topic.keywords || [];
  const normalizedKeywords = keywords.map(normalize);
  const matches = [];

  versionData.bible.forEach((chapters, book) => {
    chapters.forEach((verses, chapterIndex) => {
      verses.forEach((text, verseIndex) => {
        const normalizedText = normalize(text);

        if (normalizedKeywords.some((keyword) => normalizedText.includes(keyword))) {
          matches.push({
            book,
            chapter: chapterIndex + 1,
            verse: verseIndex + 1,
            text,
          });
        }
      });
    });
  });

  return matches.slice(0, 80);
}

function getTopicContent(versionData, topic, matches) {
  const items = matches
    .map((match) => {
      const reference = `${versionData.map[match.book]} ${match.chapter}:${match.verse}`;
      const href = buildBiblePath({
        version: versionData.config.value,
        map: versionData.map,
        book: match.book,
        chapter: match.chapter,
        verse: match.verse,
      });

      return `<li><a href="${href}">${escapeHtml(reference)}</a><p>${escapeHtml(match.text)}</p></li>`;
    })
    .join('');

  return `<article class="seo-prerender">
    <nav><a href="/">RoBible</a> / <span>${escapeHtml(topic.title)}</span></nav>
    <h1>${escapeHtml(topic.title.replace(' | Biblia Online', ''))}</h1>
    <p>${escapeHtml(topic.description)}</p>
    <ol>${items}</ol>
  </article>`;
}

async function loadVersionData() {
  return Promise.all(
    BIBLE_VERSIONS.map(async (config) => {
      const [map, bible] = await Promise.all([
        readFile(path.join(DATA_DIR, config.value, 'bible.map.json'), 'utf8').then(JSON.parse),
        readFile(path.join(DATA_DIR, config.value, 'bible.json'), 'utf8').then(JSON.parse),
      ]);

      return { config, map, bible };
    }),
  );
}

async function main() {
  const indexHtml = await readFile(path.join(DIST_DIR, 'index.html'), 'utf8');
  const versionDataList = await loadVersionData();
  const bookUrls = [];
  const chapterUrls = [];
  const verseUrls = [];
  const topicUrls = [];

  for (const versionData of versionDataList) {
    for (const book of versionData.map.all || []) {
      const bookName = versionData.map[book];
      const bookPath = buildBiblePath({ version: versionData.config.value, map: versionData.map, book });
      const bookDescription = versionData.config.seo.bookDescription(bookName, versionData.config.bibleName);
      const bookSchema = {
        '@context': 'https://schema.org',
        '@graph': [
          ...getWebsiteSchema(versionData),
          {
            '@type': 'Book',
            name: `${bookName} - ${versionData.config.bibleName}`,
            isPartOf: { '@id': `${SITE_URL}/#bible-${versionData.config.value}` },
            inLanguage: versionData.config.locale,
            description: bookDescription,
            url: absoluteUrl(bookPath),
          },
          getBreadcrumbSchema([
            { name: 'RoBible', href: `${SITE_URL}/` },
            { name: versionData.config.bibleName, href: `${SITE_URL}/` },
            { name: bookName, href: absoluteUrl(bookPath) },
          ]),
        ],
      };

      await writeRoute(
        bookPath,
        injectSeo(indexHtml, {
          locale: versionData.config.locale,
          ogLocale: versionData.config.ogLocale,
          title: versionData.config.seo.bookTitle(bookName, versionData.config.bibleName),
          description: bookDescription,
          canonicalPath: bookPath,
          type: 'article',
          alternates: getAlternates(versionDataList, { book }),
          schema: bookSchema,
          content: getBookContent(versionData, book),
        }),
      );
      bookUrls.push({ loc: absoluteUrl(bookPath), lastmod: TODAY, priority: '0.8' });

      const chapters = versionData.bible[book] || [];

      for (const [chapterIndex, verses] of chapters.entries()) {
        const chapter = chapterIndex + 1;
        const reference = `${bookName} ${chapter}`;
        const chapterPath = buildBiblePath({ version: versionData.config.value, map: versionData.map, book, chapter });
        const chapterDescription = versionData.config.seo.chapterDescription(
          bookName,
          chapter,
          versionData.config.bibleName,
        );
        const chapterSchema = {
          '@context': 'https://schema.org',
          '@graph': [
            ...getWebsiteSchema(versionData),
            {
              '@type': 'Chapter',
              name: reference,
              isPartOf: { '@id': `${SITE_URL}/#bible-${versionData.config.value}` },
              inLanguage: versionData.config.locale,
              description: chapterDescription,
              url: absoluteUrl(chapterPath),
            },
            getBreadcrumbSchema([
              { name: 'RoBible', href: `${SITE_URL}/` },
              { name: bookName, href: absoluteUrl(bookPath) },
              { name: `${versionData.config.chapterLabel} ${chapter}`, href: absoluteUrl(chapterPath) },
            ]),
          ],
        };

        await writeRoute(
          chapterPath,
          injectSeo(indexHtml, {
            locale: versionData.config.locale,
            ogLocale: versionData.config.ogLocale,
            title: versionData.config.seo.chapterTitle(reference, versionData.config.bibleName),
            description: chapterDescription,
            canonicalPath: chapterPath,
            type: 'article',
            alternates: getAlternates(versionDataList, { book, chapter }),
            schema: chapterSchema,
            content: getChapterContent(versionData, book, chapter),
          }),
        );
        chapterUrls.push({ loc: absoluteUrl(chapterPath), lastmod: TODAY, priority: '0.7' });

        for (const [verseIndex, text] of verses.entries()) {
          const verse = verseIndex + 1;
          const versePath = buildBiblePath({
            version: versionData.config.value,
            map: versionData.map,
            book,
            chapter,
            verse,
          });
          const verseReference = `${bookName} ${chapter}:${verse}`;
          const verseDescription = `${truncateText(text, 150)} (${versionData.config.bibleName})`;
          const ogImage = absoluteUrl(`/og/verse/${versionData.config.value}/${book}/${chapter}/${verse}.svg`);
          const verseSchema = {
            '@context': 'https://schema.org',
            '@graph': [
              ...getWebsiteSchema(versionData),
              {
                '@type': 'CreativeWork',
                name: verseReference,
                text,
                isPartOf: { '@id': `${SITE_URL}/#bible-${versionData.config.value}` },
                inLanguage: versionData.config.locale,
                description: verseDescription,
                url: absoluteUrl(versePath),
              },
              getBreadcrumbSchema([
                { name: 'RoBible', href: `${SITE_URL}/` },
                { name: bookName, href: absoluteUrl(bookPath) },
                { name: `${versionData.config.chapterLabel} ${chapter}`, href: absoluteUrl(chapterPath) },
                { name: verseReference, href: absoluteUrl(versePath) },
              ]),
            ],
          };

          await writeRoute(
            versePath,
            injectSeo(indexHtml, {
              locale: versionData.config.locale,
              ogLocale: versionData.config.ogLocale,
              title: `${verseReference} | ${versionData.config.bibleName}`,
              description: verseDescription,
              canonicalPath: versePath,
              type: 'article',
              image: ogImage,
              imageAlt: verseReference,
              twitterCard: 'summary_large_image',
              alternates: getAlternates(versionDataList, { book, chapter, verse }),
              schema: verseSchema,
              content: getVerseContent(versionData, versionDataList, book, chapter, verse),
            }),
          );
          verseUrls.push({ loc: absoluteUrl(versePath), lastmod: TODAY, priority: '0.6' });
        }
      }
    }
  }

  for (const topic of TOPICS) {
    const versionData = versionDataList.find((item) => item.config.value === topic.version);

    if (!versionData) {
      continue;
    }

    const matches = getTopicMatches(versionData, topic);
    const topicSchema = {
      '@context': 'https://schema.org',
      '@graph': [
        ...getWebsiteSchema(versionData),
        {
          '@type': 'CollectionPage',
          name: topic.title.replace(' | Biblia Online', ''),
          description: topic.description,
          inLanguage: versionData.config.locale,
          url: absoluteUrl(topic.path),
          hasPart: matches.slice(0, 20).map((match) => ({
            '@type': 'CreativeWork',
            name: `${versionData.map[match.book]} ${match.chapter}:${match.verse}`,
            text: match.text,
            url: absoluteUrl(
              buildBiblePath({
                version: versionData.config.value,
                map: versionData.map,
                book: match.book,
                chapter: match.chapter,
                verse: match.verse,
              }),
            ),
          })),
        },
      ],
    };

    await writeRoute(
      topic.path,
      injectSeo(indexHtml, {
        locale: versionData.config.locale,
        ogLocale: versionData.config.ogLocale,
        title: topic.title,
        description: topic.description,
        canonicalPath: topic.path,
        type: 'website',
        schema: topicSchema,
        staticOnly: true,
        content: getTopicContent(versionData, topic, matches),
      }),
    );
    topicUrls.push({ loc: absoluteUrl(topic.path), lastmod: TODAY, priority: '0.7' });
  }

  await writeSitemap('sitemaps/books.xml', bookUrls);
  await writeSitemap('sitemaps/chapters.xml', chapterUrls);
  await writeSitemap('sitemaps/topics.xml', topicUrls);

  const verseSitemapEntries = [];
  for (let index = 0; index < verseUrls.length; index += SITEMAP_CHUNK_SIZE) {
    const chunkIndex = Math.floor(index / SITEMAP_CHUNK_SIZE) + 1;
    const sitemapPath = `sitemaps/verses-${chunkIndex}.xml`;
    await writeSitemap(sitemapPath, verseUrls.slice(index, index + SITEMAP_CHUNK_SIZE));
    verseSitemapEntries.push(`/${sitemapPath}`);
  }

  await writeSitemapIndex(['/sitemaps/books.xml', '/sitemaps/chapters.xml', '/sitemaps/topics.xml', ...verseSitemapEntries]);

  console.log(
    `Generated SEO pages: ${bookUrls.length} books, ${chapterUrls.length} chapters, ${verseUrls.length} verses, ${topicUrls.length} topics.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
