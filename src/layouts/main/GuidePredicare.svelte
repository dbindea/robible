<script>
  /**
   * Manual público de predicación (`/ghid-predicare`).
   *
   * Por qué existe: quien busca «cum se face o predică expozitivă» tiene que
   * encontrar algo antes de saber que la herramienta existe. Se enlaza desde
   * el menú de «Predicile mele» (en pestaña nueva, es para leer con calma) y
   * se indexa a propósito, como `/predici`.
   *
   * **No hay texto nuevo que pueda desincronizarse del que ya usa la
   * aplicación**: el timeline de los ocho pasos sale de las MISMAS claves que
   * `Ajutor.svelte` (`app.homiletics.*`) y las tres tarjetas de tipos, de las
   * mismas que `SeriesPicker`/`Sermons.svelte` (`app.sermons.type_*`). Si
   * cambia el texto del guía de dentro de la aplicación, cambia aquí también,
   * sin tocar este archivo.
   */
  import { _ } from '../../services/i18n.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import { STEPS } from '../../services/sermon-content.service';
  import { GUIA, vinetasDe, ejemploDe, tieneNotaDeTipo } from '../../config/homiletics';
  import Icon from '../../components/Icon.svelte';

  const TIPOS = ['expositive', 'textual', 'thematic'];
  const TIPOS_CON_NOTA = ['textual', 'thematic'];

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);

  /** Mismo HowTo que `/predici`, pero aquí es el contenido principal de la
   *  página y no un adorno al final. */
  $: esquemaMetodo = {
    '@type': 'HowTo',
    name: $_('app.sermons.guide.title'),
    description: $_('app.sermons.guide.lead'),
    totalTime: 'PT3H',
    step: STEPS.map((paso, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: $_(`app.sermons.step_${paso}`),
      text: $_(`app.homiletics.${paso}.why`),
    })),
  };

  $: applySeoMetadata({
    title: $_('app.sermons.guide.seo_title'),
    description: $_('app.sermons.guide.seo_description'),
    canonicalPath: '/ghid-predicare',
    versionConfig,
    robots: 'index, follow',
    schema: [esquemaMetodo],
  });

  const irA = (ruta) => {
    window.history.pushState(null, '', ruta);
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
</script>

<section class="ghid">
  <header class="ghid__cabecera">
    <p class="ghid__eyebrow">{$_('app.sermons.guide.eyebrow')}</p>
    <h1>{$_('app.sermons.guide.title')}</h1>
    <p class="ghid__lead">{$_('app.sermons.guide.lead')}</p>
  </header>

  <!-- ── Tres tipos, una sola regla ─────────────────────────────────────── -->
  <section class="ghid__tipos">
    <h2>{$_('app.sermons.guide.types_title')}</h2>
    <p class="ghid__tipos-lead">{$_('app.sermons.guide.types_lead')}</p>
    <div class="tipos-grid">
      {#each TIPOS as tipo (tipo)}
        <article class="tipo-tarjeta" class:tipo-tarjeta--base={tipo === 'expositive'}>
          <h3>{$_(`app.sermons.type_${tipo}`)}</h3>
          <p>{$_(`app.sermons.type_${tipo}_hint`)}</p>
        </article>
      {/each}
    </div>
  </section>

  <!-- ── El timeline vertical ────────────────────────────────────────────── -->
  <section class="ghid__timeline">
    <h2>{$_('app.sermons.guide.timeline_title')}</h2>
    <p class="ghid__tipos-lead">{$_('app.sermons.guide.timeline_lead')}</p>

    <ol class="timeline">
      {#each STEPS as paso, i (paso)}
        <li class="timeline__paso">
          <span class="timeline__num" aria-hidden="true">{i + 1}</span>
          <div class="timeline__cuerpo">
            <h3>{$_(`app.sermons.step_${paso}`)}</h3>
            <p class="timeline__why">{$_(`app.homiletics.${paso}.why`)}</p>

            {#if (GUIA[paso]?.bullets || 0) > 0}
              <ul class="timeline__lista">
                {#each vinetasDe(paso) as v (v)}
                  <li>{$_(`app.homiletics.${paso}.${v}`)}</li>
                {/each}
              </ul>
            {/if}

            {#if GUIA[paso]?.quote}
              <blockquote class="timeline__cita">{$_(`app.homiletics.${paso}.quote`)}</blockquote>
            {/if}

            {#if ejemploDe(paso).length}
              <div class="timeline__ejemplo">
                <p class="timeline__ejemplo-titulo">{$_('app.homiletics.example')}</p>
                {#each ejemploDe(paso) as e (e)}
                  <p>{$_(`app.homiletics.${paso}.${e}`)}</p>
                {/each}
              </div>
            {/if}

            {#if GUIA[paso]?.warn}
              <p class="timeline__aviso">{$_(`app.homiletics.${paso}.warn`)}</p>
            {/if}

            <!-- Lo que cambia según el tipo, las dos a la vez: es lo que
                 responde a «y en una textuală, y en una tematică» sin
                 obligar a leer el paso tres veces. -->
            {#each TIPOS_CON_NOTA as tipo (tipo)}
              {#if tieneNotaDeTipo(tipo, paso)}
                <p class="timeline__tipo">
                  <strong>{$_(`app.sermons.type_${tipo}`)}:</strong>
                  {$_(`app.homiletics.types.${tipo}.${paso}`)}
                </p>
              {/if}
            {/each}
          </div>
        </li>
      {/each}
    </ol>
  </section>

  <!-- ── Llamada a la acción ─────────────────────────────────────────────── -->
  <section class="ghid__cta">
    <h2>{$_('app.sermons.guide.cta_title')}</h2>
    <p>{$_('app.sermons.guide.cta_text')}</p>
    <a class="ghid__boton" href="/predicile-mele" on:click|preventDefault={() => irA('/predicile-mele')}>
      {$_('app.sermons.guide.cta_action')}
      <Icon name="arrow-right" size="0.9rem" />
    </a>
  </section>
</section>

<style lang="scss">
  .ghid {
    max-width: 46rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 4rem;
  }

  .ghid__cabecera {
    margin-bottom: 2.5rem;
    text-align: center;
  }

  .ghid__eyebrow {
    margin: 0 0 0.4rem;
    color: var(--color-accent-ink);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .ghid__cabecera h1 {
    margin: 0 0 0.6rem;
    font-size: var(--font-size-h1);
  }

  .ghid__lead {
    margin: 0 auto;
    max-width: 34rem;
    color: var(--color-ink-soft);
    font-size: 1.05rem;
    line-height: 1.55;
  }

  .ghid__tipos,
  .ghid__timeline,
  .ghid__cta {
    margin-bottom: 3rem;

    h2 {
      margin: 0 0 0.4rem;
      font-size: var(--font-size-h2);
    }
  }

  .ghid__tipos-lead {
    margin: 0 0 1.25rem;
    color: var(--color-ink-soft);
    line-height: 1.5;
  }

  .tipos-grid {
    display: grid;
    gap: 0.85rem;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  }

  .tipo-tarjeta {
    padding: 1rem 1.1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    background: var(--color-surface);

    h3 { margin: 0 0 0.4rem; font-size: 1.05rem; }
    p { margin: 0; color: var(--color-ink-soft); line-height: 1.45; font-size: 0.92rem; }

    // La expositiva es la que enseña el curso: se distingue con el acento,
    // sin decir que las otras dos sean menos válidas.
    &--base {
      border-color: var(--color-line-accent);
      background: var(--wash-accent);

      h3 { color: var(--color-accent-ink); }
    }
  }

  // ── El timeline vertical ──────────────────────────────────────────────
  .timeline {
    position: relative;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .timeline__paso {
    position: relative;
    display: flex;
    gap: 1rem;
    padding-bottom: 2rem;

    // La línea que une los círculos. Se dibuja contra la tinta, como manda el
    // sistema de diseño (CLAUDE.md), así que vale en las cinco paletas.
    &::before {
      content: '';
      position: absolute;
      left: 1.1rem;
      top: 2.3rem;
      bottom: 0;
      width: 2px;
      background: color-mix(in srgb, var(--color-ink) 14%, transparent);
    }

    &:last-child::before { display: none; }
    &:last-child { padding-bottom: 0; }
  }

  .timeline__num {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-weight: 700;
    z-index: 1;
  }

  .timeline__cuerpo {
    flex: 1 1 0;
    min-width: 0;
    padding-top: 0.2rem;

    h3 { margin: 0 0 0.4rem; font-size: 1.15rem; }
  }

  .timeline__why {
    margin: 0 0 0.6rem;
    font-weight: 600;
    line-height: 1.5;
  }

  .timeline__lista {
    margin: 0 0 0.6rem;
    padding-left: 1.1rem;
    color: var(--color-ink);
    line-height: 1.5;

    li { margin-bottom: 0.3rem; }
  }

  .timeline__cita {
    margin: 0.5rem 0;
    padding-left: 0.7rem;
    border-left: 3px solid var(--color-accent);
    color: var(--color-ink-soft);
    font-style: italic;
  }

  .timeline__ejemplo {
    margin: 0.6rem 0;
    padding: 0.65rem 0.8rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-surface);

    p { margin: 0 0 0.3rem; font-size: 0.9rem; line-height: 1.4; }
    p:last-child { margin-bottom: 0; }
  }

  .timeline__ejemplo-titulo {
    color: var(--color-ink-soft);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .timeline__aviso {
    margin: 0.6rem 0 0;
    font-weight: 700;
    color: var(--color-accent-ink);
  }

  .timeline__tipo {
    margin: 0.6rem 0 0;
    padding: 0.5rem 0.65rem;
    border-left: 3px solid var(--color-accent);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    background: var(--wash-accent);
    font-size: 0.92rem;
    line-height: 1.45;
  }

  .ghid__cta {
    padding: 1.75rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-lg);
    background: var(--wash-accent);
    text-align: center;

    p { margin: 0 0 1rem; color: var(--color-ink-soft); }
  }

  .ghid__boton {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.7rem 1.4rem;
    border-radius: var(--radius-pill);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-weight: 700;
    text-decoration: none;
    transition: var(--transition);

    &:hover { background: var(--color-accent-solid-hover); }
  }
</style>
