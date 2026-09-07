<script>
  import Icon from '../../components/Icon.svelte';
  import { onDestroy } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { appMenuOpen, closeAppMenu } from '../../store/appMenuStore';
  import { openAuthMenu } from '../../store/authMenuStore';
  import { isAuthenticated, currentUser } from '../../store/authStore';
  import { selectedBibleVersion } from '../../store/stores';
  import { getBibleVersionConfigOrDefault } from '../../config/bible-versions';

  export let onNavigate = () => {};

  // Items estáticos del menú. Los href se resuelven reactivamente
  // según el idioma de la biblia activa (rumano/español).
  const staticItemDefs = [
    { key: 'home', icon: 'home', enabled: true },
    { key: 'compare', icon: 'compare', enabled: true, pathKey: 'comparePath', defaultHref: '/compara' },
    { key: 'index', icon: 'bookmark', enabled: true, pathKey: 'indexPath', defaultHref: '/indice' },
    { key: 'favorites', icon: 'star', enabled: true, pathKey: 'favoritesPath', defaultHref: '/favorites' },
    { key: 'notes', icon: 'notes', enabled: true, pathKey: 'notesPath', defaultHref: '/notes' },
    // Sólo para cuentas de tipo predicador. No se traduce por idioma: es una
    // ruta privada, no indexable, y no gana nada teniendo cuatro formas.
    { key: 'sermons', icon: 'sermons', enabled: true, defaultHref: '/predici', onlyPreacher: true },
    { key: 'user', icon: 'user', enabled: false },
  ];

  // El menú se recalcula con el usuario: al pasar de usuario a predicador (o al
  // revés) el item aparece o desaparece sin recargar.
  $: staticItems = staticItemDefs
    .filter((def) => !def.onlyPreacher || $currentUser?.userType === 'preacher')
    .map((def) => {
      if (def.key === 'home') return { ...def, href: '/' };
      const config = getBibleVersionConfigOrDefault($selectedBibleVersion);
      const href = def.pathKey && config?.[def.pathKey] ? `/${config[def.pathKey]}` : def.defaultHref;
      return { ...def, href };
    });

  $: if (typeof document !== 'undefined') {
    document.body.classList.toggle('app-menu-open', $appMenuOpen);
  }

  const handleKeydown = (event) => {
    if (event.key === 'Escape' && $appMenuOpen) {
      closeAppMenu();
    }
  };

  const handleItemClick = (item) => {
    if (!item.enabled) return;
    onNavigate(item.href);
    closeAppMenu();
  };

  // El item de auth abre el modal de auth (no navega)
  const handleAuthClick = () => {
    closeAppMenu();
    openAuthMenu();
  };

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('app-menu-open');
    }
  });
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $appMenuOpen}
  <div class="app-menu__overlay" aria-hidden="true" on:click={closeAppMenu}></div>
{/if}

<aside
  class:app-menu--open={$appMenuOpen}
  class="app-menu"
  aria-hidden={!$appMenuOpen}
  aria-label={$_('app.app_menu.aria_label')}
