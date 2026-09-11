<script>
  /**
   * Predicación compartida: lo que ve quien recibe el enlace `/predica/<slug>`.
   *
   * Sólo lectura y sin cuenta. Lo que se muestra viene del endpoint público,
   * que ya deja fuera el cuaderno de preparación —observación y contexto son
   * apuntes personales, a menudo con dudas del propio predicador— y cualquier
   * dato de la cuenta que no sea la firma.
   *
   * **La firma es la única excepción, y es reciente (10 sep 2026).** Antes no
   * salía nada del autor a propósito; ahora sí, a petición explícita: el
   * nickname y la fecha de publicación, bajo el texto. `sermon.author` hoy
   * resuelve al nickname porque es lo único que hay — si el perfil gana un
   * nombre para mostrar más adelante, cambia la consulta del worker y esta
   * pantalla no tiene que enterarse.
   *
   * **A diferencia de los temas, esto sí se indexa.** Un tema compartido es un
   * enlace que se pasa a alguien concreto; una predicación publicada es algo que
   * su autor quiere que se encuentre. Por eso aquí va `index, follow` y hay
   * datos estructurados de artículo, y en `PublicTopic.svelte` va `noindex`.
   */
  import { onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { fetchPublicSermon } from '../../services/sermons.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import { quitarMarcas } from '../../services/sermon-content.service';
  import Icon from '../../components/Icon.svelte';
  import TextoFormateado from '../../components/TextoFormateado.svelte';

  export let map = {};

  let slug = '';
  let sermon = null;
  let cargando = true;
  let noEncontrado = false;
  let copiado = false;

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);

  $: referencia = sermon
    ? `${map[sermon.book] || ''} ${sermon.chapter}:${sermon.verseStart}${
        sermon.verseEnd && sermon.verseEnd !== sermon.verseStart ? `-${sermon.verseEnd}` : ''
      }`.trim()
    : '';

  // El resumen de los buscadores: la idea central si la hay, y si no el
  // principio de la introducción. Nunca el título repetido, que no dice nada.
  $: resumen = sermon
    ? (sermon.idea || quitarMarcas(sermon.intro || '')).trim().slice(0, 155)
    : '';

  $: if (sermon) {
    applySeoMetadata({
      title: $_('app.sermons.share.seo_title', { title: sermon.title, reference: referencia }),
      description: resumen || $_('app.sermons.share.seo_fallback', { reference: referencia }),
      canonicalPath: `/predica/${encodeURIComponent(sermon.slug)}`,
      versionConfig,
      robots: 'index, follow',
    });
  }

  onMount(async () => {
    const m = window.location.pathname.match(/^\/predica\/([^/]+)\/?$/);
    slug = m ? decodeURIComponent(m[1]) : '';
    if (!slug) {
      noEncontrado = true;
      cargando = false;
      return;
    }
    sermon = await fetchPublicSermon(slug);
    noEncontrado = !sermon;
    cargando = false;
  });

  const compartir = async () => {
    const url = window.location.href;
    // En móvil abre la hoja del sistema; en escritorio casi nunca existe, así
    // que se cae a copiar, que es lo que el usuario quería de todos modos.
    if (navigator.share) {
      try {
        await navigator.share({ title: sermon.title, url });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      copiado = true;
      setTimeout(() => { copiado = false; }, 2200);
    } catch { /* sin portapapeles no se puede hacer más */ }
  };

  /** Fecha larga para la firma, en el idioma del visitante. */
  const fechaLarga = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return '';
    }
  };
</script>

