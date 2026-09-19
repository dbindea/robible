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
  import { onDestroy, onMount, tick } from 'svelte';
  import DictadoBoton from '../../components/DictadoBoton.svelte';
  import Icon from '../../components/Icon.svelte';
  import ProjectionControls from '../../components/ProjectionControls.svelte';
  import ProjectionSurface from '../../components/ProjectionSurface.svelte';
  import { BIBLE_VERSIONS } from '../../config/bible-versions.js';
  import { getFilterResult } from '../../services/filter.service';
  import { _ } from '../../services/i18n.service';
  import {
    abrirCanal,
    abrirVentanaPantalla,
    estadoPermisoVentanas,
    leerGeometria,
    MENSAJES,
    pedirPermisoVentanas,
    soportaCanal,
  } from '../../services/projection-channel.service';
  import {
    anadirEntrada,
    cargarHistorial,
    guardarHistorial,
    limpiarHistorial,
  } from '../../services/projection-history.service';
  import {
    borrarImagenBlanco,
    ERROR_TAMANO,
    guardarImagenBlanco,
    selloImagenBlanco,
  } from '../../services/projection-blank.service';
  import {
    acotarOcupacion,
    cargarGeometriaPantalla,
    cargarPreferencias,
    guardarGeometriaPantalla,
    guardarPreferencias,
    OCUPACION_POR_DEFECTO,
  } from '../../services/projection.service';
  import { getLastRead } from '../../services/reading-progress.service';
  import { parseReference, searchReferences } from '../../services/referenceSearch.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { keepScreenAwake } from '../../services/sermon-pulpit.service';
  import { textoDeVersiculo } from '../../services/versification.service';
  import {
    compareWithVersion,
    getBibleVersionConfigOrDefault,
    initCompareVersion,
    selectedBibleVersion,
  } from '../../store/stores';

  export let bible = [];
  export let map = {};
  export let compareBible = [];
  export let compareMap = {};
  /**
   * Biblia a scroll (`/scroll`): la misma pantalla, pero se entra ya leyendo.
   *
   * Arranca sola por donde se quedó la última vez —o por Geneza 1— y pone el
   * modo lectura **en cualquier tamaño**, no sólo en el móvil: es una ruta que
   * se anuncia en la portada y está en el menú, así que abrirla en un portátil
   * y encontrarse el buscador de la proyección sería un enlace roto.
   */
  export let modoScroll = false;

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
  $: versionSecundariaConfig = $compareWithVersion ? getBibleVersionConfigOrDefault($compareWithVersion) : null;

  // `noindex` y sin traducir por idioma: es una herramienta del dispositivo, no
  // contenido que se comparta. Una sola URL para las cuatro versiones.
  // `noindex` las dos: son herramientas del dispositivo, no contenido que se
  // comparta — y el texto bíblico ya se indexa en `/biblia/…`. Lo que sí se
  // indexa es la presentación de la portada, que es la que las anuncia.
  $: applySeoMetadata({
    title: $_(modoScroll ? 'app.projection.scroll_seo_title' : 'app.projection.seo_title'),
    description: $_(modoScroll ? 'app.projection.scroll_seo_description' : 'app.projection.seo_description'),
    canonicalPath: modoScroll ? '/scroll' : '/proiectie',
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

  /**
   * El proyector está libre: RoBible no tiene ninguna ventana encima de él.
   *
   * Es el estado que hacía falta para un culto de verdad. En el proyector no
   * sólo van versículos —hay canciones, un vídeo, un anuncio—, y hasta ahora
   * ceder el sitio significaba cerrar la proyección y volver a colocarla a mano
   * delante de la congregación. Y ponerla en negro no basta: una ventana en
   * negro **sigue siendo una ventana**, tapa lo que haya debajo y el programa
   * de las canciones se queda por detrás sin que nada lo explique.
   *
   * Así que ceder la pantalla CIERRA la ventana del proyector. Es lo único que
   * deja ver de verdad lo que hay detrás —el escritorio de la iglesia, con su
   * logotipo— y lo único que permite a otro programa ponerse delante. Lo que
   * se guarda son sus coordenadas, así que recuperarla es un clic y vuelve al
   * mismo sitio con el mismo versículo puesto.
   *
   * `modo` sigue valiendo 'remoto' mientras tanto: la lista, el índice y los
   * ajustes no se tocan. Lo único que ha desaparecido es la ventana.
   */
  let pantallaLibre = false;
  /** Dónde estaba la ventana del proyector. Ver `projection.service.js`. */
  let geometriaPantalla = null;

  // Preferencias persistidas. Se leen en `onMount` y no aquí: en el arranque del
  // módulo `localStorage` puede no estar listo en algunos navegadores.
  let prefs = {
    fondo: 'night',
    animacion: 'fade',
    ocupacion: OCUPACION_POR_DEFECTO,
    segundoIdioma: false,
    invertido: false,
  };

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
    // La Biblia va como cuarto argumento para que no se ofrezca lo que no
    // existe: «ioan 4 4» sugería también 2 Ioan 4:4 y 3 Ioan 4:4, y esos dos
    // libros tienen UN capítulo. Pulsarlo no llevaba a ninguna parte, y aquí se
    // pulsa con prisa y con la congregación delante.
    sugerencias = consultaRef.trim().length >= 2 ? searchReferences(consultaRef, map, 6, bible) : [];
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
    // Al historial va el versículo ELEGIDO, no los que vengan detrás al
    // avanzar: recorriendo un capítulo se proyectan cuarenta y ninguno es una
    // referencia que nadie vaya a volver a buscar.
    apuntarEnHistorial(lista[indice]);
    if (modo === 'antesala') modo = 'local';
    enNegro = false;
    panelAbierto = '';
    mostrarControles();
  };

  /**
   * El capítulo que se está recorriendo, para poder seguir más allá de él.
   *
   * `null` cuando lo que hay en pantalla NO es un capítulo sino el resultado de
   * una búsqueda por texto: ahí son versículos de libros distintos y «seguir»
   * no significa nada.
   */
  let recorriendo = null; // { book, chapter }

  const empezarDesde = (book, chapter, verse) => {
    const lista = construirPasajes(book, chapter);
    if (!lista.length) return;
    recorriendo = { book, chapter };
    arrancar(lista, Number.isInteger(verse) && verse > 1 ? verse - 1 : 0);
  };

  /**
   * El capítulo siguiente (o el anterior), saltando de libro cuando toca.
   *
   * Da la vuelta al llegar a Apocalipsa: quien lee en el móvil un domingo por
   * la noche no tiene por qué encontrarse con un botón muerto. La Biblia es un
   * ciclo, y volver a Geneza 1 es una respuesta mejor que no hacer nada.
   */
  const capituloVecino = ({ book, chapter }, paso) => {
    const capsDe = (b) => bible?.[b]?.length || 0;

    if (paso > 0) {
      if (chapter < capsDe(book)) return { book, chapter: chapter + 1 };
      const siguienteLibro = book + 1 < 66 ? book + 1 : 0;
      return { book: siguienteLibro, chapter: 1 };
    }

    if (chapter > 1) return { book, chapter: chapter - 1 };
    const anteriorLibro = book - 1 >= 0 ? book - 1 : 65;
    return { book: anteriorLibro, chapter: capsDe(anteriorLibro) || 1 };
  };

  /**
   * Salta al capítulo de al lado y coloca el cursor donde corresponde:
   * al principio si se va hacia delante, al final si se va hacia atrás.
   *
   * Se salta cualquier capítulo que quede vacío en esta versión —pasa con las
   * ediciones que omiten un pasaje entero— en vez de dejar la pantalla en
   * blanco. El tope de 5 saltos es una guarda contra una Biblia rota: sin él,
   * un array vacío haría un bucle infinito en mitad del culto.
   */
  const irACapituloVecino = (paso) => {
    if (!recorriendo) return false;

    let destino = recorriendo;
    for (let intento = 0; intento < 5; intento += 1) {
      destino = capituloVecino(destino, paso);
      const lista = construirPasajes(destino.book, destino.chapter);
      if (lista.length) {
        recorriendo = destino;
        pasajes = lista;
        indice = paso > 0 ? 0 : lista.length - 1;
        return true;
      }
    }
    return false;
  };

  const empezarDesdeSugerencia = (s) => empezarDesde(s.book, s.chapter, s.verse);

  const empezarDesdeConsulta = () => {
    const encontrado = parseReference(consultaRef, map, bible) || sugerencias[0];
    if (encontrado) empezarDesdeSugerencia(encontrado);
  };

  // Los resultados de una búsqueda por texto se proyectan TAL CUAL, como lista:
  // son versículos de libros distintos y no tendría sentido saltar al capítulo
  // de cada uno. Es justo lo que se quiere para un tema («toate versetele
  // despre dragoste») proyectado uno detrás de otro.
  const empezarDesdeTexto = (i) => {
    recorriendo = null;
    arrancar(resultadosTexto, i);
  };

  // ── Contexto ──────────────────────────────────────────────────────────────
  //
  // Los versículos de alrededor del que está proyectado, en la consola del
  // operador. Es la pantalla de trabajo, no la de la iglesia.
  //
  // Para qué: el predicador no lee un capítulo seguido. Dice «y tres versículos
  // más abajo…» y hay que encontrarlo en dos segundos. Con el contexto delante
  // no hay que buscar nada: está escrito ahí y se pulsa.
  //
  // Va el CAPÍTULO ENTERO y no una ventana de unos pocos versículos. Empezó
  // siendo cinco arriba y diez abajo, y el salto que se quería cubrir se sale
  // de ahí en cuanto el predicador dice «y más adelante, en el 28». Con la
  // columna llegando hasta abajo hay sitio de sobra, el versículo proyectado se
  // centra solo, y por debajo quedan las flechas de capítulo: nunca falta nada.

  /**
   * Se calcula contra la Biblia y NO contra `pasajes`, y esa es la gracia:
   * cuando lo proyectado es una búsqueda por expresión, `pasajes` son versículos
   * de libros distintos y no tienen contexto entre ellos. El contexto siempre es
   * el del capítulo del versículo que está en pantalla.
   *
   * Se lee `actual` y `bible` directamente, sin envolverlo en un helper: metido
   * en una función el compilador no ve la dependencia y la columna se quedaría
   * congelada en el primer versículo (trampa 23).
   */
  $: contexto = (() => {
    if (!actual) return [];
    const versos = bible?.[actual.book]?.[actual.chapter - 1] || [];
    if (!versos.length) return [];
    const lista = [];
    for (let v = 1; v <= versos.length; v += 1) {
      const texto = String(versos[v - 1] || '').trim();
      if (texto) lista.push({ verse: v, texto });
    }
    return lista;
  })();

  /** La cabecera de la columna: de qué capítulo se está viendo el contexto. */
  $: referenciaContexto = actual && map[actual.book] ? `${map[actual.book]} ${actual.chapter}` : '';

  let cajaContexto = null;

  /**
   * Deja el versículo proyectado a la vista dentro de su columna.
   *
   * Se calcula el `scrollTop` a mano en vez de usar `scrollIntoView`: ese
   * desplaza también a los antepasados, y con la columna pegajosa dentro de una
   * página larga movía la página entera cada vez que se cambiaba de versículo.
   * La caja lleva `position: relative` para que `offsetTop` se mida contra ella
   * y no contra lo primero que haya posicionado más arriba — es la misma
   * lección del selector de capítulos.
   */
  const enfocarContexto = async () => {
    await tick();
    // El nodo se copia a una variable local antes de escribirle: asignando
    // directamente sobre `cajaContexto`, el analizador lo lee como «esta
    // función modifica una variable reactiva» y avisa de un bucle que no
    // existe. Aquí sólo se mueve el scroll de un elemento.
    const caja = cajaContexto;
    const nodo = caja?.querySelector('[data-activo="1"]');
    if (!caja || !nodo) return;
    caja.scrollTop = nodo.offsetTop - caja.clientHeight / 2 + nodo.offsetHeight / 2;
  };

  $: if (actual) enfocarContexto();

  /**
   * Saltar a un versículo del contexto.
   *
   * Si ya se está recorriendo ese capítulo basta con mover el cursor: cambiar
   * la lista tiraría el sitio por el que se iba. Si lo proyectado es una
   * búsqueda por expresión, entonces sí se pasa a recorrer el capítulo, que es
   * lo que el operador está pidiendo al pulsar un versículo de alrededor.
   */
  const irAVersiculoDelContexto = (verse) => {
    if (!actual) return;
    const enLaLista =
      recorriendo && recorriendo.book === actual.book && recorriendo.chapter === actual.chapter
        ? pasajes.findIndex((p) => p.verse === verse)
        : -1;
    if (enLaLista >= 0) {
      indice = enLaLista;
      panelAbierto = '';
      apuntarEnHistorial(pasajes[enLaLista]);
    } else {
      empezarDesde(actual.book, actual.chapter, verse);
    }
  };

  /**
   * Cambiar de CAPÍTULO. En horizontal se navega por capítulos y en vertical
   * por versículos: son dos ejes distintos y confundirlos era justo lo que
   * hacía falta tocar el ratón a mitad de una lectura.
   *
   * Sirve igual cuando lo proyectado es un capítulo (se sigue recorriendo) que
   * cuando es una búsqueda por expresión: ahí `recorriendo` vale `null`, así que
   * se toma el capítulo del versículo que esté en pantalla y se empieza a
   * recorrer el de al lado.
   */
  const irACapitulo = (paso) => {
    panelAbierto = '';
    if (recorriendo) {
      if (irACapituloVecino(paso)) apuntarEnHistorial(pasajes[indice]);
      return;
    }
    if (!actual) return;
    const destino = capituloVecino({ book: actual.book, chapter: actual.chapter }, paso);
    empezarDesde(destino.book, destino.chapter);
  };

  // Hacia atrás siempre hay capítulo —se da la vuelta en Geneza 1— así que los
  // botones sólo se apagan cuando no hay nada proyectado.
  $: hayCapitulos = !!actual;

  // ── Modo lectura del móvil ────────────────────────────────────────────────
  //
  // En un móvil esta pantalla no es un proyector: es alguien leyendo la Biblia
  // con el versículo a toda página. Ahí, ir de uno en uno tocando media
  // pantalla es peor que deslizar, así que la lámina se convierte en una lista
  // encajada —una pantalla por versículo— que **no se acaba**: al llegar al
  // final se engancha el capítulo siguiente, y después el libro siguiente.
  //
  // Sólo en el móvil y sólo proyectando en esta misma pantalla. En el proyector
  // manda el operador, no el dedo, y un deslizamiento sin querer delante de la
  // congregación es justo lo que no puede pasar.
  let esMovil = false;
  $: modoLectura = (esMovil || modoScroll) && modo === 'local' && !esPantalla;

  /** Cuántos versículos antes del final se trae ya el capítulo siguiente. */
  const MARGEN_LECTURA = 3;

  $: versiculosLectura = modoLectura
    ? pasajes.map((p) => ({
        clave: `${p.book}-${p.chapter}-${p.verse}`,
        principal: { texto: p.texto, referencia: p.referencia, version: versionConfig?.bibleName || '' },
        secundario: prefs.segundoIdioma
          ? {
              texto: textoDeVersiculo(compareBible, $compareWithVersion, p.book, p.chapter, p.verse),
              referencia: compareMap?.[p.book] ? `${compareMap[p.book]} ${p.chapter}:${p.verse}` : '',
              version: versionSecundariaConfig?.bibleName || '',
            }
          : { texto: '', referencia: '', version: '' },
      }))
    : null;

  /**
   * Se ha deslizado hasta otro versículo.
   *
   * Además de mover el cursor, mira si queda poco para el final y engancha el
   * capítulo siguiente. Se añade AL FINAL y nunca al principio: prepender
   * obligaría a corregir el `scrollTop` en el mismo fotograma y el salto se ve.
   * Hacia atrás se llega con las flechas de capítulo.
   */
  const alVerVersiculo = (visible) => {
    if (visible < 0 || visible >= pasajes.length) return;
    indice = visible;
    if (!recorriendo || visible < pasajes.length - MARGEN_LECTURA) return;

    const destino = capituloVecino(recorriendo, 1);
    const lista = construirPasajes(destino.book, destino.chapter);
    if (!lista.length) return;
    recorriendo = destino;
    pasajes = [...pasajes, ...lista];
  };

  // ── Historial ─────────────────────────────────────────────────────────────
  //
  // Lo que ya se ha proyectado, para cuando el predicador vuelve sobre ello.
  // El detalle de qué se apunta y por qué está en el servicio.
  let historial = [];

  const apuntarEnHistorial = (pasaje) => {
    // La Biblia a scroll no apunta nada: el historial es «lo que el operador ha
    // puesto en la pantalla de la iglesia», y leer en el sofá no es eso. Sin
    // esta guarda, abrir `/scroll` metía una entrada automática en cada visita
    // y la lista del culto se llenaba de ruido.
    if (modoScroll || !pasaje) return;
    historial = anadirEntrada(historial, {
      book: pasaje.book,
      chapter: pasaje.chapter,
      verse: pasaje.verse,
      referencia: pasaje.referencia,
      texto: pasaje.texto,
      version: $selectedBibleVersion,
    });
    guardarHistorial(historial);
  };

  const desdeElHistorial = (e) => empezarDesde(e.book, e.chapter, e.verse);

  const vaciarHistorial = () => {
    historial = [];
    limpiarHistorial();
  };

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
  // Lo que suben y bajan estos dos es **cuánto de la pantalla llena el texto**,
  // no el cuerpo de la letra: el cuerpo lo calcula la lámina para cada
  // versículo. Cinco puntos por pulsación, que es el salto más pequeño que se
  // nota desde la última fila.
  const PASO_OCUPACION = 5;

  const masGrande = () => {
    prefs.ocupacion = acotarOcupacion(prefs.ocupacion + PASO_OCUPACION);
    persistir();
  };
  const masPequeno = () => {
    prefs.ocupacion = acotarOcupacion(prefs.ocupacion - PASO_OCUPACION);
    persistir();
  };

  /** El porcentaje escrito a mano en el campo de la botonera. */
  const fijarOcupacion = (valor) => {
    prefs.ocupacion = acotarOcupacion(valor);
    persistir();
  };

  // ── La imagen de la pantalla en blanco ────────────────────────────────────
  //
  // La elige la iglesia y se queda en el dispositivo. Aquí sólo vive el SELLO:
  // la imagen la lee cada ventana de su propio disco, porque mandarla por el
  // canal sería copiar megabytes en cada cambio de versículo.
  let selloBlanco = '';
  let avisoBlanco = '';

  const ponerImagenBlanco = async (file) => {
    avisoBlanco = '';
    try {
      selloBlanco = await guardarImagenBlanco(file);
    } catch (error) {
      avisoBlanco = $_(
        error?.message === ERROR_TAMANO ? 'app.projection.blank_image_too_big' : 'app.projection.blank_image_invalid',
      );
    }
  };

  const quitarImagenBlanco = async () => {
    avisoBlanco = '';
    await borrarImagenBlanco();
    selloBlanco = '';
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
   * La rueda del ratón cambia cuánto de la pantalla ocupa el texto.
   *
   * Es el reflejo de cualquiera que se sienta delante de una pantalla, y aquí
   * no compite con nada: la proyección no tiene scroll. `preventDefault` evita
   * que el gesto se lo quede la página de debajo.
   *
   * Dos puntos por muesca, menos que los cinco de los botones: con la rueda se
   * hacen varios clics seguidos sin querer y a saltos grandes se pasa de largo.
   */
  const alGirarRueda = (e) => {
    e.preventDefault();
    prefs.ocupacion = acotarOcupacion(prefs.ocupacion + (e.deltaY < 0 ? 2 : -2));
    persistir();
    mostrarControles();
  };

  // ── Navegación ────────────────────────────────────────────────────────────
  //
  // Avanzar cierra cualquier panel abierto: si el operador estaba mirando los
  // fondos y pasa al versículo siguiente, ya no está eligiendo.
  //
  // Y al llegar al último versículo NO se para: sigue en el capítulo siguiente,
  // y al acabar el libro, en el siguiente libro. Se pidió leyendo en el móvil, y
  // tiene razón — un lector que llega al final de Geneza 1 quiere Geneza 2, no
  // un botón que deja de responder. Lo mismo hacia atrás.
  const siguiente = () => {
    panelAbierto = '';
    if (haySiguiente) indice += 1;
    else irACapituloVecino(1);
  };
  const anterior = () => {
    panelAbierto = '';
    if (hayAnterior) indice -= 1;
    else irACapituloVecino(-1);
  };
  const alternarNegro = () => {
    enNegro = !enNegro;
  };

  /**
   * Quitar el versículo de la pantalla y dejar sólo el fondo.
   *
   * No es lo mismo que la pantalla en negro ni que salir de la proyección: la
   * proyección sigue en marcha, con su fondo, su marca y su reloj, pero sin
   * texto. Hacía falta al recuperar el proyector después de una canción: lo que
   * volvía era el último versículo puesto, y lo que se quiere ahí es el fondo
   * limpio hasta que el predicador diga la referencia siguiente.
   *
   * Se tira también `recorriendo`: sin versículo no hay capítulo que seguir, y
   * dejarlo apuntando al anterior haría que las flechas de capítulo saltaran a
   * un sitio que el operador ya no tiene en pantalla.
   */
  const limpiarVersiculo = () => {
    pasajes = [];
    indice = 0;
    recorriendo = null;
    enNegro = false;
    panelAbierto = '';
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
    modo = (ventanaPantalla && !ventanaPantalla.closed) || pantallaLibre ? 'remoto' : 'antesala';
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
    // Va también el nombre de la versión: la lámina lo pinta entre paréntesis
    // bajo cada traducción, y esa ventana no tiene el catálogo de versiones.
    principal: { texto: principal.texto, referencia: principal.referencia, version: principal.version },
    secundario: { texto: secundario.texto, referencia: secundario.referencia, version: secundario.version },
    fondoKey: prefs.fondo,
    ocupacion: prefs.ocupacion,
    selloBlanco,
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
    pantallaLibre = false;
    enNegro = false;
    panelAbierto = '';
    pasajes = [];
  };

  /**
   * Ceder el proyector a otro programa, y recuperarlo.
   *
   * Ceder cierra la ventana; recuperar la vuelve a abrir en las mismas
   * coordenadas y le manda el estado con el saludo, así que reaparece con el
   * mismo versículo. Entre medias, en el proyector se ve lo que la iglesia
   * tenga de fondo de escritorio y cualquier otro programa puede ponerse
   * delante sin pelearse con nosotros.
   *
   * No hay forma de dejar una ventana del navegador transparente ni de mandarla
   * detrás desde JavaScript: cerrarla es lo único que libera la pantalla de
   * verdad. Por eso todo lo caro —dónde está el proyector, qué se estaba
   * proyectando— se guarda aquí en la consola, que no se cierra.
   */
  const cederPantalla = () => {
    // Se apunta dónde está ANTES de moverla, que es la única ocasión de
    // saberlo. Y es la medida buena: dice dónde la dejó el operador de verdad
    // —pantalla completa incluida— en vez de dónde cree la API que está el
    // segundo monitor.
    const donde = leerGeometria(ventanaPantalla);
    if (donde) {
      geometriaPantalla = donde;
      guardarGeometriaPantalla(donde);
    }

    // Se le pide que se cierre, y se cierra ella: así puede salir antes de
    // pantalla completa. Cerrarla es lo único que libera el proyector de
    // verdad — una ventana en negro sigue tapando lo que haya debajo.
    //
    // Si no hay canal (la ventana ya no está) se cierra lo que quede y se marca
    // el proyector como libre igual.
    if (canal && ventanaPantalla && !ventanaPantalla.closed) {
      canal.enviar({ tipo: MENSAJES.CEDER });
    } else if (ventanaPantalla && !ventanaPantalla.closed) {
      cerrarVentanaPantalla();
    }
    pantallaLibre = true;
    panelAbierto = '';
  };

  /**
   * Recuperar el proyector: la ventana se vuelve a abrir **donde estaba**.
   *
   * Las coordenadas se apuntaron al ceder, leyéndolas de la propia ventana, así
   * que reaparece en la segunda pantalla sin que nadie la arrastre. Lo único
   * que no puede hacerse desde aquí es la pantalla completa: eso exige un gesto
   * dentro de esa ventana. Se intenta sola y, si el navegador no la deja, basta
   * un clic en cualquier punto de ella.
   *
   * Sin `async`: `window.open` tiene que salir del propio gesto o el bloqueador
   * de emergentes la descarta en silencio.
   */
  const recuperarPantalla = () => {
    if (ventanaPantalla && !ventanaPantalla.closed) {
      ventanaPantalla.focus();
      return;
    }
    abrirSegundaPantalla();
  };

  const alternarCesion = () => {
    if (pantallaLibre) recuperarPantalla();
    else cederPantalla();
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
      // Saluda una ventana: o es la que se acaba de abrir, o es la misma
      // después de recargarse. En los dos casos hay que mandarle el estado y
      // dar el proyector por recuperado.
      pantallaLibre = false;
      canal?.enviar({ tipo: MENSAJES.ESTADO, estado: estadoPantalla });
    } else if (mensaje.tipo === MENSAJES.CERRANDO) {
      // `pagehide` no distingue un cierre de una RECARGA, así que aquí no se
      // cierra nada: ni la ventana ni el canal. Si era una recarga, el `listo`
      // que llega un instante después la reconecta sola; cerrando el canal —y
      // de paso la ventana, que es lo que hacía— pulsar F5 en el proyector la
      // mataba del todo, que es justo el reflejo de cualquiera cuando algo se
      // queda raro en mitad de un culto.
      //
      // El cierre de verdad lo confirma el vigilante, que es el único que mira
      // `closed`, y para entonces ya se ha visto si vuelve o no.
      pantallaLibre = true;
    } else if (mensaje.tipo === MENSAJES.TECLA) {
      manejarTecla(mensaje.key, { desdeLaPantalla: true });
    }
  };

  // Sin `async`: `window.open` tiene que ejecutarse dentro del clic o el
  // navegador bloquea la ventana (ver `abrirVentanaPantalla`).
  const abrirSegundaPantalla = () => {
    // Se le pasan las coordenadas de la última vez para que nazca ya en el
    // proyector: colocarla es lo único caro de todo esto, y se hace una vez por
    // culto en vez de una vez por canción.
    ventanaPantalla = abrirVentanaPantalla(geometriaPantalla, (destino) => {
      geometriaPantalla = destino;
      guardarGeometriaPantalla(destino);
    });
    // Un bloqueador de ventanas emergentes devuelve null. No es un fallo de la
    // aplicación y hay que decirlo, o el botón parece roto.
    if (!ventanaPantalla) {
      avisoPantalla = $_('app.projection.window_blocked');
      return;
    }
    avisoPantalla = '';
    canal = abrirCanal(alRecibirDeLaPantalla);
    modo = 'remoto';
    pantallaLibre = false;
    panelAbierto = '';
    // Si el operador cierra la ventana con la cruz del sistema no llega ningún
    // evento a esta: `closed` es la única forma de enterarse.
    clearInterval(vigilanteVentana);
    vigilanteVentana = setInterval(() => {
      if (ventanaPantalla?.closed) {
        cerrarVentanaPantalla();
        pantallaLibre = true;
      }
    }, 1000);
  };

  let avisoPantalla = '';

  /**
   * Si el navegador nos deja colocar la ventana en la otra pantalla.
   *
   * 'granted' | 'prompt' | 'denied' | 'unsupported'. Importa enseñarlo: **sin
   * ese permiso Chrome recorta las coordenadas a la pantalla actual**, así que
   * por muy bien que recordemos dónde estaba el proyector, al recuperarlo la
   * ventana reaparece en el portátil y hay que arrastrarla otra vez. Sin un
   * aviso, eso parece un fallo de la aplicación.
   */
  let permisoVentanas = 'prompt';

  const revisarPermiso = async () => {
    permisoVentanas = await estadoPermisoVentanas();
  };

  const solicitarPermiso = async () => {
    permisoVentanas = await pedirPermisoVentanas();
  };

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
   * La acción de cada tecla, separada del evento.
   *
   * **Dos ejes.** En vertical se cambia de VERSÍCULO y en horizontal de
   * CAPÍTULO. Es la forma en que se lee de verdad —se avanza versículo a
   * versículo y de vez en cuando se salta de capítulo— y separarlo así evita
   * tener que tocar el ratón a mitad de una lectura.
   *
   * AvPág y RePág siguen cambiando de versículo aunque sean «horizontales» en
   * el teclado: son las que emiten los mandos de presentación para pasar de
   * diapositiva, y ahí lo que se espera es el versículo siguiente.
   *
   * Está aparte del evento porque las teclas llegan de DOS sitios: del teclado
   * de esta ventana y, por el canal, del de la ventana proyectada — el mando de
   * presentación puede tener el foco en cualquiera de las dos y tiene que
   * funcionar igual.
   *
   * `desdeLaPantalla` marca las que vienen por el canal: ahí la pantalla
   * completa la maneja la ventana proyectada, que es la que está en el
   * proyector, así que esta no hace nada con la tecla F.
   */
  const manejarTecla = (key, { desdeLaPantalla = false } = {}) => {
    switch (key) {
      case 'ArrowDown':
      case 'PageDown':
      case 'Enter':
        siguiente();
        break;
      case 'ArrowUp':
      case 'PageUp':
      case 'Backspace':
        anterior();
        break;
      case 'ArrowRight':
        irACapitulo(1);
        break;
      case 'ArrowLeft':
        irACapitulo(-1);
        break;
      case 'Delete':
        limpiarVersiculo();
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

  /**
   * Las teclas que consumimos. Las demás siguen su curso.
   *
   * **Espacio ya no está.** Avanzaba un versículo, y es la tecla que se pulsa
   * sin pensar para bajar una página: se proyectaba el versículo siguiente sin
   * querer. Para avanzar están AvPág, Intro y la flecha abajo.
   */
  const TECLAS = new Set([
    'ArrowRight',
    'ArrowDown',
    'PageDown',
    'Enter',
    'ArrowLeft',
    'ArrowUp',
    'PageUp',
    'Backspace',
    'Delete',
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

  /**
   * Las dos que funcionan **tenga el foco donde lo tenga**, incluso escribiendo.
   *
   * Es el reparto que pidió el uso real de la consola: mientras se teclea la
   * referencia siguiente hay que poder mover el versículo que está en la
   * pantalla de la iglesia, sin tocar el ratón ni salir del campo. Arriba y
   * abajo hacen eso; izquierda y derecha se quedan para mover el cursor dentro
   * del texto, que es lo que cualquiera espera de ellas dentro de un campo.
   *
   * Fuera de un campo, izquierda y derecha cambian de capítulo.
   */
  const TECLAS_AUNQUE_SE_ESCRIBA = new Set(['ArrowUp', 'ArrowDown']);

  /**
   * Ceder y recuperar el proyector va con un TOQUE de Mayúsculas.
   *
   * Es la tecla que se encuentra a oscuras sin mirar, que es la condición del
   * puesto. Pero Mayúsculas es también un modificador, así que se actúa al
   * SOLTARLA y sólo si entre medias no se ha pulsado nada más: si no, escribir
   * una mayúscula en el buscador —o un Mayús+clic— cerraría la proyección. Por
   * eso hace falta este pequeño estado en vez de un `case` más.
   */
  let mayusculasSola = false;

  const desarmarMayusculas = () => {
    mayusculasSola = false;
  };

  const alSoltarTecla = (e) => {
    if (e.key !== 'Shift') return;
    const armada = mayusculasSola;
    mayusculasSola = false;
    if (!armada || modo !== 'remoto') return;
    alternarCesion();
  };

  const alPulsarTecla = (e) => {
    if (!proyectando) return;

    // Mayúsculas se arma al pulsarla y se desarma con cualquier otra tecla.
    if (e.key === 'Shift') {
      if (!e.repeat) mayusculasSola = true;
      return;
    }
    mayusculasSola = false;

    if (!TECLAS.has(e.key)) return;
    // Un atajo del navegador (Ctrl+L, Alt+←…) no es una tecla de proyección.
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // Si se está escribiendo en un campo, las teclas son texto y no atajos.
    //
    // No es teórico: el Enter que arranca la proyección desde el buscador
    // seguía burbujeando hasta aquí, y como para entonces ya se estaba
    // proyectando, avanzaba un versículo en el mismo gesto. Se empezaba siempre
    // en el segundo versículo del capítulo sin que nada lo explicara.
    const donde = e.target?.tagName;
    const escribiendo = donde === 'INPUT' || donde === 'TEXTAREA' || e.target?.isContentEditable;
    if (escribiendo && !TECLAS_AUNQUE_SE_ESCRIBA.has(e.key)) return;

    // Y con un botón enfocado, Espacio y Enter son «pulsa este botón». En la
    // proyección a pantalla completa daba igual porque no había botones que
    // recibieran el foco; en la consola del modo remoto están todos a la vista,
    // y sin esto avanzar de versículo también disparaba el botón enfocado.
    if (donde === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;

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

  // En el modo lectura la barra no se saca sin querer: se pide con un gesto
  // aparte, así que aguanta más antes de irse. No hay puntero que la mantenga
  // viva mientras se la mira, y cuatro segundos se acaban leyendo los iconos.
  const ESPERA_LECTURA_MS = 8000;

  const mostrarControles = () => {
    controlesVisibles = true;
    clearTimeout(ocultarControlesTimer);
    // No se ocultan con el puntero encima: el operador está usándolos, y que se
    // desvanezcan mientras los miras es de las cosas que más enfadan.
    const espera = panelAbierto ? ESPERA_PANEL_MS : modoLectura ? ESPERA_LECTURA_MS : ESPERA_CONTROLES_MS;
    ocultarControlesTimer = setTimeout(() => {
      if (punteroEncima) return;
      panelAbierto = '';
      controlesVisibles = false;
    }, espera);
  };

  /**
   * Los gestos del dedo, y son DOS reglas distintas.
   *
   * **Proyectando**, un TOQUE enseña la barra y un arrastre no. Antes bastaba
   * con `touchstart`, así que cualquier gesto la sacaba. El umbral son 12 px:
   * por debajo de eso nadie está arrastrando, es el temblor del pulgar.
   *
   * **En el modo lectura** eso no vale, y por eso hay dos reglas. Ahí el dedo
   * está en la pantalla todo el rato pasando versículos, y un golpe rápido
   * —que recorre poco aunque lleve mucha velocidad— contaba como toque: la
   * barra salía sola cada dos o tres versículos, justo encima de lo que se
   * estaba leyendo. Así que leyendo **no se enseña con el toque**: se enseña y
   * se esconde deslizando DE LADO, que es el único gesto que ahí no significa
   * nada más, porque el scroll es vertical.
   *
   * Y entra por el lado hacia el que se ha deslizado: si el dedo va a la
   * derecha, la barra viene de la izquierda, detrás de él.
   */
  const MOVIMIENTO_MAXIMO_TOQUE = 12;
  /** Lo que hay que recorrer de lado para que cuente como gesto, no como roce. */
  const DESLIZAMIENTO_MINIMO = 60;
  let toqueInicio = null;
  /** 'izq' | 'der' — de qué borde entra la barra. */
  let ladoControles = 'der';
  /** La pista del gesto, hasta que se usa por primera vez. */
  let pistaGesto = true;

  const alEmpezarToque = (e) => {
    const t = e.touches?.[0];
    toqueInicio = t ? { x: t.clientX, y: t.clientY } : null;
  };

  const alTerminarToque = (e) => {
    if (!toqueInicio) return;
    const t = e.changedTouches?.[0];
    const dx = t ? t.clientX - toqueInicio.x : 0;
    const dy = t ? t.clientY - toqueInicio.y : 0;
    toqueInicio = null;
    if (!t) return;

    if (!modoLectura) {
      if (Math.hypot(dx, dy) < MOVIMIENTO_MAXIMO_TOQUE) mostrarControles();
      return;
    }

    // De lado y con intención: el `1.4` descarta las diagonales de un scroll
    // vertical hecho con el pulgar, que siempre se va un poco de lado.
    if (Math.abs(dx) < DESLIZAMIENTO_MINIMO || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    pistaGesto = false;
    if (controlesVisibles) {
      clearTimeout(ocultarControlesTimer);
      panelAbierto = '';
      controlesVisibles = false;
      return;
    }
    ladoControles = dx > 0 ? 'izq' : 'der';
    mostrarControles();
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
    principal: { texto: '', referencia: '', version: '' },
    secundario: { texto: '', referencia: '', version: '' },
    fondoKey: 'night',
    ocupacion: OCUPACION_POR_DEFECTO,
    animacion: 'fade',
    indice: 0,
    enNegro: false,
    selloBlanco: '',
  };
  let enPantallaCompleta = false;

  /** Las pantallas del equipo, cacheadas al montar. */
  let detallesPantallas = null;

  /**
   * Pantalla completa, apuntando al proyector si sabemos cuál es.
   *
   * **Tiene que salir de un gesto EN ESTA ventana.** La pantalla completa exige
   * activación del usuario en el documento que la pide, y eso no se puede pedir
   * desde la consola por el canal. Se intenta sola al montar —una ventana
   * abierta desde un clic a veces hereda la activación— y, cuando no cuela,
   * **toda la superficie es el botón**: un clic en cualquier punto, sin nada
   * escrito por encima que haya que acertar.
   *
   * Hubo una versión que, en vez de cerrar la ventana al ceder, la apartaba al
   * portátil para que un clic suyo la devolviera al proyector sin pasar por
   * F11. Se retiró el 19 sep 2026: la ventanita tapaba la consola y dejaba al
   * operador sin poder trabajar, que es peor que el clic que venía a ahorrar.
   */
  const ponerPantallaCompleta = async () => {
    const proyector = detallesPantallas?.screens?.find((p) => !p.isPrimary);
    try {
      if (proyector) await document.documentElement.requestFullscreen({ screen: proyector });
      else await document.documentElement.requestFullscreen();
    } catch {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Si el navegador no deja, queda F11.
      }
    }
  };

  const montarPantalla = () => {
    const suCanal = abrirCanal((mensaje) => {
      if (mensaje?.tipo === MENSAJES.ESTADO) estadoRecibido = mensaje.estado;
      // La consola pide el proyector libre: cerrarse es lo único que lo libera
      // de verdad — una ventana, aunque esté en negro, sigue tapando lo que
      // haya debajo y ningún otro programa puede ponerse delante.
      else if (mensaje?.tipo === MENSAJES.CEDER) window.close();
    });
    // El saludo: la ventana de control responde con el estado actual. Sin esto
    // la pantalla se queda en negro hasta que alguien cambie de versículo.
    suCanal.enviar({ tipo: MENSAJES.LISTO });

    // Las pantallas, cacheadas al montar. Se necesitan en un manejador de clic
    // —para volver al proyector a pantalla completa— y ahí no se puede esperar
    // a una promesa sin gastar la activación del usuario.
    if ('getScreenDetails' in window) {
      window
        .getScreenDetails()
        .then((d) => (detallesPantallas = d))
        .catch(() => {
          /* sin permiso: se cae al plan B, que es cerrar la ventana al ceder */
        });
    }

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
      // Fuera de pantalla completa, la PRIMERA tecla la pone a pantalla
      // completa en vez de reenviarse. Entrar exige un gesto en ESTA ventana
      // —no se puede pedir desde la consola por el canal—, y cuando el intento
      // automático no cuela, esto evita tener que ir a dar un clic al proyector
      // delante de la congregación: se recupera con Mayúsculas y se remata con
      // cualquier tecla, sin soltar el teclado.
      if (!document.fullscreenElement) {
        ponerPantallaCompleta();
        return;
      }
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

    // Se intenta entrar solo. Una ventana recién abierta desde un clic hereda
    // la activación del usuario en algunas configuraciones y entra sin más; en
    // el resto, el navegador exige un gesto EN ESTA ventana y esto no hace nada
    // — para eso está el botón, y toda la superficie es pulsable. Cuesta una
    // línea y ahorra un clic delante de la congregación cada vez que se
    // recupera el proyector.
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
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
    geometriaPantalla = cargarGeometriaPantalla();
    historial = cargarHistorial();
    selloBlanco = selloImagenBlanco();
    revisarPermiso();
    ultimaLectura = getLastRead();
    // Si quedó encendido el segundo idioma de una sesión anterior, hay que
    // volver a pedir la Biblia: `compareWithVersion` arranca en null.
    if (prefs.segundoIdioma) initCompareVersion();

    // En `/scroll` no hay antesala: se empieza a leer por donde se quedó. El
    // `+ 1` convierte el índice de capítulo (base 0, como lo guarda la lectura)
    // al número — NO es «el capítulo siguiente». Sin nada guardado, Geneza 1,
    // que es por donde se empieza una Biblia.
    if (modoScroll) {
      if (ultimaLectura) empezarDesde(ultimaLectura.book, ultimaLectura.chapter + 1);
      else empezarDesde(0, 1);
    }
    // El modo lectura depende del ancho, y el ancho cambia al girar el móvil.
    const anchoMovil = window.matchMedia('(max-width: 40rem)');
    const mirarAncho = () => (esMovil = anchoMovil.matches);
    mirarAncho();
    anchoMovil.addEventListener('change', mirarAncho);

    window.addEventListener('keydown', alPulsarTecla);
    window.addEventListener('keyup', alSoltarTecla);
    // Un Mayús+clic no es un toque de Mayúsculas, y salir de la ventana con la
    // tecla apretada dejaría el toque «armado» hasta la próxima vez.
    window.addEventListener('mousedown', desarmarMayusculas);
    window.addEventListener('blur', desarmarMayusculas);
    return () => {
      anchoMovil.removeEventListener('change', mirarAncho);
      window.removeEventListener('keydown', alPulsarTecla);
      window.removeEventListener('keyup', alSoltarTecla);
      window.removeEventListener('mousedown', desarmarMayusculas);
      window.removeEventListener('blur', desarmarMayusculas);
    };
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
    ocupacion={estadoRecibido.ocupacion}
    animacion={estadoRecibido.animacion}
    indice={estadoRecibido.indice}
    enNegro={estadoRecibido.enNegro}
    selloBlanco={estadoRecibido.selloBlanco}
  >
    <!-- Fuera de pantalla completa, TODA la ventana es el botón que la pone.
         El navegador exige un gesto en esta ventana para entrar —no se puede
         pedir desde la consola por el canal—, así que lo que se puede hacer es
         que ese gesto no tenga que acertar en ningún sitio: el operador da un
         clic en cualquier punto del proyector y ya está. En pantalla completa
         no existe, así que durante el culto no hay nada que pueda pulsarse sin
         querer. -->
    <!-- Sin rótulo ni botón visibles, a propósito desde el 19 sep 2026: había
         una pista arriba y un «Ecran complet» abajo, y lo que provocaban era
         justo lo contrario de lo que buscaban — el operador apuntaba con el
         ratón a uno de los dos en vez de dar el clic donde cayera. Lo que queda
         es la superficie entera: un clic en cualquier punto, sin puntería. -->
    {#if !enPantallaCompleta}
      <button
        type="button"
        class="pedir-completa"
        aria-label={$_('app.projection.screen_fullscreen')}
        on:click={ponerPantallaCompleta}
      ></button>
    {/if}
  </ProjectionSurface>
{:else if modo !== 'local'}
  <!-- ── Antesala y consola ───────────────────────────────────────────── -->
  <!-- En la antesala esto es una columna y no hace nada. En cuanto la
       proyección se va al segundo monitor, esta ventana pasa a ser la mesa de
       trabajo del operador y se abre en tres: buscador, contexto e historial.
       Sólo en escritorio — en un móvil no hay dos monitores que operar. -->
  <div class="taller" class:taller--consola={modo === 'remoto'}>
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
          {#if permisoVentanas !== 'granted' && permisoVentanas !== 'unsupported'}
            <div class="permiso">
              <p>{$_('app.projection.permission_hint')}</p>
              <button type="button" on:click={solicitarPermiso}>{$_('app.projection.permission_ask')}</button>
            </div>
          {/if}
          {#if avisoPantalla}
            <p class="dos-pantallas__aviso" role="alert">{avisoPantalla}</p>
          {/if}
        </div>
      {:else if modo === 'remoto'}
        <!-- Dos estados, y la diferencia importa en mitad de un culto: o nuestra
           ventana está en el proyector, o el proyector está libre para que lo
           use otro programa. Ceder y recuperar es lo que se hace entre una
           canción y la lectura, así que ambos botones están aquí y en la tecla
           C — y el estado se ve de un vistazo, sin mirar al proyector. -->
        <div
          class="dos-pantallas"
          class:dos-pantallas--abierta={!pantallaLibre}
          class:dos-pantallas--libre={pantallaLibre}
        >
          {#if pantallaLibre}
            <p class="dos-pantallas__estado dos-pantallas__estado--libre">
              <Icon name="monitor" size="1rem" />
              {$_('app.projection.screen_free')}
            </p>
            <p class="dos-pantallas__pista">{$_('app.projection.screen_free_hint')}</p>
            <button type="button" class="dos-pantallas__boton" on:click={recuperarPantalla}>
              <Icon name="monitor" />
              {$_('app.projection.resume')}
            </button>
            <button type="button" class="dos-pantallas__cerrar" on:click={cerrarProyeccion}>
              {$_('app.projection.session_end')}
            </button>
            <!-- Aquí es donde más duele: sin permiso, «recuperar» devuelve la
                 ventana al portátil en vez de al proyector, y eso parece un
                 fallo nuestro. Se dice antes de que pase. -->
            {#if permisoVentanas !== 'granted' && permisoVentanas !== 'unsupported'}
              <div class="permiso">
                <p>{$_('app.projection.permission_hint')}</p>
                <button type="button" on:click={solicitarPermiso}>{$_('app.projection.permission_ask')}</button>
              </div>
            {/if}
          {:else}
            <p class="dos-pantallas__estado">
              <Icon name="monitor" size="1rem" />
              {$_('app.projection.screen_open')}
            </p>
            <p class="dos-pantallas__pista">{$_('app.projection.screen_open_hint')}</p>
            <button type="button" class="dos-pantallas__boton" on:click={cederPantalla}>
              <Icon name="collapse" />
              {$_('app.projection.yield')}
            </button>
            <button type="button" class="dos-pantallas__cerrar" on:click={cerrarProyeccion}>
              {$_('app.projection.screen_close')}
            </button>
          {/if}
          {#if avisoPantalla}
            <p class="dos-pantallas__aviso" role="alert">{avisoPantalla}</p>
          {/if}
        </div>
      {/if}

      <!-- Las teclas se enseñan ANTES de empezar, no durante: en mitad del culto
         no hay dónde mirarlas, y quien proyecta las repasa mientras prepara. -->
      <div class="atajos">
        <h2>{$_('app.projection.keys_title')}</h2>
        <ul>
          <li><kbd>↓</kbd> <span>{$_('app.projection.key_next')}</span></li>
          <li><kbd>↑</kbd> <span>{$_('app.projection.key_prev')}</span></li>
          <li><kbd>→</kbd> <span>{$_('app.projection.key_next_chapter')}</span></li>
          <li><kbd>←</kbd> <span>{$_('app.projection.key_prev_chapter')}</span></li>
          <li><kbd>Shift</kbd> <span>{$_('app.projection.key_yield')}</span></li>
          <li><kbd>Supr</kbd> <span>{$_('app.projection.clear_verse')}</span></li>
          <li><kbd>N</kbd> <span>{$_('app.projection.key_black')}</span></li>
          <li><kbd>F</kbd> <span>{$_('app.projection.key_fullscreen')}</span></li>
          <li><kbd>L</kbd> <span>{$_('app.projection.panel_language')}</span></li>
          <li><kbd>S</kbd> <span>{$_('app.projection.key_swap')}</span></li>
          <li><kbd>+</kbd> <kbd>−</kbd> <span>{$_('app.projection.key_size')}</span></li>
          <li><kbd>Esc</kbd> <span>{$_('app.projection.key_exit')}</span></li>
        </ul>
        <!-- El reparto de las flechas no se adivina, y es justo lo que hace que
           se pueda escribir la referencia siguiente sin soltar la proyección. -->
        <p class="atajos__nota">{$_('app.projection.keys_arrows_hint')}</p>
      </div>
    </section>

    <!-- ── Contexto ─────────────────────────────────────────────────────── -->
    <!-- Los versículos de alrededor del que está en la pantalla de la iglesia.
         Existe porque el predicador salta: «y tres más abajo…». Pulsando uno se
         proyecta, sin escribir la referencia. -->
    {#if modo === 'remoto'}
      <aside class="columna columna--contexto">
        <div class="columna__cabecera">
          <h2 class="columna__titulo">{$_('app.projection.context_title')}</h2>
          <!-- De qué capítulo. Con las flechas de abajo se cambia de capítulo
               sin tocar el buscador, así que hay que poder ver dónde se está. -->
          {#if referenciaContexto}
            <p class="columna__ref">{referenciaContexto}</p>
          {/if}
        </div>
        {#if contexto.length}
          <div class="columna__caja" bind:this={cajaContexto}>
            {#each contexto as v (v.verse)}
              <button
                type="button"
                class="contexto__verso"
                class:contexto__verso--activo={actual && v.verse === actual.verse}
                data-activo={actual && v.verse === actual.verse ? '1' : '0'}
                on:click={() => irAVersiculoDelContexto(v.verse)}
              >
                <span class="contexto__num">{v.verse}</span>
                <span class="contexto__texto">{v.texto}</span>
              </button>
            {/each}
          </div>
        {:else}
          <p class="columna__vacio">{$_('app.projection.context_empty')}</p>
        {/if}

        <!-- Capítulo anterior y siguiente, el mismo eje que las flechas ← y →
             del teclado: en horizontal se cambia de capítulo y en vertical de
             versículo. Nunca se apagan por estar al principio o al final de un
             libro, porque se salta al libro de al lado. -->
        <div class="contexto__capitulos">
          <button
            type="button"
            disabled={!hayCapitulos}
            on:click={() => irACapitulo(-1)}
            aria-label={$_('app.projection.key_prev_chapter')}
            title={$_('app.projection.key_prev_chapter')}
          >
            <Icon name="arrow-left" />
          </button>
          <span>{$_('app.projection.chapter_nav')}</span>
          <button
            type="button"
            disabled={!hayCapitulos}
            on:click={() => irACapitulo(1)}
            aria-label={$_('app.projection.key_next_chapter')}
            title={$_('app.projection.key_next_chapter')}
          >
            <Icon name="arrow-right" />
          </button>
        </div>
      </aside>

      <!-- ── Historial ──────────────────────────────────────────────────── -->
      <!-- Lo ya proyectado, lo más reciente arriba. Sobrevive al refresco y al
           reinicio: está en localStorage. -->
      <aside class="columna">
        <div class="columna__cabecera">
          <h2 class="columna__titulo">{$_('app.projection.history_title')}</h2>
          {#if historial.length}
            <button type="button" class="columna__accion" on:click={vaciarHistorial}>
              {$_('app.projection.history_clear')}
            </button>
          {/if}
        </div>
        {#if historial.length}
          <div class="columna__caja">
            {#each historial as e (`${e.book}-${e.chapter}-${e.verse}`)}
              <button type="button" class="historial__item" on:click={() => desdeElHistorial(e)}>
                <span class="historial__ref">{e.referencia}</span>
                <span class="historial__texto">{e.texto}</span>
              </button>
            {/each}
          </div>
        {:else}
          <p class="columna__vacio">{$_('app.projection.history_empty')}</p>
        {/if}
      </aside>
    {/if}
  </div>

  <!-- ── Consola del modo remoto ─────────────────────────────────────── -->
  <!-- La proyección está en la OTRA ventana. Aquí queda lo que el operador
       necesita ver sin tapar el buscador: qué hay puesto ahora mismo y los
       mismos controles de siempre. -->
  {#if modo === 'remoto'}
    <!-- La rueda del ratón sobre la franja cambia la ocupación, igual que sobre
         la lámina. Hace falta aquí porque en el modo de dos pantallas la lámina
         está en el proyector y el operador no pasa el ratón por ella: sin esto,
         el ajuste con la rueda existía sólo en el caso de una sola pantalla.
         Va en la franja y no en toda la página para no secuestrar el
         desplazamiento de la lista de resultados, que puede ser larga.
         `|nonpassive` porque el manejador llama a `preventDefault`. -->
    <div class="consola" on:wheel|nonpassive={alGirarRueda}>
      <!-- El versículo que hay puesto es además el interruptor de verlo o no
           verlo: se pulsa y desaparece del proyector, se vuelve a pulsar y
           vuelve. Es el objetivo más grande de la franja y el que la mano
           encuentra sin mirar, que es lo que hace falta entre dos frases del
           predicador. El botón del ojo sigue donde estaba para quien lo tenga
           aprendido.
           Es un <button> y no un <div> con `on:click`: así responde también al
           teclado y se anuncia como conmutador. -->
      <button
        type="button"
        class="consola__ahora"
        class:consola__ahora--apagado={enNegro}
        disabled={pantallaLibre || !principal.referencia}
        aria-pressed={!enNegro}
        title={$_(enNegro ? 'app.projection.toggle_show' : 'app.projection.toggle_hide')}
        on:click={alternarNegro}
      >
        <span class="consola__eyebrow">{$_('app.projection.on_screen')}</span>
        {#if pantallaLibre}
          <!-- Lo primero que hay que poder contestar sin levantar la vista:
               ¿está RoBible en el proyector o no? -->
          <span class="consola__ref consola__ref--libre">{$_('app.projection.screen_free')}</span>
        {:else if enNegro}
          <span class="consola__ref">{$_('app.projection.key_black')}</span>
        {:else if principal.referencia}
          <span class="consola__ref">{principal.referencia}</span>
          <span class="consola__texto">{principal.texto}</span>
        {:else}
          <span class="consola__ref consola__ref--vacio">{$_('app.projection.screen_waiting')}</span>
        {/if}
      </button>

      <div class="consola__pasos">
        <!-- Sólo se apagan cuando de verdad no hay adónde ir: con un capítulo
             en marcha siempre lo hay, porque se salta al de al lado. -->
        <button
          type="button"
          disabled={!hayAnterior && !recorriendo}
          on:click={anterior}
          aria-label={$_('app.projection.key_prev')}
        >
          <Icon name="arrow-left" />
        </button>
        <button
          type="button"
          disabled={!haySiguiente && !recorriendo}
          on:click={siguiente}
          aria-label={$_('app.projection.key_next')}
        >
          <Icon name="arrow-right" />
        </button>
        <!-- Dejar el fondo limpio, sin versículo. Al lado de las flechas
             porque se usa entre pasaje y pasaje, no al terminar. -->
        <button
          type="button"
          disabled={!pasajes.length}
          on:click={limpiarVersiculo}
          title={$_('app.projection.clear_verse')}
          aria-label={$_('app.projection.clear_verse')}
        >
          <Icon name="trash" />
        </button>
        <!-- Ceder y recuperar el proyector, a mano y sin buscar nada: es lo
             que más veces se pulsa en un culto después de avanzar. Marcado en
             ámbar cuando la pantalla está cedida, que es un estado que no
             puede pasar desapercibido. -->
        <button
          type="button"
          class="consola__ceder"
          class:consola__ceder--libre={pantallaLibre}
          on:click={alternarCesion}
          title={pantallaLibre ? $_('app.projection.resume') : $_('app.projection.yield')}
          aria-label={pantallaLibre ? $_('app.projection.resume') : $_('app.projection.yield')}
        >
          <Icon name={pantallaLibre ? 'monitor' : 'collapse'} />
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
        onOcupacion={fijarOcupacion}
        {selloBlanco}
        {avisoBlanco}
        onImagenBlanco={ponerImagenBlanco}
        onQuitarBlanco={quitarImagenBlanco}
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
  <!-- `versiculos` sólo llega en el móvil: es lo que convierte la lámina en la
       lista deslizable. La rueda se desconecta ahí, porque en ese modo desplaza
       en vez de cambiar el tamaño — y en un móvil no hay rueda. -->
  <ProjectionSurface
    {principal}
    {secundario}
    fondoKey={prefs.fondo}
    ocupacion={prefs.ocupacion}
    animacion={prefs.animacion}
    {indice}
    {enNegro}
    {selloBlanco}
    versiculos={versiculosLectura}
    onVisible={alVerVersiculo}
    on:mousemove={modoLectura ? () => {} : mostrarControles}
    on:touchstart={alEmpezarToque}
    on:touchend={alTerminarToque}
    on:wheel={modoLectura ? () => {} : alGirarRueda}
  >
    <!-- Zonas de toque para avanzar sin teclado: la mitad derecha avanza, la
         izquierda retrocede. Invisibles a propósito — es una pantalla, no una
         interfaz.

         En el modo lectura NO se ponen: van por encima de todo y se tragarían
         el deslizamiento, que ahí es la forma de pasar de versículo. -->
    {#if !modoLectura}
      <button type="button" class="zona zona--anterior" aria-label={$_('app.projection.key_prev')} on:click={anterior}
      ></button>
      <button type="button" class="zona zona--siguiente" aria-label={$_('app.projection.key_next')} on:click={siguiente}
      ></button>
    {/if}

    <!-- El gesto no se adivina, así que se dice una vez: sale con la barra
         mientras no se haya usado, y desaparece para siempre en cuanto se
         desliza. No se guarda en ningún sitio — que vuelva a salir en la
         sesión siguiente no molesta a nadie y sí ayuda a quien lo olvidó. -->
    {#if modoLectura && pistaGesto && controlesVisibles}
      <p class="pista-gesto">{$_('app.projection.swipe_hint')}</p>
    {/if}

    <ProjectionControls
      {prefs}
      {panelAbierto}
      {indice}
      total={pasajes.length}
      visibles={controlesVisibles}
      lado={modoLectura ? ladoControles : ''}
      onPanel={alternarPanel}
      onSalir={salir}
      onMasGrande={masGrande}
      onMasPequeno={masPequeno}
      onOcupacion={fijarOcupacion}
      {selloBlanco}
      {avisoBlanco}
      onImagenBlanco={ponerImagenBlanco}
      onQuitarBlanco={quitarImagenBlanco}
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

  // ── La mesa de trabajo ────────────────────────────────────────────────────
  //
  // En la antesala no hace nada: una columna centrada, como siempre. Cuando la
  // proyección se va al segundo monitor, esta ventana deja de ser una pantalla
  // de lectura y pasa a ser la mesa del operador, con el contexto y el
  // historial a la derecha.
  //
  // Sólo a partir de 64 rem. Por debajo no hay sitio para tres columnas, y
  // apiladas empujarían el buscador —lo único que se usa con prisa— fuera de
  // la pantalla. Quien proyecta desde un móvil no tiene dos monitores que
  // operar: para eso está el modo local.
  .taller {
    width: 100%;
  }

  @media (min-width: 64rem) {
    .taller--consola {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 21rem 17rem;
      // `stretch` y no `start`: es lo que iguala el alto de las tres columnas
      // sin decirlo en píxeles. Las dos de la derecha acaban exactamente donde
      // acaba la izquierda —es decir, donde acaba la caja de teclas— en vez de
      // bajar hasta el borde de la pantalla, que dejaba dos cajas larguísimas
      // medio vacías.
      align-items: stretch;
      gap: 1.5rem;
      max-width: 84rem;
      margin: 0 auto;
      // Lo que la columna izquierda reserva por debajo para la franja de la
      // consola. Está aquí y no repetido en dos sitios porque las columnas de
      // la derecha tienen que descontar exactamente lo mismo, o dejan de
      // cuadrar por abajo.
      --reserva-consola: 7rem;
      // El alto EXACTO de la fila de flechas de capítulo. Se declara aquí
      // porque lo usan dos reglas que tienen que cuadrar entre sí: la que fija
      // esa fila y la que deja bajar la columna del contexto justo eso.
      --fila-capitulos: 2.75rem;

      .antesala {
        max-width: none;
        margin: 0;
      }
    }
  }

  // Las dos columnas de la derecha. Fuera del escritorio no existen.
  .columna {
    display: none;
  }

  @media (min-width: 64rem) {
    .taller--consola .columna {
      // Columna flexible: la caja de dentro se estira y el resto —cabecera y,
      // en el contexto, las flechas de capítulo— ocupa lo suyo.
      display: flex;
      flex-direction: column;
      // El alto lo pone el `stretch` de la rejilla, que es el de la columna
      // izquierda. Lo único que hay que descontar es el relleno que esa columna
      // reserva para la franja de la consola: sin restarlo, estas dos bajarían
      // 7 rem por debajo de la caja de teclas.
      margin-bottom: var(--reserva-consola);
    }

    // El contexto baja exactamente el alto de su fila de flechas. Así las DOS
    // cajas acaban en la misma línea —la de la caja de teclas— y por debajo de
    // ella sólo asoman los botones, que es lo único que puede bajar.
    .taller--consola .columna--contexto {
      margin-bottom: calc(var(--reserva-consola) - var(--fila-capitulos));
    }
  }

  .columna__cabecera {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .columna__titulo {
    margin: 0 0 0.5rem;
    color: var(--color-ink-strong);
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  // De qué capítulo es el contexto. Va en la cabecera y no dentro de la caja
  // para que no se desplace con ella.
  .columna__ref {
    margin: 0 0 0.5rem;
    color: var(--color-accent-ink);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .columna__accion {
    padding: 0.15rem 0.5rem;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    font: inherit;
    font-size: 0.75rem;
    cursor: pointer;

    &:hover {
      color: var(--color-danger-ink);
    }
  }

  // `position: relative` no es decorativo: el desplazamiento del contexto se
  // calcula con `offsetTop`, que se mide contra el antepasado posicionado más
  // cercano. Sin esto se mediría contra otra cosa y la caja saltaría a un sitio
  // cualquiera en cada versículo.
  .columna__caja {
    position: relative;
    // `align-content: start` y no `grid` a secas: con la caja estirada hasta
    // abajo y pocos versículos, las filas se repartían el hueco y salían
    // separadas por dedos de aire.
    display: grid;
    align-content: start;
    gap: 0.25rem;
    // `flex: 1 1 0` y no `1 1 auto`, y esto es lo que hace que la rejilla
    // cuadre: con base `auto`, el alto que esta caja aporta al cálculo es el de
    // TODO su contenido —un capítulo entero son miles de píxeles—, así que la
    // fila de la rejilla crecía por su culpa y estiraba también la columna de
    // la izquierda, que acababa 97 px por debajo de la caja de teclas. Con base
    // cero no aporta nada y el alto lo manda quien debe: la columna izquierda.
    // `min-height: 0` es obligatorio por lo mismo: sin él la caja se niega a
    // encoger por debajo de su contenido.
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    padding: 0.35rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  // `margin-bottom: auto` empuja hacia abajo lo que venga después —las flechas
  // de capítulo— en vez de dejar un recuadro punteado de pantalla y media.
  .columna__vacio {
    margin: 0 0 auto;
    padding: 0.85rem;
    border: 1px dashed var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-ink-soft);
    font-size: 0.8rem;
    line-height: 1.45;
  }

  // ── Contexto ──────────────────────────────────────────────────────────────
  .contexto__verso {
    display: grid;
    grid-template-columns: 1.6rem minmax(0, 1fr);
    gap: 0.5rem;
    width: 100%;
    padding: 0.4rem 0.45rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-ink);
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--wash-hover);
    }
  }

  // El que está en la pantalla de la iglesia. Verde, que es lo que significa
  // «versículo en lectura» en toda la aplicación.
  .contexto__verso--activo {
    background: color-mix(in srgb, var(--color-success) 16%, transparent);

    .contexto__num,
    .contexto__texto {
      color: var(--color-success-ink);
      font-weight: 600;
    }
  }

  .contexto__num {
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: right;
    // Alineado con la primera línea del texto, que va a otro tamaño.
    padding-top: 0.1rem;
  }

  .contexto__texto {
    font-size: 0.82rem;
    line-height: 1.45;
  }

  // ── Capítulo anterior / siguiente ─────────────────────────────────────────
  //
  // Debajo del contexto y en horizontal, que es el eje que les corresponde: las
  // mismas dos flechas del teclado. Pegado al fondo de la columna porque es una
  // salida, no parte de la lista.
  // Alto fijo, no el de su contenido: el cálculo que deja bajar la columna del
  // contexto justo esta fila (`--fila-capitulos`) depende de que midan lo
  // mismo. 0,5 rem de margen + 2,25 rem de botón = 2,75 rem.
  .contexto__capitulos {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    flex: 0 0 auto;
    height: 2.25rem;
    margin-top: 0.5rem;

    span {
      color: var(--color-ink-soft);
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: var(--letter-spacing-eyebrow);
    }

    button {
      display: inline-grid;
      place-items: center;
      // 2.25rem = 36 px, por encima del mínimo de 24 px de WCAG 2.5.8.
      width: 2.25rem;
      height: 2.25rem;
      border: 1px solid var(--color-line-strong);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-ink);
      cursor: pointer;
      --icon-size: 1rem;

      &:hover:not(:disabled) {
        border-color: var(--color-accent);
        color: var(--color-accent-ink);
      }

      &:disabled {
        opacity: 0.35;
        cursor: default;
      }
    }
  }

  // ── Historial ─────────────────────────────────────────────────────────────
  .historial__item {
    display: grid;
    gap: 0.1rem;
    width: 100%;
    padding: 0.4rem 0.5rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-ink);
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--wash-hover);
    }
  }

  .historial__ref {
    color: var(--color-accent-ink);
    font-size: 0.8rem;
    font-weight: 700;
  }

  // Una sola línea: es un recordatorio, no el versículo para leerlo.
  .historial__texto {
    overflow: hidden;
    color: var(--color-ink-soft);
    font-size: 0.75rem;
    white-space: nowrap;
    text-overflow: ellipsis;
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
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--color-line-strong);
      border-bottom-width: 2px;
      border-radius: 0.3rem;
      background: var(--color-surface-raised);
      color: var(--color-ink);
      font-family: monospace;
      font-size: 0.78rem;
      text-align: center;
      // Sin esto «Shift» se parte por la mitad dentro de su tecla y se lee
      // «Shi / ft»: la rejilla de la leyenda es estrecha y el `min-width` del
      // `kbd` no impide que el texto de dentro se envuelva.
      white-space: nowrap;
    }
  }

  .atajos__nota {
    margin: 0.7rem 0 0;
    color: var(--color-ink-soft);
    font-size: 0.8rem;
    line-height: 1.45;
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

  // El permiso de gestión de ventanas. Es un aviso, no un error: sin él todo
  // funciona, sólo que la ventana hay que arrastrarla a mano cada vez.
  .permiso {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    max-width: 46ch;
    margin-top: 0.35rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);

    p {
      margin: 0;
      color: var(--color-ink-soft);
      font-size: 0.78rem;
      line-height: 1.45;
    }

    button {
      min-height: 2.25rem;
      padding: 0 0.9rem;
      border: 1px solid var(--color-accent);
      border-radius: var(--radius-pill);
      background: transparent;
      color: var(--color-accent-ink);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;

      &:hover {
        background: var(--wash-accent);
      }
    }
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

  // Pantalla cedida: ni verde (proyectando) ni acento (pulsa aquí). Es una
  // pausa, y se pinta como tal — pero el texto lo dice, que es lo que se lee
  // con prisa.
  .dos-pantallas--libre {
    border-color: var(--color-line-strong);
    background: var(--wash-hover);
  }

  .dos-pantallas__estado--libre {
    color: var(--color-ink-strong);
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

  // ── La pista del gesto (modo lectura) ─────────────────────────────────────
  //
  // Encima de la barra y con su mismo tratamiento: acompaña a los controles y
  // se va con ellos. `pointer-events: none` porque queda sobre la zona por la
  // que se desliza — es la lección de la pista de montaje, que se tragaba el
  // único clic que explicaba.
  .pista-gesto {
    position: absolute;
    left: 50%;
    bottom: 4.1rem;
    transform: translateX(-50%);
    z-index: 3;
    max-width: calc(100vw - 2rem);
    margin: 0;
    padding: 0.4rem 0.8rem;
    border-radius: var(--radius-pill);
    background: rgba(20, 24, 30, 0.86);
    color: #f2f4f7;
    font-size: 0.74rem;
    font-weight: 600;
    text-align: center;
    pointer-events: none;
  }

  // ── Pantalla completa desde la ventana proyectada ─────────────────────────
  //
  // Toda la ventana es el botón. El navegador exige un gesto EN ESTA ventana
  // para entrar a pantalla completa —no vale pedirlo desde la consola por el
  // canal—, así que lo único que se puede hacer es que ese gesto no requiera
  // puntería: un clic en cualquier parte del proyector. Sólo existe fuera de
  // pantalla completa, así que durante el culto no hay nada que pulsar.
  //
  // Sin contorno de foco por lo mismo que las zonas de avance: ocupa la
  // pantalla entera y el borde interior se vería como un marco oscuro.
  .pedir-completa {
    position: absolute;
    inset: 0;
    z-index: 3;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    outline: none;
    -webkit-tap-highlight-color: transparent;

    &::-moz-focus-inner {
      border: 0;
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

  // Es un botón, así que hay que deshacer lo que el navegador le pone y dejarlo
  // con la pinta de siempre: un bloque de texto alineado a la izquierda.
  .consola__ahora {
    flex: 1 1 auto;
    min-width: 0;
    display: block;
    padding: 0.3rem 0.5rem;
    margin: -0.3rem -0.5rem;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background var(--motion-base) ease,
      border-color var(--motion-base) ease;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.18);
    }

    // Sin versículo puesto —o con el proyector cedido— no hay nada que apagar:
    // se queda como el texto que era, sin manita ni reacción.
    &:disabled {
      cursor: default;
    }
  }

  // Apagado: el filete de la izquierda dice de un vistazo que lo que se lee
  // aquí NO se está viendo allí. Sin él, la franja era igual con la pantalla
  // encendida y con la pantalla en negro.
  .consola__ahora--apagado {
    border-color: rgba(255, 255, 255, 0.22);
    box-shadow: inset 3px 0 0 #f5b544;
  }

  .consola__eyebrow {
    display: block;
    margin: 0 0 0.1rem;
    color: #98a2b3;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .consola__ref {
    display: block;
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .consola__ref--vacio {
    color: #98a2b3;
    font-weight: 600;
  }

  // «El proyector está libre». Es el estado que no puede confundirse con
  // ninguno: si el operador cree que está proyectando y no lo está, habla de un
  // versículo que nadie ve.
  .consola__ref--libre {
    color: #f2f4f7;
  }

  // Una sola línea: es un recordatorio de qué hay puesto, no el texto para
  // leerlo. Leerlo es lo que hace la congregación en la otra pantalla.
  .consola__texto {
    display: block;
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

  // Ceder / recuperar el proyector. Encendido cuando la pantalla está cedida,
  // que es el estado del que hay que acordarse para volver.
  //
  // El selector va con el contenedor delante y no suelto: la regla de arriba
  // (`.consola__pasos button`) tiene una clase y un elemento, así que una clase
  // sola perdería y el botón se quedaría exactamente igual que los otros dos.
  .consola__pasos .consola__ceder--libre {
    border-color: rgba(255, 255, 255, 0.55);
    background: rgba(255, 255, 255, 0.2);
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
    padding-bottom: var(--reserva-consola, 7rem);
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
</style>
