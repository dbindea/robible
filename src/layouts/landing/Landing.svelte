<script>
  import { onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { searchReferences } from '../../services/referenceSearch.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import { buildBiblePath } from '../../services/bible-route.service';

  // ── Estado del micro-demo ────────────────────────────────────────────────
  let demoQuery = '';
  let demoResult = null;     // { book, chapter, verse, name } | null
  let demoError = '';
  let demoLoading = false;

  // ── Idioma activo del landing (independiente del locale de la Biblia) ────
  const SUPPORTED_LOCALES = [
    { code: 'ro', label: 'Română', short: 'RO' },
    { code: 'es', label: 'Español', short: 'ES' },
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'zh', label: '中文', short: 'ZH' },
  ];

  // Idioma activo derivado de la URL (?lang=xx) — se actualiza al cambiar.
  // Default 'ro' (igual que el i18n service) para SSR/primer render.
  let activeLang = 'ro';
  if (typeof window !== 'undefined') {
    activeLang = new URLSearchParams(window.location.search).get('lang') || 'ro';
    window.addEventListener('popstate', () => {
      activeLang = new URLSearchParams(window.location.search).get('lang') || 'ro';
    });
  }

  function setLocale(code) {
    if (typeof window === 'undefined') return;
    activeLang = code; // reflect click immediately even before reload
    const url = new URL(window.location.href);
    url.searchParams.set('lang', code);
    // Recargar para que el i18n service cargue el nuevo locale
    window.location.href = url.toString();
  }

  // ── FAQ data (se traduce via $_ en el template) ──────────────────────────
  const faqItems = [
    { qKey: 'landing.faq.q1', aKey: 'landing.faq.a1' },
    { qKey: 'landing.faq.q2', aKey: 'landing.faq.a2' },
    { qKey: 'landing.faq.q3', aKey: 'landing.faq.a3' },
    { qKey: 'landing.faq.q4', aKey: 'landing.faq.a4' },
    { qKey: 'landing.faq.q5', aKey: 'landing.faq.a5' },
  ];

  let openFaqIdx = -1;
  function toggleFaq(i) {
    openFaqIdx = openFaqIdx === i ? -1 : i;
  }

  // ── JSON-LD ──────────────────────────────────────────────────────────────
  // Los esquemas se serializan aquí y no en el markup: un <script> dentro de
  // un template literal en la plantilla rompe el parser de ESLint y dejaba el
  // archivo entero sin analizar. La salida renderizada es idéntica.
  // El `<\/script>` va escapado a propósito: sin la barra, la cadena cerraría
  // este mismo bloque <script> del componente.
  // eslint-disable-next-line no-useless-escape
  const jsonLdTag = (data) => `<script type="application/ld+json">${JSON.stringify(data)}<\/script>`;

  $: webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'RoBible',
    alternateName: 'Ro Bible',
    url: 'https://robible.com',
    description: $_('landing.meta.description'),
    inLanguage: ['ro', 'es', 'en', 'zh-Hans'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://robible.com/biblia/{version}/{book}/{chapter}/{verse}',
      },
      'query-input': 'required name=verse',
    },
  };

  $: softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'RoBible',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any (web browser)',
    description: $_('landing.meta.description'),
    url: 'https://robible.com',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
    featureList: [
      'No tracking',
      'No ads',
      'Offline reading (PWA)',
      'Multi-language: ro, es, en, zh',
      'Reference search',
      'Word search',
      'Multi-device sync',
      'TTS with ambient music',
      'Translation comparison',
    ],
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'RoBible',
    url: 'https://robible.com',
    logo: 'https://robible.com/assets/logo.png',
    sameAs: ['https://github.com/dbindea/robible'],
  };

  // Este map ignoraba el `item` y emitía cinco veces la pregunta q1/a1.
  $: faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: $_(item.qKey),
      acceptedAnswer: { '@type': 'Answer', text: $_(item.aKey) },
    })),
  };

  // ── Contadores ───────────────────────────────────────────────────────────
  // Datos fijos del producto, no del backend: no hacen falta peticiones.
  // (Había además un `users: null` que no se mostraba en ninguna parte.)
  const stats = {
    verses: 31102,
    books: 66,
    languages: 4,
  };

  // ── Micro-demo: ejecutar búsqueda por referencia ─────────────────────────
  async function runDemo() {
    demoError = '';
    demoResult = null;
    if (!demoQuery.trim()) return;
    demoLoading = true;
    try {
      // Necesitamos el map de la Biblia activa para searchReferences.
      // Lo pedimos al backend para no tener que cargar la Biblia entera.
      const versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
      const mapRes = await fetch(`/data/${encodeURIComponent(versionConfig.value)}/bible.map.json`);
      if (!mapRes.ok) throw new Error('map');
      const map = await mapRes.json();
      const matches = searchReferences(demoQuery, map, 5);
      if (matches.length === 1) {
        const m = matches[0];
        if (m.chapter && m.verse) {
          // Single match inequívoco: navega a la app con highlight
          const path = buildBiblePath({
            version: versionConfig.value,
            map,
            book: m.book,
            chapter: m.chapter,
            verse: m.verse,
          });
          window.location.href = path;
          return;
        }
        demoResult = m;
      } else if (matches.length > 1) {
        demoResult = { multiple: true, matches };
      } else {
        demoError = $_('landing.demo.no_results');
      }
    } catch (err) {
      demoError = $_('landing.demo.error');
    } finally {
      demoLoading = false;
    }
  }

  function selectDemoMatch(m) {
    if (!m || !m.chapter || !m.verse) return;
    const versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
    fetch(`/data/${encodeURIComponent(versionConfig.value)}/bible.map.json`)
      .then((r) => r.json())
      .then((map) => {
        const path = buildBiblePath({
          version: versionConfig.value,
          map,
          book: m.book,
          chapter: m.chapter,
          verse: m.verse,
        });
        window.location.href = path;
      });
  }

  // ── Animación scroll-triggered ──────────────────────────────────────────
  let observer;
  onMount(() => {
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('is-visible');
              observer.unobserve(e.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
      );
      document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    } else {
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
    }
    return () => observer && observer.disconnect();
  });