<section class="predica">
  {#if cargando}
    <p class="predica__estado" role="status">{$_('app.loading')}</p>
  {:else if noEncontrado}
    <div class="predica__estado">
      <h1>{$_('app.sermons.share.not_found_title')}</h1>
      <p>{$_('app.sermons.share.not_found_hint')}</p>
      <a class="predica__cta" href="/">{$_('app.sermons.share.go_home')}</a>
    </div>
  {:else}
    <article class="predica__cuerpo">
      <header class="predica__cabecera">
        <p class="predica__eyebrow">{$_('app.sermons.share.eyebrow')}</p>
        <h1>{sermon.title}</h1>
        {#if referencia}<p class="predica__ref">{referencia}</p>{/if}
        {#if sermon.idea}<p class="predica__idea">{quitarMarcas(sermon.idea)}</p>{/if}

        <button type="button" class="predica__compartir" on:click={compartir}>
          <Icon name="share" size="0.9rem" />
          <!-- Claves propias, no las de `app.share.*`: ésas son las del modal
               que genera la imagen del versículo ("Distribuie ca imagine") y
               aquí lo que se comparte es el enlace. -->
          {copiado ? $_('app.sermons.share.copied') : $_('app.sermons.share.share')}
        </button>
      </header>

      {#if sermon.intro?.trim()}
        <section class="predica__seccion">
          <h2>{$_('app.sermons.intro')}</h2>
          <p><TextoFormateado texto={sermon.intro} /></p>
        </section>
      {/if}

      <!-- Sin encabezado: es la frase con la que se entra en las divisiones,
           no una sección. Puede faltar — las predicaciones publicadas antes de
           que existiera el campo no la traen. -->
      {#if sermon.transition?.trim()}
        <p class="predica__transicion"><TextoFormateado texto={sermon.transition} /></p>
      {/if}

      {#each sermon.points as punto, i (i)}
        <section class="predica__punto">
          <!-- `quitarMarcas` también en títulos y subpuntos: los asteriscos
               son la sintaxis con la que el predicador marca las palabras que
               quiere en la schiță, y quien lee esto no tiene por qué verlos.
               El texto libre usa `TextoFormateado`, que además pone en
               negrita lo destacado y en cursiva una cita en línea. -->
          <h2>{i + 1}. {quitarMarcas(punto.title)}</h2>

          <!-- El subpunto va justo después del título, antes de explicar,
               ilustrar y aplicar: es su división analítica, no una vuelta
               atrás después de haber cerrado el punto — mismo orden que en
               la preparación y en el PDF.
               Pasó de ser una cadena suelta a `{ title, text }` cuando ganó
               desarrollo propio; se aceptan las dos formas porque el worker y
               esta página se despliegan por separado (trampa 36): entre un
               despliegue y otro hay predicaciones servidas a la antigua, y
               con una sola forma se quedarían sin subpuntos. -->
          {#each punto.subpoints || [] as sub, j (j)}
            {@const titulo = quitarMarcas(typeof sub === 'string' ? sub : sub?.title || '')}
            {@const texto = typeof sub === 'string' ? '' : sub?.text || ''}
            {#if titulo || texto}
              <h3 class="predica__subpunto">{i + 1}.{j + 1} {titulo}</h3>
              {#if texto}<p class="predica__texto"><TextoFormateado {texto} /></p>{/if}
            {/if}
          {/each}

          {#each [['explain', punto.explain], ['illustrate', punto.illustrate], ['apply', punto.apply]] as [clave, texto] (clave)}
            {#if texto?.trim()}
              <p class="predica__etiqueta">{$_(`app.sermons.dev_${clave}`)}</p>
              <p class="predica__texto"><TextoFormateado {texto} /></p>
            {/if}
          {/each}

          {#if punto.refs?.length}
            <ul class="predica__refs">
              {#each punto.refs as ref (ref.label)}
                <li>
                  <span class="predica__cita">{ref.label}</span>
                  {#if ref.text}<span class="predica__versiculo">{ref.text}</span>{/if}
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/each}

      {#if sermon.conclusion?.trim()}
        <section class="predica__seccion">
          <h2>{$_('app.sermons.conclusion')}</h2>
          <p><TextoFormateado texto={sermon.conclusion} /></p>
        </section>
      {/if}

      <footer class="predica__pie">
        <!-- La firma: nickname y fecha de publicación. Ver el comentario del
             `<script>` sobre por qué es la única excepción a "nada del
             autor". Puede faltar en predicaciones de antes del 10 sep 2026
             servidas por un worker viejo (trampa 36), así que los dos son
             opcionales. -->
        {#if sermon.author || sermon.publishedAt}
          <p class="predica__firma">
            {#if sermon.author}<span class="predica__autor">{sermon.author}</span>{/if}
            {#if sermon.publishedAt}<span class="predica__fecha">{fechaLarga(sermon.publishedAt)}</span>{/if}
          </p>
        {/if}
        <a class="predica__cta" href="/">{$_('app.sermons.share.go_home')}</a>
      </footer>
    </article>
  {/if}
</section>

<style lang="scss">
  .predica {
    width: 100%;
    max-width: 46rem;
    margin: 0 auto;
    padding: clamp(0.5rem, 2vw, 1.5rem) 0 4rem;
  }

  .predica__estado {
    padding: 4rem 1rem;
    text-align: center;
    color: var(--color-ink-soft);

    h1 { color: var(--color-ink-strong); }
  }

  .predica__cuerpo {
    background: var(--color-surface-raised);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    padding: clamp(1.25rem, 4vw, 2.5rem);
    box-shadow: var(--box-shadow-up);
  }

  .predica__cabecera {
    border-bottom: 1px solid var(--color-line);
    padding-bottom: 1.25rem;
    margin-bottom: 1.5rem;

    h1 {
      margin: 0 0 0.35rem;
      color: var(--color-ink-strong);
      font-size: clamp(1.6rem, 4vw, 2.2rem);
      line-height: 1.15;
    }
  }

  .predica__eyebrow {
    margin: 0 0 0.3rem;
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .predica__ref {
    margin: 0;
    color: var(--color-accent-ink);
    font-weight: 700;
  }

  .predica__idea {
    margin: 0.75rem 0 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    font-style: italic;
    line-height: 1.5;
  }

  .predica__compartir {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 1rem;
    padding: 0.4rem 0.85rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-pill);
    background: var(--wash-accent);
    color: var(--color-accent-ink);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);

    &:hover { border-color: var(--color-accent); background: var(--wash-accent-strong); }
  }

  .predica__seccion,
  .predica__punto {
    margin-bottom: 1.75rem;

    h2 {
      margin: 0 0 0.6rem;
      color: var(--color-ink-strong);
      font-size: 1.2rem;
    }

    // `pre-wrap` y no el `normal` por defecto: el predicador escribe estos
    // campos con saltos de línea entre frases, y sin esto se pegaban todas en
    // un único párrafo corrido — de ahí que "desaparecieran" a la vista. Es
    // el mismo ajuste que ya lleva `.documento__parrafo` en `SermonPrep`.
    p { margin: 0 0 0.9rem; line-height: var(--line-height-body); white-space: pre-wrap; }
  }

  .predica__punto h2 {
    padding-bottom: 0.4rem;
    border-bottom: 2px solid var(--wash-accent-strong);
  }

  .predica__transicion {
    margin: 0 0 1.75rem;
    padding-left: 0.85rem;
    border-left: 3px solid var(--color-accent);
    color: var(--color-ink-strong);
    font-weight: 600;
    line-height: var(--line-height-body);
  }

  .predica__subpunto {
    margin: 1.1rem 0 0.35rem;
    font-size: 1rem;
    font-weight: 700;
  }

  .predica__etiqueta {
    margin: 0.9rem 0 0.2rem !important;
    color: var(--color-ink-soft);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .predica__refs {
    display: grid;
    gap: 0.4rem;
    margin: 1rem 0 0;
    padding: 0.7rem 0.9rem;
    border-left: 3px solid var(--color-accent);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    background: var(--wash-subtle);
    list-style: none;
  }

  .predica__cita {
    display: block;
    color: var(--color-accent-ink);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .predica__versiculo {
    color: var(--color-ink-soft);
    font-size: 0.9rem;
    font-style: italic;
    line-height: 1.45;
  }

  .predica__pie {
    margin-top: 2rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-line);
    text-align: center;
  }

  .predica__firma {
    margin: 0 0 0.9rem;
    color: var(--color-ink-soft);
    font-size: 0.85rem;
  }

  .predica__autor {
    font-weight: 700;
    color: var(--color-ink-strong);

    &::after {
      content: '·';
      margin: 0 0.4rem;
      color: var(--color-ink-soft);
      font-weight: 400;
    }

    // Sin fecha no hace falta el separador.
    &:last-child::after { content: none; }
  }

  .predica__cta {
    display: inline-block;
    padding: 0.6rem 1.4rem;
    border-radius: var(--radius-md);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-weight: 700;
    text-decoration: none;

    &:hover { background: var(--color-accent-solid-hover); text-decoration: none; }
  }
</style>
