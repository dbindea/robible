<script>
  import { onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { topicsStore } from '../../store/topicsStore';
  import {
    selectedBibleVersion,
    getBibleVersionConfigOrDefault,
  } from '../../store/stores';
  import { getBookSlug } from '../../services/bible-route.service';
  import { isAuthenticated } from '../../store/authStore';
  import { openAuthMenu } from '../../store/authMenuStore';
  import IconPicker from '../../components/IconPicker.svelte';

  export let bible = [];
  export let map = {};

  // Helper para renderizar icono SVG de topic
  const TOPIC_ICONS = {
    cross: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
    star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>`,
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    crown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><line x1="5" y1="20" x2="19" y2="20"/></svg>`,
    dove: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20c-4-4-8-6-8-10a4 4 0 018 0 4 4 0 018 0c0 4-4 6-8 10z"/><path d="M12 10c-2 0-4-1-4-3"/><line x1="12" y1="7" x2="12" y2="10"/></svg>`,
    hands: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V6a2 2 0 00-2-2H4a2 2 0 00-2 2v7a2 2 0 002 2h8"/><path d="M14 4v8a6 6 0 0012 0V6"/></svg>`,
    flame: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>`,
    water: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>`,
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    light: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    peace: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20"/><path d="M2 12h20"/></svg>`,
  };
  const getTopicIconSvg = (iconKey) => TOPIC_ICONS[iconKey] || TOPIC_ICONS.bookmark;

  let view = 'list'; // 'list' | 'detail'
  let selectedTopicId = null;
  let isCreateOpen = false;
  let editForm = { name: '', icon: 'bookmark', color: '#2E7D9B' };
  let isSubmitting = false;

  $: topics = $topicsStore.topics;
  $: verseRefs = $topicsStore.verseRefs;
  $: primaryConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
  $: indexPath = primaryConfig?.indexPath || 'indice';

  $: selectedTopic = selectedTopicId ? topics.find((t) => t.id === selectedTopicId) : null;
  $: selectedVerses = selectedTopic
    ? (verseRefs[selectedTopic.id] || []).map((ref) => ({
        ...ref,
        text: bible[ref.book]?.[ref.chapter - 1]?.[ref.verse - 1] || '',
        bookName: map[ref.book] || `Book ${ref.book}`,
        reference: `${map[ref.book] || ''} ${ref.chapter}:${ref.verse}`,
      }))
    : [];

  $: copyVerseLabel = $_('app.topics.delete_verse');
  $: createTopicLabel = $_('app.topics.create_topic');

  const openTopic = (id) => {
    selectedTopicId = id;
    view = 'detail';
    updateUrl();
  };

  const backToList = () => {
    view = 'list';
    selectedTopicId = null;
    updateUrl();
  };

  const updateUrl = () => {
    if (typeof window === 'undefined') return;
    let path = `/${indexPath}`;
    if (view === 'detail' && selectedTopicId) {
      path = `/${indexPath}/${selectedTopicId}`;
    }
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new CustomEvent('robibile:navigate'));
    }
  };

  const parseUrl = () => {
    if (typeof window === 'undefined') return;
    const match = window.location.pathname.match(
      new RegExp(`^/${indexPath}(?:/([a-z0-9-]+))?/?$`, 'i'),
    );
    if (!match) {
      view = 'list';
      selectedTopicId = null;
      return;
    }
    const topicId = match[1];
    if (topicId && topics.some((t) => t.id === topicId)) {
      selectedTopicId = topicId;
      view = 'detail';
    } else {
      view = 'list';
      selectedTopicId = null;
    }
  };

  const openCreate = () => {
    if (!$isAuthenticated) {
      openAuthMenu();
      return;
    }
    editForm = { name: '', icon: 'bookmark', color: '#2E7D9B' };
    isCreateOpen = true;
  };

  const closeCreate = () => {
    isCreateOpen = false;
  };

  const submitCreate = () => {
    if (!editForm.name.trim()) return;
    isSubmitting = true;
    try {
      topicsStore.create(editForm);
      isCreateOpen = false;
    } finally {
      isSubmitting = false;
    }
  };

  const handleDeleteTopic = (topic) => {
    if (!confirm($_('app.topics.delete_confirm'))) return;
    topicsStore.remove(topic.id);
    if (selectedTopicId === topic.id) {
      backToList();
    }
  };

  const removeVerse = (ref) => {
    if (!selectedTopic) return;
    topicsStore.removeVerse(selectedTopic.id, {
      book: ref.book,
      chapter: ref.chapter,
      verse: ref.verse,
    });
  };

  const goToVerse = (ref) => {
    if (!ref || ref.book === null || ref.book === undefined) return;
    const bookSlug = getBookSlug(map, ref.book);
    const path = `/biblia/${$selectedBibleVersion}/${bookSlug}/${ref.chapter}`;
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new CustomEvent('robibile:navigate'));
    }
  };

  onMount(() => {
    parseUrl();
  });
