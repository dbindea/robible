<script>
  import Icon from '../../components/Icon.svelte';
  import { filter, immersiveMode, toggleImmersiveMode } from '../../store/stores';
  import { getFilterResult } from '../../services/filter.service';
  import { _ } from '../../services/i18n.service';
  import { onMount } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import Result from './Result.svelte';
  import Compare from './Compare.svelte';
  import Index from './Index.svelte';
  import Favorites from './Favorites.svelte';
  import Notes from './Notes.svelte';
  import PublicTopic from './PublicTopic.svelte';
  import PublicSermon from './PublicSermon.svelte';
  import PublicSermons from './PublicSermons.svelte';
  import PublicTopics from './PublicTopics.svelte';
  import Profile from './Profile.svelte';
  import CuratedTopic from './CuratedTopic.svelte';
  import Memorize from './Memorize.svelte';
  import Sermons from './Sermons.svelte';
  import SermonPrep from './SermonPrep.svelte';
  import SermonPulpit from './SermonPulpit.svelte';
  import GuidePredicare from './GuidePredicare.svelte';
  import Admin from './Admin.svelte';
  import Projection from './Projection.svelte';
  import ProjectionLanding from './ProjectionLanding.svelte';
  import { getBibleVersionConfigOrDefault } from '../../store/stores';
  import { registrarVisita } from '../../services/analytics.service';

  export let bible;
  export let map;
  export let compareBible = [];
  export let compareMap = {};

  // Detect compare mode from window.location (updated on navigation)
  // Initialize immediately from pathname so it works on first render
  const isComparePath = (path) =>
    path === '/compare' ||
    path === '/compara' ||
    path === '/comparar' ||
    path.startsWith('/compare/') ||
    path.startsWith('/compara/') ||
    path.startsWith('/comparar/');

  let isCompareMode = typeof window !== 'undefined' ? isComparePath(window.location.pathname) : false;

  // Helper: get path from bible-versions config
  const getBiblePath = (key, fallback) => {
    if (typeof window === 'undefined') return fallback;
    const version = window.localStorage.getItem('selectedBibleVersion') || 'vdc';
    const config = getBibleVersionConfigOrDefault(version);
    return config?.[key] || fallback;
  };

  // Detectar ruta del índice temático (depende del idioma de la biblia activa)
  const getIndexPath = () => getBiblePath('indexPath', 'indice');

  // Detectar ruta de favoritos (depende del idioma)
  const getFavoritesPath = () => getBiblePath('favoritesPath', 'favorites');

  // Detectar ruta de notas (depende del idioma)
  const getNotesPath = () => getBiblePath('notesPath', 'notes');

  // Tema público compartido. A diferencia del resto, esta ruta NO se traduce
  // por idioma: el slug se genera una vez y el enlace se reparte por fuera, así
  // que tiene que abrir igual sea cual sea la versión bíblica de quien lo
  // recibe. Con un path por idioma el mismo tema tendría varias URLs y el
  // enlace se rompería al cambiar de versión.
  const isPublicTopicPath = (path) => /^\/tema\/[^/]+\/?$/.test(path);
  let isPublicTopicMode = typeof window !== 'undefined' ? isPublicTopicPath(window.location.pathname) : false;

  // Predicación compartida. Mismo criterio que /tema —no se traduce por
  // idioma, porque el enlace se reparte por fuera y tiene que abrir igual para
  // quien lo reciba— pero, a diferencia de aquélla, **sí se indexa**: el autor
  // la publica para que se encuentre, no sólo para pasar el enlace a alguien.
  const isPublicSermonPath = (path) => /^\/predica\/[^/]+\/?$/.test(path);
  let isPublicSermonMode = typeof window !== 'undefined' ? isPublicSermonPath(window.location.pathname) : false;

  // Blog de predicaciones publicadas. Es la portada del contenido público del
  // módulo: /predici (todas) y /predica/<slug> (una). No se traduce por idioma
  // por el mismo motivo que /predica: es una URL que se reparte y se indexa, y
  // con una forma por idioma la misma página tendría cuatro direcciones.
  const isPublicSermonsPath = (path) => path === '/predici' || path === '/predici/';
  let isPublicSermonsMode = typeof window !== 'undefined' ? isPublicSermonsPath(window.location.pathname) : false;

  // Índice de temas publicados. Mismo par que /predica–/predici: singular uno
  // (/tema/<slug>), plural todos (/teme). Existe porque el endpoint público
  // estaba en el worker desde el principio y ninguna pantalla lo pedía: un
  // tema publicado sólo existía para quien recibía el enlace.
  const isPublicTopicsPath = (path) => path === '/teme' || path === '/teme/';
  let isPublicTopicsMode = typeof window !== 'undefined' ? isPublicTopicsPath(window.location.pathname) : false;

  // Colección curada por RoBible. SÍ se indexa, al revés que /tema/<slug>:
  // trae un texto de presentación propio y una selección hecha a mano, no una
  // lista de versículos que ya tienen su página en otro sitio.
  const isCuratedPath = (path) => /^\/versete\/[^/]+\/?$/.test(path);
  let isCuratedMode = typeof window !== 'undefined' ? isCuratedPath(window.location.pathname) : false;

  // Perfil. Privado y sin traducir por idioma, como el resto de lo privado.
  const isProfilePath = (path) => path === '/profil' || path === '/profil/';
  let isProfileMode = typeof window !== 'undefined' ? isProfilePath(window.location.pathname) : false;

  // Memorización. Privada también: es el avance de repasos de una persona.
  const isMemorizePath = (path) => path === '/memorare' || path === '/memorare/';
  let isMemorizeMode = typeof window !== 'undefined' ? isMemorizePath(window.location.pathname) : false;

  // Manual de predicación (`/ghid-predicare`). Público y se indexa a
  // propósito, como `/predici`: es la respuesta a «cómo se hace una predicación
  // expositiva», enlazada desde el menú de «Predicile mele» para quien todavía
  // no sabe que la herramienta existe. No se traduce por idioma, igual que el
  // resto de rutas públicas que se reparten e indexan: una sola URL para las
  // cuatro versiones.
  const isGuidePath = (path) => path === '/ghid-predicare' || path === '/ghid-predicare/';
  let isGuideMode = typeof window !== 'undefined' ? isGuidePath(window.location.pathname) : false;

  // Panel de admin (`/admin`). Privado, sin traducir por idioma y con
  // `noindex` (ver Admin.svelte): la guarda de verdad está en el rol
  // `is_admin`, comprobado otra vez en el propio componente y en el worker.
  const isAdminPath = (path) => path === '/admin' || path === '/admin/';
  let isAdminMode = typeof window !== 'undefined' ? isAdminPath(window.location.pathname) : false;

  // Modo Proyección (`/proiectie`). Sin traducir por idioma y con `noindex`: es
  // una herramienta del dispositivo que proyecta, no contenido que se comparta,
  // así que cuatro URLs distintas no aportarían nada. Mientras proyecta se pinta
  // como capa propia a pantalla completa, igual que el Amvon.
  const isProjectionPath = (path) => path === '/proiectie' || path === '/proiectie/';
  // La ventana que se manda al proyector. Constante: no cambia en toda la vida
  // de la pestaña. Ver `projection-channel.service.js`.
  const esVentanaProyectada =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ecran') === '1';
  let isProjectionMode = typeof window !== 'undefined' ? isProjectionPath(window.location.pathname) : false;

  // Biblia a scroll (`/scroll`). Es la MISMA pantalla que la proyección, pero
  // entrando ya en modo lectura y desde donde se dejó: un versículo por
  // pantalla y el dedo hacia arriba, sin pasar por el buscador.
  //
  // Ruta propia y no un parámetro de `/proiectie` porque se anuncia en la
  // portada y está en el menú: tiene que ser una dirección que se pueda
  // enlazar y entender. No se traduce por idioma ni entra en el sitemap —es
  // una herramienta del dispositivo, y el texto bíblico ya se indexa en
  // `/biblia/…`—, así que de los cuatro ficheros de la trampa 11 sólo toca dos.
  const isScrollPath = (path) => path === '/scroll' || path === '/scroll/';
  let isScrollMode = typeof window !== 'undefined' ? isScrollPath(window.location.pathname) : false;

  // Presentación del Modo Proyección (`/proiectie-biserici`). Al revés que la
  // herramienta, ésta SÍ se indexa: es la página con la que se quiere aparecer
  // al buscar «proiecție versete biserică», y va dirigida a quien todavía no
  // sabe que la función existe. Tampoco se traduce por idioma — es pública y se
  // reparte, así que una sola URL.
  const isProjectionLandingPath = (path) => path === '/proiectie-biserici' || path === '/proiectie-biserici/';
  let isProjectionLandingMode =
    typeof window !== 'undefined' ? isProjectionLandingPath(window.location.pathname) : false;

  // «Predicile mele»: el cuaderno privado. Vive en /predicile-mele desde que
  // /predici pasó a ser el blog público — el plural suelto describe mejor «todas
  // las publicadas» que «las mías», y así la ruta pública queda corta, que es la
  // que se comparte y se indexa.
  const isSermonsPath = (path) => path === '/predicile-mele' || path.startsWith('/predicile-mele/');
  // /predicile-mele      → la lista
  // /predicile-mele/<id> → la preparación de esa predicación
  const sermonIdFromPath = (path) => (path.match(/^\/predicile-mele\/([^/]+)\/?$/) || [])[1] || '';
  // /predicile-mele/<id>/amvon → el púlpito
  const pulpitIdFromPath = (path) => (path.match(/^\/predicile-mele\/([^/]+)\/amvon\/?$/) || [])[1] || '';
  let isSermonsMode = typeof window !== 'undefined' ? isSermonsPath(window.location.pathname) : false;
  let sermonId = typeof window !== 'undefined' ? sermonIdFromPath(window.location.pathname) : '';
  let pulpitId = typeof window !== 'undefined' ? pulpitIdFromPath(window.location.pathname) : '';

  let isIndexMode = false;
  let isFavoritesMode = false;
  let isNotesMode = false;
  const updateIndexMode = () => {
    if (typeof window === 'undefined') return;
    const indexPath = getIndexPath();
    const path = window.location.pathname;
    isIndexMode = path === `/${indexPath}` || path.startsWith(`/${indexPath}/`);
  };
  const updateFavoritesMode = () => {
    if (typeof window === 'undefined') return;
    const favPath = getFavoritesPath();
    const path = window.location.pathname;
    isFavoritesMode = path === `/${favPath}` || path.startsWith(`/${favPath}/`);
  };
  const updateNotesMode = () => {
    if (typeof window === 'undefined') return;
    const notesPath = getNotesPath();
    const path = window.location.pathname;
    isNotesMode = path === `/${notesPath}` || path.startsWith(`/${notesPath}/`);
  };
  updateIndexMode();
  updateFavoritesMode();
  updateNotesMode();

  $: searchForm = $filter;
  $: fullResult = Object.keys(searchForm).length ? getFilterResult(bible, map, searchForm) : [];
  $: count = fullResult.length;
  $: result = fullResult.slice(0, 200);
  $: isImmersive = $immersiveMode;

  // Update isCompareMode when pathname changes
  const updateCompareMode = () => {
    if (typeof window === 'undefined') return;
    isCompareMode = isComparePath(window.location.pathname);
    isPublicTopicMode = isPublicTopicPath(window.location.pathname);
    isPublicSermonMode = isPublicSermonPath(window.location.pathname);
    isPublicSermonsMode = isPublicSermonsPath(window.location.pathname);
    isPublicTopicsMode = isPublicTopicsPath(window.location.pathname);
    isProfileMode = isProfilePath(window.location.pathname);
    isCuratedMode = isCuratedPath(window.location.pathname);
    isMemorizeMode = isMemorizePath(window.location.pathname);
    isGuideMode = isGuidePath(window.location.pathname);
    isAdminMode = isAdminPath(window.location.pathname);
    isProjectionMode = isProjectionPath(window.location.pathname);
    isScrollMode = isScrollPath(window.location.pathname);
    isProjectionLandingMode = isProjectionLandingPath(window.location.pathname);
    isSermonsMode = isSermonsPath(window.location.pathname);
    sermonId = sermonIdFromPath(window.location.pathname);
    pulpitId = pulpitIdFromPath(window.location.pathname);
  };

  // Contador de visitas del panel de admin (analytics.service.js). Una
  // llamada al montar más una por cada navegación — no hay recarga de página
  // en una SPA, así que sin esto el worker nunca vería una sola visita.
  const registrarVisitaActual = () => {
    if (typeof window !== 'undefined') registrarVisita(window.location.pathname);
  };

  onMount(() => {
    updateCompareMode();
    updateIndexMode();
    updateFavoritesMode();
    updateNotesMode();
    registrarVisitaActual();
    window.addEventListener('popstate', updateCompareMode);
    window.addEventListener('robibile:navigate', updateCompareMode);
    window.addEventListener('popstate', updateIndexMode);
    window.addEventListener('robibile:navigate', updateIndexMode);
    window.addEventListener('popstate', updateFavoritesMode);
    window.addEventListener('robibile:navigate', updateFavoritesMode);
    window.addEventListener('popstate', updateNotesMode);
    window.addEventListener('robibile:navigate', updateNotesMode);
    window.addEventListener('popstate', registrarVisitaActual);
    window.addEventListener('robibile:navigate', registrarVisitaActual);
    return () => {
      window.removeEventListener('popstate', updateCompareMode);
      window.removeEventListener('robibile:navigate', updateCompareMode);
      window.removeEventListener('popstate', updateIndexMode);
      window.removeEventListener('robibile:navigate', updateIndexMode);
      window.removeEventListener('popstate', updateFavoritesMode);
      window.removeEventListener('robibile:navigate', updateFavoritesMode);
      window.removeEventListener('popstate', updateNotesMode);
      window.removeEventListener('robibile:navigate', updateNotesMode);
      window.removeEventListener('popstate', registrarVisitaActual);
      window.removeEventListener('robibile:navigate', registrarVisitaActual);
    };
  });
