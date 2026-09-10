<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import IconPicker from '../../components/IconPicker.svelte';
  import ChapterPicker from '../../components/ChapterPicker.svelte';
  import { saveLastRead } from '../../services/reading-progress.service';
  import Icon from '../../components/Icon.svelte';
  import { resolveTopicIcon } from '../../config/topic-icons.js';
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

  // ── Versículo seleccionado ──────────────────────────────────────────────
  //
  // Sólo uno a la vez. En reposo cada versículo enseña únicamente el botón de
  // copiar; el resto de acciones aparece al tocarlo. Antes se pintaban los
  // siete iconos en todos los versículos del capítulo, que en un móvil son
  // varios cientos de botones y hacían la lectura imposible.
  //
  // Es el mismo gesto que el índice temático: se elige un elemento y entonces
  // aparece lo que se puede hacer con él.
  // Ojo al usarla en la plantilla: hay que comparar contra `selectedVerseKey`
  // escribiéndolo tal cual (`selectedVerseKey === item.key`). Envolverlo en un
  // helper —`isVerseSelected(item.key)`— esconde la dependencia y Svelte deja de
  // repintar al cambiar la selección: los iconos no llegaban a aparecer.
  let selectedVerseKey = null;

  const toggleVerseSelection = (item) => {
    selectedVerseKey = selectedVerseKey === item.key ? null : item.key;
  };

  // Tocar un icono no debe además seleccionar o deseleccionar el versículo:
  // el clic burbujea hasta el contenedor, que es quien gestiona la selección.
  const stopBubble = (event) => event.stopPropagation();

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

  // Por dónde iba leyendo, para el «continuă de unde ai rămas» del perfil.
  // Sólo cuando hay libro y capítulo de verdad: durante una búsqueda por
  // palabras estos valores no describen una lectura.
  $: if (!searchForm.searchText && Number.isInteger(selectedBook) && Number.isInteger(selectedChapter)) {
    saveLastRead({ version: $selectedBibleVersion, book: selectedBook, chapter: selectedChapter });
  }
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
  <div class="radio-toolbar sticky">
    <!-- Mismo selector que en la comparación. Antes era una tira horizontal en
         la que el capítulo que estabas leyendo podía quedar a 5000 px de la
         izquierda sin que nada te llevara hasta él. -->
    <ChapterPicker
      chapters={chapterArray}
      current={chapterForm.chapter}
      label={$_('app.result.chapter_form_label')}
      onSelect={(ch) => { chapterForm.chapter = ch; updateChapterForm(); }}
    />
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

  <!-- Igual que en la Sidebar: buscando por referencia no se cuentan
       resultados, se ofrecen sugerencias. -->
  {#if searchForm.searchText && searchForm.searchType !== 'reference'}
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
    <!-- El versículo entero es el área que selecciona. `tabindex` pasa de -1 a
         0 y se añade el manejador de teclado para que quien navegue con teclado
         llegue a las acciones: si sólo respondiese al ratón, los botones
         ocultos serían inalcanzables. El texto no es seleccionable
         (`user-select: none` en `.result`, por el swipe), así que el toque no
         compite con seleccionar texto. -->
    <div
      class:verse--tts-active={isVerseTtsActive(item.key)}
      class:verse--user-highlight={verseHighlight}
      class:verse--selected={selectedVerseKey === item.key}
      class:highlight-verse={isVerseTtsActive(item.key) || highlightedVerseId === getVerseId(item)}
      class="verse"
      style={verseHighlight ? `--highlight-color: ${verseHighlight.color};` : ''}
      id={getVerseId(item)}
      role="button"
      tabindex="0"
      aria-expanded={selectedVerseKey === item.key}
      aria-label={$_('app.result.actions.verse_actions', {
        reference: `${map[item.book]} ${item.chapter}:${item.index}`,
      })}
      on:click={() => toggleVerseSelection(item)}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleVerseSelection(item);
        }
      }}
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
          on:click={(e) => { stopBubble(e); navigateToVerse(item); }}
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
          on:click={(e) => { stopBubble(e); copyVerse(item); }}
        >
          <Icon name="copy" />
        </button>

        <!-- ── Acciones que sólo aparecen con el versículo seleccionado ──────
             Copiar se queda siempre visible porque es lo que más se usa y no
             merece un toque previo. -->
        {#if selectedVerseKey === item.key}
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
          <Icon name="share" />
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
          on:click={(e) => { stopBubble(e); if ($isAuthenticated) favoritesStore.toggle(item.book, item.chapter, item.index); }}
        >
          <Icon name="star" weight={$favoritesStore.some((f) => f.book === item.book && f.chapter === item.chapter && f.verse === item.index) ? 'fill' : 'regular'} />
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
          <Icon name="palette" />
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
              <Icon name="swap" />
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
              <span style="color: {primaryTopic.color}; display: contents;">
                <Icon name={resolveTopicIcon(primaryTopic.icon)} weight="fill" />
              </span>
            {:else}
              <Icon name="bookmark" />
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
            <Icon name="note" />
          </button>
        </span>
        {/if}
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
              <span class="save-topic-option__icon" aria-hidden="true"><Icon name={resolveTopicIcon(topic.icon)} size="1rem" /></span>
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
        <input spellcheck="false"
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
            <Icon name="check" />
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
    <textarea spellcheck="false"
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
          <Icon name="palette" size="14px" />
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

  .breadcrumbs a {
    // 19 px de alto: por debajo del mínimo táctil de WCAG 2.5.8.
    display: inline-flex;
    align-items: center;
    min-height: 1.5rem;
  }

  .breadcrumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.8rem;
    color: var(--color-ink-soft);
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
      background-color var(--motion-slow) ease,
      box-shadow var(--motion-slow) ease;

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    // ── Subrayado del usuario ────────────────────────────────────────────
    // El color llega inline como --highlight-color, igual que el del tema en
    // el botón del índice. Se mezcla con el fondo en vez de aplicarse en
    // crudo: así el mismo hex vale para claro y oscuro sin duplicar reglas.
    &--user-highlight {
      background-color: color-mix(in srgb, var(--highlight-color) 26%, transparent);
      box-shadow: inset 0.25rem 0 0 var(--highlight-color);
    }

    // ── Versículo seleccionado ───────────────────────────────────────────
    // Suave a propósito: marca dónde está el foco de trabajo sin competir con
    // el subrayado del usuario ni con el verde del estado de lectura.
    //
    // Va después de `--user-highlight` porque las dos usan `box-shadow` y la
    // última gana. Un versículo subrayado y además seleccionado tiene que
    // enseñar las dos cosas, así que abajo se combinan las dos sombras a mano.
    &--selected {
      background-color: color-mix(in srgb, var(--color-accent) 8%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 34%, transparent);
    }

    &--user-highlight#{&}--selected {
      background-color: color-mix(in srgb, var(--highlight-color) 26%, transparent);
      box-shadow:
        inset 0.25rem 0 0 var(--highlight-color),
        inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 34%, transparent);
    }

    // El cursor sólo en escritorio: en móvil no existe y `pointer` sobre un
    // bloque de texto largo confunde más que ayuda.
    @media (hover: hover) {
      cursor: pointer;
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
    // Blanco literal y no `--color-on-primary`: la marca de selección va encima
    // del color que ha elegido el usuario, no de un color de la paleta. En
    // nocturn el primer plano del acento es negro, y aquí sería ilegible.
    color: #ffffff;
    cursor: pointer;
    transition: var(--transition), transform var(--motion-fast) ease;
    box-shadow: inset 0 0 0 1px var(--shadow-tint), var(--box-shadow-up);

    --icon-size: 1.1rem;
    filter: drop-shadow(0 1px 1px var(--shadow-tint-strong));

    &:hover {
      transform: translateY(-2px);
    }

    &--active {
      border-color: var(--color-ink);
      box-shadow: inset 0 0 0 1px var(--shadow-tint), 0 0 0 3px color-mix(in srgb, var(--swatch-color) 40%, transparent);
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
    color: var(--color-link);
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
    border: 1px solid var(--color-line-accent);
    border-radius: 0.28rem;
    background: var(--wash-accent);
    color: var(--color-accent-ink);
    cursor: pointer;
    transition: var(--transition);
    box-shadow: 0 1px 3px var(--shadow-tint);

    // El tamaño va al contenedor: una regla `svg` de aquí no alcanza al
    // <svg> de Icon.svelte, que lleva otra clase de scope.
    --icon-size: 0.85rem;

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
    box-shadow: 0 1px 3px var(--shadow-tint);

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
      color: var(--color-ink-soft);
    }

    &:hover,
    &:focus-visible {
      border-color: color-mix(in srgb, var(--color-accent) 34%, transparent);
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
    }
  }




  // === SAVE TO TOPIC ===
  .verse-save-topic {
    position: relative;
    display: inline-flex;
  }

  .save-topic-btn {
    // Siempre visible, con box-shadow consistente
    opacity: 1;
    box-shadow: 0 1px 3px var(--shadow-tint);

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

  // ── Modales de nota y de categorías ───────────────────────────────────────
  //
  // Estas reglas se perdieron en algún momento: el marcado seguía llevando las
  // clases, pero no existía ni una regla para ellas, así que el navegador
  // pintaba sus valores por defecto — botones grises con borde `outset`, la
  // lista con viñetas y sangría de 40 px, el `textarea` sin radio ni relleno.
  // Sólo `.save-topic-option` había sobrevivido.

  .note-modal__textarea {
    width: 100%;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-field);
    color: var(--color-ink);
    font: inherit;
    font-size: var(--font-size-small);
    line-height: 1.5;
    resize: vertical;

    &:focus-visible {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
    }
  }

  .note-modal__footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    margin-top: 0.85rem;
  }

  .note-modal__color-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-ink-soft);
  }

  .note-modal__color-label {
    display: inline-flex;
    align-items: center;
  }

  // El selector de color nativo trae un marco y un relleno que no pegan con
  // nada. Se le quita el cromo y queda sólo la muestra, como una pastilla.
  .note-modal__color-picker {
    width: 2.25rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;

    &::-webkit-color-swatch-wrapper { padding: 2px; }
    &::-webkit-color-swatch { border: 0; border-radius: 2px; }
    &::-moz-color-swatch { border: 0; border-radius: 2px; }
  }

  .note-modal__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;

    button {
      min-height: 2.25rem;
      padding: 0.5rem 1rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-pill);
      background: transparent;
      color: var(--color-ink);
      font: inherit;
      font-size: var(--font-size-small);
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);

      &:disabled { opacity: 0.4; cursor: not-allowed; }
      &:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent-ink); }
    }
  }

  // Anidados bajo su contenedor para ganarle a la regla `button` de arriba sin
  // recurrir a !important: tres clases contra dos clases y un elemento.
  .note-modal__actions .note-modal__save {
    border-color: var(--color-accent);
    // Relleno de acento porque lleva texto encima: `--color-accent` sólo
    // garantiza 3:1 y aquí hace falta 4.5 (ver sistema de diseño en CLAUDE.md).
    background: var(--color-accent-solid);
    color: var(--color-on-primary);

    &:hover:not(:disabled) {
      background: var(--color-accent-solid-hover);
      color: var(--color-on-primary);
    }
  }

  .note-modal__actions .note-modal__delete {
    color: var(--color-danger);

    &:hover { border-color: var(--color-danger); color: var(--color-danger); }
  }

  .save-topic-menu__list {
    display: grid;
    gap: 0.2rem;
    margin: 0;
    padding: 0;
    // Sin esto salían las viñetas y los 40 px de sangría del navegador.
    list-style: none;
  }

  .save-topic-menu__empty {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
  }

  .save-topic-menu__divider {
    height: 1px;
    margin: 0.75rem 0;
    background: var(--color-line);
  }

  .save-topic-menu__add-new {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.25rem;
    padding: 0.5rem 1rem;
    border: 1px dashed var(--color-line-accent);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-accent-ink);
    font: inherit;
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);

    &:hover { border-style: solid; background: var(--wash-accent); }
  }

  .save-topic-menu__inline {
    display: grid;
    gap: 0.6rem;

    input[type='text'] {
      width: 100%;
      padding: 0.5rem 0.7rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-field);
      color: var(--color-ink);
      font: inherit;
      font-size: var(--font-size-small);

      &:focus-visible {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
      }
    }
  }

  // La fila del icono y el color; los botones van en `__inline-actions`.
  .save-topic-menu__inline-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .save-topic-menu__inline-color {
    width: 2.25rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;

    &::-webkit-color-swatch-wrapper { padding: 2px; }
    &::-webkit-color-swatch { border: 0; border-radius: 2px; }
    &::-moz-color-swatch { border: 0; border-radius: 2px; }
  }

  .save-topic-menu__inline-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;

    button {
      min-height: 2.25rem;
      padding: 0.5rem 1rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-pill);
      background: transparent;
      color: var(--color-ink);
      font: inherit;
      font-size: var(--font-size-small);
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);

      &:disabled { opacity: 0.4; cursor: not-allowed; }
      &:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent-ink); }
    }
  }

  .save-topic-menu__inline-actions .save-topic-menu__inline-save {
    border-color: var(--color-accent);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);

    &:hover:not(:disabled) {
      background: var(--color-accent-solid-hover);
      color: var(--color-on-primary);
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


  // === FAVORITE BUTTON ===
  // Siempre visible (es la acción primaria). Estado activo = estrella rellena en amarillo.
  .favorite-btn {
    opacity: 1;

    transition: transform var(--motion-fast) ease;

    &:hover:not(:disabled) {
      transform: scale(1.15);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }








  .count {
    font-weight: 700;
  }
  // Sólo el marco: los capítulos los dibuja y los desplaza `ChapterPicker`.
  // Aquí había además un `overflow-x: auto` y, en la media query de móvil, un
  // `flex-wrap: nowrap` sobre el formulario. Ésa era la causa de que los 150
  // capítulos de los Salmos salieran en una tira de 6903 px de ancho.
  .radio-toolbar {
    padding: 1rem;
    background-color: var(--color-bg-light);
    margin: 0 0 1rem;
    z-index: 1;
    box-shadow: var(--box-shadow-up);
    border-radius: 0.25rem;
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
    // `--player-offset` lo publica TtsPlayer: mientras suena la música su barra
    // ocupa la parte de abajo y este botón se quedaba detrás.
    bottom: calc(1rem + var(--player-offset, 0px));
    transition: bottom var(--motion-base) var(--ease-out);
    z-index: 8;
    display: none;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid var(--color-blue);
    border-radius: 0.35rem;
    background: var(--color-accent-solid);
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
    transition: transform var(--motion-fast) ease, opacity var(--motion-fast) ease;
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
    transition: opacity var(--motion-base) ease;
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
    // A media altura y no abajo: pegados al pie se solapaban con el footer,
    // que es fijo, y el botón quedaba debajo sin poder pulsarse.
    top: 50%;
    transform: translateY(-50%);
    z-index: 8;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 0.85rem;
    border: 1px solid var(--color-blue);
    border-radius: 999px;
    background: var(--color-surface-raised);
    color: var(--color-ink-strong);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--box-shadow-down);
    animation: chapterNavFadeIn var(--motion-base) var(--ease-out);

    &:hover,
    &:focus-visible {
      background: var(--color-accent-solid);
      color: var(--color-on-primary);
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

  // Sólo opacidad: un desplazamiento en Y anularía el translateY(-50%) que
  // centra el botón y aparecería descolocado.
  @keyframes chapterNavFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (max-width: 38rem) {
    .chapter-nav {
      display: none; // On mobile use swipe gestures instead
    }
  }


  /* === Note button === */
  .note-btn {
    opacity: 1;
    box-shadow: 0 1px 3px var(--shadow-tint);

  }

  .note-btn[aria-expanded="true"] {
    opacity: 1;
  }

  /* === Note modal — centered overlay (auth-modal style) === */
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
  // ── Cristal ───────────────────────────────────────────────────────────
  // El fondo opaco de la regla de arriba es la base y se queda: si el
  // navegador no desenfoca, el texto se lee sobre color sólido en vez de
  // sobre el contenido de la página. La transparencia sólo entra donde hay
  // desenfoque real.
  @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
    .chapter-nav {
      background: var(--glass-tint);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      border-color: var(--glass-line);
    }
    .scroll-top-button {
      background: var(--glass-accent);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      border-color: var(--glass-line);
    }
    .toast {
      background: var(--glass-tint);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      border-color: var(--glass-line);
    }
  }
</style>
