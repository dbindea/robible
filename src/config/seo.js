export const SITE_URL = 'https://robible.com';

export const DEFAULT_VERSION = {
  id: 'vdc',
  slug: 'biblia-dumitru-cornilescu',
  shortName: 'Cornilescu VDC',
  name: 'Biblia Dumitru Cornilescu',
  language: 'ro',
};

export const SUPPORTED_LOCALES = [
  {
    id: 'ro',
    hreflang: 'ro',
    label: 'Romana',
    pathPrefix: '',
  },
  {
    id: 'es',
    hreflang: 'es',
    label: 'Espanol',
    pathPrefix: '/es',
    future: true,
  },
];

export const SEO_TEXT = {
  homeTitle: 'Biblia Dumitru Cornilescu Online | RoBible',
  homeDescription:
    'Citește Biblia Dumitru Cornilescu online, într-o experiență rapidă, curată și ușor de folosit. Găsește imediat cărți, capitole și versete în limba română.',
  readingDescription:
    'RoBible îți oferă o lectură biblică limpede și modernă, cu acces rapid la Scriptură, căutare intuitivă și o interfață gândită pentru studiu zilnic.',
  bookDescription: (bookName) =>
    `Citește cartea ${bookName} din Biblia Dumitru Cornilescu online, într-un format curat, rapid și prietenos pentru studiu, rugăciune și aprofundarea Scripturii.`,
  chapterDescription: (bookName, chapter) =>
    `Citește ${bookName}, capitolul ${chapter}, în traducerea Dumitru Cornilescu. Parcurge versetele online într-o experiență clară, rapidă și optimizată pentru orice dispozitiv.`,
  searchDescription: (query) =>
    `Caută „${query}” în Biblia Dumitru Cornilescu și descoperă rapid versetele relevante, cu rezultate clare și acces instant la contextul biblic în limba română.`,
  futureComparisonDescription:
    'Compară versiuni și traduceri biblice într-o experiență modernă, construită pentru citire atentă, studiu comparativ și explorarea Scripturii în mai multe limbi.',
  onlineReadingDescription:
    'Citește Biblia online gratuit, cu navigare rapidă prin cărți, capitole și versete, într-un spațiu digital calm, accesibil și optimizat pentru lectură profundă.',
  verseDescription: (reference) =>
    `Meditează asupra versetului ${reference} din Biblia Dumitru Cornilescu, cu acces rapid la text, context și lectură online în limba română.`,
};

export const SEO_ROUTES = {
  home: '/',
  version: (version = DEFAULT_VERSION) => `/${version.language}/${version.slug}`,
  book: (bookSlug, version = DEFAULT_VERSION) => `/${version.language}/${version.slug}/${bookSlug}`,
  chapter: (bookSlug, chapter, version = DEFAULT_VERSION) =>
    `/${version.language}/${version.slug}/${bookSlug}/${chapter}`,
  search: (version = DEFAULT_VERSION) => `/${version.language}/${version.slug}/cautare`,
  compare: (version = DEFAULT_VERSION) => `/${version.language}/${version.slug}/compara`,
};
