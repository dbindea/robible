<script>
  /**
   * Blog de predicaciones publicadas (`/predici`).
   *
   * Es la portada del contenido público del módulo: aquí se encuentran, y en
   * `/predica/<slug>` se leen. Sin cuenta, sin nada del autor.
   *
   * **Se indexa a propósito**, igual que la predicación suelta: el sentido de
   * publicar es que alguien que busca «predică despre har» acabe aquí. Por eso
   * los filtros no cambian la URL con parámetros —serían mil variantes de la
   * misma página para el buscador— y se resuelven en el navegador sobre la
   * lista ya descargada. La lista son cabeceras, no predicaciones enteras: con
   * sesenta entradas son unos pocos kilobytes.
   */
  import { onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { fetchPublicSermons } from '../../services/sermons.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import Icon from '../../components/Icon.svelte';

  export let map = {};

  let predicas = [];
  let cargando = true;

  // Filtros. Todos vacíos = todo.
  let busqueda = '';
  let tema = '';
  let libro = '';
  let anio = '';

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);

  $: applySeoMetadata({
    title: $_('app.sermons.blog.seo_title'),
    description: $_('app.sermons.blog.seo_description'),
    canonicalPath: '/predici',
    versionConfig,
    robots: 'index, follow',
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
  $: libros = [...new Set(predicas.map((p) => p.book))]
    .filter((b) => map[b])
    // Por orden canónico, que es como el predicador tiene la Biblia en la
    // cabeza; alfabético mezclaría Geneza con Galateni.
    .sort((a, b) => a - b);
  $: anios = [...new Set(predicas.map(anioDe).filter(Boolean))].sort((a, b) => b.localeCompare(a));

  $: visibles = predicas.filter((p) => {
    if (tema && p.series !== tema) return false;
    if (libro !== '' && String(p.book) !== String(libro)) return false;
    if (anio && anioDe(p) !== anio) return false;
    if (busqueda.trim()) {
      // Título, idea central y referencia: lo que alguien recordaría de una
      // predicación que ya ha visto.
      const heno = `${p.title} ${p.idea || ''} ${referenciaDe(p)}`.toLowerCase();
      if (!heno.includes(busqueda.trim().toLowerCase())) return false;
    }
    return true;
  });

  $: hayFiltros = !!(busqueda.trim() || tema || libro !== '' || anio);

  const limpiar = () => {
    busqueda = '';
    tema = '';
    libro = '';
    anio = '';
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

<section class="blog">
  <header class="blog__cabecera">
    <p class="blog__eyebrow">{$_('app.sermons.blog.eyebrow')}</p>
    <h1>{$_('app.sermons.blog.title')}</h1>
    <p class="blog__lead">{$_('app.sermons.blog.lead')}</p>
  </header>

  {#if cargando}
    <p class="blog__estado" role="status">{$_('app.loading')}</p>
  {:else if !predicas.length}
    <p class="blog__estado">{$_('app.sermons.blog.empty')}</p>
  {:else}
    <div class="filtros">
      <label class="filtros__buscar">
        <span class="filtros__icono"><Icon name="search" /></span>
        <input type="search" bind:value={busqueda} placeholder={$_('app.sermons.blog.search_placeholder')} />
      </label>

      <div class="filtros__selects">
        {#if temas.length}
          <label>
            <span>{$_('app.sermons.blog.by_theme')}</span>
            <select bind:value={tema}>
              <option value="">{$_('app.sermons.blog.all')}</option>
              {#each temas as t (t)}<option value={t}>{t}</option>{/each}
            </select>
          </label>
        {/if}

        <label>
          <span>{$_('app.sermons.blog.by_text')}</span>
          <select bind:value={libro}>
            <option value="">{$_('app.sermons.blog.all')}</option>
            {#each libros as b (b)}<option value={String(b)}>{map[b]}</option>{/each}
          </select>
        </label>

        {#if anios.length > 1}
          <label>
            <span>{$_('app.sermons.blog.by_date')}</span>
            <select bind:value={anio}>
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

    {#if !visibles.length}
      <p class="blog__estado">{$_('app.sermons.blog.no_results')}</p>
    {:else}
      <ul class="lista">
        {#each visibles as p (p.slug)}
          <li class="tarjeta">
            <!-- Enlace real, no un div con on:click: es contenido que se
                 comparte, se abre en otra pestaña y lo tiene que ver el
                 rastreador. El `on:click` sólo evita recargar la página. -->
            <a
              class="tarjeta__enlace"
              href={'/predica/' + encodeURIComponent(p.slug)}
              on:click|preventDefault={() => abrir(p.slug)}
            >
              <p class="tarjeta__ref">{referenciaDe(p)}</p>
              <h2 class="tarjeta__titulo">{p.title}</h2>
              {#if p.idea}<p class="tarjeta__idea">{p.idea}</p>{/if}
              <p class="tarjeta__meta">
                {#if p.series}<span class="tarjeta__serie">{p.series}</span>{/if}
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
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style lang="scss">
  .blog {
    width: 100%;
    max-width: 52rem;
    margin: 0 auto;
    padding: clamp(0.5rem, 2vw, 1.5rem) 0 4rem;
  }

  .blog__cabecera {
    margin-bottom: 1.5rem;

    h1 {
      margin: 0 0 0.4rem;
      color: var(--color-ink-strong);
      font-size: clamp(1.6rem, 4vw, 2.2rem);
      line-height: 1.15;
    }
  }

  .blog__eyebrow {
    margin: 0 0 0.3rem;
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .blog__lead {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    line-height: var(--line-height-body);
  }

  .blog__estado {
    padding: 3rem 1rem;
    color: var(--color-ink-soft);
    text-align: center;
  }

  // ── Filtros ───────────────────────────────────────────────────────────────
  .filtros {
    display: grid;
    gap: 0.7rem;
    margin-bottom: 1.5rem;
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
    /* Se reparten solos: uno, dos o tres filtros según lo que haya publicado,
       sin una regla por cada combinación. */
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
  .lista {
    display: grid;
    gap: 0.8rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tarjeta__enlace {
    display: block;
    padding: 1rem 1.15rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    color: inherit;
    text-decoration: none;
    transition: border-color var(--motion-base), transform var(--motion-base);

    &:hover {
      border-color: var(--color-accent);
      transform: translateY(-2px);
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
    font-size: 1.15rem;
    line-height: 1.25;
  }

  .tarjeta__idea {
    margin: 0 0 0.5rem;
    color: var(--color-ink-soft);
    font-size: 0.92rem;
    font-style: italic;
    line-height: 1.45;
  }

  .tarjeta__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.45rem;
    margin: 0;
    color: var(--color-ink-soft);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .tarjeta__serie {
    padding: 0.1rem 0.5rem;
    border-radius: var(--radius-pill);
    background: var(--wash-accent);
    color: var(--color-accent-ink);
  }
</style>
