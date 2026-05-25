<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { replaceDiacritics } from '../../services/filter.service';
  import { applySeoMetadata, buildCurrentBibleSeo, buildVerseSeo } from '../../services/seo.service';
  import { filter, getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';

  export let bible;
  export let map;
  export let result = [];
  export let count = 0;

  let chapterForm = {
    chapter: [],
  };

  let toastMessage = '';
  let toastTimer;
  let highlightTimer;
  let highlightedVerseId = '';
  let currentVerseSeoItem = null;

  $: searchForm = $filter;
  $: keywords = searchForm.searchText || '';
  $: selectedBook = Array.isArray(searchForm.book) ? searchForm.book[0] : null;
  $: selectedBookName = selectedBook !== null && selectedBook !== undefined ? map[selectedBook] : null;
  $: selectedChapter = Array.isArray(searchForm.chapter) ? searchForm.chapter[0] : null;
  $: if (
    currentVerseSeoItem &&
    (searchForm.searchText ||
      selectedBook !== currentVerseSeoItem.book ||
      selectedChapter === null ||
      selectedChapter === undefined ||
      Number(selectedChapter) !== currentVerseSeoItem.chapter - 1)
  ) {
    currentVerseSeoItem = null;
  }
  $: selectedChapterLabel =
    selectedChapter !== null && selectedChapter !== undefined ? Number(selectedChapter) + 1 : null;
  $: chapterForm.chapter = selectedChapter ?? 0;
  $: bibleVersionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
  $: bibleLabel = bibleVersionConfig.bibleName || $_('app.bible.name');
  $: pageTitle = getPageTitle(searchForm.searchText, selectedBookName, selectedChapterLabel, bibleLabel, $_);
  $: pageLead = getPageLead(searchForm.searchText, selectedBookName, selectedChapterLabel, $_);
  $: if (Object.keys(searchForm).length && Object.keys(map).length) {
    applySeoMetadata(
      currentVerseSeoItem && !searchForm.searchText
        ? buildVerseSeo({ item: currentVerseSeoItem, map, versionConfig: bibleVersionConfig })
        : buildCurrentBibleSeo({ searchForm, map, versionConfig: bibleVersionConfig }),
    );
  }

  $: chapterArray =
    Array.isArray(searchForm.book) && searchForm.book.length
      ? Array.from(Array(bible[searchForm.book[0]]?.length || 0).keys())
      : [];

  const updateChapterForm = () => {
    filter.set({ ...searchForm, chapter: [chapterForm.chapter] });
  };

  const getPageTitle = (searchText, bookName, chapterLabel, bibleName, translate) => {
    if (searchText) {
      return translate('app.result.page_title.search', { bible: bibleName });
    }

    if (bookName && chapterLabel) {
      return translate('app.result.page_title.chapter', { book: bookName, chapter: chapterLabel });
    }

    if (bookName) {
      return bookName;
    }

    return bibleName;
  };

  const getPageLead = (searchText, bookName, chapterLabel, translate) => {
    if (searchText) {
      return translate('app.result.page_lead.search');
    }

    if (bookName && chapterLabel) {
      return translate('app.result.page_lead.chapter');
    }

    return translate('app.result.page_lead.default');
  };

  const showToast = (message) => {
    toastMessage = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastMessage = '';
    }, 2200);
  };

  const copyToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
  };

  const copyVerse = async (item) => {
    try {
      await copyToClipboard(
        `[${map[item.book]} ${item.chapter}:${item.index}] ${item.text}\n${getVerseShareUrl(item)}`,
      );
      showToast($_('app.result.toast.copied'));
    } catch {
      showToast($_('app.result.toast.copy_failed'));
    }
  };

  const getVerseId = (item) => `verse-${item.book}-${item.chapter}-${item.index}`;
  const getVerseSharePath = (item) => `/verse/${$selectedBibleVersion}/${item.book}/${item.chapter}/${item.index}`;
  const getVerseShareUrl = (item) => `${window.location.origin}${getVerseSharePath(item)}`;

  const getVerseFromLocation = () => {
    const [, hashBook, hashChapter, hashIndex] = window.location.hash.match(/^#verse-(\d+)-(\d+)-(\d+)$/) || [];

    if (hashBook && hashChapter && hashIndex) {
      return {
        book: Number(hashBook),
        chapter: Number(hashChapter),
        index: Number(hashIndex),
      };
    }

    const [, pathBook, pathChapter, pathIndex] =
      window.location.pathname.match(/^\/verse\/[^/]+\/(\d+)\/(\d+)\/(\d+)\/?$/) || [];

    if (pathBook && pathChapter && pathIndex) {
      return {
        book: Number(pathBook),
        chapter: Number(pathChapter),
        index: Number(pathIndex),
      };
    }

    return null;
  };

  const applyVerseMetadata = (item) => {
    currentVerseSeoItem = item;
  };

  const scrollToVerse = async (verseId) => {
    await tick();
    const verseElement = document.getElementById(verseId);

    if (!verseElement) {
      return;
    }

    verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    verseElement.focus({ preventScroll: true });
    highlightedVerseId = verseId;
    window.clearTimeout(highlightTimer);
    highlightTimer = window.setTimeout(() => {
      highlightedVerseId = '';
    }, 2400);
  };

  const navigateToVerse = async (item) => {
    const verseId = getVerseId(item);
    applyVerseMetadata(item);
    filter.set({
      ...searchForm,
      searchText: null,
      testament: Number(item.book) < 39 ? 'ot' : 'nt',
      book: [item.book],
      chapter: [item.chapter - 1],
    });
    window.history.replaceState(null, '', getVerseSharePath(item));
    await scrollToVerse(verseId);
  };

  onMount(() => {
    const verse = getVerseFromLocation();

    if (verse) {
      const item = {
        ...verse,
        text: bible[verse.book]?.[verse.chapter - 1]?.[verse.index - 1] || '',
      };
      filter.set({
        ...searchForm,
        searchText: null,
        testament: Number(verse.book) < 39 ? 'ot' : 'nt',
        book: [verse.book],
        chapter: [verse.chapter - 1],
      });
      applyVerseMetadata(item);
      window.history.replaceState(null, '', getVerseSharePath(item));
      scrollToVerse(getVerseId(verse));
    }
  });

  onDestroy(() => {
    window.clearTimeout(toastTimer);
    window.clearTimeout(highlightTimer);
  });

  function getMarkedParts(text, keywords) {
    if (!keywords || keywords.length <= 2) {
      return [{ text, marked: false }];
    }

    const ranges = [];
    const pushRange = (word) => {
      const index = replaceDiacritics(text).toLowerCase().indexOf(replaceDiacritics(word).toLowerCase());

      if (index >= 0) {
        ranges.push([index, index + word.length]);
      }
    };

    switch (searchForm.searchType) {
      case 'match':
        pushRange(keywords);
        break;

      case 'every':
      case 'some':
        keywords
          .split(/[ ,.-]+/)
          .filter(Boolean)
          .forEach(pushRange);
        break;
    }

    if (!ranges.length) {
      return [{ text, marked: false }];
    }

    const normalizedRanges = ranges
      .sort(([startA], [startB]) => startA - startB)
      .reduce((items, range) => {
        const previous = items[items.length - 1];
        if (!previous || range[0] >= previous[1]) {
          items.push(range);
        }
        return items;
      }, []);

    const parts = [];
    let cursor = 0;
    normalizedRanges.forEach(([start, end]) => {
      if (cursor < start) {
        parts.push({ text: text.slice(cursor, start), marked: false });
      }
      parts.push({ text: text.slice(start, end), marked: true });
      cursor = end;
    });
    if (cursor < text.length) {
      parts.push({ text: text.slice(cursor), marked: false });
    }

    return parts;
  }
</script>

{#if !searchForm.searchText && chapterArray.length}
  <div class="radio-toolbar sticky" aria-label={$_('app.result.chapters_label')}>
    <form
      class="radio-toolbar__form"
      aria-label={$_('app.result.chapter_form_label')}
      on:change|preventDefault={updateChapterForm}
    >
      {#each chapterArray as item (item)}
        <input type="radio" id={`chapter-${item}`} value={item} bind:group={chapterForm.chapter} />
        <label for={`chapter-${item}`}>{Number(item + 1)}</label>
      {/each}
    </form>
  </div>
{/if}

<div class="result">
  <nav class="breadcrumbs" aria-label={$_('app.result.breadcrumb_label')}>
    <a href="/">RoBible</a>
    <span aria-hidden="true">/</span>
    <span>{bibleLabel}</span>
    {#if selectedBookName}
      <span aria-hidden="true">/</span>
      <span>{selectedBookName}</span>
    {/if}
    {#if selectedChapterLabel}
      <span aria-hidden="true">/</span>
      <span>{$_('app.result.chapter_breadcrumb', { chapter: selectedChapterLabel })}</span>
    {/if}
  </nav>

  <header class="result__header">
    <h1>{pageTitle}</h1>
    <p>{pageLead}</p>
  </header>

  {#if searchForm.searchText}
    <p>
      {$_('app.result.result_count_start')}
      <span class="count">{result.length}</span>
      {$_('app.result.result_count_end', { total: count })}
    </p>
  {/if}

  {#each result as item (item.key)}
    <div
      class:verse--highlighted={highlightedVerseId === getVerseId(item)}
      class="verse"
      id={getVerseId(item)}
      tabindex="-1"
    >
      <p>
        <span class="verse-index">{item.index}.</span>
        {#each getMarkedParts(item.text, keywords) as part, index (`${item.key}-${index}`)}
          {#if part.marked}
            <span class="marked-key">{part.text}</span>
          {:else}
            {part.text}
          {/if}
        {/each}
        <button
          type="button"
          title={$_('app.result.actions.open_chapter')}
          class="reference"
          on:click={() => navigateToVerse(item)}
        >
          ({map[item.book]}
          {item.chapter}:{item.index})
        </button>
        <button
          type="button"
          title={$_('app.result.actions.copy_verse')}
          aria-label={$_('app.result.actions.copy_verse_reference', {
            reference: `${map[item.book]} ${item.chapter}:${item.index}`,
          })}
          class="copy-link"
          on:click={() => copyVerse(item)}
        >
          <span aria-hidden="true"></span>
        </button>
      </p>
    </div>
    <div class="divider div-transparent div-dot"></div>
  {/each}
</div>

{#if toastMessage}
  <div class="toast" role="status" aria-live="polite">{toastMessage}</div>
{/if}

<style lang="scss">
  .result {
    width: 100%;
    max-width: 72rem;
    padding: clamp(1.25rem, 4vw, 2.5rem) clamp(1rem, 5vw, 5rem) clamp(2rem, 5vw, 4rem);
    background-color: var(--color-white);
    flex-direction: column;
    border-radius: 0.3rem;
    box-shadow: var(--box-shadow-up);
    border-top: 0.3rem var(--border-blue);
    border-bottom: 0.3rem var(--border-blue);
    margin: 0 auto;
  }

  .result__header {
    margin-bottom: 1.25rem;

    h1 {
      margin: 0;
      color: var(--color-bg-dark);
      font-size: clamp(1.65rem, 3vw, 2.35rem);
      line-height: 1.15;
    }

    p {
      max-width: 48rem;
      margin: 0.6rem 0 0;
      color: color-mix(in srgb, var(--color-bg-dark) 82%, white);
      font-size: 1rem;
    }
  }

  .breadcrumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.8rem;
    color: color-mix(in srgb, var(--color-bg-dark) 72%, white);
    font-size: 0.88rem;

    a {
      font-weight: 600;
    }
  }

  .divider {
    position: relative;
  }

  .div-transparent:before {
    content: '';
    position: absolute;
    top: 0;
    left: 5%;
    right: 5%;
    width: 90%;
    height: 1px;
    background-color: var(--color-bg-dark);
    box-shadow: var(--box-shadow-up);
  }

  .div-dot:after {
    content: '';
    position: absolute;
    top: -5px;
    left: calc(50% - 9px);
    width: 0.5rem;
    height: 0.5rem;
    background-color: var(--color-bg-dark);
    border: 1px solid var(--color-bg-dark);
    box-shadow:
      inset 0 0 0 2px white,
      0 0 0 4px white;
  }

  .verse {
    border-radius: 0.35rem;
    padding: 0.5rem clamp(0rem, 2vw, 2rem);
    line-height: 1.7;
    transition:
      background-color 0.25s ease,
      box-shadow 0.25s ease;

    &:focus {
      outline: none;
    }

    &--highlighted {
      background-color: rgb(45 150 205 / 11%);
      box-shadow: inset 0.25rem 0 0 var(--color-blue);
    }

    p {
      margin: 0.75rem 0;
    }

    &-index {
      font-size: 14px;
      font-weight: 600;
    }
  }

  .reference {
    display: inline;
    padding: 0;
    border: 0;
    background: transparent;
    font-weight: 600;
    font-size: 14px;
    font-style: italic;
    cursor: pointer;
    color: var(--color-link);

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      border-radius: 0.2rem;
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }
  }

  .copy-link {
    display: inline-grid;
    place-items: center;
    width: 1.65rem;
    height: 1.65rem;
    margin-left: 0.2rem;
    border: 1px solid rgb(45 150 205 / 24%);
    border-radius: 0.28rem;
    background: rgb(45 150 205 / 7%);
    color: var(--color-link);
    transition: var(--transition);

    span {
      position: relative;
      width: 0.8rem;
      height: 0.9rem;
      border: 1.7px solid currentcolor;
      border-radius: 0.12rem;

      &::before {
        content: '';
        position: absolute;
        inset: -0.28rem auto auto 0.22rem;
        width: 0.8rem;
        height: 0.9rem;
        border: 1.7px solid currentcolor;
        border-radius: 0.12rem;
        background: var(--color-white);
      }
    }

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: rgb(45 150 205 / 14%);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 12%);
    }
  }

  .count {
    font-weight: 700;
  }
  .radio-toolbar {
    padding: 1rem;
    background-color: var(--color-bg-light);
    margin: 0 0 1rem;
    z-index: 1;
    box-shadow: var(--box-shadow-up);
    border-radius: 0.25rem;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-color: rgb(45 150 205 / 45%) transparent;

    &__form {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      min-width: 0;
    }

    label {
      flex: 0 0 auto;
      background-color: var(--color-blue);
      min-width: 2rem;
      min-height: 2rem;
      padding: 0.25rem 0.45rem;
      font-size: 14px;
      border: 0.1rem var(--border-blue);
      border-radius: 0.25rem;
      color: #ffffff;
      cursor: pointer;
      line-height: 1.35;
      text-align: center;
      transition: var(--transition);
    }

    input[type='radio'] {
      opacity: 0;
      position: fixed;
      width: 0;
    }

    input[type='radio']:hover + label,
    input[type='radio']:focus-visible + label,
    input[type='radio']:checked + label {
      background: var(--color-blue-hover);
      border-color: var(--color-blue);
    }
  }

  .toast {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 10;
    max-width: min(24rem, calc(100vw - 2rem));
    padding: 0.85rem 1rem;
    border-left: 0.3rem solid var(--color-blue);
    border-radius: 0.3rem;
    background-color: var(--color-white);
    box-shadow: var(--box-shadow-down);
    color: var(--color-bg-dark);
    font-weight: 600;
  }

  @media (max-width: 38rem) {
    .result {
      border-radius: 0;
      border-left: 0;
      border-right: 0;
      box-shadow: none;
    }

    .radio-toolbar {
      margin-inline: -1rem;
      border-radius: 0;
      padding: 0.75rem 1rem;

      &__form {
        flex-wrap: nowrap;
        min-width: 100%;
        width: max-content;
      }

      label {
        min-width: 2.35rem;
      }
    }

    .verse {
      line-height: 1.65;
    }
  }
</style>
