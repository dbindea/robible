// Genera public/data/curated-topics.json: las colecciones de versículos que
// cura RoBible, frente a las que publica cada usuario.
//
// Por qué un JSON estático y no D1: esto es contenido editorial, no datos de
// nadie. Cambia cada muchos meses, tiene que poder indexarse y tiene que
// funcionar sin conexión — exactamente el mismo caso que daily-verses.json. En
// la base de datos habría que servirlo en cada visita y el service worker no
// podría precachearlo.
//
// Por qué un script y no escribirlo a mano: las referencias hay que validarlas
// contra TODAS las versiones instaladas. Una que exista en la Cornilescu pero
// se salga del rango en la española dejaría un hueco en la página, y el fallo
// se descubriría meses después.
//
// Los textos van aquí y no en public/lang/: son contenido, no interfaz. La
// diferencia práctica es quién los toca — las traducciones de la interfaz se
// mueven con el código; estas colecciones se editan cuando se añade un tema.
//
// Uso: node scripts/build-curated-topics.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { TOPIC_ICONS } from '../src/config/topic-icons.js';

const RAIZ = path.join(import.meta.dirname, '..');
const DIR_DATA = path.join(RAIZ, 'public', 'data');
const SALIDA = path.join(DIR_DATA, 'curated-topics.json');

