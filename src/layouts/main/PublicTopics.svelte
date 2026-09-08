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
  <header class="teme__cabecera">
    <p class="teme__eyebrow">{$_('app.topics.public.eyebrow')}</p>
    <h1>{$_('app.topics.public.title')}</h1>
    <p class="teme__lead">{$_('app.topics.public.lead')}</p>
  </header>

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

  .teme__cabecera {
    margin-bottom: 1.25rem;

    h1 {
      margin: 0 0 0.4rem;
      color: var(--color-ink-strong);
      font-size: clamp(1.6rem, 4vw, 2.2rem);
      line-height: 1.15;
    }
  }

  .teme__eyebrow {
    margin: 0 0 0.3rem;
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .teme__lead {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    line-height: var(--line-height-body);
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