</script>

<div class="index-page">
  <!-- Sticky header -->
  <div class="index-header">
    <div class="index-header__inner">
      {#if view === 'detail'}
        <button
          type="button"
          class="index-back-btn"
          on:click={backToList}
          title={$_('app.topics.back_to_topics')}
          aria-label={$_('app.topics.back_to_topics')}
        >
          <span aria-hidden="true">&#8592;</span>
          <span>{$_('app.topics.back_to_topics')}</span>
        </button>
      {:else}
        <div class="index-header__title">
          <h1>{$_('app.topics.title')}</h1>
          <p>{$_('app.topics.subtitle')}</p>
        </div>
        <button
          type="button"
          class="index-create-btn"
          on:click={openCreate}
          title={createTopicLabel}
          aria-label={createTopicLabel}
        >
          <span aria-hidden="true">+</span>
          <span>{createTopicLabel}</span>
        </button>
      {/if}
    </div>
  </div>

  <div class="index-content">
    {#if !$isAuthenticated}
      <div class="auth-prompt">
        <p class="auth-prompt__icon" aria-hidden="true">📋</p>
        <p class="auth-prompt__text">{$_('app.topics.login_required')}</p>
        <p class="auth-prompt__hint">{$_('app.topics.login_required_hint')}</p>
        <button type="button" class="auth-prompt__btn" on:click={openAuthMenu}>
          {$_('app.topics.login_prompt_action')}
        </button>
      </div>
    {:else if view === 'list'}
      {#if topics.length === 0}
        <div class="index-empty">
          <p>{$_('app.topics.empty_topics')}</p>
          <button type="button" class="index-create-btn" on:click={openCreate}>
            <span aria-hidden="true">+</span>
            <span>{$_('app.topics.create_first_topic')}</span>
          </button>
        </div>
      {:else}
        <div class="topics-grid">
          {#each topics as topic (topic.id)}
            {@const count = (verseRefs[topic.id] || []).length}
            <button
              type="button"
              class="topic-card"
              style:--topic-color={topic.color}
              on:click={() => openTopic(topic.id)}
            >
              <span class="topic-card__icon" aria-hidden="true">{@html getTopicIconSvg(topic.icon)}</span>
              <span class="topic-card__name">{topic.name}</span>
              <span class="topic-card__count">
                {count === 1
                  ? $_('app.topics.verse_count', { count })
                  : $_('app.topics.verses_count_plural', { count })}
              </span>
              {#if !topic.isDefault}
                <span
                  class="topic-card__delete"
                  role="button"
                  tabindex="0"
                  title={$_('app.topics.delete_topic')}
                  aria-label={$_('app.topics.delete_topic')}
                  on:click|stopPropagation={() => handleDeleteTopic(topic)}
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleDeleteTopic(topic);
                    }
                  }}
                >
                  <span aria-hidden="true">&#10005;</span>
                </span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    {:else if view === 'detail' && selectedTopic}
      <div class="topic-detail">
        <header class="topic-detail__header" style:--topic-color={selectedTopic.color}>
          <span class="topic-detail__icon" aria-hidden="true">{@html getTopicIconSvg(selectedTopic.icon)}</span>
          <div class="topic-detail__meta">
            <h2>{selectedTopic.name}</h2>
            <p>
              {selectedVerses.length === 1
                ? $_('app.topics.verse_count', { count: selectedVerses.length })
                : $_('app.topics.verses_count_plural', { count: selectedVerses.length })}
            </p>
          </div>
        </header>

        {#if selectedVerses.length === 0}
          <div class="index-empty">
            <p>{$_('app.topics.empty_verses')}</p>
          </div>
        {:else}
          <ul class="verse-list">
            {#each selectedVerses as ref (ref.addedAt)}
              <li class="verse-item">
                <button
                  type="button"
                  class="verse-item__ref"
                  on:click={() => goToVerse(ref)}
                  title={ref.reference}
                >
                  {ref.reference}
                </button>
                <p class="verse-item__text">{ref.text || '...'}</p>
                <button
                  type="button"
                  class="verse-item__remove"
                  on:click={() => removeVerse(ref)}
                  title={copyVerseLabel}
                  aria-label={copyVerseLabel}
                >
                  <span aria-hidden="true">&#10005;</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Create topic modal -->
  {#if isCreateOpen}
    <div class="modal-backdrop" on:click={closeCreate} role="presentation">
      <div class="modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeCreate()} role="dialog" tabindex="-1" aria-modal="true" aria-label={createTopicLabel}>
        <h3 class="modal__title">{createTopicLabel}</h3>
        <form class="modal__form" on:submit|preventDefault={submitCreate}>
          <label class="modal__field">
            <span class="modal__label">{$_('app.topics.topic_name')}</span>
            <input
              type="text"
              bind:value={editForm.name}
              placeholder={$_('app.topics.new_topic_placeholder')}
              required
              maxlength="40"
              autofocus
            />
          </label>
          <label class="modal__field modal__field--row">
            <div class="modal__field-col">
              <span class="modal__label">{$_('app.topics.topic_icon')}</span>
              <IconPicker
                value={editForm.icon}
                onChange={(icon) => { editForm = { ...editForm, icon }; }}
              />
            </div>
            <div class="modal__field-col">
              <span class="modal__label">{$_('app.topics.topic_color')}</span>
              <div role="presentation" on:click|stopPropagation on:mousedown|stopPropagation>
                <input type="color" bind:value={editForm.color} />
              </div>
            </div>
          </label>
          <div class="modal__actions">
            <button type="button" class="modal__btn modal__btn--ghost" on:click={closeCreate}>
              {$_('app.topics.cancel')}
            </button>
            <button type="submit" class="modal__btn modal__btn--primary" disabled={isSubmitting || !editForm.name.trim()}>
              {$_('app.topics.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .index-page {
    width: 100%;
    max-width: 96rem;
    margin-inline: auto;
    padding: 0 clamp(1rem, 5vw, 5rem) 3rem;
  }

  .index-header {
    background: var(--color-bg-light);
    border-bottom: 2px solid var(--color-blue);
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 2px 12px rgb(0 0 0 / 10%);
    margin: 0 calc(-1 * clamp(1rem, 5vw, 5rem)) 1.5rem;

    &__inner {
      max-width: 96rem;
      margin-inline: auto;
      padding: 0.75rem clamp(1rem, 5vw, 5rem);
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    &__title {
      flex: 1 1 auto;
      min-width: 0;

      h1 {
        margin: 0;
        font-size: clamp(1.4rem, 3vw, 1.9rem);
        line-height: 1.15;
        color: var(--color-bg-dark);
      }

      p {
        margin: 0.2rem 0 0;
        font-size: 0.85rem;
        color: color-mix(in srgb, var(--color-bg-dark) 65%, transparent);
      }
    }
  }

  .index-back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    border: 1px solid rgb(45 150 205 / 42%);
    border-radius: 999px;
    background: var(--color-white);
    color: var(--color-bg-dark);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
      box-shadow: 0 0 0 3px rgb(45 150 205 / 14%);
    }
  }

  .index-create-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.95rem;
    border: 1px solid var(--color-blue);
    border-radius: 999px;
    background: var(--color-blue);
    color: var(--color-white);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--box-shadow-down);
    white-space: nowrap;

    span[aria-hidden] {
      font-size: 1.1rem;
      line-height: 1;
    }

    &:hover,
    &:focus-visible {
      background: var(--color-blue-hover);
      border-color: var(--color-blue-hover);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 35%), var(--box-shadow-down);
    }

    &:focus-visible {
      outline: 2px solid var(--color-white);
      outline-offset: 2px;
    }
  }

  .index-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 40vh;
    text-align: center;
    padding: 2rem;
    color: var(--color-bg-dark);

    p {
      margin: 0;
      font-size: 1rem;
      max-width: 28rem;
      color: color-mix(in srgb, var(--color-bg-dark) 65%, transparent);
    }
  }

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

      &:hover,
      &:focus-visible {
        background: var(--color-blue-hover);
        border-color: var(--color-blue-hover);
      }
    }
  }

  // === TOPICS GRID ===
  .topics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
    gap: 1rem;
  }

  .topic-card {
    --topic-color: #2E7D9B;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 1.1rem 1rem 1rem;
    border: 1px solid color-mix(in srgb, var(--topic-color) 28%, transparent);
    border-radius: 0.6rem;
    background: var(--color-white);
    color: var(--color-bg-dark);
    text-align: left;
    cursor: pointer;
    transition: var(--transition);
    overflow: hidden;
    min-height: 8.5rem;
    box-shadow: var(--box-shadow-up);

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--topic-color);
    }

    &__icon {
      display: grid;
      place-items: center;
      width: 2.2rem;
      height: 2.2rem;

      :global(svg) {
        width: 1.6rem;
        height: 1.6rem;
        color: var(--topic-color);
      }
    }

    &__name {
      font-size: 1.05rem;
      font-weight: 700;
      line-height: 1.2;
      word-break: break-word;
    }

    &__count {
      font-size: 0.78rem;
      color: color-mix(in srgb, var(--topic-color) 85%, var(--color-bg-dark));
      font-weight: 600;
    }

    &__delete {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      display: grid;
      place-items: center;
      width: 1.6rem;
      height: 1.6rem;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: color-mix(in srgb, var(--color-bg-dark) 50%, transparent);
      cursor: pointer;
      transition: var(--transition);
      opacity: 0;
      font-size: 0.85rem;

      &:hover,
      &:focus-visible {
        background: rgb(220 50 50 / 12%);
        color: #c0392b;
        opacity: 1;
      }

      &:focus-visible {
        outline: 2px solid var(--color-blue);
        outline-offset: 2px;
      }
    }

    &:hover,
    &:focus-visible {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px color-mix(in srgb, var(--topic-color) 18%, transparent);
      border-color: color-mix(in srgb, var(--topic-color) 50%, transparent);
    }

    &:hover &__delete,
    &:focus-within &__delete {
      opacity: 1;
    }
  }

  // === TOPIC DETAIL ===
  .topic-detail {
    &__header {
      --topic-color: #2E7D9B;
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-radius: 0.6rem;
      background: color-mix(in srgb, var(--topic-color) 8%, var(--color-white));
      border-left: 4px solid var(--topic-color);
      margin-bottom: 1.5rem;
    }

    &__icon {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;

      :global(svg) {
        width: 2rem;
        height: 2rem;
        color: var(--topic-color);
      }
    }

    &__meta {
      flex: 1 1 auto;
      min-width: 0;

      h2 {
        margin: 0;
        font-size: clamp(1.3rem, 3vw, 1.7rem);
        line-height: 1.2;
        color: var(--color-bg-dark);
      }

      p {
        margin: 0.2rem 0 0;
        font-size: 0.85rem;
        color: color-mix(in srgb, var(--topic-color) 80%, var(--color-bg-dark));
        font-weight: 600;
      }
    }
  }

  .verse-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .verse-item {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.5rem 1rem;
    align-items: start;
    padding: 0.85rem 1rem;
    border: 1px solid rgb(45 150 205 / 14%);
    border-radius: 0.45rem;
    background: var(--color-white);
    transition: var(--transition);

    &:hover {
      border-color: rgb(45 150 205 / 38%);
      background: color-mix(in srgb, var(--color-blue) 4%, var(--color-white));

      .verse-item__remove {
        opacity: 1;
      }
    }

    &__ref {
      flex: 0 0 auto;
      align-self: start;
      padding: 0.2rem 0.5rem;
      border: 1px solid rgb(45 150 205 / 28%);
      border-radius: 0.25rem;
      background: rgb(45 150 205 / 8%);
      color: var(--color-link);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition);
      line-height: 1.4;

      &:hover,
      &:focus-visible {
        background: var(--color-blue);
        color: var(--color-on-primary);
        border-color: var(--color-blue);
      }
    }

    &__text {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.55;
      color: var(--color-bg-dark);
    }

    &__remove {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: 1.6rem;
      height: 1.6rem;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: color-mix(in srgb, var(--color-bg-dark) 50%, transparent);
      cursor: pointer;
      transition: var(--transition);
      opacity: 0;
      align-self: start;
      font-size: 0.9rem;

      &:hover,
      &:focus-visible {
        background: rgb(220 50 50 / 12%);
        color: #c0392b;
        opacity: 1;
      }

      &:focus-visible {
        outline: 2px solid var(--color-blue);
        outline-offset: 2px;
      }
    }
  }

  // === MODAL ===
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 100dvh;
    background: rgb(0 0 0 / 45%);
    backdrop-filter: blur(2px);
    animation: fadeIn 0.15s ease;
    overflow-y: auto;
  }

  .modal {
    width: 100%;
    max-width: 24rem;
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    background: var(--color-white);
    border-radius: 0.6rem;
    box-shadow: var(--box-shadow-down);
    padding: 1.25rem;
    color: var(--color-bg-dark);
    animation: scaleIn 0.15s ease;
    margin: auto;

    &__title {
      margin: 0 0 1rem;
      font-size: 1.15rem;
      font-weight: 700;
    }

    &__form {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    &__field {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;

      &--row {
        flex-direction: row;
        gap: 0.85rem;
      }

      &-col {
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
    }

    &__label {
      font-size: 0.78rem;
      font-weight: 700;
      color: color-mix(in srgb, var(--color-bg-dark) 70%, transparent);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    input[type='text'] {
      width: 100%;
      padding: 0.55rem 0.75rem;
      border: 1px solid rgb(45 150 205 / 32%);
      border-radius: 0.3rem;
      background: var(--color-white);
      color: var(--color-bg-dark);
      font-size: 0.95rem;
      transition: var(--transition);

      &:focus {
        outline: none;
        border-color: var(--color-blue);
        box-shadow: 0 0 0 3px rgb(45 150 205 / 16%);
      }
    }

    input[type='color'] {
      width: 100%;
      height: 2.4rem;
      padding: 0.15rem;
      border: 1px solid rgb(45 150 205 / 32%);
      border-radius: 0.3rem;
      background: var(--color-white);
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: var(--color-blue);
        box-shadow: 0 0 0 3px rgb(45 150 205 / 16%);
      }
    }

    &__actions {
      display: flex;
      gap: 0.6rem;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }

    &__btn {
      padding: 0.5rem 1rem;
      border-radius: 999px;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition);

      &--ghost {
        background: transparent;
        border: 1px solid rgb(45 150 205 / 30%);
        color: var(--color-bg-dark);

        &:hover {
          background: rgb(45 150 205 / 8%);
        }
      }

      &--primary {
        background: var(--color-blue);
        border: 1px solid var(--color-blue);
        color: var(--color-white);

        &:hover:not(:disabled) {
          background: var(--color-blue-hover);
          border-color: var(--color-blue-hover);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }

  // === DARK MODE ===
  :global(html[data-theme='dark']) {
    .index-header {
      background: #0f1720;
      border-bottom-color: var(--color-blue);
    }

    .index-empty p {
      color: rgb(255 255 255 / 60%);
    }

    .auth-prompt {
      background: rgb(255 255 255 / 3%);
      border-color: rgb(255 255 255 / 14%);

      &__text { color: #ffffff; }
      &__hint { color: rgb(255 255 255 / 55%); }
    }

    .topic-card {
      background: #1e2d3d;
      border-color: rgb(255 255 255 / 12%);

      &__count {
        color: rgb(255 255 255 / 65%);
      }

      &:hover,
      &:focus-visible {
        background: #243549;
      }
    }

    .topic-detail {
      &__header {
        background: rgb(255 255 255 / 5%);
      }

      &__meta {
        h2 { color: #ffffff; }
        p { color: rgb(255 255 255 / 60%); }
      }
    }

    .verse-item {
      background: #1e2d3d;
      border-color: rgb(255 255 255 / 12%);

      &:hover {
        background: #243549;
        border-color: var(--color-blue);
      }

      &__ref {
        background: rgb(45 150 205 / 18%);
        color: #7ec8e3;
        border-color: rgb(45 150 205 / 35%);
      }

      &__text {
        color: #ffffff;
      }

      &__remove {
        color: rgb(255 255 255 / 50%);
      }
    }

    .modal {
      background: #1e2d3d;
      color: #ffffff;
    }

    .modal__label {
      color: rgb(255 255 255 / 65%);
    }

    .modal input[type='text'],
    .modal input[type='color'] {
      background: rgb(255 255 255 / 8%);
      border-color: rgb(255 255 255 / 25%);
      color: #ffffff;
    }

    .modal__btn--ghost {
      color: #ffffff;
      border-color: rgb(255 255 255 / 25%);

      &:hover {
        background: rgb(255 255 255 / 8%);
      }
    }
  }

  // === MOBILE ===
  @media (max-width: 38rem) {
    .index-page {
      padding: 0 0.5rem 3rem;
    }

    .index-header {
      margin: 0 -0.5rem 1rem;

      &__inner {
        padding: 0.6rem 0.75rem;
        flex-wrap: wrap;
      }

      &__title h1 {
        font-size: 1.2rem;
      }
    }

    .index-create-btn span:not([aria-hidden]) {
      display: none;
    }

    .topics-grid {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
      gap: 0.75rem;
    }

    .topic-card {
      min-height: 7rem;
      padding: 0.85rem 0.75rem 0.75rem;

      &__icon { font-size: 1.5rem; }
      &__name { font-size: 0.95rem; }
    }

    .verse-item {
      grid-template-columns: 1fr auto;
      gap: 0.5rem;

      &__ref {
        grid-column: 1 / -1;
      }

      &__text {
        grid-column: 1;
      }

      &__remove {
        grid-column: 2;
        grid-row: 2;
        opacity: 1;
      }
    }
  }
</style>
