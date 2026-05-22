import { DEFAULT_VERSION, SITE_URL, SUPPORTED_LOCALES } from '../config/seo';
import { getBibleVersionConfigOrDefault } from '../config/bible-versions';

const DEFAULT_IMAGE = `${SITE_URL}/assets/img/logo.svg`;

function absoluteUrl(path = '/') {
  return new URL(path, SITE_URL).toString();
}

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
}

function setLink(selector, attributes) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
}

function getBibleSchemaId(versionConfig) {
  return `${SITE_URL}/#bible-${versionConfig.value}`;
}

function updateAlternates(canonicalPath) {
  document.head.querySelectorAll('link[data-seo-alternate="true"]').forEach((element) => element.remove());

  SUPPORTED_LOCALES.forEach((locale) => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', locale.hreflang);
    link.setAttribute('href', absoluteUrl(`${locale.pathPrefix}${canonicalPath}`));
    link.setAttribute('data-seo-alternate', 'true');
    document.head.appendChild(link);
  });

  const defaultLink = document.createElement('link');
  defaultLink.setAttribute('rel', 'alternate');
  defaultLink.setAttribute('hreflang', 'x-default');
  defaultLink.setAttribute('href', absoluteUrl(canonicalPath));
  defaultLink.setAttribute('data-seo-alternate', 'true');
  document.head.appendChild(defaultLink);
}

function setStructuredData(data) {
  const script = document.getElementById('schema-org') || document.createElement('script');
  script.id = 'schema-org';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);

  if (!script.parentNode) {
    document.head.appendChild(script);
  }
}

export function applySeoMetadata({
  versionConfig = DEFAULT_VERSION,
  title,
  description,
  canonicalPath = '/',
  robots = 'index, follow, max-image-preview:large',
  type = 'website',
  schema = [],
} = {}) {
  const activeVersion = getBibleVersionConfigOrDefault(versionConfig?.value);
  const seoText = activeVersion.seo;
  const pageTitle = title || seoText.homeTitle;
  const pageDescription = description || seoText.homeDescription;
  const canonicalUrl = absoluteUrl(canonicalPath);

  document.documentElement.lang = activeVersion.locale;
  document.title = pageTitle;

  setMeta('meta[name="description"]', { name: 'description', content: pageDescription });
  setMeta('meta[name="robots"]', { name: 'robots', content: robots });
  setLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });
  updateAlternates(canonicalPath);

  setMeta('meta[property="og:locale"]', { property: 'og:locale', content: activeVersion.ogLocale });
  setMeta('meta[property="og:type"]', { property: 'og:type', content: type });
  setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'RoBible' });
  setMeta('meta[property="og:title"]', { property: 'og:title', content: pageTitle });
  setMeta('meta[property="og:description"]', { property: 'og:description', content: pageDescription });
  setMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
  setMeta('meta[property="og:image"]', { property: 'og:image', content: DEFAULT_IMAGE });
  setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
  setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: pageTitle });
  setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: pageDescription });

  setStructuredData({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'RoBible',
        url: `${SITE_URL}/`,
        inLanguage: activeVersion.locale,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Book',
        '@id': getBibleSchemaId(activeVersion),
        name: activeVersion.bibleName,
        alternateName: activeVersion.shortName,
        inLanguage: activeVersion.locale,
        isAccessibleForFree: true,
        url: `${SITE_URL}/`,
        publisher: {
          '@type': 'Organization',
          name: 'RoBible',
          url: `${SITE_URL}/`,
        },
      },
      ...schema,
    ],
  });
}

export function buildCurrentBibleSeo({
  searchForm = {},
  map = {},
  versionConfig = DEFAULT_VERSION,
  bibleName = versionConfig.bibleName,
}) {
  const activeVersion = getBibleVersionConfigOrDefault(versionConfig?.value);
  const seoText = activeVersion.seo;
  const activeBibleName = bibleName || activeVersion.bibleName;
  const selectedBook = Array.isArray(searchForm.book) ? searchForm.book[0] : null;
  const selectedChapter = Array.isArray(searchForm.chapter) ? searchForm.chapter[0] : null;
  const searchText = searchForm.searchText?.trim();
  const bookName = selectedBook !== null && selectedBook !== undefined ? map[selectedBook] : null;

  if (searchText) {
    return {
      versionConfig: activeVersion,
      title: seoText.searchTitle(searchText, activeBibleName),
      description: seoText.searchDescription(searchText, activeBibleName),
      robots: 'noindex, follow',
      type: 'website',
      schema: [
        {
          '@type': 'SearchResultsPage',
          name: `${activeVersion.searchResultsLabel} ${searchText}`,
          description: seoText.searchDescription(searchText, activeBibleName),
          isPartOf: { '@id': `${SITE_URL}/#website` },
        },
      ],
    };
  }

  if (bookName && selectedChapter !== null && selectedChapter !== undefined) {
    const chapter = Number(selectedChapter) + 1;
    const reference = `${bookName} ${chapter}`;

    return {
      versionConfig: activeVersion,
      title: seoText.chapterTitle(reference, activeBibleName),
      description: seoText.chapterDescription(bookName, chapter, activeBibleName),
      type: 'article',
      schema: [
        {
          '@type': 'Chapter',
          name: reference,
          isPartOf: { '@id': getBibleSchemaId(activeVersion) },
          inLanguage: activeVersion.locale,
          description: seoText.chapterDescription(bookName, chapter, activeBibleName),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'RoBible', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: activeBibleName, item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 3, name: bookName },
            { '@type': 'ListItem', position: 4, name: `${activeVersion.chapterLabel} ${chapter}` },
          ],
        },
      ],
    };
  }

  if (bookName) {
    return {
      versionConfig: activeVersion,
      title: seoText.bookTitle(bookName, activeBibleName),
      description: seoText.bookDescription(bookName, activeBibleName),
      type: 'article',
      schema: [
        {
          '@type': 'Book',
          name: `${bookName} - ${activeBibleName}`,
          isPartOf: { '@id': getBibleSchemaId(activeVersion) },
          inLanguage: activeVersion.locale,
          description: seoText.bookDescription(bookName, activeBibleName),
        },
      ],
    };
  }

  return {
    versionConfig: activeVersion,
    title: seoText.homeTitle,
    description: seoText.homeDescription,
  };
}
