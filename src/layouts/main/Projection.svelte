<script>
  /**
   * Modo Proyección (`/proiectie`).
   *
   * Para qué: poner versículos en la pantalla grande de la iglesia. Se lee a
   * diez o quince metros, de pie y con la luz de sala encendida, así que las
   * decisiones no son las de la aplicación normal:
   *
   * - **Un versículo por pantalla**, tan grande como quepa.
   * - **Capa propia a pantalla completa** (`fixed inset:0; z-index:200`), como
   *   el Modo Amvon y por el mismo motivo: el modo inmersivo esconde el cromo
   *   pero deja debajo swipe, iconos y player, y cualquiera de esos apareciendo
   *   delante de la congregación es justo lo que no puede pasar.
   *
   * **Hay DOS formas de proyectar, y esta pantalla hace los tres papeles:**
   *
   *   antesala  se elige qué proyectar
   *   local     la lámina tapa ESTA ventana — un portátil, o una tele conectada
   *             por HDMI en modo espejo
   *   remoto    la lámina va a una segunda ventana (`?ecran=1`) que se arrastra
   *             al proyector, y aquí queda la consola: el buscador sigue a mano
   *             para preparar el versículo siguiente sin cortar lo que se ve
   *
   * El modo remoto es el de la iglesia con dos monitores. Con una sola ventana
   * era imposible: proyectar significaba tapar el portátil, y para buscar otro
   * versículo había que salir de la proyección delante de todo el mundo. El
   * cómo, en `projection-channel.service.js`.
   * - **Colores propios, no los de la paleta activa.** Los fondos son los
   *   mismos que los de compartir un versículo como imagen, y cada uno trae su
   *   color de tinta: es lo que garantiza que el texto se lea sobre cualquiera
   *   de ellos sin tener que comprobarlo a mano.
   * - **Nada aparece solo aquí.** Ni el diálogo del versículo del día ni el
   *   aviso de actualización de la PWA: los dos viven en App.svelte y quedan
   *   por debajo de esta capa.
   *
   * Control por teclado, porque el equipo que proyecta se maneja con un mando
   * de presentación, y esos mandos mandan exactamente las teclas de abajo.
   *
   * El segundo idioma sale de la Biblia de comparación (`compareBible`), que ya
   * es perezosa: no se descarga hasta que se enciende el interruptor. Son ~4 MB
   * y en una iglesia con conexión mala eso importa.
   */
  import { onDestroy, onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import {
    getBibleVersionConfigOrDefault,
    selectedBibleVersion,
    compareWithVersion,
    initCompareVersion,
  } from '../../store/stores';
  import { BIBLE_VERSIONS } from '../../config/bible-versions.js';
  import { searchReferences, parseReference } from '../../services/referenceSearch.service';
  import { getFilterResult } from '../../services/filter.service';
  import { keepScreenAwake } from '../../services/sermon-pulpit.service';
  import { getLastRead } from '../../services/reading-progress.service';
  import { cargarPreferencias, guardarPreferencias } from '../../services/projection.service';
  import Icon from '../../components/Icon.svelte';
  import DictadoBoton from '../../components/DictadoBoton.svelte';
  import ProjectionSurface from '../../components/ProjectionSurface.svelte';
  import ProjectionControls from '../../components/ProjectionControls.svelte';
  import { abrirCanal, abrirVentanaPantalla, MENSAJES, soportaCanal } from '../../services/projection-channel.service';
  import { textoDeVersiculo } from '../../services/versification.service';

  export let bible = [];
  export let map = {};
  export let compareBible = [];
  export let compareMap = {};

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
  $: versionSecundariaConfig = $compareWithVersion ? getBibleVersionConfigOrDefault($compareWithVersion) : null;

  // `noindex` y sin traducir por idioma: es una herramienta del dispositivo, no
  // contenido que se comparta. Una sola URL para las cuatro versiones.
  $: applySeoMetadata({
    title: $_('app.projection.seo_title'),
    description: $_('app.projection.seo_description'),
    canonicalPath: '/proiectie',
    versionConfig,
    robots: 'noindex, nofollow',
  });

  /**
   * Esta misma pantalla hace dos papeles, y el parámetro `?ecran=1` los separa.
   *
   * Sin parámetro es la ventana del OPERADOR: elige qué proyectar y manda.
   * Con él es la ventana PROYECTADA, la que se arrastra al segundo monitor y
   * se pone a pantalla completa: sólo pinta la lámina y no sabe nada más.
   *
   * Va por parámetro y no por ruta propia porque una ruta obligaría a tocar
   * `Main.svelte`, `bible-versions.js`, `AppMenu.svelte` y `generate-seo.mjs`
   * (CLAUDE.md, trampa 11) para una pantalla que nadie enlaza ni indexa.
   */
  const esPantalla = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ecran') === '1';

  /**
   * Dónde sale la proyección.
   *
   *   'antesala'  eligiendo qué proyectar
   *   'local'     proyectando en ESTA pantalla, a pantalla completa (lo de siempre)
   *   'remoto'    proyectando en la ventana del segundo monitor; aquí queda la consola
   *
   * El modo remoto es la razón de todo esto: con una sola ventana, proyectar
   * significaba tapar el portátil, y para buscar el versículo siguiente había
   * que salir de la proyección y volver a entrar delante de la congregación.
   */
  let modo = 'antesala';

  // ── Estado ────────────────────────────────────────────────────────────────
  // `proyectando` sigue significando «hay algo en la pantalla grande», lo mismo
  // en local que en remoto: de eso dependen el bloqueo de pantalla y las teclas.
  $: proyectando = modo !== 'antesala';
  let pasajes = []; // [{ book, chapter, verse, texto, referencia }]
  let indice = 0;
  let enNegro = false;
  let controlesVisibles = true;
  let ocultarControlesTimer;
  let soltarPantalla = null;
  let panelAbierto = ''; // '' | 'fondo' | 'animacion' | 'idioma'

  // Preferencias persistidas. Se leen en `onMount` y no aquí: en el arranque del
  // módulo `localStorage` puede no estar listo en algunos navegadores.
  let prefs = { fondo: 'night', animacion: 'fade', escala: 1, segundoIdioma: false, invertido: false };

  // El fondo ya no se resuelve aquí: lo hace `ProjectionSurface` a partir de la
  // clave, porque lo necesitan las dos ventanas y sólo una de ellas tiene estas
  // preferencias. Aquí sólo se guarda y se manda la clave.

  $: actual = pasajes[indice] || null;
  // Se compara contra las variables directamente y no a través de un helper:
  // envuelto en una función, el compilador no ve la dependencia y la pantalla
  // deja de repintarse al cambiar de versículo (trampa 23).
  $: hayAnterior = indice > 0;
  $: haySiguiente = indice < pasajes.length - 1;

  /**
   * El texto del mismo versículo en la segunda versión.
   *
   * Se resuelve **por referencia** y no por posición en una lista: las versiones
   * no numeran igual —Salmos con encabezamiento, versículos partidos— y pintar
   * lo que caiga en el mismo índice pondría dos textos distintos uno debajo del
   * otro delante de toda la congregación. Si esa versión no tiene ese
   * versículo, no se pinta nada: mejor un hueco que una línea equivocada.
   */
  // Pasa por `textoDeVersiculo` y no por el array a pelo: en cuatro capítulos
  // las ediciones numeran distinto —Números 13, 1 Samuel 24, Jonás 2 y
  // 1 Crónicas 22— y leer `[versiculo - 1]` pondría el versículo de al lado
  // debajo del principal, delante de toda la congregación. Si esa edición no
  // tiene ese versículo, devuelve cadena vacía y no se pinta nada.
  $: textoSecundario =
    prefs.segundoIdioma && actual
      ? textoDeVersiculo(compareBible, $compareWithVersion, actual.book, actual.chapter, actual.verse)
      : '';
  $: referenciaSecundaria =
    prefs.segundoIdioma && actual && compareMap?.[actual.book]
      ? `${compareMap[actual.book]} ${actual.chapter}:${actual.verse}`
      : '';

  // Qué va arriba (grande) y qué abajo (pequeño). `invertido` sólo cambia el
  // orden de pintado: no toca la versión activa de la aplicación, que es de lo
  // que depende todo lo demás (rutas, voz, SEO).
  $: principal =
    prefs.invertido && textoSecundario
      ? { texto: textoSecundario, referencia: referenciaSecundaria, version: versionSecundariaConfig?.bibleName || '' }
      : { texto: actual?.texto || '', referencia: actual?.referencia || '', version: versionConfig?.bibleName || '' };
  $: secundario =
    prefs.invertido && textoSecundario
      ? { texto: actual?.texto || '', referencia: actual?.referencia || '', version: versionConfig?.bibleName || '' }
      : { texto: textoSecundario, referencia: referenciaSecundaria, version: versionSecundariaConfig?.bibleName || '' };

  const persistir = () => guardarPreferencias(prefs);

  // ── Preparación: qué se proyecta ──────────────────────────────────────────
  //
  // Dos buscadores separados y excluyentes, porque son dos preguntas distintas:
  // «llévame a Ioan 3» y «dónde dice *dragoste*». Escribir en uno vacía el otro
  // — mantener los dos con contenido dejaría al usuario sin saber cuál manda.
  let consultaRef = '';
  let consultaTexto = '';
  let sugerencias = [];
  let resultadosTexto = [];
  let buscandoTexto = false;

  /**
   * Lo dictado entra en el campo como si se hubiera tecleado.
   *
   * Sólo se busca cuando el reconocedor da la frase por terminada: con los
   * resultados parciales, la lista de sugerencias parpadeaba entera en cada
   * sílaba. Mientras tanto el texto sí se va escribiendo, para que se vea que
   * está entendiendo algo.
   */
  const dictadoReferencia = (texto, final) => {
    consultaRef = texto;
    consultaTexto = '';
    resultadosTexto = [];
    if (final) buscarReferencia();
  };

  const dictadoFrase = (texto, final) => {
    consultaTexto = texto;
    consultaRef = '';
    sugerencias = [];
    if (final) buscarPorTexto();
  };

  const buscarReferencia = () => {
    consultaTexto = '';
    resultadosTexto = [];
    sugerencias = consultaRef.trim().length >= 2 ? searchReferences(consultaRef, map, 6) : [];
  };

  const buscarPorTexto = () => {
    consultaRef = '';
    sugerencias = [];
    const texto = consultaTexto.trim();
    // Tres caracteres es el mínimo del propio buscador de la aplicación: con
    // menos, cualquier cosa aparece en media Biblia y la lista no ayuda.
    if (texto.length < 3) {
      resultadosTexto = [];
      return;
    }
    buscandoTexto = true;
    try {
      const encontrados = getFilterResult(bible, map, {
        searchText: texto,
        // `match` es «el versículo contiene esta expresión», que es justo lo que
        // promete el campo. NO se puede omitir: `getFilterResult` decide con un
        // `switch (form.searchType)` y sin él cae en el caso por defecto y
        // devuelve la lista vacía — buscabas «dragostea» y no salía nada, sin
        // ningún error que lo explicara. Es el mismo valor que usa el buscador
        // del panel lateral.
        searchType: 'match',
        testament: 'all',
        book: [],
        chapter: [],
      });
      resultadosTexto = encontrados.slice(0, 60).map((v) => ({
        book: v.book,
        chapter: v.chapter,
        verse: v.index,
        texto: String(v.text || '').trim(),
        referencia: `${map[v.book] || ''} ${v.chapter}:${v.index}`,
      }));
    } finally {
      buscandoTexto = false;
    }
  };

  /** Convierte un capítulo entero en la lista de versículos a proyectar. */
  const construirPasajes = (book, chapter) => {
    const versos = bible?.[book]?.[chapter - 1] || [];
    const nombre = map[book] || '';
    return versos
      .map((texto, i) => ({
        book,
        chapter,
        verse: i + 1,
        texto: String(texto || '').trim(),
        referencia: `${nombre} ${chapter}:${i + 1}`,
      }))
      .filter((v) => v.texto);
  };

  /**
   * Pone una lista en pantalla.
   *
   * Si ya se está proyectando en el segundo monitor NO cambia de modo: ese es
   * justamente el caso que se venía a resolver — buscar el versículo siguiente
   * mientras la congregación sigue viendo el anterior, y cambiarlo cuando toca,
   * sin apagar y volver a encender la proyección.
   */
  const arrancar = (lista, desde = 0) => {
    if (!lista.length) return;
    pasajes = lista;
    indice = Math.min(Math.max(desde, 0), lista.length - 1);
    if (modo === 'antesala') modo = 'local';
    enNegro = false;
    panelAbierto = '';
    mostrarControles();
  };

  const empezarDesde = (book, chapter, verse) => {
    const lista = construirPasajes(book, chapter);
    arrancar(lista, Number.isInteger(verse) && verse > 1 ? verse - 1 : 0);
  };

  const empezarDesdeSugerencia = (s) => empezarDesde(s.book, s.chapter, s.verse);

  const empezarDesdeConsulta = () => {
    const encontrado = parseReference(consultaRef, map) || sugerencias[0];
    if (encontrado) empezarDesdeSugerencia(encontrado);
  };

  // Los resultados de una búsqueda por texto se proyectan TAL CUAL, como lista:
  // son versículos de libros distintos y no tendría sentido saltar al capítulo
  // de cada uno. Es justo lo que se quiere para un tema («toate versetele
  // despre dragoste») proyectado uno detrás de otro.
  const empezarDesdeTexto = (i) => arrancar(resultadosTexto, i);

  // Atajo: seguir por donde se iba leyendo.
  let ultimaLectura = null;
  $: etiquetaUltima =
    ultimaLectura && map[ultimaLectura.book]
      ? // El `+ 1` convierte el índice de capítulo (base 0, como lo guarda la
        // lectura) al número que se enseña. NO es «el capítulo siguiente».
        `${map[ultimaLectura.book]} ${ultimaLectura.chapter + 1}`
      : '';

  // ── Segundo idioma ────────────────────────────────────────────────────────
  //
  // Encenderlo dispara la carga perezosa de la segunda Biblia en App.svelte,
  // que escucha `compareWithVersion`. Por eso el interruptor setea el store
  // aunque la versión ya estuviera elegida: sin eso, la primera vez no hay nada
  // que pintar abajo y parece que el interruptor no hace nada.
  const alternarSegundoIdioma = () => {
    prefs.segundoIdioma = !prefs.segundoIdioma;
    if (prefs.segundoIdioma && !$compareWithVersion) initCompareVersion();
    if (prefs.segundoIdioma && !$compareWithVersion) {
      // Sigue sin haber ninguna guardada: se elige la primera distinta de la
      // activa, para que el interruptor haga algo desde el primer clic.
      const otra = BIBLE_VERSIONS.find((v) => v.value !== $selectedBibleVersion);
      if (otra) compareWithVersion.set(otra.value);
    }
    persistir();
  };

  const elegirSegundaVersion = (valor) => {
    compareWithVersion.set(valor);
    prefs.segundoIdioma = true;
    persistir();
    cerrarPanel();
  };

  const intercambiarIdiomas = () => {
    prefs.invertido = !prefs.invertido;
    persistir();
  };

  // ── Ajustes ───────────────────────────────────────────────────────────────
  //
  // Elegir una opción CIERRA el panel. Antes se quedaba abierto hasta que lo
  // cerrabas a mano, y como los controles tampoco se ocultan con un panel
  // abierto, bastaba con mirar un fondo para dejar dos cajas encendidas en la
  // pantalla de la iglesia durante el resto del culto.
  const elegirFondo = (key) => {
    prefs.fondo = key;
    persistir();
    cerrarPanel();
  };
  const elegirAnimacion = (key) => {
    prefs.animacion = key;
    persistir();
    cerrarPanel();
  };
  const masGrande = () => {
    prefs.escala = Math.min(prefs.escala + 0.1, 2);
    persistir();
  };
  const masPequeno = () => {
    prefs.escala = Math.max(prefs.escala - 0.1, 0.5);
    persistir();
  };

  const cerrarPanel = () => {
    panelAbierto = '';
    mostrarControles();
  };

  const alternarPanel = (cual) => {
    panelAbierto = panelAbierto === cual ? '' : cual;
    mostrarControles();
  };

  /**
   * La rueda del ratón cambia el tamaño del texto.
   *
   * Es el reflejo de cualquiera que se sienta delante de una pantalla, y aquí
   * no compite con nada: la proyección no tiene scroll. `preventDefault` evita
   * que el gesto se lo quede la página de debajo.
   *
   * El paso es la mitad que el de los botones: con la rueda se hacen varios
   * clics seguidos sin querer, y a 0,1 por muesca se pasaba de largo.
   */
  const alGirarRueda = (e) => {
    e.preventDefault();
    const paso = e.deltaY < 0 ? 0.05 : -0.05;
    prefs.escala = Math.min(Math.max(prefs.escala + paso, 0.5), 2);
    persistir();
    mostrarControles();
  };

  // ── Navegación ────────────────────────────────────────────────────────────
  //
  // Avanzar cierra cualquier panel abierto: si el operador estaba mirando los
  // fondos y pasa al versículo siguiente, ya no está eligiendo.
  const siguiente = () => {
    panelAbierto = '';
    if (haySiguiente) indice += 1;
  };
  const anterior = () => {
    panelAbierto = '';
    if (hayAnterior) indice -= 1;
  };
  const alternarNegro = () => {
    enNegro = !enNegro;
  };

  const salir = () => {
    // La ventana del segundo monitor NO se cierra: se queda en negro.
    //
    // Es el cambio que pidió el uso real. Colocarla en el proyector cuesta
    // arrastrarla y pulsar F11, y eso no se puede repetir cada vez que hay que
    // dejar paso a una canción de otro programa. Cerrándola, volver a proyectar
    // era rehacer toda la maniobra delante de la congregación; dejándola
    // abierta y a oscuras, volver es elegir el versículo siguiente y ya está.
    // Para cerrarla de verdad está su propio botón.
    modo = ventanaPantalla && !ventanaPantalla.closed ? 'remoto' : 'antesala';
    enNegro = modo === 'remoto';
    panelAbierto = '';
    pasajes = [];
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // ── Las dos ventanas ──────────────────────────────────────────────────────
  //
  // Todo lo de aquí abajo existe para el caso de la iglesia: portátil + un
  // proyector. Ver la cabecera de `projection-channel.service.js`.
  let canal = null;
  let ventanaPantalla = null;
  let vigilanteVentana = null;

  /** Lo que tiene que pintar la ventana proyectada. Va entero en cada cambio. */
  $: estadoPantalla = {
    principal: { texto: principal.texto, referencia: principal.referencia },
    secundario: { texto: secundario.texto, referencia: secundario.referencia },
    fondoKey: prefs.fondo,
    escala: prefs.escala,
    animacion: prefs.animacion,
    indice,
    enNegro,
  };

  // Se publica en cada cambio mientras haya una ventana escuchando. Se compara
  // contra `modo` y `estadoPantalla` directamente, no dentro de un helper: si
  // la dependencia queda escondida en una función, el compilador no la ve y
  // deja de republicar (CLAUDE.md, trampa 23).
  $: if (modo === 'remoto' && canal) canal.enviar({ tipo: MENSAJES.ESTADO, estado: estadoPantalla });

  /**
   * Cerrar del todo: se acabó el culto.
   *
   * Es la única acción que obliga a volver a colocar la ventana en el
   * proyector, así que está separada del botón de salir y con su propio texto.
   */
  const cerrarProyeccion = () => {
    cerrarVentanaPantalla();
    modo = 'antesala';
    enNegro = false;
    panelAbierto = '';
    pasajes = [];
  };

  const cerrarVentanaPantalla = () => {
    clearInterval(vigilanteVentana);
    vigilanteVentana = null;
    try {
      ventanaPantalla?.close();
    } catch {
      /* ya la había cerrado el usuario */
    }
    ventanaPantalla = null;
    canal?.cerrar();
    canal = null;
  };

  /**
   * Lo que llega DE la ventana proyectada.
   *
   * `listo` es el saludo de una ventana recién abierta: hay que mandarle el
   * estado en el acto o se queda en negro hasta el versículo siguiente.
   * `tecla` reenvía las teclas de esa ventana, para que el mando de
   * presentación funcione tenga el foco donde lo tenga — que en un culto es
   * exactamente lo que va a pasar.
   */
  const alRecibirDeLaPantalla = (mensaje) => {
    if (!mensaje) return;
    if (mensaje.tipo === MENSAJES.LISTO) {
      canal?.enviar({ tipo: MENSAJES.ESTADO, estado: estadoPantalla });
    } else if (mensaje.tipo === MENSAJES.CERRANDO) {
      // Se cierra la proyección pero NO se tira la lista: el operador vuelve a
      // abrir la ventana y sigue donde estaba.
      cerrarVentanaPantalla();
      modo = 'antesala';
    } else if (mensaje.tipo === MENSAJES.TECLA) {
      manejarTecla(mensaje.key, { desdeLaPantalla: true });
    }
  };

  // Sin `async`: `window.open` tiene que ejecutarse dentro del clic o el
  // navegador bloquea la ventana (ver `abrirVentanaPantalla`).
  const abrirSegundaPantalla = () => {
    ventanaPantalla = abrirVentanaPantalla();
    // Un bloqueador de ventanas emergentes devuelve null. No es un fallo de la
    // aplicación y hay que decirlo, o el botón parece roto.
    if (!ventanaPantalla) {
      avisoPantalla = $_('app.projection.window_blocked');
      return;
    }
    avisoPantalla = '';
    canal = abrirCanal(alRecibirDeLaPantalla);
    modo = 'remoto';
    panelAbierto = '';
    // Si el operador cierra la ventana con la cruz del sistema no llega ningún
    // evento a esta: `closed` es la única forma de enterarse.
    clearInterval(vigilanteVentana);
    vigilanteVentana = setInterval(() => {
      if (ventanaPantalla?.closed) {
        cerrarVentanaPantalla();
        modo = 'antesala';
      }
    }, 1000);
  };

  let avisoPantalla = '';

  const alternarPantallaCompleta = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Sin pantalla completa se proyecta igual: la capa ya ocupa todo el
      // viewport. En el navegador de un televisor a veces no está permitido.
    }
  };

  /**
   * Teclas. Son las que mandan los mandos de presentación: el botón de avanzar
   * emite Flecha derecha o AvPág, y el de retroceder Flecha izquierda o RePág.
   * Por eso hay varias teclas para lo mismo — no es indecisión.
   */
  /**
   * La acción de cada tecla, separada del evento.
   *
   * Está aparte porque ahora las teclas llegan de DOS sitios: del teclado de
   * esta ventana y, por el canal, del de la ventana proyectada — el mando de
   * presentación puede tener el foco en cualquiera de las dos y tiene que
   * funcionar igual.
   *
   * `desdeLaPantalla` marca las que vienen por el canal: ahí la pantalla
   * completa la maneja la ventana proyectada, que es la que está en el
   * proyector, así que esta no hace nada con la tecla F.
   */
  const manejarTecla = (key, { desdeLaPantalla = false } = {}) => {
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
      case 'Enter':
        siguiente();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case 'Backspace':
        anterior();
        break;
      case 'Home':
        indice = 0;
        break;
      case 'End':
        indice = pasajes.length - 1;
        break;
      case 'n':
      case 'N':
      case 'b':
      case 'B':
      case '.':
        alternarNegro();
        break;
      case 'f':
      case 'F':
        if (!desdeLaPantalla) alternarPantallaCompleta();
        break;
      case 's':
      case 'S':
        intercambiarIdiomas();
        break;
      // Encender o apagar el segundo idioma sin abrir el menú: en mitad del
      // culto entra un grupo de visitantes y hay que ponerlo en el acto.
      case 'l':
      case 'L':
        alternarSegundoIdioma();
        break;
      case '+':
      case '=':
        masGrande();
        break;
      case '-':
      case '_':
        masPequeno();
        break;
      case 'Escape':
        // Escape cierra primero el panel abierto y sólo sale si no hay ninguno:
        // si saliera directamente, abrir el menú de fondos por error te echaba
        // de la proyección en mitad del culto.
        if (panelAbierto) panelAbierto = '';
        else salir();
        break;
      default:
        break;
    }
  };

  /** Las teclas que consumimos. Las demás siguen su curso. */
  const TECLAS = new Set([
    'ArrowRight',
    'ArrowDown',
    'PageDown',
    ' ',
    'Enter',
    'ArrowLeft',
    'ArrowUp',
    'PageUp',
    'Backspace',
    'Home',
    'End',
    'n',
    'N',
    'b',
    'B',
    '.',
    'f',
    'F',
    's',
    'S',
    'l',
    'L',
    '+',
    '=',
    '-',
    '_',
    'Escape',
  ]);

  const alPulsarTecla = (e) => {
    if (!proyectando) return;
    // Si se está escribiendo en un campo, las teclas son texto y no atajos.
    //
    // No es teórico: el Enter que arranca la proyección desde el buscador
    // seguía burbujeando hasta aquí, y como para entonces ya se estaba
    // proyectando, avanzaba un versículo en el mismo gesto. Se empezaba siempre
    // en el segundo versículo del capítulo sin que nada lo explicara.
    const donde = e.target?.tagName;
    if (donde === 'INPUT' || donde === 'TEXTAREA' || e.target?.isContentEditable) return;

    // Y con un botón enfocado, Espacio y Enter son «pulsa este botón». En la
    // proyección a pantalla completa daba igual porque no había botones que
    // recibieran el foco; en la consola del modo remoto están todos a la vista,
    // y sin esto avanzar de versículo también disparaba el botón enfocado.
    if (donde === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;

    if (!TECLAS.has(e.key)) return;
    e.preventDefault();
    manejarTecla(e.key);
  };

  // Los controles se esconden solos: un botón flotante en la esquina se ve
  // desde la última fila y estropea la proyección. Vuelven al mover el ratón.
  //
  // Cuatro segundos y no dos y medio: con el temporizador corto, quien movía el
  // ratón hacia el botón y titubeaba un momento se lo encontraba desvanecido
  // justo al ir a pulsarlo, y tenía que menear el ratón para recuperarlo.
  const ESPERA_CONTROLES_MS = 4000;
  let punteroEncima = false;

  // Un panel abierto aguanta más —se está leyendo— pero acaba cerrándose. Sin
  // este segundo plazo, abrir el menú y no elegir nada dejaba la caja encendida
  // en la pantalla de la iglesia hasta el final del culto.
  const ESPERA_PANEL_MS = 9000;

  const mostrarControles = () => {
    controlesVisibles = true;
    clearTimeout(ocultarControlesTimer);
    // No se ocultan con el puntero encima: el operador está usándolos, y que se
    // desvanezcan mientras los miras es de las cosas que más enfadan.
    ocultarControlesTimer = setTimeout(
      () => {
        if (punteroEncima) return;
        panelAbierto = '';
        controlesVisibles = false;
      },
      panelAbierto ? ESPERA_PANEL_MS : ESPERA_CONTROLES_MS,
    );
  };

  /**
   * En el móvil, un TOQUE enseña la barra; un arrastre no.
   *
   * Antes bastaba con `touchstart`, así que cualquier gesto la sacaba. Y esta
   * pantalla se usa también para leer la Biblia en el móvil —con el dedo
   * encima todo el rato—, así que la barra aparecía sola cada dos por tres
   * justo encima de lo que se estaba leyendo.
   *
   * El umbral son 12 px: por debajo de eso nadie está arrastrando, es el
   * temblor normal del pulgar al tocar.
   */
  const MOVIMIENTO_MAXIMO_TOQUE = 12;
  let toqueInicio = null;

  const alEmpezarToque = (e) => {
    const t = e.touches?.[0];
    toqueInicio = t ? { x: t.clientX, y: t.clientY } : null;
  };

  const alTerminarToque = (e) => {
    if (!toqueInicio) return;
    const t = e.changedTouches?.[0];
    const recorrido = t ? Math.hypot(t.clientX - toqueInicio.x, t.clientY - toqueInicio.y) : 0;
    toqueInicio = null;
    if (recorrido < MOVIMIENTO_MAXIMO_TOQUE) mostrarControles();
  };

  const entrarEnControles = () => {
    punteroEncima = true;
    clearTimeout(ocultarControlesTimer);
    controlesVisibles = true;
  };

  const salirDeControles = () => {
    punteroEncima = false;
    mostrarControles();
  };

  // ── Ciclo de vida ─────────────────────────────────────────────────────────
  //
  // El bloqueo de pantalla se pide al EMPEZAR a proyectar y no al entrar: en la
  // antesala no hace falta, y pedirlo sin necesidad gasta batería del portátil.
  $: if (proyectando && !soltarPantalla) {
    const bloqueo = keepScreenAwake();
    soltarPantalla = bloqueo.release;
  } else if (!proyectando && soltarPantalla) {
    soltarPantalla();
    soltarPantalla = null;
  }

  // Y se bloquea el scroll del documento. La capa es `fixed inset:0`, pero la
  // página que hay debajo sigue siendo alta, así que el navegador pintaba su
  // barra de desplazamiento **encima de la proyección**: una franja gris a la
  // derecha de la pantalla de la iglesia. Se reutiliza la clase que ya usa
  // `Modal.svelte` en vez de escribir otro `overflow: hidden`.
  //
  // Sólo en local: en modo remoto la capa está en la OTRA ventana y aquí queda
  // la consola, que es una página normal y tiene que poder desplazarse — si no,
  // una lista larga de resultados se quedaba sin poder llegar al final.
  let scrollBloqueado = false;
  $: bloquearScroll = modo === 'local' || esPantalla;
  $: if (typeof document !== 'undefined') {
    if (bloquearScroll && !scrollBloqueado) {
      document.body.classList.add('drawer-open');
      scrollBloqueado = true;
    } else if (!bloquearScroll && scrollBloqueado) {
      document.body.classList.remove('drawer-open');
      scrollBloqueado = false;
    }
  }

  // ── La ventana proyectada ─────────────────────────────────────────────────
  //
  // Sólo pinta lo que le mandan. No carga Biblias, no busca y no guarda nada.
  let estadoRecibido = {
    principal: { texto: '', referencia: '' },
    secundario: { texto: '', referencia: '' },
    fondoKey: 'night',
    escala: 1,
    animacion: 'fade',
    indice: 0,
    enNegro: false,
  };
  let pistaPantalla = true;
  let enPantallaCompleta = false;

  /**
   * Volver a pantalla completa desde la propia ventana proyectada.
   *
   * Tiene que ser un gesto EN ESTA ventana: la pantalla completa exige
   * activación del usuario en el documento que la pide, así que no se puede
   * pedir desde la consola por el canal. Como esta ventana está en el
   * proyector, es un solo clic con el ratón — bastante mejor que arrastrar.
   */
  const ponerPantallaCompleta = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Si el navegador no deja, queda F11, que es lo que dice el botón.
    }
  };

  const montarPantalla = () => {
    const suCanal = abrirCanal((mensaje) => {
      if (mensaje?.tipo === MENSAJES.ESTADO) estadoRecibido = mensaje.estado;
    });
    // El saludo: la ventana de control responde con el estado actual. Sin esto
    // la pantalla se queda en negro hasta que alguien cambie de versículo.
    suCanal.enviar({ tipo: MENSAJES.LISTO });

    /**
     * Las teclas de ESTA ventana se reenvían a la de control, que es la que
     * manda: el mando de presentación suele dejar el foco aquí.
     *
     * **`F11` y `Escape` NO se reenvían**, y esto último costó el escenario
     * real: Escape es la tecla con la que el navegador sale de pantalla
     * completa, así que el operador la pulsa para dejar paso a otro programa
     * —una canción, un vídeo—. Reenviada, llegaba al control como «salir de la
     * proyección» y CERRABA esta ventana: había que volver a arrastrarla al
     * proyector y volver a pulsar F11, en mitad del culto. Aquí Escape
     * significa una sola cosa: salir de pantalla completa.
     */
    const alTeclear = (e) => {
      if (e.key === 'F11' || e.key === 'Escape') return;
      suCanal.enviar({ tipo: MENSAJES.TECLA, key: e.key });
    };
    const alCerrar = () => suCanal.enviar({ tipo: MENSAJES.CERRANDO });

    // Para saber si hay que ofrecer el botón de volver a pantalla completa.
    const alCambiarPantallaCompleta = () => {
      enPantallaCompleta = !!document.fullscreenElement;
    };

    window.addEventListener('keydown', alTeclear);
    window.addEventListener('pagehide', alCerrar);
    document.addEventListener('fullscreenchange', alCambiarPantallaCompleta);
    alCambiarPantallaCompleta();
    // La pista de «ponla a pantalla completa» sobra en cuanto se ha leído.
    const quitarPista = setTimeout(() => (pistaPantalla = false), 8000);

    return () => {
      clearTimeout(quitarPista);
      window.removeEventListener('keydown', alTeclear);
      window.removeEventListener('pagehide', alCerrar);
      document.removeEventListener('fullscreenchange', alCambiarPantallaCompleta);
      alCerrar();
      suCanal.cerrar();
    };
  };

  onMount(() => {
    if (esPantalla) return montarPantalla();

    prefs = cargarPreferencias();
    ultimaLectura = getLastRead();
    // Si quedó encendido el segundo idioma de una sesión anterior, hay que
    // volver a pedir la Biblia: `compareWithVersion` arranca en null.
    if (prefs.segundoIdioma) initCompareVersion();
    window.addEventListener('keydown', alPulsarTecla);
    return () => window.removeEventListener('keydown', alPulsarTecla);
  });

  onDestroy(() => {
    clearTimeout(ocultarControlesTimer);
    if (soltarPantalla) soltarPantalla();
    // Navegar fuera de la consola no puede dejar la ventana del proyector
    // encendida con el último versículo puesto.
    cerrarVentanaPantalla();
    // Sin esto, salir de la proyección navegando (no con Escape) dejaría el
    // resto de la aplicación sin poder hacer scroll.
    if (typeof document !== 'undefined') {
      document.body.classList.remove('drawer-open');
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  });
</script>

{#if esPantalla}
  <!-- ── La ventana que va al proyector ───────────────────────────────── -->
  <!-- Sólo la lámina. Ni controles, ni zonas táctiles, ni paneles: lo que se
       ve aquí lo ve la congregación entera. -->
  <ProjectionSurface
    principal={estadoRecibido.principal}
    secundario={estadoRecibido.secundario}
    fondoKey={estadoRecibido.fondoKey}
    escala={estadoRecibido.escala}
    animacion={estadoRecibido.animacion}
    indice={estadoRecibido.indice}
    enNegro={estadoRecibido.enNegro}
  >
    <!-- Cómo dejarla lista, y se quita sola a los ocho segundos: es una
         instrucción de montaje, no parte de la proyección. -->
    {#if pistaPantalla && !enPantallaCompleta}
      <p class="pista-pantalla">{$_('app.projection.screen_hint')}</p>
    {/if}

    <!-- Volver a pantalla completa, de un clic.
         Sale SÓLO cuando no lo está, así que durante el culto no se ve nunca.
         Existe porque salir de pantalla completa es lo normal —se pulsa Escape
         para dejar paso a otro programa— y volver a entrar no puede costar
         arrastrar la ventana otra vez. -->
    {#if !enPantallaCompleta}
      <button type="button" class="volver-completa" on:click={ponerPantallaCompleta}>
        <Icon name="expand" size="1.1rem" />
        {$_('app.projection.screen_fullscreen')}
      </button>
    {/if}
  </ProjectionSurface>
{:else if modo !== 'local'}
  <!-- ── Antesala y consola ───────────────────────────────────────────── -->
  <section class="antesala" class:antesala--consola={modo === 'remoto'}>
    <header class="antesala__cabecera">
      <p class="antesala__eyebrow">{$_('app.projection.eyebrow')}</p>
      <h1>{$_('app.projection.title')}</h1>
      <p class="antesala__lead">{$_('app.projection.lead')}</p>
    </header>

    <div class="buscadores">
      <label class="campo">
        <span>{$_('app.projection.search_label')}</span>
        <span class="campo__fila">
          <input
            type="search"
            bind:value={consultaRef}
            on:input={buscarReferencia}
            on:keydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                empezarDesdeConsulta();
              }
            }}
            placeholder={$_('app.projection.search_placeholder')}
            autocomplete="off"
            spellcheck="false"
          />
          <!-- Dictar la referencia. Es el motivo por el que existe esto: en el
               púlpito no se teclea. -->
          <DictadoBoton
            modo="referencia"
            locale={versionConfig?.locale}
            etiqueta={$_('app.speech.start_reference')}
            alDictar={dictadoReferencia}
          />
        </span>
      </label>

      <label class="campo">
        <span>{$_('app.projection.phrase_label')}</span>
        <span class="campo__fila">
          <input
            type="search"
            bind:value={consultaTexto}
            on:input={buscarPorTexto}
            on:keydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                buscarPorTexto();
              }
            }}
            placeholder={$_('app.projection.phrase_placeholder')}
            autocomplete="off"
            spellcheck="false"
          />
          <DictadoBoton
            modo="libre"
            locale={versionConfig?.locale}
            etiqueta={$_('app.speech.start_phrase')}
            alDictar={dictadoFrase}
          />
        </span>
      </label>
    </div>

    {#if sugerencias.length}
      <ul class="resultados">
        {#each sugerencias as s (`${s.book}-${s.chapter}-${s.verse || 0}`)}
          <li>
            <button type="button" on:click={() => empezarDesdeSugerencia(s)}>
              <span class="resultados__ref">{map[s.book]} {s.chapter}{s.verse ? `:${s.verse}` : ''}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else if consultaTexto.trim().length >= 3}
      {#if resultadosTexto.length}
        <p class="resultados__cuenta">
          {$_('app.projection.phrase_count', { count: resultadosTexto.length })}
        </p>
        <ul class="resultados">
          {#each resultadosTexto.slice(0, 20) as v, i (`${v.book}-${v.chapter}-${v.verse}`)}
            <li>
              <button type="button" on:click={() => empezarDesdeTexto(i)}>
                <span class="resultados__ref">{v.referencia}</span>
                <span class="resultados__texto">{v.texto}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else if !buscandoTexto}
        <p class="resultados__cuenta">{$_('app.projection.phrase_empty')}</p>
      {/if}
    {/if}

    {#if etiquetaUltima}
      <button
        type="button"
        class="antesala__continuar"
        on:click={() => empezarDesde(ultimaLectura.book, ultimaLectura.chapter + 1)}
      >
        <Icon name="book-open" />
        {$_('app.projection.continue', { reference: etiquetaUltima })}
      </button>
    {/if}

    <!-- ── Dos pantallas ───────────────────────────────────────────────── -->
    <!-- El caso de la iglesia: portátil + proyector. Abre una segunda ventana
         que se arrastra al proyector, y deja ÉSTA con el buscador a la vista
         para preparar el versículo siguiente sin cortar lo que se está
         proyectando. -->
    {#if modo === 'antesala' && soportaCanal()}
      <div class="dos-pantallas">
        <!-- Icono de MONITOR, no el de proyección: el de proyección ya está en
             la barra de arriba, a dos dedos de aquí, y con el mismo dibujo en
             los dos botones nadie acertaba con prisa cuál era cuál. -->
        <button type="button" class="dos-pantallas__boton" on:click={abrirSegundaPantalla}>
          <Icon name="monitor" />
          {$_('app.projection.open_screen')}
        </button>
        <p class="dos-pantallas__pista">{$_('app.projection.open_screen_hint')}</p>
        {#if avisoPantalla}
          <p class="dos-pantallas__aviso" role="alert">{avisoPantalla}</p>
        {/if}
      </div>
    {:else if modo === 'remoto'}
      <!-- La ventana ya está colocada en el proyector. Lo que hace falta aquí
           es RECORDARLO —para que nadie la vuelva a abrir por las bravas— y
           dar la única salida que no es reversible: cerrarla. -->
      <div class="dos-pantallas dos-pantallas--abierta">
        <p class="dos-pantallas__estado">
          <Icon name="monitor" size="1rem" />
          {$_('app.projection.screen_open')}
        </p>
        <p class="dos-pantallas__pista">{$_('app.projection.screen_open_hint')}</p>
        <button type="button" class="dos-pantallas__cerrar" on:click={cerrarProyeccion}>
          {$_('app.projection.screen_close')}
        </button>
      </div>
    {/if}

    <!-- Las teclas se enseñan ANTES de empezar, no durante: en mitad del culto
         no hay dónde mirarlas, y quien proyecta las repasa mientras prepara. -->
    <div class="atajos">
      <h2>{$_('app.projection.keys_title')}</h2>
      <ul>
        <li><kbd>→</kbd> <kbd>Space</kbd> <span>{$_('app.projection.key_next')}</span></li>
        <li><kbd>←</kbd> <span>{$_('app.projection.key_prev')}</span></li>
        <li><kbd>N</kbd> <span>{$_('app.projection.key_black')}</span></li>
        <li><kbd>F</kbd> <span>{$_('app.projection.key_fullscreen')}</span></li>
        <li><kbd>L</kbd> <span>{$_('app.projection.panel_language')}</span></li>
        <li><kbd>S</kbd> <span>{$_('app.projection.key_swap')}</span></li>
        <li><kbd>+</kbd> <kbd>−</kbd> <span>{$_('app.projection.key_size')}</span></li>
        <li><kbd>Esc</kbd> <span>{$_('app.projection.key_exit')}</span></li>
      </ul>
    </div>
  </section>

  <!-- ── Consola del modo remoto ─────────────────────────────────────── -->
  <!-- La proyección está en la OTRA ventana. Aquí queda lo que el operador
       necesita ver sin tapar el buscador: qué hay puesto ahora mismo y los
       mismos controles de siempre. -->
  {#if modo === 'remoto'}
    <div class="consola">
      <div class="consola__ahora">
        <p class="consola__eyebrow">{$_('app.projection.on_screen')}</p>
        {#if enNegro}
          <p class="consola__ref">{$_('app.projection.key_black')}</p>
        {:else if principal.referencia}
          <p class="consola__ref">{principal.referencia}</p>
          <p class="consola__texto">{principal.texto}</p>
        {:else}
          <p class="consola__ref consola__ref--vacio">{$_('app.projection.screen_waiting')}</p>
        {/if}
      </div>

      <div class="consola__pasos">
        <button type="button" disabled={!hayAnterior} on:click={anterior} aria-label={$_('app.projection.key_prev')}>
          <Icon name="arrow-left" />
        </button>
        <button type="button" disabled={!haySiguiente} on:click={siguiente} aria-label={$_('app.projection.key_next')}>
          <Icon name="arrow-right" />
        </button>
      </div>

      <ProjectionControls
        {prefs}
        {panelAbierto}
        {indice}
        total={pasajes.length}
        visibles={true}
        conPantallaCompleta={false}
        onPanel={alternarPanel}
        onSalir={salir}
        onMasGrande={masGrande}
        onMasPequeno={masPequeno}
        onNegro={alternarNegro}
        onFondo={elegirFondo}
        onAnimacion={elegirAnimacion}
        onSegundoIdioma={alternarSegundoIdioma}
        onSegundaVersion={elegirSegundaVersion}
        onIntercambiar={intercambiarIdiomas}
      />
    </div>
  {/if}
{:else}
  <!-- ── Proyectando en ESTA pantalla ─────────────────────────────────── -->
  <ProjectionSurface
    {principal}
    {secundario}
    fondoKey={prefs.fondo}
    escala={prefs.escala}
    animacion={prefs.animacion}
    {indice}
    {enNegro}
    on:mousemove={mostrarControles}
    on:touchstart={alEmpezarToque}
    on:touchend={alTerminarToque}
    on:wheel={alGirarRueda}
  >
    <!-- Zonas de toque para avanzar sin teclado: la mitad derecha avanza, la
         izquierda retrocede. Invisibles a propósito — es una pantalla, no una
         interfaz. -->
    <button type="button" class="zona zona--anterior" aria-label={$_('app.projection.key_prev')} on:click={anterior}
    ></button>
    <button type="button" class="zona zona--siguiente" aria-label={$_('app.projection.key_next')} on:click={siguiente}
    ></button>

    <ProjectionControls
      {prefs}
      {panelAbierto}
      {indice}
      total={pasajes.length}
      visibles={controlesVisibles}
      onPanel={alternarPanel}
      onSalir={salir}
      onMasGrande={masGrande}
      onMasPequeno={masPequeno}
      onNegro={alternarNegro}
      onPantallaCompleta={alternarPantallaCompleta}
      onFondo={elegirFondo}
      onAnimacion={elegirAnimacion}
      onSegundoIdioma={alternarSegundoIdioma}
      onSegundaVersion={elegirSegundaVersion}
      onIntercambiar={intercambiarIdiomas}
      onEntrar={entrarEnControles}
      onSalirDeControles={salirDeControles}
    />
  </ProjectionSurface>
{/if}

<style lang="scss">
  // ── Antesala ──────────────────────────────────────────────────────────────
  // Esta parte SÍ usa la paleta del usuario: se mira en el portátil, antes de
  // empezar. La que no la usa es la proyección.
  .antesala {
    width: 100%;
    max-width: 44rem;
    margin: 0 auto;
    padding: 0 0 4rem;
  }

  .antesala__cabecera {
    margin-bottom: 1.5rem;

    h1 {
      margin: 0.2rem 0 0.5rem;
    }
  }

  .antesala__eyebrow {
    margin: 0;
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .antesala__lead {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    line-height: var(--line-height-body);
  }

  // Dos campos, uno al lado del otro en pantalla ancha y apilados en móvil.
  .buscadores {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .campo {
    display: grid;
    gap: 0.35rem;
    font-size: var(--font-size-small);

    > span {
      font-weight: 600;
      color: var(--color-ink);
    }

    input {
      // Dentro de la fila con el micrófono, el campo se queda con el resto.
      flex: 1;
      min-width: 0;
      min-height: 2.8rem;
      padding: 0.55rem 0.8rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-field);
      color: var(--color-ink);
      font: inherit;
      font-size: 1.05rem;
    }
  }

  // El campo y su micrófono, en línea. `position: relative` porque el aviso de
  // privacidad del dictado se posiciona contra esta fila.
  .campo__fila {
    position: relative;
    display: flex;
    align-items: center;
    // `wrap` para que el mensaje de estado del dictado baje a su propia línea.
    // Sin esto se colocaba al lado del campo y lo estrujaba a un tercio de su
    // ancho: el texto cambia de longitud según la causa del fallo, así que la
    // caja de búsqueda se encogía sola en cuanto algo iba mal.
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .resultados {
    display: grid;
    gap: 0.35rem;
    margin: 0 0 1.25rem;
    padding: 0;
    list-style: none;
    // Una búsqueda por frase puede devolver decenas: se acota el alto y se
    // desplaza, en vez de empujar los atajos de teclado fuera de la pantalla.
    max-height: 22rem;
    overflow-y: auto;

    button {
      display: grid;
      gap: 0.15rem;
      width: 100%;
      min-height: 2.6rem;
      padding: 0.5rem 0.85rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
      text-align: left;
      cursor: pointer;

      &:hover {
        border-color: var(--color-accent);
      }
    }
  }

  .resultados__ref {
    font-weight: 700;
    color: var(--color-accent-ink);
  }

  .resultados__texto {
    color: var(--color-ink-soft);
    font-size: 0.85rem;
    line-height: 1.4;
    // Dos líneas: lo justo para reconocer el versículo sin que la lista se
    // convierta en una página de lectura.
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .resultados__cuenta {
    margin: 0 0 0.5rem;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
  }

  // Centrado, en escritorio y en móvil: es una acción, no una línea de texto,
  // y alineada al margen izquierdo con toda la columna vacía a su derecha
  // parecía un enlace suelto que se había quedado ahí.
  .antesala__continuar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    margin: 0 auto 1.5rem;
    gap: 0.45rem;
    min-height: 2.6rem;
    padding: 0.55rem 1.15rem;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-pill);
    // Relleno de acento porque lleva texto encima: `--color-accent` a secas da
    // 3.30:1 y AA pide 4.5:1.
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    --icon-size: 1rem;

    &:hover {
      background: var(--color-accent-solid-hover);
    }
  }

  .atajos {
    padding: 1rem 1.15rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);

    h2 {
      margin: 0 0 0.6rem;
      font-size: 0.95rem;
      color: var(--color-ink-strong);
    }

    ul {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: 0.45rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--color-ink-soft);
      font-size: var(--font-size-small);
    }

    kbd {
      min-width: 1.6rem;
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--color-line-strong);
      border-bottom-width: 2px;
      border-radius: 0.3rem;
      background: var(--color-surface-raised);
      color: var(--color-ink);
      font-family: monospace;
      font-size: 0.78rem;
      text-align: center;
    }
  }

  // ── Proyección ────────────────────────────────────────────────────────────
  //
  // Capa fija a pantalla completa, como el Modo Amvon: es lo que impide que se
  // cuele la cabecera, el menú o un botón flotante de otra parte.
  //
  // La lámina (fondo, textos, referencia y marca de agua) vive en
  // ProjectionSurface.svelte, y la botonera con sus paneles en
  // ProjectionControls.svelte: las pintan las DOS ventanas, así que sus
  // estilos no pueden estar aquí.

  // Mitades invisibles para avanzar con el ratón o el dedo. Van por debajo de
  // los controles y los paneles, que necesitan sus propios clics.
  .zona {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    // Sin contorno de foco. Al hacer clic para avanzar, el botón se quedaba
    // enfocado y el navegador le pintaba su `outline`: como ocupa media
    // pantalla, el borde interior salía como una raya vertical oscura **en
    // mitad de la proyección**, por encima del texto. En cualquier otra
    // pantalla quitar el foco visible sería un error de accesibilidad; aquí el
    // teclado tiene sus propios atajos para todo y estos dos botones son un
    // atajo táctil, no la vía principal.
    outline: none;
    -webkit-tap-highlight-color: transparent;

    &::-moz-focus-inner {
      border: 0;
    }
  }

  .zona--anterior {
    left: 0;
  }
  .zona--siguiente {
    right: 0;
  }

  // ── Dos pantallas ─────────────────────────────────────────────────────────
  //
  // Esto SÍ usa la paleta del usuario: se mira en el portátil, antes de
  // empezar. La que no la usa es la lámina.
  // Centrado, igual que «Continuă»: son las dos formas de empezar y tienen que
  // leerse como un par, no como dos cosas pegadas a la izquierda.
  .dos-pantallas {
    display: grid;
    gap: 0.5rem;
    justify-items: center;
    text-align: center;
    margin: 1.25rem 0;
    padding: 1rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-md);
    background: var(--wash-accent);
  }

  .dos-pantallas__boton {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.6rem;
    padding: 0 1.1rem;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-pill);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-family: inherit;
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;
    --icon-size: 1.05rem;

    &:hover {
      background: var(--color-accent-solid-hover);
    }
  }

  .dos-pantallas__pista {
    max-width: 46ch;
    margin: 0;
    color: var(--color-ink-soft);
    font-size: 0.8rem;
    line-height: 1.45;
  }

  .dos-pantallas__aviso {
    margin: 0;
    color: var(--color-danger-ink);
    font-size: 0.8rem;
    font-weight: 600;
  }

  // Con la ventana ya colocada, esta caja deja de ser una invitación y pasa a
  // ser un estado: verde apagado en vez del acento, que es el color de «pulsa
  // aquí».
  .dos-pantallas--abierta {
    border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
  }

  .dos-pantallas__estado {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    color: var(--color-success-ink);
    font-size: var(--font-size-small);
    font-weight: 700;
    --icon-size: 1rem;
  }

  .dos-pantallas__cerrar {
    min-height: 2.25rem;
    padding: 0 0.9rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;

    &:hover {
      border-color: var(--color-danger);
      color: var(--color-danger-ink);
    }
  }

  // ── Volver a pantalla completa (ventana proyectada) ───────────────────────
  //
  // Grande y abajo del todo: se pulsa con el ratón en la pantalla del
  // proyector, sin precisión y con prisa. ABAJO y no en el centro porque en el
  // centro está el versículo — puesto ahí tapaba justo la línea que hay que
  // leer. Sólo existe fuera de pantalla completa, así que durante el culto no
  // se ve nunca.
  .volver-completa {
    position: absolute;
    bottom: 7%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 4;
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 3.25rem;
    padding: 0 1.6rem;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: var(--radius-pill);
    background: rgba(20, 24, 30, 0.88);
    color: #f2f4f7;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    --icon-size: 1.1rem;

    &:hover {
      background: rgba(20, 24, 30, 0.96);
      border-color: rgba(255, 255, 255, 0.45);
    }
  }

  // ── Consola del modo remoto ───────────────────────────────────────────────
  //
  // Franja fija abajo: la proyección está en la otra ventana, así que aquí no
  // hay nada que tapar y el buscador de arriba tiene que seguir accesible. Es
  // `fixed`, así que establece bloque contenedor para los `position: absolute`
  // de la botonera y de sus paneles.
  .consola {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 1rem;
    min-height: 4.5rem;
    padding: 0.7rem clamp(0.75rem, 4vw, 2rem);
    // Colores fijos, como la botonera que lleva dentro: es la continuación de
    // lo que se está proyectando, no una barra más de la aplicación.
    border-top: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(20, 24, 30, 0.97);
    color: #f2f4f7;
  }

  .consola__ahora {
    flex: 1 1 auto;
    min-width: 0;
  }

  .consola__eyebrow {
    margin: 0 0 0.1rem;
    color: #98a2b3;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .consola__ref {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .consola__ref--vacio {
    color: #98a2b3;
    font-weight: 600;
  }

  // Una sola línea: es un recordatorio de qué hay puesto, no el texto para
  // leerlo. Leerlo es lo que hace la congregación en la otra pantalla.
  .consola__texto {
    margin: 0;
    overflow: hidden;
    color: #aeb6c2;
    font-size: 0.82rem;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .consola__pasos {
    display: flex;
    gap: 0.4rem;
    flex: 0 0 auto;

    button {
      display: inline-grid;
      place-items: center;
      width: 2.6rem;
      height: 2.6rem;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 50%;
      background: transparent;
      color: #f2f4f7;
      cursor: pointer;
      --icon-size: 1.1rem;

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.12);
      }
      &:disabled {
        opacity: 0.3;
        cursor: default;
      }
    }
  }

  // La botonera va dentro de la franja y no flotando en una esquina: aquí no
  // hay lámina que respetar, así que se coloca en el flujo.
  // `transform: none` es obligatorio: la regla de móvil de la botonera la
  // centra con `translateX(-50%)`, y aquí va en el flujo — sin anularlo se
  // desplazaba media anchura hacia la izquierda y se salía de la franja.
  .consola :global(.controles) {
    position: static;
    transform: none;
    flex: 0 0 auto;
  }

  // Los paneles sí flotan, pero hacia ARRIBA: abajo está el borde de la
  // pantalla y se salían fuera.
  .consola :global(.panel) {
    bottom: calc(100% + 0.5rem);
  }

  // Y la página deja sitio para la franja, o el último resultado de la
  // búsqueda queda debajo y no hay forma de pulsarlo.
  .antesala--consola {
    padding-bottom: 7rem;
  }

  @media (max-width: 40rem) {
    .consola {
      flex-wrap: wrap;
      gap: 0.5rem 0.75rem;
    }

    .consola__ahora {
      flex-basis: 100%;
    }
  }

  // ── La ventana proyectada ─────────────────────────────────────────────────
  //
  // La instrucción de montaje, arriba y centrada: abajo a la derecha se habría
  // superpuesto con la marca de agua.
  .pista-pantalla {
    position: absolute;
    top: 1.25rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 4;
    max-width: min(34rem, calc(100vw - 2rem));
    margin: 0;
    padding: 0.6rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: var(--radius-pill);
    background: rgba(20, 24, 30, 0.9);
    color: #f2f4f7;
    font-size: 0.85rem;
    font-weight: 600;
    text-align: center;
  }
</style>