</script>

<svelte:head>
  <title>RoBible — {$_('landing.meta.title')}</title>
  <meta name="description" content={$_('landing.meta.description')} />
  <meta name="theme-color" content="#1A2332" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="RoBible" />
  <meta property="og:description" content={$_('landing.meta.description')} />
  <meta property="og:url" content="https://robible.com/landing" />
  <meta property="og:site_name" content="RoBible" />
  <meta property="og:locale" content="ro_RO" />
  <meta property="og:locale:alternate" content="es_ES" />
  <meta property="og:locale:alternate" content="en_US" />
  <meta property="og:locale:alternate" content="zh_CN" />
  <meta property="og:image" content="https://robible.com/assets/og-landing.svg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="RoBible — Bible reader with no tracking" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="RoBible" />
  <meta name="twitter:description" content={$_('landing.meta.description')} />
  <meta name="twitter:image" content="https://robible.com/assets/og-landing.svg" />

  <!-- hreflang -->
  <link rel="alternate" hreflang="ro" href="https://robible.com/landing?lang=ro" />
  <link rel="alternate" hreflang="es" href="https://robible.com/landing?lang=es" />
  <link rel="alternate" hreflang="en" href="https://robible.com/landing?lang=en" />
  <link rel="alternate" hreflang="zh-Hans" href="https://robible.com/landing?lang=zh" />
  <link rel="alternate" hreflang="x-default" href="https://robible.com/landing" />

  <!-- Canonical -->
  <link rel="canonical" href="https://robible.com/landing" />

  <!-- Preconnect to fonts and CDN -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

  <!-- JSON-LD (los esquemas se construyen en el bloque <script>) -->
  {@html jsonLdTag(webSiteSchema)}
  {@html jsonLdTag(softwareSchema)}
  {@html jsonLdTag(organizationSchema)}
  {@html jsonLdTag(faqSchema)}
</svelte:head>

