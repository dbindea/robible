<script>
  /**
   * «Predicile mele» — lista y creación.
   *
   * Es la puerta del módulo: aquí se ve lo que hay, se filtra por estado y se
   * arranca una predicación nueva eligiendo la perícopa. La preparación guiada,
   * el documento final y el Modo Amvon llegan después.
   *
   * Todo lo que se ve sale de localStorage (ver sermons.service.js). El
   * servidor sólo alimenta esa copia, así que la pantalla funciona igual sin
   * conexión.
   */
  import { onMount } from 'svelte';
  import BookDrawer from './BookDrawer.svelte';
  import Modal from '../../components/Modal.svelte';
  import { _ } from '../../services/i18n.service';
  import { SERMON_TYPES } from '../../services/sermons.service';
  import { sermonsStore } from '../../store/sermonsStore';
  import { isAuthenticated, currentUser } from '../../store/authStore';
  import { openAuthMenu } from '../../store/authMenuStore';
  import { selectedBibleVersion } from '../../store/stores';

  export let bible = [];
  export let map = {};

  const ESTADOS = ['all', 'draft', 'ready', 'preached'];

  let filtro = 'all';
  let busqueda = '';
  let creando = false;
  let guardando = false;
  let aviso = '';
  let avisoTimer;

  // Formulario de predicación nueva
  let nuevo = { title: '', book: null, chapter: null, verseStart: null, verseEnd: null, type: 'expositive' };
  let drawerAbierto = false;

  $: predicaciones = $sermonsStore;

  $: visibles = predicaciones
    .filter((s) => filtro === 'all' || s.status === filtro)
    .filter((s) => {
      if (!busqueda.trim()) return true;
      const q = busqueda.trim().toLowerCase();
      const referencia = `${map[s.book] || ''} ${s.chapter}:${s.verseStart}`.toLowerCase();
      return (s.title || '').toLowerCase().includes(q) || referencia.includes(q);
    });

  $: cuentas = {
    all: predicaciones.length,
    draft: predicaciones.filter((s) => s.status === 'draft').length,
    ready: predicaciones.filter((s) => s.status === 'ready').length,
    preached: predicaciones.filter((s) => s.status === 'preached').length,
  };

  // Capítulos y versículos disponibles para el libro elegido, leídos de la
  // Biblia cargada: así no se puede crear una predicación sobre Juan 30.
  $: capitulos = nuevo.book !== null && bible[nuevo.book]
    ? Array.from({ length: bible[nuevo.book].length }, (_, i) => i + 1)
    : [];
  $: versiculos = nuevo.book !== null && nuevo.chapter && bible[nuevo.book]?.[nuevo.chapter - 1]
    ? Array.from({ length: bible[nuevo.book][nuevo.chapter - 1].length }, (_, i) => i + 1)
    : [];

  // La perícopa completa, para que el predicador vea lo que está eligiendo
  // antes de crear nada.
  $: pericopa = nuevo.book !== null && nuevo.chapter && nuevo.verseStart
    ? Array.from(
        { length: (nuevo.verseEnd || nuevo.verseStart) - nuevo.verseStart + 1 },
        (_, i) => ({
          numero: nuevo.verseStart + i,
          texto: bible[nuevo.book]?.[nuevo.chapter - 1]?.[nuevo.verseStart + i - 1] || '',
        }),
      ).filter((v) => v.texto)
    : [];

  $: puedeCrear = nuevo.book !== null && nuevo.chapter && nuevo.verseStart && !guardando;

  const referenciaDe = (s) => {
    const libro = map[s.book] || '';
    const rango = s.verseEnd && s.verseEnd !== s.verseStart
      ? `${s.verseStart}-${s.verseEnd}`
      : `${s.verseStart}`;
    return `${libro} ${s.chapter}:${rango}`;
  };

  const fechaDe = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return ''; }
  };

  const mostrarAviso = (texto) => {
    aviso = texto;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { aviso = ''; }, 2600);
  };

  const abrirCreacion = () => {
    nuevo = { title: '', book: null, chapter: null, verseStart: null, verseEnd: null, type: 'expositive' };
    creando = true;
  };

  const elegirLibro = (bookId) => {
    // Cambiar de libro invalida capítulo y versículos: dejarlos apuntaría a un
    // pasaje que puede no existir en el libro nuevo.
    nuevo = { ...nuevo, book: bookId, chapter: null, verseStart: null, verseEnd: null };
    drawerAbierto = false;
  };

  const elegirCapitulo = (e) => {
    nuevo = { ...nuevo, chapter: Number(e.target.value) || null, verseStart: null, verseEnd: null };
  };

  const elegirInicio = (e) => {
    const v = Number(e.target.value) || null;
    // Si el final quedaba por debajo del inicio, se arrastra.
    const fin = nuevo.verseEnd && nuevo.verseEnd >= v ? nuevo.verseEnd : v;
    nuevo = { ...nuevo, verseStart: v, verseEnd: fin };
  };

  const crear = async () => {
    if (!puedeCrear) return;
    guardando = true;
    try {
      const res = await sermonsStore.create({
        title: nuevo.title,
        book: nuevo.book,
        chapter: nuevo.chapter,
        verseStart: nuevo.verseStart,
        verseEnd: nuevo.verseEnd || nuevo.verseStart,
        version: $selectedBibleVersion,
        type: nuevo.type,
      });
      if (res.ok) {
        creando = false;
        mostrarAviso($_('app.sermons.created'));
      } else {
        mostrarAviso($_(res.error));
      }
    } finally {
      guardando = false;
    }
  };

  const borrar = async (s) => {
    await sermonsStore.remove(s.id);
    mostrarAviso($_('app.sermons.deleted'));
  };

  const duplicar = async (s) => {
    const res = await sermonsStore.duplicate(s.id);
    mostrarAviso(res.ok ? $_('app.sermons.duplicated') : $_(res.error));
  };

  const abrir = (s) => {
    window.history.pushState(null, '', `/predicile-mele/${encodeURIComponent(s.id)}`);
    // La errata `robibile` es la del resto del proyecto (CLAUDE.md, trampa 1).
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const alPulpito = (s) => {
    window.history.pushState(null, '', `/predicile-mele/${encodeURIComponent(s.id)}/amvon`);
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Qué dice el botón principal según en qué punto esté la predicación.
  const accionDe = (estado) =>
    estado === 'draft' ? 'continue' : estado === 'ready' ? 'view' : 'preach_again';

  onMount(() => {
    sermonsStore.refresh();
  });
</script>

<section class="predici">
  {#if !$isAuthenticated}
    <div class="predici__vacio">
      <p class="predici__vacio-icono" aria-hidden="true">📖</p>
      <p>{$_('app.sermons.login_required')}</p>
      <button type="button" class="predici__cta" on:click={openAuthMenu}>
        {$_('app.topics.login_prompt_action')}
      </button>
    </div>
  {:else if $currentUser?.userType !== 'preacher'}
    <!-- La ruta es privada pero alcanzable escribiendo la URL. Se explica en
         vez de dar un 404 seco: el usuario puede cambiar su tipo de cuenta. -->
    <div class="predici__vacio">
      <p class="predici__vacio-icono" aria-hidden="true">🔒</p>
      <p>{$_('app.sermons.only_preachers')}</p>
      <p class="predici__pista">{$_('app.sermons.only_preachers_hint')}</p>
    </div>
  {:else}
    <header class="predici__cabecera">
      <div>
        <p class="predici__eyebrow">{$_('app.sermons.eyebrow')}</p>
        <h1>{$_('app.sermons.title')}</h1>
      </div>
      <button type="button" class="predici__nueva" on:click={abrirCreacion}>
        <span aria-hidden="true">+</span>
        <span>{$_('app.sermons.new')}</span>
      </button>
    </header>

    {#if predicaciones.length > 0}
      <div class="predici__filtros" role="tablist" aria-label={$_('app.sermons.filter_label')}>
        {#each ESTADOS as estado (estado)}
          <button
            type="button"
            role="tab"
            class="predici__filtro"
            class:predici__filtro--activo={filtro === estado}
            aria-selected={filtro === estado}
            on:click={() => (filtro = estado)}
          >
            {$_(`app.sermons.filter_${estado}`)}
            <span class="predici__cuenta">{cuentas[estado]}</span>
          </button>
        {/each}
      </div>

      <label class="predici__buscar">
        <span class="sr-only">{$_('app.sermons.search')}</span>
        <input type="search" bind:value={busqueda} placeholder={$_('app.sermons.search')} />
      </label>
    {/if}

    {#if predicaciones.length === 0}
      <div class="predici__vacio">
        <p class="predici__vacio-icono" aria-hidden="true">✍️</p>
        <p>{$_('app.sermons.empty')}</p>
        <p class="predici__pista">{$_('app.sermons.empty_hint')}</p>
        <button type="button" class="predici__cta" on:click={abrirCreacion}>
          {$_('app.sermons.new')}
        </button>
      </div>
    {:else if visibles.length === 0}
      <p class="predici__sin-resultados">{$_('app.sermons.no_matches')}</p>
    {:else}
      <ul class="predici__lista">
        {#each visibles as s (s.id)}
          <li class="predica" class:predica--ready={s.status === 'ready'} class:predica--preached={s.status === 'preached'}>
            <button type="button" class="predica__cuerpo" on:click={() => abrir(s)}>
              <h2 class="predica__titulo">{s.title || $_('app.sermons.untitled')}</h2>
              <p class="predica__ref">{referenciaDe(s)}</p>
              <p class="predica__meta">
                <span class="predica__estado">{$_(`app.sermons.status_${s.status}`)}</span>
                <span aria-hidden="true">·</span>
                <span>{$_(`app.sermons.type_${s.type}`)}</span>
                <span aria-hidden="true">·</span>
                <span>{fechaDe(s.updatedAt)}</span>
              </p>
            </button>
            <div class="predica__acciones">
              {#if s.status !== 'draft'}
                <!-- Sólo cuando está preparada: entrar al púlpito con una
                     predicación a medias no lleva a ninguna parte. -->
                <button type="button" class="predica__accion predica__accion--amvon" on:click={() => alPulpito(s)}>
                  {$_('app.pulpit.mode')}
                </button>
              {/if}
              <button type="button" class="predica__accion predica__accion--principal" on:click={() => abrir(s)}>
                {$_(`app.sermons.action_${accionDe(s.status)}`)}
              </button>
              {#if s.status === 'preached'}
                <button type="button" class="predica__accion" on:click={() => duplicar(s)}>
                  {$_('app.sermons.duplicate')}
                </button>
              {/if}
              <button type="button" class="predica__accion predica__accion--borrar" on:click={() => borrar(s)}>
                {$_('app.sermons.delete')}
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    {#if aviso}
      <p class="predici__aviso" role="status">{aviso}</p>
    {/if}
  {/if}
</section>

<!-- ── Predicación nueva ────────────────────────────────────────────────── -->
{#if creando}
  <Modal
    open={true}
    eyebrow={$_('app.sermons.eyebrow')}
    title={$_('app.sermons.new')}
    size="md"
    onClose={() => (creando = false)}
  >
    <div class="nueva">
      <label class="nueva__campo">
        <span>{$_('app.sermons.field_title')}</span>
        <input type="text" bind:value={nuevo.title} maxlength="120" placeholder={$_('app.sermons.field_title_hint')} />
      </label>

      <div class="nueva__campo">
        <span>{$_('app.sermons.field_passage')}</span>
        <button type="button" class="nueva__libro" on:click={() => (drawerAbierto = true)}>
          {nuevo.book !== null ? map[nuevo.book] : $_('app.sermons.pick_book')}
        </button>
      </div>

      {#if nuevo.book !== null}
        <div class="nueva__fila">
          <label class="nueva__campo">
            <span>{$_('app.sermons.field_chapter')}</span>
            <select value={nuevo.chapter} on:change={elegirCapitulo}>
              <option value={null}>—</option>
              {#each capitulos as c (c)}
                <option value={c}>{c}</option>
              {/each}
            </select>
          </label>

          <label class="nueva__campo">
            <span>{$_('app.sermons.field_verse_start')}</span>
            <select value={nuevo.verseStart} on:change={elegirInicio} disabled={!nuevo.chapter}>
              <option value={null}>—</option>
              {#each versiculos as v (v)}
                <option value={v}>{v}</option>
              {/each}
            </select>
          </label>

          <label class="nueva__campo">
            <span>{$_('app.sermons.field_verse_end')}</span>
            <select bind:value={nuevo.verseEnd} disabled={!nuevo.verseStart}>
              {#each versiculos.filter((v) => !nuevo.verseStart || v >= nuevo.verseStart) as v (v)}
                <option value={v}>{v}</option>
              {/each}
            </select>
          </label>
        </div>
      {/if}

      {#if pericopa.length}
        <div class="nueva__pericopa">
          <p class="nueva__pericopa-ref">{map[nuevo.book]} {nuevo.chapter}:{nuevo.verseStart}{nuevo.verseEnd && nuevo.verseEnd !== nuevo.verseStart ? `-${nuevo.verseEnd}` : ''}</p>
          {#each pericopa as v (v.numero)}
            <p class="nueva__verso"><span class="nueva__numero">{v.numero}</span>{v.texto}</p>
          {/each}
        </div>
      {/if}

      <fieldset class="nueva__campo nueva__tipos">
        <legend>{$_('app.sermons.field_type')}</legend>
        {#each SERMON_TYPES as tipo (tipo)}
          <label class="nueva__tipo" class:nueva__tipo--activo={nuevo.type === tipo}>
            <input type="radio" name="sermonType" value={tipo} bind:group={nuevo.type} />
            <span class="nueva__tipo-nombre">{$_(`app.sermons.type_${tipo}`)}</span>
            <span class="nueva__tipo-pista">{$_(`app.sermons.type_${tipo}_hint`)}</span>
          </label>
        {/each}
      </fieldset>
    </div>

    <svelte:fragment slot="footer">
      <button type="button" class="nueva__cancelar" on:click={() => (creando = false)}>
        {$_('app.topics.cancel')}
      </button>
      <button type="button" class="nueva__crear" on:click={crear} disabled={!puedeCrear}>
        {guardando ? $_('auth.working') : $_('app.sermons.start')}
      </button>
    </svelte:fragment>
  </Modal>

  <BookDrawer
    open={drawerAbierto}
    {map}
    selectedBook={nuevo.book}
    onClose={() => (drawerAbierto = false)}
    onSelect={elegirLibro}
  />
{/if}

<style lang="scss">
  .predici {
    max-width: 52rem;
    margin: 0 auto;
    padding: clamp(0.5rem, 2vw, 1.5rem) 0;
  }

  .predici__cabecera {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;

    h1 {
      margin: 0.1rem 0 0;
      font-size: var(--font-size-h2);
    }
  }

  .predici__eyebrow {
    margin: 0;
    font-size: var(--font-size-tiny);
    font-weight: 600;
    letter-spacing: var(--letter-spacing-eyebrow);
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .predici__nueva,
  .predici__cta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1.1rem;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-pill);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);

    &:hover {
      background: var(--color-accent-hover);
      border-color: var(--color-accent-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  // ── Filtros ───────────────────────────────────────────────────────────────
  // Envuelven en vez de deslizarse.
  //
  // Antes era un carril con `overflow-x` y la barra escondida: a 360 px el
  // cuarto filtro («Predicate») quedaba partido a media palabra en el borde y
  // nada indicaba que hubiera más — un carril sin barra ni degradado es un
  // control invisible. Cuatro pastillas cortas caben en dos filas sin apretar.
  .predici__filtros {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.6rem;
  }

  .predici__filtro {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    flex: 0 0 auto;
    padding: 0.4rem 0.8rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink);
    font-size: var(--font-size-small);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);

    &--activo {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 12%, transparent);
      color: var(--color-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  .predici__cuenta {
    font-size: var(--font-size-tiny);
    opacity: 0.75;
  }

  .predici__buscar {
    display: block;
    margin-bottom: 1rem;

    input {
      width: 100%;
      min-height: 2.5rem;
      padding: 0.45rem 0.7rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
      font-size: var(--font-size-small);

      &:focus-visible {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
      }
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  // ── Lista ─────────────────────────────────────────────────────────────────
  .predici__lista {
    display: grid;
    gap: 0.65rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .predica {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: flex-start;
    justify-content: space-between;
    padding: 0.9rem 1rem;
    border: 1px solid var(--color-line);
    // La barra lateral dice el estado de un vistazo, sin leer la etiqueta.
    border-left: 3px solid var(--color-ink-soft);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--box-shadow-up);

    &--ready { border-left-color: var(--color-accent); }
    &--preached { border-left-color: var(--color-success); }
  }

  // Toda la tarjeta abre la predicación: es el gesto que se espera al tocarla.
  .predica__cuerpo {
    min-width: 0;
    flex: 1 1 14rem;
    padding: 0;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font: inherit;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }
  }

  .predica__titulo {
    margin: 0;
    font-size: var(--font-size-body);
    font-weight: 600;
    color: var(--color-ink);
  }

  .predica__ref {
    margin: 0.15rem 0 0;
    font-size: var(--font-size-small);
    font-weight: 600;
    color: var(--color-link);
  }

  .predica__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0.3rem 0 0;
    font-size: var(--font-size-tiny);
    color: var(--color-ink-soft);
  }

  .predica__estado { font-weight: 600; }

  .predica__acciones {
    display: flex;
    gap: 0.35rem;
    flex: 0 0 auto;
  }

  .predica__accion {
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    font-size: var(--font-size-tiny);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);

    &:hover {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }

    &--amvon {
      border-color: var(--color-success);
      color: var(--color-success);
      font-weight: 700;
    }

    &--principal {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }

    &--borrar:hover {
      border-color: var(--color-marked-favorite);
      color: var(--color-marked-favorite);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  // ── Estados vacíos ────────────────────────────────────────────────────────
  .predici__vacio {
    display: grid;
    gap: 0.6rem;
    justify-items: center;
    padding: clamp(2rem, 8vw, 4rem) 1rem;
    text-align: center;
    color: var(--color-ink-soft);

    p { margin: 0; }
  }

  .predici__vacio-icono { font-size: 2rem; }
  .predici__pista { font-size: var(--font-size-small); }

  .predici__sin-resultados {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--color-ink-soft);
  }

  .predici__aviso {
    margin: 1rem 0 0;
    text-align: center;
    font-size: var(--font-size-small);
    font-weight: 600;
    color: var(--color-accent);
  }

  // ── Formulario de predicación nueva ───────────────────────────────────────
  .nueva {
    display: grid;
    gap: 0.85rem;
  }

  .nueva__campo {
    display: grid;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    border: 0;
    font-size: var(--font-size-small);

    > span,
    legend {
      padding: 0;
      font-weight: 600;
      color: var(--color-ink);
    }

    input,
    select {
      min-height: 2.5rem;
      padding: 0.45rem 0.65rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;

      &:focus-visible {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
      }
    }
  }

  .nueva__fila {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.5rem;
  }

  .nueva__libro {
    min-height: 2.5rem;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-ink);
    font: inherit;
    font-size: var(--font-size-small);
    text-align: left;
    cursor: pointer;

    &:hover { border-color: var(--color-accent); }
  }

  // Vista previa del pasaje: se ve lo que se elige antes de crear nada.
  .nueva__pericopa {
    max-height: 11rem;
    overflow-y: auto;
    padding: 0.7rem 0.85rem;
    border-left: 3px solid var(--color-accent);
    border-radius: var(--radius-sm);
    background: var(--color-surface-sunken);
  }

  .nueva__pericopa-ref {
    margin: 0 0 0.4rem;
    font-size: var(--font-size-tiny);
    font-weight: 700;
    letter-spacing: var(--letter-spacing-eyebrow);
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .nueva__verso {
    margin: 0 0 0.3rem;
    font-size: var(--font-size-small);
    line-height: 1.55;
    color: var(--color-ink);
  }

  .nueva__numero {
    margin-right: 0.3rem;
    font-weight: 700;
    color: var(--color-link);
  }

  .nueva__tipos { gap: 0.4rem; }

  .nueva__tipo {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: baseline;
    gap: 0.1rem 0.5rem;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--transition);

    input { grid-row: span 2; align-self: center; min-height: 0; accent-color: var(--color-accent); }

    &:hover { border-color: var(--color-accent); }

    &--activo {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 8%, transparent);
    }
  }

  .nueva__tipo-nombre { font-weight: 600; color: var(--color-ink); }

  .nueva__tipo-pista {
    grid-column: 2;
    font-size: var(--font-size-tiny);
    line-height: 1.35;
    color: var(--color-ink-soft);
  }

  .nueva__cancelar,
  .nueva__crear {
    padding: 0.5rem 1.1rem;
    border-radius: var(--radius-pill);
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
  }

  .nueva__cancelar {
    border: 1px solid var(--color-line);
    background: transparent;
    color: var(--color-ink);

    &:hover { border-color: var(--color-accent); color: var(--color-accent); }
  }

  .nueva__crear {
    border: 1px solid var(--color-accent);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);

    &:hover:not(:disabled) { background: var(--color-accent-hover); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  @media (max-width: 40rem) {
    .nueva__fila { grid-template-columns: 1fr; }
  }
</style>
