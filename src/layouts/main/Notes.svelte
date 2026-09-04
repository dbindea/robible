<script>
  import { _ } from '../../services/i18n.service';
  import { notesStore } from '../../store/notesStore';
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
  $: notes = $notesStore;
  $: notesCount = notes.length;

  const buildVersePath = (note) => {
    const bookSlug = getBookSlug(map, note.book);
    if (!bookSlug) return null;
    return buildBiblePath({
      version: $selectedBibleVersion,
      map,
      book: note.book,
      chapter: note.chapter,
      verse: note.verse,
    });
  };

  const navigateToVerse = (note) => {
    const path = buildVersePath(note);
    if (!path) return;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeNote = async (note) => {
    await notesStore.remove(note.book, note.chapter, note.verse);
  };

  // Formato de fecha
  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  // Texto del versículo
  const getVerseText = (note) => {
    if (!bible || !bible[note.book] || !bible[note.book][note.chapter - 1]) return null;
    return bible[note.book][note.chapter - 1][note.verse - 1] || null;
  };

  // Agrupar por libro
  $: grouped = (() => {
    const groups = new Map();
    for (const note of notes) {
      const bookName = map[note.book] || `Book ${note.book + 1}`;
      if (!groups.has(bookName)) groups.set(bookName, []);
      groups.get(bookName).push(note);
    }
    return Array.from(groups.entries()).map(([name, items]) => ({
      name,
      items: items.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse),
    }));
  })();
</script>

<header class="notes-header">
  <p class="notes-header__eyebrow">{$_('app.notes.eyebrow')}</p>
  <h1 class="notes-header__title">{$_('app.notes.title')}</h1>
  <p class="notes-header__lead">{$_('app.notes.lead', { count: notesCount })}</p>
</header>

{#if !$isAuthenticated}
  <div class="auth-prompt">
    <p class="auth-prompt__icon" aria-hidden="true">📝</p>
    <p class="auth-prompt__text">{$_('app.notes.login_required')}</p>
    <p class="auth-prompt__hint">{$_('app.notes.login_required_hint')}</p>
    <button type="button" class="auth-prompt__btn" on:click={openAuthMenu}>
      {$_('app.notes.login_prompt_action')}
    </button>
  </div>
{:else if notesCount === 0}
  <div class="notes-empty">
    <p class="notes-empty__icon" aria-hidden="true">📝</p>
    <p class="notes-empty__text">{$_('app.notes.empty')}</p>
    <p class="notes-empty__hint">{$_('app.notes.empty_hint')}</p>
  </div>
{:else}
  <div class="notes-list">
    {#each grouped as group (group.name)}
      <section class="notes-group">
        <h2 class="notes-group__title">{group.name}</h2>
        <ul class="notes-group__items">
          {#each group.items as note (`${note.book}-${note.chapter}-${note.verse}`)}
            {@const verseText = getVerseText(note)}
            <li class="note-item" style={note.color ? `--note-color: ${note.color}` : ''}>
              <div class="note-item__head">
                <button
                  class="note-item__ref"
                  type="button"
                  on:click={() => navigateToVerse(note)}
                  title={$_('app.notes.open_verse')}
                >
                  {group.name} {note.chapter}:{note.verse}
                </button>
                <span class="note-item__date">{formatDate(note.createdAt)}</span>
                <button
                  class="icon-btn note-item__remove"
                  type="button"
                  title={$_('app.notes.remove')}
                  aria-label={$_('app.notes.remove_reference', { reference: `${group.name} ${note.chapter}:${note.verse}` })}
                  on:click={() => removeNote(note)}
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
                <p class="note-item__verse">{verseText}</p>
              {:else}
                <p class="note-item__verse note-item__verse--missing">[…]</p>
              {/if}
              {#if note.text}
                <p class="note-item__note">{note.text}</p>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}

<style lang="scss">
  .notes-header {
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

  .notes-empty {
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

  .notes-list {
    display: grid;
    gap: 1.25rem;
  }

  .notes-group {
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

  .note-item {
    --note-color: var(--color-blue);
    display: grid;
    gap: 0.4rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid color-mix(in srgb, var(--color-bg-dark) 12%, transparent);
    border-left: 3px solid var(--note-color);
    border-radius: 0.45rem;
    background: var(--color-white);
    transition: border-color 0.15s ease, background 0.15s ease;

    &:hover {
      border-color: color-mix(in srgb, var(--note-color) 35%, transparent);
      border-left-color: var(--note-color);
      background: color-mix(in srgb, var(--note-color) 4%, var(--color-white));
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

    &__verse {
      margin: 0;
      font-size: 0.88rem;
      line-height: 1.5;
      color: color-mix(in srgb, var(--color-bg-dark) 65%, transparent);
      font-style: italic;

      &--missing {
        opacity: 0.4;
        font-style: italic;
      }
    }

    &__note {
      margin: 0.25rem 0 0;
      font-size: 0.92rem;
      line-height: 1.6;
      color: var(--color-bg-dark);
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: 1.65rem;
    height: 1.65rem;
    border: 1px solid rgb(45 150 205 / 24%);
    border-radius: 0.28rem;
    background: rgb(45 150 205 / 7%);
    color: var(--color-link);
    cursor: pointer;
    transition: var(--transition);

    svg { width: 0.85rem; height: 0.85rem; }

    &:hover, &:focus-visible {
      border-color: var(--color-blue);
      background: rgb(45 150 205 / 18%);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 14%);
    }
  }

  :global(html[data-theme='dark']) .notes-header__title { color: #ffffff; }
  :global(html[data-theme='dark']) .note-item {
    background: #1a2733;
    border-color: rgb(255 255 255 / 8%);
    color: #e5edf3;
    &:hover { background: rgb(45 150 205 / 14%); border-color: #7ec8e3; border-left-color: var(--note-color, #7ec8e3); }
  }
  :global(html[data-theme='dark']) .notes-group__title { color: #7ec8e3; border-bottom-color: rgb(126 200 227 / 22%); }
  :global(html[data-theme='dark']) .notes-empty {
    background: rgb(255 255 255 / 3%);
    border-color: rgb(255 255 255 / 14%);
  }
  :global(html[data-theme='dark']) .note-item__ref { color: #7ec8e3; }
  :global(html[data-theme='dark']) .note-item__verse { color: rgb(255 255 255 / 55%); }
  :global(html[data-theme='dark']) .note-item__note { color: #e5edf3; }
  :global(html[data-theme='dark']) .note-item__date { color: rgb(255 255 255 / 50%); }

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
