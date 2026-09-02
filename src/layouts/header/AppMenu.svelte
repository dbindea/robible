<script>
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
    { key: 'user', icon: 'user', enabled: false },
  ];

  $: staticItems = staticItemDefs.map((def) => {
    if (def.key === 'home') return { ...def, href: '/' };
    const config = getBibleVersionConfigOrDefault($selectedBibleVersion);
    const href = config?.[def.pathKey] ? `/${config[def.pathKey]}` : def.defaultHref;
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              {:else if item.icon === 'compare'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="18" rx="1"/>
                  <rect x="14" y="3" width="7" height="18" rx="1"/>
                  <path d="M10 12h4M10 8l-2 4 2 4M14 8l2 4-2 4"/>
                </svg>
              {:else if item.icon === 'bookmark'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                </svg>
              {:else if item.icon === 'star'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              {:else if item.icon === 'notes'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              {:else if item.icon === 'user'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              {#if $isAuthenticated}
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              {:else}
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              {/if}
            </svg>
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
    background-color: rgb(7 24 31 / 48%);
    backdrop-filter: blur(2px);
  }

  .app-menu {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 41;
    display: flex;
    flex-direction: column;
    width: min(22rem, calc(100vw - 1.5rem));
    background-color: var(--color-white);
    box-shadow: 1rem 0 2rem rgb(24 47 61 / 24%);
    transform: translateX(-104%);
    transition: transform 0.24s ease;
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
    border-bottom: 1px solid rgb(63 88 103 / 14%);
    flex-shrink: 0;

    p,
    h2 {
      margin: 0;
    }

    p {
      color: var(--color-blue);
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    h2 {
      color: var(--color-bg-dark);
      font-size: 1.4rem;
      line-height: 1.2;
    }
  }

  .app-menu__close {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid rgb(63 88 103 / 18%);
    border-radius: 0.35rem;
    background: var(--color-white);
    color: var(--color-bg-dark);
    transition: var(--transition);
    flex-shrink: 0;

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 16%);
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
    color: var(--color-bg-dark);
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
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
      color: var(--color-blue);

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
      color: color-mix(in srgb, var(--color-bg-dark) 60%, transparent);
      line-height: 1.2;
    }

    .app-menu__soon {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
      color: var(--color-blue);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 8%, var(--color-white));
    }

    &--disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }

  .app-menu__footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid rgb(63 88 103 / 14%);
    flex-shrink: 0;

    p {
      margin: 0;
      font-size: 0.78rem;
      color: color-mix(in srgb, var(--color-bg-dark) 60%, transparent);
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

  // Dark mode
  :global(html[data-theme='dark']) .app-menu {
    background: #1a2733;
    color: #e5edf3;
  }

  :global(html[data-theme='dark']) .app-menu__header {
    border-bottom-color: rgb(255 255 255 / 8%);

    h2 { color: #ffffff; }
  }

  :global(html[data-theme='dark']) .app-menu__close {
    background: #243442;
    border-color: rgb(255 255 255 / 12%);
    color: #ffffff;
  }

  :global(html[data-theme='dark']) .app-menu__item {
    color: #ffffff;

    .app-menu__icon {
      background: rgb(45 150 205 / 18%);
      color: #7ec8e3;
    }

    // .online-dot (clase global) ya no necesita overrides en dark mode

    .app-menu__hint {
      color: rgb(255 255 255 / 50%);
    }

    .app-menu__soon {
      background: rgb(45 150 205 / 18%);
      color: #7ec8e3;
    }

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
      background: rgb(45 150 205 / 14%);
      border-color: #7ec8e3;
    }
  }

  :global(html[data-theme='dark']) .app-menu__footer {
    border-top-color: rgb(255 255 255 / 8%);

    p { color: rgb(255 255 255 / 50%); }
  }
</style>
