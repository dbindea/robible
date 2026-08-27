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
    indexPath: 'indice',
    bibleName: 'Biblia Română',
    shortName: 'Biblia Română',
    chapterLabel: 'Capitolul',
    searchResultsLabel: 'Rezultate pentru',
    available: true,
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
    indexPath: 'indice',
    bibleName: 'Biblia Español',
    shortName: 'Biblia Español',
    chapterLabel: 'Capítulo',
    searchResultsLabel: 'Resultados para',
    available: true,
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
  // Placeholder para mostrar el concepto de multi-versión. Marcar `available: false` hasta que se carguen los datos.
  {
    value: 'en_kjv',
    label: 'English (KJV)',
    locale: 'en',
    ogLocale: 'en_US',
    hreflang: 'en',
    slug: 'english-kjv',
    pathPrefix: '',
    searchPath: 'search',
    comparePath: 'compare',
    indexPath: 'index',
    bibleName: 'King James Version',
    shortName: 'KJV',
    chapterLabel: 'Chapter',
    searchResultsLabel: 'Results for',
    available: false,
    seo: {
      homeTitle: 'King James Bible Online | RoBible',
      homeDescription: 'Read the KJV Bible online (coming soon).',
      searchTitle: (q) => `Search “${q}” | RoBible`,
      searchDescription: (q) => `Search results for “${q}”.`,
      bookTitle: (n) => `${n} | KJV`,
      bookDescription: (n) => `Read ${n} from the KJV.`,
      chapterTitle: (r) => `${r} | KJV`,
      chapterDescription: (n, c) => `Read ${n} chapter ${c} in the KJV.`,
      readingDescription: 'Read the KJV online.',
      onlineReadingDescription: 'Read the KJV online free.',
      verseDescription: (r) => `Meditate on ${r} in the KJV.`,
    },
  },
  {
    value: 'zh_cuv',
    label: '中文 (和合本)',
    locale: 'zh',
    ogLocale: 'zh_CN',
    hreflang: 'zh',
    slug: 'chinese-cuv',
    pathPrefix: '',
    searchPath: 'search',
    comparePath: 'compare',
    indexPath: 'index',
    bibleName: '中文圣经和合本',
    shortName: 'CUV',
    chapterLabel: '第',
    searchResultsLabel: '搜索结果',
    available: false,
    seo: {
      homeTitle: '中文圣经和合本 在线阅读 | RoBible',
      homeDescription: '阅读中文圣经和合本（即将推出）。',
      searchTitle: (q) => `搜索“${q}”| RoBible`,
      searchDescription: (q) => `搜索“${q}”的结果。`,
      bookTitle: (n) => `${n} | CUV`,
      bookDescription: (n) => `阅读${n}（CUV）。`,
      chapterTitle: (r) => `${r} | CUV`,
      chapterDescription: (n, c) => `阅读${n}第${c}章（CUV）。`,
      readingDescription: '在线阅读CUV。',
      onlineReadingDescription: '免费在线阅读CUV。',
      verseDescription: (r) => `默想${r}（CUV）。`,
    },
  },
];

export const getBibleVersionConfig = (value) => {
  return BIBLE_VERSIONS.find((version) => version.value === value) || null;
};

export const getBibleVersionConfigOrDefault = (value) => {
  return getBibleVersionConfig(value) || getBibleVersionConfig(DEFAULT_BIBLE_VERSION);
};

// Devuelve solo las versiones con datos disponibles (para compare picker)
export const getAvailableBibleVersions = () => {
  return BIBLE_VERSIONS.filter((v) => v.available);
};

// Devuelve el "compañero" por defecto para comparar con la versión dada
export const getDefaultCompareWith = (primaryValue) => {
  const available = getAvailableBibleVersions();
  const fallback = available.find((v) => v.value !== primaryValue) || available[0];
  return fallback?.value || null;
};
