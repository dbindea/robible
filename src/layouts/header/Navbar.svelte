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
    <!-- Logo SVG — emblema RoBible: doble anillo + planta/llama de 3 hojas + pedestal -->
    <svg class="logo__img" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect class="logo-bg" x="0" y="0" width="512" height="512" rx="96" ry="96"/>
      <g class="logo-accent" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="256" cy="232" r="172" stroke-width="14"/>
        <circle cx="256" cy="232" r="126" stroke-width="11"/>
        <path d="M 256 100 C 360 180, 360 280, 256 336 C 152 280, 152 180, 256 100 Z" stroke-width="13"/>
        <path d="M 256 156 C 312 200, 312 270, 256 312 C 200 270, 200 200, 256 156 Z" stroke-width="13"/>
        <path d="M 124 148 C 198 188, 232 280, 256 336 C 200 268, 148 220, 124 148 Z" stroke-width="13"/>
        <path d="M 388 148 C 314 188, 280 280, 256 336 C 312 268, 364 220, 388 148 Z" stroke-width="13"/>
        <line x1="56" y1="336" x2="456" y2="336" stroke-width="14"/>
        <line x1="256" y1="336" x2="256" y2="420" stroke-width="14"/>
        <line x1="200" y1="420" x2="312" y2="420" stroke-width="14"/>
      </g>
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
      <span class="nav-link__label">{$_('app.compare.title')}</span>
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
      <span class="nav-link__label">{$_('app.topics.title')}</span>
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
        <span class="version-picker__label">{selectedVersionLabel}</span>
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
    gap: 0.75rem;
    padding: 0.75rem clamp(0.75rem, 2.5vw, 2.5rem);
    background-color: var(--color-white);
    font-family: var(--font-family-base);
    overflow: visible; // importante: nada se recorta
  }

  // Grupo derecho: Compare · Indice · Version picker
  .header__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
    flex-wrap: nowrap; // nunca se parten: siempre una fila
    min-width: 0;
  }

  .nav-link {
    display: inline-flex;
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
    flex-shrink: 0;

    svg {
      width: 1.1rem;
      height: 1.1rem;
      flex: 0 0 auto;
    }

    .nav-link__label {
      // visible por defecto (desktop)
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
    min-width: 0;
  }

  .version-picker__button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    min-height: var(--button-height);
    border: 1px solid rgb(45 150 205 / 42%);
    border-radius: 0.28rem;
    background: color-mix(in srgb, var(--color-blue) 11%, var(--color-white));
    color: var(--color-bg-dark);
    padding: 0 0.7rem;
    font-weight: 700;
    font-size: 0.85rem;
    transition: var(--transition);
    white-space: nowrap;

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
    flex-shrink: 0;

    &__img {
      width: 2.75rem;
      height: 2.75rem;
      flex: 0 0 auto;
      display: block;
    }

    &__text {
      color: var(--color-bg-dark);
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;
    }
  }

  a.logo:hover {
    text-decoration: none;
  }

  // Logo colors: usan variables para que se adapten al tema sin perder
  // la identidad de marca. En light usa el teal profundo; en dark el
  // mismo teal luce sobre el fondo casi-negro sin perder contraste.
  .logo-bg { fill: #1f4a5c; }
  .logo-accent { stroke: #d28456; }

  :global(html[data-theme='dark']) .logo-bg { fill: #1f4a5c; }
  :global(html[data-theme='dark']) .logo-accent { stroke: #d28456; }

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

  :global(html[data-theme='dark']) .version-picker__button {
    background: rgb(255 255 255 / 8%);
    color: #ffffff;
  }

  :global(html[data-theme='dark']) .version-picker__menu {
    background: #1a2733;
    border-color: rgb(255 255 255 / 12%);
  }

  :global(html[data-theme='dark']) .version-picker__option {
    color: #ffffff;

    &:hover,
    &:focus-visible {
      background: rgb(45 150 205 / 18%);
      border-color: rgb(45 150 205 / 34%);
    }
  }

  // ── Breakpoint 1: tablet (<60rem = 960px) ──
  // Los nav-links ocultan el texto, solo se ve el icono.
  // El version-picker se mantiene con su label pero más compacto.
  @media (max-width: 60rem) {
    .nav-link {
      padding: 0.5rem 0.65rem;
      .nav-link__label { display: none; }
    }
    .version-picker__button {
      padding: 0 0.6rem;
      font-size: 0.82rem;
    }
  }

  // ── Breakpoint 2: mobile (<40rem = 640px) ──
  // Logo solo icono, version-picker se reduce al mínimo
  // y los nav-links siguen icono-only.
  @media (max-width: 40rem) {
    .header {
      padding: 0.5rem 0.75rem;
      gap: 0.5rem;
    }
    .logo {
      gap: 0;
      &__text { display: none; }
    }
    .version-picker__button {
      min-width: 0;
      padding: 0 0.55rem;
      .version-picker__label { display: none; }
    }
    .version-picker__chevron {
      // al ocultar el label, el chevron queda solo a la derecha
    }
  }

  // ── Breakpoint 3: ultra-strict (<22rem) — emergency fallback ──
  // Por si alguien rota el móvil a un ancho de tablet estrecho.
  @media (max-width: 22rem) {
    .header { gap: 0.35rem; padding: 0.4rem 0.5rem; }
    .header__actions { gap: 0.35rem; }
    .nav-link { padding: 0.4rem 0.5rem; }
  }
</style>
