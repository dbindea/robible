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
  import { getBibleVersionConfigOrDefault } from '../../store/stores';

  export let bible;
  export let map;
  export let compareBible = [];
  export let compareMap = {};

  // Detect compare mode from window.location (updated on navigation)
  // Initialize immediately from pathname so it works on first render
  const isComparePath = (path) =>
    path === '/compare' || path === '/compara' || path === '/comparar' ||
    path.startsWith('/compare/') || path.startsWith('/compara/') || path.startsWith('/comparar/');

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
    isSermonsMode = isSermonsPath(window.location.pathname);
    sermonId = sermonIdFromPath(window.location.pathname);
    pulpitId = pulpitIdFromPath(window.location.pathname);
  };

  onMount(() => {
    updateCompareMode();
    updateIndexMode();
    updateFavoritesMode();
    updateNotesMode();
    window.addEventListener('popstate', updateCompareMode);
    window.addEventListener('robibile:navigate', updateCompareMode);
    window.addEventListener('popstate', updateIndexMode);
    window.addEventListener('robibile:navigate', updateIndexMode);
    window.addEventListener('popstate', updateFavoritesMode);
    window.addEventListener('robibile:navigate', updateFavoritesMode);
    window.addEventListener('popstate', updateNotesMode);
    window.addEventListener('robibile:navigate', updateNotesMode);
    return () => {
      window.removeEventListener('popstate', updateCompareMode);
      window.removeEventListener('robibile:navigate', updateCompareMode);
      window.removeEventListener('popstate', updateIndexMode);
      window.removeEventListener('robibile:navigate', updateIndexMode);
      window.removeEventListener('popstate', updateFavoritesMode);
      window.removeEventListener('robibile:navigate', updateFavoritesMode);
      window.removeEventListener('popstate', updateNotesMode);
      window.removeEventListener('robibile:navigate', updateNotesMode);
    };
  });
</script>

<!-- La ruta /landing la resuelve App.svelte antes de montar Main. -->
<div class="main" class:main--immersive={isImmersive} class:main--compare={isCompareMode} class:main--index={isIndexMode} class:main--favorites={isFavoritesMode} class:main--notes={isNotesMode || isPublicTopicMode || isPublicSermonMode || isSermonsMode || isPublicSermonsMode || isPublicTopicsMode || isProfileMode || isCuratedMode || isMemorizeMode}>
  {#if !isImmersive && !isCompareMode && !isIndexMode && !isFavoritesMode && !isNotesMode && !isPublicTopicMode && !isPublicSermonMode && !isSermonsMode && !isPublicSermonsMode && !isPublicTopicsMode && !isProfileMode && !isCuratedMode && !isMemorizeMode}
    <div class="sidebar">
      <Sidebar {map} {result} {count} />
    </div>
  {/if}
  <div class="layout">
    {#if Object.keys(bible).length}
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
{#if !isImmersive && !isCompareMode && !isSermonsMode}
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
    box-shadow: var(--box-shadow-down), 0 0 0 3px color-mix(in srgb, var(--color-accent) 25%, transparent);

    // El tamaño va al contenedor: una regla `svg` de aquí no alcanza al
    // <svg> de Icon.svelte, que lleva otra clase de scope.
    --icon-size: 1.2rem;

    &:hover,
    &:focus-visible {
      background: var(--color-blue-hover);
      border-color: var(--color-blue-hover);
      box-shadow: var(--box-shadow-down), 0 0 0 3px color-mix(in srgb, var(--color-accent) 35%, transparent);
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
