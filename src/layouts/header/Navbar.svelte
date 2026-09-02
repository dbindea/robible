<script>
  import { onDestroy, onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { bibleVersions, resetFilter, selectedBibleVersion } from '../../store/stores';
  import { appMenuOpen, closeAppMenu, openAppMenu } from '../../store/appMenuStore';
  import { isAuthenticated } from '../../store/authStore';

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

  // Botón hamburguesa: alterna el menú lateral
  const handleMenuToggle = (event) => {
    event.preventDefault();
    if ($appMenuOpen) {
      closeAppMenu();
    } else {
      openAppMenu();
    }
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
    console.log('[Navbar] onMount - locale:', document.documentElement.lang, 'menu_open:', 'app.nav.menu_open');
    syncPath();
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('popstate', syncPath);
  });

  onDestroy(() => {
    console.log('[Navbar] onDestroy');
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('popstate', syncPath);
  });
</script>

<div class="header">
  <button
    type="button"
    class="hamburger"
    class:hamburger--open={$appMenuOpen}
    class:hamburger--signed={$isAuthenticated}
    aria-label={$appMenuOpen ? $_('app.nav.menu_close') : $_('app.nav.menu_open')}
    aria-expanded={$appMenuOpen}
    aria-controls="app-menu"
    on:click={handleMenuToggle}
  >
    <span class="hamburger__lines" aria-hidden="true">
      <span class="hamburger__line"></span>
      <span class="hamburger__line"></span>
      <span class="hamburger__line"></span>
    </span>
    <span class="hamburger__text">{$_('app.nav.menu_label')}</span>
  </button>

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

  // ── Botón hamburguesa ───────────────────────────────────────────
  // Reemplaza al logo anterior como acceso al menú lateral.
  // 3 líneas → X cuando está abierto. La línea central se desvanece,
  // las dos exteriores rotan y se juntan formando la X.
  .hamburger {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    min-height: var(--button-height);
    padding: 0 0.85rem 0 0.7rem;
    border: 1px solid rgb(45 150 205 / 42%);
    border-radius: 0.28rem;
    background: color-mix(in srgb, var(--color-blue) 11%, var(--color-white));
    color: var(--color-bg-dark);
    font-weight: 700;
    font-size: 0.92rem;
    cursor: pointer;
    flex-shrink: 0;
    transition: var(--transition);
    font-family: inherit;

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 18%, var(--color-white));
      box-shadow: 0 0 0 3px rgb(45 150 205 / 14%);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }

    // Cuando el menu está abierto, el botón refleja ese estado
    // con un color sólido (mismo lenguaje visual que nav-link--active).
    &--open {
      background: var(--color-blue);
      border-color: var(--color-blue-hover);
      color: var(--color-on-primary);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 18%);
    }
  }

  // Las 3 líneas. 22px de ancho total, centradas, con gap.
  .hamburger__lines {
    position: relative;
    display: inline-block;
    width: 1.35rem;
    height: 0.95rem;
    flex: 0 0 auto;
  }

  .hamburger__line {
    position: absolute;
    left: 0;
    width: 100%;
    height: 2px;
    background-color: currentcolor;
    border-radius: 2px;
    transition: transform 0.24s ease, opacity 0.16s ease, top 0.24s ease;
    transform-origin: center;
  }

  .hamburger__line:nth-child(1) { top: 0; }
  .hamburger__line:nth-child(2) { top: 0.45rem; }
  .hamburger__line:nth-child(3) { top: 0.9rem; }

  // Cuando está logueado: tinte verde (mismo estilo que footer__auth--signed)
  .hamburger--signed {
    border-color: #28a74566;
    background: #28a7451a;
    color: rgb(20 110 45);
  }

  :global(html[data-theme='dark']) .hamburger--signed {
    background: #28a7452e;
    border-color: #28a74566;
    color: #7ee79a;
  }

  // Hover: tinte azul (estilo normal del header)
  .hamburger--signed:hover {
    border-color: var(--color-blue);
    background: color-mix(in srgb, var(--color-blue) 10%, var(--color-white));
    color: var(--color-text-dark);
  }

  :global(html[data-theme='dark']) .hamburger--signed:hover {
    color: #ffffff;
  }

  // Cuando está abierto, las dos exteriores rotan y se cruzan
  // en el centro, la del medio se desvanece → forma una X.
  .hamburger--open .hamburger__line:nth-child(1) {
    top: 0.45rem;
    transform: rotate(45deg);
  }
  .hamburger--open .hamburger__line:nth-child(2) {
    opacity: 0;
    transform: scaleX(0.4);
  }
  .hamburger--open .hamburger__line:nth-child(3) {
    top: 0.45rem;
    transform: rotate(-45deg);
  }

  // Texto al lado del icono. Visible en desktop, oculto en mobile
  // para ganar espacio (junto con el resto del header).
  .hamburger__text {
    white-space: nowrap;
    line-height: 1;
  }

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
  // Hamburger solo icono, version-picker se reduce al mínimo
  // y los nav-links siguen icono-only.
  @media (max-width: 40rem) {
    .header {
      padding: 0.5rem 0.75rem;
      gap: 0.5rem;
    }
    .hamburger {
      padding: 0 0.55rem;
      .hamburger__text { display: none; }
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
