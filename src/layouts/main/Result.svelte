<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    buildBiblePath,
    getBookIdFromSlug,
    getBookSlug,
    parseBiblePath,
    parseLegacyVersePath,
  } from '../../services/bible-route.service';
  import { replaceDiacritics } from '../../services/filter.service';
  import { _ } from '../../services/i18n.service';
  import { applySeoMetadata, buildCurrentBibleSeo, buildVerseSeo } from '../../services/seo.service';
  import { filter, getBibleVersionConfigOrDefault, getAvailableBibleVersions, immersiveMode, selectedBibleVersion, compareWithVersion, toggleImmersiveMode } from '../../store/stores';
  import { topicsStore, topicsContainingVerse } from '../../store/topicsStore';
  import AutoRead from '../../components/AutoRead.svelte';
  import { registerAutoReadCallback, unregisterAutoReadCallback } from '../../store/autoReadStore';

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

  // Compare-by-verse menu state
  let compareMenuVerseKey = null;
  let compareMenuElement;
  $: availableOtherVersions = getAvailableBibleVersions().filter((v) => v.value !== $selectedBibleVersion);

  // Save-to-topic menu state
  let saveToTopicVerseKey = null;
  let saveToTopicMenuElement;
  let newTopicInline = { name: '', icon: '📌', color: '#2E7D9B' };
  let showInlineCreate = false;

  // Auto-read state
  let autoReadVisible = false;

  $: topics = $topicsStore.topics;
  $: verseRefs = $topicsStore.verseRefs;

  const toggleCompareMenu = (verseKey, event) => {
    if (event) event.stopPropagation();
    compareMenuVerseKey = compareMenuVerseKey === verseKey ? null : verseKey;
  };

  const closeCompareMenu = () => {
    compareMenuVerseKey = null;
  };

  const handleCompareMenuOutside = (event) => {
    if (compareMenuVerseKey === null) return;
    if (compareMenuElement && !compareMenuElement.contains(event.target)) {
      closeCompareMenu();
    }
  };

  // === Save to topic ===
  const toggleSaveToTopicMenu = (verseKey, event) => {
    if (event) event.stopPropagation();
    saveToTopicVerseKey = saveToTopicVerseKey === verseKey ? null : verseKey;
    showInlineCreate = false;
    newTopicInline = { name: '', icon: '📌', color: '#2E7D9B' };
  };

  const closeSaveToTopicMenu = () => {
    saveToTopicVerseKey = null;
    showInlineCreate = false;
  };

  const handleSaveToTopicMenuOutside = (event) => {
    if (saveToTopicVerseKey === null) return;
    if (saveToTopicMenuElement && !saveToTopicMenuElement.contains(event.target)) {
      closeSaveToTopicMenu();
    }
  };

  const addToTopic = (item, topicId) => {
    const ok = topicsStore.addVerse(topicId, {
      book: item.book,
      chapter: item.chapter,
      verse: item.index,
    });
    if (ok) showToastMessage($_('app.topics.saved'));
    else showToastMessage($_('app.topics.already_in_topic'));
    closeSaveToTopicMenu();
  };

  const removeFromTopic = (item, topicId) => {
    topicsStore.removeVerse(topicId, {
      book: item.book,
      chapter: item.chapter,
      verse: item.index,
    });
    showToastMessage($_('app.topics.removed'));
  };

  const createTopicInline = (item) => {
    if (!newTopicInline.name.trim()) return;
    const created = topicsStore.create(newTopicInline);
    if (created) {
      topicsStore.addVerse(created.id, {
        book: item.book,
        chapter: item.chapter,
        verse: item.index,
      });
      showToastMessage($_('app.topics.saved'));
      closeSaveToTopicMenu();
    }
  };

  const isVerseInTopic = (topicId, item) => {
    return (verseRefs[topicId] || []).some(
      (v) => v.book === item.book && v.chapter === item.chapter && v.verse === item.index,
    );
  };

  const showToastMessage = (message) => {
    toastMessage = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastMessage = '';
    }, 2200);
  };

  // Iniciar compare con el versículo actual y la versión elegida
  const compareVerseWith = (item, version) => {
    closeCompareMenu();
    if (!version || version === $selectedBibleVersion) return;
    compareWithVersion.set(version);
    // Guardar el versículo destino para que el Compare lo resalte al cargar
    try {
      sessionStorage.setItem(
        'robible:pendingCompareVerse',
        JSON.stringify({ book: item.book, chapter: item.chapter, index: item.index }),
      );
    } catch {
      // ignore
    }
    const bookSlug = getBookSlug(map, item.book);
    const path = `/compara/${encodeURIComponent(bookSlug)}/${item.chapter}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new CustomEvent('robibile:navigate'));
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };
  let resultElement;
  let isMounted = false;
  let hasScrolled = false;
  let scrollTimer;

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

  $: isImmersive = $immersiveMode;

  const updateChapterForm = async () => {
    activeVerseTarget = null;
    currentVerseSeoItem = null;
    filter.set({ ...searchForm, chapter: [chapterForm.chapter] });
    await scrollToResultTop();
  };

  const goToNextChapter = async () => {
    if (!canSwipeLeft) return false;
    chapterForm.chapter = (selectedChapter ?? 0) + 1;
    await updateChapterForm();
    showToast($_('app.result.toast.next_chapter'));
    return true;
  };

  // Wrapper para auto-read: avanza al siguiente capítulo y reanuda el play
  const handleAutoAdvance = async () => {
    const advanced = await goToNextChapter();
    if (advanced) {
      // Pequeño delay para que el usuario vea el cambio antes de continuar
      setTimeout(() => {
        import('../../store/autoReadStore').then(({ autoReadPlay }) => {
          autoReadPlay();
        });
      }, 1200);
    }
  };

  const goToPrevChapter = async () => {
    if (!canSwipeRight) return;
    chapterForm.chapter = (selectedChapter ?? 0) - 1;
    await updateChapterForm();
    showToast($_('app.result.toast.prev_chapter'));
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

    // Scroll handler to show/hide chapter nav arrows
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const shouldShow = scrollY > 120;
      if (shouldShow !== hasScrolled) {
        hasScrolled = shouldShow;
      }
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        hasScrolled = scrollY > 120;
      }, 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

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
    document.addEventListener('click', handleCompareMenuOutside);
    document.addEventListener('click', handleSaveToTopicMenuOutside);

    // Auto-read: mostrar controles y registrar callback de avance
    autoReadVisible = true;
    registerAutoReadCallback(handleAutoAdvance);
  });

  onDestroy(() => {
    window.clearTimeout(toastTimer);
    window.clearTimeout(highlightTimer);
    window.clearTimeout(scrollTimer);
    unregisterAutoReadCallback();
    if (resultElement) {
      resultElement.removeEventListener('touchstart', onTouchStart);
      resultElement.removeEventListener('touchmove', onTouchMove);
      resultElement.removeEventListener('touchend', onTouchEnd);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', () => {});
      document.removeEventListener('click', handleCompareMenuOutside);
      document.removeEventListener('click', handleSaveToTopicMenuOutside);
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
          class="icon-btn"
          on:click={() => copyVerse(item)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        {#if availableOtherVersions.length > 0}
          <span class="verse-compare" bind:this={compareMenuElement}>
            <button
              type="button"
              class="icon-btn compare-link-btn"
              title={$_('app.result.actions.compare_with')}
              aria-label={$_('app.result.actions.compare_with', {
                reference: `${map[item.book]} ${item.chapter}:${item.index}`,
              })}
              on:click={(e) => toggleCompareMenu(item.key, e)}
              aria-haspopup="listbox"
              aria-expanded={compareMenuVerseKey === item.key}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17 3l4 4-4 4M21 7H8M7 21l-4-4 4-4M3 17h13"/>
              </svg>
            </button>
            {#if compareMenuVerseKey === item.key}
              <div class="verse-compare-menu" role="listbox">
                {#each availableOtherVersions as opt (opt.value)}
                  <button
                    type="button"
                    class="verse-compare-option"
                    role="option"
                    aria-selected="false"
                    on:click={(e) => { e.stopPropagation(); compareVerseWith(item, opt.value); }}
                  >
                    <span class="verse-compare-option__name">{opt.bibleName}</span>
                    <span class="verse-compare-option__locale">{opt.label}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </span>
        {/if}

        <!-- Save to topic -->
        <span class="verse-save-topic" bind:this={saveToTopicMenuElement}>
          <button
            type="button"
            class="icon-btn save-topic-btn"
            title={$_('app.topics.add_verse_to_topic')}
            aria-label={$_('app.topics.add_verse_to_topic')}
            on:click={(e) => toggleSaveToTopicMenu(item.key, e)}
            aria-haspopup="listbox"
            aria-expanded={saveToTopicVerseKey === item.key}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
          </button>
          {#if saveToTopicVerseKey === item.key}
            <div class="save-topic-menu" role="listbox">
              <div class="save-topic-menu__label">{$_('app.topics.add_to_existing')}</div>
              {#if topics.length === 0}
                <p class="save-topic-menu__empty">{$_('app.topics.create_first_topic')}</p>
              {:else}
                <ul class="save-topic-menu__list">
                  {#each topics as topic (topic.id)}
                    {@const inTopic = isVerseInTopic(topic.id, item)}
                    <li>
                      <button
                        type="button"
                        class="save-topic-option"
                        class:save-topic-option--active={inTopic}
                        on:click={() => inTopic ? removeFromTopic(item, topic.id) : addToTopic(item, topic.id)}
                      >
                        <span class="save-topic-option__icon" aria-hidden="true">{topic.icon}</span>
                        <span class="save-topic-option__name">{topic.name}</span>
                        <span class="save-topic-option__check" aria-hidden="true">{inTopic ? '✓' : '+'}</span>
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
              <div class="save-topic-menu__divider" aria-hidden="true"></div>
              {#if !showInlineCreate}
                <button
                  type="button"
                  class="save-topic-menu__add-new"
                  on:click={(e) => { e.stopPropagation(); showInlineCreate = true; }}
                >
                  <span aria-hidden="true">+</span>
                  <span>{$_('app.topics.create_new_inline')}</span>
                </button>
              {:else}
                <div class="save-topic-menu__inline">
                  <input
                    type="text"
                    bind:value={newTopicInline.name}
                    placeholder={$_('app.topics.new_topic_placeholder')}
                    maxlength="40"
                    autofocus
                    on:click={(e) => e.stopPropagation()}
                    on:mousedown|stopPropagation
                  />
                  <div class="save-topic-menu__inline-row">
                    <input
                      type="text"
                      bind:value={newTopicInline.icon}
                      placeholder="📌"
                      maxlength="2"
                      class="save-topic-menu__inline-icon"
                      on:click={(e) => e.stopPropagation()}
                      on:mousedown|stopPropagation
                    />
                    <input
                      type="color"
                      bind:value={newTopicInline.color}
                      class="save-topic-menu__inline-color"
                      on:click={(e) => e.stopPropagation()}
                      on:mousedown|stopPropagation
                    />
                  </div>
                  <div class="save-topic-menu__inline-actions">
                    <button
                      type="button"
                      class="save-topic-menu__inline-cancel"
                      on:click={(e) => {
                        e.stopPropagation();
                        showInlineCreate = false;
                        newTopicInline = { name: '', icon: '📌', color: '#2E7D9B' };
                      }}
                    >
                      {$_('app.topics.cancel')}
                    </button>
                    <button
                      type="button"
                      class="save-topic-menu__inline-save"
                      on:click={(e) => { e.stopPropagation(); createTopicInline(item); }}
                      disabled={!newTopicInline.name.trim()}
                    >
                      {$_('app.topics.save')}
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </span>
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

<!-- Floating chapter navigation (appears after scrolling) -->
{#if !searchForm.searchText && chapterArray.length && hasScrolled}
  {#if canSwipeRight}
    <button
      type="button"
      class="chapter-nav chapter-nav--prev"
      aria-label={$_('app.result.swipe.previous')}
      title={$_('app.result.swipe.previous')}
      on:click={goToPrevChapter}
    >
      <span class="chapter-nav__arrow"></span>
      <span class="chapter-nav__label">{$_('app.result.swipe.previous')}</span>
    </button>
  {/if}
  {#if canSwipeLeft}
    <button
      type="button"
      class="chapter-nav chapter-nav--next"
      aria-label={$_('app.result.swipe.next')}
      title={$_('app.result.swipe.next')}
      on:click={goToNextChapter}
    >
      <span class="chapter-nav__label">{$_('app.result.swipe.next')}</span>
      <span class="chapter-nav__arrow"></span>
    </button>
  {/if}
{/if}

<!-- Keyboard shortcut: Escape exits immersive mode -->
<svelte:window on:keydown={(e) => { if (e.key === 'Escape' && $immersiveMode) toggleImmersiveMode(); }} />

<!-- Auto-read controls (only when reading a chapter, not in search) -->
{#if !searchForm.searchText && chapterArray.length}
  <AutoRead visible={autoReadVisible} />
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

  // === ICON BUTTONS (copy, compare, save-to-topic) ===
  // Estilo unificado para todos los iconos inline de cada versículo.
  // Ver clases específicas abajo para comportamiento de hover/opacity.
  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: 1.65rem;
    height: 1.65rem;
    margin-left: 0.2rem;
    border: 1px solid rgb(45 150 205 / 24%);
    border-radius: 0.28rem;
    background: rgb(45 150 205 / 7%);
    color: var(--color-link);
    cursor: pointer;
    transition: var(--transition);

    svg {
      width: 0.85rem;
      height: 0.85rem;
    }

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: rgb(45 150 205 / 18%);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 14%);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }
  }

  // El copy-link está siempre visible (no depende de hover del versículo)
  // Compare y save-topic aparecen solo en hover (sus selectores están abajo).
  .copy-link {
    // Hereda todo de .icon-btn — la clase copy-link solo se mantiene
    // por compatibilidad con selectores :hover y dark mode.
    opacity: 0;

    &:hover,
    &:focus-visible {
      opacity: 1;
    }

    &:focus-visible {
      opacity: 1;
    }
  }

  // === COMPARE PER VERSE ===
  .verse-compare {
    position: relative;
    display: inline-flex;
  }

  .compare-link-btn {
    // Hereda de .icon-btn — solo añade el reveal on hover
    opacity: 0;

    &:hover,
    &:focus-visible {
      opacity: 1;
    }

    &:focus-visible {
      opacity: 1;
    }
  }

  .verse:hover .compare-link-btn,
  .verse:focus-within .compare-link-btn,
  .compare-link-btn[aria-expanded="true"],
  .verse:hover .copy-link,
  .verse:focus-within .copy-link {
    opacity: 1;
  }

  .verse-compare-menu {
    position: absolute;
    top: calc(100% + 0.4rem);
    right: 0;
    z-index: 20;
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

  .verse-compare-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    width: 100%;
    padding: 0.4rem 0.65rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-bg-dark);
    text-align: left;
    cursor: pointer;
    transition: var(--transition);

    &__name {
      font-size: 0.85rem;
      font-weight: 600;
      line-height: 1.2;
    }

    &__locale {
      font-size: 0.7rem;
      color: color-mix(in srgb, var(--color-bg-dark) 60%, transparent);
    }

    &:hover,
    &:focus-visible {
      border-color: rgb(45 150 205 / 34%);
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
    }
  }

  :global(html[data-theme='dark']) .verse-compare-menu {
    background: #1e2d3d;
    border-color: rgb(255 255 255 / 15%);
  }

  :global(html[data-theme='dark']) .verse-compare-option {
    color: #ffffff;

    &__locale {
      color: rgb(255 255 255 / 50%);
    }

    &:hover,
    &:focus-visible {
      background: rgb(45 150 205 / 18%);
      border-color: var(--color-blue);
    }
  }

  :global(html[data-theme='dark']) .compare-link-btn {
    background: rgb(45 150 205 / 15%);
    color: #7ec8e3;
    border-color: rgb(45 150 205 / 25%);
  }

  // === SAVE TO TOPIC ===
  .verse-save-topic {
    position: relative;
    display: inline-flex;
  }

  .save-topic-btn {
    // Hereda de .icon-btn — solo añade el reveal on hover
    opacity: 0;

    &:hover,
    &:focus-visible {
      opacity: 1;
    }

    &:focus-visible {
      opacity: 1;
    }
  }

  .verse:hover .save-topic-btn,
  .verse:focus-within .save-topic-btn,
  .save-topic-btn[aria-expanded="true"] {
    opacity: 1;
  }

  .save-topic-menu {
    position: absolute;
    top: calc(100% + 0.4rem);
    right: auto;
    left: 0;
    z-index: 25;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: min(20rem, calc(100vw - 2rem));
    max-height: min(70vh, 32rem);
    overflow-y: auto;
    padding: 0.55rem;
    border: 1px solid rgb(63 88 103 / 18%);
    border-radius: 0.4rem;
    background: var(--color-white);
    box-shadow: var(--box-shadow-down);

    &__label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-blue);
      padding: 0.25rem 0.4rem 0;
    }

    &__empty {
      margin: 0;
      padding: 0.5rem 0.4rem;
      font-size: 0.85rem;
      color: color-mix(in srgb, var(--color-bg-dark) 60%, transparent);
    }

    &__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    &__divider {
      height: 1px;
      margin: 0.2rem 0;
      background: rgb(45 150 205 / 18%);
    }

    &__add-new {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      width: 100%;
      padding: 0.5rem 0.65rem;
      border: 1px dashed rgb(45 150 205 / 38%);
      border-radius: 0.3rem;
      background: transparent;
      color: var(--color-blue);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);

      span[aria-hidden] {
        font-size: 1.1rem;
        line-height: 1;
      }

      &:hover,
      &:focus-visible {
        background: color-mix(in srgb, var(--color-blue) 8%, var(--color-white));
        border-style: solid;
      }
    }

    &__inline {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 0.4rem;
      border: 1px solid rgb(45 150 205 / 22%);
      border-radius: 0.3rem;
      background: rgb(45 150 205 / 4%);

      input[type='text'],
      input[type='color'] {
        width: 100%;
        padding: 0.4rem 0.55rem;
        border: 1px solid rgb(45 150 205 / 28%);
        border-radius: 0.25rem;
        background: var(--color-white);
        color: var(--color-bg-dark);
        font-size: 0.88rem;
        transition: var(--transition);

        &:focus {
          outline: none;
          border-color: var(--color-blue);
          box-shadow: 0 0 0 2px rgb(45 150 205 / 16%);
        }
      }

      input[type='color'] {
        padding: 0.1rem;
        height: 2rem;
        cursor: pointer;
      }

      &-row {
        display: flex;
        gap: 0.3rem;
      }

      &-icon {
        flex: 0 0 3rem;
        text-align: center;
      }

      &-color {
        flex: 1 1 auto;
      }

      &-actions {
        display: flex;
        gap: 0.4rem;
        justify-content: flex-end;
      }

      &-cancel,
      &-save {
        padding: 0.4rem 0.85rem;
        border-radius: 999px;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        transition: var(--transition);
      }

      &-cancel {
        background: transparent;
        border: 1px solid rgb(45 150 205 / 30%);
        color: var(--color-bg-dark);

        &:hover {
          background: rgb(45 150 205 / 8%);
        }
      }

      &-save {
        background: var(--color-blue);
        border: 1px solid var(--color-blue);
        color: var(--color-white);

        &:hover:not(:disabled) {
          background: var(--color-blue-hover);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }
  }

  .save-topic-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-bg-dark);
    text-align: left;
    cursor: pointer;
    transition: var(--transition);
    font-size: 0.88rem;

    &__icon {
      flex: 0 0 auto;
      font-size: 1rem;
    }

    &__name {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }

    &__check {
      flex: 0 0 auto;
      font-weight: 700;
      color: var(--color-blue);
      min-width: 1rem;
      text-align: center;
    }

    &--active {
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
      border-color: rgb(45 150 205 / 30%);

      .save-topic-option__check {
        color: var(--color-blue);
      }
    }

    &:hover,
    &:focus-visible {
      background: color-mix(in srgb, var(--color-blue) 8%, var(--color-white));
      border-color: rgb(45 150 205 / 28%);
    }
  }

  :global(html[data-theme='dark']) .save-topic-btn {
    background: rgb(45 150 205 / 15%);
    color: #7ec8e3;
    border-color: rgb(45 150 205 / 25%);
  }

  :global(html[data-theme='dark']) .save-topic-menu {
    background: #1e2d3d;
    border-color: rgb(255 255 255 / 15%);
  }

  :global(html[data-theme='dark']) .save-topic-option {
    color: #ffffff;

    &--active {
      background: rgb(45 150 205 / 18%);
      border-color: var(--color-blue);
    }

    &:hover,
    &:focus-visible {
      background: rgb(45 150 205 / 15%);
      border-color: var(--color-blue);
    }
  }

  :global(html[data-theme='dark']) .save-topic-menu__inline {
    background: rgb(255 255 255 / 4%);
    border-color: rgb(255 255 255 / 15%);

    input[type='text'],
    input[type='color'] {
      background: rgb(255 255 255 / 8%);
      border-color: rgb(255 255 255 / 20%);
      color: #ffffff;
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

  /* === Chapter Navigation (Desktop) === */
  .chapter-nav {
    position: fixed;
    bottom: 2.5rem;
    z-index: 8;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 0.85rem;
    border: 1px solid var(--color-blue);
    border-radius: 999px;
    background: var(--color-white);
    color: var(--color-bg-dark);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--box-shadow-down);
    animation: chapterNavFadeIn 0.2s ease;

    &:hover,
    &:focus-visible {
      background: var(--color-blue);
      color: var(--color-white);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 25%), var(--box-shadow-down);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }

    &--prev {
      left: 1rem;
    }

    &--next {
      right: 1rem;
    }

    &__arrow {
      display: block;
      width: 0.6rem;
      height: 0.6rem;
      border-right: 2px solid currentColor;
      border-bottom: 2px solid currentColor;
      flex-shrink: 0;
    }

    &--prev &__arrow {
      transform: rotate(135deg);
    }

    &--next &__arrow {
      transform: rotate(-45deg);
    }

    &__label {
      white-space: nowrap;
    }
  }

  @keyframes chapterNavFadeIn {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 38rem) {
    .chapter-nav {
      display: none; // On mobile use swipe gestures instead
    }
  }

  // Dark mode chapter nav
  :global(html[data-theme='dark']) .chapter-nav {
    background: var(--color-white);
    color: var(--color-bg-dark);

    &:hover,
    &:focus-visible {
      background: var(--color-blue);
      color: var(--color-white);
    }
  }
</style>
