<script>
  /**
   * Una colección curada por RoBible (`/versete/<slug>`).
   *
   * **Se indexa**, a diferencia de `/tema/<slug>`. La diferencia no es
   * caprichosa: un tema de usuario es una lista de versículos que ya tienen su
   * propia página —duplicado y fino—, mientras que aquí hay un texto de
   * presentación escrito para esta colección y una selección hecha a mano. Eso
   * es contenido propio, y es justo lo que busca quien teclea «versete despre
   * anxietate».
   *
   * Los versículos se pintan con el texto de la versión activa: la colección
   * guarda referencias, no texto, así que la misma página sirve en las cuatro
   * Biblias sin duplicar nada.
   */
  import { onMount } from 'svelte';
  import { _, currentLocale } from '../../services/i18n.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import { getCuratedTopic, textoDe, loadCuratedTopics, buildCuratedPath, elegirVarias } from '../../services/curated-topics.service';
  import { resolveTopicIcon } from '../../config/topic-icons.js';
  import { buildBiblePath } from '../../services/bible-route.service';
  import Icon from '../../components/Icon.svelte';

  export let bible = [];
  export let map = {};

  let topic = null;
  let otros = [];
  let cargando = true;
  // El slug ya cargado. Evita recargar cuando el evento de navegación llega por
  // partida doble (se emiten `popstate` y `robibile:navigate` juntos).
  let slugActual = null;

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
  $: locale = $currentLocale || 'ro';
  $: nombre = topic ? textoDe(topic, 'names', locale) : '';
  $: intro = topic ? textoDe(topic, 'intros', locale) : '';

  $: versiculos = (topic?.verses || []).map((v) => ({
    ...v,
    reference: `${map[v.book] || ''} ${v.chapter}:${v.verse}`.trim(),
    text: bible?.[v.book]?.[v.chapter - 1]?.[v.verse - 1] || '',
    href: buildBiblePath({ version: versionConfig?.value, map, book: v.book, chapter: v.chapter, verse: v.verse }),
  })).filter((v) => v.text);

  // Datos estructurados: le dicen al buscador que esto es una colección con
  // sus partes, no una página suelta.
  $: esquema = topic
    ? {
        '@type': 'CollectionPage',
        name: nombre,
        description: intro,
        url: `https://robible.com${buildCuratedPath(topic.slug)}`,
        inLanguage: locale,
        hasPart: versiculos.slice(0, 20).map((v) => ({
          '@type': 'CreativeWork',
          name: v.reference,
          text: v.text,
        })),
      }
    : null;

  $: if (topic) {
    applySeoMetadata({
      title: `${nombre} | RoBible`,
      description: intro.slice(0, 155),
      canonicalPath: buildCuratedPath(topic.slug),
      versionConfig,
      robots: 'index, follow',
      schema: esquema ? [esquema] : [],
    });
  } else if (!cargando) {
    // Un slug que no existe devuelve 200 pintando este aviso: es un soft-404, y
    // sin esto se quedaba con el `index, follow` de index.html. Google indexaría
    // «No hemos encontrado esta colección» tantas veces como slugs se inventen.
    applySeoMetadata({
      title: `${$_('app.topics.curated.not_found')} | RoBible`,
      description: $_('app.topics.curated.not_found'),
      canonicalPath: '/teme',
      versionConfig,
      robots: 'noindex, follow',
    });
  }

  const irA = (href) => {
    if (!href) return;
    window.history.pushState(null, '', href);
    // La errata `robibile` es la del resto del proyecto (CLAUDE.md, trampa 1).
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  /**
   * Lee el slug de la URL y carga la colección.
   *
   * **No basta con hacer esto en `onMount`.** Los chips de «otras colecciones»
   * llevan de `/versete/x` a `/versete/y`: el tipo de ruta no cambia, así que
   * `Main.svelte` sigue pintando este mismo componente sin volver a crearlo y
   * `onMount` no se ejecuta otra vez. El resultado era que la URL cambiaba y la
   * pantalla se quedaba igual — parecía que el enlace no hacía nada.
   */
  const cargar = async () => {
    const m = window.location.pathname.match(/^\/versete\/([^/]+)\/?$/);
    const slug = m ? decodeURIComponent(m[1]) : '';
    if (slug === slugActual) return;

    slugActual = slug;
    cargando = true;
    topic = slug ? await getCuratedTopic(slug) : null;
    // Las demás colecciones, para que la página no sea un callejón sin salida.
    // Al azar y no las 5 primeras del JSON: si no, siempre son las mismas y las
    // del final de la lista no se enlazan jamás desde ningún sitio.
    otros = elegirVarias((await loadCuratedTopics()).filter((t) => t.slug !== slug), 5);
    cargando = false;
    // Al cambiar de colección se vuelve arriba: si no, se aterriza a media
    // lista de versículos de la anterior.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  onMount(() => {
    cargar();
    window.addEventListener('popstate', cargar);
    window.addEventListener('robibile:navigate', cargar);
    return () => {
      window.removeEventListener('popstate', cargar);
      window.removeEventListener('robibile:navigate', cargar);
    };
  });
