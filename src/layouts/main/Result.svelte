<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import IconPicker from '../../components/IconPicker.svelte';
  import Modal from '../../components/Modal.svelte';
  import TtsPlayer from '../../components/TtsPlayer.svelte';
  import VerseImageModal from '../../components/VerseImageModal.svelte';
  import { HIGHLIGHT_COLORS } from '../../config/highlight-palette';
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
  import { openAuthMenu } from '../../store/authMenuStore';
  import { isAuthenticated } from '../../store/authStore';
  import { favoritesStore } from '../../store/favoritesStore';
  import { highlightsStore } from '../../store/highlightsStore';
  import { notesStore } from '../../store/notesStore';
  import { compareWithVersion, filter, getAvailableBibleVersions, getBibleVersionConfigOrDefault, immersiveMode, selectedBibleVersion, toggleImmersiveMode } from '../../store/stores';
  import { topicsContainingVerse, topicsStore } from '../../store/topicsStore';
  import { ttsState } from '../../store/ttsStore.js';

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
  // State reactivo que cambia en cada navegacion (popstate o pushState manual)
  let currentPath = '';
  if (typeof window !== 'undefined') {
    currentPath = window.location.pathname;
    window.addEventListener('popstate', () => {
      currentPath = window.location.pathname;
    });
    window.addEventListener('robibile:navigate', () => {
      currentPath = window.location.pathname;
    });
  }

  let currentVerseSeoItem = null;
  let activeVerseTarget = null;

  // Reaccionar al cambio de URL: actualizar searchForm y chapterForm
  $: if (isMounted && currentPath && Object.keys(map).length) {
    const route = parseBiblePath(currentPath);
    if (route && route.chapter) {
      const bookFromSlug = getBookIdFromSlug(map, route.bookSlug);
      if (bookFromSlug !== null && bookFromSlug !== undefined) {
        const targetBook = Number(bookFromSlug);
        const targetChapter1Indexed = route.chapter; // 1-indexed (URL)
        const targetChapter0Indexed = targetChapter1Indexed - 1; // 0-indexed (form)
        const currentBook = Array.isArray(searchForm.book) ? searchForm.book[0] : null;
        const currentChapter = Array.isArray(searchForm.chapter) ? searchForm.chapter[0] : null;
        if (currentBook !== targetBook || currentChapter !== targetChapter0Indexed) {
          // Actualizar searchForm solo si NO hay busqueda activa
          if (!searchForm.searchText) {
            searchForm = {
              ...searchForm,
              book: [targetBook],
              chapter: [targetChapter0Indexed],
              searchText: null,
            };
            filter.set(searchForm);
            chapterForm = { chapter: [targetChapter0Indexed] };
          }
        }
        // Si la URL tiene un versiculo, actualizar activeVerseTarget
        // (sin pasar por setActiveVerseTarget para evitar ciclo reactivo)
        if (route.verse && !searchForm.searchText) {
          if (
            !activeVerseTarget ||
            activeVerseTarget.book !== targetBook ||
            activeVerseTarget.chapter !== targetChapter1Indexed ||
            activeVerseTarget.index !== route.verse
          ) {
            activeVerseTarget = {
              book: targetBook,
              chapter: targetChapter1Indexed,
              index: route.verse,
            };
            // currentVerseSeoItem se setea en otro reactive que lee activeVerseTarget
          }
        }
      }
    } else {
      // URL sin capitulo (ej: "/" tras "Borrar busqueda"): limpiar versiculo activo
      if (activeVerseTarget) {
        activeVerseTarget = null;
        currentVerseSeoItem = null;
      }
      // Tambien limpiar el highlight pendiente
      if (highlightedVerseId) {
        window.clearTimeout(highlightTimer);
        highlightedVerseId = '';
      }
    }
  }

  // Compare-by-verse menu state
  let compareMenuVerseKey = null;
  let compareMenuItem = null;
  $: availableOtherVersions = getAvailableBibleVersions().filter((v) => v.value !== $selectedBibleVersion);

  // Save-to-topic menu state
  let saveToTopicVerseKey = null;
  let saveToTopicItem = null;
  let newTopicInline = { name: '', icon: 'bookmark', color: '#2E7D9B' };
  let showInlineCreate = false;

  // Note modal state
  let noteModalVerseKey = null;
  let noteModalItem = null;
  let noteText = '';
  let noteColor = '#3B82F6';
  let noteSaving = false;

  // Highlight (subrayado de color) y compartir como imagen
  let highlightMenuItem = null;
  let shareImageItem = null;

  $: topics = $topicsStore.topics;
  $: verseRefs = $topicsStore.verseRefs;

  // Calcula coordenadas del menu como position: fixed (relativas al viewport).
  // Esto evita que el menu se recorte cuando hay un ancestor con overflow:hidden
  // (caso del .result que tiene overflow:hidden para el swipe gesture).
  // anchor: el botón que abre el menu; menuWidth: ancho estimado del menu.
  const toggleCompareMenu = (item, event) => {
    if (event) event.stopPropagation();
    const abierto = compareMenuVerseKey === item.key;
    compareMenuVerseKey = abierto ? null : item.key;
    compareMenuItem = abierto ? null : item;
  };

  const closeCompareMenu = () => {
    compareMenuVerseKey = null;
    compareMenuItem = null;
  };

  // === Save to topic ===
  const toggleSaveToTopicMenu = (item, event) => {
    if (event) event.stopPropagation();
    const abierto = saveToTopicVerseKey === item.key;
    saveToTopicVerseKey = abierto ? null : item.key;
    saveToTopicItem = abierto ? null : item;
    showInlineCreate = false;
    newTopicInline = { name: '', icon: 'bookmark', color: '#2E7D9B' };
  };

  const closeSaveToTopicMenu = () => {
    saveToTopicVerseKey = null;
    saveToTopicItem = null;
    showInlineCreate = false;
  };

  // Helper: devuelve el SVG del icono de un topic
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

  // Get filled version of icon (for topic badge) - removes fill="none" so it can be colored
  const getFilledTopicIconSvg = (iconKey) => {
    const svg = TOPIC_ICONS[iconKey] || TOPIC_ICONS.bookmark;
    return svg.replace(/fill="none"\s*/g, '').replace(/stroke-width="2"\s*/g, 'stroke-width="1.5"');
  };

  const addToTopic = async (item, topicId) => {
    const ok = await topicsStore.addVerse(topicId, {
      book: item.book,
      chapter: item.chapter,
      verse: item.index,
    });
    if (ok) showToastMessage($_('app.topics.saved'));
    else showToastMessage($_('app.topics.already_in_topic'));
    closeSaveToTopicMenu();
  };

  const removeFromTopic = async (item, topicId) => {
    await topicsStore.removeVerse(topicId, {
      book: item.book,
      chapter: item.chapter,
      verse: item.index,
    });
    showToastMessage($_('app.topics.removed'));
  };

  const createTopicInline = async (item) => {
    if (!newTopicInline.name.trim()) return;
    const created = await topicsStore.create(newTopicInline);
    if (created) {
      await topicsStore.addVerse(created.id, {
        book: item.book,
        chapter: item.chapter,
        verse: item.index,
      });
      showToastMessage($_('app.topics.saved'));
      closeSaveToTopicMenu();
    }
  };

  // === Note modal ===
  const getNoteForVerse = (item) => {
    return $notesStore.find((n) => n.book === item.book && n.chapter === item.chapter && n.verse === item.index) || null;
  };

  const openNoteModal = (item) => {
    const existing = getNoteForVerse(item);
    noteText = existing?.text || '';
    noteColor = existing?.color || '#3B82F6';
    // El modal de nota es un overlay centrado (estilo auth-modal), no se
    // posiciona respecto al versículo.
    noteModalVerseKey = item.key;
    noteModalItem = item;
    // Block scroll when modal is open
    document.body.style.overflow = 'hidden';
  };

  const closeNoteModal = () => {
    noteModalVerseKey = null;
    noteModalItem = null;
    noteText = '';
    noteColor = '#3B82F6';
    // Restore scroll when modal is closed
    document.body.style.overflow = '';
  };

  const saveNoteForVerse = async (item) => {
    if (!noteText.trim()) return;
    noteSaving = true;
    try {
      const result = await notesStore.save(item.book, item.chapter, item.index, noteText.trim(), noteColor);
      if (result.ok) {
        showToastMessage($_('app.notes.saved'));
        closeNoteModal();
      }
    } finally {
      noteSaving = false;
    }
  };

  const deleteNoteForVerse = async (item) => {
    const result = await notesStore.remove(item.book, item.chapter, item.index);
    if (result.ok) {
      showToastMessage($_('app.notes.deleted'));
      closeNoteModal();
    }
  };

  // === Highlight (subrayado de color) ===
  const getHighlightForVerse = (item) =>
    $highlightsStore.find(
      (h) => h.book === item.book && h.chapter === item.chapter && h.verse === item.index,
    ) || null;

  const openHighlightMenu = (item) => {
    highlightMenuItem = item;
  };

  const closeHighlightMenu = () => {
    highlightMenuItem = null;
  };

  // Pulsar el color que ya tiene puesto lo quita: es el gesto que espera
  // cualquiera que haya usado un subrayador.
  const applyHighlight = async (item, color) => {
    const result = await highlightsStore.toggle(item.book, item.chapter, item.index, color);
    const seguiaPintado = !!getHighlightForVerse(item);
    showToastMessage(seguiaPintado ? $_('app.highlights.saved') : $_('app.highlights.removed'));
    if (!result.ok && !seguiaPintado) {
      // toggle() refresca la store igualmente, así que la UI ya está bien;
      // el error solo interesa en consola.
      console.warn('highlight toggle:', result.error);
    }
    closeHighlightMenu();
  };

  const clearHighlight = async (item) => {
    await highlightsStore.remove(item.book, item.chapter, item.index);
    showToastMessage($_('app.highlights.removed'));
    closeHighlightMenu();
  };

  // === Compartir como imagen ===
  const openShareImage = (item) => {
    shareImageItem = item;
  };

  const closeShareImage = () => {
    shareImageItem = null;
  };

  const onShareResult = (canal) => {
    if (canal === 'downloaded') showToast($_('app.share.downloaded'));
    else if (canal === 'shared') showToast($_('app.share.shared'));
    else showToast($_('app.share.failed'));
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
  $: isTtsActive = $ttsState.playing || $ttsState.paused;

  // Modo lectura automático: al arrancar entra a pantalla completa, al parar
  // vuelve a la normal. La condición es `playing || paused` (isTtsActive), no
  // solo `playing`: al pausar queremos que la pantalla se quede congelada en el
  // versículo, no que salga del modo lectura.
  let prevTtsActive = false;
  $: {
    const active = isTtsActive;
    if (active && !prevTtsActive && !$immersiveMode) {
      toggleImmersiveMode();
    }
    if (!active && prevTtsActive && $immersiveMode) {
      toggleImmersiveMode();
    }
    prevTtsActive = active;
  }

  // Auto-scroll: cuando cambia el versiculo activo, hacer scroll a el
  $: if ($ttsState.verseKey && ($ttsState.playing || $ttsState.paused)) {
    const verseId = `verse-${$ttsState.currentBook}-${$ttsState.currentChapter}-${$ttsState.currentVerse}`;
    const el = document.getElementById(verseId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Trackea el versiculo de la URL para evitar re-disparar el timer
  let lastUrlVerse = '';
  // Highlight directo: cuando la URL tiene un versiculo especifico (navegacion por referencia)
  // NO entra en modo lectura automaticamente: el usuario quiere gestionar
  // el modo lectura manualmente (poder volver a buscar sin tener que salir).
  // Solo disparamos el timer cuando la URL cambia a un versiculo NUEVO.
  $: if (isMounted && Object.keys(map).length && bible && currentPath) {
    const bibleRoute = parseBiblePath(currentPath);
    if (bibleRoute && bibleRoute.chapter && bibleRoute.verse) {
      const bookId = getBookIdFromSlug(map, bibleRoute.bookSlug);
      if (bookId !== null && bookId !== undefined && bookId >= 0) {
        const verseId = `verse-${bookId}-${bibleRoute.chapter}-${bibleRoute.verse}`;
        if (lastUrlVerse !== verseId) {
          lastUrlVerse = verseId;
          highlightedVerseId = verseId;
          window.clearTimeout(highlightTimer);
          highlightTimer = window.setTimeout(() => {
            highlightedVerseId = '';
          }, 1500);
        }
        // Scroll al versiculo despues de render
        setTimeout(() => {
          const el = document.getElementById(verseId);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  }

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
        window.dispatchEvent(new CustomEvent('robibile:navigate'));
      }
      return;
    }

    if (selectedBook === null || selectedBook === undefined) {
      if (window.location.pathname.startsWith('/biblia/') || window.location.pathname.startsWith('/verse/')) {
        window.history.replaceState(null, '', '/');
        window.dispatchEvent(new CustomEvent('robibile:navigate'));
      }
      return;
    }

    // Si la URL actual ya tiene un versiculo especifico y coincide con el
    // capitulo actual, preservarlo. Asi no reescribimos /biblia/X/Y/Z/W a
    // /biblia/X/Y al navegar por referencia.
    const currentRoute = parseBiblePath(window.location.pathname);
    if (currentRoute && currentRoute.chapter && currentRoute.verse) {
      const sameChapter = currentRoute.chapter === selectedChapterLabel;
      if (sameChapter) {
        // El capitulo coincide: dejar la URL tal cual (ya tiene el versiculo)
        return;
      }
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
      window.dispatchEvent(new CustomEvent('robibile:navigate'));
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
    }, 1500);
  };

  const navigateToVerse = async (item) => {
    const verseId = getVerseId(item);
    const path = getVerseSharePath(item);
    setActiveVerseTarget(item);
    filter.set({
      ...searchForm,
      searchText: null,
      testament: 'all',
      book: [item.book],
      chapter: [item.chapter - 1],
    });
    window.history.replaceState(null, '', path);
    // Dispatch para que el listener de currentPath se entere del cambio
    // (replaceState no dispara popstate). Tambien pasamos el path para que
    // el Sidebar pueda limpiar su searchForm al navegar a un versiculo.
    window.dispatchEvent(new CustomEvent('robibile:navigate', { detail: { pathname: path } }));
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
  });

  onDestroy(() => {
    window.clearTimeout(toastTimer);
    window.clearTimeout(highlightTimer);
    window.clearTimeout(scrollTimer);
    if (resultElement) {
      resultElement.removeEventListener('touchstart', onTouchStart);
      resultElement.removeEventListener('touchmove', onTouchMove);
      resultElement.removeEventListener('touchend', onTouchEnd);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', () => {});
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

  // Computed: are we in TTS karaoke mode for a given verse?
  function isVerseTtsActive(verseKey) {
    return $ttsState.verseKey === verseKey && ($ttsState.playing || $ttsState.paused);
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
  class:result--immersive={isImmersive}
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
    {@const verseTopics = (() => { void $topicsStore; return topicsContainingVerse(item.book, item.chapter, item.index); })()}
    {@const primaryTopic = verseTopics[0]}
    {@const hasNote = !!$notesStore.find((n) => n.book === item.book && n.chapter === item.chapter && n.verse === item.index)}
    {@const verseHighlight = $highlightsStore.find((h) => h.book === item.book && h.chapter === item.chapter && h.verse === item.index)}
    <div
      class:verse--tts-active={isVerseTtsActive(item.key)}
      class:verse--user-highlight={verseHighlight}
      class:highlight-verse={isVerseTtsActive(item.key) || highlightedVerseId === getVerseId(item)}
      class="verse"
      style={verseHighlight ? `--highlight-color: ${verseHighlight.color};` : ''}
      id={getVerseId(item)}
      tabindex="-1"
    >
      <div>
        <span class="verse-index">{item.index}.</span>
        {#if isVerseTtsActive(item.key)}
          <!-- TTS active: highlight whole verse with different background -->
          <span class="tts-verse-text">{item.text}</span>
        {:else}
          <!-- Normal mode: search keyword highlighting -->
          {#each getMarkedParts(item.text, keywords) as part, index (`${item.key}-${index}`)}
            {#if part.marked}
              <span class="marked-key">{part.text}</span>
            {:else}
              {part.text}
            {/if}
          {/each}
        {/if}
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
        <button
          type="button"
          class="icon-btn share-image-btn"
          title={$_('app.share.open_action')}
          aria-label={$_('app.share.open_action_reference', {
            reference: `${map[item.book]} ${item.chapter}:${item.index}`,
          })}
          aria-haspopup="dialog"
          on:click={(e) => { e.stopPropagation(); openShareImage(item); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49"/>
          </svg>
        </button>
        <button
          type="button"
          class="icon-btn favorite-btn icon-btn--marked-favorite"
          class:icon-btn--marked={$favoritesStore.some((f) => f.book === item.book && f.chapter === item.chapter && f.verse === item.index)}
          class:icon-btn--disabled={!$isAuthenticated}
          title={$isAuthenticated
            ? ($favoritesStore.some((f) => f.book === item.book && f.chapter === item.chapter && f.verse === item.index)
                ? $_('app.result.actions.unfavorite')
                : $_('app.result.actions.favorite'))
            : $_('app.result.actions.favorite_login_required')}
          aria-label={$isAuthenticated
            ? ($favoritesStore.some((f) => f.book === item.book && f.chapter === item.chapter && f.verse === item.index)
                ? $_('app.result.actions.unfavorite_reference', { reference: `${map[item.book]} ${item.chapter}:${item.index}` })
                : $_('app.result.actions.favorite_reference', { reference: `${map[item.book]} ${item.chapter}:${item.index}` }))
            : $_('app.result.actions.favorite_login_required')}
          disabled={!$isAuthenticated}
          on:click={() => $isAuthenticated && favoritesStore.toggle(item.book, item.chapter, item.index)}
        >
          <svg viewBox="0 0 24 24" fill={$favoritesStore.some((f) => f.book === item.book && f.chapter === item.chapter && f.verse === item.index) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <button
          type="button"
          class="icon-btn highlight-btn icon-btn--marked-highlight"
          class:icon-btn--marked={verseHighlight}
          class:icon-btn--disabled={!$isAuthenticated}
          style={verseHighlight ? `--highlight-color: ${verseHighlight.color};` : ''}
          title={$isAuthenticated
            ? (verseHighlight ? $_('app.highlights.change') : $_('app.highlights.add'))
            : $_('app.result.actions.highlight_login_required')}
          aria-label={$isAuthenticated
            ? (verseHighlight
                ? $_('app.highlights.change_reference', { reference: `${map[item.book]} ${item.chapter}:${item.index}` })
                : $_('app.highlights.add_reference', { reference: `${map[item.book]} ${item.chapter}:${item.index}` }))
            : $_('app.result.actions.highlight_login_required')}
          aria-haspopup={$isAuthenticated ? 'dialog' : undefined}
          aria-expanded={highlightMenuItem?.key === item.key}
          on:click={(e) => {
            e.stopPropagation();
            if (!$isAuthenticated) {
              openAuthMenu();
              return;
            }
            openHighlightMenu(item);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 3l6 6-9.5 9.5H5.5V12.5z"/>
            <path d="M3 21h18"/>
          </svg>
        </button>
        {#if availableOtherVersions.length > 0}
          <span class="verse-compare">
            <button
              type="button"
              class="icon-btn compare-link-btn"
              title={$_('app.result.actions.compare_with')}
              aria-label={$_('app.result.actions.compare_with', {
                reference: `${map[item.book]} ${item.chapter}:${item.index}`,
              })}
              on:click={(e) => toggleCompareMenu(item, e)}
              aria-haspopup="listbox"
              aria-expanded={compareMenuVerseKey === item.key}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17 3l4 4-4 4M21 7H8M7 21l-4-4 4-4M3 17h13"/>
              </svg>
            </button>
          </span>
        {/if}

        <!-- Save to topic -->
        <span class="verse-save-topic">
          <button
            type="button"
            class="icon-btn save-topic-btn icon-btn--marked-topic"
            class:icon-btn--marked={primaryTopic}
            style={primaryTopic ? `--topic-color: ${primaryTopic.color};` : ''}
            class:icon-btn--disabled={!$isAuthenticated}
            title={$isAuthenticated ? $_('app.topics.add_verse_to_topic') : $_('app.result.actions.topics_login_required')}
            aria-label={$isAuthenticated ? $_('app.topics.add_verse_to_topic') : $_('app.result.actions.topics_login_required')}
            on:click={(e) => {
              e.stopPropagation();
              if (!$isAuthenticated) {
                openAuthMenu();
                return;
              }
              toggleSaveToTopicMenu(item, e);
            }}
            aria-haspopup="listbox"
            aria-expanded={saveToTopicVerseKey === item.key}
          >
            {#if primaryTopic}
              <svg viewBox="0 0 24 24" aria-hidden="true" style="color: {primaryTopic.color};">
                {@html getFilledTopicIconSvg(primaryTopic.icon)}
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
              </svg>
            {/if}
          </button>
        </span>

        <!-- Note -->
        <span class="verse-note">
          <button
            type="button"
            class="icon-btn note-btn icon-btn--marked-note"
            class:icon-btn--marked={hasNote}
            class:icon-btn--disabled={!$isAuthenticated}
            title={$isAuthenticated
              ? (hasNote ? $_('app.notes.edit_note') : $_('app.notes.add_note'))
              : $_('app.result.actions.note_login_required')}
            aria-label={$isAuthenticated
              ? (hasNote ? $_('app.notes.edit_note') : $_('app.notes.add_note'))
              : $_('app.result.actions.note_login_required')}
            aria-haspopup={$isAuthenticated ? 'dialog' : undefined}
            aria-expanded={noteModalVerseKey === item.key}
            on:click={(e) => {
              e.stopPropagation();
              if (!$isAuthenticated) {
                openAuthMenu();
                return;
              }
              if (noteModalVerseKey === item.key) closeNoteModal();
              else openNoteModal(item);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </span>
      </div>
    </div>
    <div class="verse-divider" aria-hidden="true"></div>
  {/each}
  </div>
</div>


<!-- ── Diálogos del versículo ──────────────────────────────────────────────
     Los tres usan la misma Modal: antes eran popups anclados al botón, que
     en móvil quedaban recortados contra el borde de la pantalla. -->

<Modal
  open={!!compareMenuItem}
  title={$_('app.result.actions.compare_with')}
  size="sm"
  onClose={closeCompareMenu}
>
  <div class="dialog-list" role="listbox">
      {#each availableOtherVersions as opt (opt.value)}
        <button
          type="button"
          class="verse-compare-option"
          role="option"
          aria-selected="false"
          on:click={(e) => { e.stopPropagation(); compareVerseWith(compareMenuItem, opt.value); }}
        >
          <span class="verse-compare-option__name">{opt.bibleName}</span>
          <span class="verse-compare-option__locale">{opt.label}</span>
        </button>
      {/each}
  </div>
</Modal>

<Modal
  open={!!saveToTopicItem}
  eyebrow={$_('app.topics.add_to_existing')}
  title={saveToTopicItem ? `${map[saveToTopicItem.book]} ${saveToTopicItem.chapter}:${saveToTopicItem.index}` : ''}
  size="md"
  onClose={closeSaveToTopicMenu}
>
    {#if topics.length === 0}
      <p class="save-topic-menu__empty">{$_('app.topics.create_first_topic')}</p>
    {:else}
      <ul class="save-topic-menu__list">
        {#each topics as topic (topic.id)}
          {@const inTopic = isVerseInTopic(topic.id, saveToTopicItem)}
          <li>
            <button
              type="button"
              class="save-topic-option"
              class:save-topic-option--active={inTopic}
              on:click={() => inTopic ? removeFromTopic(saveToTopicItem, topic.id) : addToTopic(saveToTopicItem, topic.id)}
            >
              <span class="save-topic-option__icon" aria-hidden="true">{@html getTopicIconSvg(topic.icon)}</span>
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
          <div role="presentation" on:click|stopPropagation on:mousedown|stopPropagation>
            <IconPicker
              value={newTopicInline.icon}
              onChange={(icon) => { newTopicInline = { ...newTopicInline, icon }; }}
            />
          </div>
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
              newTopicInline = { name: '', icon: 'bookmark', color: '#2E7D9B' };
            }}
          >
            {$_('app.topics.cancel')}
          </button>
          <button
            type="button"
            class="save-topic-menu__inline-save"
            on:click={(e) => { e.stopPropagation(); createTopicInline(saveToTopicItem); }}
            disabled={!newTopicInline.name.trim()}
          >
            {$_('app.topics.save')}
          </button>
        </div>
      </div>
    {/if}
</Modal>

<!-- Subrayado: paleta de colores del versículo -->
{#if highlightMenuItem}
  {@const actual = getHighlightForVerse(highlightMenuItem)}
  <Modal
    open={true}
    eyebrow={$_('app.highlights.eyebrow')}
    title={`${map[highlightMenuItem.book]} ${highlightMenuItem.chapter}:${highlightMenuItem.index}`}
    size="sm"
    fitContent
    onClose={closeHighlightMenu}
  >
    <div class="highlight-palette" role="group" aria-label={$_('app.highlights.eyebrow')}>
      {#each HIGHLIGHT_COLORS as color (color.key)}
        {@const activo = actual && actual.color?.toUpperCase() === color.hex.toUpperCase()}
        <button
          type="button"
          class="highlight-swatch"
          class:highlight-swatch--active={activo}
          style={`--swatch-color: ${color.hex};`}
          title={$_(`app.highlights.colors.${color.key}`)}
          aria-label={$_(`app.highlights.colors.${color.key}`)}
          aria-pressed={!!activo}
          on:click={() => applyHighlight(highlightMenuItem, color.hex)}
        >
          {#if activo}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          {/if}
        </button>
      {/each}
    </div>
    {#if actual}
      <button type="button" class="highlight-clear" on:click={() => clearHighlight(highlightMenuItem)}>
        {$_('app.highlights.clear')}
      </button>
    {/if}
  </Modal>
{/if}

<!-- Compartir el versículo como imagen -->
{#if shareImageItem}
  <VerseImageModal
    open={true}
    text={shareImageItem.text}
    reference={`${map[shareImageItem.book]} ${shareImageItem.chapter}:${shareImageItem.index}`}
    versionName={bibleVersionConfig?.bibleName || ''}
    onClose={closeShareImage}
    onResult={onShareResult}
  />
{/if}

<!-- Note modal: rendered at top level (not inside .verse) to escape stacking context -->
{#if noteModalVerseKey && noteModalItem}
  <Modal
    open={true}
    eyebrow={$_('app.notes.modal_title')}
    title={`${map[noteModalItem.book]} ${noteModalItem.chapter}:${noteModalItem.index}`}
    size="md"
    onClose={closeNoteModal}
  >
    <textarea
      class="note-modal__textarea"
      bind:value={noteText}
      placeholder={$_('app.notes.placeholder')}
      maxlength="500"
      rows="12"
      autofocus
      on:click|stopPropagation
      on:mousedown|stopPropagation
    ></textarea>
    <div class="note-modal__footer">
      <div class="note-modal__color-row">
        <label class="note-modal__color-label" for="note-color-{noteModalItem.key}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="14" height="14">
            <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/>
            <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/>
            <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/>
            <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
          </svg>
        </label>
        <input
          type="color"
          id="note-color-{noteModalItem.key}"
          bind:value={noteColor}
          class="note-modal__color-picker"
          title={$_('app.notes.color')}
          on:click|stopPropagation
          on:mousedown|stopPropagation
        />
      </div>
      <div class="note-modal__actions">
        {#if $notesStore.find((n) => n.book === noteModalItem.book && n.chapter === noteModalItem.chapter && n.verse === noteModalItem.index)}
          <button
            type="button"
            class="note-modal__delete"
            on:click={(e) => { e.stopPropagation(); deleteNoteForVerse(noteModalItem); }}
          >
            {$_('app.notes.delete')}
          </button>
        {/if}
        <button
          type="button"
          class="note-modal__cancel"
          on:click={(e) => { e.stopPropagation(); closeNoteModal(); }}
        >
          {$_('app.notes.cancel')}
        </button>
        <button
          type="button"
          class="note-modal__save"
          disabled={!noteText.trim() || noteSaving}
          on:click={(e) => { e.stopPropagation(); saveNoteForVerse(noteModalItem); }}
        >
          {noteSaving ? '...' : $_('app.notes.save')}
        </button>
      </div>
    </div>
  </Modal>
{/if}

{#if toastMessage}
  <div class="toast" role="status" aria-live="polite">{toastMessage}</div>
{/if}

<button
  type="button"
  class="scroll-top-button"
  class:scroll-top-button--tts-active={isTtsActive}
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

<!-- Reproductor de lectura con música (flotante).
     Recibe la misma lista que se está pintando, así que lee exactamente lo que
     hay en pantalla: el capítulo actual o los resultados de la búsqueda. -->
<TtsPlayer playlist={result} {map} />

<style lang="scss">
  // Push scroll-to-top button up when TTS mini-player is visible
  :global(.scroll-top-button.scroll-top-button--tts-active) {
    bottom: 3.5rem !important;
  }

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
      background-color: color-mix(in srgb, var(--color-accent) 11%, transparent);
      box-shadow: inset 0.25rem 0 0 var(--color-blue);
    }

    // ── Subrayado del usuario ────────────────────────────────────────────
    // El color llega inline como --highlight-color, igual que el del tema en
    // el botón del índice. Se mezcla con el fondo en vez de aplicarse en
    // crudo: así el mismo hex vale para claro y oscuro sin duplicar reglas.
    &--user-highlight {
      background-color: color-mix(in srgb, var(--highlight-color) 26%, transparent);
      box-shadow: inset 0.25rem 0 0 var(--highlight-color);
    }

    p {
      margin: 0.5rem 0;
    }

    &-index {
      font-size: 14px;
      font-weight: 600;
    }
  }

  // El estado de lectura manda sobre el subrayado del usuario. Sin esto ganaba
  // el subrayado: `.highlight-verse` vive en global.css con un solo selector de
  // clase, y el scoping de Svelte le añade una clase más a `.verse--user-highlight`.
  // Mientras el TTS va por un versículo hay que ver dónde va, no de qué color
  // está pintado; al terminar vuelve a verse su color.
  .verse--user-highlight:global(.highlight-verse) {
    background-color: color-mix(in srgb, var(--color-success) 12%, transparent);
    box-shadow: none;
  }

  :global(html[data-theme='dark']) .verse--user-highlight:global(.highlight-verse) {
    background-color: color-mix(in srgb, var(--color-success) 18%, transparent);
  }

  // === PALETA DE SUBRAYADO ===
  .highlight-palette {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    justify-content: center;
    padding: 0.35rem 0 0.75rem;
  }

  .highlight-swatch {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border: 2px solid transparent;
    border-radius: var(--radius-pill);
    background: var(--swatch-color);
    color: #ffffff;
    cursor: pointer;
    transition: var(--transition), transform 0.15s ease;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 10%), var(--box-shadow-up);

    svg {
      width: 1.1rem;
      height: 1.1rem;
      filter: drop-shadow(0 1px 1px rgb(0 0 0 / 35%));
    }

    &:hover {
      transform: translateY(-2px);
    }

    &--active {
      border-color: var(--color-ink);
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 10%), 0 0 0 3px color-mix(in srgb, var(--swatch-color) 40%, transparent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  .highlight-clear {
    display: block;
    width: 100%;
    padding: 0.55rem 1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);

    &:hover {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  // Verse index in immersive mode: blue color from the palette
  .result--immersive .verse-index {
    color: var(--color-link, #0064c8);
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
    border: 1px solid color-mix(in srgb, var(--color-accent) 24%, transparent);
    border-radius: 0.28rem;
    background: color-mix(in srgb, var(--color-accent) 7%, transparent);
    color: var(--color-link);
    cursor: pointer;
    transition: var(--transition);
    box-shadow: 0 1px 3px rgb(0 0 0 / 10%);

    svg {
      width: 0.85rem;
      height: 0.85rem;
    }

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-accent) 18%, transparent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 14%, transparent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }

    // ── Estado "marcado" ──────────────────────────────────────────────────
    // Un único tratamiento para los cuatro iconos del versículo. Lo que
    // cambia entre ellos es solo `--marked-color`, que cada modificador
    // inyecta: así el usuario reconoce "esto está marcado" por la forma, y
    // qué tipo de marca es por el color.
    &--marked {
      color: var(--marked-color);
      border-color: var(--marked-color);
      background: color-mix(in srgb, var(--marked-color) 14%, var(--color-surface));
      box-shadow: 0 1px 3px color-mix(in srgb, var(--marked-color) 30%, transparent);

      &:hover,
      &:focus-visible {
        border-color: var(--marked-color);
        background: color-mix(in srgb, var(--marked-color) 24%, var(--color-surface));
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--marked-color) 25%, transparent);
      }

      &:focus-visible {
        outline-color: var(--marked-color);
      }
    }

    // Color por tipo de marca
    &--marked-favorite { --marked-color: var(--color-marked-favorite); }
    &--marked-note { --marked-color: var(--color-marked-note); }
    // El subrayado usa su propio color, que llega inline como --highlight-color.
    &--marked-highlight { --marked-color: var(--highlight-color, var(--color-accent)); }
    // El índice temático usa el color del tema, que llega inline como
    // --topic-color desde la plantilla.
    &--marked-topic { --marked-color: var(--topic-color, var(--color-accent)); }
  }

  // === COMPARE PER VERSE ===
  .verse-compare {
    position: relative;
    display: inline-flex;
  }

  .compare-link-btn {
    // Siempre visible con box-shadow consistente
    opacity: 1;
    box-shadow: 0 1px 3px rgb(0 0 0 / 10%);

    &:hover,
    &:focus-visible {
      opacity: 1;
    }

    &:focus-visible {
      opacity: 1;
    }
  }

  .compare-link-btn[aria-expanded="true"] {
    opacity: 1;
  }

  .verse-compare-menu {
    // position: fixed para escapar de cualquier ancestor con overflow:hidden
    // (caso del .result, que oculta el overflow durante el swipe gesture).
    // Las coordenadas se calculan dinámicamente en JS (compareMenuPosition)
    // basándose en el bounding rect del botón que abre el menu.
    position: fixed;
    z-index: 50;
    display: grid;
    gap: 0.25rem;
    width: 14rem;
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
      border-color: color-mix(in srgb, var(--color-accent) 34%, transparent);
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
    }
  }

  :global(html[data-theme='dark']) .verse-compare-menu {
    background: var(--color-surface);
    border-color: rgb(255 255 255 / 15%);
  }

  :global(html[data-theme='dark']) .verse-compare-option {
    color: #ffffff;

    &__locale {
      color: rgb(255 255 255 / 50%);
    }

    &:hover,
    &:focus-visible {
      background: color-mix(in srgb, var(--color-accent) 18%, transparent);
      border-color: var(--color-blue);
    }
  }

  :global(html[data-theme='dark']) .compare-link-btn {
    background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    color: var(--color-accent-soft);
    border-color: color-mix(in srgb, var(--color-accent) 25%, transparent);
  }

  // === SAVE TO TOPIC ===
  .verse-save-topic {
    position: relative;
    display: inline-flex;
  }

  .save-topic-btn {
    // Siempre visible, con box-shadow consistente
    opacity: 1;
    box-shadow: 0 1px 3px rgb(0 0 0 / 10%);

    &:hover,
    &:focus-visible {
      opacity: 1;
    }

    &:focus-visible {
      opacity: 1;
    }

  }

  .save-topic-btn[aria-expanded="true"] {
    opacity: 1;
  }

  .save-topic-menu {
    // position: fixed (igual que .verse-compare-menu) para escapar de
    // cualquier ancestor con overflow:hidden.
    // Auth-modal panel style: backdrop blur, rounded corners, strong shadow
    position: fixed;
    z-index: 55;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: min(20rem, calc(100vw - 2rem));
    max-height: min(70vh, 32rem);
    overflow-y: auto;
    padding: 0.55rem;
    border: 1px solid rgb(63 88 103 / 18%);
    border-radius: 0.6rem;
    background: var(--color-white);
    box-shadow: var(--box-shadow-down);

    // Mobile: full-screen centered modal (like note modal)
    @media (max-width: 480px) {
      position: fixed;
      inset: 0;
      width: 95%;
      height: 90dvh;
      max-width: none;
      max-height: none;
      margin: auto;
      z-index: 110;
      border-radius: 0.5rem;
      overflow-y: auto;
      // Override inline top/right positioning on mobile
      top: auto !important;
      right: auto !important;
      // Better mobile spacing
      padding: 1rem;
      gap: 0.5rem;
      // Center form vertically when inline form is shown
      justify-content: center;
    }
  }

  .save-topic-backdrop {
    display: none;

    @media (max-width: 480px) {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 105;
      background: rgb(0 0 0 / 50%);
      backdrop-filter: blur(3px);
    }
  }

  .save-topic-menu {
    // ── Elementos internos ──────────────────────────────────────────
    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0 0.2rem 0.25rem;

      @media (max-width: 480px) {
        padding: 0 0 0.5rem;
        border-bottom: 1px solid rgb(63 88 103 / 18%);
        margin-bottom: 0.25rem;
      }
    }

    &__label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-blue);
      padding: 0.25rem 0.4rem 0;

      @media (max-width: 480px) {
        font-size: 1rem;
        font-weight: 700;
        padding: 0;
        text-transform: none;
        letter-spacing: 0;
      }
    }

    &__close {
      display: none;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: 1px solid rgb(63 88 103 / 20%);
      border-radius: 0.4rem;
      background: transparent;
      color: var(--color-bg-dark);
      cursor: pointer;
      transition: background 0.12s;

      @media (max-width: 480px) {
        display: grid;
      }

      &:hover,
      &:focus-visible {
        background: color-mix(in srgb, var(--color-accent) 10%, transparent);
        border-color: var(--color-blue);
        outline: none;
      }
    }

    &__empty {
      margin: 0;
      padding: 0.75rem 0.4rem;
      font-size: 0.85rem;
      color: color-mix(in srgb, var(--color-bg-dark) 60%, transparent);
    }

    &__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;

      @media (max-width: 480px) {
        gap: 0.25rem;
      }
    }

    &__divider {
      height: 1px;
      margin: 0.3rem 0;
      background: color-mix(in srgb, var(--color-accent) 18%, transparent);

      @media (max-width: 480px) {
        margin: 0.5rem 0;
      }
    }

    &__add-new {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      width: 100%;
      padding: 0.5rem 0.65rem;
      border: 1px dashed color-mix(in srgb, var(--color-accent) 38%, transparent);
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
      gap: 0.5rem;
      padding: 0.5rem;
      border: 1px solid color-mix(in srgb, var(--color-accent) 22%, transparent);
      border-radius: 0.35rem;
      background: color-mix(in srgb, var(--color-accent) 4%, transparent);

      @media (max-width: 480px) {
        width: 100%;
        max-width: 300px;
        margin: auto;
        gap: 0.75rem;
        padding: 1.5rem 1rem;
        border-radius: 0.5rem;
        background: var(--color-white);
        border: 1px solid rgb(63 88 103 / 20%);
        box-shadow: 0 4px 12px rgb(0 0 0 / 15%);

        input[type='text'] {
          width: 100%;
        }

        &-row {
          width: 100%;
        }

        &-actions {
          width: 100%;
        }
      }

      input[type='text'],
      input[type='color'] {
        width: 100%;
        padding: 0.4rem 0.55rem;
        border: 1px solid color-mix(in srgb, var(--color-accent) 28%, transparent);
        border-radius: 0.25rem;
        background: var(--color-white);
        color: var(--color-bg-dark);
        font-size: 0.88rem;
        transition: var(--transition);

        &:focus {
          outline: none;
          border-color: var(--color-blue);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 16%, transparent);
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
        border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
        color: var(--color-bg-dark);

        &:hover {
          background: color-mix(in srgb, var(--color-accent) 8%, transparent);
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

    @media (max-width: 480px) {
      padding: 0.6rem 0.75rem;
      font-size: 1rem;
      border-radius: 0.35rem;
    }

    &__icon {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: 1.4rem;
      height: 1.4rem;

      @media (max-width: 480px) {
        width: 1.8rem;
        height: 1.8rem;
      }

      :global(svg) {
        width: 0.85rem;
        height: 0.85rem;

        @media (max-width: 480px) {
          width: 1.1rem;
          height: 1.1rem;
        }
      }
    }

    &__name {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;

      @media (max-width: 480px) {
        font-size: 1rem;
      }
    }

    &__check {
      flex: 0 0 auto;
      font-weight: 700;
      color: var(--color-blue);
      min-width: 1.2rem;
      text-align: center;
      font-size: 1.1rem;

      @media (max-width: 480px) {
        min-width: 1.5rem;
        font-size: 1.3rem;
      }
    }

    &--active {
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
      border-color: color-mix(in srgb, var(--color-accent) 30%, transparent);

      .save-topic-option__check {
        color: var(--color-blue);
      }
    }

    &:hover,
    &:focus-visible {
      background: color-mix(in srgb, var(--color-blue) 8%, var(--color-white));
      border-color: color-mix(in srgb, var(--color-accent) 28%, transparent);
    }
  }

  :global(html[data-theme='dark']) .save-topic-btn {
    background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    color: var(--color-accent-soft);
    border-color: color-mix(in srgb, var(--color-accent) 25%, transparent);
  }

  // === FAVORITE BUTTON ===
  // Siempre visible (es la acción primaria). Estado activo = estrella rellena en amarillo.
  .favorite-btn {
    opacity: 1;

    svg {
      transition: transform 0.15s ease, fill 0.15s ease;
    }

    &:hover:not(:disabled) svg {
      transform: scale(1.15);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  :global(html[data-theme='dark']) .favorite-btn {
    color: #ffffff;
    border-color: rgb(255 255 255 / 14%);

  }

  :global(html[data-theme='dark']) .save-topic-menu {
    background: var(--color-surface);
    border-color: rgb(255 255 255 / 15%);
  }

  :global(html[data-theme='dark']) .save-topic-menu__header {
    border-color: rgb(255 255 255 / 15%);
  }

  :global(html[data-theme='dark']) .save-topic-menu__label {
    color: var(--color-accent-soft);
  }

  :global(html[data-theme='dark']) .save-topic-menu__close {
    color: #ffffff;
    border-color: rgb(255 255 255 / 20%);

    &:hover,
    &:focus-visible {
      background: rgb(255 255 255 / 10%);
      border-color: rgb(255 255 255 / 30%);
    }
  }

  :global(html[data-theme='dark']) .save-topic-option {
    color: #ffffff;

    &--active {
      background: color-mix(in srgb, var(--color-accent) 18%, transparent);
      border-color: var(--color-blue);
    }

    &:hover,
    &:focus-visible {
      background: color-mix(in srgb, var(--color-accent) 15%, transparent);
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
    scrollbar-color: color-mix(in srgb, var(--color-accent) 45%, transparent) transparent;

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
      border: 1px solid color-mix(in srgb, var(--color-accent) 34%, transparent);
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
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 12%, transparent);
    }

    input[type='radio']:checked + label {
      border-color: var(--color-blue-hover);
      background: var(--color-blue);
      color: var(--color-on-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
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
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
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
    background-color: color-mix(in srgb, var(--color-accent) 14%, transparent);
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
    color: color-mix(in srgb, var(--color-accent) 30%, transparent);
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
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 25%, transparent), var(--box-shadow-down);
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

  /* === Note button === */
  .note-btn {
    opacity: 1;
    box-shadow: 0 1px 3px rgb(0 0 0 / 10%);

  }

  .note-btn[aria-expanded="true"] {
    opacity: 1;
  }

  /* === Note modal — centered overlay (auth-modal style) === */
  .note-overlay {
    position: fixed;
    inset: 0;
    z-index: 105;
    background: rgb(0 0 0 / 50%);
    backdrop-filter: blur(3px);
  }

  .note-modal {
    // Outer: fixed overlay with flex centering (like auth-modal)
    position: fixed;
    inset: 0;
    z-index: 110;
    display: flex;
    align-items: center;
    justify-content: center;

    // Inner panel (like auth-modal__panel) — full screen on mobile, centered on desktop
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    width: 95%;
    max-width: 26rem;
    max-height: 85dvh;
    margin: auto;
    overflow: hidden;
    padding: 1.25rem;
    background: var(--color-white);
    border-radius: 0.6rem;
    box-shadow: var(--box-shadow-down);
    color: var(--color-bg-dark);

    @media (max-width: 480px) {
      width: 95%;
      max-width: none;
      max-height: 85dvh;
      padding: 1rem;
      gap: 0.65rem;
      border-radius: 0.5rem;
    }

    &__eyebrow {
      margin: 0;
      color: var(--color-blue);
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    &__title {
      margin: 0;
      font-size: 1.35rem;
      line-height: 1.2;
      font-weight: 700;
    }

    &__close {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border: 1px solid rgb(63 88 103 / 20%);
      border-radius: 0.4rem;
      background: transparent;
      color: var(--color-bg-dark);
      cursor: pointer;
      transition: background 0.12s;

      &:hover,
      &:focus-visible {
        background: color-mix(in srgb, var(--color-accent) 10%, transparent);
        border-color: var(--color-blue);
        outline: none;
      }
    }

    &__textarea {
      width: 100%;
      flex: 1;
      resize: none;
      min-height: 0;
      border: 1px solid rgb(63 88 103 / 20%);
      border-radius: 0.5rem;
      padding: 0.75rem;
      font-size: 0.9rem;
      font-family: inherit;
      color: var(--color-bg-dark);
      background: var(--color-bg-light);
      line-height: 1.6;
      outline: none;
      transition: border-color 0.15s;

      &:focus {
        border-color: var(--color-blue);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 16%, transparent);
      }

      &::placeholder {
        color: color-mix(in srgb, var(--color-bg-dark) 45%, transparent);
      }
    }

    &__footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.4rem;
    }

    &__color-row {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }

    &__color-label {
      color: color-mix(in srgb, var(--color-bg-dark) 50%, transparent);
      display: flex;
      align-items: center;
      cursor: default;
    }

    &__color-picker {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid rgb(63 88 103 / 22%);
      border-radius: 0.35rem;
      cursor: pointer;
      background: none;

      &::-webkit-color-swatch-wrapper {
        padding: 2px;
      }

      &::-webkit-color-swatch {
        border: none;
        border-radius: 0.2rem;
      }
    }

    &__actions {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }

    &__delete {
      font-size: 0.75rem;
      color: #ef4444;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.2rem 0.3rem;
      border-radius: 0.3rem;
      transition: background 0.15s;

      &:hover {
        background: rgb(239 68 68 / 0.1);
      }
    }

    &__cancel {
      font-size: 0.75rem;
      color: var(--color-bg-dark);
      background: transparent;
      border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
      border-radius: 999px;
      cursor: pointer;
      padding: 0.3rem 0.7rem;
      transition: background 0.15s;

      &:hover {
        background: color-mix(in srgb, var(--color-accent) 8%, transparent);
      }
    }

    &__save {
      font-size: 0.75rem;
      font-weight: 700;
      color: #ffffff;
      background: var(--color-blue);
      border: none;
      border-radius: 999px;
      cursor: pointer;
      padding: 0.3rem 0.85rem;
      transition: background 0.15s;

      &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      &:not(:disabled):hover {
        background: var(--color-blue-hover);
      }
    }
  }

  :global(html[data-theme='dark']) .icon-btn {
    background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    color: var(--color-accent-soft);
    border-color: color-mix(in srgb, var(--color-accent) 25%, transparent);
  }

  // Dark mode note modal — centered overlay (auth-modal style)
  :global(html[data-theme='dark']) .note-overlay {
    background: rgb(0 0 0 / 60%);
  }

  :global(html[data-theme='dark']) .note-modal {
    background: var(--color-surface);
    border-color: rgb(255 255 255 / 15%);
    color: #ffffff;

    &__eyebrow {
      color: var(--color-accent-soft);
    }

    &__title {
      color: #ffffff;
    }

    &__close {
      border-color: rgb(255 255 255 / 18%);
      color: #ffffff;

      &:hover,
      &:focus-visible {
        background: color-mix(in srgb, var(--color-accent) 18%, transparent);
        border-color: var(--color-accent-soft);
      }
    }

    &__textarea {
      background: rgb(255 255 255 / 8%);
      border-color: rgb(255 255 255 / 20%);
      color: #ffffff;

      &:focus {
        border-color: var(--color-blue);
        box-shadow: 0 0 0 2px rgb(77 178 230 / 30%);
      }

      &::placeholder {
        color: rgb(255 255 255 / 45%);
      }
    }

    &__cancel {
      color: #ffffff;
      border-color: rgb(255 255 255 / 25%);

      &:hover {
        background: rgb(255 255 255 / 8%);
      }
    }

    &__color-picker {
      border-color: rgb(255 255 255 / 25%);
    }
  }

  @keyframes menuFadeIn {
    from {
      opacity: 0;
      transform: translateY(-0.3rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  // === IMMERSIVE MODE — lectura limpia ===
  .result--immersive {
    .verse-divider {
      display: none;
    }

    .reference {
      display: none;
    }

    .icon-btn {
      display: none;
    }

    .verse-save-topic {
      display: none;
    }
  }

  // === TTS KARAOKE — whole verse highlight + auto-scroll ===
  // Usa la clase global .highlight-verse (definida en public/global.css)
  .verse--tts-active {
    // Hereda estilos de .highlight-verse
  }

  .tts-verse-text {
    display: inline;
  }
</style>
