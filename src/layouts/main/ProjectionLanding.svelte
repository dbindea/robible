<script>
  /**
   * Página de presentación del Modo Proyección (`/proiectie-biserici`).
   *
   * A quién va dirigida: a la persona de una iglesia que decide qué se usa el
   * domingo, y que probablemente no sabe que esto existe ni que es gratis. Por
   * eso es una página pública e **indexable** —al revés que `/proiectie`, que
   * es la herramienta y va con `noindex`—: la búsqueda que se quiere capturar
   * es «proiecție versete biserică» y similares.
   *
   * Las ilustraciones son SVG escritos a mano aquí dentro, no imágenes. Tres
   * motivos: pesan unos pocos KB, se ven nítidas en cualquier pantalla, y se
   * pintan con los tokens de la paleta, así que la página no se rompe al
   * cambiar de tema —que es exactamente lo que le pasaría a un PNG con fondo
   * claro puesto sobre Noapte.
   *
   * No lleva `IntersectionObserver` a propósito. La landing grande sí lo usa, y
   * arrastra la trampa de que Svelte poda como CSS muerto las clases que añade
   * JavaScript si no van en `:global()`. Aquí las apariciones son CSS puro, así
   * que no hay nada que podar ni nada que empujar después de montar.
   */
  import { _ } from '../../services/i18n.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import { IMAGE_BACKGROUNDS, backgroundCss } from '../../services/verse-image.service';
  import Icon from '../../components/Icon.svelte';

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);

  $: applySeoMetadata({
    title: $_('app.projection_landing.seo_title'),
    description: $_('app.projection_landing.seo_description'),
    canonicalPath: '/proiectie-biserici',
    versionConfig,
    robots: 'index, follow',
  });

  const irAProyeccion = () => {
    window.history.pushState(null, '', '/proiectie');
    // La errata `robibile` es la del resto del proyecto (CLAUDE.md, trampa 1).
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Las seis tarjetas. En un array y no escritas a mano en la plantilla para
  // que añadir una sea una línea y no un bloque copiado.
  const VENTAJAS = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];
  const ICONOS = { f1: 'eye', f2: 'globe', f3: 'palette', f4: 'play', f5: 'search', f6: 'moon' };
</script>

