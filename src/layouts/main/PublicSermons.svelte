<script>
  /**
   * Blog de predicaciones publicadas (`/predici`).
   *
   * Es la portada del contenido público del módulo: aquí se encuentran, y en
   * `/predica/<slug>` se leen. Sin cuenta, sin nada del autor.
   *
   * **Se indexa a propósito**, igual que la predicación suelta: el sentido de
   * publicar es que alguien que busca «predică expozitivă» acabe aquí. Por eso
   * los filtros no cambian la URL con parámetros —serían mil variantes de la
   * misma página para el buscador— y se resuelven en el navegador sobre la
   * lista ya descargada, que son cabeceras y no predicaciones enteras.
   *
   * El bloque del método al final no es relleno de SEO: es la respuesta a «cómo
   * se hace una predicación expositiva», que es lo que teclea quien llega aquí
   * sin saber todavía que existe la herramienta. Se arma con las MISMAS claves
   * que el guía de dentro de la aplicación (`app.homiletics.*`), así que no hay
   * dos textos que puedan desincronizarse.
   */
  import { onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { fetchPublicSermons } from '../../services/sermons.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import { STEPS } from '../../services/sermon-content.service';
  import Icon from '../../components/Icon.svelte';

  export let map = {};

  let predicas = [];
  let cargando = true;

  let busqueda = '';
  let tema = '';
  let libro = '';
  let anio = '';
  let pagina = 1;

  // Nueve por página: tres filas de tres en escritorio, y en el móvil una
  // tirada que se recorre sin cansarse.
  const POR_PAGINA = 9;

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);

  /**
   * Datos estructurados de tipo HowTo para «cómo se hace una predicación
   * expositiva». Es la forma que entiende el buscador de que esta página
   * responde a una pregunta con pasos, y sale de las mismas claves que el
   * bloque visible: si cambia el texto, cambian los dos a la vez.
   */
  $: esquemaMetodo = {
    '@type': 'HowTo',
    name: $_('app.sermons.blog.guide_title'),
    description: $_('app.sermons.blog.guide_lead'),
    totalTime: 'PT3H',
    step: STEPS.map((paso, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: $_(`app.sermons.step_${paso}`),
      text: $_(`app.homiletics.${paso}.why`),
    })),
  };

  $: applySeoMetadata({
    title: $_('app.sermons.blog.seo_title'),
    description: $_('app.sermons.blog.seo_description'),
    canonicalPath: '/predici',
    versionConfig,
    robots: 'index, follow',
    schema: [esquemaMetodo],
  });

  const referenciaDe = (p) => {
    const nombre = map[p.book] || '';
    if (!nombre || !p.chapter) return '';
    const fin = p.verseEnd && p.verseEnd !== p.verseStart ? `-${p.verseEnd}` : '';
    return `${nombre} ${p.chapter}:${p.verseStart}${fin}`;
  };

  const anioDe = (p) => (p.publishedAt ? String(p.publishedAt).slice(0, 4) : '');

  const fechaLarga = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // ── Ejes de navegación ──────────────────────────────────────────────────
  //
  // Se calculan de lo que hay publicado, no de una lista fija: un desplegable
  // con los 66 libros donde sólo cuatro tienen predicaciones son sesenta y dos
  // callejones sin salida.
  $: temas = [...new Set(predicas.map((p) => p.series).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  $: cuentaPorTema = predicas.reduce((acc, p) => {
    if (p.series) acc[p.series] = (acc[p.series] || 0) + 1;
    return acc;
  }, {});
  $: libros = [...new Set(predicas.map((p) => p.book))]
    .filter((b) => map[b])
    // Por orden canónico, que es como el predicador tiene la Biblia en la
    // cabeza; alfabético mezclaría Geneza con Galateni.
    .sort((a, b) => a - b);
  $: anios = [...new Set(predicas.map(anioDe).filter(Boolean))].sort((a, b) => b.localeCompare(a));

  $: visibles = predicas
    .filter((p) => {
      if (tema && p.series !== tema) return false;
      if (libro !== '' && String(p.book) !== String(libro)) return false;
      if (anio && anioDe(p) !== anio) return false;
      if (busqueda.trim()) {
        // Título, idea central y referencia: lo que alguien recordaría de una
        // predicación que ya ha visto.
        const heno = `${p.title} ${p.idea || ''} ${p.series || ''} ${referenciaDe(p)}`.toLowerCase();
        if (!heno.includes(busqueda.trim().toLowerCase())) return false;
      }
      return true;
    })
    // Agrupadas por tema y, dentro de cada uno, de la más reciente a la más
    // antigua. Las que no tienen tema van al final: son las sueltas.
    .sort((a, b) => {
      const ta = a.series || '￿';
      const tb = b.series || '￿';
      if (ta !== tb) return ta.localeCompare(tb);
      return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
    });

  $: totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  // Al filtrar, la página en la que estabas puede dejar de existir.
  $: if (pagina > totalPaginas) pagina = 1;
  $: enPagina = visibles.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  /**
   * Marca la primera predicación de cada tema dentro de la página, para poder
   * pintar el encabezado del grupo. Se calcula sobre la página y no sobre la
   * lista entera porque el encabezado tiene que repetirse si un grupo se parte
   * entre dos páginas: si no, la segunda mitad aparecería huérfana.
   */
  $: conCabecera = enPagina.map((p, i) => ({
    p,
    abreGrupo: i === 0 || (enPagina[i - 1].series || '') !== (p.series || ''),
  }));

  $: hayFiltros = !!(busqueda.trim() || tema || libro !== '' || anio);

  const limpiar = () => {
    busqueda = '';
    tema = '';
    libro = '';
    anio = '';
    pagina = 1;
  };

  const elegirTema = (t) => {
    tema = tema === t ? '' : t;
    pagina = 1;
  };

  const irAPagina = (n) => {
    pagina = Math.min(Math.max(1, n), totalPaginas);
    document.querySelector('.blog__lista')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const abrir = (slug) => {
    window.history.pushState(null, '', `/predica/${encodeURIComponent(slug)}`);
    // La errata `robibile` es la del resto del proyecto (CLAUDE.md, trampa 1).
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  onMount(async () => {
    predicas = (await fetchPublicSermons()) || [];
    cargando = false;
  });
</script>

<div class="blog">
  <!-- ── Portada ────────────────────────────────────────────────────────── -->
  <section class="portada">
    <div class="portada__texto">
      <p class="portada__eyebrow">{$_('app.sermons.blog.eyebrow')}</p>
      <h1 class="portada__titulo">{$_('app.sermons.blog.title')}</h1>
      <p class="portada__lead">{$_('app.sermons.blog.lead')}</p>
      <a class="portada__cta" href="/predicile-mele">
        <Icon name="lectern" size="1rem" />
        {$_('app.sermons.blog.guide_cta')}
      </a>
    </div>
    <figure class="portada__foto" aria-hidden="true">
      <picture>
        <source srcset="/assets/img/landing/libro-abierto-vela.webp" type="image/webp" />
        <img src="/assets/img/landing/libro-abierto-vela.jpg" alt="" width="1000" height="667" loading="eager" />
      </picture>
    </figure>
  </section>

  {#if cargando}
    <p class="blog__estado" role="status">{$_('app.loading')}</p>
  {:else if !predicas.length}
    <p class="blog__estado">{$_('app.sermons.blog.empty')}</p>
  {:else}
    <!-- ── Temas ──────────────────────────────────────────────────────── -->
    {#if temas.length}
      <nav class="temas" aria-label={$_('app.sermons.blog.themes_title')}>
        <p class="temas__titulo">{$_('app.sermons.blog.themes_title')}</p>
        <div class="temas__chips">
          <button
            type="button"
            class="tema-chip"
            class:tema-chip--activo={!tema}
            on:click={() => elegirTema('')}
          >{$_('app.sermons.blog.all_themes')}</button>
          {#each temas as t (t)}
            <button
              type="button"
              class="tema-chip"
              class:tema-chip--activo={tema === t}
              aria-pressed={tema === t}
              on:click={() => elegirTema(t)}
            >
              <span aria-hidden="true">#</span>{t}
              <span class="tema-chip__n">{cuentaPorTema[t]}</span>
            </button>
          {/each}
        </div>
      </nav>
    {/if}

    <!-- ── Filtros finos ──────────────────────────────────────────────── -->
    <div class="filtros">
      <label class="filtros__buscar">
        <span class="filtros__icono"><Icon name="search" /></span>
        <input
          type="search"
          bind:value={busqueda}
          placeholder={$_('app.sermons.blog.search_placeholder')}
          on:input={() => (pagina = 1)}
        />
      </label>

      <div class="filtros__selects">
        <label>
          <span>{$_('app.sermons.blog.by_text')}</span>
          <select bind:value={libro} on:change={() => (pagina = 1)}>
            <option value="">{$_('app.sermons.blog.all')}</option>
            {#each libros as b (b)}<option value={String(b)}>{map[b]}</option>{/each}
          </select>
        </label>

        {#if anios.length > 1}
          <label>
            <span>{$_('app.sermons.blog.by_date')}</span>
            <select bind:value={anio} on:change={() => (pagina = 1)}>
              <option value="">{$_('app.sermons.blog.all')}</option>
              {#each anios as a (a)}<option value={a}>{a}</option>{/each}
            </select>
          </label>
        {/if}
      </div>

      <p class="filtros__resumen">
        <!-- Par singular/plural elegido en la llamada, como el resto del
             proyecto (ver app.topics.verse_count). -->
        {visibles.length === 1
          ? $_('app.sermons.blog.count_one', { count: visibles.length })
          : $_('app.sermons.blog.count', { count: visibles.length })}
        {#if hayFiltros}
          <button type="button" class="filtros__limpiar" on:click={limpiar}>
            {$_('app.sermons.blog.clear')}
          </button>
        {/if}
      </p>
    </div>

    <!-- ── Lista agrupada ─────────────────────────────────────────────── -->
    {#if !visibles.length}
      <p class="blog__estado">{$_('app.sermons.blog.no_results')}</p>
    {:else}
      <div class="blog__lista">
        {#each conCabecera as { p, abreGrupo } (p.slug)}
          {#if abreGrupo}
            <h2 class="grupo">
              {#if p.series}
                <span class="grupo__almohadilla" aria-hidden="true">#</span>{p.series}
              {:else}
                {$_('app.sermons.blog.no_theme')}
              {/if}
            </h2>
          {/if}

          <article class="tarjeta">
            <a
              class="tarjeta__enlace"
              href={'/predica/' + encodeURIComponent(p.slug)}
              on:click|preventDefault={() => abrir(p.slug)}
            >
              <p class="tarjeta__ref">{referenciaDe(p)}</p>
              <h3 class="tarjeta__titulo">{p.title}</h3>
              {#if p.idea}<p class="tarjeta__idea">{p.idea}</p>{/if}
              <p class="tarjeta__meta">
                <span>
                  {p.points === 1
                    ? $_('landing.sermons.point', { count: p.points })
                    : $_('landing.sermons.points', { count: p.points })}
                </span>
                {#if p.publishedAt}
                  <span aria-hidden="true">·</span>
                  <span>{fechaLarga(p.publishedAt)}</span>
                {/if}
              </p>
            </a>
          </article>
        {/each}
      </div>

      {#if totalPaginas > 1}
        <nav class="paginacion" aria-label={$_('app.sermons.blog.page_of', { current: pagina, total: totalPaginas })}>
          <button type="button" disabled={pagina === 1} on:click={() => irAPagina(pagina - 1)}>
            ← {$_('app.sermons.blog.page_prev')}
          </button>
          <span>{$_('app.sermons.blog.page_of', { current: pagina, total: totalPaginas })}</span>
          <button type="button" disabled={pagina === totalPaginas} on:click={() => irAPagina(pagina + 1)}>
            {$_('app.sermons.blog.page_next')} →
          </button>
        </nav>
      {/if}
    {/if}
  {/if}

  <!-- ── El método ──────────────────────────────────────────────────────
       Responde a «cómo se hace una predicación expositiva», que es lo que
       busca quien llega aquí sin conocer todavía la herramienta. Los siete
       pasos y su explicación salen de las mismas claves que el guía de dentro
       de la aplicación: un solo texto que mantener. -->
  <section class="metodo" aria-labelledby="metodo-title">
    <h2 id="metodo-title" class="metodo__titulo">{$_('app.sermons.blog.guide_title')}</h2>
    <p class="metodo__lead">{$_('app.sermons.blog.guide_lead')}</p>

    <ol class="metodo__pasos">
      {#each STEPS as paso, i (paso)}
        <li class="paso">
          <span class="paso__num" aria-hidden="true">{i + 1}</span>
          <div>
            <h3 class="paso__titulo">{$_(`app.sermons.step_${paso}`)}</h3>
            <p class="paso__texto">{$_(`app.homiletics.${paso}.why`)}</p>
          </div>
        </li>
      {/each}
    </ol>

    <a class="metodo__cta" href="/predicile-mele">{$_('app.sermons.blog.guide_cta')} →</a>
  </section>
</div>

<style lang="scss">
  .blog {
    width: 100%;
    max-width: 62rem;
    margin: 0 auto;
    padding: 0 0 4rem;
  }

  // ── Portada ───────────────────────────────────────────────────────────────
  .portada {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
    gap: clamp(1.25rem, 4vw, 2.5rem);
    align-items: center;
    margin-bottom: clamp(1.5rem, 4vw, 2.5rem);
    padding: clamp(1.5rem, 5vw, 3rem);
    border: 1px solid var(--color-line);
    border-radius: 0.5rem;
    background: var(--color-surface);
    box-shadow: var(--box-shadow-lg);
    // Aparece al cargar. Discreta: 260 ms y un dedo de desplazamiento, que es
    // el mismo lenguaje que la landing.
    animation: portada-entra var(--motion-slow, 260ms) var(--ease-out) both;
  }

  @keyframes portada-entra {
    from { opacity: 0; transform: translateY(0.75rem); }
    to { opacity: 1; transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .portada { animation: none; }
  }

  .portada__eyebrow {
    margin: 0 0 0.35rem;
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .portada__titulo {
    margin: 0 0 0.6rem;
    color: var(--color-ink-strong);
    font-size: clamp(2rem, 6vw, 3rem);
    line-height: 1.08;
    letter-spacing: -0.01em;
  }

  .portada__lead {
    margin: 0 0 1.25rem;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    line-height: var(--line-height-body);
  }

  .portada__cta {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.65rem 1.3rem;
    border-radius: var(--radius-md);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-weight: 700;
    text-decoration: none;
    transition: var(--transition);
    --icon-size: 1rem;

    &:hover { background: var(--color-accent-solid-hover); text-decoration: none; }
  }

  .portada__foto {
    margin: 0;
    border-radius: 0.4rem;
    overflow: hidden;
    /* Sin la relación fija, la foto marca el alto de la portada y en móvil se
       come la pantalla entera antes de llegar al primer sermón. */
    aspect-ratio: 3 / 2;

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .blog__estado {
    padding: 3rem 1rem;
    color: var(--color-ink-soft);
    text-align: center;
  }

  // ── Temas ─────────────────────────────────────────────────────────────────
  .temas { margin-bottom: 1.25rem; }

  .temas__titulo {
    margin: 0 0 0.5rem;
    color: var(--color-ink-soft);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .temas__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .tema-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 1.9rem;
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    color: var(--color-ink-soft);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);

    span[aria-hidden] { opacity: 0.5; }

    &:hover { border-color: var(--color-accent); color: var(--color-accent-ink); }

    &--activo {
      border-color: var(--color-accent);
      background: var(--color-accent-solid);
      color: var(--color-on-primary);

      span[aria-hidden] { opacity: 0.75; }
      &:hover { background: var(--color-accent-solid-hover); color: var(--color-on-primary); }
    }
  }

  .tema-chip__n {
    padding: 0 0.35rem;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, currentcolor 15%, transparent);
    font-size: 0.72rem;
  }

  // ── Filtros ───────────────────────────────────────────────────────────────
  .filtros {
    display: grid;
    gap: 0.7rem;
    margin-bottom: 1.75rem;
    padding: 0.9rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .filtros__buscar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: var(--color-field);
    --icon-size: 1rem;

    &:focus-within { border-color: var(--color-accent); }

    input {
      flex: 1;
      min-width: 0;
      border: 0;
      background: transparent;
      color: var(--color-ink);
      font: inherit;
      font-size: var(--font-size-small);

      &:focus-visible { outline: none; }
    }
  }

  .filtros__icono {
    display: inline-flex;
    color: var(--color-ink-soft);
  }

  .filtros__selects {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.6rem;

    label {
      display: grid;
      gap: 0.2rem;
      font-size: var(--font-size-tiny);
      font-weight: 600;
      color: var(--color-ink-soft);
    }

    select {
      padding: 0.4rem 0.55rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-field);
      color: var(--color-ink);
      font: inherit;
      font-size: var(--font-size-small);
    }
  }

  .filtros__resumen {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-tiny);
    font-weight: 600;
  }

  .filtros__limpiar {
    min-height: 1.5rem;
    padding: 0.2rem 0.6rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-pill);
    background: var(--wash-accent);
    color: var(--color-accent-ink);
    font: inherit;
    font-size: var(--font-size-tiny);
    font-weight: 700;
    cursor: pointer;
  }

  // ── Lista ─────────────────────────────────────────────────────────────────
  .blog__lista {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: 0.9rem;
  }

  /* El encabezado de grupo ocupa la fila entera: si compartiera celda con una
     tarjeta, los temas se mezclarían visualmente. */
  .grupo {
    grid-column: 1 / -1;
    margin: 0.75rem 0 0;
    color: var(--color-ink-strong);
    font-size: 1.15rem;
    line-height: 1.2;

    &:first-child { margin-top: 0; }
  }

  .grupo__almohadilla {
    color: var(--color-accent);
    opacity: 0.65;
  }

  .tarjeta { margin: 0; }

  .tarjeta__enlace {
    display: block;
    height: 100%;
    padding: 1.1rem 1.2rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    color: inherit;
    text-decoration: none;
    transition: border-color var(--motion-base), transform var(--motion-base), box-shadow var(--motion-base);

    &:hover {
      border-color: var(--color-accent);
      transform: translateY(-2px);
      box-shadow: var(--box-shadow-up);
      text-decoration: none;
    }
  }

  .tarjeta__ref {
    margin: 0 0 0.2rem;
    color: var(--color-accent-ink);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .tarjeta__titulo {
    margin: 0 0 0.35rem;
    color: var(--color-ink-strong);
    font-size: 1.1rem;
    line-height: 1.25;
  }

  .tarjeta__idea {
    margin: 0 0 0.5rem;
    color: var(--color-ink-soft);
    font-size: 0.9rem;
    font-style: italic;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .tarjeta__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.4rem;
    margin: 0;
    color: var(--color-ink-soft);
    font-size: 0.76rem;
    font-weight: 600;
  }

  // ── Paginación ────────────────────────────────────────────────────────────
  .paginacion {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.9rem;
    margin-top: 1.75rem;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
    font-weight: 600;

    button {
      min-height: 2.25rem;
      padding: 0.45rem 1rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);

      &:disabled { opacity: 0.35; cursor: not-allowed; }
      &:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent-ink); }
    }
  }

  // ── El método ─────────────────────────────────────────────────────────────
  .metodo {
    margin-top: clamp(2.5rem, 6vw, 4rem);
    padding: clamp(1.5rem, 5vw, 2.5rem);
    border: 1px solid var(--color-line);
    border-radius: 0.5rem;
    background: var(--color-surface);
  }

  .metodo__titulo {
    margin: 0 0 0.5rem;
    color: var(--color-ink-strong);
    font-size: clamp(1.4rem, 4vw, 2rem);
    line-height: 1.15;
  }

  .metodo__lead {
    margin: 0 0 1.5rem;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    line-height: var(--line-height-body);
  }

  .metodo__pasos {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 1rem 1.5rem;
    margin: 0 0 1.5rem;
    padding: 0;
    list-style: none;
    counter-reset: paso;
  }

  .paso {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.7rem;
    align-items: start;
  }

  .paso__num {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-pill);
    background: var(--wash-accent);
    color: var(--color-accent-ink);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .paso__titulo {
    margin: 0 0 0.15rem;
    color: var(--color-ink-strong);
    font-size: 1rem;
    line-height: 1.25;
  }

  .paso__texto {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: 0.88rem;
    line-height: 1.45;
  }

  .metodo__cta {
    display: inline-flex;
    align-items: center;
    min-height: 1.5rem;
    color: var(--color-accent-ink);
    font-weight: 700;
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }
</style>