</script>

<section class="coleccion">
  {#if cargando}
    <p class="coleccion__estado" role="status">{$_('app.loading')}</p>
  {:else if !topic}
    <div class="coleccion__estado">
      <h1>{$_('app.topics.curated.not_found')}</h1>
      <a class="boton" href="/teme" on:click|preventDefault={() => irA('/teme')}>
        {$_('app.topics.curated.all')}
      </a>
    </div>
  {:else}
    <header class="portada">
      <p class="portada__eyebrow">
        <span class="portada__icono" aria-hidden="true" style={topic.color ? `color: ${topic.color}` : ''}>
          <Icon name={resolveTopicIcon(topic.icon)} />
        </span>
        {$_('app.topics.curated.eyebrow')}
      </p>
      <h1 class="portada__titulo">{nombre}</h1>
      <p class="portada__lead">{intro}</p>
      <p class="portada__meta">
        {versiculos.length === 1
          ? $_('app.topics.verse_count', { count: versiculos.length })
          : $_('app.topics.verses_count_plural', { count: versiculos.length })}
        <span aria-hidden="true">·</span>
        {versionConfig?.bibleName}
      </p>
    </header>

    <ol class="versete">
      {#each versiculos as v (v.reference)}
        <li class="verset">
          <a class="verset__enlace" href={v.href} on:click|preventDefault={() => irA(v.href)}>
            <p class="verset__ref">{v.reference}</p>
            <p class="verset__texto">{v.text}</p>
          </a>
        </li>
      {/each}
    </ol>

    {#if otros.length}
      <aside class="otros">
        <h2 class="otros__titulo">{$_('app.topics.curated.more')}</h2>
        <ul class="otros__lista">
          {#each otros as o (o.slug)}
            <li>
              <a
                class="otros__chip"
                href={buildCuratedPath(o.slug)}
                on:click|preventDefault={() => irA(buildCuratedPath(o.slug))}
              >
                <span class="otros__icono" aria-hidden="true" style={o.color ? `color: ${o.color}` : ''}>
                  <Icon name={resolveTopicIcon(o.icon)} />
                </span>
                {textoDe(o, 'names', locale)}
              </a>
            </li>
          {/each}
        </ul>
      </aside>
    {/if}
  {/if}
</section>

<style lang="scss">
  .coleccion {
    width: 100%;
    max-width: 48rem;
    margin: 0 auto;
    padding: 0 0 4rem;
  }

  .coleccion__estado {
    padding: 3rem 1rem;
    color: var(--color-ink-soft);
    text-align: center;

    h1 { color: var(--color-ink-strong); }
  }

  .portada {
    margin-bottom: clamp(1.25rem, 4vw, 2rem);
    padding: clamp(1.5rem, 5vw, 2.5rem);
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
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0 0 0.4rem;
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .portada__icono {
    display: inline-flex;
    // El color lo pone la colección; si no trae, hereda el acento.
    color: var(--color-accent);
    --icon-size: 1.2rem;
  }

  .portada__titulo {
    margin: 0 0 0.6rem;
    color: var(--color-ink-strong);
    font-size: clamp(1.8rem, 5vw, 2.6rem);
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .portada__lead {
    margin: 0 0 0.9rem;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    line-height: var(--line-height-body);
  }

  .portada__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0;
    color: var(--color-ink-soft);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .versete {
    display: grid;
    gap: 0.7rem;
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: verset;
  }

  .verset__enlace {
    display: block;
    padding: 1rem 1.15rem;
    border: 1px solid var(--color-line);
    border-left: 3px solid var(--color-accent);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    color: inherit;
    text-decoration: none;
    transition: border-color var(--motion-base), transform var(--motion-base);

    &:hover {
      border-color: var(--color-accent);
      transform: translateX(2px);
      text-decoration: none;
    }
  }

  .verset__ref {
    margin: 0 0 0.25rem;
    color: var(--color-accent-ink);
    font-size: 0.82rem;
    font-weight: 700;
  }

  .verset__texto {
    margin: 0;
    color: var(--color-ink);
    font-size: 1rem;
    line-height: var(--line-height-body);
  }

  .otros {
    margin-top: 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-line);
  }

  .otros__titulo {
    margin: 0 0 0.7rem;
    color: var(--color-ink-strong);
    font-size: 1.05rem;
  }

  .otros__lista {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .otros__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2rem;
    padding: 0.3rem 0.8rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    color: var(--color-ink);
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    transition: var(--transition);
    --icon-size: 0.95rem;

    &:hover { border-color: var(--color-accent); text-decoration: none; }
  }

  .otros__icono { display: inline-flex; }

  .boton {
    display: inline-flex;
    align-items: center;
    min-height: 2.4rem;
    padding: 0.55rem 1.2rem;
    border-radius: var(--radius-md);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-weight: 700;
    text-decoration: none;

    &:hover { background: var(--color-accent-solid-hover); text-decoration: none; }
  }
</style>
