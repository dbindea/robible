<script>
  import { filter, immersiveMode, toggleImmersiveMode } from '../../store/stores';
  import { getFilterResult } from '../../services/filter.service';
  import { _ } from '../../services/i18n.service';
  import Sidebar from './Sidebar.svelte';
  import Result from './Result.svelte';

  export let bible;
  export let map;

  $: searchForm = $filter;
  $: fullResult = Object.keys(searchForm).length ? getFilterResult(bible, map, searchForm) : [];
  $: count = fullResult.length;
  $: result = fullResult.slice(0, 200);
  $: isImmersive = $immersiveMode;

  // Double-tap detection for immersive mode toggle
  let lastTapTime = 0;
  const DOUBLE_TAP_DELAY = 300; // ms

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapTime < DOUBLE_TAP_DELAY) {
      toggleImmersiveMode();
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  };
</script>

<div class="main" class:main--immersive={isImmersive}>
  {#if !isImmersive}
    <div class="sidebar">
      <Sidebar {map} {result} {count} />
    </div>
  {/if}
  <div class="layout">
    {#if Object.keys(bible).length}
      <Result {bible} {map} {result} {count} />
    {/if}
  </div>
</div>

<!-- Floating immersive mode button -->
{#if !isImmersive}
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

  .main--immersive {
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

  .main--immersive .layout {
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

  // Enter immersive: top-right, beside version picker
  .immersive-toggle {
    top: 0.6rem;
    right: 0.6rem;
  }

  // Exit immersive: bottom-left, always visible, high contrast
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
