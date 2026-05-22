export const DEFAULT_BIBLE_VERSION = 'vdc';

export const BIBLE_VERSIONS = [
  {
    value: 'vdc',
    label: 'Română',
    locale: 'ro',
    ogLocale: 'ro_RO',
    hreflang: 'ro',
    slug: 'biblia-romana',
    pathPrefix: '',
    searchPath: 'cautare',
    comparePath: 'compara',
    bibleName: 'Biblia Română',
    shortName: 'Biblia Română',
    chapterLabel: 'Capitolul',
    searchResultsLabel: 'Rezultate pentru',
    seo: {
      homeTitle: 'Biblia Română Online | RoBible',
      homeDescription:
        'Citește Biblia Română online, într-o experiență rapidă, curată și ușor de folosit. Găsește imediat cărți, capitole și versete.',
      searchTitle: (query, bibleName) => `Caută „${query}” în ${bibleName} | RoBible`,
      searchDescription: (query, bibleName) =>
        `Caută „${query}” în ${bibleName} și descoperă rapid versetele relevante, cu rezultate clare și acces instant la contextul biblic.`,
      bookTitle: (bookName, bibleName) => `${bookName} | ${bibleName} Online`,
      bookDescription: (bookName, bibleName) =>
        `Citește cartea ${bookName} din ${bibleName} online, într-un format curat, rapid și prietenos pentru studiu, rugăciune și aprofundarea Scripturii.`,
      chapterTitle: (reference, bibleName) => `${reference} | ${bibleName}`,
      chapterDescription: (bookName, chapter, bibleName) =>
        `Citește ${bookName}, capitolul ${chapter}, în ${bibleName}. Parcurge versetele online într-o experiență clară, rapidă și optimizată pentru orice dispozitiv.`,
      readingDescription:
        'RoBible îți oferă o lectură biblică limpede, cu acces rapid la Scriptură, căutare intuitivă și o interfață gândită pentru studiu zilnic.',
      onlineReadingDescription:
        'Citește Biblia online gratuit, cu navigare rapidă prin cărți, capitole și versete, într-o pagină accesibilă și optimizată pentru o lectură atentă.',
      verseDescription: (reference, bibleName) =>
        `Meditează asupra versetului ${reference} din ${bibleName}, cu acces rapid la text, context și lectură online.`,
    },
  },
  {
    value: 'rvl',
    label: 'Español',
    locale: 'es',
    ogLocale: 'es_ES',
    hreflang: 'es',
    slug: 'biblia-espanol',
    pathPrefix: '',
    searchPath: 'buscar',
    comparePath: 'comparar',
    bibleName: 'Biblia Español',
    shortName: 'Biblia Español',
    chapterLabel: 'Capítulo',
    searchResultsLabel: 'Resultados para',
    seo: {
      homeTitle: 'Biblia Español Online | RoBible',
      homeDescription:
        'Lee la Biblia Español online en una experiencia rápida, limpia y fácil de usar. Encuentra libros, capítulos y versículos al instante.',
      searchTitle: (query, bibleName) => `Busca “${query}” en ${bibleName} | RoBible`,
      searchDescription: (query, bibleName) =>
        `Busca “${query}” en ${bibleName} y encuentra rápidamente versículos relevantes, con resultados claros y acceso directo al contexto bíblico.`,
      bookTitle: (bookName, bibleName) => `${bookName} | ${bibleName} Online`,
      bookDescription: (bookName, bibleName) =>
        `Lee el libro de ${bookName} en ${bibleName} online, en un formato limpio, rápido y cómodo para lectura, oración y estudio bíblico.`,
      chapterTitle: (reference, bibleName) => `${reference} | ${bibleName}`,
      chapterDescription: (bookName, chapter, bibleName) =>
        `Lee ${bookName}, capítulo ${chapter}, en ${bibleName}. Recorre los versículos online en una experiencia clara, rápida y optimizada para cualquier dispositivo.`,
      readingDescription:
        'RoBible ofrece una lectura bíblica clara, con acceso rápido a la Escritura, búsqueda intuitiva y una interfaz pensada para el estudio diario.',
      onlineReadingDescription:
        'Lee la Biblia online gratis, con navegación rápida por libros, capítulos y versículos, en una página accesible y optimizada para una lectura atenta.',
      verseDescription: (reference, bibleName) =>
        `Medita en el versículo ${reference} de ${bibleName}, con acceso rápido al texto, al contexto y a la lectura online.`,
    },
  },
];

export const getBibleVersionConfig = (value) => {
  return BIBLE_VERSIONS.find((version) => version.value === value) || null;
};

export const getBibleVersionConfigOrDefault = (value) => {
  return getBibleVersionConfig(value) || getBibleVersionConfig(DEFAULT_BIBLE_VERSION);
};
