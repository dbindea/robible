<script>
  import { _ } from '../../services/i18n.service';
  import { favoritesStore } from '../../store/favoritesStore';
  import { isAuthenticated } from '../../store/authStore';
  import { openAuthMenu } from '../../store/authMenuStore';
  import { buildBiblePath, getBookSlug } from '../../services/bible-route.service';
  import { selectedBibleVersion } from '../../store/stores';
  import { getBibleVersionConfigOrDefault } from '../../store/stores';
  import { applySeoMetadata, buildCurrentBibleSeo } from '../../services/seo.service';

  export let bible;
  export let map;

  // SEO
  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
  $: {
    applySeoMetadata(buildCurrentBibleSeo({
      searchForm: { searchText: null, testament: 'all', book: [], chapter: [] },
      map,
      versionConfig,
    }));
  }

  // Estado
  $: favorites = $favoritesStore;
  $: favoritesCount = favorites.length;

  // Genera el path del versículo para navegar
  const buildVersePath = (fav) => {
    const bookSlug = getBookSlug(map, fav.book);
    if (!bookSlug) return null;
    return buildBiblePath({
      version: $selectedBibleVersion,
      map,
      book: fav.book,
      chapter: fav.chapter,
      verse: fav.verse,
    });
  };

  const navigateToVerse = (fav) => {
    const path = buildVersePath(fav);
    if (!path) return;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeFavorite = async (fav) => {
    await favoritesStore.remove(fav.book, fav.chapter, fav.verse);
  };

  // Formato de fecha
  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  // El versículo completo (lookup en bible)
  const getVerseText = (fav) => {
    if (!bible || !bible[fav.book] || !bible[fav.book][fav.chapter - 1]) return null;
    return bible[fav.book][fav.chapter - 1][fav.verse - 1] || null;
  };

  // Agrupar por libro
  $: grouped = (() => {
    const groups = new Map();
    for (const fav of favorites) {
      const bookName = map[fav.book] || `Book ${fav.book + 1}`;
      if (!groups.has(bookName)) groups.set(bookName, []);
      groups.get(bookName).push(fav);
    }
    return Array.from(groups.entries()).map(([name, items]) => ({
      name,
      items: items.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse),
    }));
  })();
</script>

<header class="favorites-header">
  <p class="favorites-header__eyebrow">{$_('app.favorites.eyebrow')}</p>
  <h1 class="favorites-header__title">{$_('app.favorites.title')}</h1>
  <p class="favorites-header__lead">{$_('app.favorites.lead', { count: favoritesCount })}</p>
</header>

