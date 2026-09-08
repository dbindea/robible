<script>
  /**
   * Modo Amvon: lo que el predicador ve mientras predica.
   *
   * Está escrito como si Internet no existiera. Todo sale de la instantánea que
   * se guardó en el dispositivo al marcar la predicación como preparada; aquí
   * **no se hace ni una petición de red**, y por tanto no puede aparecer ningún
   * mensaje de "sin conexión" delante de la congregación.
   *
   * Se dibuja como una capa fija a pantalla completa en lugar de reutilizar el
   * modo inmersivo: así no hay forma de que se cuele la cabecera, el menú o un
   * botón flotante de otra parte de la aplicación. Lo que se ve es la schiță y
   * poco más.
   *
   * La navegación es una página vertical continua, no diapositivas. En el
   * púlpito no se pulsa "siguiente": se baja un poco con el pulgar y se sigue.
   */
  import { onDestroy, onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { sermonsStore } from '../../store/sermonsStore';
  import { normalizeOutline, quitarMarcas } from '../../services/sermon-content.service';
  import {
    FONT_SIZES,
    clearActive,
    formatElapsed,
    getFontSize,
    getPlannedMinutes,
    getPosition,
    getSnapshot,
    keepScreenAwake,
    markActive,
    savePosition,
    setFontSize,
    setPlannedMinutes,
  } from '../../services/sermon-pulpit.service';

  export let sermonId = '';

  let snapshot = null;
  let outline = null;
  let sermon = null;
  let cargando = true;

  // 'prep' = antesala con las comprobaciones · 'live' = predicando
  let fase = 'prep';

  let tamano = 'large';
  let minutosPrevistos = 0;
  let pantallaActiva = { supported: false, release: () => {} };

  // Cronómetro
  let inicio = 0;
  let transcurrido = 0;
  let tickTimer;

  // Overlay de referencia bíblica
  let refAbierta = null;
  let scrollGuardado = 0;

  let contenedor;
  let guardarPosTimer;

  $: puntos = outline?.points || [];
  $: minutosTranscurridos = Math.floor(transcurrido / 60000);

  // ── Ni una petición mientras se predica ─────────────────────────────────
  //
  // La analítica manda una vista de página en cada cambio de ruta, así que al
  // entrar aquí salía una petición. Falla en silencio sin conexión, pero rompe
  // la promesa del modo: en el púlpito no se toca la red.
  //
  // `ga-disable-<ID>` es el interruptor oficial de Google: mientras vale `true`,
  // la librería no envía nada. Se apaga al entrar y se restablece al salir, para
  // no dejar la analítica muerta en el resto de la aplicación.
  const MEDIDOR = 'ga-disable-G-MX8YYQ3DRY';

  const silenciarAnalitica = (silencio) => {
    if (typeof window === 'undefined') return;
    window[MEDIDOR] = silencio;
  };

  onMount(() => {
    silenciarAnalitica(true);
    snapshot = getSnapshot(sermonId);
    sermon = sermonsStore.get(sermonId);
    // La schiță sale de la instantánea; si por lo que sea no está, se cae a la
    // guardada con la predicación. Lo que nunca se hace es ir a buscarla fuera.
    outline = normalizeOutline(snapshot?.outline ?? sermon?.outline);
    tamano = getFontSize();
    minutosPrevistos = getPlannedMinutes();
    cargando = false;
  });

  onDestroy(() => {
    detener();
    silenciarAnalitica(false);
  });

  const empezar = async () => {
    fase = 'live';
    markActive(sermonId);
    pantallaActiva = keepScreenAwake();
    inicio = Date.now();
    transcurrido = 0;
    // Un tick por segundo: el reloj sólo tiene que ser legible, no exacto.
    tickTimer = setInterval(() => { transcurrido = Date.now() - inicio; }, 1000);

    await new Promise((r) => setTimeout(r, 50));
    // Se vuelve donde se quedó: si el teléfono se bloqueó y la pestaña murió,
    // al reabrir se retoma en el mismo punto en vez de al principio.
    if (contenedor) contenedor.scrollTop = getPosition(sermonId);
  };

  const detener = () => {
    clearInterval(tickTimer);
    clearTimeout(guardarPosTimer);
    pantallaActiva.release?.();
    pantallaActiva = { supported: false, release: () => {} };
  };

  const salir = () => {
    detener();
    clearActive();
    if (contenedor) savePosition(sermonId, contenedor.scrollTop);
    window.history.pushState(null, '', `/predicile-mele/${encodeURIComponent(sermonId)}`);
    // La errata `robibile` es la del resto del proyecto (CLAUDE.md, trampa 1).
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const terminarYMarcar = async () => {
    detener();
    clearActive();
    await sermonsStore.update(sermonId, { status: 'preached' });
    salir();
  };

  // La posición se guarda con retardo para no escribir en localStorage en cada
  // píxel de scroll, que en un móvil modesto se nota.
  const alHacerScroll = () => {
    clearTimeout(guardarPosTimer);
    guardarPosTimer = setTimeout(() => {
      if (contenedor) savePosition(sermonId, contenedor.scrollTop);
    }, 800);
  };

  const cambiarTamano = (valor) => {
    tamano = valor;
    setFontSize(valor);
  };

  const cambiarMinutos = (e) => {
    minutosPrevistos = Number(e.target.value) || 0;
    setPlannedMinutes(minutosPrevistos);
  };

  // ── Referencias ─────────────────────────────────────────────────────────
  // Se abren desde la instantánea, nunca desde la red. Al cerrar se vuelve
  // EXACTAMENTE donde estaba: el predicador no puede perder el hilo por
  // consultar un versículo.
  const abrirReferencia = (etiqueta) => {
    const encontrada = (snapshot?.references || []).find((r) => r.label === etiqueta);
    scrollGuardado = contenedor?.scrollTop ?? 0;
    refAbierta = encontrada || { label: etiqueta, text: '' };
  };

  const cerrarReferencia = async () => {
    refAbierta = null;
    await new Promise((r) => setTimeout(r, 0));
    if (contenedor) contenedor.scrollTop = scrollGuardado;
  };
</script>

{#if cargando}
  <p class="amvon-cargando" role="status">{$_('app.loading')}</p>

{:else if fase === 'prep'}
  <!-- ── Antesala ──────────────────────────────────────────────────────── -->
  <section class="antesala">
    <p class="antesala__eyebrow">{$_('app.pulpit.mode')}</p>
    <h1>{sermon?.title || snapshot?.title || $_('app.sermons.untitled')}</h1>
    <p class="antesala__ref">{snapshot?.reference || ''}</p>

    <ul class="antesala__checks">
      <li class:antesala__check--ok={!!snapshot}>
        <span aria-hidden="true">{snapshot ? '✓' : '!'}</span>
        {snapshot ? $_('app.pulpit.check_offline_ok') : $_('app.pulpit.check_offline_missing')}
      </li>
      <li class:antesala__check--ok={puntos.length > 0}>
        <span aria-hidden="true">{puntos.length ? '✓' : '!'}</span>
        {puntos.length ? $_('app.pulpit.check_outline_ok') : $_('app.pulpit.check_outline_missing')}
      </li>
      <li class:antesala__check--ok={true}>
        <span aria-hidden="true">✓</span>
        {$_('app.pulpit.check_screen')}
      </li>
    </ul>

    <!-- El tamaño se elige AQUÍ, no durante la predicación: los controles no
         deben estar delante mientras se predica. -->
    <div class="antesala__campo">
      <span>{$_('app.pulpit.font_size')}</span>
      <div class="antesala__tamanos">
        {#each FONT_SIZES as t (t)}
          <button
            type="button"
            class="antesala__tamano"
            class:antesala__tamano--activo={tamano === t}
            aria-pressed={tamano === t}
            on:click={() => cambiarTamano(t)}
          >{$_(`app.pulpit.font_${t}`)}</button>
        {/each}
      </div>
    </div>

    <label class="antesala__campo">
      <span>{$_('app.pulpit.planned_minutes')}</span>
      <select value={minutosPrevistos} on:change={cambiarMinutos}>
        <option value={0}>{$_('app.pulpit.no_timer')}</option>
        {#each [20, 25, 30, 35, 40, 45, 60] as m (m)}
          <option value={m}>{m} min</option>
        {/each}
      </select>
    </label>

    <div class="antesala__acciones">
      <button type="button" class="antesala__salir" on:click={salir}>{$_('app.pulpit.back')}</button>
      <button type="button" class="antesala__empezar" on:click={empezar} disabled={!puntos.length}>
        {$_('app.pulpit.start')}
      </button>
    </div>
  </section>

{:else}
  <!-- ── Predicando ────────────────────────────────────────────────────── -->
  <div
    class="amvon amvon--{tamano}"
    bind:this={contenedor}
    on:scroll={alHacerScroll}
  >
    <!-- Barra mínima: salir y, si se pidió, el reloj. Nada más. -->
    <div class="amvon__barra">
      <button type="button" class="amvon__salir" on:click={salir} aria-label={$_('app.pulpit.exit')}>✕</button>
      {#if minutosPrevistos > 0}
        <span class="amvon__reloj">{minutosTranscurridos} / {minutosPrevistos}</span>
      {:else}
        <span class="amvon__reloj">{formatElapsed(transcurrido)}</span>
      {/if}
    </div>

    <article class="amvon__hoja">
      <h1 class="amvon__titulo">{sermon?.title || snapshot?.title || ''}</h1>
      <p class="amvon__ref">{snapshot?.reference || ''}</p>

      {#if outline.idea}
        <p class="amvon__idea">{outline.idea}</p>
      {/if}

      {#if outline.intro?.length}
        <div class="amvon__bloque">
          <p class="amvon__etiqueta">{$_('app.sermons.intro')}</p>
          {#each outline.intro as linea, i (i)}
            <p class="amvon__linea">{linea}</p>
          {/each}
        </div>
      {/if}

      {#each puntos as punto, i (punto.id || i)}
        <!-- Separador ancho entre puntos: en el púlpito hay que ver de un
             vistazo dónde empieza cada uno. -->
        <hr class="amvon__separador" />
        <div class="amvon__bloque">
          <!-- Sin los asteriscos del marcado manual: son sintaxis de
               preparación y aquí el predicador está delante de la iglesia. -->
          <h2 class="amvon__punto">{i + 1}. {quitarMarcas(punto.title)}</h2>
          {#each punto.keywords || [] as clave, k (k)}
            <p class="amvon__clave">{clave}</p>
          {/each}
          {#each punto.refs || [] as ref, r (r)}
            <button type="button" class="amvon__referencia" on:click={() => abrirReferencia(ref)}>
              {ref}
            </button>
          {/each}
        </div>
      {/each}

      {#if outline.application}
        <hr class="amvon__separador" />
        <div class="amvon__bloque">
          <p class="amvon__etiqueta">{$_('app.sermons.outline_application')}</p>
          <p class="amvon__linea">{outline.application}</p>
        </div>
      {/if}

      {#if outline.conclusion}
        <hr class="amvon__separador" />
        <div class="amvon__bloque">
          <p class="amvon__etiqueta">{$_('app.sermons.conclusion')}</p>
          <p class="amvon__linea">{outline.conclusion}</p>
        </div>
      {/if}

      <div class="amvon__final">
        <button type="button" class="amvon__terminar" on:click={terminarYMarcar}>
          {$_('app.pulpit.finish')}
        </button>
      </div>
    </article>
  </div>

  <!-- Overlay de referencia. Al cerrarlo se vuelve al mismo punto del scroll. -->
  {#if refAbierta}
    <div class="refoverlay" role="dialog" aria-modal="true" aria-label={refAbierta.label}>
      <div class="refoverlay__panel amvon--{tamano}">
        <p class="refoverlay__ref">{refAbierta.label}</p>
        {#if refAbierta.text}
          <p class="refoverlay__texto">{refAbierta.text}</p>
        {:else}
          <p class="refoverlay__texto refoverlay__texto--vacio">{$_('app.pulpit.reference_unavailable')}</p>
        {/if}
        <button type="button" class="refoverlay__cerrar" on:click={cerrarReferencia}>
          {$_('app.pulpit.close_reference')}
        </button>
      </div>
    </div>
  {/if}
{/if}

<style lang="scss">
  .amvon-cargando {
    padding: 3rem 1rem;
    text-align: center;
    color: var(--color-ink-soft);
  }

  // ── Antesala ──────────────────────────────────────────────────────────────
  .antesala {
    max-width: 34rem;
    margin: 0 auto;
    padding: clamp(1rem, 4vw, 2.5rem) 1rem;
    display: grid;
    gap: 1rem;

    h1 { margin: 0; font-size: var(--font-size-h2); }
  }

  .antesala__eyebrow {
    margin: 0;
    font-size: var(--font-size-tiny);
    font-weight: 700;
    letter-spacing: var(--letter-spacing-eyebrow);
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .antesala__ref {
    margin: 0;
    font-weight: 600;
    color: var(--color-link);
  }

  .antesala__checks {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0.85rem 1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
    list-style: none;

    li {
      display: flex;
      gap: 0.5rem;
      font-size: var(--font-size-small);
      color: var(--color-ink-soft);
    }

    span { font-weight: 700; color: var(--color-marked-favorite); }
  }

  .antesala__check--ok span { color: var(--color-success); }

  .antesala__campo {
    display: grid;
    gap: 0.35rem;
    font-size: var(--font-size-small);

    > span { font-weight: 600; color: var(--color-ink); }

    select {
      min-height: 2.5rem;
      padding: 0.45rem 0.65rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
    }
  }

  .antesala__tamanos { display: flex; gap: 0.4rem; }

  .antesala__tamano {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-ink);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);

    &--activo {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 12%, transparent);
      color: var(--color-accent);
    }
  }

  .antesala__acciones {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .antesala__salir,
  .antesala__empezar {
    padding: 0.6rem 1.4rem;
    border-radius: var(--radius-pill);
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;
  }

  .antesala__salir {
    border: 1px solid var(--color-line);
    background: transparent;
    color: var(--color-ink);
  }

  .antesala__empezar {
    border: 1px solid var(--color-accent);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);

    &:disabled { opacity: 0.45; cursor: not-allowed; }
  }

  // ── Predicando ────────────────────────────────────────────────────────────
  //
  // Capa fija a pantalla completa: es lo que garantiza que no se cuele la
  // cabecera, el menú ni ningún botón flotante de otra parte de la aplicación.
  .amvon {
    position: fixed;
    inset: 0;
    z-index: 200;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: var(--color-page);
    color: var(--color-ink);
  }

  // Tres escalas. Los valores son grandes a propósito: esto se lee de pie, a
  // medio metro y con luz de sala, no en la mano.
  .amvon--normal { --amvon-punto: 1.75rem; --amvon-clave: 1.35rem; --amvon-linea: 1.15rem; }
  .amvon--large { --amvon-punto: 2.35rem; --amvon-clave: 1.75rem; --amvon-linea: 1.4rem; }
  .amvon--xlarge { --amvon-punto: 3rem; --amvon-clave: 2.2rem; --amvon-linea: 1.7rem; }

  .amvon__barra {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.85rem;
    background: color-mix(in srgb, var(--color-page) 88%, transparent);
    backdrop-filter: blur(8px);
  }

  .amvon__salir {
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    font-size: 1rem;
    cursor: pointer;
  }

  // El reloj es información, no una alarma: discreto y sin animación.
  .amvon__reloj {
    font-size: var(--font-size-small);
    font-variant-numeric: tabular-nums;
    color: var(--color-ink-soft);
  }

  .amvon__hoja {
    max-width: 40rem;
    margin: 0 auto;
    padding: 1rem 1.25rem 6rem;
  }

  .amvon__titulo {
    margin: 0;
    font-size: var(--amvon-clave);
    line-height: 1.2;
  }

  .amvon__ref {
    margin: 0.2rem 0 1.5rem;
    font-size: var(--font-size-body);
    font-weight: 600;
    color: var(--color-link);
  }

  .amvon__idea {
    margin: 0 0 1.5rem;
    padding: 0.75rem 1rem;
    border-left: 0.35rem solid var(--color-accent);
    font-size: var(--amvon-linea);
    font-weight: 600;
    line-height: 1.4;
  }

  .amvon__separador {
    margin: 2.5rem 0;
    border: 0;
    border-top: 2px solid var(--color-line);
  }

  .amvon__bloque { margin-bottom: 1.25rem; }

  .amvon__etiqueta {
    margin: 0 0 0.5rem;
    font-size: var(--font-size-small);
    font-weight: 700;
    letter-spacing: var(--letter-spacing-eyebrow);
    text-transform: uppercase;
    color: var(--color-ink-soft);
  }

  .amvon__punto {
    margin: 0 0 1rem;
    font-size: var(--amvon-punto);
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.01em;
  }

  // Las palabras clave van sueltas y muy espaciadas: son anclas para la vista,
  // no frases que se lean seguidas.
  //
  // El guion lo pone el CSS y no el texto: en el atril hace que la columna se
  // lea como lista de un vistazo, pero el dato guardado sigue siendo la idea
  // limpia. La sangría negativa lo saca al margen para que las ideas queden
  // alineadas entre sí aunque una ocupe dos líneas.
  .amvon__clave {
    margin: 0 0 0.75rem;
    padding-left: 1.1em;
    text-indent: -1.1em;
    font-size: var(--amvon-clave);
    font-weight: 600;
    line-height: 1.3;

    &::before {
      content: '– ';
      color: var(--color-accent);
    }
  }

  .amvon__linea {
    margin: 0 0 0.75rem;
    font-size: var(--amvon-linea);
    line-height: 1.5;
    // La aplicación y la conclusión se escriben a mano en la schiță y pueden
    // llevar saltos de línea. Sin esto se pegan en un párrafo corrido.
    white-space: pre-line;
  }

  .amvon__referencia {
    display: inline-block;
    margin: 0.25rem 0.4rem 0.25rem 0;
    padding: 0.4rem 0.85rem;
    border: 2px solid var(--color-accent);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-accent);
    font-size: var(--amvon-linea);
    font-weight: 700;
    cursor: pointer;
  }

  .amvon__final {
    margin-top: 3rem;
    text-align: center;
  }

  .amvon__terminar {
    padding: 0.75rem 1.75rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
    font-weight: 600;
    cursor: pointer;

    &:hover { border-color: var(--color-success); color: var(--color-success); }
  }

  // ── Overlay de referencia ─────────────────────────────────────────────────
  .refoverlay {
    position: fixed;
    inset: 0;
    z-index: 210;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: color-mix(in srgb, var(--color-page) 92%, transparent);
  }

  .refoverlay__panel {
    width: min(38rem, 100%);
    max-height: 80dvh;
    overflow-y: auto;
    padding: 1.5rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--box-shadow-lg);
  }

  .refoverlay__ref {
    margin: 0 0 0.75rem;
    font-size: var(--font-size-body);
    font-weight: 700;
    letter-spacing: var(--letter-spacing-eyebrow);
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .refoverlay__texto {
    margin: 0 0 1.5rem;
    font-size: var(--amvon-linea);
    line-height: 1.6;
    color: var(--color-ink);

    &--vacio { color: var(--color-ink-soft); font-style: italic; }
  }

  .refoverlay__cerrar {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-pill);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font-size: var(--font-size-body);
    font-weight: 700;
    cursor: pointer;
  }
</style>