// `icon` tiene que ser una de las claves de src/config/topic-icons.js: son las
// mismas que están guardadas en D1 y las únicas que Icon.svelte sabe dibujar.
const TEMAS = [
  {
    slug: 'anxietate',
    icon: 'peace',
    color: '#2E7D9B',
    names: {
      ro: 'Versete despre anxietate și frică',
      es: 'Versículos sobre la ansiedad y el miedo',
      en: 'Verses about anxiety and fear',
      zh: '关于焦虑与惧怕的经文',
    },
    intros: {
      ro: 'Pentru nopțile în care gândurile nu se opresc. Nu sunt versete care sting frica dintr-o dată, ci care spun cui poți duce grija în timp ce încă o simți.',
      es: 'Para las noches en que los pensamientos no paran. No son versículos que apaguen el miedo de golpe, sino que dicen a quién llevarle la preocupación mientras todavía la sientes.',
      en: 'For the nights when the thoughts will not stop. These are not verses that switch fear off; they say who to bring the worry to while you still feel it.',
      zh: '献给思绪不肯停歇的夜晚。这些经文不会一下子驱散惧怕，而是告诉你，在仍然忧虑时可以把重担交给谁。',
    },
    verses: [[49, 4, 6], [49, 4, 7], [59, 5, 7], [22, 41, 10], [18, 55, 22], [42, 14, 27], [18, 94, 19], [19, 12, 25], [39, 6, 34]],
  },
  {
    slug: 'mangaiere',
    icon: 'dove',
    color: '#5BA89E',
    names: {
      ro: 'Versete de mângâiere în doliu',
      es: 'Versículos de consuelo en el duelo',
      en: 'Verses of comfort in grief',
      zh: '哀伤中得安慰的经文',
    },
    intros: {
      ro: 'Când cineva drag a plecat și cuvintele nu ajung. Se citesc la înmormântare, dar mai ales în zilele de după, când casa e goală.',
      es: 'Cuando alguien querido se ha ido y las palabras no alcanzan. Se leen en el funeral, pero sobre todo en los días de después, cuando la casa se queda vacía.',
      en: 'When someone you love has gone and words fall short. They are read at the funeral, but above all in the days after, when the house is empty.',
      zh: '当所爱的人离去、言语不足以承载时。它们在葬礼上被诵读，但更多是在此后的日子里，当家中空荡时。',
    },
    verses: [[18, 34, 18], [39, 5, 4], [46, 1, 3], [46, 1, 4], [65, 21, 4], [42, 11, 25], [18, 23, 4], [51, 4, 13]],
  },
  {
    slug: 'nadejde',
    icon: 'crown',
    color: '#D4A853',
    names: {
      ro: 'Versete despre nădejde în încercări',
      es: 'Versículos sobre la esperanza en la prueba',
      en: 'Verses about hope in trials',
      zh: '在试炼中盼望的经文',
    },
    intros: {
      ro: 'Pentru vremea în care nu vezi capătul. Nădejdea din Scriptură nu e optimism: e încrederea că Cel care a promis nu Se răzgândește.',
      es: 'Para cuando no se ve el final. La esperanza de la Escritura no es optimismo: es la confianza en que quien prometió no cambia de idea.',
      en: 'For when you cannot see the end. Hope in Scripture is not optimism: it is trusting that the one who promised does not change his mind.',
      zh: '献给看不见尽头的时候。圣经中的盼望不是乐观，而是相信那位应许的必不改变心意。',
    },
    verses: [[44, 15, 13], [23, 29, 11], [22, 40, 31], [44, 8, 28], [24, 3, 22], [24, 3, 23], [57, 11, 1], [18, 42, 11]],
  },
  {
    slug: 'iertare',
    icon: 'cross',
    color: '#8C6BB1',
    names: {
      ro: 'Versete despre iertare',
      es: 'Versículos sobre el perdón',
      en: 'Verses about forgiveness',
      zh: '关于赦免与饶恕的经文',
    },
    intros: {
      ro: 'Iertarea primită și iertarea dată — Scriptura le leagă mereu una de alta. Aici sunt amândouă.',
      es: 'El perdón recibido y el perdón dado: la Escritura los ata siempre el uno al otro. Aquí están los dos.',
      en: 'Forgiveness received and forgiveness given — Scripture always ties the two together. Both are here.',
      zh: '得着的赦免与给出的饶恕——圣经总是把二者相连。这里两者都有。',
    },
    verses: [[61, 1, 9], [48, 4, 32], [39, 6, 14], [50, 3, 13], [18, 103, 12], [22, 1, 18], [32, 7, 18]],
  },
  {
    slug: 'calauzire',
    icon: 'light',
    color: '#C97B4A',
    names: {
      ro: 'Versete despre călăuzire în decizii',
      es: 'Versículos sobre la guía en las decisiones',
      en: 'Verses about guidance in decisions',
      zh: '关于在抉择中蒙引导的经文',
    },
    intros: {
      ro: 'Când ai două drumuri în față și niciunul nu e limpede. Scriptura promite lumină pentru pasul următor, nu harta întreagă.',
      es: 'Cuando tienes dos caminos delante y ninguno está claro. La Escritura promete luz para el paso siguiente, no el mapa entero.',
      en: 'When two roads lie ahead and neither is clear. Scripture promises light for the next step, not the whole map.',
      zh: '当前面有两条路而都不清晰时。圣经应许的是下一步的亮光，而非整幅地图。',
    },
    verses: [[19, 3, 5], [19, 3, 6], [18, 32, 8], [18, 119, 105], [58, 1, 5], [22, 30, 21], [42, 16, 13]],
  },
  {
    slug: 'multumire',
    icon: 'hands',
    color: '#5B8C5A',
    names: {
      ro: 'Versete despre mulțumire',
      es: 'Versículos sobre la gratitud',
      en: 'Verses about thankfulness',
      zh: '关于感恩的经文',
    },
    intros: {
      ro: 'Mulțumirea din Scriptură nu depinde de cum merg lucrurile. De aceea apare cel mai des exact în scrisorile scrise din închisoare.',
      es: 'La gratitud de la Escritura no depende de cómo vayan las cosas. Por eso aparece más veces justo en las cartas escritas desde la cárcel.',
      en: 'Thankfulness in Scripture does not depend on how things are going. That is why it turns up most often in the letters written from prison.',
      zh: '圣经中的感恩并不取决于境遇如何。正因如此，它最常出现在狱中所写的书信里。',
    },
    verses: [[51, 5, 18], [18, 100, 4], [50, 3, 15], [18, 107, 1], [49, 4, 19], [48, 5, 20]],
  },

  // ── Las cuatro heredadas ──────────────────────────────────────────────────
  //
  // Estos cuatro slugs existían antes como páginas estáticas sueltas dentro de
  // scripts/generate-seo.mjs (la constante TOPICS), con el título y la
  // descripción escritos allí mismo, en un solo idioma y sin la aplicación
  // detrás. Eran la versión primitiva de esto.
  //
  // **La URL no cambia y los versículos son exactamente los mismos**: llevan
  // tiempo indexadas y romperlas sería tirar lo que ya está posicionado. Lo que
  // ganan al pasar por aquí es la presentación en cuatro idiomas, el texto en la
  // versión que el lector tenga activa y los enlaces al resto de colecciones.
  //
  // Las cuatro hermanas en español (/versiculos/*) siguen en TOPICS: aquel
  // prefijo no lo sirve esta ruta, y moverlas exigiría un segundo camino.
  {
    slug: 'dragoste',
    icon: 'heart',
    color: '#C05C7E',
    names: {
      ro: 'Versete despre dragoste',
      es: 'Versículos sobre el amor',
      en: 'Verses about love',
      zh: '关于爱的经文',
    },
    intros: {
      ro: 'Dragostea din Scriptură se descrie prin ce face, nu prin ce simte. De aceea aproape toate versetele de aici sunt verbe.',
      es: 'El amor de la Escritura se describe por lo que hace, no por lo que siente. Por eso casi todos estos versículos son verbos.',
      en: 'Love in Scripture is described by what it does, not by what it feels. That is why nearly every verse here is a verb.',
      zh: '圣经中的爱是以行为来描述的，而非感受。因此这里几乎每一节经文都是动词。',
    },
    verses: [[42, 3, 16], [45, 13, 4], [45, 13, 13], [61, 4, 8], [61, 4, 18], [44, 5, 8], [42, 13, 34], [42, 15, 13], [47, 5, 22], [50, 3, 14]],
  },
  {
    slug: 'speranta',
    icon: 'sun',
    color: '#E0A040',
    names: {
      ro: 'Versete despre speranță',
      es: 'Versículos sobre la esperanza',
      en: 'Verses about hope',
      zh: '关于盼望的经文',
    },
    intros: {
      ro: 'Promisiuni de citit rar și de ținut minte des. Dacă treci printr-o încercare anume, vezi și colecția despre nădejde în încercări.',
      es: 'Promesas para leer despacio y recordar a menudo. Si estás pasando una prueba concreta, mira también la colección sobre la esperanza en la prueba.',
      en: 'Promises to read slowly and remember often. If you are going through a particular trial, see also the collection on hope in trials.',
      zh: '值得慢读、常记的应许。若你正经历某种试炼，也可参看「在试炼中盼望」的专辑。',
    },
    verses: [[23, 29, 11], [44, 15, 13], [44, 5, 5], [57, 11, 1], [18, 42, 11], [22, 40, 31], [24, 3, 24], [59, 1, 3]],
  },
  {
    slug: 'credinta',
    icon: 'shield',
    color: '#4A7BA7',
    names: {
      ro: 'Versete despre credință',
      es: 'Versículos sobre la fe',
      en: 'Verses about faith',
      zh: '关于信心的经文',
    },
    intros: {
      ro: 'Ce este credința, de unde vine și cum se vede. Textele clasice, cu trimitere la contextul lor.',
      es: 'Qué es la fe, de dónde viene y cómo se nota. Los textos clásicos, con enlace a su contexto.',
      en: 'What faith is, where it comes from and how it shows. The classic texts, each linked to its context.',
      zh: '信心是什么、从何而来、如何显明。经典经文，各附上下文链接。',
    },
    verses: [[57, 11, 1], [44, 10, 17], [48, 2, 8], [40, 11, 24], [39, 17, 20], [46, 5, 7], [58, 2, 17], [47, 2, 20]],
  },
  {
    slug: 'casatorie',
    icon: 'home',
    color: '#9B6B9E',
    names: {
      ro: 'Versete despre căsătorie',
      es: 'Versículos sobre el matrimonio',
      en: 'Verses about marriage',
      zh: '关于婚姻的经文',
    },
    intros: {
      ro: 'De la Geneza la Evrei: ce spune Scriptura despre legământul dintre soț și soție. Se citesc la cununie, dar sunt scrise pentru toate zilele de după.',
      es: 'Del Génesis a Hebreos: lo que dice la Escritura sobre el pacto entre marido y mujer. Se leen en la boda, pero están escritos para todos los días siguientes.',
      en: 'From Genesis to Hebrews: what Scripture says about the covenant between husband and wife. They are read at the wedding, but written for all the days after.',
      zh: '从创世记到希伯来书：圣经论到丈夫与妻子之间的盟约。它们在婚礼上被诵读，却是为此后的每一天而写。',
    },
    verses: [[0, 2, 24], [39, 19, 6], [48, 5, 25], [48, 5, 33], [45, 13, 4], [50, 3, 14], [19, 18, 22], [57, 13, 4]],
  },
];

