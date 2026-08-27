<script>
  import Navbar from './layouts/header/Navbar.svelte';
  import Footer from './layouts/footer/Footer.svelte';
  import Main from './layouts/main/Main.svelte';
  import PwaManager from './layouts/pwa/PwaManager.svelte';
  import { _, DEFAULT_LOCALE, setupI18n } from './services/i18n.service';
  import { applySeoMetadata } from './services/seo.service';
  import {
    getBibleVersionConfigOrDefault,
    isValidBibleVersion,
    selectedBibleVersion,
    compareWithVersion,
    immersiveMode,
  } from './store/stores';
  import { onMount } from 'svelte';

  let bibleLoadRequestId = 0;
  let localeLoadRequestId = 0;
  let isBibleLocaleReady = false;
  let isBibleLoading = true;
  let bibleLoadError = '';
  let failedBibleVersion = '';
  let map = {},
    bible = [];

  // Cache de Bible data por versión
  let bibleCache = {};
  let compareMap = {};
  let compareBible = [];
  let compareLoadError = '';
  let isCompareLoading = false;

  const buildBibleDataUrl = (version, fileName) => {
    return `/data/${encodeURIComponent(version)}/${fileName}`;
  };

  const fetchBibleJson = async (version, fileName) => {
    const url = buildBibleDataUrl(version, fileName);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Unable to load ${url}: ${response.status}`);
    }

    return response.json();
  };

  const loadLocaleForBibleVersion = async (version) => {
    const requestId = ++localeLoadRequestId;
    const locale = getBibleVersionConfigOrDefault(version)?.locale || DEFAULT_LOCALE;

    isBibleLocaleReady = false;

    try {
      await setupI18n({ withLocale: locale });

      if (requestId !== localeLoadRequestId) {
        return;
      }

      document.documentElement.lang = locale;
      localStorage.setItem('lang', locale);
      isBibleLocaleReady = true;
    } catch (error) {
      if (requestId !== localeLoadRequestId) {
        return;
      }

      console.error(error);
      await setupI18n({ withLocale: DEFAULT_LOCALE });
      document.documentElement.lang = DEFAULT_LOCALE;
      localStorage.setItem('lang', DEFAULT_LOCALE);
      isBibleLocaleReady = true;
    }
  };

  const loadBibleVersion = async (version) => {
    const requestId = ++bibleLoadRequestId;

    isBibleLoading = true;
    bibleLoadError = '';
    failedBibleVersion = '';
    map = {};
    bible = [];

    if (!isValidBibleVersion(version)) {
      isBibleLoading = false;
      bibleLoadError = 'app.errors.invalid_bible_version';
      failedBibleVersion = version;
      return;
    }

    try {
      const [nextMap, nextBible] = await Promise.all([
        fetchBibleJson(version, 'bible.map.json'),
        fetchBibleJson(version, 'bible.json'),
      ]);

      if (requestId !== bibleLoadRequestId) {
        return;
      }

      map = nextMap;
      bible = nextBible;

      // Cachear también para uso futuro
      bibleCache = { ...bibleCache, [version]: { map: nextMap, bible: nextBible } };
    } catch (error) {
      if (requestId !== bibleLoadRequestId) {
        return;
      }

      console.error(error);
      bibleLoadError = 'app.errors.bible_load_failed';
      failedBibleVersion = version;
    } finally {
      if (requestId === bibleLoadRequestId) {
        isBibleLoading = false;
      }
    }
  };

  // Carga la versión de comparación (compareWithVersion) y expone compareMap/compareBible
  const loadCompareVersion = async (version) => {
    if (!version || version === $selectedBibleVersion) {
      compareMap = {};
      compareBible = [];
      compareLoadError = '';
      return;
    }

    isCompareLoading = true;
    compareLoadError = '';

    try {
      // Reusar cache si ya existe
      if (bibleCache[version]) {
        compareMap = bibleCache[version].map;
        compareBible = bibleCache[version].bible;
        isCompareLoading = false;
        return;
      }

      const [nextMap, nextBible] = await Promise.all([
        fetchBibleJson(version, 'bible.map.json'),
        fetchBibleJson(version, 'bible.json'),
      ]);

      bibleCache = { ...bibleCache, [version]: { map: nextMap, bible: nextBible } };
      compareMap = nextMap;
      compareBible = nextBible;
    } catch (error) {
      console.error('Failed to load compare version:', error);
      compareLoadError = 'app.errors.bible_load_failed';
    } finally {
      isCompareLoading = false;
    }
  };

  $: currentBibleVersion = $selectedBibleVersion;
  $: currentBibleVersionConfig = getBibleVersionConfigOrDefault(currentBibleVersion);
  $: isImmersive = $immersiveMode;

  // Cargar Biblia primaria cuando cambia
  $: if (currentBibleVersion) {
    applySeoMetadata({ versionConfig: currentBibleVersionConfig });
    loadLocaleForBibleVersion(currentBibleVersion);
    loadBibleVersion(currentBibleVersion);
  }

  // Cargar versión de comparación cuando cambia
  $: if ($compareWithVersion && $compareWithVersion !== $selectedBibleVersion) {
    loadCompareVersion($compareWithVersion);
  } else if ($compareWithVersion === $selectedBibleVersion) {
    compareMap = {};
    compareBible = [];
  }
</script>

<main class="main" class:main--immersive={isImmersive}>
  {#if isBibleLocaleReady}
    {#if !isImmersive}
      <Navbar />
    {/if}

    {#if bibleLoadError}
      <section class="load-error" role="alert">
        <h1>{$_(bibleLoadError)}</h1>
        <p>
          {$_('app.errors.bible_file_hint')}
          <code>public/data/{failedBibleVersion}/bible.map.json</code>
          {$_('app.errors.and')}
          <code>public/data/{failedBibleVersion}/bible.json</code>.
        </p>
      </section>
    {:else if isBibleLoading || !Object.keys(map).length}
      <p class="loading" role="status">{$_('app.loading')}</p>
    {:else}
      <Main {map} {bible} {compareMap} {compareBible} />
    {/if}

    {#if !isImmersive}
      <Footer />
    {/if}
    <PwaManager />
  {:else}
    <p class="loading" role="status">Loading...</p>
  {/if}
</main>

<style>
  .main {
    min-height: 100dvh;
    background-color: var(--color-bg-light);
  }

  .main--immersive {
    padding-top: 0;
  }

  .loading {
    min-height: calc(100dvh - 9rem);
    display: grid;
    place-items: center;
    margin: 0;
    color: var(--color-bg-dark);
    font-weight: 600;
  }

  .load-error {
    min-height: calc(100dvh - 9rem);
    display: grid;
    align-content: center;
    gap: 0.5rem;
    max-width: 52rem;
    margin: 0 auto;
    padding: clamp(1.25rem, 4vw, 2.5rem);
    color: var(--color-bg-dark);
  }

  .load-error h1,
  .load-error p {
    margin: 0;
  }

  .load-error h1 {
    font-size: clamp(1.5rem, 3vw, 2rem);
    line-height: 1.2;
  }

  .load-error code {
    border-radius: 0.2rem;
    background-color: var(--color-white);
    padding: 0.1rem 0.25rem;
  }
</style>
