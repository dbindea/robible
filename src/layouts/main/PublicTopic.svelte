<script>
  /**
   * Tema compartido: lo que ve quien recibe el enlace `/tema/<slug>`.
   *
   * Es la única vista de la app pensada para alguien **sin cuenta**, así que no
   * asume sesión ni pinta nada que dependa de ella. El backend tampoco devuelve
   * quién publicó el tema — solo el nombre, el aspecto y las referencias.
   *
   * El texto de los versículos no viaja por la API: viene de la Biblia que ya
   * está cargada en el cliente. Así el enlace no expone el texto de una versión
   * a través del backend y, de paso, la página funciona sin conexión si el
   * usuario ya tenía la Biblia cacheada.
   */
  import { onMount } from 'svelte';
  import VerseImageModal from '../../components/VerseImageModal.svelte';
  import { _ } from '../../services/i18n.service';
  import { buildBiblePath } from '../../services/bible-route.service';
  import { fetchPublicTopic } from '../../services/topics.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';

  export let bible = [];
  export let map = {};

  let slug = '';
  let topic = null;
  let cargando = true;
  let noEncontrado = false;
  let shareItem = null;

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);

  // Referencias + texto, resueltos contra la Biblia cargada en el cliente.
  $: versiculos = topic
    ? topic.verses
        .map((v) => ({
          ...v,
          reference: `${map[v.book]} ${v.chapter}:${v.verse}`,
          text: bible[v.book]?.[v.chapter - 1]?.[v.verse - 1] || '',
        }))
        .filter((v) => v.text)
    : [];

  const leerSlug = () => {
    const m = window.location.pathname.match(/^\/tema\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : '';
  };

  const cargar = async () => {
    slug = leerSlug();
    if (!slug) { noEncontrado = true; cargando = false; return; }
    cargando = true;
    noEncontrado = false;
    topic = await fetchPublicTopic(slug);
    if (!topic) noEncontrado = true;
    cargando = false;
  };

  onMount(() => {
    // `?app=1` lo pone la función topic-meta para no reentrar en sí misma (ver
    // netlify.toml). Se borra en cuanto arranca la app: si no, el usuario copia
    // de la barra una URL con el parámetro y quien la reciba se saltaría las
    // etiquetas Open Graph.
    const params = new URLSearchParams(window.location.search);
    if (params.has('app')) {
      params.delete('app');
      const cola = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (cola ? `?${cola}` : ''));
    }

    cargar();
    // La errata `robibile` es la del resto del proyecto (CLAUDE.md, trampa 1).
    window.addEventListener('popstate', cargar);
    window.addEventListener('robibile:navigate', cargar);
    return () => {
      window.removeEventListener('popstate', cargar);
      window.removeEventListener('robibile:navigate', cargar);
    };
  });

  // SEO: el título lleva el nombre del tema, que es justo la búsqueda de cola
  // larga que se quiere capturar ("versículos sobre la ansiedad").
  // `noindex` es deliberado — ver el comentario de abajo.
  $: if (topic) {
    applySeoMetadata({
      title: $_('app.topics.share.seo_title', { topic: topic.name }),
      description: $_('app.topics.share.seo_description', {
        topic: topic.name,
        count: versiculos.length,
      }),
      canonicalPath: `/tema/${encodeURIComponent(topic.slug)}`,
      versionConfig,
      robots: 'noindex, follow',
    });
  }

  const irAlVersiculo = (v) => {
    const path = buildBiblePath({
      version: $selectedBibleVersion,
      map,
      book: v.book,
      chapter: v.chapter,
      verse: v.verse,
    });
    window.history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
</script>

<section class="tema-publico">
  {#if cargando}
    <p class="tema-publico__estado" role="status">{$_('app.loading')}</p>
  {:else if noEncontrado}
    <div class="tema-publico__estado">
      <h1>{$_('app.topics.share.not_found_title')}</h1>
      <p>{$_('app.topics.share.not_found_hint')}</p>
      <a class="tema-publico__cta" href="/">{$_('app.topics.share.go_home')}</a>
    </div>
  {:else if topic}
    <header class="tema-publico__cabecera" style:--topic-color={topic.color}>
      <p class="tema-publico__eyebrow">{$_('app.topics.share.eyebrow')}</p>
      <h1>{topic.name}</h1>
      <p class="tema-publico__lead">
        {versiculos.length === 1
          ? $_('app.topics.verse_count', { count: versiculos.length })
          : $_('app.topics.verses_count_plural', { count: versiculos.length })}
      </p>
    </header>

    {#if versiculos.length === 0}
      <p class="tema-publico__estado">{$_('app.topics.empty_verses')}</p>
    {:else}
      <ul class="tema-publico__lista">
        {#each versiculos as v (`${v.book}-${v.chapter}-${v.verse}`)}
          <li class="tema-publico__item">
            <button type="button" class="tema-publico__ref" on:click={() => irAlVersiculo(v)}>
              {v.reference}
            </button>
            <p class="tema-publico__texto">{v.text}</p>
            <button
              type="button"
              class="tema-publico__compartir"
              title={$_('app.share.open_action')}
              aria-label={$_('app.share.open_action_reference', { reference: v.reference })}
              on:click={() => (shareItem = v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49"/>
              </svg>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <footer class="tema-publico__pie">
      <p>{$_('app.topics.share.cta_hint')}</p>
      <a class="tema-publico__cta" href="/">{$_('app.topics.share.cta')}</a>
    </footer>
  {/if}
</section>

{#if shareItem}
  <VerseImageModal
    open={true}
    text={shareItem.text}
    reference={shareItem.reference}
    versionName={versionConfig?.bibleName || ''}
    onClose={() => (shareItem = null)}
  />
{/if}

<style lang="scss">
  .tema-publico {
    max-width: 52rem;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2rem) 0;
  }

  .tema-publico__estado {
    display: grid;
    gap: 0.75rem;
    justify-items: center;
    padding: clamp(2rem, 8vw, 5rem) 1rem;
    text-align: center;
    color: var(--color-ink-soft);
  }

  .tema-publico__cabecera {
    padding: 0 0 1.25rem;
    border-bottom: 3px solid var(--topic-color, var(--color-accent));
    margin-bottom: 1.5rem;

    h1 {
      margin: 0.15rem 0 0.35rem;
    }
  }

  .tema-publico__eyebrow {
    margin: 0;
    font-size: var(--font-size-tiny);
    font-weight: 600;
    letter-spacing: var(--letter-spacing-eyebrow);
    text-transform: uppercase;
    color: var(--topic-color, var(--color-accent));
  }

  .tema-publico__lead {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
  }

  .tema-publico__lista {
    display: grid;
    gap: 0.85rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tema-publico__item {
    position: relative;
    padding: 0.9rem 3rem 0.9rem 1rem;
    border: 1px solid var(--color-line);
    border-left: 3px solid var(--topic-color, var(--color-accent));
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--box-shadow-up);
  }

  .tema-publico__ref {
    display: inline;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-link);
    font-weight: 700;
    font-size: var(--font-size-small);
    cursor: pointer;

    &:hover { text-decoration: underline; }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }
  }

  .tema-publico__texto {
    margin: 0.35rem 0 0;
    line-height: var(--line-height-body);
    color: var(--color-ink);
  }

  .tema-publico__compartir {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: grid;
    place-items: center;
    width: 1.9rem;
    height: 1.9rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-link);
    cursor: pointer;
    transition: var(--transition);

    svg { width: 0.9rem; height: 0.9rem; }

    &:hover,
    &:focus-visible {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 10%, transparent);
    }
  }

  .tema-publico__pie {
    display: grid;
    gap: 0.75rem;
    justify-items: center;
    margin-top: 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-line);
    text-align: center;

    p {
      margin: 0;
      color: var(--color-ink-soft);
      font-size: var(--font-size-small);
    }
  }

  .tema-publico__cta {
    padding: 0.6rem 1.4rem;
    border-radius: var(--radius-pill);
    background: var(--color-accent);
    color: var(--color-on-primary);
    font-weight: 700;
    font-size: var(--font-size-small);
    text-decoration: none;

    &:hover {
      background: var(--color-accent-hover);
      text-decoration: none;
    }
  }

  @media (max-width: 40rem) {
    .tema-publico {
      padding-inline: 0.25rem;
    }
  }
</style>
