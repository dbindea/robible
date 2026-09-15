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
  import { fade, fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
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
  import { IMAGE_BACKGROUNDS, backgroundCss, getBackground } from '../../services/verse-image.service';
  import { ANIMACIONES, cargarPreferencias, guardarPreferencias } from '../../services/projection.service';
  import Icon from '../../components/Icon.svelte';
  import DictadoBoton from '../../components/DictadoBoton.svelte';

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

  // ── Estado ────────────────────────────────────────────────────────────────
  let proyectando = false;
  let pasajes = [];        // [{ book, chapter, verse, texto, referencia }]
  let indice = 0;
  let enNegro = false;
  let controlesVisibles = true;
  let ocultarControlesTimer;
  let soltarPantalla = null;
  let panelAbierto = '';   // '' | 'fondo' | 'animacion' | 'idioma'

  // Preferencias persistidas. Se leen en `onMount` y no aquí: en el arranque del
  // módulo `localStorage` puede no estar listo en algunos navegadores.
  let prefs = { fondo: 'night', animacion: 'fade', escala: 1, segundoIdioma: false, invertido: false };

  $: fondo = getBackground(prefs.fondo);
  $: fondoCss = backgroundCss(fondo);

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
  $: textoSecundario =
    prefs.segundoIdioma && actual
      ? String(compareBible?.[actual.book]?.[actual.chapter - 1]?.[actual.verse - 1] || '').trim()
      : '';
  $: referenciaSecundaria =
    prefs.segundoIdioma && actual && compareMap?.[actual.book]
      ? `${compareMap[actual.book]} ${actual.chapter}:${actual.verse}`
      : '';

  // Qué va arriba (grande) y qué abajo (pequeño). `invertido` sólo cambia el
  // orden de pintado: no toca la versión activa de la aplicación, que es de lo
  // que depende todo lo demás (rutas, voz, SEO).
  $: principal = prefs.invertido && textoSecundario
    ? { texto: textoSecundario, referencia: referenciaSecundaria, version: versionSecundariaConfig?.bibleName || '' }
    : { texto: actual?.texto || '', referencia: actual?.referencia || '', version: versionConfig?.bibleName || '' };
  $: secundario = prefs.invertido && textoSecundario
    ? { texto: actual?.texto || '', referencia: actual?.referencia || '', version: versionConfig?.bibleName || '' }
    : { texto: textoSecundario, referencia: referenciaSecundaria, version: versionSecundariaConfig?.bibleName || '' };

  const persistir = () => guardarPreferencias(prefs);

  /**
   * Una sola transición para las cuatro opciones, elegida en tiempo de
   * ejecución. Antes había un `in:fade` en la lámina y otro `in:fly`/`in:scale`
   * en un `<div>` interior según el ajuste; con una sola función no hay dos
   * capas que puedan discrepar.
   *
   * **Tiene que usarse con `|global`.** En Svelte las transiciones son locales
   * por defecto, y «local» significa que NO se reproducen cuando quien crea el
   * elemento es un bloque contenedor — que es justo el caso: lo recrea el
   * `{#key indice}` al cambiar de versículo. El síntoma era exacto: animaba el
   * primer versículo (montaje) y ninguno de los siguientes.
   */
  const animarEntrada = (node, { tipo }) => {
    switch (tipo) {
      case 'fade': return fade(node, { duration: 260, easing: cubicOut });
      // Sube un poco al entrar: leído de lejos, el movimiento vertical se nota
      // más que el horizontal y no arrastra la vista fuera de la pantalla.
      case 'slide': return fly(node, { y: 34, duration: 320, easing: cubicOut });
      case 'zoom': return scale(node, { start: 0.94, duration: 300, easing: cubicOut, opacity: 0 });
      default: return { duration: 0 };
    }
  };

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

  const arrancar = (lista, desde = 0) => {
    if (!lista.length) return;
    pasajes = lista;
    indice = Math.min(Math.max(desde, 0), lista.length - 1);
    proyectando = true;
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
      // El `+ 1` convierte el índice de capítulo (base 0, como lo guarda la
      // lectura) al número que se enseña. NO es «el capítulo siguiente».
      ? `${map[ultimaLectura.book]} ${ultimaLectura.chapter + 1}`
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
  const elegirFondo = (key) => { prefs.fondo = key; persistir(); cerrarPanel(); };
  const elegirAnimacion = (key) => { prefs.animacion = key; persistir(); cerrarPanel(); };
  const masGrande = () => { prefs.escala = Math.min(prefs.escala + 0.1, 2); persistir(); };
  const masPequeno = () => { prefs.escala = Math.max(prefs.escala - 0.1, 0.5); persistir(); };

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
  const siguiente = () => { panelAbierto = ''; if (haySiguiente) indice += 1; };
  const anterior = () => { panelAbierto = ''; if (hayAnterior) indice -= 1; };
  const alternarNegro = () => { enNegro = !enNegro; };

  const salir = () => {
    proyectando = false;
    enNegro = false;
    panelAbierto = '';
    pasajes = [];
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
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
   * Teclas. Son las que mandan los mandos de presentación: el botón de avanzar
   * emite Flecha derecha o AvPág, y el de retroceder Flecha izquierda o RePág.
   * Por eso hay varias teclas para lo mismo — no es indecisión.
   */
  const alPulsarTecla = (e) => {
    if (!proyectando) return;
    // Si se está escribiendo en un campo, las teclas son texto y no atajos.
    //
    // No es teórico: el Enter que arranca la proyección desde el buscador
    // seguía burbujeando hasta aquí, y como para entonces `proyectando` ya era
    // `true`, avanzaba un versículo en el mismo gesto. Se empezaba siempre en
    // el segundo versículo del capítulo sin que nada lo explicara.
    const donde = e.target?.tagName;
    if (donde === 'INPUT' || donde === 'TEXTAREA' || e.target?.isContentEditable) return;

    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
        e.preventDefault(); siguiente(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        e.preventDefault(); anterior(); break;
      case 'Home': e.preventDefault(); indice = 0; break;
      case 'End': e.preventDefault(); indice = pasajes.length - 1; break;
      case 'n': case 'N': case 'b': case 'B': case '.':
        e.preventDefault(); alternarNegro(); break;
      case 'f': case 'F': e.preventDefault(); alternarPantallaCompleta(); break;
      case 's': case 'S': e.preventDefault(); intercambiarIdiomas(); break;
      // Encender o apagar el segundo idioma sin abrir el menú: en mitad del
      // culto entra un grupo de visitantes y hay que ponerlo en el acto.
      case 'l': case 'L': e.preventDefault(); alternarSegundoIdioma(); break;
      case '+': case '=': e.preventDefault(); masGrande(); break;
      case '-': case '_': e.preventDefault(); masPequeno(); break;
      case 'Escape':
        e.preventDefault();
        // Escape cierra primero el panel abierto y sólo sale si no hay ninguno:
        // si saliera directamente, abrir el menú de fondos por error te echaba
        // de la proyección en mitad del culto.
        if (panelAbierto) panelAbierto = '';
        else salir();
        break;
      default: break;
    }
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
    ocultarControlesTimer = setTimeout(() => {
      if (punteroEncima) return;
      panelAbierto = '';
      controlesVisibles = false;
    }, panelAbierto ? ESPERA_PANEL_MS : ESPERA_CONTROLES_MS);
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
  let scrollBloqueado = false;
  $: if (typeof document !== 'undefined') {
    if (proyectando && !scrollBloqueado) {
      document.body.classList.add('drawer-open');
      scrollBloqueado = true;
    } else if (!proyectando && scrollBloqueado) {
      document.body.classList.remove('drawer-open');
      scrollBloqueado = false;
    }
  }

  onMount(() => {
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
    // Sin esto, salir de la proyección navegando (no con Escape) dejaría el
    // resto de la aplicación sin poder hacer scroll.
    if (typeof document !== 'undefined') {
      document.body.classList.remove('drawer-open');
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  });
</script>

{#if !proyectando}
  <!-- ── Antesala: qué se va a proyectar ──────────────────────────────── -->
  <section class="antesala">
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
            on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); empezarDesdeConsulta(); } }}
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
            on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarPorTexto(); } }}
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
{:else}
  <!-- ── Proyectando ──────────────────────────────────────────────────── -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="proyeccion"
    class:proyeccion--negro={enNegro}
    style="--escala: {prefs.escala}; --fondo: {fondoCss}; --tinta: {fondo.ink}; --acento: {fondo.accent}"
    on:mousemove={mostrarControles}
    on:touchstart={mostrarControles}
    on:wheel={alGirarRueda}
  >
    {#if !enNegro && actual}
      <!-- `{#key}` vuelve a montar la lámina en cada versículo, que es lo que
           dispara la transición de entrada. Sin él, Svelte reutiliza el nodo y
           el texto cambia de golpe. -->
      {#key indice}
        <figure
          class="lamina"
          class:lamina--dos={!!secundario.texto}
          in:animarEntrada|global={{ tipo: prefs.animacion }}
        >
          <blockquote class="lamina__texto">{principal.texto}</blockquote>

          {#if secundario.texto}
            <blockquote class="lamina__texto lamina__texto--secundario">{secundario.texto}</blockquote>
          {/if}

          <!-- Sólo la referencia. El nombre de la versión no pinta nada en una
               pantalla de iglesia: la congregación sabe qué Biblia se usa, y
               ocupaba sitio al lado de lo único que de verdad hay que leer
               ahí. Sigue estando en la antesala, donde se elige. -->
          <figcaption class="lamina__ref">{principal.referencia}</figcaption>
        </figure>
      {/key}
    {/if}

    <!-- Zonas de toque para avanzar sin teclado: la mitad derecha avanza, la
         izquierda retrocede. Invisibles a propósito — es una pantalla, no una
         interfaz. -->
    <button type="button" class="zona zona--anterior" aria-label={$_('app.projection.key_prev')} on:click={anterior}></button>
    <button type="button" class="zona zona--siguiente" aria-label={$_('app.projection.key_next')} on:click={siguiente}></button>

    <!-- ── Paneles de ajuste ──────────────────────────────────────────── -->
    {#if panelAbierto === 'fondo'}
      <div class="panel">
        <p class="panel__titulo">{$_('app.projection.panel_background')}</p>
        <div class="muestras">
          {#each IMAGE_BACKGROUNDS as b (b.key)}
            <button
              type="button"
              class="muestra"
              class:muestra--activa={prefs.fondo === b.key}
              style="background: {backgroundCss(b)}"
              aria-label={b.key}
              aria-pressed={prefs.fondo === b.key}
              on:click={() => elegirFondo(b.key)}
            ></button>
          {/each}
        </div>
      </div>
    {:else if panelAbierto === 'animacion'}
      <div class="panel">
        <p class="panel__titulo">{$_('app.projection.panel_animation')}</p>
        <div class="opciones">
          {#each ANIMACIONES as a (a)}
            <button
              type="button"
              class="opcion"
              class:opcion--activa={prefs.animacion === a}
              aria-pressed={prefs.animacion === a}
              on:click={() => elegirAnimacion(a)}
            >
              {$_(`app.projection.animation_${a}`)}
            </button>
          {/each}
        </div>
      </div>
    {:else if panelAbierto === 'idioma'}
      <div class="panel">
        <p class="panel__titulo">{$_('app.projection.panel_language')}</p>
        <div class="opciones">
          <button
            type="button"
            class="opcion"
            class:opcion--activa={prefs.segundoIdioma}
            aria-pressed={prefs.segundoIdioma}
            on:click={alternarSegundoIdioma}
          >
            {$_(prefs.segundoIdioma ? 'app.projection.second_on' : 'app.projection.second_off')}
          </button>
          {#if prefs.segundoIdioma}
            {#each BIBLE_VERSIONS.filter((v) => v.value !== $selectedBibleVersion) as v (v.value)}
              <button
                type="button"
                class="opcion"
                class:opcion--activa={$compareWithVersion === v.value}
                aria-pressed={$compareWithVersion === v.value}
                on:click={() => elegirSegundaVersion(v.value)}
              >
                {v.bibleName}
              </button>
            {/each}
            <button type="button" class="opcion" on:click={intercambiarIdiomas}>
              <Icon name="swap" />
              {$_('app.projection.key_swap')}
            </button>
          {/if}
        </div>
      </div>
    {/if}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="controles"
      class:controles--ocultos={!controlesVisibles}
      on:mouseenter={entrarEnControles}
      on:mouseleave={salirDeControles}
    >
      <button type="button" on:click={salir} title={$_('app.projection.key_exit')} aria-label={$_('app.projection.key_exit')}>
        <Icon name="close" />
      </button>
      <button type="button" on:click={masPequeno} aria-label={$_('app.projection.key_size')}><Icon name="minus" /></button>
      <button type="button" on:click={masGrande} aria-label={$_('app.projection.key_size')}><Icon name="plus" /></button>
      <button
        type="button"
        class:controles__activo={panelAbierto === 'fondo'}
        on:click={() => alternarPanel('fondo')}
        title={$_('app.projection.panel_background')}
        aria-label={$_('app.projection.panel_background')}
      >
        <Icon name="palette" />
      </button>
      <button
        type="button"
        class:controles__activo={panelAbierto === 'animacion'}
        on:click={() => alternarPanel('animacion')}
        title={$_('app.projection.panel_animation')}
        aria-label={$_('app.projection.panel_animation')}
      >
        <Icon name="play" />
      </button>
      <button
        type="button"
        class:controles__activo={panelAbierto === 'idioma'}
        on:click={() => alternarPanel('idioma')}
        title={$_('app.projection.panel_language')}
        aria-label={$_('app.projection.panel_language')}
      >
        <Icon name="globe" />
      </button>
      <button type="button" on:click={alternarNegro} title={$_('app.projection.key_black')} aria-label={$_('app.projection.key_black')}>
        <Icon name="eye" />
      </button>
      <button type="button" on:click={alternarPantallaCompleta} title={$_('app.projection.key_fullscreen')} aria-label={$_('app.projection.key_fullscreen')}>
        <Icon name="expand" />
      </button>
      <span class="controles__posicion">{indice + 1} / {pasajes.length}</span>
    </div>
  </div>
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

    h1 { margin: 0.2rem 0 0.5rem; }
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

    > span { font-weight: 600; color: var(--color-ink); }

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

      &:hover { border-color: var(--color-accent); }
    }
  }

  .resultados__ref { font-weight: 700; color: var(--color-accent-ink); }

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

  .antesala__continuar {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 2.6rem;
    margin-bottom: 1.5rem;
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

    &:hover { background: var(--color-accent-solid-hover); }
  }

  .atajos {
    padding: 1rem 1.15rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);

    h2 { margin: 0 0 0.6rem; font-size: 0.95rem; color: var(--color-ink-strong); }

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
  // El fondo y los colores del texto salen del fondo elegido —los mismos de
  // compartir un versículo como imagen—, no de la paleta del usuario. Cada
  // fondo trae su `ink` y su `accent` ya comprobados contra él, que es lo que
  // garantiza que el texto se lea sobre cualquiera de los nueve.
  .proyeccion {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: clamp(1.5rem, 5vw, 4rem);
    background: var(--fondo, #0b0d10);
    color: var(--tinta, #f2f4f7);
    cursor: default;
  }

  // Negro de verdad: es el «apaga la pantalla» de entre canto y canto, así que
  // ignora el fondo elegido a propósito.
  .proyeccion--negro { background: #000; }

  .lamina {
    max-width: 90vw;
    margin: 0;
    text-align: center;
  }

  // El tamaño se calcula con `vw` y `vh` a la vez: sólo con `vw`, un televisor
  // panorámico daba letras enormes que no cabían a lo alto, y sólo con `vh`
  // quedaban pequeñas en una pantalla ancha. `--escala` es el ajuste manual.
  .lamina__texto {
    margin: 0 0 clamp(1rem, 3vh, 2.5rem);
    font-size: calc(clamp(1.75rem, 4.2vw + 1.2vh, 5.5rem) * var(--escala, 1));
    font-weight: 600;
    line-height: 1.3;
    text-wrap: balance;
  }

  // Con dos idiomas hay que repartir el alto de la pantalla entre los dos, así
  // que el principal se encoge. Sin esto, un versículo largo en dos idiomas
  // —Ioan 3:2, por ejemplo— llenaba la pantalla de borde a borde y el operador
  // tenía que bajar el tamaño a mano justo cuando menos tiempo tiene.
  .lamina--dos .lamina__texto {
    font-size: calc(clamp(1.4rem, 3.1vw + 0.9vh, 4rem) * var(--escala, 1));
    margin-bottom: clamp(0.75rem, 2vh, 1.5rem);
  }

  // El segundo idioma: más pequeño, debajo y con menos peso. La proporción
  // (58 %) es la que deja leer los dos sin que compitan — al 80 % parecían dos
  // textos principales y la vista no sabía dónde posarse.
  .lamina--dos .lamina__texto--secundario {
    font-size: calc(clamp(0.95rem, 1.9vw + 0.55vh, 2.5rem) * var(--escala, 1));
  }

  .lamina__texto--secundario {
    font-size: calc(clamp(1.1rem, 2.4vw + 0.7vh, 3.2rem) * var(--escala, 1));
    font-weight: 400;
    opacity: 0.86;
  }

  .lamina__ref {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 0.6rem;
    color: var(--acento, #f0c674);
    font-size: calc(clamp(1rem, 1.4vw + 0.6vh, 2rem) * var(--escala, 1));
    font-weight: 700;
  }


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

    &::-moz-focus-inner { border: 0; }
  }

  .zona--anterior { left: 0; }
  .zona--siguiente { right: 0; }

  // ── Paneles y controles ───────────────────────────────────────────────────
  .panel {
    position: absolute;
    right: 1rem;
    bottom: 4.25rem;
    z-index: 3;
    max-width: min(26rem, calc(100vw - 2rem));
    padding: 0.75rem 0.85rem;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-md);
    // Opaco y no translúcido: sobre un fondo claro como `sand` o `arcs`, un
    // panel semitransparente dejaba los textos ilegibles.
    background: #14181e;
    color: #f2f4f7;
  }

  .panel__titulo {
    margin: 0 0 0.5rem;
    color: #98a2b3;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .muestras {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2.75rem, 1fr));
    gap: 0.45rem;
  }

  .muestra {
    width: 2.75rem;
    height: 2.75rem;
    border: 2px solid transparent;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  .muestra--activa {
    border-color: #f2f4f7;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
  }

  .opciones {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .opcion {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2.25rem;
    padding: 0.35rem 0.8rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: var(--radius-pill);
    background: transparent;
    color: #f2f4f7;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    --icon-size: 0.9rem;

    &:hover { background: rgba(255, 255, 255, 0.1); }
  }

  .opcion--activa {
    border-color: #f2f4f7;
    background: rgba(255, 255, 255, 0.16);
  }

  .controles {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-pill);
    background: rgba(20, 24, 30, 0.86);
    transition: opacity var(--motion-base, 200ms) ease;

    button {
      display: inline-grid;
      place-items: center;
      // 2.25rem = 36px: por encima del mínimo de 24 px de objetivo táctil
      // (WCAG 2.5.8) y cómodo de acertar con prisa.
      width: 2.25rem;
      height: 2.25rem;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: #f2f4f7;
      cursor: pointer;
      --icon-size: 1.05rem;

      &:hover { background: rgba(255, 255, 255, 0.12); }
    }
  }

  .controles__activo { background: rgba(255, 255, 255, 0.2) !important; }

  .controles--ocultos {
    opacity: 0;
    // Sin esto seguirían recibiendo clics invisibles justo donde el operador
    // toca para avanzar.
    pointer-events: none;
  }

  // ── Móvil ─────────────────────────────────────────────────────────────────
  //
  // En el teléfono esto no es «el equipo que proyecta»: es alguien leyendo
  // versículo a versículo en la mano, y la proyección resulta ser una forma
  // muy cómoda de hacerlo. Con los controles en la esquina derecha hacían falta
  // dos manos y aun así quedaban fuera del alcance del pulgar.
  //
  // Centrados y algo más arriba: sobre esa franja inferior es donde el
  // navegador móvil enseña y esconde su propia barra de direcciones.
  @media (max-width: 40rem) {
    .controles {
      right: auto;
      left: 50%;
      bottom: 1.5rem;
      transform: translateX(-50%);
      // Caben ocho botones justos en una pantalla estrecha; si no, se parten en
      // dos filas en vez de salirse por los lados.
      flex-wrap: wrap;
      justify-content: center;
      max-width: calc(100vw - 1.5rem);

      button {
        // 2.6rem = 42px: por encima del objetivo táctil mínimo y cómodo para el
        // pulgar, que es con lo que se usa aquí.
        width: 2.6rem;
        height: 2.6rem;
        --icon-size: 1.15rem;
      }
    }

    // El panel se apoya justo encima de los controles, también centrado.
    .panel {
      right: auto;
      left: 50%;
      bottom: 5.25rem;
      transform: translateX(-50%);
      width: calc(100vw - 2rem);
    }

    // Y el texto respira: en vertical, el relleno lateral de escritorio se
    // comía media línea por lado.
    .proyeccion { padding: 1.25rem 1rem 5.5rem; }

    .lamina { max-width: 100%; }
  }

  .controles__posicion {
    padding: 0 0.35rem;
    color: #98a2b3;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    .controles { transition: none; }
  }
</style>