<main class="landing">
  <!-- Skip link for accessibility -->
  <a class="skip-link" href="#main">{$_('landing.skip_to_content')}</a>

  <!-- ─── HERO ──────────────────────────────────────────────────── -->
  <section class="hero" id="main" aria-labelledby="hero-title">
    <div class="hero__bg" aria-hidden="true"></div>

    <div class="hero__inner">
      <div class="hero__text" data-reveal>
        <!-- Marca: hasta ahora el logotipo no aparecía en ninguna pantalla,
             solo como favicon e icono de la PWA. -->
        <a class="hero__brand" href="/" aria-label="RoBible">
          <img src="/assets/img/logo.svg" alt="" width="44" height="44" />
          <span class="hero__brand-name">RoBible</span>
        </a>
        <p class="hero__eyebrow">{$_('landing.hero.eyebrow')}</p>
        <h1 id="hero-title" class="hero__title">{$_('landing.hero.title')}</h1>
        <p class="hero__lede">{$_('landing.hero.lede')}</p>

        <div class="hero__cta">
          <a class="btn btn--primary" href="/biblia">
            {$_('landing.hero.cta_primary')}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </a>
          <a class="btn btn--ghost" href="#demo">{$_('landing.hero.cta_secondary')}</a>
        </div>

        <div class="hero__lang" aria-label={$_('landing.hero.lang_label')}>
          <span class="hero__lang-label">{$_('landing.hero.lang_label')}</span>
          <ul class="hero__lang-list">
            {#each SUPPORTED_LOCALES as loc (loc.code)}
              <li>
                <button
                  type="button"
                  class="hero__lang-btn"
                  class:hero__lang-btn--active={loc.code === activeLang}
                  on:click={() => setLocale(loc.code)}
                  aria-label={loc.label}
                >{loc.short}</button>
              </li>
            {/each}
          </ul>
        </div>
      </div>

      <aside class="hero__aside" data-reveal id="demo" aria-label={$_('landing.demo.aria')}>
        <!-- Foto de apoyo: Biblia abierta a la luz de una vela. Decorativa,
             por eso alt vacío y aria-hidden. -->
        <figure class="hero__photo" aria-hidden="true">
          <picture>
            <source srcset="/assets/img/landing/persona-leyendo.webp" type="image/webp" />
            <img
              src="/assets/img/landing/persona-leyendo.jpg"
              alt=""
              width="1000"
              height="667"
              loading="eager"
              fetchpriority="high"
            />
          </picture>
        </figure>

        <div class="demo">
          <p class="demo__eyebrow">{$_('landing.demo.eyebrow')}</p>
          <p class="demo__hint">{$_('landing.demo.hint')}</p>

          <form class="demo__form" on:submit|preventDefault={runDemo}>
            <label class="demo__label" for="demo-input">
              <span class="visually-hidden">{$_('landing.demo.placeholder')}</span>
              <input
                id="demo-input"
                type="text"
                bind:value={demoQuery}
                placeholder={$_('landing.demo.placeholder')}
                autocomplete="off"
                spellcheck="false"
                class="demo__input"
              />
            </label>
            <button type="submit" class="demo__btn" disabled={demoLoading || !demoQuery.trim()}>
              {demoLoading ? '…' : $_('landing.demo.button')}
            </button>
          </form>

          {#if demoError}
            <p class="demo__error" role="alert">{demoError}</p>
          {/if}

          {#if demoResult && !demoResult.multiple}
            <div class="demo__result">
              <span class="demo__result-ref">{demoResult.name} {demoResult.chapter}:{demoResult.verse}</span>
              <button class="demo__result-link" on:click={() => selectDemoMatch(demoResult)}>
                {$_('landing.demo.open')}
              </button>
            </div>
          {/if}

          {#if demoResult && demoResult.multiple}
            <ul class="demo__list">
              {#each demoResult.matches as m}
                {#if m.chapter && m.verse}
                  <li>
                    <button class="demo__list-item" on:click={() => selectDemoMatch(m)}>
                      <span class="demo__list-name">{m.name}</span>
                      <span class="demo__list-ref">{m.chapter}:{m.verse}</span>
                    </button>
                  </li>
                {/if}
              {/each}
            </ul>
          {/if}
        </div>
      </aside>
    </div>

    <a class="hero__scroll-hint" href="#count" aria-label={$_('landing.hero.scroll')}>
      <span class="hero__scroll-line" aria-hidden="true"></span>
    </a>
  </section>

  <!-- ─── STATS ─────────────────────────────────────────────────── -->
  <section class="stats" id="count" aria-label={$_('landing.stats.label')}>
    <dl class="stats__list" data-reveal>
      <div class="stats__item">
        <dt class="stats__label">{$_('landing.stats.languages')}</dt>
        <dd class="stats__value">{stats.languages}</dd>
      </div>
      <div class="stats__item">
        <dt class="stats__label">{$_('landing.stats.books')}</dt>
        <dd class="stats__value">{stats.books}</dd>
      </div>
      <div class="stats__item">
        <dt class="stats__label">{$_('landing.stats.verses')}</dt>
        <dd class="stats__value">{stats.verses.toLocaleString()}</dd>
      </div>
      <div class="stats__item">
        <dt class="stats__label">{$_('landing.stats.free')}</dt>
        <dd class="stats__value">{$_('landing.stats.free_value')}</dd>
      </div>
    </dl>
  </section>

  <!-- ─── FEATURES (micro-demos) ──────────────────────────────────── -->
  <section class="features" aria-labelledby="features-title">
    <header class="section-header" data-reveal>
      <p class="section-eyebrow">{$_('landing.features.eyebrow')}</p>
      <h2 id="features-title" class="section-title">{$_('landing.features.title')}</h2>
    </header>

    <ol class="features__list">
      <li class="feature" data-reveal>
        <div class="feature__number">01</div>
        <h3 class="feature__title">{$_('landing.features.f1.title')}</h3>
        <p class="feature__text">{$_('landing.features.f1.text')}</p>
        <p class="feature__example">{$_('landing.features.f1.example')}</p>
      </li>

      <li class="feature" data-reveal>
        <div class="feature__number">02</div>
        <h3 class="feature__title">{$_('landing.features.f2.title')}</h3>
        <p class="feature__text">{$_('landing.features.f2.text')}</p>
        <p class="feature__example">{$_('landing.features.f2.example')}</p>
      </li>

      <li class="feature" data-reveal>
        <div class="feature__number">03</div>
        <h3 class="feature__title">{$_('landing.features.f3.title')}</h3>
        <p class="feature__text">{$_('landing.features.f3.text')}</p>
        <p class="feature__example">{$_('landing.features.f3.example')}</p>
      </li>

      <li class="feature" data-reveal>
        <div class="feature__number">04</div>
        <h3 class="feature__title">{$_('landing.features.f4.title')}</h3>
        <p class="feature__text">{$_('landing.features.f4.text')}</p>
        <p class="feature__example">{$_('landing.features.f4.example')}</p>
      </li>
    </ol>
  </section>

  <!-- ─── WHY ────────────────────────────────────────────────────── -->
  <section class="why" aria-labelledby="why-title">
    <div class="why__inner">
      <header class="section-header" data-reveal>
        <p class="section-eyebrow">{$_('landing.why.eyebrow')}</p>
        <h2 id="why-title" class="section-title">{$_('landing.why.title')}</h2>
        <p class="section-lede">{$_('landing.why.lede')}</p>
      </header>

      <!-- Biblia abierta a la luz de una vela. Decorativa. -->
      <figure class="why__photo" data-reveal aria-hidden="true">
        <picture>
          <source srcset="/assets/img/landing/libro-abierto-vela.webp" type="image/webp" />
          <img src="/assets/img/landing/libro-abierto-vela.jpg" alt="" loading="lazy" width="1000" height="667" />
        </picture>
      </figure>

      <ul class="why__list">
        <li class="why__item" data-reveal>
          <h3 class="why__item-title">{$_('landing.why.w1.title')}</h3>
          <p class="why__item-text">{$_('landing.why.w1.text')}</p>
        </li>
        <li class="why__item" data-reveal>
          <h3 class="why__item-title">{$_('landing.why.w2.title')}</h3>
          <p class="why__item-text">{$_('landing.why.w2.text')}</p>
        </li>
        <li class="why__item" data-reveal>
          <h3 class="why__item-title">{$_('landing.why.w3.title')}</h3>
          <p class="why__item-text">{$_('landing.why.w3.text')}</p>
        </li>
        <li class="why__item" data-reveal>
          <h3 class="why__item-title">{$_('landing.why.w4.title')}</h3>
          <p class="why__item-text">{$_('landing.why.w4.text')}</p>
        </li>
      </ul>
    </div>
  </section>

  <!-- ─── AUDIENCE ────────────────────────────────────────────── -->
  <section class="audience" aria-labelledby="audience-title">
    <header class="section-header" data-reveal>
      <p class="section-eyebrow">{$_('landing.audience.eyebrow')}</p>
      <h2 id="audience-title" class="section-title">{$_('landing.audience.title')}</h2>
    </header>
    <div class="audience__grid">
      <article class="audience__card" data-reveal>
        <h3 class="audience__card-title">{$_('landing.audience.p1.title')}</h3>
        <p class="audience__card-text">{$_('landing.audience.p1.text')}</p>
        <a class="audience__card-link" href="/biblia">{$_('landing.audience.p1.cta')} →</a>
      </article>
      <article class="audience__card" data-reveal>
        <h3 class="audience__card-title">{$_('landing.audience.p2.title')}</h3>
        <p class="audience__card-text">{$_('landing.audience.p2.text')}</p>
        <a class="audience__card-link" href="/compara">{$_('landing.audience.p2.cta')} →</a>
      </article>
      <article class="audience__card" data-reveal>
        <h3 class="audience__card-title">{$_('landing.audience.p3.title')}</h3>
        <p class="audience__card-text">{$_('landing.audience.p3.text')}</p>
        <a class="audience__card-link" href="/biblia">{$_('landing.audience.p3.cta')} →</a>
      </article>
    </div>
  </section>

  <!-- ─── COMPARISON ─────────────────────────────────────────── -->
  <section class="compare" aria-labelledby="compare-title">
    <header class="section-header" data-reveal>
      <p class="section-eyebrow">{$_('landing.compare.eyebrow')}</p>
      <h2 id="compare-title" class="section-title">{$_('landing.compare.title')}</h2>
      <p class="section-lede">{$_('landing.compare.lede')}</p>
    </header>
    <div class="compare__table-wrap" data-reveal>
      <table class="compare__table">
        <thead>
          <tr>
            <th scope="col">{$_('landing.compare.feature')}</th>
            <th scope="col" class="compare__th--us">RoBible</th>
            <th scope="col">{$_('landing.compare.others')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{$_('landing.compare.row1')}</th>
            <td class="compare__yes">{$_('landing.compare.yes')}</td>
            <td class="compare__no">{$_('landing.compare.no')}</td>
          </tr>
          <tr>
            <th scope="row">{$_('landing.compare.row2')}</th>
            <td class="compare__yes">{$_('landing.compare.yes')}</td>
            <td class="compare__no">{$_('landing.compare.no')}</td>
          </tr>
          <tr>
            <th scope="row">{$_('landing.compare.row3')}</th>
            <td class="compare__yes">{$_('landing.compare.yes')}</td>
            <td class="compare__mixed">{$_('landing.compare.mixed')}</td>
          </tr>
          <tr>
            <th scope="row">{$_('landing.compare.row4')}</th>
            <td class="compare__yes">{$_('landing.compare.yes')}</td>
            <td class="compare__no">{$_('landing.compare.no')}</td>
          </tr>
          <tr>
            <th scope="row">{$_('landing.compare.row5')}</th>
            <td class="compare__no">{$_('landing.compare.no')}</td>
            <td class="compare__yes">{$_('landing.compare.yes')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- ─── FAQ ──────────────────────────────────────────────────── -->
  <section class="faq" aria-labelledby="faq-title">
    <header class="section-header" data-reveal>
      <p class="section-eyebrow">{$_('landing.faq.eyebrow')}</p>
      <h2 id="faq-title" class="section-title">{$_('landing.faq.title')}</h2>
    </header>
    <ul class="faq__list" data-reveal>
      {#each faqItems as item, i}
        <li class="faq__item">
          <button
            type="button"
            class="faq__q"
            aria-expanded={openFaqIdx === i}
            aria-controls={`faq-a-${i}`}
            id={`faq-q-${i}`}
            on:click={() => toggleFaq(i)}
          >
            <span>{$_(item.qKey)}</span>
            <span class="faq__plus" aria-hidden="true">{openFaqIdx === i ? '−' : '+'}</span>
          </button>
          <div
            class="faq__a"
            id={`faq-a-${i}`}
            role="region"
            aria-labelledby={`faq-q-${i}`}
            hidden={openFaqIdx !== i}
          >
            <p>{$_(item.aKey)}</p>
          </div>
        </li>
      {/each}
    </ul>
  </section>

  <!-- ─── FINAL CTA ──────────────────────────────────────────── -->
  <section class="final-cta" aria-labelledby="final-cta-title">
    <!-- Fondo fotográfico (cruz de madera contra el cielo). Decorativo: el
         degradado por encima garantiza el contraste del texto. -->
    <picture class="final-cta__bg" aria-hidden="true">
      <source srcset="/assets/img/landing/cruz.webp" type="image/webp" />
      <img src="/assets/img/landing/cruz.jpg" alt="" loading="lazy" width="1000" height="1334" />
    </picture>
    <div class="final-cta__inner" data-reveal>
      <h2 id="final-cta-title" class="final-cta__title">{$_('landing.final.title')}</h2>
      <p class="final-cta__text">{$_('landing.final.text')}</p>
      <a class="btn btn--primary btn--large" href="/biblia">
        {$_('landing.final.cta')}
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </a>
    </div>
  </section>

  <!-- ─── FOOTER ──────────────────────────────────────────────── -->
  <footer class="footer">
    <div class="footer__inner">
      <p class="footer__brand">RoBible</p>
      <p class="footer__tagline">{$_('landing.footer.tagline')}</p>
      <nav class="footer__nav" aria-label={$_('landing.footer.nav_aria')}>
        <a href="/biblia">{$_('landing.footer.bible')}</a>
        <a href="/compara">{$_('landing.footer.compare')}</a>
        <a href="/indice">{$_('landing.footer.index')}</a>
        <a href="/sitemap.xml">{$_('landing.footer.sitemap')}</a>
        <a href="https://github.com/dbindea/robible" rel="noopener">{$_('landing.footer.github')}</a>
      </nav>
      <p class="footer__attribution">{$_('app.footer.made_with_love')} · {$_('app.footer.maranata')}</p>
    </div>
  </footer>
</main>

<style>
  /* ── Tokens ───────────────────────────────────────────────
     La landing ya no define paleta propia: los `--landing-*` son alias de los
     tokens globales de public/global.css, que salieron precisamente de este
     diseño. Así la landing y la app comparten una única fuente de verdad y el
     modo oscuro funciona también aquí. */
  .landing {
    /* Único token propio: la landing usa monoespaciada en el demo de búsqueda.
       Todo lo demás sale de los tokens del sistema (public/global.css). */
    --landing-mono: ui-monospace, 'SF Mono', Menlo, monospace;
  }

  /* ── Base ─────────────────────────────────────────────────── */
  .landing {
    background: var(--color-page);
    color: var(--color-ink);
    font-family: var(--font-family-base);
    font-size: clamp(1rem, 1.05vw + 0.85rem, 1.125rem);
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'kern' 1, 'liga' 1, 'onum' 1;
    overflow-x: hidden;
    position: relative;
  }

  /* La textura de papel la pone ahora `body::before` en global.css, para toda
     la app. Aquí solo se mantiene el apilado del contenido por encima. */
  .landing > * {
    position: relative;
    z-index: 1;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .skip-link {
    position: absolute;
    top: -3rem;
    left: 0.5rem;
    z-index: 100;
    background: var(--color-ink);
    color: var(--color-page);
    padding: 0.5rem 1rem;
    text-decoration: none;
    border-radius: 0.2rem;
    font-family: var(--font-family-base);
    font-size: 0.875rem;
    transition: top 0.15s ease;
  }
  .skip-link:focus {
    top: 0.5rem;
  }

  /* ── Botones ─────────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.4rem;
    font-family: var(--font-family-base);
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.005em;
    text-decoration: none;
    border-radius: 0.2rem;
    transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .btn--primary {
    background: var(--color-ink);
    color: var(--color-page);
  }
  .btn--primary:hover,
  .btn--primary:focus-visible {
    background: var(--color-accent);
    color: var(--color-surface);
  }
  .btn--primary:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
  }
  .btn--ghost {
    background: transparent;
    color: var(--color-ink);
    border-color: var(--color-line);
  }
  .btn--ghost:hover,
  .btn--ghost:focus-visible {
    border-color: var(--color-ink);
    background: rgba(26, 35, 50, 0.04);
  }
  .btn--large {
    padding: 1rem 1.75rem;
    font-size: 1.05rem;
  }

  /* ── Section headers ────────────────────────────────────── */
  .section-header {
    max-width: 38rem;
    margin: 0 auto clamp(2.5rem, 5vw, 4rem);
    text-align: center;
  }
  .section-eyebrow {
    font-family: var(--font-family-base);
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--color-accent);
    margin: 0 0 0.75rem;
  }
  .section-title {
    font-family: var(--font-family-base);
    font-size: clamp(1.75rem, 3.4vw, 2.6rem);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.015em;
    margin: 0 0 0.75rem;
    color: var(--color-ink);
  }
  .section-lede {
    font-size: 1.05rem;
    color: var(--color-ink-soft);
    line-height: 1.55;
    margin: 0;
  }

  /* ── HERO ────────────────────────────────────────────────── */
  .hero {
    position: relative;
    min-height: min(100dvh, 56rem);
    display: flex;
    align-items: center;
    padding: clamp(4rem, 12vh, 7rem) clamp(1.25rem, 5vw, 4rem) clamp(3rem, 8vh, 5rem);
    border-bottom: 1px solid var(--color-line);
  }
  .hero__bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: linear-gradient(180deg, var(--color-page) 0%, var(--color-surface) 100%);
    opacity: 0.6;
  }
  .hero__inner {
    position: relative;
    z-index: 1;
    max-width: 78rem;
    margin: 0 auto;
    width: 100%;
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: clamp(2.5rem, 6vw, 5rem);
    align-items: center;
  }
  @media (max-width: 56rem) {
    .hero__inner {
      grid-template-columns: 1fr;
    }
  }
  /* ── Marca ────────────────────────────────────────────────────────────── */
  .hero__brand {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 1.75rem;
    text-decoration: none;
    color: var(--color-ink);

    img {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: var(--radius-md);
      box-shadow: var(--box-shadow-up);
    }
  }
  .hero__brand-name {
    font-size: 1.35rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .hero__brand:hover .hero__brand-name {
    color: var(--color-accent);
  }

  /* ── Columna derecha: foto + demo ─────────────────────────────────────── */
  .hero__aside {
    display: grid;
    gap: 1.25rem;
  }
  .hero__photo {
    margin: 0;
    overflow: hidden;
    border-radius: var(--radius-lg);
    box-shadow: var(--box-shadow-lg);
    line-height: 0;

    img {
      width: 100%;
      height: clamp(11rem, 22vw, 17rem);
      object-fit: cover;
      /* Un punto de brillo y saturación: la foto original es cálida y algo
         apagada, y la landing tiene que verse luminosa. */
      filter: brightness(1.06) saturate(1.05);
      transform: scale(1.01);
      transition: transform 0.6s ease;
    }

    &:hover img {
      transform: scale(1.04);
    }
  }
  /* En pantallas estrechas la foto no aporta y sí ocupa: se oculta. */
  @media (max-width: 56rem) {
    .hero__photo {
      display: none;
    }
  }

  .hero__eyebrow {
    font-family: var(--font-family-base);
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--color-accent);
    margin: 0 0 1.25rem;
  }
  .hero__title {
    font-family: var(--font-family-base);
    font-size: clamp(2.2rem, 5.5vw, 4.5rem);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.02em;
    margin: 0 0 1.5rem;
    color: var(--color-ink);
  }
  .hero__title::first-letter {
    /* Drop cap sólo en el primer carácter visual */
  }
  .hero__lede {
    font-size: clamp(1.05rem, 1.4vw, 1.25rem);
    line-height: 1.55;
    color: var(--color-ink-soft);
    margin: 0 0 2rem;
    max-width: 32rem;
  }
  .hero__cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0 0 2.5rem;
  }
  .hero__lang {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-family-base);
    font-size: 0.8rem;
  }
  .hero__lang-label {
    color: var(--color-ink-soft);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.7rem;
  }
  .hero__lang-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    gap: 0.35rem;
  }
  .hero__lang-btn {
    background: transparent;
    border: 1px solid var(--color-line);
    color: var(--color-ink-soft);
    padding: 0.25rem 0.55rem;
    border-radius: 0.2rem;
    font-family: var(--font-family-base);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .hero__lang-btn:hover {
    border-color: var(--color-ink);
    color: var(--color-ink);
  }
  .hero__lang-btn--active {
    background: var(--color-ink);
    color: var(--color-page);
    border-color: var(--color-ink);
  }

  .hero__scroll-hint {
    position: absolute;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    width: 1px;
    height: 3rem;
    background: var(--color-line);
    display: block;
    transition: opacity 0.3s;
  }
  .hero__scroll-hint::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1rem;
    background: var(--color-accent);
    animation: scroll-pulse 2s ease-in-out infinite;
  }
  @keyframes scroll-pulse {
    0%, 100% { transform: translateY(0); opacity: 1; }
    50% { transform: translateY(0.5rem); opacity: 0.4; }
  }

  /* ── DEMO ────────────────────────────────────────────────── */
  .demo {
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: 0.4rem;
    padding: clamp(1.25rem, 2.5vw, 1.75rem);
    box-shadow: var(--box-shadow-lg);
    position: relative;
  }
  .demo::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 0.4rem;
    background: linear-gradient(135deg, var(--color-accent) 0%, transparent 50%);
    opacity: 0.15;
    z-index: -1;
  }
  .demo__eyebrow {
    font-family: var(--font-family-base);
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--color-accent);
    margin: 0 0 0.5rem;
  }
  .demo__hint {
    font-size: 0.95rem;
    color: var(--color-ink-soft);
    margin: 0 0 1rem;
    line-height: 1.45;
  }
  .demo__form {
    display: flex;
    gap: 0.5rem;
  }
  .demo__label {
    flex: 1;
  }
  .demo__input {
    width: 100%;
    padding: 0.65rem 0.85rem;
    font-family: var(--landing-mono);
    font-size: 0.95rem;
    color: var(--color-ink);
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: 0.2rem;
    transition: border-color 0.15s, background 0.15s;
  }
  .demo__input:focus {
    outline: none;
    border-color: var(--color-ink);
    background: var(--color-surface);
  }
  .demo__btn {
    padding: 0.65rem 1.1rem;
    background: var(--color-ink);
    color: var(--color-page);
    border: none;
    border-radius: 0.2rem;
    font-family: var(--font-family-base);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .demo__btn:hover:not(:disabled) {
    background: var(--color-accent);
  }
  .demo__btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .demo__error {
    font-family: var(--font-family-base);
    font-size: 0.85rem;
    color: #b3261e;
    margin: 0.75rem 0 0;
  }
  .demo__result,
  .demo__list {
    margin: 1rem 0 0;
    padding: 0;
    list-style: none;
  }
  .demo__result {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 0.9rem;
    background: color-mix(in srgb, #28a745 8%, var(--color-surface));
    border: 1px solid color-mix(in srgb, #28a745 25%, transparent);
    border-radius: 0.2rem;
    border-left: 3px solid #28a745;
  }
  .demo__result-ref {
    font-family: var(--font-family-base);
    font-size: 0.95rem;
    color: var(--color-ink);
  }
  .demo__result-link {
    background: transparent;
    border: 1px solid var(--color-line);
    color: var(--color-ink);
    padding: 0.3rem 0.7rem;
    border-radius: 0.2rem;
    font-family: var(--font-family-base);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .demo__result-link:hover {
    border-color: var(--color-ink);
    background: rgba(26, 35, 50, 0.04);
  }
  .demo__list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .demo__list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid var(--color-line);
    border-radius: 0.2rem;
    font-family: var(--font-family-base);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    text-align: left;
  }
  .demo__list-item:hover {
    background: var(--color-surface);
    border-color: var(--color-ink-soft);
  }
  .demo__list-name {
    color: var(--color-ink);
  }
  .demo__list-ref {
    font-family: var(--landing-mono);
    font-size: 0.85rem;
    color: var(--color-accent);
  }

  /* ── STATS ───────────────────────────────────────────────── */
  .stats {
    padding: clamp(2.5rem, 5vw, 4rem) clamp(1.25rem, 5vw, 4rem);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-line);
  }
  .stats__list {
    max-width: 64rem;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }
  @media (max-width: 44rem) {
    .stats__list {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .stats__item {
    text-align: center;
    padding: 0.5rem;
  }
  .stats__value {
    font-family: var(--font-family-base);
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 600;
    line-height: 1;
    color: var(--color-ink);
    margin: 0;
    font-variant-numeric: oldstyle-nums;
  }
  .stats__label {
    font-family: var(--font-family-base);
    font-size: 0.72rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--color-ink-soft);
    margin: 0.5rem 0 0;
  }

  /* ── FEATURES ────────────────────────────────────────────── */
  .features {
    padding: clamp(4rem, 8vw, 6rem) clamp(1.25rem, 5vw, 4rem);
    max-width: 78rem;
    margin: 0 auto;
  }
  .features__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(1.5rem, 3vw, 2.5rem);
  }
  @media (max-width: 44rem) {
    .features__list {
      grid-template-columns: 1fr;
    }
  }
  .feature {
    border-top: 1px solid var(--color-line);
    padding: 1.5rem 0 0;
  }
  .feature__number {
    font-family: var(--landing-mono);
    font-size: 0.85rem;
    color: var(--color-accent);
    margin: 0 0 0.5rem;
  }
  .feature__title {
    font-family: var(--font-family-base);
    font-size: 1.35rem;
    font-weight: 600;
    line-height: 1.25;
    margin: 0 0 0.5rem;
    color: var(--color-ink);
  }
  .feature__text {
    color: var(--color-ink-soft);
    line-height: 1.55;
    margin: 0 0 0.75rem;
  }
  .feature__example {
    font-family: var(--landing-mono);
    font-size: 0.85rem;
    color: var(--color-accent);
    background: var(--color-surface);
    padding: 0.5rem 0.75rem;
    border-radius: 0.2rem;
    border-left: 2px solid var(--color-accent);
    margin: 0;
  }

  /* ── WHY ─────────────────────────────────────────────────── */
  .why {
    /* Antes era una banda oscura a todo el ancho: junto con .final-cta
       oscurecía media landing. Ahora es superficie clara con un borde
       superior de acento, que separa igual sin apagar la página. */
    background: var(--color-surface);
    border-top: 3px solid var(--color-accent);
    color: var(--color-ink);
    padding: clamp(4rem, 8vw, 6rem) clamp(1.25rem, 5vw, 4rem);
  }
  .why__inner {
    max-width: 78rem;
    margin: 0 auto;
  }
  .why :global(.section-eyebrow) {
    color: var(--color-accent);
  }
  .why :global(.section-title) {
    color: var(--color-ink);
  }
  .why :global(.section-lede) {
    color: var(--color-ink-soft);
  }
  .why__photo {
    margin: 0 0 clamp(2rem, 4vw, 3rem);
    overflow: hidden;
    border-radius: var(--radius-lg);
    box-shadow: var(--box-shadow-lg);
    line-height: 0;

    img {
      width: 100%;
      height: clamp(9rem, 20vw, 15rem);
      object-fit: cover;
      /* La foto original está muy oscura: se levanta para que acompañe a una
         sección clara en vez de abrir un agujero negro en la página. */
      filter: brightness(1.7) saturate(0.9) contrast(0.95);
      transform: scale(1.01);
      transition: transform 0.8s ease;
    }

    &:hover img {
      transform: scale(1.05);
    }
  }
  .why__list {
    list-style: none;
    padding: 0;
    margin: 3rem 0 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2.5rem;
  }
  @media (max-width: 44rem) {
    .why__list {
      grid-template-columns: 1fr;
      gap: 1.75rem;
    }
  }
  .why__item {
    border-top: 1px solid color-mix(in srgb, var(--color-accent-soft) 35%, transparent);
    padding-top: 1.25rem;
  }
  .why__item-title {
    font-family: var(--font-family-base);
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    color: var(--color-ink);
  }
  .why__item-text {
    color: var(--color-ink-soft);
    line-height: 1.55;
    margin: 0;
  }

  /* ── AUDIENCE ────────────────────────────────────────────── */
  .audience {
    padding: clamp(4rem, 8vw, 6rem) clamp(1.25rem, 5vw, 4rem);
    max-width: 78rem;
    margin: 0 auto;
  }
  .audience__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 56rem) {
    .audience__grid {
      grid-template-columns: 1fr;
    }
  }
  .audience__card {
    border: 1px solid var(--color-line);
    padding: 1.5rem;
    border-radius: 0.2rem;
    background: var(--color-surface);
    transition: border-color 0.2s, transform 0.2s;
  }
  .audience__card:hover {
    border-color: var(--color-accent);
    transform: translateY(-2px);
  }
  .audience__card-title {
    font-family: var(--font-family-base);
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
  }
  .audience__card-text {
    color: var(--color-ink-soft);
    line-height: 1.55;
    margin: 0 0 1rem;
  }
  .audience__card-link {
    font-family: var(--font-family-base);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-accent);
    text-decoration: none;
    position: relative;
    display: inline-block;
  }
  .audience__card-link::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 0;
    height: 1px;
    background: currentColor;
    transition: width 0.25s cubic-bezier(0.6, 0, 0.2, 1);
  }
  .audience__card-link:hover::after {
    width: calc(100% - 1em);
  }

  /* ── COMPARISON ─────────────────────────────────────────── */
  .compare {
    background: var(--color-surface);
    padding: clamp(4rem, 8vw, 6rem) clamp(1.25rem, 5vw, 4rem);
  }
  .compare__table-wrap {
    max-width: 60rem;
    margin: 0 auto;
    overflow-x: auto;
  }
  .compare__table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-family-base);
    font-size: 0.92rem;
  }
  .compare__table th,
  .compare__table td {
    padding: 0.85rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--color-line);
  }
  .compare__table thead th {
    font-weight: 600;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-ink-soft);
    border-bottom: 2px solid var(--color-ink);
  }
  .compare__table tbody th {
    font-weight: 500;
    color: var(--color-ink);
    width: 50%;
  }
  .compare__th--us {
    color: var(--color-accent) !important;
  }
  .compare__yes {
    color: #28a745;
    font-weight: 600;
  }
  .compare__no {
    color: #b3261e;
  }
  .compare__mixed {
    color: #b8763e;
    font-style: italic;
  }

  /* ── FAQ ─────────────────────────────────────────────────── */
  .faq {
    padding: clamp(4rem, 8vw, 6rem) clamp(1.25rem, 5vw, 4rem);
    max-width: 48rem;
    margin: 0 auto;
  }
  .faq__list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .faq__item {
    border-bottom: 1px solid var(--color-line);
  }
  .faq__q {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: transparent;
    border: none;
    padding: 1.25rem 0;
    text-align: left;
    font-family: var(--font-family-base);
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--color-ink);
    cursor: pointer;
    line-height: 1.4;
  }
  .faq__q:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 4px;
  }
  .faq__plus {
    font-size: 1.5rem;
    color: var(--color-accent);
    font-weight: 300;
    flex-shrink: 0;
    margin-left: 1rem;
  }
  .faq__a {
    padding: 0 0 1.25rem;
    color: var(--color-ink-soft);
    line-height: 1.6;
  }
  .faq__a p {
    margin: 0;
  }

  /* ── FINAL CTA ──────────────────────────────────────────── */
  /* Era la segunda banda oscura de la página. Ahora lleva la foto de la cruz
     de fondo con un velo claro encima: aporta luz e imagen religiosa, y el
     texto se mantiene en tinta con contraste de sobra. */
  .final-cta {
    position: relative;
    isolation: isolate;
    background: var(--color-surface);
    color: var(--color-ink);
    padding: clamp(4rem, 10vw, 7rem) clamp(1.25rem, 5vw, 4rem);
    text-align: center;
    overflow: hidden;
  }
  .final-cta__bg {
    position: absolute;
    inset: 0;
    z-index: -1;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: 62% 40%;
    }
  }
  /* Velo: sube el fondo a casi blanco en el centro para que el texto respire. */
  .final-cta::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: radial-gradient(
      ellipse at center,
      color-mix(in srgb, var(--color-surface) 92%, transparent) 0%,
      color-mix(in srgb, var(--color-surface) 78%, transparent) 55%,
      color-mix(in srgb, var(--color-surface) 88%, transparent) 100%
    );
  }
  .final-cta__inner {
    max-width: 42rem;
    margin: 0 auto;
  }
  .final-cta__title {
    font-family: var(--font-family-base);
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 600;
    line-height: 1.15;
    margin: 0 0 1rem;
    color: var(--color-ink);
    text-shadow: 0 1px 2px color-mix(in srgb, var(--color-surface) 70%, transparent);
  }
  .final-cta__text {
    color: var(--color-ink-soft);
    font-size: 1.1rem;
    line-height: 1.55;
    margin: 0 0 2rem;
  }
  .final-cta .btn--primary {
    background: var(--color-accent);
    color: #ffffff;
    box-shadow: var(--box-shadow-lg);
  }
  .final-cta .btn--primary:hover {
    background: var(--color-accent-hover);
    color: #ffffff;
  }

  /* ── FOOTER ──────────────────────────────────────────────── */
  .footer {
    background: var(--color-surface);
    border-top: 1px solid var(--color-line);
    padding: 2.5rem clamp(1.25rem, 5vw, 4rem);
  }
  .footer__inner {
    max-width: 78rem;
    margin: 0 auto;
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 1.5rem 2.5rem;
  }
  @media (max-width: 44rem) {
    .footer__inner {
      grid-template-columns: 1fr;
      text-align: center;
    }
  }
  .footer__brand {
    font-family: var(--font-family-base);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-ink);
    margin: 0;
    grid-row: 1 / 3;
  }
  @media (max-width: 44rem) {
    .footer__brand {
      grid-row: auto;
    }
  }
  .footer__tagline {
    color: var(--color-ink-soft);
    font-size: 0.92rem;
    margin: 0;
  }
  .footer__nav {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
  }
  @media (max-width: 44rem) {
    .footer__nav {
      justify-content: center;
    }
  }
  .footer__nav a {
    font-family: var(--font-family-base);
    font-size: 0.85rem;
    color: var(--color-ink-soft);
    text-decoration: none;
    position: relative;
    transition: color 0.15s;
  }
  .footer__nav a::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 0;
    height: 1px;
    background: var(--color-accent);
    transition: width 0.25s cubic-bezier(0.6, 0, 0.2, 1);
  }
  .footer__nav a:hover {
    color: var(--color-accent);
  }
  .footer__nav a:hover::after {
    width: 100%;
  }
  .footer__attribution {
    grid-column: 1 / -1;
    margin: 1rem 0 0;
    text-align: center;
    font-family: var(--font-family-base);
    font-size: 0.78rem;
    color: var(--color-ink-soft);
  }
  @media (max-width: 44rem) {
    .footer__attribution {
      grid-column: 1;
    }
  }

  /* ── Reveal on scroll (subtle, no opacity blocking) ────── */
  /* Aparición al hacer scroll: sube y funde. Antes solo desplazaba 0,5 rem,
     que casi no se percibía. */
  [data-reveal] {
    opacity: 0;
    transform: translateY(1.5rem);
    transition:
      opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }
  /* `is-visible` la añade el IntersectionObserver, no la plantilla, así que
     Svelte la daba por CSS muerto y podaba la regla entera: la animación de
     aparición nunca llegó a funcionar. `:global()` evita la poda. */
  [data-reveal]:global(.is-visible) {
    opacity: 1;
    transform: translateY(0);
  }

  /* Escalonado dentro de una lista: los elementos entran uno detrás de otro
     en vez de todos a la vez. */
  .why__item[data-reveal],
  .features__item[data-reveal],
  .audience__card[data-reveal] {
    &:nth-child(2) { transition-delay: 0.08s; }
    &:nth-child(3) { transition-delay: 0.16s; }
    &:nth-child(4) { transition-delay: 0.24s; }
    &:nth-child(5) { transition-delay: 0.32s; }
    &:nth-child(6) { transition-delay: 0.4s; }
  }

  @media (prefers-reduced-motion: reduce) {
    [data-reveal] {
      opacity: 1;
      transform: none;
      transition: none;
    }
    .hero__scroll-hint::before {
      animation: none;
    }
    .hero__photo img,
    .why__photo img {
      transition: none;
    }
  }

  /* ── Modo oscuro ──────────────────────────────────────────
     Ya no hay paleta oscura propia: los `--landing-*` son alias de los tokens
     globales, que cambian solos con html[data-theme='dark']. Antes esto forzaba
     un azul marino (#1A2332) que no pegaba con el marrón cálido del resto. */
  :global(html[data-theme='dark']) .demo__input {
    background: var(--color-surface-sunken);
    color: var(--color-ink);
    border-color: var(--color-line);
  }
</style>
