<script>
  import { onDestroy } from 'svelte';
  import { ttsService } from '../services/tts.service.js';
  import { musicService } from '../services/music.service.js';
  import {
    ttsState,
    ttsPanelOpen,
    ttsSpeed,
    ttsAmbient,
    ttsVolume,
    musicVolume,
    updateTtsWord,
    stopTts,
    pauseTts,
    resumeTts,
    endTts,
  } from '../store/ttsStore.js';
  import { getBibleVersionConfigOrDefault } from '../store/stores.js';

  export let bible = null;
  export let map = null;
  export let book = null;
  export let chapter = null;
  export let lang = 'ro';

  // Panel/expand state
  $: isOpen = $ttsPanelOpen;
  $: state = $ttsState;
  $: isPlaying = state.playing;
  $: isPaused = state.paused;
  $: available = ttsService.isAvailable() && musicService.isAvailable();
  $: isActive = isPlaying || isPaused;

  const SPEED_OPTIONS = [
    { value: 0.75, label: '0.75×' },
    { value: 1.0, label: '1×' },
    { value: 1.25, label: '1.25×' },
    { value: 1.5, label: '1.5×' },
  ];

  const AMBIENT_OPTIONS = [
    { value: 'none', label: 'fara_muzica' },
    { value: 'procedural', label: 'drone_ambiental' },
  ];

  const LABELS = {
    ro: {
      play_chapter: 'Citește',
      none: 'fără muzică',
      procedural: 'drone ambiantal',
      volume_tts: 'Voce',
      volume_music: 'Muzică',
      speed: 'Viteză',
      ambient: 'Fondal',
    },
    es: {
      play_chapter: 'Lee',
      none: 'sin música',
      procedural: 'drone ambiental',
      volume_tts: 'Voz',
      volume_music: 'Música',
      speed: 'Velocidad',
      ambient: 'Ambiente',
    },
  };
  $: labels = LABELS[lang] || LABELS.ro;

  onDestroy(() => {
    try { ttsService.stop(); musicService.stop(); } catch (_) {}
  });

  function togglePanel() {
    ttsPanelOpen.update((v) => !v);
  }

  function playChapter() {
    if (!bible || !map || book === null || chapter === null) return;
    const verses = bible[book]?.[chapter - 1] || [];
    ttsService.stop();
    musicService.stop();
    if ($ttsAmbient !== 'none') {
      musicService.play($ttsAmbient);
      musicService.setVolume($musicVolume);
    }
    ttsService.setRate($ttsSpeed);
    ttsService.setVolume($ttsVolume);
    playVersesSequentially(book, chapter, verses, 0);
  }

  function playVersesSequentially(bookIndex, chapterIndex, verses, verseIndex) {
    if (verseIndex >= verses.length) {
      endTts();
      musicService.stop();
      return;
    }
    const text = verses[verseIndex];
    const verseNum = verseIndex + 1;
    const verseKey = `${bookIndex}-${chapterIndex}-${verseNum}`;
    const cfg = getBibleVersionConfigOrDefault();
    const verseLang = cfg?.locale || lang;

    ttsService.speak(text, verseLang, {
      onStart: () => {
        ttsState.update((s) => ({
          ...s, playing: true, paused: false, wordIndex: -1,
          wordCount: text.trim().split(/\s+/).length,
          currentBook: bookIndex, currentChapter: chapterIndex,
          currentVerse: verseNum, verseText: text, verseKey,
        }));
      },
      onWord: (index, count) => { updateTtsWord(index, count); },
      onEnd: () => { playVersesSequentially(bookIndex, chapterIndex, verses, verseIndex + 1); },
    });
  }

  function stopPlayback() { ttsService.stop(); musicService.stop(); stopTts(); }
  function pausePlayback() { ttsService.pause(); pauseTts(); }
  function resumePlayback() { ttsService.resume(); resumeTts(); }

  function handleSpeedChange(e) {
    ttsSpeed.set(Number(e.target.value));
    ttsService.setRate(Number(e.target.value));
  }
  function handleAmbientChange(e) {
    ttsAmbient.set(e.target.value);
    if (e.target.value === 'none') musicService.stop();
    else { musicService.stop(); musicService.play(e.target.value); musicService.setVolume($musicVolume); }
  }
  function handleTtsVolumeChange(e) { ttsVolume.set(Number(e.target.value)); ttsService.setVolume(Number(e.target.value)); }
  function handleMusicVolumeChange(e) { musicVolume.set(Number(e.target.value)); musicService.setVolume(Number(e.target.value)); }

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
  aria-label="TTS player"
