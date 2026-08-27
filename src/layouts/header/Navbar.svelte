<script>
  import { onDestroy, onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { bibleVersions, resetFilter, selectedBibleVersion } from '../../store/stores';
  import { openAppMenu } from '../../store/appMenuStore';

  let isVersionMenuOpen = false;
  let versionPickerElement;
  let currentPath = '/';

  $: selectedVersion = $selectedBibleVersion;
  $: selectedVersionLabel =
    visibleBibleVersions.find((version) => version.value === selectedVersion)?.label || selectedVersion;
  $: visibleBibleVersions = bibleVersions.some((version) => version.value === selectedVersion)
    ? bibleVersions
    : [{ value: selectedVersion, label: selectedVersion }, ...bibleVersions];

  // Helpers para detectar ruta activa
  $: isOnCompare = currentPath.startsWith('/compara');
  $: isOnIndex = currentPath.startsWith('/indice');

  const selectVersion = (version) => {
    selectedBibleVersion.set(version.value);
    isVersionMenuOpen = false;
  };

  // Logo: abre el menú lateral
  const handleLogoClick = (event) => {
    event.preventDefault();
    openAppMenu();
  };

  // Navegación con toggle: si ya estás en la ruta, vuelve a Home (/)
  const navigate = (event, path) => {
    event.preventDefault();
    const isActive = currentPath.startsWith(path);
    const target = isActive ? '/' : path;
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
      currentPath = target;
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDocumentClick = (event) => {
    if (!versionPickerElement?.contains(event.target)) {
      isVersionMenuOpen = false;
    }
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      isVersionMenuOpen = false;
    }
  };

  // Sincronizar currentPath con la URL
  const syncPath = () => {
    currentPath = window.location.pathname;
  };

  onMount(() => {
    syncPath();
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('popstate', syncPath);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('popstate', syncPath);
  });
</script>

<div class="header">
  <a class="logo" href="/" aria-label={$_('app.nav.logo_label')} on:click|preventDefault={handleLogoClick}>
    <!-- Logo SVG — diseño unificado. Ver public/favicon.svg y public/assets/img/logo-source.svg -->
    <svg class="logo__img" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="256" cy="256" r="240" fill="#2E7D9B"/>
      <path class="logo-book" d="M100 130 Q130 100 256 115 Q382 100 412 130" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
      <path class="logo-book" d="M100 130 Q130 120 256 145 Q382 120 412 130 L412 340 Q382 330 256 355 Q130 330 100 340 Z" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <line class="logo-spine" x1="256" y1="145" x2="256" y2="195" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
      <line class="logo-spine" x1="256" y1="305" x2="256" y2="355" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
      <path class="logo-book" d="M100 340 Q130 370 256 355 Q382 370 412 340" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
      <rect x="230" y="195" width="52" height="110" rx="8" fill="#D4A853"/>
      <rect x="202" y="220" width="108" height="52" rx="8" fill="#D4A853"/>
    </svg>
    <span class="logo__text">{$_('app.nav.logo_text')}</span>
  </a>

  <div class="header__actions">
    <a
      class="nav-link"
      class:nav-link--active={isOnCompare}
      href="/compara"
      title={isOnCompare ? $_('app.nav.back_to_home') : $_('app.compare.title')}
      aria-current={isOnCompare ? 'page' : undefined}
      on:click={(e) => navigate(e, '/compara')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="18" rx="1"/>
        <rect x="14" y="3" width="7" height="18" rx="1"/>
      </svg>
      <span>{$_('app.compare.title')}</span>
    </a>

    <a
      class="nav-link"
      class:nav-link--active={isOnIndex}
      href="/indice"
      title={isOnIndex ? $_('app.nav.back_to_home') : $_('app.topics.title')}
      aria-current={isOnIndex ? 'page' : undefined}
      on:click={(e) => navigate(e, '/indice')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
      </svg>
      <span>{$_('app.topics.title')}</span>
    </a>

    <div class="version-picker" bind:this={versionPickerElement}>
      <button
        type="button"
        class="version-picker__button"
        aria-haspopup="listbox"
        aria-expanded={isVersionMenuOpen}
        aria-label={$_('app.nav.version_label')}
        on:click|stopPropagation={() => (isVersionMenuOpen = !isVersionMenuOpen)}
      >
        <span>{selectedVersionLabel}</span>
        <span class="version-picker__chevron" aria-hidden="true"></span>
      </button>

      {#if isVersionMenuOpen}
        <div class="version-picker__menu" role="listbox" aria-label={$_('app.nav.version_label')}>
          {#each visibleBibleVersions as version (version.value)}
            <button
              type="button"
              class:version-picker__option--selected={version.value === selectedVersion}
              class="version-picker__option"
              role="option"
              aria-selected={version.value === selectedVersion}
              on:click={() => selectVersion(version)}
            >
              <span>{version.label}</span>
              {#if version.value === selectedVersion}
                <span class="version-picker__check" aria-hidden="true"></span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .header {
    display: flex;
    min-height: 5rem;
    box-shadow: var(--box-shadow-down);
    align-items: center;
    gap: 1rem;
    padding: 0.75rem clamp(1rem, 5vw, 5rem);
    background-color: var(--color-white);
    font-family: var(--font-family-base);
  }

  // Grupo derecho: Compare · Indice · Version picker
  .header__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid rgb(45 150 205 / 42%);
    border-radius: 0.28rem;
    background: color-mix(in srgb, var(--color-blue) 11%, var(--color-white));
    color: var(--color-bg-dark);
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;
    transition: var(--transition);
    white-space: nowrap;

    svg {
      width: 1.1rem;
      height: 1.1rem;
      flex: 0 0 auto;
    }

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 18%, var(--color-white));
      box-shadow: 0 0 0 3px rgb(45 150 205 / 14%);
      text-decoration: none;
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }

    &--active {
      border-color: var(--color-blue-hover);
      background: var(--color-blue);
      color: var(--color-on-primary);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 18%);

      &:hover,
      &:focus-visible {
        background: var(--color-blue-hover);
        color: var(--color-on-primary);
        border-color: var(--color-blue-hover);
      }
    }
  }

  .version-picker {
    position: relative;
    flex: 0 0 auto;
    min-width: min(13rem, 48vw);
  }

  .version-picker__button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: var(--button-height);
    border: 1px solid rgb(45 150 205 / 42%);
    border-radius: 0.28rem;
    background: color-mix(in srgb, var(--color-blue) 11%, var(--color-white));
    color: var(--color-bg-dark);
    padding: 0 0.85rem 0 1rem;
    font-weight: 700;
    transition: var(--transition);

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 18%, var(--color-white));
      box-shadow: 0 0 0 3px rgb(45 150 205 / 14%);
    }
  }

  .version-picker__chevron {
    width: 0.55rem;
    height: 0.55rem;
    flex: 0 0 auto;
    border-right: 2px solid currentcolor;
    border-bottom: 2px solid currentcolor;
    transform: translateY(-0.12rem) rotate(45deg);
  }

  .version-picker__menu {
    position: absolute;
    top: calc(100% + 0.45rem);
    right: 0;
    z-index: 30;
    display: grid;
    gap: 0.25rem;
    width: max(100%, 13rem);
    max-width: calc(100vw - 2rem);
    padding: 0.35rem;
    border: 1px solid rgb(63 88 103 / 18%);
    border-radius: 0.35rem;
    background: var(--color-white);
    box-shadow: var(--box-shadow-down);
  }

  .version-picker__option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: 2.45rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-bg-dark);
    padding: 0 0.65rem;
    text-align: left;
    transition: var(--transition);

    &:hover,
    &:focus-visible {
      border-color: rgb(45 150 205 / 34%);
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
    }

    &--selected {
      border-color: var(--color-blue);
      background: var(--color-blue);
      color: var(--color-on-primary);
      font-weight: 700;
    }
  }

  .version-picker__check {
    width: 0.75rem;
    height: 0.45rem;
    flex: 0 0 auto;
    border-left: 2px solid currentcolor;
    border-bottom: 2px solid currentcolor;
    transform: translateY(-0.08rem) rotate(-45deg);
  }

  .logo {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 0.65rem;

    &__img {
      width: 3rem;
      height: 3rem;
      flex: 0 0 auto;
    }

    &__text {
      color: var(--color-bg-dark);
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1;
    }
  }

  a.logo:hover {
    text-decoration: none;
  }

  // Logo SVG adapts to dark mode
  .logo-book { stroke: #FFFFFF; }
  .logo-spine { stroke: #FFFFFF; }

  :global(html[data-theme='dark']) .logo-book { stroke: #1d3040; }
  :global(html[data-theme='dark']) .logo-spine { stroke: #1d3040; }

  :global(html[data-theme='dark']) .nav-link {
    background: rgb(255 255 255 / 8%);
    color: #ffffff;

    &:hover,
    &:focus-visible {
      background: rgb(45 150 205 / 18%);
      border-color: var(--color-blue);
      color: #ffffff;
    }

    &--active {
      background: var(--color-blue);
      color: var(--color-on-primary);
    }
  }

  @media (max-width: 32rem) {
    .version-picker {
      min-width: min(11rem, 48vw);
    }

    .nav-link {
      padding: 0.3rem 0.55rem;
      font-size: 0.78rem;
      span { display: none; }
    }

    // Hide logo text on small screens to give room to other elements
    .logo__text {
      display: none;
    }

    .logo {
      gap: 0;
    }
  }

</style>