>
  <div class="app-menu__header">
    <div>
      <p>{$_('app.app_menu.eyebrow')}</p>
      <h2>{$_('app.app_menu.title')}</h2>
    </div>
    <button
      class="app-menu__close"
      type="button"
      tabindex={$appMenuOpen ? 0 : -1}
      aria-label={$_('app.app_menu.close')}
      on:click={closeAppMenu}
    >
      <span class="icon-cross" aria-hidden="true"></span>
    </button>
  </div>

  <nav class="app-menu__nav" aria-label={$_('app.app_menu.title')}>
    <ul>
      {#each staticItems as item (item.key)}
        <li>
          <button
            type="button"
            class="app-menu__item"
            class:app-menu__item--disabled={!item.enabled}
            disabled={!item.enabled}
            tabindex={$appMenuOpen ? 0 : -1}
            on:click={() => handleItemClick(item)}
            aria-label={$_(`app.app_menu.items.${item.key}.label`)}
          >
            <span class="app-menu__icon" aria-hidden="true">
              {#if item.icon === 'home'}
                <Icon name="book-open" />
              {:else if item.icon === 'compare'}
                <Icon name="compare" />
              {:else if item.icon === 'bookmark'}
                <Icon name="bookmark" />
              {:else if item.icon === 'star'}
                <Icon name="star" />
              {:else if item.icon === 'notes'}
                <Icon name="file-text" />
              {:else if item.icon === 'sermons'}
                <!-- Atril: la imagen del púlpito, que es donde acaba una predicación -->
                <Icon name="lectern" />
              {:else if item.icon === 'user'}
                <Icon name="user" />
              {/if}
            </span>
            <span class="app-menu__text">
              <span class="app-menu__label">{$_(`app.app_menu.items.${item.key}.label`)}</span>
              <span class="app-menu__hint">{$_(`app.app_menu.items.${item.key}.hint`)}</span>
            </span>
            {#if !item.enabled}
              <span class="app-menu__soon" aria-hidden="true">{$_('app.app_menu.coming_soon')}</span>
            {/if}
          </button>
        </li>
      {/each}

      <!-- Auth item (separado porque abre modal, no navega) -->
      <li class="app-menu__separator" aria-hidden="true"></li>
      <li>
        <button
          type="button"
          class="app-menu__item"
          tabindex={$appMenuOpen ? 0 : -1}
          on:click={handleAuthClick}
          aria-label={$isAuthenticated ? $_('auth.signed_in') : $_('app.app_menu.items.auth.label')}
        >
          <span class="app-menu__icon" aria-hidden="true">
            <!-- Con sesión, la silueta; sin ella, la flecha de entrar. -->
            {#if $isAuthenticated}
              <Icon name="user" />
            {:else}
              <Icon name="sign-in" />
            {/if}
            {#if $isAuthenticated}
              <span class="online-dot online-dot--absolute" aria-hidden="true"></span>
            {/if}
          </span>
          <span class="app-menu__text">
            <span class="app-menu__label">
              {#if $isAuthenticated}
                {$currentUser?.nickname}
              {:else}
                {$_('app.app_menu.items.auth.label')}
              {/if}
            </span>
            <span class="app-menu__hint">
              {#if $isAuthenticated}
                {$_('app.app_menu.items.auth.signed_in_hint')}
              {:else}
                {$_('app.app_menu.items.auth.hint')}
              {/if}
            </span>
          </span>
        </button>
      </li>
    </ul>
  </nav>

  <footer class="app-menu__footer">
    <p>{$_('app.app_menu.footer_text')}</p>
  </footer>
</aside>

<style lang="scss">
  .app-menu__overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    background-color: var(--color-scrim);
    backdrop-filter: blur(2px);
  }

  .app-menu {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 41;
    display: flex;
    flex-direction: column;
    width: min(22rem, calc(100vw - 1.5rem));
    background-color: var(--color-surface-raised);
    box-shadow: 1rem 0 2rem var(--shadow-tint-strong);
    transform: translateX(-104%);
    transition: transform var(--motion-slow) var(--ease-out);
    will-change: transform;
  }

  .app-menu--open {
    transform: translateX(0);
  }

  .app-menu__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem;
    border-bottom: 1px solid var(--color-line);
    flex-shrink: 0;

    p,
    h2 {
      margin: 0;
    }

    p {
      color: var(--color-accent-ink);
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    h2 {
      color: var(--color-ink-strong);
      font-size: 1.4rem;
      line-height: 1.2;
    }
  }

  .app-menu__close {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid var(--color-line-strong);
    border-radius: 0.35rem;
    background: var(--color-field);
    color: var(--color-ink);
    transition: var(--transition);
    flex-shrink: 0;

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 16%, transparent);
    }
  }

  .app-menu__nav {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.35rem;
    }
  }

  .app-menu__separator {
    list-style: none;
    height: 1px;
    margin: 0.45rem 0.25rem;
    background: color-mix(in srgb, var(--color-bg-dark) 12%, transparent);
  }

  .app-menu__item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    width: 100%;
    padding: 0.7rem 0.85rem;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--color-ink-strong);
    text-align: left;
    cursor: pointer;
    transition: var(--transition);
    font-family: inherit;

    .app-menu__icon {
      position: relative;
      display: grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      flex-shrink: 0;
      border-radius: 0.5rem;
      background: var(--wash-accent);
      color: var(--color-accent-ink);

      svg {
        width: 1.15rem;
        height: 1.15rem;
      }
    }

    // Online dot — usa la clase global .online-dot--absolute (definida en global.css)

    .app-menu__text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 0;
      flex: 1;
    }

    .app-menu__label {
      font-size: 0.95rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .app-menu__hint {
      font-size: 0.78rem;
      color: var(--color-ink-soft);
      line-height: 1.2;
    }

    .app-menu__soon {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: var(--wash-accent);
      color: var(--color-accent-ink);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
      border-color: var(--color-blue);
      background: var(--wash-accent);
    }

    &--disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }

  .app-menu__footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--color-line);
    flex-shrink: 0;

    p {
      margin: 0;
      font-size: 0.78rem;
      color: var(--color-ink-soft);
    }
  }

  @media (max-width: 34rem) {
    .app-menu {
      width: 100vw;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .app-menu {
      transition: none;
    }
  }





  // ── Cristal ───────────────────────────────────────────────────────────
  // El fondo opaco de la regla de arriba es la base y se queda: si el
  // navegador no desenfoca, el texto se lee sobre color sólido en vez de
  // sobre el contenido de la página. La transparencia sólo entra donde hay
  // desenfoque real.
  @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
    .app-menu {
      background: var(--glass-tint);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      border-color: var(--glass-line);
    }
  }
</style>