{#if !$isAuthenticated}
  <div class="auth-prompt">
    <p class="auth-prompt__icon" aria-hidden="true">⭐</p>
    <p class="auth-prompt__text">{$_('app.favorites.login_required')}</p>
    <p class="auth-prompt__hint">{$_('app.favorites.login_required_hint')}</p>
    <button type="button" class="auth-prompt__btn" on:click={openAuthMenu}>
      {$_('app.favorites.login_prompt_action')}
    </button>
  </div>
{:else if favoritesCount === 0}
  <div class="favorites-empty">
    <p class="favorites-empty__icon" aria-hidden="true">⭐</p>
    <p class="favorites-empty__text">{$_('app.favorites.empty')}</p>
    <p class="favorites-empty__hint">{$_('app.favorites.empty_hint')}</p>
  </div>
{:else}
  <div class="favorites-list">
    {#each grouped as group (group.name)}
      <section class="favorites-group">
        <h2 class="favorites-group__title">{group.name}</h2>
        <ul class="favorites-group__items">
          {#each group.items as fav (fav.id || `${fav.book}-${fav.chapter}-${fav.verse}`)}
            {@const verseText = getVerseText(fav)}
            <li class="favorite-item">
              <div class="favorite-item__head">
                <button
                  class="favorite-item__ref"
                  type="button"
                  on:click={() => navigateToVerse(fav)}
                  title={$_('app.favorites.open_verse')}
                >
                  {group.name} {fav.chapter}:{fav.verse}
                </button>
                <span class="favorite-item__date">{formatDate(fav.addedAt)}</span>
                <button
                  class="icon-btn favorite-item__remove"
                  type="button"
                  title={$_('app.favorites.remove')}
                  aria-label={$_('app.favorites.remove_reference', { reference: `${group.name} ${fav.chapter}:${fav.verse}` })}
                  on:click={() => removeFavorite(fav)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
              {#if verseText}
                <p class="favorite-item__text">{verseText}</p>
              {:else}
                <p class="favorite-item__text favorite-item__text--missing">[…]</p>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}

<style lang="scss">
  .favorites-header {
    margin-bottom: 1.5rem;

    &__eyebrow {
      margin: 0 0 0.35rem;
      color: var(--color-blue);
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    &__title {
      margin: 0 0 0.5rem;
      font-size: clamp(1.5rem, 3vw, 2rem);
      line-height: 1.2;
      color: var(--color-bg-dark);
    }

    &__lead {
      margin: 0;
      color: color-mix(in srgb, var(--color-bg-dark) 70%, transparent);
      font-size: 0.95rem;
    }
  }

  .favorites-empty {
    text-align: center;
    padding: 3rem 1.5rem;
    border: 2px dashed color-mix(in srgb, var(--color-bg-dark) 14%, transparent);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--color-bg-dark) 3%, var(--color-white));

    &__icon {
      margin: 0 0 0.75rem;
      font-size: 3rem;
      opacity: 0.6;
    }

    &__text {
      margin: 0 0 0.5rem;
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--color-bg-dark);
    }

    &__hint {
      margin: 0;
      font-size: 0.9rem;
      color: color-mix(in srgb, var(--color-bg-dark) 60%, transparent);
    }
  }

  .favorites-list {
    display: grid;
    gap: 1.25rem;
  }

  .favorites-group {
    &__title {
      margin: 0 0 0.6rem;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--color-blue);
      border-bottom: 1px solid color-mix(in srgb, var(--color-blue) 22%, transparent);
      padding-bottom: 0.4rem;
    }

    &__items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }
  }

  .favorite-item {
    display: grid;
    gap: 0.4rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid color-mix(in srgb, var(--color-bg-dark) 12%, transparent);
    border-radius: 0.45rem;
    background: var(--color-white);
    transition: border-color 0.15s ease, background 0.15s ease;

    &:hover {
      border-color: color-mix(in srgb, var(--color-blue) 35%, transparent);
      background: color-mix(in srgb, var(--color-blue) 4%, var(--color-white));
    }

    &__head {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    &__ref {
      background: none;
      border: 0;
      padding: 0;
      color: var(--color-link);
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      text-align: left;

      &:hover, &:focus-visible {
        text-decoration: underline;
        text-underline-offset: 0.18em;
      }
    }

    &__date {
      margin-left: auto;
      font-size: 0.75rem;
      color: color-mix(in srgb, var(--color-bg-dark) 50%, transparent);
    }

    &__remove {
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 0.15s;
    }

    &:hover &__remove,
    &:focus-within &__remove { opacity: 1; }

    &__text {
      margin: 0;
      font-size: 0.92rem;
      line-height: 1.5;
      color: var(--color-bg-dark);

      &--missing {
        opacity: 0.4;
        font-style: italic;
      }
    }
  }

  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: 1.65rem;
    height: 1.65rem;
    border: 1px solid color-mix(in srgb, var(--color-accent) 24%, transparent);
    border-radius: 0.28rem;
    background: color-mix(in srgb, var(--color-accent) 7%, transparent);
    color: var(--color-link);
    cursor: pointer;
    transition: var(--transition);

    svg { width: 0.85rem; height: 0.85rem; }

    &:hover, &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-accent) 18%, transparent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 14%, transparent);
    }
  }

  :global(html[data-theme='dark']) .favorites-header__title { color: #ffffff; }
  :global(html[data-theme='dark']) .favorite-item {
    background: #1a2733;
    border-color: rgb(255 255 255 / 8%);
    color: #e5edf3;
    &:hover { background: color-mix(in srgb, var(--color-accent) 14%, transparent); border-color: var(--color-accent-soft); }
  }
  :global(html[data-theme='dark']) .favorites-group__title { color: var(--color-accent-soft); border-bottom-color: rgb(126 200 227 / 22%); }
  :global(html[data-theme='dark']) .favorites-empty {
    background: rgb(255 255 255 / 3%);
    border-color: rgb(255 255 255 / 14%);
  }
  :global(html[data-theme='dark']) .favorite-item__ref { color: var(--color-accent-soft); }
  :global(html[data-theme='dark']) .favorite-item__text { color: #e5edf3; }
  :global(html[data-theme='dark']) .favorite-item__date { color: rgb(255 255 255 / 50%); }

  // === Auth prompt ===
  .auth-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-height: 40vh;
    text-align: center;
    padding: 3rem 1.5rem;
    border: 2px dashed color-mix(in srgb, var(--color-bg-dark) 14%, transparent);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--color-bg-dark) 3%, var(--color-white));

    &__icon {
      margin: 0;
      font-size: 3rem;
      opacity: 0.6;
    }

    &__text {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--color-bg-dark);
    }

    &__hint {
      margin: 0;
      font-size: 0.9rem;
      color: color-mix(in srgb, var(--color-bg-dark) 60%, transparent);
    }

    &__btn {
      margin-top: 0.5rem;
      padding: 0.6rem 1.4rem;
      border: 1px solid var(--color-blue);
      border-radius: 0.4rem;
      background: var(--color-blue);
      color: var(--color-white);
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition);

      &:hover, &:focus-visible {
        background: var(--color-blue-hover);
        border-color: var(--color-blue-hover);
      }
    }
  }

  :global(html[data-theme='dark']) .auth-prompt {
    background: rgb(255 255 255 / 3%);
    border-color: rgb(255 255 255 / 14%);

    &__text { color: #ffffff; }
    &__hint { color: rgb(255 255 255 / 55%); }
  }
</style>
