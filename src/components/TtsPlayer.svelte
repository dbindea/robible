<script>
  import { onDestroy } from 'svelte';
  import { musicService } from '../services/music.service.js';
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

  const AMBIENT_OPTIONS = [
    { value: 'prayer', labelKey: 'app.tts.ambient_prayer' },
    { value: 'none', labelKey: 'app.tts.ambient_none' },
  ];

  onDestroy(() => {
    clearTimers();
    musicService.stop();
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
      await musicService.play('prayer');
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
      await musicService.play('prayer');
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
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        </button>
      {:else}
        <button type="button" class="tts-bar__btn tts-bar__btn--play" on:click={resumePlayback} title={$_('app.tts.resume')} aria-label={$_('app.tts.resume')}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      {/if}
      <button type="button" class="tts-bar__btn tts-bar__btn--stop" on:click={stopPlayback} title={$_('app.tts.stop')} aria-label={$_('app.tts.stop')}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
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
      <svg class:tts-bar__chevron--up={!isOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <polyline points="18 15 12 9 6 15"/>
      </svg>
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
          <input type="range" class="tts-range" min="0" max="1" step="0.05" value={$musicVolume} on:input={handleMusicVolumeChange} />
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
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
  <span>{$_('app.tts.start')}</span>
</button>
{/if}

<style lang="scss">
  // ── MINI PLAYER BAR ──────────────────────────────────────────────────────────
  .tts-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 60;
    background: var(--color-surface);
    border-top: 1px solid var(--color-line);
    box-shadow: 0 -4px 24px rgb(0 0 0 / 10%);
    transition: box-shadow 0.2s;

    @media (prefers-color-scheme: dark) {
      background: var(--bg-primary-dark, var(--color-ink));
      border-color: var(--border-color-dark, var(--color-ink));
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
    background: var(--color-text-secondary, var(--color-ink-soft));
    opacity: 0.6;
    transition: opacity 0.15s;

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
    transition: transform 0.15s;

    svg { width: 0.9rem; height: 0.9rem; }

    &:active { transform: scale(0.9); }

    &--play {
      background: var(--color-accent);
      color: #fff;
    }
    &--pause {
      background: var(--color-accent);
      color: #fff;
    }
    &--stop {
      background: var(--color-page);
      color: var(--color-text, var(--color-ink-soft));
      @media (prefers-color-scheme: dark) { background: var(--color-ink); color: var(--color-ink-soft); }
      &:hover { background: var(--color-line); @media (prefers-color-scheme: dark) { background: var(--color-ink-soft); } }
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

    &:hover { background: var(--color-page); @media (prefers-color-scheme: dark) { background: var(--color-ink); } }
  }

  .tts-bar__ref {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-link, var(--color-accent));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .tts-bar__progress {
    height: 0.2rem;
    background: var(--color-page);
    border-radius: 1rem;
    overflow: hidden;
    @media (prefers-color-scheme: dark) { background: var(--color-ink); }
  }

  .tts-bar__progress-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: 1rem;
    transition: width 0.3s linear;
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
    color: var(--color-text-secondary, var(--color-ink-soft));
    flex-shrink: 0;

    svg {
      width: 1rem;
      height: 1rem;
      transition: transform 0.2s;
    }

    .tts-bar__chevron--up {
      transform: rotate(180deg);
    }

    &:hover { background: var(--color-page); @media (prefers-color-scheme: dark) { background: var(--color-ink); } }
  }

  // ── Expanded panel ─────────────────────────────────────────────────────────
  .tts-panel {
    border-top: 1px solid var(--color-line);
    padding: 0.75rem 0.875rem 1rem;
    animation: panel-slide-up 0.2s ease-out;

    @media (prefers-color-scheme: dark) { border-color: var(--border-color-dark, var(--color-ink)); }
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
    color: var(--color-text-secondary, var(--color-ink-soft));
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
    background: var(--color-page);
    color: var(--color-text-secondary, var(--color-ink-soft));
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;

    @media (prefers-color-scheme: dark) { background: var(--color-ink); border-color: var(--color-ink); color: var(--color-ink-soft); }

    &:hover { background: var(--color-line); @media (prefers-color-scheme: dark) { background: var(--color-ink); } }

    &--active {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: #fff;
    }
  }

  .tts-select {
    flex: 1;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--color-line);
    border-radius: 0.3rem;
    background: var(--color-page);
    color: var(--color-text, var(--color-ink));
    font-size: 0.78rem;
    cursor: pointer;

    @media (prefers-color-scheme: dark) { background: var(--color-ink); border-color: var(--color-ink); color: var(--color-line); }
    &:focus { outline: 2px solid var(--color-accent); }
  }

  .tts-range {
    flex: 1;
    accent-color: var(--color-accent);
    cursor: pointer;
    height: 0.3rem;
  }

  // ── START BUTTONS (idle state) ─────────────────────────────────────────────
  .tts-start-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem 0.5rem 0.65rem;
    background: var(--color-accent);
    color: #fff;
    border: none;
    border-radius: 2rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    box-shadow: 0 4px 16px rgb(45 150 205 / 35%);
    transition: transform 0.2s, box-shadow 0.2s;

    svg { width: 1rem; height: 1rem; }

    &:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgb(45 150 205 / 45%);
    }
    &:active { transform: scale(0.96); }
  }

  .tts-start-btn--music {
    background: #28a745;
    box-shadow: 0 4px 16px rgb(40 167 69 / 35%);

    &:hover {
      box-shadow: 0 6px 20px rgb(40 167 69 / 45%);
    }
  }

  // Boton centrado abajo (mitad de pantalla horizontalmente, parte inferior)
  .tts-start-btn--centered {
    position: fixed;
    left: 50%;
    bottom: 2rem;
    transform: translateX(-50%);
    z-index: 60;
    padding: 0.75rem 1.5rem 0.75rem 1.2rem;
    font-size: 0.9rem;
    box-shadow: 0 6px 24px rgb(40 167 69 / 40%);
    border-radius: 2rem;

    svg { width: 1.2rem; height: 1.2rem; }

    &:hover {
      transform: translateX(-50%) scale(1.05);
      box-shadow: 0 8px 32px rgb(40 167 69 / 50%);
    }
    &:active { transform: translateX(-50%) scale(0.96); }

    @media (max-width: 40rem) {
      bottom: 1.25rem;
      padding: 0.6rem 1rem 0.6rem 0.8rem;
      font-size: 0.8rem;

      svg { width: 1rem; height: 1rem; }
    }
  }
</style>
