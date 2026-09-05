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
    favoritesPath: 'favorites',
    notesPath: 'notes',
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
    favoritesPath: 'favorites',
    notesPath: 'notes',
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
  // Datos generados con `node scripts/build-bible-data.mjs en_kjv`.
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
    favoritesPath: 'favorites',
    notesPath: 'notes',
    bibleName: 'King James Version',
    shortName: 'KJV',
    chapterLabel: 'Chapter',
    searchResultsLabel: 'Results for',
    available: true,
    seo: {
      homeTitle: 'King James Bible Online | RoBible',
      homeDescription:
        'Read the King James Bible online in a fast, clean and distraction-free reader. Find books, chapters and verses instantly.',
      searchTitle: (query, bibleName) => `Search “${query}” in the ${bibleName} | RoBible`,
      searchDescription: (query, bibleName) =>
        `Search “${query}” in the ${bibleName} and find the relevant verses straight away, with clear results and instant access to the surrounding passage.`,
      bookTitle: (bookName, bibleName) => `${bookName} | ${bibleName} Online`,
      bookDescription: (bookName, bibleName) =>
        `Read the book of ${bookName} in the ${bibleName} online, in a clean and fast format made for study, prayer and reflection.`,
      chapterTitle: (reference, bibleName) => `${reference} | ${bibleName}`,
      chapterDescription: (bookName, chapter, bibleName) =>
        `Read ${bookName} chapter ${chapter} in the ${bibleName}. Go through the verses online in a clear reading experience, on any device.`,
      readingDescription:
        'RoBible offers clear Bible reading, with fast access to Scripture, intuitive search and an interface built for daily study.',
      onlineReadingDescription:
        'Read the Bible online for free, with quick navigation through books, chapters and verses, on an accessible page made for careful reading.',
      verseDescription: (reference, bibleName) =>
        `Meditate on ${reference} in the ${bibleName}, with fast access to the text, its context and online reading.`,
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
    favoritesPath: 'favorites',
    notesPath: 'notes',
    bibleName: '中文圣经和合本',
    shortName: 'CUV',
    chapterLabel: '第',
    searchResultsLabel: '搜索结果',
    available: true,
    seo: {
      homeTitle: '中文圣经和合本 在线阅读 | RoBible',
      homeDescription: '在线阅读中文圣经和合本，界面简洁快速，可即时查找书卷、章节和经文。',
      searchTitle: (query, bibleName) => `在${bibleName}中搜索“${query}”| RoBible`,
      searchDescription: (query, bibleName) =>
        `在${bibleName}中搜索“${query}”，快速找到相关经文，结果清晰，并可直接查看上下文。`,
      bookTitle: (bookName, bibleName) => `${bookName} | ${bibleName} 在线阅读`,
      bookDescription: (bookName, bibleName) =>
        `在线阅读${bibleName}的${bookName}，版面简洁快速，适合研读、祷告与默想。`,
      chapterTitle: (reference, bibleName) => `${reference} | ${bibleName}`,
      chapterDescription: (bookName, chapter, bibleName) =>
        `阅读${bibleName}${bookName}第${chapter}章。在任何设备上都能清晰流畅地逐节阅读。`,
      readingDescription: 'RoBible 提供清晰的圣经阅读体验，快速查阅经文，搜索直观，界面专为每日研读而设计。',
      onlineReadingDescription: '免费在线阅读圣经，快速浏览书卷、章节与经文，页面简洁，便于专注阅读。',
      verseDescription: (reference, bibleName) => `默想${bibleName}中的${reference}，快速查看经文、上下文并在线阅读。`,
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