// ── Validación contra todas las Biblias instaladas ────────────────────────

const versiones = readdirSync(DIR_DATA, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(path.join(DIR_DATA, e.name, 'bible.json')))
  .map((e) => e.name);

if (!versiones.length) {
  console.error('No hay ninguna Biblia en public/data/. Nada que validar.');
  process.exit(1);
}

const biblias = Object.fromEntries(
  versiones.map((v) => [v, JSON.parse(readFileSync(path.join(DIR_DATA, v, 'bible.json'), 'utf8'))]),
);

const problemas = [];
const slugsVistos = new Set();

const ICONOS = new Set(TOPIC_ICONS.map((i) => i.key));

for (const tema of TEMAS) {
  if (slugsVistos.has(tema.slug)) problemas.push(`slug repetido: ${tema.slug}`);
  slugsVistos.add(tema.slug);

  // Un icono inventado no rompe nada: `resolveTopicIcon` lo cambia en silencio
  // por el marcador. Justo por eso hay que cazarlo aquí — si no, la colección
  // sale publicada con el icono de otra cosa y nadie se entera.
  if (!ICONOS.has(tema.icon)) problemas.push(`${tema.slug}: icono desconocido '${tema.icon}'`);

  for (const idioma of ['ro', 'es', 'en', 'zh']) {
    if (!tema.names?.[idioma]) problemas.push(`${tema.slug}: falta name.${idioma}`);
    if (!tema.intros?.[idioma]) problemas.push(`${tema.slug}: falta intro.${idioma}`);
  }

  for (const [libro, capitulo, versiculo] of tema.verses) {
    for (const v of versiones) {
      const texto = biblias[v]?.[libro]?.[capitulo - 1]?.[versiculo - 1];
      if (!texto) problemas.push(`${tema.slug}: ${libro}/${capitulo}/${versiculo} no existe en ${v}`);
    }
  }
}

if (problemas.length) {
  console.error(`${problemas.length} problema(s):`);
  for (const p of problemas) console.error('  -', p);
  process.exit(1);
}

const salida = {
  version: 1,
  topics: TEMAS.map((t) => ({
    slug: t.slug,
    icon: t.icon,
    color: t.color,
    names: t.names,
    intros: t.intros,
    verses: t.verses.map(([book, chapter, verse]) => ({ book, chapter, verse })),
  })),
};

writeFileSync(SALIDA, `${JSON.stringify(salida)}\n`, 'utf8');

const total = TEMAS.reduce((n, t) => n + t.verses.length, 0);
console.log(
  `curated-topics.json: ${TEMAS.length} temas, ${total} versículos, validados contra ${versiones.join(', ')}.`,
);
