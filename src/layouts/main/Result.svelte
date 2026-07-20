<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    buildBiblePath,
    getBookIdFromSlug,
    parseBiblePath,
    parseLegacyVersePath,
  } from '../../services/bible-route.service';
  import { replaceDiacritics } from '../../services/filter.service';
  import { _ } from '../../services/i18n.service';
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
  let activeVerseTarget = null;
  let resultElement;
  let isMounted = false;

  // Swipe gesture state
  let touchStartX = 0;
  let touchStartY = 0;
  let touchCurrentX = 0;
  let touchStartTime = 0;
  let isSwiping = false;
  let swipeDirection = ''; // 'left' | 'right'
  let canSwipeLeft = false;
  let canSwipeRight = false;

  $: canSwipeLeft = selectedChapter !== null && selectedChapter < (chapterArray.length - 1);
  $: canSwipeRight = selectedChapter !== null && selectedChapter > 0;

  $: searchForm = $filter;
  $: keywords = searchForm.searchText || '';
  $: selectedBook = Array.isArray(searchForm.book) ? searchForm.book[0] : null;
  $: selectedBookName = selectedBook !== null && selectedBook !== undefined ? map[selectedBook] : null;
  $: selectedChapter = Array.isArray(searchForm.chapter) ? searchForm.chapter[0] : null;
  $: if (
    activeVerseTarget &&
    (searchForm.searchText ||
      selectedBook !== activeVerseTarget.book ||
      selectedChapter === null ||
      selectedChapter === undefined ||
      Number(selectedChapter) !== activeVerseTarget.chapter - 1)
  ) {
    activeVerseTarget = null;
    currentVerseSeoItem = null;
  }
  $: if (activeVerseTarget) {
    const verseText = bible[activeVerseTarget.book]?.[activeVerseTarget.chapter - 1]?.[activeVerseTarget.index - 1];

    if (verseText) {
      currentVerseSeoItem = { ...activeVerseTarget, text: verseText };
    }
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
  $: if (
    isMounted &&
    Object.keys(map).length &&
    (searchForm.searchText || selectedBook !== undefined || selectedChapterLabel !== undefined || activeVerseTarget || $selectedBibleVersion)
  ) {
    syncCurrentBiblePath();
  }

  $: chapterArray =
    Array.isArray(searchForm.book) && searchForm.book.length
      ? Array.from(Array(bible[searchForm.book[0]]?.length || 0).keys())
      : [];

  const updateChapterForm = async () => {
    activeVerseTarget = null;
    currentVerseSeoItem = null;
    filter.set({ ...searchForm, chapter: [chapterForm.chapter] });
    await scrollToResultTop();
  };

  const goToNextChapter = async () => {
    if (!canSwipeLeft) return;
    chapterForm.chapter = (selectedChapter ?? 0) + 1;
    await updateChapterForm();
    showToast($_('app.result.swipe.next_chapter'));
  };

  const goToPrevChapter = async () => {
    if (!canSwipeRight) return;
    chapterForm.chapter = (selectedChapter ?? 0) - 1;
    await updateChapterForm();
    showToast($_('app.result.swipe.prev_chapter'));
  };

  const onTouchStart = (e) => {
    // Only enable swipe when reading a book chapter (not in search mode)
    if (searchForm.searchText || !chapterArray.length) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchCurrentX = touchStartX;
    touchStartTime = Date.now();
    isSwiping = false;
    swipeDirection = '';
  };

  const onTouchMove = (e) => {
    if (!touchStartTime) return;
    touchCurrentX = e.touches[0].clientX;
    const dx = touchCurrentX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    // Only track horizontal swipes, ignore vertical scrolling
    if (!isSwiping && Math.abs(dx) > 10) {
      // Small threshold to differentiate from scroll
      if (Math.abs(dx) > Math.abs(dy)) {
        isSwiping = true;
        e.preventDefault(); // Prevent horizontal scroll
      }
    }

    if (isSwiping) {
      e.preventDefault();
      swipeDirection = dx < 0 ? 'left' : 'right';
    }
  };

  const onTouchEnd = () => {
    if (!touchStartTime || !isSwiping) {
      resetSwipeState();
      return;
    }

    const dx = touchCurrentX - touchStartX;
    const dt = Date.now() - touchStartTime;
    const velocity = Math.abs(dx) / dt; // px/ms
    const distance = Math.abs(dx);

    // Valid swipe: distance > 50px OR velocity > 0.3 px/ms (fast flick)
    const isValidSwipe = distance > 50 || velocity > 0.3;

    if (isValidSwipe) {
      if (dx < 0 && canSwipeLeft) {
        goToNextChapter();
      } else if (dx > 0 && canSwipeRight) {
        goToPrevChapter();
      }
    }

    resetSwipeState();
  };

  const resetSwipeState = () => {
    touchStartX = 0;
    touchStartY = 0;
    touchCurrentX = 0;
    touchStartTime = 0;
    isSwiping = false;
    swipeDirection = '';
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
        `*${map[item.book]} ${item.chapter}:${item.index}* ${item.text}\n\n${getVerseShareUrl(item)}`,
      );
      showToast($_('app.result.toast.copied'));
    } catch {
      showToast($_('app.result.toast.copy_failed'));
    }
  };

  const getVerseId = (item) => `verse-${item.book}-${item.chapter}-${item.index}`;
  const getVerseSharePath = (item) =>
    buildBiblePath({
      version: $selectedBibleVersion,
      map,
      book: item.book,
      chapter: item.chapter,
      verse: item.index,
    });
  const getVerseShareUrl = (item) => `${window.location.origin}${getVerseSharePath(item)}`;

  const getRouteTargetFromLocation = () => {
    const [, hashBook, hashChapter, hashIndex] = window.location.hash.match(/^#verse-(\d+)-(\d+)-(\d+)$/) || [];

    if (hashBook && hashChapter && hashIndex) {
      return {
        book: Number(hashBook),
        chapter: Number(hashChapter),
        index: Number(hashIndex),
      };
    }

    const legacyVerse = parseLegacyVersePath(window.location.pathname);

    if (legacyVerse) {
      return {
        book: legacyVerse.book,
        chapter: legacyVerse.chapter,
        index: legacyVerse.verse,
      };
    }

    const bibleRoute = parseBiblePath(window.location.pathname);

    if (!bibleRoute) {
      return null;
    }

    const bookFromSlug = getBookIdFromSlug(map, bibleRoute.bookSlug);
    const fallbackBook = Array.isArray(searchForm.book) ? searchForm.book[0] : null;
    const book = bookFromSlug ?? fallbackBook;

    if (book === null || book === undefined) {
      return null;
    }

    if (bibleRoute.chapter) {
      return {
        book: Number(book),
        chapter: bibleRoute.chapter,
        index: bibleRoute.verse,
      };
    }

    return {
      book: Number(book),
      chapter: null,
      index: null,
    };
  };

  const syncCurrentBiblePath = () => {
    if (searchForm.searchText) {
      if (window.location.pathname.startsWith('/biblia/') || window.location.pathname.startsWith('/verse/')) {
        window.history.replaceState(null, '', '/');
      }
      return;
    }

    if (selectedBook === null || selectedBook === undefined) {
      if (window.location.pathname.startsWith('/biblia/') || window.location.pathname.startsWith('/verse/')) {
        window.history.replaceState(null, '', '/');
      }
      return;
    }

    const nextPath = activeVerseTarget
      ? getVerseSharePath(activeVerseTarget)
      : buildBiblePath({
          version: $selectedBibleVersion,
          map,
          book: selectedBook,
          chapter: selectedChapterLabel,
        });

    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, '', nextPath);
    }
  };

  const setActiveVerseTarget = (item) => {
    activeVerseTarget = {
      book: item.book,
      chapter: item.chapter,
      index: item.index,
    };
    currentVerseSeoItem = item.text ? item : null;
  };

  const scrollToResultTop = async () => {
    await tick();
    const scrollTarget = resultElement || document.querySelector('.result');

    if (!scrollTarget) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    setActiveVerseTarget(item);
    filter.set({
      ...searchForm,
      searchText: null,
      testament: 'all',
      book: [item.book],
      chapter: [item.chapter - 1],
    });
    window.history.replaceState(null, '', getVerseSharePath(item));
    await scrollToVerse(verseId);
  };

  onMount(() => {
    // Add swipe gesture listeners to the result element
    const el = resultElement;
    if (el) {
      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: false });
      el.addEventListener('touchend', onTouchEnd);
    }

    const routeTarget = getRouteTargetFromLocation();

    if (routeTarget) {
      const item = {
        ...routeTarget,
        text:
          routeTarget.chapter && routeTarget.index
            ? bible[routeTarget.book]?.[routeTarget.chapter - 1]?.[routeTarget.index - 1] || ''
            : '',
      };
      filter.set({
        ...searchForm,
        searchText: null,
        testament: 'all',
        book: [routeTarget.book],
        chapter: routeTarget.chapter ? [routeTarget.chapter - 1] : [],
      });

      if (routeTarget.chapter && routeTarget.index) {
        setActiveVerseTarget(item);
        window.history.replaceState(null, '', getVerseSharePath(item));
        scrollToVerse(getVerseId(routeTarget));
      } else {
        scrollToResultTop();
      }
    }

    isMounted = true;
  });

  onDestroy(() => {
    window.clearTimeout(toastTimer);
    window.clearTimeout(highlightTimer);
    if (resultElement) {
      resultElement.removeEventListener('touchstart', onTouchStart);
      resultElement.removeEventListener('touchmove', onTouchMove);
      resultElement.removeEventListener('touchend', onTouchEnd);
    }
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

<div
  class="result"
  class:result--swiping={isSwiping}
  class:result--swipe-left={isSwiping && swipeDirection === 'left'}
  class:result--swipe-right={isSwiping && swipeDirection === 'right'}
  bind:this={resultElement}
>
  <!-- Swipe direction indicators -->
  {#if isSwiping && !searchForm.searchText && chapterArray.length}
    <div class="swipe-indicator swipe-indicator--left" aria-hidden="true">
      {#if canSwipeRight}
        <span class="swipe-arrow"></span>
        <span class="swipe-label">{$_('app.result.swipe.previous')}</span>
      {:else}
        <span class="swipe-blocked">—</span>
      {/if}
    </div>
    <div class="swipe-indicator swipe-indicator--right" aria-hidden="true">
      {#if canSwipeLeft}
        <span class="swipe-arrow"></span>
        <span class="swipe-label">{$_('app.result.swipe.next')}</span>
      {:else}
        <span class="swipe-blocked">—</span>
      {/if}
    </div>
  {/if}
  <div class="result-content">
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
    <div class="verse-divider" aria-hidden="true"></div>
  {/each}
  </div>
</div>

{#if toastMessage}
  <div class="toast" role="status" aria-live="polite">{toastMessage}</div>
{/if}

<button
  type="button"
  class="scroll-top-button"
  aria-label={$_('app.result.actions.scroll_top')}
  title={$_('app.result.actions.scroll_top')}
  on:click={scrollToResultTop}
>
  <span aria-hidden="true"></span>
</button>

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

  .verse-divider {
    width: min(36rem, 78%);
    height: 1px;
    margin: 0.45rem auto;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--color-bg-dark) 18%, transparent) 18%,
      color-mix(in srgb, var(--color-blue) 38%, transparent) 50%,
      color-mix(in srgb, var(--color-bg-dark) 18%, transparent) 82%,
      transparent
    );

    &::after {
      content: '';
      display: block;
      width: 2.25rem;
      height: 0.18rem;
      margin: -0.07rem auto 0;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-blue) 68%, var(--color-white));
      opacity: 0.72;
    }
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
      margin: 0.5rem 0;
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
      background-color: var(--color-white);
      min-width: 2rem;
      min-height: 2rem;
      padding: 0.25rem 0.45rem;
      font-size: 14px;
      border: 1px solid rgb(45 150 205 / 34%);
      border-radius: 0.25rem;
      color: var(--color-bg-dark);
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
    input[type='radio']:focus-visible + label {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 13%, var(--color-white));
      box-shadow: 0 0 0 3px rgb(45 150 205 / 12%);
    }

    input[type='radio']:checked + label {
      border-color: var(--color-blue-hover);
      background: var(--color-blue);
      color: var(--color-on-primary);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 18%);
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

  .scroll-top-button {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 8;
    display: none;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid var(--color-blue);
    border-radius: 0.35rem;
    background: var(--color-blue);
    color: var(--color-on-primary);
    box-shadow: var(--box-shadow-down);
    transition: var(--transition);

    span {
      width: 0.8rem;
      height: 0.8rem;
      border-top: 2px solid currentcolor;
      border-left: 2px solid currentcolor;
      transform: translateY(0.2rem) rotate(45deg);
    }

    &:hover,
    &:focus-visible {
      background: var(--color-blue-hover);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 18%);
    }
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

    .scroll-top-button {
      display: grid;
    }
  }

  /* === Swipe Gesture Styles === */
  .result {
    position: relative;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    touch-action: pan-y; // Allow vertical scroll, block horizontal
  }

  .result--swiping {
    cursor: ew-resize;
  }

  .result--swipe-left .result-content {
    transform: translateX(-4px);
    opacity: 0.85;
  }

  .result--swipe-right .result-content {
    transform: translateX(4px);
    opacity: 0.85;
  }

  .result-content {
    transition: transform 0.15s ease, opacity 0.15s ease;
  }

  .swipe-indicator {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 0.75rem 0.5rem;
    background-color: rgb(45 150 205 / 14%);
    border-radius: 0.35rem;
    transition: opacity 0.2s ease;
    pointer-events: none;

    &--left {
      left: 0;
      border-left: 3px solid var(--color-blue);
    }

    &--right {
      right: 0;
      border-right: 3px solid var(--color-blue);
    }
  }

  .swipe-arrow {
    display: block;
    width: 1.1rem;
    height: 1.1rem;
    border-right: 2.5px solid var(--color-blue);
    border-bottom: 2.5px solid var(--color-blue);
  }

  .swipe-indicator--left .swipe-arrow {
    transform: rotate(135deg);
  }

  .swipe-indicator--right .swipe-arrow {
    transform: rotate(-45deg);
  }

  .swipe-label {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-blue);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    writing-mode: vertical-rl;
    text-orientation: mixed;
  }

  .swipe-blocked {
    font-size: 1.2rem;
    color: rgb(45 150 205 / 30%);
    font-weight: 300;
  }

  @media (max-width: 38rem) {
    .swipe-indicator {
      padding: 0.5rem 0.35rem;

      &--left {
        left: 0;
      }

      &--right {
        right: 0;
      }
    }

    .swipe-label {
      display: none;
    }
  }
</style>
