<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import {
    selectedBibleVersion,
    compareWithVersion,
    getBibleVersionConfigOrDefault,
    getAvailableBibleVersions,
  } from '../../store/stores';
  import { getBookIdFromSlug, getBookSlug, slugifyBookName } from '../../services/bible-route.service';
  import BookDrawer from './BookDrawer.svelte';

  export let bible = [];
  export let map = {};
  export let compareBible = [];
  export let compareMap = {};

  let selectedBook = null;
  let selectedChapter = 0;
  let toastMessage = '';
  let toastTimer;
  let isBookDrawerOpen = false;
  let hasScrolled = false;
  let scrollTimer;
  let isVersionMenuOpen = false;
  let versionMenuElement;

  // Versiones disponibles para elegir como "compareWith" (excluye la primaria y las no disponibles)
  $: availableVersions = getAvailableBibleVersions();
  $: otherVersionOptions = availableVersions.filter((v) => v.value !== $selectedBibleVersion);

  // Labels for the two columns
  $: primaryConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
  $: otherVersion = $compareWithVersion || ($selectedBibleVersion === 'vdc' ? 'rvl' : 'vdc');
  $: otherConfig = getBibleVersionConfigOrDefault(otherVersion);
  $: primaryBibleName = primaryConfig?.bibleName || 'Biblia';
  $: otherBibleName = otherConfig?.bibleName || 'Biblia';
  $: isOtherVersionAvailable = otherConfig?.available === true;

  $: chapterArray =
    selectedBook !== null && selectedBook !== undefined
      ? Array.from(Array(bible[selectedBook]?.length || 0).keys())
      : [];

  $: canGoPrev = selectedBook !== null && selectedChapter > 0;
  $: canGoNext = selectedBook !== null && selectedChapter < chapterArray.length - 1;

  $: verses1 =
    selectedBook !== null && selectedBook !== undefined
      ? (bible[selectedBook]?.[selectedChapter] || [])
      : [];

  $: verses2 =
    selectedBook !== null && selectedBook !== undefined
      ? (compareBible?.[selectedBook]?.[selectedChapter] || [])
      : [];

  $: maxVerses = Math.max(verses1.length, verses2.length);
  $: selectedBookName = selectedBook !== null ? map[selectedBook] : null;
  $: compareBookName = selectedBook !== null ? (compareMap[selectedBook] || selectedBookName) : null;
  $: selectedChapterLabel = selectedBook !== null && selectedChapter !== null ? Number(selectedChapter) + 1 : null;

  $: copyVerseLabel = $_('app.compare.copy_verse');

  const showToast = (message) => {
    toastMessage = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastMessage = '';
    }, 2200);
  };

  const copyVerse = async (text, reference) => {
    try {
      const textToCopy = `*${reference}* ${text}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      showToast($_('app.compare.copied'));
    } catch {
      // silent fail
    }
  };

  const selectBook = (bookId) => {
    selectedBook = bookId;
    selectedChapter = 0;
    isBookDrawerOpen = false;
    updateUrl();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectChapter = (chapter) => {
    selectedChapter = chapter;
    updateUrl();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goNextChapter = () => {
    if (canGoNext) {
      selectedChapter = selectedChapter + 1;
      updateUrl();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goPrevChapter = () => {
    if (canGoPrev) {
      selectedChapter = selectedChapter - 1;
      updateUrl();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Salir del modo comparación y volver a la vista normal
  const exitCompareMode = () => {
    if (typeof window === 'undefined') return;
    const bookSlug = selectedBook !== null ? getBookSlug(map, selectedBook) : null;
    const chapter = selectedChapterLabel;
    let path = '/';
    if (bookSlug && chapter) {
      // Volver a la ruta normal del libro/capítulo
      const versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
      const prefix = versionConfig?.pathPrefix || '';
      const pathParts = ['/biblia', $selectedBibleVersion, bookSlug, String(chapter)].filter(Boolean);
      path = pathParts.join('/');
    }
    window.history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Cambiar la versión con la que se compara
  const selectOtherVersion = (value) => {
    if (value && value !== $selectedBibleVersion) {
      compareWithVersion.set(value);
    }
    isVersionMenuOpen = false;
  };

  const toggleVersionMenu = () => {
    isVersionMenuOpen = !isVersionMenuOpen;
  };

  const handleVersionMenuClickOutside = (event) => {
    if (!versionMenuElement?.contains(event.target)) {
      isVersionMenuOpen = false;
    }
  };

  const updateUrl = () => {
    if (selectedBook === null) return;
    const bookSlug = getBookSlug(map, selectedBook);
    const path = `/compara/${encodeURIComponent(bookSlug)}/${selectedChapterLabel}`;
    if (window.location.pathname !== path) {
      window.history.replaceState(null, '', path);
    }
  };

  const parseComparePath = () => {
    if (typeof window === 'undefined') return;
    const pathname = window.location.pathname;
    const match = pathname.match(/^\/(?:compara|comparar)\/([^/]+)(?:\/(\d+))?\/?$/);
    if (!match) return;

    const bookSlug = decodeURIComponent(match[1]);
    const chapterStr = match[2];
    const bookId = getBookIdFromSlug(map, bookSlug);

    if (bookId !== null && bookId !== undefined) {
      selectedBook = bookId;
      selectedChapter = chapterStr ? Math.max(0, parseInt(chapterStr, 10) - 1) : 0;
    }
  };

  // Sync scroll state
  let isSyncingScroll = false;
  let paneTopElement;
  let paneBottomElement;

  // Sync scroll between top and bottom panes (mobile split mode)
  const syncScroll = (sourceEl, targetEl) => {
    if (isSyncingScroll || !sourceEl || !targetEl) return;
    const maxSource = sourceEl.scrollHeight - sourceEl.clientHeight;
    const maxTarget = targetEl.scrollHeight - targetEl.clientHeight;
    if (maxSource <= 0 || maxTarget <= 0) return;
    const ratio = sourceEl.scrollTop / maxSource;
    isSyncingScroll = true;
    targetEl.scrollTop = ratio * maxTarget;
    requestAnimationFrame(() => { isSyncingScroll = false; });
  };

  const onPaneTopScroll = () => {
    if (isSyncingScroll) return;
    syncScroll(paneTopElement, paneBottomElement);
  };

  const onPaneBottomScroll = () => {
    if (isSyncingScroll) return;
    syncScroll(paneBottomElement, paneTopElement);
  };

  // Swipe gesture state
  let touchStartX = 0;
  let touchCurrentX = 0;
  let touchStartTime = 0;
  let isSwiping = false;
  let swipeDirection = '';

  const onTouchStart = (e) => {
    touchStartX = e.touches[0].clientX;
    touchCurrentX = touchStartX;
    touchStartTime = Date.now();
    isSwiping = false;
    swipeDirection = '';
  };

  const onTouchMove = (e) => {
    if (!touchStartTime) return;
    touchCurrentX = e.touches[0].clientX;
    const dx = touchCurrentX - touchStartX;
    const dy = e.touches[0].clientY - e.touches[0].clientY;

    if (!isSwiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      isSwiping = true;
      e.preventDefault();
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
    const velocity = Math.abs(dx) / dt;
    const distance = Math.abs(dx);

    if (distance > 50 || velocity > 0.3) {
      if (dx < 0 && canGoNext) goNextChapter();
      else if (dx > 0 && canGoPrev) goPrevChapter();
    }

    resetSwipeState();
  };

  const resetSwipeState = () => {
    touchStartX = 0;
    touchCurrentX = 0;
    touchStartTime = 0;
    isSwiping = false;
    swipeDirection = '';
  };

  const handleScroll = () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      hasScrolled = window.scrollY > 120;
    }, 100);
  };

  onMount(async () => {
    await tick();
    parseComparePath();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleVersionMenuClickOutside);
  });

  onDestroy(() => {
    window.clearTimeout(toastTimer);
    window.clearTimeout(scrollTimer);
    window.removeEventListener('scroll', handleScroll);
    document.removeEventListener('click', handleVersionMenuClickOutside);
  });
</script>

<!-- Header Bar -->
<div class="compare-header">
  <div class="compare-header__inner">
    <button
      type="button"
      class="compare-book-btn"
      on:click={() => (isBookDrawerOpen = true)}
    >
      <span class="compare-book-btn__label">{$_('app.compare.select_book')}</span>
      {#if selectedBookName}
        <strong class="compare-book-btn__book">{selectedBookName}</strong>
      {:else}
        <strong class="compare-book-btn__book compare-book-btn__book--placeholder">
          {$_('app.compare.select_book')}
        </strong>
      {/if}
    </button>

    {#if selectedBook !== null && chapterArray.length}
      <div class="compare-chapters" role="group">
        {#each chapterArray as ch (ch)}
          <button
            type="button"
            class="compare-chapter-btn"
            class:compare-chapter-btn--active={ch === selectedChapter}
            on:click={() => selectChapter(ch)}
          >
            {Number(ch + 1)}
          </button>
        {/each}
      </div>
    {/if}

    <div class="compare-header__nav">
      {#if canGoPrev}
        <button type="button" class="compare-nav-btn" on:click={goPrevChapter}>
          <span aria-hidden="true">&#8592;</span>
          <span>{$_('app.compare.chapter_nav.previous')}</span>
        </button>
      {/if}
      {#if canGoNext}
        <button type="button" class="compare-nav-btn" on:click={goNextChapter}>
          <span>{$_('app.compare.chapter_nav.next')}</span>
          <span aria-hidden="true">&#8594;</span>
        </button>
      {/if}
    </div>

    <div class="compare-header__actions">
      <!-- Selector de versión a comparar -->
      {#if otherVersionOptions.length > 0}
        <div class="compare-version-picker" bind:this={versionMenuElement}>
          <button
            type="button"
            class="compare-version-btn"
            on:click|stopPropagation={toggleVersionMenu}
            aria-haspopup="listbox"
            aria-expanded={isVersionMenuOpen}
            title={$_('app.compare.choose_version')}
          >
            <span class="compare-version-btn__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3l4 4-4 4M21 7H8M7 21l-4-4 4-4M3 17h13"/>
              </svg>
            </span>
            <span class="compare-version-btn__label">{otherBibleName}</span>
            <span class="compare-version-btn__chevron" aria-hidden="true"></span>
          </button>

          {#if isVersionMenuOpen}
            <div class="compare-version-menu" role="listbox">
              {#each otherVersionOptions as opt (opt.value)}
                <button
                  type="button"
                  class="compare-version-option"
                  class:compare-version-option--selected={opt.value === otherVersion}
                  role="option"
                  aria-selected={opt.value === otherVersion}
                  on:click={() => selectOtherVersion(opt.value)}
                >
                  <span>{opt.bibleName}</span>
                  {#if opt.value === otherVersion}
                    <span class="compare-version-option__check" aria-hidden="true"></span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Botón Salir del modo comparación -->
      <button
        type="button"
        class="compare-exit-btn"
        on:click={exitCompareMode}
        title={$_('app.compare.exit_compare')}
        aria-label={$_('app.compare.exit_compare')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        <span>{$_('app.compare.exit_compare')}</span>
      </button>
    </div>
  </div>
</div>

<BookDrawer
  open={isBookDrawerOpen}
  {map}
  selectedBook={selectedBook}
  onClose={() => (isBookDrawerOpen = false)}
  onSelect={selectBook}
/>

<!-- Main Compare Content -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="compare-container"
  class:compare-container--swiping={isSwiping}
  class:compare-container--swipe-left={isSwiping && swipeDirection === 'left'}
  class:compare-container--swipe-right={isSwiping && swipeDirection === 'right'}
  on:touchstart={onTouchStart}
  on:touchmove={onTouchMove}
  on:touchend={onTouchEnd}
>
  {#if !selectedBookName}
    <!-- Empty state -->
    <div class="compare-empty">
      <div class="compare-empty__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="18" rx="1"/>
          <rect x="14" y="3" width="7" height="18" rx="1"/>
        </svg>
      </div>
      <h2>{$_('app.compare.title')}</h2>
      <p>{$_('app.compare.subtitle')}</p>
      <p class="compare-empty__hint">{$_('app.compare.no_selection')}</p>
    </div>
  {:else}
    <!-- Column Headers -->
    <div class="compare-columns-header">
      <div class="compare-col-header compare-col-header--left">
        <span class="compare-col-header__name">{primaryBibleName}</span>
        <span class="compare-col-header__ref">{selectedBookName} {selectedChapterLabel}</span>
      </div>
      <div class="compare-col-divider" aria-hidden="true"></div>
      <div class="compare-col-header compare-col-header--right">
        <span class="compare-col-header__name">{otherBibleName}</span>
        <span class="compare-col-header__ref">{compareBookName} {selectedChapterLabel}</span>
      </div>
    </div>

    <!-- Verse Rows -->
    {#if verses1.length === 0 && verses2.length === 0}
      <div class="compare-empty">
        <p>{$_('app.loading')}</p>
      </div>
    {:else}
      <!-- Desktop: side-by-side rows -->
      <div class="compare-body compare-body--desktop">
        {#each { length: maxVerses } as _, i}
          {@const v1 = verses1[i]}
          {@const v2 = verses2[i]}
          <div class="compare-row" class:compare-row--alt={i % 2 === 1}>
            <!-- Left column -->
            <div class="compare-verse compare-verse--left">
              {#if v1 !== undefined}
                <span class="compare-verse__num">{i + 1}</span>
                <span class="compare-verse__text">{v1 || ''}</span>
                {#if v1}
                  <button
                    type="button"
                    class="compare-verse__copy"
                    title={copyVerseLabel}
                    aria-label={copyVerseLabel}
                    on:click={() => copyVerse(v1, `${selectedBookName} ${selectedChapterLabel}:${i + 1}`)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  </button>
                {/if}
              {/if}
            </div>

            <div class="compare-row-divider" aria-hidden="true"></div>

            <!-- Right column -->
            <div class="compare-verse compare-verse--right">
              {#if v2 !== undefined}
                <span class="compare-verse__num">{i + 1}</span>
                <span class="compare-verse__text">{v2 || ''}</span>
                {#if v2}
                  <button
                    type="button"
                    class="compare-verse__copy"
                    title={copyVerseLabel}
                    aria-label={copyVerseLabel}
                    on:click={() => copyVerse(v2, `${compareBookName} ${selectedChapterLabel}:${i + 1}`)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  </button>
                {/if}
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Mobile: split horizontal (top + bottom) with synced scroll -->
      <div class="compare-split">
        <div
          class="compare-pane compare-pane--top"
          bind:this={paneTopElement}
          on:scroll={onPaneTopScroll}
        >
          <div class="compare-pane__header">
            <span class="compare-pane__name">{primaryBibleName}</span>
            <span class="compare-pane__ref">{selectedBookName} {selectedChapterLabel}</span>
          </div>
          <div class="compare-pane__body">
            {#each { length: maxVerses } as _, i}
              {@const v1 = verses1[i]}
              <div class="compare-verse compare-verse--full">
                {#if v1 !== undefined}
                  <span class="compare-verse__num">{i + 1}</span>
                  <span class="compare-verse__text">{v1 || ''}</span>
                  {#if v1}
                    <button
                      type="button"
                      class="compare-verse__copy"
                      title={copyVerseLabel}
                      aria-label={copyVerseLabel}
                      on:click={() => copyVerse(v1, `${selectedBookName} ${selectedChapterLabel}:${i + 1}`)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                    </button>
                  {/if}
                {/if}
              </div>
            {/each}
            <p class="compare-footer-count">{$_('app.compare.verse_count', { count: verses1.length })}</p>
          </div>
        </div>

        <div
          class="compare-pane compare-pane--bottom"
          bind:this={paneBottomElement}
          on:scroll={onPaneBottomScroll}
        >
          <div class="compare-pane__header">
            <span class="compare-pane__name">{otherBibleName}</span>
            <span class="compare-pane__ref">{compareBookName} {selectedChapterLabel}</span>
          </div>
          <div class="compare-pane__body">
            {#each { length: maxVerses } as _, i}
              {@const v2 = verses2[i]}
              <div class="compare-verse compare-verse--full">
                {#if v2 !== undefined}
                  <span class="compare-verse__num">{i + 1}</span>
                  <span class="compare-verse__text">{v2 || ''}</span>
                  {#if v2}
                    <button
                      type="button"
                      class="compare-verse__copy"
                      title={copyVerseLabel}
                      aria-label={copyVerseLabel}
                      on:click={() => copyVerse(v2, `${compareBookName} ${selectedChapterLabel}:${i + 1}`)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                    </button>
                  {/if}
                {/if}
              </div>
            {/each}
            <p class="compare-footer-count">{$_('app.compare.verse_count', { count: verses2.length })}</p>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Swipe indicators -->
{#if isSwiping && selectedBookName}
  <div class="swipe-indicator swipe-indicator--left" aria-hidden="true">
    {#if canGoPrev}
      <span class="swipe-arrow"></span>
    {:else}
      <span class="swipe-blocked">&#8212;</span>
    {/if}
  </div>
  <div class="swipe-indicator swipe-indicator--right" aria-hidden="true">
    {#if canGoNext}
      <span class="swipe-arrow"></span>
    {:else}
      <span class="swipe-blocked">&#8212;</span>
    {/if}
  </div>
{/if}

<!-- Toast -->
{#if toastMessage}
  <div class="toast" role="status" aria-live="polite">{toastMessage}</div>
{/if}

<!-- Floating chapter navigation (desktop) -->
{#if selectedBookName && hasScrolled && canGoPrev}
  <button type="button" class="chapter-nav chapter-nav--prev" on:click={goPrevChapter}>
    <span class="chapter-nav__arrow"></span>
    <span class="chapter-nav__label">{$_('app.compare.chapter_nav.previous')}</span>
  </button>
{/if}
{#if selectedBookName && hasScrolled && canGoNext}
  <button type="button" class="chapter-nav chapter-nav--next" on:click={goNextChapter}>
    <span class="chapter-nav__label">{$_('app.compare.chapter_nav.next')}</span>
    <span class="chapter-nav__arrow"></span>
  </button>
{/if}

<style lang="scss">
  // === HEADER ===
  .compare-header {
    background: var(--color-bg-light);
    border-bottom: 2px solid var(--color-blue);
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 2px 12px rgb(0 0 0 / 10%);

    &__inner {
      max-width: 96rem;
      margin-inline: auto;
      padding: 0.75rem clamp(1rem, 5vw, 5rem);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }

    &__nav {
      display: flex;
      gap: 0.5rem;
      margin-left: auto;
      flex-wrap: wrap;
    }

    &__actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
  }

  // === VERSION PICKER ===
  .compare-version-picker {
    position: relative;
    flex: 0 0 auto;
  }

  .compare-version-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.75rem;
    border: 1px solid rgb(45 150 205 / 42%);
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-blue) 11%, var(--color-white));
    color: var(--color-bg-dark);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
    max-width: 12rem;

    &__icon {
      display: flex;
      align-items: center;

      svg {
        width: 0.95rem;
        height: 0.95rem;
      }
    }

    &__label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &__chevron {
      width: 0.5rem;
      height: 0.5rem;
      flex: 0 0 auto;
      border-right: 2px solid currentcolor;
      border-bottom: 2px solid currentcolor;
      transform: translateY(-0.1rem) rotate(45deg);
    }

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
  }

  .compare-version-menu {
    position: absolute;
    top: calc(100% + 0.45rem);
    right: 0;
    z-index: 30;
    display: grid;
    gap: 0.25rem;
    width: max(14rem, 100%);
    max-width: calc(100vw - 2rem);
    padding: 0.35rem;
    border: 1px solid rgb(63 88 103 / 18%);
    border-radius: 0.35rem;
    background: var(--color-white);
    box-shadow: var(--box-shadow-down);
  }

  .compare-version-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: 2.45rem;
    padding: 0 0.65rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-bg-dark);
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
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

    &__check {
      width: 0.7rem;
      height: 0.4rem;
      flex: 0 0 auto;
      border-left: 2px solid currentcolor;
      border-bottom: 2px solid currentcolor;
      transform: translateY(-0.08rem) rotate(-45deg);
    }
  }

  // === EXIT BUTTON ===
  .compare-exit-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--color-blue);
    border-radius: 999px;
    background: var(--color-blue);
    color: var(--color-white);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--box-shadow-down);

    svg {
      width: 0.95rem;
      height: 0.95rem;
      flex: 0 0 auto;
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

  .compare-book-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    padding: 0.4rem 0.85rem;
    border: 1px solid rgb(45 150 205 / 42%);
    border-radius: 0.3rem;
    background: var(--color-white);
    cursor: pointer;
    transition: var(--transition);
    min-width: 12rem;

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 14%);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }

    &__label {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--color-blue);
    }

    &__book {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--color-bg-dark);
      line-height: 1.25;

      &--placeholder {
        color: color-mix(in srgb, var(--color-bg-dark) 55%, transparent);
        font-weight: 400;
      }
    }
  }

  .compare-chapters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    max-height: 4.5rem;
    overflow-y: auto;
    padding: 0.2rem;
    scrollbar-color: rgb(45 150 205 / 45%) transparent;
  }

  .compare-chapter-btn {
    flex: 0 0 auto;
    min-width: 2rem;
    min-height: 2rem;
    padding: 0.2rem 0.35rem;
    border: 1px solid rgb(45 150 205 / 32%);
    border-radius: 0.22rem;
    background: var(--color-white);
    color: var(--color-bg-dark);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    line-height: 1.3;

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
    }

    &--active {
      border-color: var(--color-blue-hover);
      background: var(--color-blue);
      color: var(--color-on-primary);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 18%);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }
  }

  .compare-nav-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--color-blue);
    border-radius: 999px;
    background: var(--color-white);
    color: var(--color-bg-dark);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--box-shadow-down);

    &:hover,
    &:focus-visible {
      background: var(--color-blue);
      color: var(--color-white);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 25%);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }
  }

  // === CONTAINER ===
  .compare-container {
    max-width: 96rem;
    margin-inline: auto;
    padding: 0 clamp(1rem, 5vw, 5rem) 3rem;
    user-select: text;
    -webkit-user-select: text;
    touch-action: pan-y;

    &--swiping {
      cursor: ew-resize;
    }

    &--swipe-left .compare-body--desktop {
      transform: translateX(-3px);
      opacity: 0.9;
    }

    &--swipe-right .compare-body--desktop {
      transform: translateX(3px);
      opacity: 0.9;
    }
  }

  // === MOBILE SPLIT (hidden on desktop) ===
  .compare-split {
    display: none;
  }

  .compare-pane {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgb(45 150 205 / 45%) transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgb(45 150 205 / 45%);
      border-radius: 3px;
    }

    &__header {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      padding: 0.75rem 1rem 0.5rem;
      background: var(--color-bg-light);
      border-bottom: 1px solid rgb(45 150 205 / 20%);
      box-shadow: 0 2px 6px rgb(0 0 0 / 8%);
    }

    &__name {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--color-blue);
    }

    &__ref {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--color-bg-dark);
    }

    &__body {
      padding: 0.25rem 0;
    }
  }

  .compare-verse--full {
    padding: 0.7rem 1rem;
  }

  // === EMPTY STATE ===
  .compare-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 60vh;
    text-align: center;
    color: var(--color-bg-dark);
    padding: 2rem;

    &__icon {
      width: 4rem;
      height: 4rem;
      color: var(--color-blue);
      opacity: 0.5;

      svg {
        width: 100%;
        height: 100%;
      }
    }

    h2 {
      font-size: clamp(1.5rem, 3vw, 2rem);
      margin: 0;
      color: var(--color-bg-dark);
    }

    p {
      font-size: 1rem;
      margin: 0;
      color: color-mix(in srgb, var(--color-bg-dark) 62%, transparent);
      max-width: 30rem;
    }

    &__hint {
      font-size: 0.9rem;
      opacity: 0.7;
    }
  }

  // === COLUMN HEADERS ===
  .compare-columns-header {
    display: grid;
    grid-template-columns: 1fr 1px 1fr;
    gap: 0;
    padding: 1rem 0 0.75rem;
    margin-bottom: 0.5rem;
    border-bottom: 2px solid var(--color-blue);
  }

  .compare-col-header {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0 0.75rem;

    &--left {
      text-align: left;
    }

    &--right {
      text-align: right;
    }

    &__name {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-blue);
    }

    &__ref {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--color-bg-dark);
    }
  }

  .compare-col-divider {
    background: rgb(45 150 205 / 30%);
    margin: 0 0.25rem;
  }

  // === BODY ===
  .compare-body {
    display: flex;
    flex-direction: column;
    transition: transform 0.15s ease, opacity 0.15s ease;
  }

  .compare-row {
    display: grid;
    grid-template-columns: 1fr 1px 1fr;
    gap: 0;
    min-height: 2.8rem;
    align-items: stretch;
    transition: background-color 0.15s ease;

    &--alt {
      background: color-mix(in srgb, var(--color-blue) 5%, transparent);
    }

    &:hover {
      background: color-mix(in srgb, var(--color-blue) 10%, transparent);
    }
  }

  .compare-row-divider {
    background: rgb(45 150 205 / 20%);
    margin: 0 0.25rem;
  }

  // === VERSE ===
  .compare-verse {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.7rem 0.75rem;
    position: relative;

    &__num {
      flex: 0 0 auto;
      font-size: 13px;
      font-weight: 700;
      color: var(--color-blue);
      min-width: 1.6rem;
      text-align: right;
      padding-top: 0.05rem;
      line-height: 1.65;
    }

    &__text {
      flex: 1;
      font-size: 1rem;
      line-height: 1.7;
      color: var(--color-bg-dark);
    }

    &__copy {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: 1.6rem;
      height: 1.6rem;
      margin-top: 0.05rem;
      border: 1px solid rgb(45 150 205 / 22%);
      border-radius: 0.25rem;
      background: rgb(45 150 205 / 7%);
      color: var(--color-link);
      cursor: pointer;
      opacity: 0;
      transition: var(--transition);

      svg {
        width: 0.8rem;
        height: 0.8rem;
      }

      &:hover,
      &:focus-visible {
        border-color: var(--color-blue);
        background: rgb(45 150 205 / 18%);
        opacity: 1;
      }

      &:focus-visible {
        outline: 2px solid var(--color-blue);
        outline-offset: 2px;
      }
    }

    &:hover &__copy,
    &:focus-within &__copy {
      opacity: 1;
    }

    &--right {
      flex-direction: row-reverse;

      .compare-verse__num {
        text-align: left;
      }
    }
  }

  .compare-footer-count {
    text-align: center;
    font-size: 0.8rem;
    color: color-mix(in srgb, var(--color-bg-dark) 50%, transparent);
    margin: 1.5rem 0 0;
    font-style: italic;
  }

  // === TOAST ===
  .toast {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 50;
    max-width: min(22rem, calc(100vw - 2rem));
    padding: 0.75rem 1rem;
    border-left: 0.3rem solid var(--color-blue);
    border-radius: 0.3rem;
    background: var(--color-white);
    box-shadow: var(--box-shadow-down);
    color: var(--color-bg-dark);
    font-weight: 600;
    font-size: 0.9rem;
  }

  // === SWIPE INDICATORS ===
  .swipe-indicator {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    z-index: 20;
    display: flex;
    align-items: center;
    padding: 0.6rem 0.4rem;
    background: rgb(45 150 205 / 18%);
    border-radius: 0.3rem;
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
    width: 0.9rem;
    height: 0.9rem;
    border-right: 2.5px solid var(--color-blue);
    border-bottom: 2.5px solid var(--color-blue);
  }

  .swipe-indicator--left .swipe-arrow { transform: rotate(135deg); }
  .swipe-indicator--right .swipe-arrow { transform: rotate(-45deg); }

  .swipe-blocked {
    font-size: 1rem;
    color: rgb(45 150 205 / 35%);
  }

  // === FLOATING CHAPTER NAV (desktop) ===
  .chapter-nav {
    position: fixed;
    bottom: 2rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid var(--color-blue);
    border-radius: 999px;
    background: var(--color-white);
    color: var(--color-bg-dark);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--box-shadow-down);

    &:hover,
    &:focus-visible {
      background: var(--color-blue);
      color: var(--color-white);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 25%);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }

    &--prev { left: 1rem; }
    &--next { right: 1rem; }

    &__arrow {
      display: block;
      width: 0.55rem;
      height: 0.55rem;
      border-right: 2px solid currentColor;
      border-bottom: 2px solid currentColor;
      flex-shrink: 0;
    }

    &--prev &__arrow { transform: rotate(135deg); }
    &--next &__arrow { transform: rotate(-45deg); }

    &__label { white-space: nowrap; }
  }

  // === RESPONSIVE ===
  @media (max-width: 38rem) {
    .compare-container {
      padding: 0;
    }

    .compare-header__inner {
      flex-direction: column;
      align-items: stretch;
    }

    .compare-header__nav {
      margin-left: 0;
      justify-content: center;
    }

    .compare-book-btn {
      min-width: 0;
      width: 100%;
    }

    .compare-chapters {
      max-height: 3rem;
    }

    // Hide desktop side-by-side on mobile
    .compare-columns-header,
    .compare-body--desktop {
      display: none;
    }

    // Show mobile split (top/bottom)
    .compare-split {
      display: flex;
      flex-direction: column;
      height: calc(100dvh - 14rem);
      min-height: 30rem;
      gap: 0;
    }

    .compare-pane--top {
      flex: 1 1 50%;
      border-bottom: 2px solid var(--color-blue);
    }

    .compare-pane--bottom {
      flex: 1 1 50%;
    }

    .compare-verse__text {
      font-size: 0.92rem;
    }

    .compare-footer-count {
      margin: 1rem 0 0.5rem;
    }

    .chapter-nav {
      display: none;
    }
  }

  // === DARK MODE ===
  :global(html[data-theme='dark']) {
    .compare-header {
      background: #0f1720;
      border-bottom-color: var(--color-blue);
    }

    .compare-book-btn {
      background: rgb(255 255 255 / 10%);
      border-color: rgb(255 255 255 / 25%);

      &:hover,
      &:focus-visible {
        border-color: var(--color-blue);
        background: rgb(45 150 205 / 18%);
      }

      &__label { color: var(--color-blue); }
      &__book { color: #ffffff; }
      &__book--placeholder { color: rgb(255 255 255 / 50%); }
    }

    .compare-chapter-btn {
      background: rgb(255 255 255 / 10%);
      border-color: rgb(255 255 255 / 25%);
      color: #ffffff;

      &:hover,
      &:focus-visible {
        border-color: var(--color-blue);
        background: rgb(45 150 205 / 18%);
      }
    }

    .compare-nav-btn {
      background: rgb(255 255 255 / 10%);
      color: #ffffff;

      &:hover,
      &:focus-visible {
        background: var(--color-blue);
        color: var(--color-white);
      }
    }

    .compare-version-btn {
      background: rgb(255 255 255 / 8%);
      color: #ffffff;
      border-color: rgb(255 255 255 / 30%);

      &:hover,
      &:focus-visible {
        background: rgb(45 150 205 / 18%);
        border-color: var(--color-blue);
      }
    }

    .compare-version-menu {
      background: #1e2d3d;
      border-color: rgb(255 255 255 / 15%);
    }

    .compare-version-option {
      color: #ffffff;

      &:hover,
      &:focus-visible {
        background: rgb(45 150 205 / 18%);
        border-color: var(--color-blue);
      }

      &--selected {
        background: var(--color-blue);
        color: var(--color-white);
      }
    }

    .compare-exit-btn {
      background: var(--color-blue);
      color: var(--color-white);
      border-color: var(--color-blue);

      &:hover,
      &:focus-visible {
        background: var(--color-blue-hover);
      }
    }

    .compare-container {
      background: #0f1720;
    }

    .compare-empty {
      color: #ffffff;

      h2 { color: #ffffff; }
      p { color: rgb(255 255 255 / 62%); }
      &__hint { color: rgb(255 255 255 / 45%); }
      &__icon { color: var(--color-blue); opacity: 0.6; }
    }

    .compare-columns-header {
      border-bottom-color: var(--color-blue);
    }

    .compare-col-header {
      &__ref { color: #ffffff; }
    }

    .compare-col-divider {
      background: rgb(45 150 205 / 30%);
    }

    .compare-row--alt {
      background: rgb(45 150 205 / 8%);
    }

    .compare-row:hover {
      background: rgb(45 150 205 / 15%);
    }

    .compare-row-divider {
      background: rgb(45 150 205 / 25%);
    }

    .compare-verse {
      &__text { color: #ffffff; }
      &__num { color: #7ec8e3; }

      &__copy {
        background: rgb(45 150 205 / 15%);
        color: #7ec8e3;
      }
    }

    .compare-pane {
      &__header {
        background: #0f1720;
        border-bottom-color: rgb(45 150 205 / 25%);
      }

      &__name { color: var(--color-blue); }
      &__ref { color: #ffffff; }
    }

    .compare-pane--top {
      border-bottom-color: var(--color-blue);
    }

    .compare-footer-count {
      color: rgb(255 255 255 / 50%);
    }

    .toast {
      background: #1e2d3d;
      color: #ffffff;
      border-left-color: var(--color-blue);
    }

    .chapter-nav {
      background: rgb(255 255 255 / 10%);
      color: #ffffff;
      border-color: rgb(255 255 255 / 30%);

      &:hover,
      &:focus-visible {
        background: var(--color-blue);
        color: var(--color-white);
      }
    }

    .swipe-indicator {
      background: rgb(45 150 205 / 20%);

      .swipe-arrow {
        border-color: #7ec8e3;
      }
    }

    .swipe-blocked {
      color: rgb(45 150 205 / 40%);
    }
  }
</style>
