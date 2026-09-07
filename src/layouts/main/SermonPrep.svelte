<script>
  /**
   * Preparación guiada de una predicación.
   *
   * Siete pasos en vez de un formulario gigante: TEXT → OBSERVARE → CONTEXT →
   * IDEE → STRUCTURĂ → DEZVOLTARE → FINALIZARE. Se puede retroceder y saltar
   * cualquier pregunta; **nada es obligatorio**. La aplicación acompaña, no
   * examina.
   *
   * Principio del módulo: RoBible NO escribe la predicación. Todo lo que se ve
   * aquí lo teclea el predicador; lo único que genera la aplicación es la
   * schiță, y a partir de la estructura que él mismo ha escrito.
   *
   * Guardado automático: se escribe en el dispositivo al instante y se sube con
   * retardo. Sin botón de guardar; sólo un «Salvat» discreto.
   */
  import { onDestroy, onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { sermonsStore } from '../../store/sermonsStore';
  import {
    STEPS,
    emptyContent,
    generateOutline,
    movePoint,
    newPoint,
    newSubpoint,
    normalizeContent,
    normalizeOutline,
    sermonWordCount,
    estimatedMinutes,
    stepCompletion,
  } from '../../services/sermon-content.service';

  export let bible = [];
  export let map = {};
  export let sermonId = '';

  let sermon = null;
  let content = emptyContent();
  let cargando = true;
  let paso = 'text';
  let estadoGuardado = ''; // '' | 'guardando' | 'guardado'
  let guardadoTimer;
  let etiquetaTimer;

  // Vista final y schiță
  let vista = 'prep'; // 'prep' | 'final' | 'outline'
  let outline = null;

  $: pasoIndex = STEPS.indexOf(paso);
  $: completado = stepCompletion(content);
  $: palabras = sermonWordCount(content);
  $: minutos = estimatedMinutes(palabras);

  // La perícopa, resuelta desde la Biblia del cliente. No viaja por la API: el
  // texto ya está en el dispositivo y así la preparación funciona sin conexión.
  $: pericopa = sermon
    ? Array.from(
        { length: (sermon.verseEnd || sermon.verseStart) - sermon.verseStart + 1 },
        (_, i) => ({
          numero: sermon.verseStart + i,
          texto: bible[sermon.book]?.[sermon.chapter - 1]?.[sermon.verseStart + i - 1] || '',
        }),
      ).filter((v) => v.texto)
    : [];

  $: referencia = sermon
    ? `${map[sermon.book] || ''} ${sermon.chapter}:${sermon.verseStart}${
        sermon.verseEnd && sermon.verseEnd !== sermon.verseStart ? `-${sermon.verseEnd}` : ''
      }`
    : '';

  // Contexto: los versículos de antes y de después, para leerlos sin salir.
  $: contextoAntes = sermon ? textoDeRango(sermon.book, sermon.chapter, Math.max(1, sermon.verseStart - 4), sermon.verseStart - 1) : [];
  $: contextoDespues = sermon ? textoDeRango(sermon.book, sermon.chapter, (sermon.verseEnd || sermon.verseStart) + 1, (sermon.verseEnd || sermon.verseStart) + 4) : [];

  function textoDeRango(book, chapter, desde, hasta) {
    if (desde > hasta) return [];
    const cap = bible[book]?.[chapter - 1] || [];
    const out = [];
    for (let v = desde; v <= hasta && v <= cap.length; v++) {
      if (cap[v - 1]) out.push({ numero: v, texto: cap[v - 1] });
    }
    return out;
  }

  // ── Guardado automático ───────────────────────────────────────────────────
  //
  // El retardo es para no mandar una petición por tecla. Lo local, en cambio,
  // se escribe de inmediato dentro de `sermonsStore.update`: si el navegador se
  // cierra a mitad de frase, lo escrito ya está a salvo en el dispositivo.
  const RETARDO_MS = 1200;

  const guardar = (cambios) => {
    estadoGuardado = 'guardando';
    clearTimeout(guardadoTimer);
    guardadoTimer = setTimeout(async () => {
      await sermonsStore.update(sermonId, cambios);
      estadoGuardado = 'guardado';
      clearTimeout(etiquetaTimer);
      etiquetaTimer = setTimeout(() => { estadoGuardado = ''; }, 2000);
    }, RETARDO_MS);
  };

  const guardarContenido = () => {
    content = { ...content };
    guardar({ content: JSON.stringify(content) });
  };

  // Guardado inmediato, sin esperar al retardo. Se usa al salir de la pantalla
  // y al cambiar de paso: son los momentos en que se puede perder lo tecleado.
  const guardarYa = async () => {
    clearTimeout(guardadoTimer);
    await sermonsStore.update(sermonId, { content: JSON.stringify(content) });
  };

  const irAPaso = async (siguiente) => {
    await guardarYa();
    paso = siguiente;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Marcas sobre el texto ─────────────────────────────────────────────────
  const alternarMarca = (numero, palabra) => {
    const clave = `${numero}|${palabra}`;
    const existe = content.marks.find((m) => `${m.verse}|${m.word}` === clave);
    content.marks = existe
      ? content.marks.filter((m) => `${m.verse}|${m.word}` !== clave)
      : [...content.marks, { verse: numero, word: palabra }];
    guardarContenido();
  };

  const estaMarcada = (numero, palabra) =>
    content.marks.some((m) => m.verse === numero && m.word === palabra);

  // Se parte por espacios conservando la puntuación pegada, para que al marcar
  // «stâncă.» y «stâncă» no se traten como dos palabras distintas.
  const palabrasDe = (texto) => texto.split(/(\s+)/).filter((t) => t.trim());
  const limpia = (p) => p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

  // ── Estructura ────────────────────────────────────────────────────────────
  const añadirPunto = () => {
    content.structure = [...content.structure, newPoint()];
    guardarContenido();
  };

  const borrarPunto = (id) => {
    content.structure = content.structure.filter((p) => p.id !== id);
    // El desarrollo huérfano se va con su punto: si no, el JSON crece con
    // trozos que ya no se ven en ninguna pantalla.
    const { [id]: _fuera, ...resto } = content.development;
    content.development = resto;
    guardarContenido();
  };

  const mover = (index, delta) => {
    content.structure = movePoint(content.structure, index, delta);
    guardarContenido();
  };

  const añadirSubpunto = (punto) => {
    punto.subpoints = [...(punto.subpoints || []), newSubpoint()];
    guardarContenido();
  };

  const borrarSubpunto = (punto, subId) => {
    punto.subpoints = punto.subpoints.filter((s) => s.id !== subId);
    guardarContenido();
  };

  const desarrolloDe = (id) => {
    if (!content.development[id]) {
      content.development[id] = { explain: '', illustrate: '', apply: '', refs: [] };
    }
    return content.development[id];
  };

  // ── Finalizar ─────────────────────────────────────────────────────────────
  const verFinal = async () => {
    await guardarYa();
    vista = 'final';
    window.scrollTo({ top: 0 });
  };

  const crearSchita = async () => {
    // Se genera una sola vez desde la estructura ya escrita. No se regenera
    // sola después: pisaría los retoques que el predicador haga a mano.
    outline = normalizeOutline(sermon?.outline) ;
    const vacia = !outline.points.length && !outline.idea;
    if (vacia) {
      outline = generateOutline(content);
      await sermonsStore.update(sermonId, { outline: JSON.stringify(outline) });
    }
    vista = 'outline';
    window.scrollTo({ top: 0 });
  };

  const regenerarSchita = async () => {
    outline = generateOutline(content);
    await sermonsStore.update(sermonId, { outline: JSON.stringify(outline) });
  };

  const guardarSchita = () => {
    estadoGuardado = 'guardando';
    clearTimeout(guardadoTimer);
    guardadoTimer = setTimeout(async () => {
      await sermonsStore.update(sermonId, { outline: JSON.stringify(outline) });
      estadoGuardado = 'guardado';
      clearTimeout(etiquetaTimer);
      etiquetaTimer = setTimeout(() => { estadoGuardado = ''; }, 2000);
    }, RETARDO_MS);
  };

  const marcarPreparada = async () => {
    await guardarYa();
    await sermonsStore.update(sermonId, { status: 'ready' });
    sermon = sermonsStore.get(sermonId);
  };

  const volverALista = () => {
    window.history.pushState(null, '', '/predici');
    // La errata `robibile` es la del resto del proyecto (CLAUDE.md, trampa 1).
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  onMount(async () => {
    sermon = await sermonsStore.load(sermonId);
    content = normalizeContent(sermon?.content);
    outline = normalizeOutline(sermon?.outline);
    cargando = false;
  });

  onDestroy(() => {
    clearTimeout(guardadoTimer);
    clearTimeout(etiquetaTimer);
    // Al salir se guarda sin esperar: el usuario puede estar navegando fuera
    // justo después de teclear.
    if (sermonId && !cargando) {
      sermonsStore.update(sermonId, { content: JSON.stringify(content) });
    }
  });
</script>

<section class="prep">
  {#if cargando}
    <p class="prep__estado" role="status">{$_('app.loading')}</p>
  {:else if !sermon}
    <div class="prep__estado">
      <p>{$_('auth.errors.sermon_not_found')}</p>
      <button type="button" class="prep__cta" on:click={volverALista}>{$_('app.sermons.title')}</button>
    </div>
  {:else}
    <!-- Cabecera común a las tres vistas -->
    <header class="prep__cabecera">
      <button type="button" class="prep__volver" on:click={volverALista}>
        <span aria-hidden="true">←</span>
        <span>{$_('app.sermons.title')}</span>
      </button>
      <div class="prep__guardado" aria-live="polite">
        {#if estadoGuardado === 'guardando'}
          <span class="prep__guardado-texto">{$_('app.sermons.saving')}</span>
        {:else if estadoGuardado === 'guardado'}
          <span class="prep__guardado-texto prep__guardado-texto--ok">{$_('app.sermons.saved')}</span>
        {/if}
      </div>
    </header>

    <h1 class="prep__titulo">{sermon.title || $_('app.sermons.untitled')}</h1>
    <p class="prep__ref">{referencia}</p>

    {#if vista === 'prep'}
      <!-- ── Línea de progreso ────────────────────────────────────────── -->
      <nav class="pasos" aria-label={$_('app.sermons.steps_label')}>
        {#each STEPS as s, i (s)}
          <button
            type="button"
            class="pasos__paso"
            class:pasos__paso--activo={paso === s}
            class:pasos__paso--hecho={completado[s]}
            aria-current={paso === s ? 'step' : undefined}
            on:click={() => irAPaso(s)}
          >
            <span class="pasos__num">{i + 1}</span>
            <span class="pasos__nombre">{$_(`app.sermons.step_${s}`)}</span>
          </button>
        {/each}
      </nav>

      <!-- ── TEXT ─────────────────────────────────────────────────────── -->
      {#if paso === 'text'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_text')}</h2>
          <p class="bloque__ayuda">{$_('app.sermons.text_help')}</p>
          <div class="texto">
            {#each pericopa as v (v.numero)}
              <p class="texto__verso">
                <span class="texto__num">{v.numero}</span>
                {#each palabrasDe(v.texto) as palabra, i (`${v.numero}-${i}`)}
                  <button
                    type="button"
                    class="texto__palabra"
                    class:texto__palabra--marcada={estaMarcada(v.numero, limpia(palabra))}
                    on:click={() => alternarMarca(v.numero, limpia(palabra))}
                  >{palabra}</button>
                {/each}
              </p>
            {/each}
          </div>
          {#if content.marks.length}
            <p class="bloque__marcadas">
              {$_('app.sermons.marked_count', { count: content.marks.length })}
            </p>
          {/if}
        </div>

      <!-- ── OBSERVARE ────────────────────────────────────────────────── -->
      {:else if paso === 'observation'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_observation')}</h2>
          <p class="bloque__ayuda">{$_('app.sermons.optional_help')}</p>
          {#each ['repeats', 'contrasts', 'actions', 'tension', 'truth'] as clave (clave)}
            <label class="campo">
              <span>{$_(`app.sermons.obs_${clave}`)}</span>
              <textarea rows="3" bind:value={content.observation[clave]} on:input={guardarContenido}></textarea>
            </label>
          {/each}
        </div>

      <!-- ── CONTEXT ──────────────────────────────────────────────────── -->
      {:else if paso === 'context'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_context')}</h2>

          {#if contextoAntes.length}
            <details class="contexto">
              <summary>{$_('app.sermons.context_before')}</summary>
              {#each contextoAntes as v (v.numero)}
                <p class="contexto__verso"><span class="texto__num">{v.numero}</span>{v.texto}</p>
              {/each}
            </details>
          {/if}
          {#if contextoDespues.length}
            <details class="contexto">
              <summary>{$_('app.sermons.context_after')}</summary>
              {#each contextoDespues as v (v.numero)}
                <p class="contexto__verso"><span class="texto__num">{v.numero}</span>{v.texto}</p>
              {/each}
            </details>
          {/if}

          {#each ['before', 'after', 'historical'] as clave (clave)}
            <label class="campo">
              <span>{$_(`app.sermons.ctx_${clave}`)}</span>
              <textarea rows="3" bind:value={content.context[clave]} on:input={guardarContenido}></textarea>
            </label>
          {/each}
        </div>

      <!-- ── IDEEA CENTRALĂ ───────────────────────────────────────────── -->
      {:else if paso === 'idea'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_idea')}</h2>
          <label class="campo">
            <span>{$_('app.sermons.idea_central')}</span>
            <small class="campo__pista">{$_('app.sermons.idea_central_help')}</small>
            <textarea rows="2" bind:value={content.idea.central} on:input={guardarContenido}></textarea>
          </label>
          <label class="campo">
            <span>{$_('app.sermons.idea_purpose')}</span>
            <small class="campo__pista">{$_('app.sermons.idea_purpose_help')}</small>
            <textarea rows="3" bind:value={content.idea.purpose} on:input={guardarContenido}></textarea>
          </label>
          <label class="campo">
            <span>{$_('app.sermons.idea_question')}</span>
            <small class="campo__pista">{$_('app.sermons.idea_question_help')}</small>
            <textarea rows="2" bind:value={content.idea.question} on:input={guardarContenido}></textarea>
          </label>
        </div>

      <!-- ── STRUCTURA ────────────────────────────────────────────────── -->
      {:else if paso === 'structure'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_structure')}</h2>
          <p class="bloque__ayuda">{$_('app.sermons.structure_help')}</p>

          {#each content.structure as punto, i (punto.id)}
            <div class="punto">
              <div class="punto__cabecera">
                <span class="punto__num">{i + 1}</span>
                <input
                  type="text"
                  class="punto__titulo"
                  bind:value={punto.title}
                  on:input={guardarContenido}
                  placeholder={$_('app.sermons.point_placeholder')}
                />
                <div class="punto__mover">
                  <button type="button" on:click={() => mover(i, -1)} disabled={i === 0} aria-label={$_('app.sermons.move_up')}>↑</button>
                  <button type="button" on:click={() => mover(i, 1)} disabled={i === content.structure.length - 1} aria-label={$_('app.sermons.move_down')}>↓</button>
                  <button type="button" class="punto__borrar" on:click={() => borrarPunto(punto.id)} aria-label={$_('app.sermons.delete')}>✕</button>
                </div>
              </div>

              {#each punto.subpoints || [] as sub, j (sub.id)}
                <div class="subpunto">
                  <span class="subpunto__num">{i + 1}.{j + 1}</span>
                  <input type="text" bind:value={sub.title} on:input={guardarContenido} placeholder={$_('app.sermons.subpoint_placeholder')} />
                  <button type="button" class="punto__borrar" on:click={() => borrarSubpunto(punto, sub.id)} aria-label={$_('app.sermons.delete')}>✕</button>
                </div>
              {/each}

              <!-- Sólo dos niveles: no hay «añadir subpunto» dentro de un subpunto -->
              <button type="button" class="punto__añadir-sub" on:click={() => añadirSubpunto(punto)}>
                + {$_('app.sermons.add_subpoint')}
              </button>
            </div>
          {/each}

          <button type="button" class="bloque__añadir" on:click={añadirPunto}>
            + {$_('app.sermons.add_point')}
          </button>
        </div>

      <!-- ── DEZVOLTARE ───────────────────────────────────────────────── -->
      {:else if paso === 'development'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_development')}</h2>
          {#if !content.structure.length}
            <p class="bloque__ayuda">{$_('app.sermons.development_needs_structure')}</p>
            <button type="button" class="bloque__añadir" on:click={() => irAPaso('structure')}>
              {$_('app.sermons.step_structure')}
            </button>
          {:else}
            {#each content.structure as punto, i (punto.id)}
              {@const d = desarrolloDe(punto.id)}
              <div class="punto">
                <h3 class="punto__nombre">{i + 1}. {punto.title || $_('app.sermons.point_placeholder')}</h3>
                <label class="campo">
                  <span>{$_('app.sermons.dev_explain')}</span>
                  <textarea rows="3" bind:value={d.explain} on:input={guardarContenido}></textarea>
                </label>
                <label class="campo">
                  <span>{$_('app.sermons.dev_illustrate')}</span>
                  <textarea rows="3" bind:value={d.illustrate} on:input={guardarContenido}></textarea>
                </label>
                <label class="campo">
                  <span>{$_('app.sermons.dev_apply')}</span>
                  <textarea rows="3" bind:value={d.apply} on:input={guardarContenido}></textarea>
                </label>
              </div>
            {/each}
          {/if}
        </div>

      <!-- ── FINALIZARE ───────────────────────────────────────────────── -->
      {:else if paso === 'final'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_final')}</h2>
          <label class="campo">
            <span>{$_('app.sermons.intro')}</span>
            <small class="campo__pista">{$_('app.sermons.intro_help')}</small>
            <textarea rows="5" bind:value={content.intro} on:input={guardarContenido}></textarea>
          </label>
          <label class="campo">
            <span>{$_('app.sermons.conclusion')}</span>
            <small class="campo__pista">{$_('app.sermons.conclusion_help')}</small>
            <textarea rows="5" bind:value={content.conclusion} on:input={guardarContenido}></textarea>
          </label>
          <button type="button" class="prep__cta" on:click={verFinal}>
            {$_('app.sermons.finish')}
          </button>
        </div>
      {/if}

      <!-- Navegación entre pasos -->
      <div class="prep__nav">
        <button type="button" disabled={pasoIndex === 0} on:click={() => irAPaso(STEPS[pasoIndex - 1])}>
          ← {$_('app.sermons.previous_step')}
        </button>
        <button type="button" disabled={pasoIndex === STEPS.length - 1} on:click={() => irAPaso(STEPS[pasoIndex + 1])}>
          {$_('app.sermons.next_step')} →
        </button>
      </div>

    <!-- ── PREDICA FINALĂ ─────────────────────────────────────────────── -->
    {:else if vista === 'final'}
      <article class="documento">
        <p class="documento__meta">
          {$_('app.sermons.word_count', { count: palabras })} · {$_('app.sermons.minutes', { count: minutos })}
        </p>

        {#if content.intro.trim()}
          <h2>{$_('app.sermons.intro')}</h2>
          <p class="documento__parrafo">{content.intro}</p>
        {/if}

        {#each content.structure as punto, i (punto.id)}
          {@const d = content.development[punto.id] || {}}
          <h2>{i + 1}. {punto.title || $_('app.sermons.point_placeholder')}</h2>
          {#each punto.subpoints || [] as sub, j (sub.id)}
            <h3>{i + 1}.{j + 1} {sub.title}</h3>
          {/each}
          {#if d.explain}<p class="documento__parrafo">{d.explain}</p>{/if}
          {#if d.illustrate}<p class="documento__parrafo documento__parrafo--ilustra">{d.illustrate}</p>{/if}
          {#if d.apply}<p class="documento__parrafo">{d.apply}</p>{/if}
        {/each}

        {#if content.conclusion.trim()}
          <h2>{$_('app.sermons.conclusion')}</h2>
          <p class="documento__parrafo">{content.conclusion}</p>
        {/if}
      </article>

      <div class="prep__acciones">
        <button type="button" on:click={() => (vista = 'prep')}>{$_('app.sermons.edit')}</button>
        <button type="button" on:click={crearSchita}>{$_('app.sermons.create_outline')}</button>
        <button type="button" class="prep__cta" on:click={marcarPreparada}>
          {$_('app.sermons.mark_ready')}
        </button>
      </div>

    <!-- ── SCHIȚA ─────────────────────────────────────────────────────── -->
    {:else if vista === 'outline' && outline}
      <div class="bloque">
        <h2>{$_('app.sermons.outline')}</h2>
        <p class="bloque__ayuda">{$_('app.sermons.outline_help')}</p>

        <label class="campo">
          <span>{$_('app.sermons.idea_central')}</span>
          <input type="text" bind:value={outline.idea} on:input={guardarSchita} />
        </label>

        {#each outline.points as p, i (p.id || i)}
          <div class="punto">
            <input type="text" class="punto__titulo" bind:value={p.title} on:input={guardarSchita} />
            <label class="campo">
              <span>{$_('app.sermons.outline_keywords')}</span>
              <input
                type="text"
                value={(p.keywords || []).join(' · ')}
                on:input={(e) => { p.keywords = e.target.value.split('·').map((s) => s.trim()).filter(Boolean); guardarSchita(); }}
              />
            </label>
          </div>
        {/each}

        <label class="campo">
          <span>{$_('app.sermons.outline_application')}</span>
          <textarea rows="2" bind:value={outline.application} on:input={guardarSchita}></textarea>
        </label>
        <label class="campo">
          <span>{$_('app.sermons.conclusion')}</span>
          <textarea rows="2" bind:value={outline.conclusion} on:input={guardarSchita}></textarea>
        </label>
      </div>

      <div class="prep__acciones">
        <button type="button" on:click={() => (vista = 'final')}>← {$_('app.sermons.back_to_sermon')}</button>
        <button type="button" on:click={regenerarSchita}>{$_('app.sermons.regenerate_outline')}</button>
      </div>
    {/if}
  {/if}
</section>

<style lang="scss">
  .prep {
    max-width: 46rem;
    margin: 0 auto;
    padding: clamp(0.5rem, 2vw, 1.5rem) 0 4rem;
  }

  .prep__estado {
    display: grid;
    gap: 0.75rem;
    justify-items: center;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--color-ink-soft);
  }

  .prep__cabecera {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .prep__volver {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.6rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-link);
    font-size: var(--font-size-small);
    font-weight: 600;
    cursor: pointer;

    &:hover { text-decoration: underline; }
  }

  // Indicador de guardado: discreto a propósito. Confirma sin pedir nada.
  .prep__guardado { min-height: 1.2rem; }

  .prep__guardado-texto {
    font-size: var(--font-size-tiny);
    color: var(--color-ink-soft);

    &--ok { color: var(--color-success); font-weight: 600; }
  }

  .prep__titulo {
    margin: 0;
    font-size: var(--font-size-h3);
  }

  .prep__ref {
    margin: 0.1rem 0 1rem;
    font-size: var(--font-size-small);
    font-weight: 600;
    color: var(--color-link);
  }

  // ── Línea de pasos ────────────────────────────────────────────────────────
  // Se desliza en horizontal: con siete pasos, partirlos en varias filas en
  // móvil haría perder de vista dónde está uno.
  .pasos {
    display: flex;
    gap: 0.35rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
    scrollbar-width: none;

    &::-webkit-scrollbar { display: none; }
  }

  .pasos__paso {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    flex: 0 0 auto;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    font-size: var(--font-size-tiny);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);

    &--hecho {
      border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
      color: var(--color-success);
    }

    &--activo {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 12%, transparent);
      color: var(--color-accent);
    }

    &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  }

  .pasos__num {
    display: grid;
    place-items: center;
    width: 1.15rem;
    height: 1.15rem;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, currentcolor 16%, transparent);
    font-size: 0.65rem;
  }

  // ── Bloques de paso ───────────────────────────────────────────────────────
  .bloque {
    display: grid;
    gap: 0.85rem;
    padding: 1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    background: var(--color-surface);

    h2 { margin: 0; font-size: var(--font-size-h3); }
    h3 { margin: 0; font-size: var(--font-size-body); }
  }

  .bloque__ayuda {
    margin: 0;
    font-size: var(--font-size-small);
    color: var(--color-ink-soft);
  }

  .bloque__marcadas {
    margin: 0;
    font-size: var(--font-size-tiny);
    font-weight: 600;
    color: var(--color-accent);
  }

  .bloque__añadir,
  .punto__añadir-sub {
    justify-self: start;
    padding: 0.4rem 0.85rem;
    border: 1px dashed var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
    font-weight: 600;
    cursor: pointer;

    &:hover { border-color: var(--color-accent); color: var(--color-accent); }
  }

  .campo {
    display: grid;
    gap: 0.25rem;
    font-size: var(--font-size-small);

    > span { font-weight: 600; color: var(--color-ink); }

    textarea,
    input {
      width: 100%;
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
      font-size: var(--font-size-small);
      line-height: 1.5;
      resize: vertical;

      &:focus-visible {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
      }
    }
  }

  .campo__pista {
    font-size: var(--font-size-tiny);
    color: var(--color-ink-soft);
  }

  // ── Texto marcable ────────────────────────────────────────────────────────
  .texto {
    max-height: 22rem;
    overflow-y: auto;
    padding: 0.75rem;
    border-left: 3px solid var(--color-accent);
    border-radius: var(--radius-sm);
    background: var(--color-surface-sunken);
  }

  .texto__verso { margin: 0 0 0.5rem; line-height: 1.75; }

  .texto__num {
    margin-right: 0.3rem;
    font-size: var(--font-size-tiny);
    font-weight: 700;
    color: var(--color-link);
  }

  // Cada palabra es un botón. Sin fondo ni borde para que el texto siga
  // leyéndose como texto y no como una fila de controles.
  .texto__palabra {
    padding: 0 0.1rem;
    border: 0;
    border-radius: 0.2rem;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;

    &:hover { background: color-mix(in srgb, var(--color-accent) 14%, transparent); }

    &--marcada {
      background: color-mix(in srgb, var(--color-marked-favorite) 32%, transparent);
      font-weight: 700;
    }

    &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
  }

  .contexto {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-surface-sunken);

    summary {
      font-size: var(--font-size-small);
      font-weight: 600;
      color: var(--color-accent);
      cursor: pointer;
    }
  }

  .contexto__verso {
    margin: 0.4rem 0 0;
    font-size: var(--font-size-small);
    line-height: 1.6;
  }

  // ── Puntos ────────────────────────────────────────────────────────────────
  .punto {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
  }

  .punto__cabecera {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .punto__num,
  .subpunto__num {
    flex: 0 0 auto;
    font-size: var(--font-size-small);
    font-weight: 700;
    color: var(--color-accent);
  }

  .punto__titulo {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-ink);
    font: inherit;
    font-size: var(--font-size-small);
    font-weight: 600;
  }

  .punto__nombre { color: var(--color-ink); }

  .punto__mover {
    display: flex;
    gap: 0.15rem;

    button {
      width: 1.7rem;
      height: 1.7rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink-soft);
      cursor: pointer;

      &:disabled { opacity: 0.35; cursor: not-allowed; }
      &:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
    }
  }

  .punto__borrar:hover:not(:disabled) {
    border-color: var(--color-marked-favorite) !important;
    color: var(--color-marked-favorite) !important;
  }

  .subpunto {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding-left: 1rem;

    input {
      flex: 1 1 auto;
      min-width: 0;
      padding: 0.35rem 0.55rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
      font-size: var(--font-size-small);
    }

    button {
      width: 1.6rem;
      height: 1.6rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink-soft);
      cursor: pointer;
    }
  }

  // ── Navegación y acciones ─────────────────────────────────────────────────
  .prep__nav,
  .prep__acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: space-between;
    margin-top: 1rem;

    button {
      padding: 0.5rem 1rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-pill);
      background: transparent;
      color: var(--color-ink);
      font-size: var(--font-size-small);
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);

      &:disabled { opacity: 0.35; cursor: not-allowed; }
      &:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
    }
  }

  .prep__acciones { justify-content: flex-end; }

  .prep__cta {
    justify-self: start;
    padding: 0.55rem 1.2rem;
    border: 1px solid var(--color-accent) !important;
    border-radius: var(--radius-pill);
    background: var(--color-accent) !important;
    color: var(--color-on-primary) !important;
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;

    &:hover { background: var(--color-accent-hover) !important; }
  }

  // ── Documento final ───────────────────────────────────────────────────────
  .documento {
    padding: 1.25rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    line-height: var(--line-height-body);

    h2 {
      margin: 1.25rem 0 0.4rem;
      font-size: var(--font-size-h3);

      &:first-of-type { margin-top: 0; }
    }

    h3 {
      margin: 0.75rem 0 0.3rem;
      font-size: var(--font-size-body);
      color: var(--color-ink-soft);
    }
  }

  .documento__meta {
    margin: 0 0 1rem;
    font-size: var(--font-size-tiny);
    color: var(--color-ink-soft);
  }

  .documento__parrafo {
    margin: 0 0 0.6rem;
    white-space: pre-wrap;
    color: var(--color-ink);

    // La ilustración se distingue del resto sin gritar: es material de apoyo.
    &--ilustra {
      padding-left: 0.75rem;
      border-left: 2px solid var(--color-line);
      color: var(--color-ink-soft);
      font-style: italic;
    }
  }
</style>
