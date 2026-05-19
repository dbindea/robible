import { DEFAULT_VERSION, SEO_TEXT, SITE_URL, SUPPORTED_LOCALES } from '../config/seo';

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

function updateAlternates(canonicalPath) {
  document.head.querySelectorAll('link[data-seo-alternate="true"]').forEach((element) => element.remove());

  SUPPORTED_LOCALES.filter((locale) => !locale.future).forEach((locale) => {
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
  title = SEO_TEXT.homeTitle,
  description = SEO_TEXT.homeDescription,
  canonicalPath = '/',
  robots = 'index, follow, max-image-preview:large',
  type = 'website',
  schema = [],
} = {}) {
  const canonicalUrl = absoluteUrl(canonicalPath);

  document.documentElement.lang = DEFAULT_VERSION.language;
  document.title = title;

  setMeta('meta[name="description"]', { name: 'description', content: description });
  setMeta('meta[name="robots"]', { name: 'robots', content: robots });
  setLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });
  updateAlternates(canonicalPath);

  setMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'ro_RO' });
  setMeta('meta[property="og:type"]', { property: 'og:type', content: type });
  setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'RoBible' });
  setMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  setMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  setMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
  setMeta('meta[property="og:image"]', { property: 'og:image', content: DEFAULT_IMAGE });
  setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
  setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
  setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });

  setStructuredData({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'RoBible',
        url: `${SITE_URL}/`,
        inLanguage: DEFAULT_VERSION.language,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Book',
        '@id': `${SITE_URL}/#bible-cornilescu`,
        name: DEFAULT_VERSION.name,
        alternateName: DEFAULT_VERSION.shortName,
        inLanguage: DEFAULT_VERSION.language,
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

export function buildCurrentBibleSeo({ searchForm = {}, map = {} }) {
  const selectedBook = Array.isArray(searchForm.book) ? searchForm.book[0] : null;
  const selectedChapter = Array.isArray(searchForm.chapter) ? searchForm.chapter[0] : null;
  const searchText = searchForm.searchText?.trim();
  const bookName = selectedBook !== null && selectedBook !== undefined ? map[selectedBook] : null;

  if (searchText) {
    return {
      title: `Caută „${searchText}” în Biblia Cornilescu | RoBible`,
      description: SEO_TEXT.searchDescription(searchText),
      robots: 'noindex, follow',
      type: 'website',
      schema: [
        {
          '@type': 'SearchResultsPage',
          name: `Rezultate pentru ${searchText}`,
          description: SEO_TEXT.searchDescription(searchText),
          isPartOf: { '@id': `${SITE_URL}/#website` },
        },
      ],
    };
  }

  if (bookName && selectedChapter !== null && selectedChapter !== undefined) {
    const chapter = Number(selectedChapter) + 1;
    const reference = `${bookName} ${chapter}`;

    return {
      title: `${reference} | Biblia Dumitru Cornilescu`,
      description: SEO_TEXT.chapterDescription(bookName, chapter),
      type: 'article',
      schema: [
        {
          '@type': 'Chapter',
          name: reference,
          isPartOf: { '@id': `${SITE_URL}/#bible-cornilescu` },
          inLanguage: DEFAULT_VERSION.language,
          description: SEO_TEXT.chapterDescription(bookName, chapter),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'RoBible', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: DEFAULT_VERSION.name, item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 3, name: bookName },
            { '@type': 'ListItem', position: 4, name: `Capitolul ${chapter}` },
          ],
        },
      ],
    };
  }

  if (bookName) {
    return {
      title: `${bookName} | Biblia Dumitru Cornilescu Online`,
      description: SEO_TEXT.bookDescription(bookName),
      type: 'article',
      schema: [
        {
          '@type': 'Book',
          name: `${bookName} - ${DEFAULT_VERSION.name}`,
          isPartOf: { '@id': `${SITE_URL}/#bible-cornilescu` },
          inLanguage: DEFAULT_VERSION.language,
          description: SEO_TEXT.bookDescription(bookName),
        },
      ],
    };
  }

  return {
    title: SEO_TEXT.homeTitle,
    description: SEO_TEXT.homeDescription,
  };
}
