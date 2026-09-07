<script>
  import Icon from './Icon.svelte';
  import { onDestroy } from 'svelte';
  import { AMBIENCES, musicService } from '../services/music.service.js';
  import { _ } from '../services/i18n.service';
  import {
    ttsState,
    ttsPanelOpen,
    ttsSpeed,
    ttsAmbient,
    musicVolume,
    setTtsVerse,
    updateTtsWord,
    stopTts,
    pauseTts,
    resumeTts,
    endTts,
  } from '../store/ttsStore.js';

  /**
   * Versículos a leer, en el orden en que están en pantalla.
   * Cada elemento: { book, chapter, index, text, key }.
   * Es el mismo array que pinta Result.svelte, así que el resaltado siempre
   * cae sobre un versículo visible.
   */
  export let playlist = [];
  /** Nombres de libro de la versión activa, para la etiqueta "Génesis 1:4". */
  export let map = null;

  // Panel/expand state
  $: isOpen = $ttsPanelOpen;
  $: state = $ttsState;
  $: isPlaying = state.playing;
  $: isPaused = state.paused;
  $: available = musicService.isAvailable();
  $: isActive = isPlaying || isPaused;

  const SPEED_OPTIONS = [
    { value: 0.75, label: '0.75×' },
    { value: 1.0, label: '1×' },
    { value: 1.5, label: '1.5×' },
    { value: 2.0, label: '2×' },
  ];

  // El catálogo manda: así añadir un ambiente es tocar music.service.js y su
  // clave de traducción, nada más.
  const AMBIENT_OPTIONS = [
    ...AMBIENCES.map((a) => ({ value: a.key, labelKey: `app.tts.ambient_${a.key}` })),
    { value: 'none', labelKey: 'app.tts.ambient_none' },
  ];

  // ── Sitio para los botones flotantes ──────────────────────────────────────
  //
  // El player es una barra fija abajo con z-index 60, y ahí abajo también viven
  // el botón de subir y el de salir del modo lectura (z-index 8 y 50). Mientras
  // suena la música quedaban tapados: se veía asomar media pastilla por detrás.
  //
  // En vez de subirles el z-index —que sólo cambiaría quién tapa a quién— el
  // player publica cuánto ocupa y ellos se apartan. Es una variable global
  // porque los tres viven en componentes distintos.
  //
  // Se mide en lugar de escribir un número: la barra cambia de alto al abrir
  // el panel, y con la altura mínima puesta a mano los botones seguían medio
  // tapados. `ResizeObserver` lo recalcula sin que haya que acordarse.
  const publicarAltura = (px) => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--player-offset', px ? `${Math.round(px)}px` : '0px');
  };

  let observador;
  $: if (barRef) {
    observador?.disconnect();
    observador = new ResizeObserver(() => {
      // La guarda no sobra: al parar la música el componente se desmonta y
      // `barRef` queda a null, pero el observador todavía dispara una vez más.
      if (!barRef) return;
      // Lo que ocupa de verdad: su alto más lo que la separa del borde.
      publicarAltura(window.innerHeight - barRef.getBoundingClientRect().top);
    });
    observador.observe(barRef);
  }
  $: if (!isActive) publicarAltura(0);

  onDestroy(() => {
    clearTimers();
    musicService.stop();
    observador?.disconnect();
    publicarAltura(0);
  });

  function togglePanel() {
    ttsPanelOpen.update((v) => !v);
  }

  // ── Reproducción ────────────────────────────────────────────────────────────
  // Se lee la lista que está en pantalla (`playlist`), no un capítulo fijo.
  // Así funciona igual en la vista de capítulo que en los resultados de una
  // búsqueda por palabra, que mezclan versículos de libros distintos.
  //
  // No hay voz: es música de fondo + resaltado del versículo avanzando. El
  // ritmo se estima por número de palabras y se ajusta con la velocidad.

  let timers = [];
  let cursor = 0; // índice dentro de playlist del versículo en curso

  const clearTimers = () => {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  };

  // Milisegundos que se mantiene un versículo, según su longitud.
  const MS_POR_PALABRA = 380;
  const MARGEN_MS = 600;
  const duracionDe = (item) => {
    const palabras = item.text.trim().split(/\s+/).length;
    return (palabras * MS_POR_PALABRA) / $ttsSpeed + MARGEN_MS;
  };

  function reproducirDesde(index) {
    clearTimers();

    if (index >= playlist.length) {
      // Fin de la lista: parar del todo y volver a pantalla normal.
      finalizar();
      return;
    }

    cursor = index;
    const item = playlist[index];
    setTtsVerse(item);

    // Animación del resaltado palabra a palabra dentro del versículo.
    const palabras = item.text.trim().split(/\s+/).length;
    const pasoMs = MS_POR_PALABRA / $ttsSpeed;
    for (let w = 0; w < palabras; w++) {
      timers.push(setTimeout(() => updateTtsWord(w, palabras), w * pasoMs));
    }

    timers.push(setTimeout(() => reproducirDesde(index + 1), duracionDe(item)));
  }

  function finalizar() {
    clearTimers();
    musicService.stop();
    endTts();
    cursor = 0;
  }

  /** Arranca la lectura desde el principio de la lista visible. */
  async function startPlayback() {
    if (!playlist.length) return;

    clearTimers();

    // La música se arranca desde el click, que es el gesto de usuario que los
    // navegadores exigen para permitir audio.
    if ($ttsAmbient !== 'none') {
      await musicService.play($ttsAmbient);
      musicService.setVolume($musicVolume);
    }

    reproducirDesde(0);
  }

  /** Para y resetea: posición, música y modo lectura. */
  function stopPlayback() {
    clearTimers();
    musicService.stop();
    stopTts();
    cursor = 0;
  }

  /** Congela: se mantiene el versículo resaltado y el modo lectura. */
  function pausePlayback() {
    clearTimers();
    musicService.pause();
    pauseTts();
  }

  /** Continúa desde el versículo donde se congeló. */
  async function resumePlayback() {
    await musicService.resume();
    resumeTts();
    reproducirDesde(cursor);
  }


  // Cambiar la velocidad en marcha: se reprograman los timers del versículo
  // actual con el ritmo nuevo, sin cortar la música.
  function handleSpeedChange(e) {
    ttsSpeed.set(Number(e.target.value));
    if (isPlaying) reproducirDesde(cursor);
  }

  async function handleAmbientChange(e) {
    const value = e.target.value;
    ttsAmbient.set(value);
    if (value === 'none') {
      musicService.stop();
    } else {
      await musicService.play($ttsAmbient);
      musicService.setVolume($musicVolume);
    }
  }

  function handleMusicVolumeChange(e) {
    musicVolume.set(Number(e.target.value));
    musicService.setVolume(Number(e.target.value));
  }

  // Touch swipe: detect drag up/down on the mini bar
  let barRef;
  let touchStartY = 0;
  let isDragging = false;
  function onTouchStart(e) { touchStartY = e.touches[0].clientY; isDragging = false; }
  function onTouchMove(e) {
    const delta = e.touches[0].clientY - touchStartY;
    if (Math.abs(delta) > 8) isDragging = true;
  }
  function onTouchEnd(e) {
    if (!isDragging) return;
    const delta = e.changedTouches[0].clientY - touchStartY;
    if (delta < -30) ttsPanelOpen.set(true); // swipe up → expand
    else if (delta > 30) ttsPanelOpen.set(false); // swipe down → minimize
  }
