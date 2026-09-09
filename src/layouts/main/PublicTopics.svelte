<script>
  /**
   * Índice de temas publicados por la gente (`/teme`).
   *
   * Por qué existe: el endpoint `/api/public/topics` estaba en el worker desde
   * el principio, pero ninguna pantalla lo pedía. Un tema publicado sólo
   * existía para quien recibía el enlace — no había forma de saber que los
   * había, ni siquiera para el que los publicaba.
   *
   * **Va con `noindex, follow`, igual que los temas sueltos** (ver
   * `PublicTopic.svelte`). Un tema es una lista de versículos que ya tienen su
   * propia página: indexarlo sería contenido duplicado y fino, que es
   * exactamente lo que penalizan los buscadores. `follow` sí, para que el
   * rastreador llegue por aquí a los capítulos. Si algún día se decide
   * indexarlos, hay que cambiarlo en los dos sitios y en `topic-meta.mjs`.
   */
  import { onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { fetchPublicTopics } from '../../services/topics.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import { resolveTopicIcon } from '../../config/topic-icons.js';
  import Icon from '../../components/Icon.svelte';

  let temas = [];
  let cargando = true;
  let busqueda = '';

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);

  $: applySeoMetadata({
    title: $_('app.topics.public.seo_title'),
    description: $_('app.topics.public.seo_description'),
    canonicalPath: '/teme',
    versionConfig,
    robots: 'noindex, follow',
  });

  $: visibles = busqueda.trim()
    ? temas.filter((t) => t.name.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : temas;

  const abrir = (slug) => {
    window.history.pushState(null, '', `/tema/${encodeURIComponent(slug)}`);
    // La errata `robibile` es la del resto del proyecto (CLAUDE.md, trampa 1).
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  onMount(async () => {
    temas = (await fetchPublicTopics()) || [];
    cargando = false;
  });
</script>

<section class="teme">
  <!-- Misma portada que /predici: es la otra puerta pública del sitio y no
       tiene por qué parecer un panel de administración al lado de aquélla. -->
  <section class="portada">
    <div class="portada__texto">
      <p class="portada__eyebrow">{$_('app.topics.public.eyebrow')}</p>
      <h1 class="portada__titulo">{$_('app.topics.public.title')}</h1>
      <p class="portada__lead">{$_('app.topics.public.lead')}</p>
      <a class="portada__cta" href="/indice">
        <Icon name="bookmark" size="1rem" />
        {$_('app.topics.public.cta')}
      </a>
    </div>
    <figure class="portada__foto" aria-hidden="true">
      <picture>
        <source srcset="/assets/img/landing/persona-leyendo.webp" type="image/webp" />
        <img src="/assets/img/landing/persona-leyendo.jpg" alt="" width="1000" height="667" loading="eager" />
      </picture>
    </figure>
  </section>

  {#if cargando}
    <p class="teme__estado" role="status">{$_('app.loading')}</p>
  {:else if !temas.length}
    <p class="teme__estado">{$_('app.topics.public.empty')}</p>
  {:else}
    <label class="teme__buscar">
      <span class="teme__buscar-icono"><Icon name="search" /></span>
      <input type="search" bind:value={busqueda} placeholder={$_('app.topics.public.search_placeholder')} />
    </label>

    {#if !visibles.length}
      <p class="teme__estado">{$_('app.topics.public.no_results')}</p>
    {:else}
      <ul class="rejilla">
        {#each visibles as t (t.slug)}
          <li>
            <!-- Enlace real y no un div con on:click: es contenido que se
                 comparte y se abre en otra pestaña. El `on:click` sólo evita
                 recargar la página entera. -->
            <a
              class="tema"
              href={'/tema/' + encodeURIComponent(t.slug)}
              on:click|preventDefault={() => abrir(t.slug)}
            >
              <span class="tema__icono" aria-hidden="true" style={t.color ? `color: ${t.color}` : ''}>
                <Icon name={resolveTopicIcon(t.icon)} />
              </span>
              <span class="tema__nombre">{t.name}</span>
              <span class="tema__cuenta">
                {t.verseCount === 1
                  ? $_('app.topics.verse_count', { count: t.verseCount })
                  : $_('app.topics.verses_count_plural', { count: t.verseCount })}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style lang="scss">
  .teme {
    width: 100%;
    max-width: 52rem;
    margin: 0 auto;
    padding: clamp(0.5rem, 2vw, 1.5rem) 0 4rem;
  }

  // ── Portada ───────────────────────────────────────────────────────────────
  // Calcada de la de /predici a propósito: las dos son páginas públicas y tienen
  // que reconocerse como del mismo sitio.
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
    // Sin la relación fija la foto marca el alto y en móvil se come la pantalla
    // entera antes de llegar al primer tema.
    aspect-ratio: 3 / 2;

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .teme__estado {
    padding: 3rem 1rem;
    color: var(--color-ink-soft);
    text-align: center;
  }

  .teme__buscar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
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

  .teme__buscar-icono {
    display: inline-flex;
    color: var(--color-ink-soft);
  }

  .rejilla {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 0.7rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tema {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.3rem 0.65rem;
    height: 100%;
    padding: 0.85rem 1rem;
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

  .tema__icono {
    display: inline-flex;
    grid-row: span 2;
    /* El color lo pone el tema; si no tiene, hereda el acento. */
    color: var(--color-accent);
    --icon-size: 1.4rem;
  }

  .tema__nombre {
    color: var(--color-ink-strong);
    font-weight: 700;
    line-height: 1.25;
  }

  .tema__cuenta {
    color: var(--color-ink-soft);
    font-size: 0.78rem;
    font-weight: 600;
  }
</style>