>
  <!-- Swipe handle (visible tab at top) -->
  <button
    type="button"
    class="tts-bar__handle"
    aria-label="Expand TTS player"
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
        <button type="button" class="tts-bar__btn tts-bar__btn--pause" on:click={pausePlayback} title="Pauză" aria-label="Pauză">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        </button>
      {:else}
        <button type="button" class="tts-bar__btn tts-bar__btn--play" on:click={resumePlayback} title="Continuă" aria-label="Continuă">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      {/if}
      <button type="button" class="tts-bar__btn tts-bar__btn--stop" on:click={stopPlayback} title="Oprește" aria-label="Oprește">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
      </button>
    </div>

    <!-- Center: verse reference + progress -->
    <button type="button" class="tts-bar__info" on:click={togglePanel} aria-label="Deschide player">
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
    <button type="button" class="tts-bar__expand" on:click={togglePanel} aria-label={isOpen ? 'Minimizează' : 'Deschide'} aria-expanded={isOpen}>
      <svg class:tts-bar__chevron--up={!isOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <polyline points="18 15 12 9 6 15"/>
      </svg>
    </button>
  </div>

  <!-- ── EXPANDED CONTROLS PANEL ── slides up from the bar ── -->
  {#if isOpen}
    <div class="tts-panel" role="region" aria-label="TTS controls">
      <!-- Speed -->
      <div class="tts-panel__row">
        <span class="tts-panel__label">{labels.speed}</span>
        <div class="tts-speed-btns" role="group">
          {#each SPEED_OPTIONS as opt}
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
        <span class="tts-panel__label">{labels.ambient}</span>
        <select class="tts-select" value={$ttsAmbient} on:change={handleAmbientChange}>
          {#each AMBIENT_OPTIONS as opt}
            <option value={opt.value}>{labels[opt.label] || opt.value}</option>
          {/each}
        </select>
      </div>

      <!-- TTS Volume -->
      <div class="tts-panel__row">
        <span class="tts-panel__label">{labels.volume_tts}</span>
        <input type="range" class="tts-range" min="0" max="1" step="0.05" value={$ttsVolume} on:input={handleTtsVolumeChange} />
      </div>

      <!-- Music Volume -->
      {#if $ttsAmbient !== 'none'}
        <div class="tts-panel__row">
          <span class="tts-panel__label">{labels.volume_music}</span>
          <input type="range" class="tts-range" min="0" max="1" step="0.05" value={$musicVolume} on:input={handleMusicVolumeChange} />
        </div>
      {/if}
    </div>
  {/if}
</div>

{:else if available && bible && map && !isActive}
<!-- ── START BUTTON — shown when idle on a chapter view ── -->
<button
  type="button"
  class="tts-start-btn"
  on:click={playChapter}
  aria-label={labels.play_chapter}
  title={labels.play_chapter}
>
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
  <span>{labels.play_chapter}</span>
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
    background: var(--bg-primary, #fff);
    border-top: 1px solid var(--border-color, #e2e8f0);
    box-shadow: 0 -4px 24px rgb(0 0 0 / 10%);
    transition: box-shadow 0.2s;

    @media (prefers-color-scheme: dark) {
      background: var(--bg-primary-dark, #1e293b);
      border-color: var(--border-color-dark, #334155);
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
    background: var(--color-text-secondary, #94a3b8);
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
      background: var(--color-blue, #2d96cd);
      color: #fff;
    }
    &--pause {
      background: var(--color-blue, #2d96cd);
      color: #fff;
    }
    &--stop {
      background: var(--bg-secondary, #f1f5f9);
      color: var(--color-text, #475569);
      @media (prefers-color-scheme: dark) { background: #334155; color: #94a3b8; }
      &:hover { background: #e2e8f0; @media (prefers-color-scheme: dark) { background: #475258; } }
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

    &:hover { background: var(--bg-secondary, #f1f5f9); @media (prefers-color-scheme: dark) { background: #334155; } }
  }

  .tts-bar__ref {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-link, #2d96cd);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .tts-bar__progress {
    height: 0.2rem;
    background: var(--bg-secondary, #e2e8f0);
    border-radius: 1rem;
    overflow: hidden;
    @media (prefers-color-scheme: dark) { background: #334155; }
  }

  .tts-bar__progress-fill {
    height: 100%;
    background: var(--color-blue, #2d96cd);
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
    color: var(--color-text-secondary, #94a3b8);
    flex-shrink: 0;

    svg {
      width: 1rem;
      height: 1rem;
      transition: transform 0.2s;
    }

    .tts-bar__chevron--up {
      transform: rotate(180deg);
    }

    &:hover { background: var(--bg-secondary, #f1f5f9); @media (prefers-color-scheme: dark) { background: #334155; } }
  }

  // ── Expanded panel ─────────────────────────────────────────────────────────
  .tts-panel {
    border-top: 1px solid var(--border-color, #e2e8f0);
    padding: 0.75rem 0.875rem 1rem;
    animation: panel-slide-up 0.2s ease-out;

    @media (prefers-color-scheme: dark) { border-color: var(--border-color-dark, #334155); }
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
    color: var(--color-text-secondary, #64748b);
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
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 0.3rem;
    background: var(--bg-secondary, #f8fafc);
    color: var(--color-text-secondary, #64748b);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;

    @media (prefers-color-scheme: dark) { background: #1e293b; border-color: #334155; color: #94a3b8; }

    &:hover { background: #e2e8f0; @media (prefers-color-scheme: dark) { background: #334155; } }

    &--active {
      background: var(--color-blue, #2d96cd);
      border-color: var(--color-blue, #2d96cd);
      color: #fff;
    }
  }

  .tts-select {
    flex: 1;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 0.3rem;
    background: var(--bg-secondary, #f8fafc);
    color: var(--color-text, #334155);
    font-size: 0.78rem;
    cursor: pointer;

    @media (prefers-color-scheme: dark) { background: #1e293b; border-color: #334155; color: #e2e8f0; }
    &:focus { outline: 2px solid var(--color-blue, #2d96cd); }
  }

  .tts-range {
    flex: 1;
    accent-color: var(--color-blue, #2d96cd);
    cursor: pointer;
    height: 0.3rem;
  }

  // ── START BUTTON (idle state) ─────────────────────────────────────────────
  .tts-start-btn {
    position: fixed;
    bottom: 1.25rem;
    right: 1.25rem;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem 0.5rem 0.65rem;
    background: var(--color-blue, #2d96cd);
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

    @media (max-width: 40rem) {
      bottom: 1rem;
      right: 1rem;
      font-size: 0;
      padding: 0.6rem;
      border-radius: 50%;

      span { display: none; }
      svg { width: 1.1rem; height: 1.1rem; }
    }
  }
</style>