</script>

{#if available && isActive}
<!-- ── MINI PLAYER BAR ── sits at bottom of screen, always visible when active ── -->
<div
  class="tts-bar"
  class:tts-bar--open={isOpen}
  bind:this={barRef}
  role="region"
  aria-label={$_('app.tts.player')}
>
  <!-- Swipe handle (visible tab at top) -->
  <button
    type="button"
    class="tts-bar__handle"
    aria-label={$_('app.tts.expand')}
    on:click={togglePanel}
    on:touchstart={onTouchStart}
    on:touchmove={onTouchMove}
    on:touchend={onTouchEnd}
  >
    <span class="tts-bar__handle-bar"></span>
  </button>

  <!-- Compact bar content -->
  <div class="tts-bar__row">
    <!-- Left: controls -->
    <div class="tts-bar__controls">
      {#if isPlaying}
        <button type="button" class="tts-bar__btn tts-bar__btn--pause" on:click={pausePlayback} title={$_('app.tts.pause')} aria-label={$_('app.tts.pause')}>
          <Icon name="pause" weight="fill" />
        </button>
      {:else}
        <button type="button" class="tts-bar__btn tts-bar__btn--play" on:click={resumePlayback} title={$_('app.tts.resume')} aria-label={$_('app.tts.resume')}>
          <Icon name="play" weight="fill" />
        </button>
      {/if}
      <button type="button" class="tts-bar__btn tts-bar__btn--stop" on:click={stopPlayback} title={$_('app.tts.stop')} aria-label={$_('app.tts.stop')}>
        <Icon name="stop" weight="fill" />
      </button>
    </div>

    <!-- Center: verse reference + progress -->
    <button type="button" class="tts-bar__info" on:click={togglePanel} aria-label={$_('app.tts.open_player')}>
      <span class="tts-bar__ref">
        {map?.[state.currentBook]} {state.currentChapter}:{state.currentVerse}
      </span>
      <div class="tts-bar__progress" aria-hidden="true">
        <div
          class="tts-bar__progress-fill"
          style="width: {state.wordCount > 0 ? Math.round((state.wordIndex + 1) / state.wordCount * 100) : 0}%"
        ></div>
      </div>
    </button>

    <!-- Right: expand indicator -->
    <button type="button" class="tts-bar__expand" on:click={togglePanel} aria-label={isOpen ? $_('app.tts.minimize') : $_('app.tts.open_player')} aria-expanded={isOpen}>
      <!-- La clase va en el envoltorio: `class:` es una directiva de elemento y
           no se puede poner sobre un componente. -->
      <span class="tts-bar__chevron" class:tts-bar__chevron--up={!isOpen}>
        <Icon name="chevron-up" />
      </span>
    </button>
  </div>

  <!-- ── EXPANDED CONTROLS PANEL ── slides up from the bar ── -->
  {#if isOpen}
    <div class="tts-panel" role="region" aria-label={$_('app.tts.controls')}>
      <!-- Speed -->
      <div class="tts-panel__row">
        <span class="tts-panel__label">{$_('app.tts.speed')}</span>
        <div class="tts-speed-btns" role="group">
          {#each SPEED_OPTIONS as opt (opt.value)}
            <button
              type="button"
              class="tts-speed-btn"
              class:tts-speed-btn--active={$ttsSpeed === opt.value}
              on:click={handleSpeedChange}
              value={opt.value}
              aria-pressed={$ttsSpeed === opt.value}
            >{opt.label}</button>
          {/each}
        </div>
      </div>

      <!-- Ambient -->
      <div class="tts-panel__row">
        <span class="tts-panel__label">{$_('app.tts.ambient')}</span>
        <select class="tts-select" value={$ttsAmbient} on:change={handleAmbientChange}>
          {#each AMBIENT_OPTIONS as opt (opt.value)}
            <option value={opt.value}>{$_(opt.labelKey)}</option>
          {/each}
        </select>
      </div>

      <!-- Volumen de la música. No hay control de voz: la lectura es visual. -->
      {#if $ttsAmbient !== 'none'}
        <div class="tts-panel__row">
          <span class="tts-panel__label">{$_('app.tts.volume_music')}</span>
          <input
            type="range"
            class="tts-range"
            min="0"
            max="1"
            step="0.05"
            value={$musicVolume}
            on:input={handleMusicVolumeChange}
            style="--range-fill: {Math.round($musicVolume * 100)}%"
          />
        </div>
      {/if}
    </div>
  {/if}
</div>

{:else if available && playlist.length && !isActive}
<!-- ── BOTÓN DE INICIO — centrado abajo ──
     Se muestra siempre que haya algo que leer en pantalla: un capítulo, o los
     resultados de una búsqueda. -->
<button
  type="button"
  class="tts-start-btn tts-start-btn--music tts-start-btn--centered"
  on:click={startPlayback}
  aria-label={$_('app.tts.start')}
  title={$_('app.tts.start_hint')}
>
  <Icon name="music" />
  <span>{$_('app.tts.start')}</span>
</button>
{/if}

<style lang="scss">
  // ── MINI PLAYER BAR ──────────────────────────────────────────────────────────
  // ── Tarjeta flotante ──────────────────────────────────────────────────────
  //
  // Antes era una barra pegada al borde inferior, a todo el ancho y con fondo
  // sólido: parecía una pieza aparte encima de la aplicación. Ahora flota
  // separada de los bordes, con esquinas redondeadas y algo de transparencia,
  // que es lo que la integra con el contenido de detrás.
  //
  // Se apoya en el tema, no en colores propios: `--color-surface` cambia con el
  // modo claro/oscuro y la tarjeta lo sigue sin reglas duplicadas. Por eso se
  // retiró el `@media (prefers-color-scheme: dark)` que había aquí: competía
  // con `html[data-theme]`, que es como el resto de la app decide el tema, y
  // dejaba el player en oscuro aunque el usuario hubiera elegido claro.
  .tts-bar {
    position: fixed;
    bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
    left: 0.75rem;
    right: 0.75rem;
    z-index: 60;
    margin-inline: auto;
    max-width: 42rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-xl);
    // Base opaca: es lo que se ve si el navegador no soporta backdrop-filter.
    // Sin ella, el texto quedaría sobre el contenido de la página, ilegible.
    background: var(--color-surface);
    box-shadow:
      0 0.5rem 1.5rem var(--shadow-tint),
      0 0.125rem 0.375rem var(--shadow-tint);
    overflow: hidden;
    transition: box-shadow var(--motion-base) ease, transform var(--motion-base) ease;
  }

  // La transparencia sólo donde hay desenfoque real. Sin el desenfoque, un
  // fondo translúcido deja leer el texto de la página a través del player.
  @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
    .tts-bar {
      // Mismos tokens que el resto de superficies de cristal: así el player no
      // se queda con su propio desenfoque cuando se ajuste el del sistema.
      background: var(--glass-tint);
      backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      // Filo superior de un píxel: sin él, sobre contenido claro el borde
      // superior del player se deshace contra la página.
      border-color: var(--glass-line);
      box-shadow:
        inset 0 1px 0 var(--glass-line),
        0 0.5rem 1.5rem var(--shadow-tint),
        0 0.125rem 0.375rem var(--shadow-tint);
    }
  }

  // ── Swipe handle tab ────────────────────────────────────────────────────────
  .tts-bar__handle {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 1.25rem;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.2rem 0 0;
  }

  .tts-bar__handle-bar {
    display: block;
    width: 2.5rem;
    height: 0.25rem;
    border-radius: 1rem;
    background: var(--color-ink-soft);
    opacity: 0.6;
    transition: opacity var(--motion-fast);

    .tts-bar__handle:hover & { opacity: 1; }
  }

  // ── Compact row ─────────────────────────────────────────────────────────────
  .tts-bar__row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem 0.6rem;
    height: 3.25rem;
  }

  .tts-bar__controls {
    display: flex;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .tts-bar__btn {
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    transition: transform var(--motion-fast);

    // El tamaño va al contenedor: una regla `svg` de aquí no alcanza al
    // <svg> de Icon.svelte, que lleva otra clase de scope.
    --icon-size: 0.9rem;

    &:active { transform: scale(0.9); }

    &--play {
      background: var(--color-accent-solid);
      color: var(--color-on-primary);
    }
    &--pause {
      background: var(--color-accent-solid);
      color: var(--color-on-primary);
    }
    &--stop {
      background: var(--wash-soft);
      color: var(--color-ink);

      &:hover { background: var(--wash-hover); }
    }
  }

  // ── Verse info (clickable to expand) ───────────────────────────────────────
  .tts-bar__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0.1rem 0.25rem;
    border-radius: 0.3rem;
    min-width: 0;

    &:hover { background: var(--wash-soft); }
  }

  .tts-bar__ref {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-accent-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .tts-bar__progress {
    height: 0.2rem;
    background: var(--wash-hover);
    border-radius: 1rem;
    overflow: hidden;
  }

  .tts-bar__progress-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: 1rem;
    transition: width var(--motion-slow) linear;
  }

  // ── Expand chevron ─────────────────────────────────────────────────────────
  .tts-bar__expand {
    display: grid;
    place-items: center;
    width: 1.8rem;
    height: 1.8rem;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 0.3rem;
    color: var(--color-ink-soft);
    flex-shrink: 0;

    .tts-bar__chevron {
      display: grid;
      place-items: center;
      // El icono es ahora un componente, así que el giro va en el envoltorio.
      transition: transform var(--motion-base) var(--ease-out);

      :global(svg) {
        width: 1rem;
        height: 1rem;
      }
    }

    .tts-bar__chevron--up {
      transform: rotate(180deg);
    }

    &:hover { background: var(--wash-soft); }
  }

  // ── Expanded panel ─────────────────────────────────────────────────────────
  .tts-panel {
    border-top: 1px solid var(--color-line);
    padding: 0.75rem 0.875rem 1rem;
    animation: panel-slide-up var(--motion-base) var(--ease-out);
  }

  @keyframes panel-slide-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .tts-panel__row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.6rem;

    &:last-child { margin-bottom: 0; }
  }

  .tts-panel__label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-ink-soft);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
    width: 4rem;
  }

  .tts-speed-btns {
    display: flex;
    gap: 0.25rem;
    flex: 1;
  }

  .tts-speed-btn {
    flex: 1;
    padding: 0.3rem 0.2rem;
    border: 1px solid var(--color-line);
    border-radius: 0.3rem;
    background: var(--wash-soft);
    color: var(--color-ink);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: background var(--motion-fast), border-color var(--motion-fast);

    &:hover { background: var(--wash-hover); }

    &--active {
      background: var(--color-accent-solid);
      border-color: var(--color-accent-solid);
      color: var(--color-on-primary);
    }
  }

  .tts-select {
    flex: 1;
    min-width: 0;
    padding: 0.35rem 1.9rem 0.35rem 0.55rem;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-sm);
    background-color: var(--color-field);
    color: var(--color-ink);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;

    // La flecha, dibujada aparte: con `appearance: none` desaparece la nativa.
    appearance: none;
    background-image: linear-gradient(45deg, transparent 50%, currentcolor 50%),
      linear-gradient(135deg, currentcolor 50%, transparent 50%);
    background-position: right 0.85rem center, right 0.6rem center;
    background-size: 0.3rem 0.3rem;
    background-repeat: no-repeat;

    &:hover { border-color: var(--color-accent); }

    &:focus-visible {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px var(--wash-accent);
    }

    // La lista desplegada la pinta el sistema operativo, no el navegador: sin
    // esto hereda su tema y puede salir texto claro sobre fondo claro.
    option {
      background: var(--color-surface);
      color: var(--color-ink);
    }
  }

  // La pista y el pulgar los pinta `global.css` para las cinco paletas; aquí
  // sólo se le dice cuánto lleva relleno. Ver la nota de allí sobre por qué no
  // se usa `accent-color`.
  .tts-range {
    flex: 1;
    min-width: 0;
  }

  // ── START BUTTONS (idle state) ─────────────────────────────────────────────
  .tts-start-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem 0.5rem 0.65rem;
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    border: none;
    border-radius: 2rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    box-shadow: 0 4px 16px color-mix(in srgb, var(--color-accent) 35%, transparent);
    transition: transform var(--motion-base), box-shadow var(--motion-base);

    // El tamaño va al contenedor: una regla `svg` de aquí no alcanza al
    // <svg> de Icon.svelte, que lleva otra clase de scope.
    --icon-size: 1rem;

    &:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 20px color-mix(in srgb, var(--color-accent) 45%, transparent);
    }
    &:active { transform: scale(0.96); }
  }

  .tts-start-btn--music {
    background: var(--color-success-solid);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--color-success) 35%, transparent);

    &:hover {
      box-shadow: 0 6px 20px color-mix(in srgb, var(--color-success) 45%, transparent);
    }
  }

  // Boton centrado abajo (mitad de pantalla horizontalmente, parte inferior)
  .tts-start-btn--centered {
    position: fixed;
    left: 50%;
    // A la misma altura que los otros dos flotantes: los tres forman la fila
    // más baja de la pantalla, por debajo de los botones del pie.
    bottom: calc(1rem + var(--player-offset, 0px));
    transform: translateX(-50%);
    z-index: 60;
    padding: 0.75rem 1.5rem 0.75rem 1.2rem;
    font-size: 0.9rem;
    box-shadow: 0 6px 24px color-mix(in srgb, var(--color-success) 40%, transparent);
    border-radius: 2rem;

    // El tamaño va al contenedor: una regla `svg` de aquí no alcanza al
    // <svg> de Icon.svelte, que lleva otra clase de scope.
    --icon-size: 1.2rem;

    &:hover {
      transform: translateX(-50%) scale(1.05);
      box-shadow: 0 8px 32px color-mix(in srgb, var(--color-success) 50%, transparent);
    }
    &:active { transform: translateX(-50%) scale(0.96); }

    @media (max-width: 40rem) {
      bottom: 1.25rem;
      padding: 0.6rem 1rem 0.6rem 0.8rem;
      font-size: 0.8rem;

      // El tamaño va al contenedor: una regla `svg` de aquí no alcanza al
      // <svg> de Icon.svelte, que lleva otra clase de scope.
      --icon-size: 1rem;
    }
  }
</style>