<section class="pp">
  <!-- ── Portada ──────────────────────────────────────────────────────── -->
  <header class="hero">
    <div class="hero__texto">
      <p class="hero__eyebrow">{$_('app.projection_landing.eyebrow')}</p>
      <h1 class="hero__titulo">{$_('app.projection_landing.title')}</h1>
      <p class="hero__lead">{$_('app.projection_landing.lead')}</p>
      <button type="button" class="cta" on:click={irAProyeccion}>
        <Icon name="expand" />
        {$_('app.projection_landing.cta')}
      </button>
      <p class="hero__pista">{$_('app.projection_landing.cta_hint')}</p>
    </div>

    <!-- Maqueta de la pantalla: es lo que vende la función, así que enseña
         exactamente lo que se verá —dos idiomas, el principal grande— y no una
         ilustración abstracta. -->
    <div class="hero__maqueta">
      <svg viewBox="0 0 520 330" role="img" aria-labelledby="maqueta-titulo" class="maqueta">
        <title id="maqueta-titulo">{$_('app.projection_landing.f2_title')}</title>
        <defs>
          <linearGradient id="pantalla" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1D3040" />
            <stop offset="55%" stop-color="#131E29" />
            <stop offset="100%" stop-color="#0A1017" />
          </linearGradient>
          <linearGradient id="halo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#7EC8E3" stop-opacity="0.22" />
            <stop offset="100%" stop-color="#7EC8E3" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- Marco del televisor -->
        <rect x="14" y="10" width="492" height="278" rx="12" fill="#0f1319" />
        <rect x="22" y="18" width="476" height="262" rx="7" fill="url(#pantalla)" />
        <rect x="22" y="18" width="476" height="120" rx="7" fill="url(#halo)" />

        <!-- Texto principal: dos líneas de "versículo" -->
        <rect x="70" y="86" width="380" height="15" rx="7.5" fill="#EDF3F7" opacity="0.93" />
        <rect x="104" y="112" width="312" height="15" rx="7.5" fill="#EDF3F7" opacity="0.93" />

        <!-- Segundo idioma: más pequeño, más tenue y debajo -->
        <rect x="128" y="152" width="264" height="9" rx="4.5" fill="#EDF3F7" opacity="0.5" />
        <rect x="152" y="169" width="216" height="9" rx="4.5" fill="#EDF3F7" opacity="0.5" />

        <!-- Referencia, en el ámbar del fondo `night` -->
        <rect x="206" y="206" width="108" height="11" rx="5.5" fill="#7EC8E3" opacity="0.92" />

        <!-- Pie y soporte -->
        <rect x="232" y="288" width="56" height="20" rx="3" fill="#0f1319" />
        <rect x="186" y="308" width="148" height="9" rx="4.5" fill="#0f1319" />
      </svg>
    </div>
  </header>

  <!-- ── Ventajas ─────────────────────────────────────────────────────── -->
  <ul class="ventajas">
    {#each VENTAJAS as v (v)}
      <li class="ventaja">
        <span class="ventaja__icono" aria-hidden="true"><Icon name={ICONOS[v]} /></span>
        <h2 class="ventaja__titulo">{$_(`app.projection_landing.${v}_title`)}</h2>
        <p class="ventaja__texto">{$_(`app.projection_landing.${v}_text`)}</p>
      </li>
    {/each}
  </ul>

  <!-- ── Los fondos, de verdad ────────────────────────────────────────── -->
  <!-- No es una ilustración: son los nueve fondos reales, pintados con el mismo
       CSS que usa la proyección. Si mañana se añade uno, aparece aquí solo. -->
  <section class="fondos">
    <h2 class="seccion__titulo">{$_('app.projection_landing.f3_title')}</h2>
    <p class="seccion__texto">{$_('app.projection_landing.f3_text')}</p>
    <div class="fondos__rejilla" aria-hidden="true">
      {#each IMAGE_BACKGROUNDS as b (b.key)}
        <span class="fondos__muestra" style="background: {backgroundCss(b)}"></span>
      {/each}
    </div>
  </section>

  <!-- ── Cómo se hace ─────────────────────────────────────────────────── -->
  <section class="como">
    <h2 class="seccion__titulo">{$_('app.projection_landing.how_title')}</h2>

    <div class="como__cuerpo">
      <ol class="pasos">
        <li><span class="pasos__n">1</span><span>{$_('app.projection_landing.how_1')}</span></li>
        <li><span class="pasos__n">2</span><span>{$_('app.projection_landing.how_2')}</span></li>
        <li><span class="pasos__n">3</span><span>{$_('app.projection_landing.how_3')}</span></li>
      </ol>

      <!-- Diagrama: portátil, cable y pantalla. Con `currentColor` hereda la
           tinta de la página, así que funciona en las cinco paletas sin una
           sola regla por tema. -->
      <svg viewBox="0 0 420 180" role="img" aria-labelledby="diagrama-titulo" class="diagrama">
        <title id="diagrama-titulo">{$_('app.projection_landing.how_title')}</title>
        <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <!-- Portátil -->
          <rect x="18" y="52" width="110" height="70" rx="6" />
          <path d="M8 130h130l-10-8H18z" />
          <path d="M40 74h66M40 88h48" stroke-width="4" opacity="0.45" />

          <!-- Cable -->
          <path d="M136 96c46 0 44-44 88-44" stroke-dasharray="6 7" opacity="0.65" />

          <!-- Pantalla grande -->
          <rect x="228" y="24" width="176" height="106" rx="7" />
          <path d="M300 130v18M272 148h56" />
          <path d="M254 58h124M272 76h88" stroke-width="5" opacity="0.5" />
          <path d="M292 98h48" stroke-width="4" opacity="0.3" />
        </g>
      </svg>
    </div>
  </section>

  <!-- ── Gratis ───────────────────────────────────────────────────────── -->
  <section class="gratis">
    <h2 class="seccion__titulo">{$_('app.projection_landing.free_title')}</h2>
    <p class="seccion__texto">{$_('app.projection_landing.free_text')}</p>
    <button type="button" class="cta" on:click={irAProyeccion}>
      <Icon name="expand" />
      {$_('app.projection_landing.cta')}
    </button>
  </section>
</section>

<style lang="scss">
  .pp {
    width: 100%;
    max-width: 62rem;
    margin: 0 auto;
    padding: 0 0 4rem;
  }

  // ── Portada ───────────────────────────────────────────────────────────────
  .hero {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
    align-items: center;
    gap: clamp(1.5rem, 4vw, 3rem);
    margin-bottom: clamp(2rem, 6vw, 3.5rem);
    padding: clamp(1.5rem, 5vw, 2.75rem);
    border: 1px solid var(--color-line);
    border-radius: 0.75rem;
    background: var(--color-surface);
    box-shadow: var(--box-shadow-lg);
    animation: entra var(--motion-slow, 260ms) var(--ease-out) both;
  }

  .hero__eyebrow {
    display: inline-block;
    margin: 0 0 0.5rem;
    padding: 0.2rem 0.7rem;
    border-radius: var(--radius-pill);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .hero__titulo {
    margin: 0 0 0.75rem;
    color: var(--color-ink-strong);
    font-size: clamp(1.9rem, 4.5vw, 2.9rem);
    line-height: 1.1;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }

  .hero__lead {
    margin: 0 0 1.25rem;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    line-height: var(--line-height-body);
  }

  .hero__pista {
    margin: 0.6rem 0 0;
    color: var(--color-ink-soft);
    font-size: 0.82rem;
  }

  .maqueta {
    width: 100%;
    height: auto;
    // El SVG ya trae sus propios colores (es una pantalla apagada en una
    // habitación), así que no hereda la tinta. La sombra le da el relieve que
    // hace que se lea como un televisor y no como un rectángulo.
    filter: drop-shadow(0 18px 32px rgba(0, 0, 0, 0.28));
    max-width: none;
  }

  .cta {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.9rem;
    padding: 0.7rem 1.5rem;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-pill);
    // Relleno de acento: lleva texto encima y `--color-accent` sólo da 3.30:1.
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font: inherit;
    font-size: 1.02rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
    --icon-size: 1.1rem;

    &:hover { background: var(--color-accent-solid-hover); transform: translateY(-1px); }
  }

  // ── Ventajas ──────────────────────────────────────────────────────────────
  .ventajas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1rem;
    margin: 0 0 clamp(2rem, 6vw, 3.5rem);
    padding: 0;
    list-style: none;
  }

  .ventaja {
    padding: 1.25rem 1.35rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    transition: var(--transition);

    &:hover { border-color: var(--color-accent); transform: translateY(-2px); }
  }

  .ventaja__icono {
    display: inline-flex;
    margin-bottom: 0.6rem;
    padding: 0.5rem;
    border-radius: var(--radius-md);
    background: var(--wash-accent);
    color: var(--color-accent-ink);
    --icon-size: 1.3rem;
  }

  .ventaja__titulo {
    margin: 0 0 0.35rem;
    color: var(--color-ink-strong);
    font-size: 1.05rem;
    line-height: 1.25;
  }

  .ventaja__texto {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: 0.92rem;
    line-height: 1.55;
  }

  // ── Secciones ─────────────────────────────────────────────────────────────
  .seccion__titulo {
    margin: 0 0 0.5rem;
    color: var(--color-ink-strong);
    font-size: clamp(1.3rem, 3vw, 1.8rem);
    line-height: 1.2;
  }

  .seccion__texto {
    margin: 0 0 1.25rem;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    line-height: var(--line-height-body);
  }

  .fondos,
  .como,
  .gratis {
    margin-bottom: clamp(2rem, 6vw, 3.5rem);
    padding: clamp(1.25rem, 4vw, 2rem);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .fondos__rejilla {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr));
    gap: 0.6rem;
  }

  .fondos__muestra {
    display: block;
    height: 4.5rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
  }

  .como__cuerpo {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
    align-items: center;
    gap: clamp(1rem, 4vw, 2.5rem);
  }

  .pasos {
    display: grid;
    gap: 0.9rem;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 0.75rem;
      color: var(--color-ink);
      font-size: 1rem;
      line-height: 1.5;
    }
  }

  .pasos__n {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-weight: 700;
  }

  .diagrama {
    width: 100%;
    height: auto;
    // `currentColor` en los trazos: hereda esta tinta y funciona en las cinco
    // paletas sin una sola regla por tema.
    color: var(--color-accent);
    max-width: none;
  }

  .gratis { text-align: center; }

  @keyframes entra {
    from { opacity: 0; transform: translateY(0.75rem); }
    to { opacity: 1; transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero { animation: none; }
    .ventaja:hover,
    .cta:hover { transform: none; }
  }
</style>
