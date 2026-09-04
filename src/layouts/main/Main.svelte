<script>
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
<div class="main" class:main--immersive={isImmersive} class:main--compare={isCompareMode} class:main--index={isIndexMode} class:main--favorites={isFavoritesMode} class:main--notes={isNotesMode}>
  {#if !isImmersive && !isCompareMode && !isIndexMode && !isFavoritesMode && !isNotesMode}
    <div class="sidebar">
      <Sidebar {map} {result} {count} />
    </div>
  {/if}
  <div class="layout">
    {#if Object.keys(bible).length}
      {#if isCompareMode}
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

<!-- Floating immersive mode button (hidden in compare mode to avoid competing with the version picker) -->
{#if !isImmersive && !isCompareMode}
  <button
    type="button"
    class="immersive-toggle"
    aria-label={$_('app.result.immersive.enter')}
    title={$_('app.result.immersive.enter')}
    on:click={toggleImmersiveMode}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
    </svg>
  </button>
{:else}
  <!-- Exit immersive mode button (appears when in immersive mode) -->
  <button
    type="button"
    class="immersive-exit"
    aria-label={$_('app.result.immersive.exit')}
    title={$_('app.result.immersive.exit')}
    on:click={toggleImmersiveMode}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
    </svg>
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
    border: 1px solid rgb(45 150 205 / 34%);
    border-radius: 0.5rem;
    background: var(--color-white);
    color: var(--color-bg-dark);
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--box-shadow-down);

    svg {
      width: 1.3rem;
      height: 1.3rem;
    }

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 13%, var(--color-white));
      box-shadow: 0 0 0 3px rgb(45 150 205 / 14%);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }
  }

  // Enter immersive: bottom-left, junto al exit (estilo outline)
  // Antes estaba en top-right pero se solapaba con el botón de cerrar
  // el AppMenu (que también vive en la zona superior derecha).
  .immersive-toggle {
    bottom: 1rem;
    left: 1rem;
  }

  // Exit immersive: bottom-left, siempre visible, alto contraste
  // (un pelín más arriba que el toggle para que se distingan si coincidieran
  // en el mismo punto, y un poco más pequeño).
  .immersive-exit {
    bottom: 1rem;
    left: 1rem;
    top: auto;
    width: 2.5rem;
    height: 2.5rem;
    background: var(--color-blue);
    color: var(--color-white);
    border-color: var(--color-blue);
    box-shadow: var(--box-shadow-down), 0 0 0 3px rgb(45 150 205 / 25%);

    svg {
      width: 1.2rem;
      height: 1.2rem;
    }

    &:hover,
    &:focus-visible {
      background: var(--color-blue-hover);
      border-color: var(--color-blue-hover);
      box-shadow: var(--box-shadow-down), 0 0 0 3px rgb(45 150 205 / 35%);
    }
  }

  // Dark mode: exit button stays teal/blue for visibility
  :global(html[data-theme='dark']) .immersive-exit {
    background: var(--color-blue);
    color: var(--color-white);
    border-color: var(--color-blue);
  }
</style>
