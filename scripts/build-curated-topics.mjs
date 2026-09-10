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

  // ── Bloque 2: doctrina y vida cristiana (10 sep 2026) ───────────────────
  //
  // Los temas de aquí abajo se eligieron mirando qué busca la gente en sitios
  // de consulta bíblica. Varios son **doctrinalmente cargados** —divorțul,
  // recăsătorirea, cina Domnului, cele două judecăți, botezul cu Duhul—: la
  // selección se ha hecho recogiendo los pasajes que la propia Escritura dedica
  // al asunto, sin añadir glosa. La introducción sitúa el tema y dice de qué
  // habla el bloque; no resuelve la discusión, porque no es su sitio.
  {
    slug: 'vindecare',
    icon: 'heart',
    color: '#5BA89E',
    names: {
      ro: 'Versete despre vindecare',
      es: 'Versículos sobre la sanación',
      en: 'Verses about healing',
      zh: '关于医治的经文',
    },
    intros: {
      ro: 'De la Exod la Iacov: ce spune Scriptura despre Dumnezeu care vindecă trupul și sufletul. Nu promit că boala trece azi; spun cine este Cel la care se duce boala.',
      es: 'Del Éxodo a Santiago: lo que dice la Escritura sobre el Dios que sana el cuerpo y el alma. No prometen que la enfermedad pase hoy; dicen a quién se le lleva la enfermedad.',
      en: 'From Exodus to James: what Scripture says about the God who heals body and soul. They do not promise the illness will pass today; they say who the illness is brought to.',
      zh: '从出埃及记到雅各书：圣经论到医治身体与心灵的神。它们并不应许疾病今日就离去，而是指明该把疾病带到谁面前。',
    },
    verses: [[1, 15, 26], [18, 103, 2], [18, 103, 3], [22, 53, 5], [23, 17, 14], [39, 4, 23], [58, 5, 14], [58, 5, 15], [59, 2, 24]],
  },
  {
    slug: 'divort',
    icon: 'home',
    color: '#8B6F9E',
    names: {
      ro: 'Versete despre divorț',
      es: 'Versículos sobre el divorcio',
      en: 'Verses about divorce',
      zh: '关于离婚的经文',
    },
    intros: {
      ro: 'Pasajele în care Scriptura vorbește direct despre despărțirea soților: cuvântul lui Maleahi, răspunsul lui Isus fariseilor și îndrumarea lui Pavel către Corint. Sunt puse cap la cap ca să poată fi citite împreună.',
      es: 'Los pasajes en que la Escritura habla directamente de la separación de los esposos: la palabra de Malaquías, la respuesta de Jesús a los fariseos y la instrucción de Pablo a Corinto. Están puestos juntos para poder leerse seguidos.',
      en: 'The passages where Scripture speaks directly about the parting of husband and wife: Malachi’s word, Jesus’ answer to the Pharisees and Paul’s instruction to Corinth. Gathered so they can be read together.',
      zh: '圣经中直接论到夫妻分离的经文：玛拉基的话、耶稣对法利赛人的回答，以及保罗给哥林多教会的教导。放在一处，好能连着读。',
    },
    verses: [[38, 2, 16], [39, 5, 31], [39, 5, 32], [39, 19, 6], [39, 19, 8], [39, 19, 9], [40, 10, 9], [45, 7, 10], [45, 7, 11], [45, 7, 15]],
  },
  {
    slug: 'recasatorire',
    icon: 'home',
    color: '#A67C52',
    names: {
      ro: 'Versete despre recăsătorire',
      es: 'Versículos sobre volver a casarse',
      en: 'Verses about remarriage',
      zh: '关于再婚的经文',
    },
    intros: {
      ro: 'Ce spun Evangheliile și epistolele despre a te căsători din nou — după divorț și după moartea soțului. Sunt pasajele pe care se sprijină discuția, adunate ca să fie citite în întregime, nu pe frânturi.',
      es: 'Lo que dicen los Evangelios y las epístolas sobre volver a casarse: tras el divorcio y tras la muerte del cónyuge. Son los pasajes en que se apoya la discusión, reunidos para leerse enteros y no a trozos.',
      en: 'What the Gospels and the epistles say about marrying again — after divorce and after the death of a spouse. These are the passages the discussion rests on, gathered to be read whole rather than in fragments.',
      zh: '福音书与书信论到再次结婚：离婚之后，以及配偶去世之后。这些是讨论所依据的经文，收在一起，好完整地读，而不是断章取义。',
    },
    verses: [[39, 19, 9], [40, 10, 11], [40, 10, 12], [41, 16, 18], [44, 7, 2], [44, 7, 3], [45, 7, 8], [45, 7, 9], [45, 7, 39]],
  },
  {
    slug: 'cina-domnului',
    icon: 'cross',
    color: '#9E4A52',
    names: {
      ro: 'Versete despre Cina Domnului',
      es: 'Versículos sobre la Cena del Señor',
      en: 'Verses about the Lord’s Supper',
      zh: '关于主的晚餐的经文',
    },
    intros: {
      ro: 'Cele patru relatări ale așezării Cinei și îndrumarea lui Pavel despre cum se ia. Se citesc înainte de masa Domnului, dar sunt scrise ca să se înțeleagă ce se face acolo.',
      es: 'Los relatos de la institución de la Cena y la instrucción de Pablo sobre cómo se toma. Se leen antes de la mesa del Señor, pero están escritos para que se entienda qué se hace en ella.',
      en: 'The accounts of the institution of the Supper and Paul’s instruction on how it is taken. They are read before the Lord’s table, but written so that what happens there is understood.',
      zh: '设立主餐的记载，以及保罗论到当如何领受的教导。它们在主的筵席前被诵读，却是为叫人明白那里所行的是什么而写。',
    },
    verses: [[39, 26, 26], [39, 26, 27], [39, 26, 28], [41, 22, 19], [41, 22, 20], [45, 10, 16], [45, 11, 23], [45, 11, 24], [45, 11, 26], [45, 11, 28]],
  },
  {
    slug: 'minunile-lui-isus',
    icon: 'light',
    color: '#D4A853',
    names: {
      ro: 'Versete despre minunile lui Isus',
      es: 'Versículos sobre los milagros de Jesús',
      en: 'Verses about the miracles of Jesus',
      zh: '关于耶稣神迹的经文',
    },
    intros: {
      ro: 'Apa făcută vin, furtuna oprită, orbul care vede, Lazăr chemat afară din mormânt. Ioan le numește semne, și spune limpede de ce au fost scrise.',
      es: 'El agua hecha vino, la tormenta calmada, el ciego que ve, Lázaro llamado fuera del sepulcro. Juan las llama señales, y dice con claridad para qué fueron escritas.',
      en: 'Water made wine, the storm stilled, the blind man seeing, Lazarus called out of the tomb. John calls them signs, and says plainly why they were written down.',
      zh: '水变成酒、风浪平静、瞎子看见、拉撒路从坟墓里被叫出来。约翰称这些为神迹，并明说记载下来是为了什么。',
    },
    verses: [[42, 2, 11], [39, 8, 26], [40, 5, 41], [40, 5, 42], [41, 7, 14], [41, 7, 15], [42, 9, 6], [42, 9, 7], [42, 11, 43], [42, 20, 31]],
  },
  {
    slug: 'judecata-credinciosilor',
    icon: 'crown',
    color: '#2E7D9B',
    names: {
      ro: 'Versete despre judecata credincioșilor',
      es: 'Versículos sobre el juicio de los creyentes',
      en: 'Verses about the judgment of believers',
      zh: '关于信徒受审的经文',
    },
    intros: {
      ro: 'Scaunul de judecată al lui Hristos, unde nu se hotărăște mântuirea, ci se cântărește lucrarea fiecăruia. Pavel îi scrie despre el unei biserici care se certa pe cine e mai mare.',
      es: 'El tribunal de Cristo, donde no se decide la salvación sino que se pesa la obra de cada uno. Pablo le escribe sobre él a una iglesia que discutía quién era mayor.',
      en: 'The judgment seat of Christ, where salvation is not decided but each one’s work is weighed. Paul writes of it to a church that was arguing over who was greater.',
      zh: '基督的审判台：在那里所定的不是得救与否，而是各人的工程受察验。保罗把这事写给一间正在争论谁为大的教会。',
    },
    verses: [[44, 14, 10], [44, 14, 12], [45, 3, 11], [45, 3, 12], [45, 3, 13], [45, 3, 14], [45, 3, 15], [45, 4, 5], [46, 5, 10]],
  },
  {
    slug: 'judecata-de-apoi',
    icon: 'flame',
    color: '#7A4A4A',
    names: {
      ro: 'Versete despre judecata de apoi',
      es: 'Versículos sobre el juicio final',
      en: 'Verses about the final judgment',
      zh: '关于末日审判的经文',
    },
    intros: {
      ro: 'Ziua în care se deschid cărțile și se judecă toată lumea. De la Eclesiastul până la Apocalipsa, pasajele care vorbesc despre ea fără să o îndulcească.',
      es: 'El día en que se abren los libros y todo el mundo es juzgado. Del Eclesiastés al Apocalipsis, los pasajes que hablan de él sin endulzarlo.',
      en: 'The day when the books are opened and the whole world is judged. From Ecclesiastes to Revelation, the passages that speak of it without softening it.',
      zh: '案卷展开、全世界受审的那一日。从传道书到启示录，直言此事而不加粉饰的经文。',
    },
    verses: [[20, 12, 14], [39, 25, 31], [39, 25, 32], [39, 25, 46], [42, 5, 28], [42, 5, 29], [43, 17, 31], [57, 9, 27], [65, 20, 12], [65, 20, 15]],
  },
  {
    slug: 'botezul-cu-duhul-sfant',
    icon: 'flame',
    color: '#D4761E',
    names: {
      ro: 'Versete despre botezul cu Duhul Sfânt',
      es: 'Versículos sobre el bautismo en el Espíritu Santo',
      en: 'Verses about the baptism in the Holy Spirit',
      zh: '关于圣灵的洗的经文',
    },
    intros: {
      ro: 'Făgăduința lui Ioan Botezătorul, porunca lui Isus de a aștepta la Ierusalim și ce s-a întâmplat apoi — la Rusalii, în casa lui Corneliu și la Efes.',
      es: 'La promesa de Juan el Bautista, el mandato de Jesús de esperar en Jerusalén y lo que ocurrió después: en Pentecostés, en casa de Cornelio y en Éfeso.',
      en: 'John the Baptist’s promise, Jesus’ command to wait in Jerusalem, and what happened next — at Pentecost, in Cornelius’ house and at Ephesus.',
      zh: '施洗约翰的应许、耶稣吩咐在耶路撒冷等候，以及随后所发生的事——五旬节、哥尼流家中，以及以弗所。',
    },
    verses: [[39, 3, 11], [41, 24, 49], [43, 1, 5], [43, 1, 8], [43, 2, 4], [43, 10, 44], [43, 10, 45], [43, 19, 6], [45, 12, 13]],
  },
  {
    slug: 'intelepciune',
    icon: 'light',
    color: '#4A7C59',
    names: {
      ro: 'Versete despre înțelepciune',
      es: 'Versículos sobre la sabiduría',
      en: 'Verses about wisdom',
      zh: '关于智慧的经文',
    },
    intros: {
      ro: 'Proverbele o numesc lucrul cel mai de preț, și spun de unde începe. Iacov adaugă ce se face când îți lipsește: se cere, și se dă fără mustrare.',
      es: 'Los Proverbios la llaman lo más valioso, y dicen dónde empieza. Santiago añade qué hacer cuando falta: se pide, y se da sin reproche.',
      en: 'Proverbs calls it the most precious thing, and says where it begins. James adds what to do when it is lacking: ask, and it is given without reproach.',
      zh: '箴言称智慧为至宝，并说明它从何而始。雅各又补上一句：若缺少智慧，只管求，就必得着，且不受责备。',
    },
    verses: [[19, 1, 7], [19, 2, 6], [19, 3, 5], [19, 3, 6], [19, 4, 7], [19, 9, 10], [20, 7, 12], [58, 1, 5], [58, 3, 17]],
  },
  {
    slug: 'bogatie',
    icon: 'bookmark',
    color: '#A67C52',
    names: {
      ro: 'Versete despre bogăție și bani',
      es: 'Versículos sobre la riqueza y el dinero',
      en: 'Verses about wealth and money',
      zh: '关于财富与钱财的经文',
    },
    intros: {
      ro: 'Scriptura nu spune că banii sunt răi; spune ce se întâmplă cu omul care îi iubește. De la Proverbe la Pavel, unde se strânge comoara și cui slujește inima.',
      es: 'La Escritura no dice que el dinero sea malo; dice qué le ocurre a quien lo ama. De Proverbios a Pablo: dónde se acumula el tesoro y a quién sirve el corazón.',
      en: 'Scripture does not say money is evil; it says what happens to the one who loves it. From Proverbs to Paul: where the treasure is stored and whom the heart serves.',
      zh: '圣经并未说钱财本身是恶的，而是说贪爱钱财的人会落到何地。从箴言到保罗：财宝积在何处，心又服事谁。',
    },
    verses: [[19, 11, 28], [19, 13, 11], [19, 22, 7], [20, 5, 10], [39, 6, 19], [39, 6, 20], [39, 6, 24], [53, 6, 9], [53, 6, 10], [57, 13, 5]],
  },
  {
    slug: 'pocainta',
    icon: 'cross',
    color: '#8B5E5E',
    names: {
      ro: 'Versete despre pocăință',
      es: 'Versículos sobre el arrepentimiento',
      en: 'Verses about repentance',
      zh: '关于悔改的经文',
    },
    intros: {
      ro: 'Nu părerea de rău care trece până seara, ci întoarcerea. Ce cere Scriptura, ce făgăduiește celui care se întoarce și ce se întâmplă cu păcatul mărturisit.',
      es: 'No la pena que se pasa por la noche, sino la vuelta atrás. Qué pide la Escritura, qué promete al que vuelve y qué ocurre con el pecado confesado.',
      en: 'Not the regret that passes by evening, but the turning back. What Scripture asks, what it promises the one who returns, and what becomes of confessed sin.',
      zh: '不是入夜便消散的懊悔，而是回转。圣经所要求的、向回转之人所应许的，以及所认之罪的结局。',
    },
    verses: [[13, 7, 14], [18, 51, 10], [18, 51, 17], [22, 55, 7], [25, 18, 30], [39, 4, 17], [43, 3, 19], [46, 7, 10], [61, 1, 9]],
  },
  {
    slug: 'rugaciunea',
    icon: 'hands',
    color: '#2E7D9B',
    names: {
      ro: 'Versete despre rugăciune',
      es: 'Versículos sobre la oración',
      en: 'Verses about prayer',
      zh: '关于祷告的经文',
    },
    intros: {
      ro: 'Unde se roagă, cum se roagă, și ce se face când răspunsul întârzie. Isus a învățat mai întâi ce să nu faci, și abia apoi ce să spui.',
      es: 'Dónde se ora, cómo se ora, y qué hacer cuando la respuesta tarda. Jesús enseñó primero qué no hacer, y solo después qué decir.',
      en: 'Where to pray, how to pray, and what to do when the answer is slow. Jesus taught first what not to do, and only then what to say.',
      zh: '在哪里祷告、怎样祷告，以及当回应迟延时当如何。耶稣先教导不可怎样做，然后才教导该说什么。',
    },
    verses: [[39, 6, 6], [39, 6, 9], [39, 7, 7], [40, 11, 24], [41, 18, 1], [49, 4, 6], [51, 5, 17], [58, 5, 16], [61, 5, 14]],
  },
  {
    slug: 'postul',
    icon: 'flame',
    color: '#7A6A9E',
    names: {
      ro: 'Versete despre post',
      es: 'Versículos sobre el ayuno',
      en: 'Verses about fasting',
      zh: '关于禁食的经文',
    },
    intros: {
      ro: 'Isaia spune ce fel de post alege Dumnezeu, Isus spune cum se ține fără să se vadă, iar Faptele arată biserica postind înainte de fiecare hotărâre grea.',
      es: 'Isaías dice qué ayuno escoge Dios, Jesús dice cómo se guarda sin que se note, y Hechos muestra a la iglesia ayunando antes de cada decisión difícil.',
      en: 'Isaiah says which fast God chooses, Jesus says how to keep it without it showing, and Acts shows the church fasting before every hard decision.',
      zh: '以赛亚说明神所拣选的是怎样的禁食，耶稣说明当如何不叫人看出来，使徒行传则显明教会在每个艰难的决定之前禁食。',
    },
    verses: [[22, 58, 6], [28, 2, 12], [39, 6, 16], [39, 6, 17], [39, 6, 18], [39, 9, 15], [43, 13, 2], [43, 14, 23]],
  },
  {
    slug: 'nasterea-din-nou',
    icon: 'sun',
    color: '#4A9E7C',
    names: {
      ro: 'Versete despre nașterea din nou',
      es: 'Versículos sobre el nuevo nacimiento',
      en: 'Verses about being born again',
      zh: '关于重生的经文',
    },
    intros: {
      ro: 'Noaptea în care Nicodim a venit la Isus și a auzit că trebuie să se nască a doua oară. Ce înseamnă, cine o face și ce se schimbă după.',
      es: 'La noche en que Nicodemo vino a Jesús y oyó que debía nacer de nuevo. Qué significa, quién lo hace y qué cambia después.',
      en: 'The night Nicodemus came to Jesus and heard that he must be born a second time. What it means, who does it, and what changes afterwards.',
      zh: '尼哥底母夜里来见耶稣，听见人必须重生。这是什么意思、由谁成就，以及此后有何改变。',
    },
    verses: [[42, 1, 12], [42, 1, 13], [42, 3, 3], [42, 3, 5], [42, 3, 6], [46, 5, 17], [55, 3, 5], [59, 1, 23], [61, 5, 1]],
  },
  {
    slug: 'harul',
    icon: 'dove',
    color: '#5B8FA8',
    names: {
      ro: 'Versete despre har',
      es: 'Versículos sobre la gracia',
      en: 'Verses about grace',
      zh: '关于恩典的经文',
    },
    intros: {
      ro: 'Ce nu se câștigă și nu se plătește. Pavel se întoarce iar și iar la el, și îi scrie unei biserici care voia să adauge ceva de la ea.',
      es: 'Lo que no se gana ni se paga. Pablo vuelve a ella una y otra vez, y le escribe a una iglesia que quería añadir algo de su parte.',
      en: 'What is neither earned nor paid for. Paul returns to it again and again, writing to a church that wanted to add something of its own.',
      zh: '不能赚取、也无法偿付的。保罗一再回到这个题目，写给一间想要添上自己一分的教会。',
    },
    verses: [[44, 3, 24], [44, 5, 20], [44, 6, 14], [46, 12, 9], [48, 2, 8], [48, 2, 9], [55, 2, 11], [57, 4, 16], [59, 5, 10]],
  },
  {
    slug: 'neprihanirea-prin-credinta',
    icon: 'cross',
    color: '#3E6B8A',
    names: {
      ro: 'Versete despre neprihănirea prin credință',
      es: 'Versículos sobre la justificación por la fe',
      en: 'Verses about justification by faith',
      zh: '关于因信称义的经文',
    },
    intros: {
      ro: 'De la Avraam, care a crezut și i s-a socotit ca neprihănire, până la Pavel, care își întemeiază pe asta toată Epistola către Romani. Cel neprihănit va trăi prin credință.',
      es: 'Desde Abraham, que creyó y le fue contado por justicia, hasta Pablo, que funda en ello toda la carta a los Romanos. El justo por la fe vivirá.',
      en: 'From Abraham, who believed and had it counted to him as righteousness, to Paul, who builds the whole letter to the Romans on it. The just shall live by faith.',
      zh: '从亚伯拉罕因信被算为义，到保罗以此为整卷罗马书的根基。义人必因信得生。',
    },
    verses: [[0, 15, 6], [34, 2, 4], [44, 1, 17], [44, 3, 28], [44, 4, 5], [44, 5, 1], [47, 2, 16], [47, 3, 11], [49, 3, 9]],
  },
  {
    slug: 'duhul-sfant',
    icon: 'dove',
    color: '#6B9E8A',
    names: {
      ro: 'Versete despre Duhul Sfânt',
      es: 'Versículos sobre el Espíritu Santo',
      en: 'Verses about the Holy Spirit',
      zh: '关于圣灵的经文',
    },
    intros: {
      ro: 'Mângâietorul făgăduit de Isus în noaptea dinaintea crucii: cine este, ce face în cel credincios și cum se poate întrista.',
      es: 'El Consolador prometido por Jesús la noche antes de la cruz: quién es, qué hace en el creyente y cómo se le puede contristar.',
      en: 'The Comforter Jesus promised on the night before the cross: who he is, what he does in the believer, and how he can be grieved.',
      zh: '耶稣在十字架前夜所应许的保惠师：他是谁、在信徒里面做什么，以及人如何叫他担忧。',
    },
    verses: [[42, 14, 16], [42, 14, 17], [42, 14, 26], [42, 16, 13], [44, 8, 14], [44, 8, 26], [45, 6, 19], [48, 4, 30]],
  },
  {
    slug: 'roada-duhului',
    icon: 'heart',
    color: '#6BA85B',
    names: {
      ro: 'Versete despre roada Duhului',
      es: 'Versículos sobre el fruto del Espíritu',
      en: 'Verses about the fruit of the Spirit',
      zh: '关于圣灵果子的经文',
    },
    intros: {
      ro: 'Nu se fabrică, se face — ca rodul într-o viță care rămâne în butuc. Cele nouă din Galateni, plus ce spune Isus despre unde crește.',
      es: 'No se fabrica, se da — como el fruto en un sarmiento que permanece en la vid. Los nueve de Gálatas, más lo que dice Jesús sobre dónde crece.',
      en: 'It is not manufactured, it grows — like fruit on a branch that remains in the vine. The nine in Galatians, plus what Jesus says about where it grows.',
      zh: '果子不是造出来的，而是长出来的——如同枝子常在葡萄树上所结的。加拉太书所列的九样，以及耶稣论到它在何处生长。',
    },
    verses: [[47, 5, 22], [47, 5, 23], [47, 5, 24], [47, 5, 25], [42, 15, 5], [42, 15, 8], [39, 7, 17], [50, 1, 10]],
  },
  {
    slug: 'darurile-duhovnicesti',
    icon: 'crown',
    color: '#9E7C4A',
    names: {
      ro: 'Versete despre darurile duhovnicești',
      es: 'Versículos sobre los dones espirituales',
      en: 'Verses about spiritual gifts',
      zh: '关于属灵恩赐的经文',
    },
    intros: {
      ro: 'Feluri de daruri, dar același Duh. Pavel le înșiră de trei ori și de fiecare dată încheie la fel: nu pentru cel care le are, ci pentru trupul întreg.',
      es: 'Diversidad de dones, pero un mismo Espíritu. Pablo los enumera tres veces y siempre acaba igual: no para quien los tiene, sino para todo el cuerpo.',
      en: 'Different gifts, but the same Spirit. Paul lists them three times and always ends the same way: not for the one who has them, but for the whole body.',
      zh: '恩赐原有分别，圣灵却是一位。保罗三次列举，每次的结论都相同：不是为着领受的人，而是为着整个身体。',
    },
    verses: [[44, 12, 6], [44, 12, 7], [44, 12, 8], [45, 12, 4], [45, 12, 7], [45, 12, 11], [48, 4, 11], [48, 4, 12], [59, 4, 10]],
  },
  {
    slug: 'biserica',
    icon: 'home',
    color: '#4A7C9E',
    names: {
      ro: 'Versete despre biserică',
      es: 'Versículos sobre la iglesia',
      en: 'Verses about the church',
      zh: '关于教会的经文',
    },
    intros: {
      ro: 'Nu clădirea, ci trupul. Ce a spus Isus că va zidi, cum arăta biserica din Ierusalim în primele zile și de ce nu se lasă adunarea laolaltă.',
      es: 'No el edificio, sino el cuerpo. Lo que Jesús dijo que edificaría, cómo era la iglesia de Jerusalén en sus primeros días y por qué no se deja de congregarse.',
      en: 'Not the building, but the body. What Jesus said he would build, what the Jerusalem church looked like in its first days, and why the gathering is not forsaken.',
      zh: '不是建筑，而是身体。耶稣说他要建造的是什么、耶路撒冷教会起初的光景，以及为何不可停止聚会。',
    },
    verses: [[39, 16, 18], [39, 18, 20], [43, 2, 42], [43, 2, 47], [45, 12, 27], [48, 1, 22], [48, 4, 16], [50, 1, 18], [57, 10, 25]],
  },
  {
    slug: 'botezul-in-apa',
    icon: 'water',
    color: '#3E8FA8',
    names: {
      ro: 'Versete despre botezul în apă',
      es: 'Versículos sobre el bautismo en agua',
      en: 'Verses about water baptism',
      zh: '关于水洗的经文',
    },
    intros: {
      ro: 'Botezul lui Isus în Iordan, porunca dată ucenicilor și ce spune Pavel că înseamnă: îngropat împreună cu El, ca să umbli într-o viață nouă.',
      es: 'El bautismo de Jesús en el Jordán, el mandato dado a los discípulos y lo que Pablo dice que significa: sepultados con él, para andar en vida nueva.',
      en: 'Jesus’ baptism in the Jordan, the command given to the disciples, and what Paul says it means: buried with him, to walk in newness of life.',
      zh: '耶稣在约旦河受洗、他给门徒的吩咐，以及保罗所说的意义：与他一同埋葬，好叫我们行在新生的样式里。',
    },
    verses: [[39, 3, 16], [39, 28, 19], [43, 2, 38], [43, 8, 36], [43, 8, 38], [44, 6, 3], [44, 6, 4], [59, 3, 21]],
  },
  {
    slug: 'singuratate',
    icon: 'moon',
    color: '#6B7C9E',
    names: {
      ro: 'Versete despre singurătate',
      es: 'Versículos sobre la soledad',
      en: 'Verses about loneliness',
      zh: '关于孤单的经文',
    },
    intros: {
      ro: 'Prima dată când Dumnezeu a spus despre ceva că nu este bine, era despre un om singur. Versete pentru zilele în care casa e goală și telefonul tace.',
      es: 'La primera vez que Dios dijo de algo que no era bueno, fue de un hombre solo. Versículos para los días en que la casa está vacía y el teléfono calla.',
      en: 'The first time God said of anything that it was not good, it was of a man alone. Verses for the days when the house is empty and the phone stays quiet.',
      zh: '神第一次说某事「不好」，说的是人独居。这些经文是为屋子空荡、电话不响的日子预备的。',
    },
    verses: [[0, 2, 18], [4, 31, 6], [18, 25, 16], [18, 68, 6], [18, 139, 7], [18, 139, 9], [18, 139, 10], [39, 28, 20]],
  },
  {
    slug: 'descurajare',
    icon: 'moon',
    color: '#5E6B8B',
    names: {
      ro: 'Versete despre descurajare',
      es: 'Versículos sobre el desánimo',
      en: 'Verses about discouragement',
      zh: '关于灰心的经文',
    },
    intros: {
      ro: 'Psalmistul își vorbește singur: «Pentru ce te mâhnești, suflete?» Nu-și răspunde cu o încurajare, ci cu o îndreptare — nădăjduiește în Dumnezeu.',
      es: 'El salmista se habla a sí mismo: «¿Por qué te abates, alma mía?». No se responde con un ánimo, sino con una dirección: espera en Dios.',
      en: 'The psalmist speaks to himself: “Why art thou cast down, O my soul?” He answers not with encouragement but with a direction — hope thou in God.',
      zh: '诗人对自己说话：「我的心哪，你为何忧闷？」他给自己的答案不是打气，而是一个方向——当仰望神。',
    },
    verses: [[5, 1, 9], [18, 34, 18], [18, 42, 5], [18, 42, 11], [22, 40, 29], [22, 40, 31], [46, 4, 8], [46, 4, 9], [47, 6, 9]],
  },
  {
    slug: 'mania',
    icon: 'flame',
    color: '#A85B4A',
    names: {
      ro: 'Versete despre mânie',
      es: 'Versículos sobre la ira',
      en: 'Verses about anger',
      zh: '关于愤怒的经文',
    },
    intros: {
      ro: 'Scriptura nu spune că mânia e păcat; spune ce faci cu ea și cât o ții. Să nu apună soarele peste mânia voastră.',
      es: 'La Escritura no dice que la ira sea pecado; dice qué haces con ella y cuánto la retienes. No se ponga el sol sobre vuestro enojo.',
      en: 'Scripture does not say anger is sin; it says what you do with it and how long you hold it. Let not the sun go down upon your wrath.',
      zh: '圣经并未说愤怒本身是罪，而是说你如何处置它、又存留多久。不可含怒到日落。',
    },
    verses: [[19, 15, 1], [19, 16, 32], [19, 29, 11], [20, 7, 9], [39, 5, 22], [48, 4, 26], [48, 4, 31], [50, 3, 8], [58, 1, 19], [58, 1, 20]],
  },
  {
    slug: 'ispita',
    icon: 'shield',
    color: '#7C5E8B',
    names: {
      ro: 'Versete despre ispită',
      es: 'Versículos sobre la tentación',
      en: 'Verses about temptation',
      zh: '关于试探的经文',
    },
    intros: {
      ro: 'De unde vine, cine nu o trimite și ce a făgăduit Dumnezeu despre ea: nicio ispită peste puteri, și totdeauna o cale de scăpare.',
      es: 'De dónde viene, quién no la envía y qué ha prometido Dios acerca de ella: ninguna tentación por encima de las fuerzas, y siempre una salida.',
      en: 'Where it comes from, who does not send it, and what God has promised about it: no temptation beyond your strength, and always a way out.',
      zh: '试探从何而来、不是谁所发出的，以及神对此的应许：所受的试探不会超过所能承受的，且总有一条出路。',
    },
    verses: [[39, 4, 1], [39, 26, 41], [45, 10, 13], [47, 6, 1], [57, 2, 18], [57, 4, 15], [58, 1, 13], [58, 1, 14], [59, 5, 8]],
  },
  {
    slug: 'mandrie-si-smerenie',
    icon: 'crown',
    color: '#8B7C4A',
    names: {
      ro: 'Versete despre mândrie și smerenie',
      es: 'Versículos sobre el orgullo y la humildad',
      en: 'Verses about pride and humility',
      zh: '关于骄傲与谦卑的经文',
    },
    intros: {
      ro: 'Mândria merge înaintea pieirii — și smerenia înaintea slavei. Aceeași propoziție se repetă din Proverbe până la Petru, aproape cuvânt cu cuvânt.',
      es: 'La soberbia va delante de la ruina, y la humildad delante de la honra. La misma frase se repite de Proverbios a Pedro, casi palabra por palabra.',
      en: 'Pride goes before destruction, and humility before honour. The same sentence recurs from Proverbs to Peter, almost word for word.',
      zh: '骄傲在败坏以先，谦卑在尊荣以先。同一句话从箴言一直重复到彼得书信，几乎一字不差。',
    },
    verses: [[19, 11, 2], [19, 16, 18], [19, 22, 4], [32, 6, 8], [39, 23, 12], [41, 14, 11], [49, 2, 3], [58, 4, 6], [58, 4, 10], [59, 5, 5]],
  },
  {
    slug: 'munca',
    icon: 'bookmark',
    color: '#7C8B5E',
    names: {
      ro: 'Versete despre muncă',
      es: 'Versículos sobre el trabajo',
      en: 'Verses about work',
      zh: '关于工作的经文',
    },
    intros: {
      ro: 'Munca este de dinainte de căderea în păcat: omul a fost pus în grădină ca s-o lucreze. Ce spune Scriptura despre hărnicie, despre lene și pentru cine se lucrează de fapt.',
      es: 'El trabajo es anterior a la caída: el hombre fue puesto en el huerto para labrarlo. Lo que dice la Escritura sobre la diligencia, sobre la pereza y para quién se trabaja en realidad.',
      en: 'Work comes before the fall: man was put in the garden to till it. What Scripture says about diligence, about idleness, and whom the work is really for.',
      zh: '工作先于堕落：人被安置在园中，是要修理看守。圣经论到殷勤、论到懒惰，也论到人究竟是为谁作工。',
    },
    verses: [[0, 2, 15], [19, 6, 6], [19, 12, 11], [19, 14, 23], [20, 9, 10], [50, 3, 23], [50, 3, 24], [51, 4, 11], [52, 3, 10]],
  },
  {
    slug: 'cresterea-copiilor',
    icon: 'home',
    color: '#9E8B5B',
    names: {
      ro: 'Versete despre creșterea copiilor',
      es: 'Versículos sobre la crianza de los hijos',
      en: 'Verses about raising children',
      zh: '关于养育儿女的经文',
    },
    intros: {
      ro: 'Cuvintele să le spui copiilor tăi când șezi în casă și când mergi pe drum. Ce li se învață, cum se învață și ce se cere de la părinte în schimb.',
      es: 'Las palabras las dirás a tus hijos cuando estés en casa y cuando andes por el camino. Qué se les enseña, cómo se les enseña y qué se le pide al padre a cambio.',
      en: 'You shall speak these words to your children when you sit in your house and when you walk by the way. What is taught, how it is taught, and what is asked of the parent in return.',
      zh: '无论坐在家里、行在路上，都要把这些话教训你的儿女。教什么、怎样教，以及为父母的又当如何。',
    },
    verses: [[4, 6, 6], [4, 6, 7], [18, 127, 3], [19, 22, 6], [19, 29, 17], [48, 6, 1], [48, 6, 4], [50, 3, 21], [63, 1, 4]],
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
