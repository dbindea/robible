<script>
  import Navbar from './layouts/header/Navbar.svelte';
  import Footer from './layouts/footer/Footer.svelte';
  import Main from './layouts/main/Main.svelte';
  import Landing from './layouts/landing/Landing.svelte';
  import PwaManager from './layouts/pwa/PwaManager.svelte';
  import AppMenu from './layouts/header/AppMenu.svelte';
  import AuthModal from './layouts/auth/AuthModal.svelte';
  import DailyVerseModal from './components/DailyVerseModal.svelte';
  import { authMenuOpen } from './store/authMenuStore';
  import { _, currentLocale, DEFAULT_LOCALE, setupI18n, loadLocaleSync, localeVersion, _pendingLocale } from './services/i18n.service';
  import { applySeoMetadata, applyLandingSeoMetadata } from './services/seo.service';
  import {
    getBibleVersionConfigOrDefault,
    isValidBibleVersion,
    selectedBibleVersion,
    compareWithVersion,
    immersiveMode,
  } from './store/stores';
  // ── Carga síncrona del locale inicial (antes del primer render) ──
  // El .then() se ejecuta en el mismo tick del browser, antes de que el
  // usuario vea nada. Esto evita el "locale errado → luego corrige" que
  // ocurría con el approach async-only.
  // Para la landing, el ?lang=xx de la URL tiene prioridad (idioma independiente).
  const _urlLang = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null;
  const _initialLocale = _urlLang || getBibleVersionConfigOrDefault($selectedBibleVersion)?.locale || DEFAULT_LOCALE;
  loadLocaleSync(_initialLocale);

  let bibleLoadRequestId = 0;
  let isBibleLoading = true;
  let bibleLoadError = '';
  let failedBibleVersion = '';
  let map = {},
    bible = [];

  // Cache de Bible data por versión
  let bibleCache = {};
  let compareMap = {};
  let compareBible = [];

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
    const locale = getBibleVersionConfigOrDefault(version)?.locale || DEFAULT_LOCALE;
    try {
      await setupI18n({ withLocale: locale });
    } catch (error) {
      console.error(error);
      await setupI18n({ withLocale: DEFAULT_LOCALE });
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
      return;
    }

    try {
      // Reusar cache si ya existe
      if (bibleCache[version]) {
        compareMap = bibleCache[version].map;
        compareBible = bibleCache[version].bible;
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
      // La vista de comparación no tiene UI de error todavía: se registra en
      // consola y las columnas quedan vacías.
      console.error('Failed to load compare version:', error);
    }
  };

  $: isImmersive = $immersiveMode;
  $: isLandingRoute = typeof window !== 'undefined' && (window.location.pathname === '/landing' || window.location.pathname === '/landing/');

  // SEO para la landing: aplica metadata + hreflang multi-idioma cuando estamos en /landing.
  $: if (isLandingRoute && typeof window !== 'undefined') {
    const _landingLang = new URLSearchParams(window.location.search).get('lang') || 'ro';
    const _seoT = $_(`landing.meta.title`);
    const _seoD = $_(`landing.meta.description`);
    applyLandingSeoMetadata({
      locale: _landingLang,
      title: typeof _seoT === 'string' && _seoT !== 'landing.meta.title' ? _seoT : undefined,
      description: typeof _seoD === 'string' && _seoD !== 'landing.meta.description' ? _seoD : undefined,
    });
  }

  // Contador de versiones en curso: evita que una versión anterior sobreescriba
  // una más reciente cuando llegan en orden invertido.
  let _localeVersionTag = 0;

  // AppMenu: navega a la ruta destino usando el path-based routing
  const onNavigate = (href) => {
    if (!href) return;
    if (window.location.pathname !== href) {
      window.history.pushState(null, '', href);
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cargar Biblia primaria cuando cambia.
  // DEPENDENCIA: leer $selectedBibleVersion directamente, nunca a través de una
  // variable derivada intermedia: esa se actualizaba dentro de loadBibleVersion
  // y volvía a disparar el reactive sin que la versión hubiese cambiado, lo que
  // causaba cascadas de loadLocaleSync.
  $: if ($selectedBibleVersion && !isLandingRoute) {
    applySeoMetadata({ versionConfig: getBibleVersionConfigOrDefault($selectedBibleVersion) });
    const tag = ++_localeVersionTag;
    (async () => {
      const versionToLoad = $selectedBibleVersion;
      if (tag !== _localeVersionTag) return;
      await loadLocaleForBibleVersion(versionToLoad);
      if (tag !== _localeVersionTag) return;
      // Leer $currentLocale DESPUÉS de await setupI18n — aquí ya se actualizó.
      const actualLocale = $currentLocale;
      // Guard: si el locale cambió mientras tanto (race), no cargar la Biblia con locale stale.
      if (_pendingLocale !== actualLocale) return;
      loadBibleVersion(versionToLoad);
    })();
  }

  // Cargar versión de comparación cuando cambia
  $: if ($compareWithVersion && $compareWithVersion !== $selectedBibleVersion) {
    loadCompareVersion($compareWithVersion);
  } else if ($compareWithVersion === $selectedBibleVersion) {
    compareMap = {};
    compareBible = [];
  }

</script>

<!--
  El {#key $localeVersion} fuerza re-render de Navbar+Main+Footer+AppMenu cada vez
  que el locale cambia. El counter localeVersion se actualiza SINCRONAMENTE después
  de _.set() en _applyTranslator(), asegurando que el bloque {#key} re-ejecute.
-->
{#if isLandingRoute}
  <Landing />
{:else}
<main class="main" class:main--immersive={isImmersive}>
  {#key $localeVersion}
    {#if !isImmersive}
      <Navbar />
    {/if}

    {#if bibleLoadError}
      <section class="load-error" role="alert">
        <h1>{$_('app.errors.invalid_bible_version')}</h1>
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
    <AppMenu {onNavigate} />
  {/key}
  <PwaManager />
  <!--
    Fuera del {#key $localeVersion} a propósito: dentro se remontaría en cada
    cambio de locale y volvería a lanzar su temporizador. Usa $_() en plantilla,
    así que se traduce igual sin necesidad del {#key}.
  -->
  {#if !isBibleLoading && !bibleLoadError && Object.keys(map).length}
    <DailyVerseModal {bible} {map} />
  {/if}
  {#if $authMenuOpen}
    <AuthModal />
  {/if}
</main>
{/if}

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