</script>

<!-- La ruta /landing la resuelve App.svelte antes de montar Main. -->
<div
  class="main"
  class:main--immersive={isImmersive}
  class:main--compare={isCompareMode}
  class:main--index={isIndexMode}
  class:main--favorites={isFavoritesMode}
  class:main--notes={isNotesMode ||
    isPublicTopicMode ||
    isPublicSermonMode ||
    isSermonsMode ||
    isPublicSermonsMode ||
    isPublicTopicsMode ||
    isProfileMode ||
    isCuratedMode ||
    isMemorizeMode ||
    isGuideMode ||
    isAdminMode ||
    isProjectionMode ||
    isScrollMode ||
    isProjectionLandingMode}
>
  {#if !isImmersive && !isCompareMode && !isIndexMode && !isFavoritesMode && !isNotesMode && !isPublicTopicMode && !isPublicSermonMode && !isSermonsMode && !isPublicSermonsMode && !isPublicTopicsMode && !isProfileMode && !isCuratedMode && !isMemorizeMode && !isGuideMode && !isAdminMode && !isProjectionMode && !isScrollMode && !isProjectionLandingMode}
    <div class="sidebar">
      <Sidebar {map} {bible} {result} {count} />
    </div>
  {/if}
  <div class="layout">
    <!-- La guarda existe para no pintar una vista sin datos. La ventana del
         proyector es la excepción: no carga ninguna Biblia a propósito —recibe
         el versículo ya resuelto por el canal— y sin esta salida se quedaba en
         blanco, con la barra y el pie pero sin lámina. Se pide además
         `isProjectionMode` para que el parámetro no sirva de atajo en otra
         ruta, donde sí haría falta la Biblia. -->
    {#if Object.keys(bible).length || (isProjectionMode && esVentanaProyectada)}
      {#if isSermonsMode}
        {#if pulpitId}
          <SermonPulpit sermonId={pulpitId} />
        {:else if sermonId}
          <SermonPrep {bible} {map} {sermonId} />
        {:else}
          <Sermons {bible} {map} />
        {/if}
      {:else if isPublicSermonsMode}
        <PublicSermons {map} />
      {:else if isPublicTopicsMode}
        <PublicTopics />
      {:else if isProfileMode}
        <Profile {bible} {map} />
      {:else if isCuratedMode}
        <CuratedTopic {bible} {map} />
      {:else if isMemorizeMode}
        <Memorize {bible} {map} />
      {:else if isGuideMode}
        <GuidePredicare />
      {:else if isAdminMode}
        <Admin />
      {:else if isProjectionMode || isScrollMode}
        <!-- `compareBible` y `compareMap` son el segundo idioma. Llegan vacíos
             hasta que el usuario lo enciende: App.svelte sólo baja esa Biblia
             cuando `compareWithVersion` deja de ser null (son ~4 MB).
             `modoScroll` es la Biblia a scroll: la misma pantalla, pero
             entrando ya en modo lectura. -->
        <Projection {bible} {map} {compareBible} {compareMap} modoScroll={isScrollMode} />
      {:else if isProjectionLandingMode}
        <ProjectionLanding />
      {:else if isPublicSermonMode}
        <PublicSermon {map} />
      {:else if isPublicTopicMode}
        <PublicTopic {bible} {map} />
      {:else if isCompareMode}
        <Compare {bible} {map} {compareBible} {compareMap} />
      {:else if isIndexMode}
        <Index {bible} {map} />
      {:else if isFavoritesMode}
        <Favorites {bible} {map} />
      {:else if isNotesMode}
        <Notes {bible} {map} />
      {:else}
        <Result {bible} {map} {result} {count} />
      {/if}
    {/if}
  </div>
</div>

<!-- Botón flotante de modo lectura.
     Fuera de comparar, porque competiría con el selector de versión, y fuera
     del módulo de predicación: el modo inmersivo esconde el cromo para LEER la
     Biblia, y sobre un formulario de preparación no significa nada. Además se
     plantaba encima del texto del guía de homilética, que es contenido que hay
     que poder leer entero. El Modo Amvon tiene su propia pantalla completa. -->
{#if !isImmersive && !isCompareMode && !isSermonsMode && !isProjectionMode && !isScrollMode && !isProjectionLandingMode}
  <button
    type="button"
    class="immersive-toggle"
    aria-label={$_('app.result.immersive.enter')}
    title={$_('app.result.immersive.enter')}
    on:click={toggleImmersiveMode}
  >
    <Icon name="expand" />
  </button>
{:else if isImmersive}
  <!-- Salir del modo inmersivo. La condición es `isImmersive` y no un `{:else}`
       suelto: con el else, cualquier pantalla excluida arriba —comparar, el
       módulo de predicación— caía aquí y enseñaba el botón de SALIR de un modo
       en el que no se estaba. Pasó al excluir las predicaciones. -->
  <button
    type="button"
    class="immersive-exit"
    aria-label={$_('app.result.immersive.exit')}
    title={$_('app.result.immersive.exit')}
    on:click={toggleImmersiveMode}
  >
    <Icon name="collapse" />
  </button>
{/if}

<style lang="scss">
  .main {
    display: grid;
    grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
    gap: clamp(1rem, 2vw, 1.5rem);
    background-color: var(--color-bg-light);
    min-height: calc(100dvh - 9rem);
  }

  // Immersive mode, compare mode AND index mode: full width, no sidebar
  .main--immersive,
  .main--compare,
  .main--index,
  .main--favorites,
  .main--notes {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .sidebar {
    background-color: var(--color-sidebar);
    // El sidebar es chrome oscuro y fija su fondo, pero no fijaba el color del
    // texto: todo lo que no llevaba color propio heredaba la tinta del body,
    // que es oscura. Los dos títulos de sección ("¿Cómo se hace la búsqueda?",
    // "¿Dónde se hace la búsqueda?") salían casi negros sobre casi negro.
    color: var(--color-on-sidebar);
    min-width: 0;
  }

  .layout {
    width: 100%;
    min-width: 0;
    max-width: 96rem;
    margin-inline: auto;
    padding: clamp(1rem, 3vw, 2.5rem) clamp(1rem, 5vw, 5rem) clamp(2rem, 6vw, 4rem);
  }

  .main--immersive .layout,
  .main--compare .layout,
  .main--index .layout,
  .main--favorites .layout,
  .main--notes .layout {
    padding: clamp(0.5rem, 2vw, 1.5rem) clamp(0.5rem, 3vw, 3rem) clamp(1rem, 4vw, 3rem);
  }

  @media (max-width: 58rem) {
    .main {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
    }
  }

  // Immersive mode floating buttons
  .immersive-toggle,
  .immersive-exit {
    position: fixed;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border: 1px solid color-mix(in srgb, var(--color-accent) 34%, transparent);
    border-radius: 0.5rem;
    background: var(--color-white);
    color: var(--color-bg-dark);
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--box-shadow-down);

    // El tamaño va al contenedor: una regla `svg` de aquí no alcanza al
    // <svg> de Icon.svelte, que lleva otra clase de scope.
    --icon-size: 1.3rem;

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 13%, var(--color-white));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 14%, transparent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }
  }

  // Enter immersive: bottom-left, junto al exit (estilo outline)
  // Antes estaba en top-right pero se solapaba con el botón de cerrar
  // el AppMenu (que también vive en la zona superior derecha).
  // `--player-offset` lo publica TtsPlayer: mientras suena la música su barra
  // ocupa la parte de abajo y estos botones se quedaban detrás.
  .immersive-toggle {
    bottom: calc(1rem + var(--player-offset, 0px));
    left: 1rem;
    transition: bottom var(--motion-base) var(--ease-out);
  }

  // Exit immersive: bottom-left, siempre visible, alto contraste
  // (un pelín más arriba que el toggle para que se distingan si coincidieran
  // en el mismo punto, y un poco más pequeño).
  .immersive-exit {
    bottom: calc(1rem + var(--player-offset, 0px));
    left: 1rem;
    top: auto;
    transition: bottom var(--motion-base) var(--ease-out);
    width: 2.5rem;
    height: 2.5rem;
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    border-color: var(--color-blue);
    box-shadow:
      var(--box-shadow-down),
      0 0 0 3px color-mix(in srgb, var(--color-accent) 25%, transparent);

    // El tamaño va al contenedor: una regla `svg` de aquí no alcanza al
    // <svg> de Icon.svelte, que lleva otra clase de scope.
    --icon-size: 1.2rem;

    &:hover,
    &:focus-visible {
      background: var(--color-blue-hover);
      border-color: var(--color-blue-hover);
      box-shadow:
        var(--box-shadow-down),
        0 0 0 3px color-mix(in srgb, var(--color-accent) 35%, transparent);
    }
  }

  // ── Cristal ───────────────────────────────────────────────────────────
  // El fondo opaco de la regla de arriba es la base y se queda: si el
  // navegador no desenfoca, el texto se lee sobre color sólido en vez de
  // sobre el contenido de la página. La transparencia sólo entra donde hay
  // desenfoque real.
  @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
    .immersive-exit {
      background: var(--glass-accent);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      border-color: var(--glass-line);
    }
  }
</style>
