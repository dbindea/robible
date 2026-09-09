<script>
  /**
   * Memorización de versículos (`/memorare`).
   *
   * Método de la primera letra con niveles anidados: se empieza viendo el
   * versículo entero y se va tapando cada vez más, conservando la inicial de
   * cada palabra. No es una idea nueva — es como se memoriza con papel — y por
   * eso funciona: la inicial es la pista justa, y la longitud de la palabra
   * también dice algo.
   *
   * **Privada, con `noindex`**: es el avance de una persona, no contenido.
   */
  import { onMount, tick } from 'svelte';
  import Icon from '../../components/Icon.svelte';
  import { _ } from '../../services/i18n.service';
  import { memorizeStore } from '../../store/memorizeStore';
  import { isAuthenticated } from '../../store/authStore';
  import { openAuthMenu } from '../../store/authMenuStore';
  import { applySeoMetadata } from '../../services/seo.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../../store/stores';
  import { buildBiblePath } from '../../services/bible-route.service';
  import {
    trocearPalabras,
    indicesOcultos,
    enmascarar,
    semillaDe,
    tocaRepasar,
    NIVEL_MAXIMO,
  } from '../../services/memorize.service';

  export let bible = {};
  export let map = {};

  // El versículo que se está practicando. `null` = la lista.
  let practicando = null;
  let nivel = 1;
  // Se revela con un botón, no al pasar de nivel: el momento de comprobar es
  // parte del ejercicio.
  let revelado = false;
  let ahora = new Date();

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);

  $: applySeoMetadata({
    title: $_('app.memorize.seo_title'),
    description: $_('app.memorize.seo_description'),
    canonicalPath: '/memorare',
    versionConfig,
    robots: 'noindex, follow',
  });

  // ── Lista ────────────────────────────────────────────────────────────────

  const conTexto = (m) => ({
    ...m,
    reference: `${map[m.book] || ''} ${m.chapter}:${m.verse}`.trim(),
    text: bible?.[m.book]?.[m.chapter - 1]?.[m.verse - 1] || '',
    href: buildBiblePath({ version: versionConfig?.value, map, book: m.book, chapter: m.chapter, verse: m.verse }),
  });

  // Se compara contra `$memorizeStore` y `ahora` escritos tal cual: envolver la
  // condición en un helper le esconde la dependencia al compilador (trampa 23).
  $: items = $memorizeStore.map(conTexto);
  $: pendientes = items.filter((m) => tocaRepasar(m, ahora));
  $: aprendidos = items.filter((m) => !tocaRepasar(m, ahora));

  // ── Práctica ─────────────────────────────────────────────────────────────

  $: piezas = practicando ? trocearPalabras(practicando.text) : [];
  $: ocultos = practicando ? indicesOcultos(piezas.length, revelado ? 0 : nivel, semillaDe(practicando)) : new Set();

  const empezar = (item) => {
    practicando = item;
    // Se arranca en 1 y no en 0: el nivel 0 es el texto tal cual, que es lo que
    // ya se ve en la lista.
    nivel = 1;
    revelado = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const salir = () => {
    practicando = null;
    revelado = false;
  };

  const cambiarNivel = (delta) => {
    nivel = Math.max(0, Math.min(NIVEL_MAXIMO, nivel + delta));
    revelado = false;
  };

  const responder = async (acertado) => {
    const { book, chapter, verse } = practicando;
    await memorizeStore.review(book, chapter, verse, acertado);
    // Se recalcula la fecha de corte para que el versículo recién repasado salga
    // de «pendientes» sin recargar la página.
    ahora = new Date();
    await tick();
    salir();
  };

  const quitar = async (item) => {
    await memorizeStore.remove(item.book, item.chapter, item.verse);
    if (practicando && practicando.id === item.id) salir();
    ahora = new Date();
  };

  const irAlVersiculo = (href) => {
    if (!href) return;
    window.history.pushState(null, '', href);
    // La errata `robibile` es la del resto del proyecto (CLAUDE.md, trampa 1).
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  /** «Mañana», «en 4 días»… sin librería de fechas ni claves por número. */
  const cuando = (iso) => {
    if (!iso) return '';
    const dias = Math.ceil((new Date(iso).getTime() - ahora.getTime()) / 86_400_000);
    if (dias <= 0) return $_('app.memorize.due_now');
    if (dias === 1) return $_('app.memorize.due_in_one');
    return $_('app.memorize.due_in', { count: dias });
  };

  onMount(() => {
    memorizeStore.refresh();
    ahora = new Date();
  });
</script>

<section class="memorare">
  {#if !$isAuthenticated}
    <div class="aviso">
      <h1>{$_('app.memorize.title')}</h1>
      <p>{$_('app.memorize.login_required')}</p>
      <button class="boton" on:click={openAuthMenu}>{$_('app.topics.login_prompt_action')}</button>
    </div>
  {:else if practicando}
    <!-- ── Práctica ──────────────────────────────────────────────────────── -->
    <div class="practica">
      <div class="practica__cabecera">
        <button class="volver" on:click={salir}>
          <Icon name="arrow-left" />
          {$_('app.memorize.back_to_list')}
        </button>
        <p class="practica__ref">{practicando.reference}</p>
      </div>

      <div class="niveles" role="group" aria-label={$_('app.memorize.level')}>
        <button class="nivel-btn" on:click={() => cambiarNivel(-1)} disabled={nivel === 0} aria-label={$_('app.memorize.easier')}>
          <Icon name="minus" />
        </button>
        <div class="niveles__barra" aria-hidden="true">
          {#each Array(NIVEL_MAXIMO + 1) as _punto, i (i)}
            <span class="niveles__punto" class:niveles__punto--activo={i <= nivel}></span>
          {/each}
        </div>
        <button class="nivel-btn" on:click={() => cambiarNivel(1)} disabled={nivel === NIVEL_MAXIMO} aria-label={$_('app.memorize.harder')}>
          <Icon name="plus" />
        </button>
      </div>

      <!-- El separador va en el DOM y no como `margin` en el CSS. Con margen se
           veía bien pero el `textContent` salía todo pegado: al copiar el
           versículo y al leerlo un lector de pantalla, las palabras se juntaban.
           Es una expresión y no un espacio suelto en la plantilla porque en
           chino no debe haber separación —cada pieza es un ideograma— y porque
           un espacio literal aquí lo recorta el compilador. -->
      <p class="practica__texto" class:practica__texto--revelado={revelado}>
        {#each piezas as pieza, i (i)}<span
            class="pieza"
            class:pieza--oculta={ocultos.has(i)}>{ocultos.has(i) ? enmascarar(pieza) : pieza.texto}</span>{pieza.cjk ? '' : ' '}{/each}
      </p>

      <div class="practica__acciones">
        {#if !revelado}
          <button class="boton boton--suave" on:click={() => (revelado = true)}>
            <Icon name="eye" />
            {$_('app.memorize.reveal')}
          </button>
        {:else}
          <p class="practica__pregunta">{$_('app.memorize.how_did_it_go')}</p>
          <div class="practica__botones">
            <button class="boton boton--suave" on:click={() => responder(false)}>
              {$_('app.memorize.again')}
            </button>
            <button class="boton" on:click={() => responder(true)}>
              <Icon name="check" />
              {$_('app.memorize.got_it')}
            </button>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- ── Lista ─────────────────────────────────────────────────────────── -->
    <header class="portada">
      <p class="portada__eyebrow">{$_('app.memorize.eyebrow')}</p>
      <h1 class="portada__titulo">{$_('app.memorize.title')}</h1>
      <p class="portada__lead">{$_('app.memorize.lead')}</p>
    </header>

    {#if !items.length}
      <div class="vacio">
        <span class="vacio__icono" aria-hidden="true"><Icon name="brain" /></span>
        <p>{$_('app.memorize.empty')}</p>
        <p class="vacio__pista">{$_('app.memorize.empty_hint')}</p>
      </div>
    {:else}
      <!-- Con cero pendientes no se enseña un «0» enorme: no informa de nada y
           parece un fallo. La cifra sólo aparece cuando hay algo que hacer. -->
      <div class="resumen">
        {#if pendientes.length}
          <p class="resumen__cifra">{pendientes.length}</p>
          <p class="resumen__texto">
            {pendientes.length === 1 ? $_('app.memorize.due_one') : $_('app.memorize.due_many')}
          </p>
        {:else}
          <p class="resumen__texto">{$_('app.memorize.all_done')}</p>
        {/if}
      </div>

      {#if pendientes.length}
        <h2 class="grupo">{$_('app.memorize.section_due')}</h2>
        <ul class="lista">
          {#each pendientes as m (m.id)}
            <li class="fila fila--pendiente">
              <div class="fila__texto">
                <p class="fila__ref">{m.reference}</p>
                <p class="fila__verso">{m.text}</p>
              </div>
              <div class="fila__acciones">
                <button class="boton boton--pequeno" on:click={() => empezar(m)}>{$_('app.memorize.practice')}</button>
                <button class="icono" on:click={() => irAlVersiculo(m.href)} aria-label={$_('app.memorize.open_context')}>
                  <Icon name="book-open" />
                </button>
                <button class="icono" on:click={() => quitar(m)} aria-label={$_('app.memorize.remove')}>
                  <Icon name="trash" />
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}

      {#if aprendidos.length}
        <h2 class="grupo">{$_('app.memorize.section_learned')}</h2>
        <ul class="lista">
          {#each aprendidos as m (m.id)}
            <li class="fila">
              <div class="fila__texto">
                <p class="fila__ref">
                  {m.reference}
                  <span class="fila__cuando">{cuando(m.dueAt)}</span>
                </p>
                <p class="fila__verso">{m.text}</p>
              </div>
              <div class="fila__acciones">
                <button class="boton boton--pequeno boton--suave" on:click={() => empezar(m)}>{$_('app.memorize.practice')}</button>
                <button class="icono" on:click={() => quitar(m)} aria-label={$_('app.memorize.remove')}>
                  <Icon name="trash" />
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  {/if}
</section>

<style lang="scss">
  .memorare {
    width: 100%;
    max-width: 46rem;
    margin: 0 auto;
    padding: clamp(0.5rem, 2vw, 1.5rem) 0 4rem;
  }

  // ── Portada ───────────────────────────────────────────────────────────────
  .portada {
    margin-bottom: 1.25rem;
    padding: clamp(1.25rem, 4vw, 2rem);
    border: 1px solid var(--color-line);
    border-radius: 0.5rem;
    background: var(--color-surface);
    box-shadow: var(--box-shadow-lg);
  }

  .portada__eyebrow {
    margin: 0 0 0.3rem;
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .portada__titulo {
    margin: 0 0 0.5rem;
    color: var(--color-ink-strong);
    font-size: clamp(1.6rem, 5vw, 2.2rem);
    line-height: 1.15;
  }

  .portada__lead {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-lead);
    line-height: var(--line-height-body);
  }

  // ── Estados ───────────────────────────────────────────────────────────────
  .aviso,
  .vacio {
    padding: 3rem 1.5rem;
    color: var(--color-ink-soft);
    text-align: center;

    p { margin: 0 0 0.5rem; }
  }

  // Sólo `.aviso` lleva h1; agrupado con `.vacio` el compilador avisaba de
  // selector muerto, que es justo la señal que se pierde si se ignora.
  .aviso h1 {
    color: var(--color-ink-strong);
  }

  .vacio__icono {
    display: inline-flex;
    margin-bottom: 0.75rem;
    color: var(--color-accent);
    --icon-size: 2.5rem;
  }

  .vacio__pista {
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
  }

  .resumen {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin-bottom: 1.5rem;
    padding: 0.9rem 1.15rem;
    border: 1px solid var(--color-line);
    border-left: 3px solid var(--color-accent);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
  }

  .resumen__cifra {
    margin: 0;
    color: var(--color-accent-ink);
    font-size: 1.9rem;
    font-weight: 800;
    line-height: 1;
  }

  .resumen__texto {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
    font-weight: 600;
  }

  .grupo {
    margin: 1.5rem 0 0.6rem;
    color: var(--color-ink-strong);
    font-size: 1rem;
  }

  // ── Lista ─────────────────────────────────────────────────────────────────
  .lista {
    display: grid;
    gap: 0.6rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .fila {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: flex-start;
    justify-content: space-between;
    padding: 0.9rem 1.05rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
  }

  // El pendiente se marca con el mismo verde que «versículo en lectura» no vale
  // aquí: verde ya significa otra cosa (trampa 16). Se usa el acento.
  .fila--pendiente {
    border-left: 3px solid var(--color-accent);
  }

  .fila__texto {
    flex: 1 1 14rem;
    min-width: 0;
  }

  .fila__ref {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
    margin: 0 0 0.2rem;
    color: var(--color-accent-ink);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .fila__cuando {
    color: var(--color-ink-soft);
    font-size: 0.74rem;
    font-weight: 600;
  }

  .fila__verso {
    margin: 0;
    color: var(--color-ink);
    font-size: 0.92rem;
    line-height: 1.5;
    // Dos líneas: la lista es para elegir, no para leer. El texto entero está en
    // la práctica y en el capítulo.
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }

  .fila__acciones {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }

  // ── Práctica ──────────────────────────────────────────────────────────────
  .practica {
    padding: clamp(1.25rem, 4vw, 2rem);
    border: 1px solid var(--color-line);
    border-radius: 0.5rem;
    background: var(--color-surface);
    box-shadow: var(--box-shadow-lg);
  }

  .practica__cabecera {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }

  .volver {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2.25rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    font: inherit;
    font-size: var(--font-size-small);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    --icon-size: 0.95rem;

    &:hover { border-color: var(--color-accent); color: var(--color-ink); }
  }

  .practica__ref {
    margin: 0;
    color: var(--color-accent-ink);
    font-size: 1rem;
    font-weight: 700;
  }

  .niveles {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .nivel-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    // 2,5rem y no menos: es un control que se pulsa muchas veces seguidas y con
    // el móvil en la mano (WCAG 2.5.8 pide 24 px de mínimo).
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid var(--color-line);
    border-radius: 50%;
    background: var(--color-surface-raised);
    color: var(--color-ink);
    cursor: pointer;
    transition: var(--transition);
    --icon-size: 1rem;

    &:hover:not(:disabled) { border-color: var(--color-accent); }
    &:disabled { opacity: 0.4; cursor: default; }
  }

  .niveles__barra {
    display: flex;
    gap: 0.3rem;
  }

  .niveles__punto {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-ink) 14%, transparent);
    transition: background var(--motion-base);
  }

  .niveles__punto--activo {
    background: var(--color-accent);
  }

  .practica__texto {
    margin: 0 0 1.75rem;
    color: var(--color-ink);
    font-size: clamp(1.15rem, 3.5vw, 1.4rem);
    line-height: 1.9;
    text-align: center;
  }

  .pieza {
    // `inline-block` para que una palabra tapada no se parta a mitad de línea.
    display: inline-block;
  }

  .pieza--oculta {
    padding: 0 0.15rem;
    border-radius: 0.2rem;
    background: color-mix(in srgb, var(--color-ink) 6%, transparent);
    color: var(--color-ink-soft);
    // Tabular para que los puntos de relleno no bailen de ancho y la longitud de
    // la palabra siga siendo una pista fiable.
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }

  .practica__texto--revelado .pieza {
    animation: aparece var(--motion-base) var(--ease-out) both;
  }

  @keyframes aparece {
    from { opacity: 0.4; }
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .practica__texto--revelado .pieza { animation: none; }
  }

  .practica__acciones {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }

  .practica__pregunta {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
    font-weight: 600;
  }

  .practica__botones {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    justify-content: center;
  }

  // ── Controles ─────────────────────────────────────────────────────────────
  .boton {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    min-height: 2.5rem;
    padding: 0.55rem 1.2rem;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    // Relleno de acento porque lleva texto encima: el acento a secas da 3.30:1.
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
    --icon-size: 1rem;

    &:hover { background: var(--color-accent-solid-hover); }
  }

  .boton--suave {
    border-color: var(--color-line);
    background: var(--color-surface-raised);
    color: var(--color-ink);

    &:hover { border-color: var(--color-accent); background: var(--wash-hover); }
  }

  .boton--pequeno {
    min-height: 2.25rem;
    padding: 0.4rem 0.9rem;
    font-size: var(--font-size-small);
  }

  .icono {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-ink-soft);
    cursor: pointer;
    transition: var(--transition);
    --icon-size: 1.05rem;

    &:hover { border-color: var(--color-accent); color: var(--color-ink); }
  }
</style>
