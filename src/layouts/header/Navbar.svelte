<script>
  import Icon from '../../components/Icon.svelte';
  import { onDestroy, onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { bibleVersions, selectedBibleVersion } from '../../store/stores';
  import { appMenuOpen, closeAppMenu, openAppMenu } from '../../store/appMenuStore';
  import { isAuthenticated } from '../../store/authStore';

  let isVersionMenuOpen = false;
  let versionPickerElement;
  let currentPath = '/';

  $: selectedVersion = $selectedBibleVersion;
  $: selectedVersionConfig = visibleBibleVersions.find((version) => version.value === selectedVersion);
  // Si la versión guardada no está en el catálogo, el propio identificador hace
  // de código: es feo pero informativo, y mejor que un botón en blanco.
  $: selectedVersionCode = selectedVersionConfig?.code || selectedVersion?.toUpperCase() || '';
  $: selectedVersionName = selectedVersionConfig?.bibleName || '';
  $: visibleBibleVersions = bibleVersions.some((version) => version.value === selectedVersion)
    ? bibleVersions
    : [{ value: selectedVersion, label: selectedVersion, code: selectedVersion?.toUpperCase() }, ...bibleVersions];

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
      <Icon name="compare" />
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
      <Icon name="bookmark" />
      <span class="nav-link__label">{$_('app.topics.title')}</span>
    </a>

    <div class="version-picker" bind:this={versionPickerElement}>
      <button
        type="button"
        class="version-picker__button"
        aria-haspopup="listbox"
        aria-expanded={isVersionMenuOpen}
        aria-label={`${$_('app.nav.version_label')}: ${selectedVersionCode} · ${selectedVersionName}`}
        on:click|stopPropagation={() => (isVersionMenuOpen = !isVersionMenuOpen)}
      >
        <!-- El código nunca se oculta ni se trunca: es lo único que dice de un
             vistazo en qué idioma estás. El nombre de la versión sí desaparece
             cuando no hay ancho. -->
        <span class="version-picker__code">{selectedVersionCode}</span>
        <span class="version-picker__name">{selectedVersionName}</span>
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
              <span class="version-picker__option-code">{version.code || version.value?.toUpperCase()}</span>
              <span class="version-picker__option-text">
                <span class="version-picker__option-name">{version.bibleName || version.label}</span>
                {#if version.label && version.bibleName && version.label !== version.bibleName}
                  <span class="version-picker__option-lang">{version.label}</span>
                {/if}
              </span>
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
    border: 1px solid color-mix(in srgb, var(--color-accent) 42%, transparent);
    border-radius: 0.28rem;
    background: var(--wash-accent);
    color: var(--color-ink-strong);
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
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 14%, transparent);
      text-decoration: none;
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }

    &--active {
      border-color: var(--color-blue-hover);
      background: var(--color-accent-solid);
      color: var(--color-on-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);

      &:hover,
      &:focus-visible {
        background: var(--color-accent-solid-hover);
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
    border: 1px solid color-mix(in srgb, var(--color-accent) 42%, transparent);
    border-radius: 0.28rem;
    background: var(--wash-accent);
    color: var(--color-ink-strong);
    padding: 0 0.7rem;
    font-weight: 700;
    font-size: 0.85rem;
    transition: var(--transition);
    white-space: nowrap;

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 18%, var(--color-white));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 14%, transparent);
    }
  }

  // Pastilla con el código de idioma. Es el elemento que resuelve la pregunta
  // "¿en qué idioma estoy?" sin tener que abrir nada.
  .version-picker__code {
    flex: 0 0 auto;
    padding: 0.1rem 0.35rem;
    border-radius: 0.22rem;
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.5;
  }

  .version-picker__name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .version-picker__chevron {
    width: 0.55rem;
    height: 0.55rem;
    flex: 0 0 auto;
    border-right: 2px solid currentcolor;
    border-bottom: 2px solid currentcolor;
    transform: translateY(-0.12rem) rotate(45deg);
  }

  // ── Opciones del desplegable ──────────────────────────────────────────────
  .version-picker__option-code {
    flex: 0 0 auto;
    min-width: 2.1rem;
    padding: 0.1rem 0.3rem;
    border-radius: 0.22rem;
    background: color-mix(in srgb, var(--color-accent) 14%, transparent);
    color: var(--color-accent);
    font-size: 0.7rem;
    font-weight: 700;
    text-align: center;
  }

  .version-picker__option-text {
    display: grid;
    flex: 1 1 auto; // empuja la marca de selección al borde derecho
    min-width: 0;
    text-align: left;
  }

  .version-picker__option-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // El idioma en pequeño bajo el nombre de la versión: con una sola versión por
  // idioma es redundante, pero en cuanto haya dos rumanas será lo que las separe.
  .version-picker__option-lang {
    font-size: 0.72rem;
    font-weight: 400;
    color: var(--color-ink-soft);
  }

  .version-picker__menu {
    position: absolute;
    top: calc(100% + 0.45rem);
    right: 0;
    z-index: 30;
    display: grid;
    gap: 0.25rem;
    // 16rem y no 13rem: con la pastilla del código delante, a 13rem se truncaban
    // "Biblia Română" y "King James Version", que es justo lo que hay que leer.
    width: max(100%, 16rem);
    max-width: calc(100vw - 1.5rem);
    padding: 0.35rem;
    border: 1px solid var(--color-line-strong);
    border-radius: 0.35rem;
    background: var(--color-surface-raised);
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
      border-color: color-mix(in srgb, var(--color-accent) 34%, transparent);
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
    }

    &--selected {
      border-color: var(--color-blue);
      background: var(--color-accent-solid);
      color: var(--color-on-primary);
      font-weight: 700;

      // Sobre el fondo azul de la opción activa, la pastilla del código se
      // volvía invisible: era azul sobre azul. Aquí se invierte.
      .version-picker__option-code {
        background: color-mix(in srgb, var(--color-on-primary) 24%, transparent);
        color: var(--color-on-primary);
      }

      .version-picker__option-lang {
        color: color-mix(in srgb, var(--color-on-primary) 78%, transparent);
      }
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
    border: 1px solid color-mix(in srgb, var(--color-accent) 42%, transparent);
    border-radius: 0.28rem;
    background: var(--wash-accent);
    color: var(--color-ink-strong);
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
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 14%, transparent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }

    // Cuando el menu está abierto, el botón refleja ese estado
    // con un color sólido (mismo lenguaje visual que nav-link--active).
    &--open {
      background: var(--color-accent-solid);
      border-color: var(--color-accent-solid-hover);
      color: var(--color-on-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
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
    transition: transform var(--motion-slow) ease, opacity var(--motion-fast) ease, top var(--motion-slow) ease;
    transform-origin: center;
  }

  .hamburger__line:nth-child(1) { top: 0; }
  .hamburger__line:nth-child(2) { top: 0.45rem; }
  .hamburger__line:nth-child(3) { top: 0.9rem; }

  // Cuando está logueado: tinte verde (mismo estilo que footer__auth--signed)
  .hamburger--signed {
    border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
    background: var(--color-success-wash);
    color: var(--color-success-ink);
  }


  // Hover: tinte azul (estilo normal del header)
  .hamburger--signed:hover {
    border-color: var(--color-blue);
    background: color-mix(in srgb, var(--color-blue) 10%, var(--color-white));
    color: var(--color-text-dark);
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
    // En móvil se oculta el nombre de la versión, no el código.
    //
    // Antes se ocultaba la etiqueta entera y el botón se quedaba en un chevron
    // suelto: no había forma de saber qué idioma estaba activo sin abrir el
    // desplegable. El código ocupa tres caracteres y responde la pregunta.
    .version-picker__button {
      min-width: 0;
      padding: 0 0.45rem;
      gap: 0.3rem;

      .version-picker__name { display: none; }
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
