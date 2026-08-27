<script>
  import { _ } from '../services/i18n.service';
  import {
    autoReadIsPlaying,
    autoReadSpeed,
    autoReadProgress,
    autoReadTimeLeft,
    AUTO_READ_SPEEDS,
    autoReadPlay,
    autoReadPause,
    autoReadSetSpeed,
    autoReadReset,
    formatAutoReadTime,
  } from '../store/autoReadStore';

  export let visible = false; // controles visibles o minimizados

  let showSpeedMenu = false;
  let menuEl;

  const togglePlay = () => {
    if ($autoReadIsPlaying) {
      autoReadPause();
    } else {
      autoReadPlay();
    }
  };

  const handleSpeedClick = (e, value) => {
    e.stopPropagation();
    autoReadSetSpeed(value);
    showSpeedMenu = false;
    // Si no estaba reproduciendo, empezar automáticamente
    if (!$autoReadIsPlaying) {
      autoReadPlay();
    } else {
      // ya estaba corriendo → restart con nueva velocidad
      autoReadReset();
    }
  };

  const handleClickOutside = (e) => {
    if (showSpeedMenu && menuEl && !menuEl.contains(e.target)) {
      showSpeedMenu = false;
    }
  };

  $: currentSpeedLabel =
    AUTO_READ_SPEEDS.find((s) => s.value === $autoReadSpeed)?.label ?? '1 min';
</script>

<svelte:window on:click={handleClickOutside} />

{#if visible}
  <div class="auto-read" role="region" aria-label={$_('app.autoRead.label')}>
    <!-- Toggle minimize -->
    <button
      class="auto-read__minimize"
      on:click={() => (visible = false)}
      title={$_('app.autoRead.minimize')}
      aria-label={$_('app.autoRead.minimize')}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <!-- Play / Pause -->
    <button
      class="auto-read__play"
      class:playing={$autoReadIsPlaying}
      on:click={togglePlay}
      aria-label={$autoReadIsPlaying ? $_('app.autoRead.pause') : $_('app.autoRead.play')}
      title={$autoReadIsPlaying ? $_('app.autoRead.pause') : $_('app.autoRead.play')}
    >
      {#if $autoReadIsPlaying}
        <!-- Pause icon -->
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
      {:else}
        <!-- Play icon -->
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      {/if}
    </button>

    <!-- Progress bar -->
    <div class="auto-read__progress-wrap">
      <div class="auto-read__progress-track">
        <div
          class="auto-read__progress-fill"
          style="width: {$autoReadProgress}%"
        ></div>
      </div>
    </div>

    <!-- Time remaining -->
    <span class="auto-read__time" aria-live="polite">
      {formatAutoReadTime($autoReadTimeLeft)}
    </span>

    <!-- Speed selector -->
    <div class="auto-read__speed-wrap" bind:this={menuEl}>
      <button
        class="auto-read__speed-btn"
        on:click|stopPropagation={() => (showSpeedMenu = !showSpeedMenu)}
        aria-label={$_('app.autoRead.speed')}
        aria-haspopup="listbox"
        aria-expanded={showSpeedMenu}
      >
        {currentSpeedLabel}
      </button>

      {#if showSpeedMenu}
        <ul class="auto-read__speed-menu" role="listbox">
          {#each AUTO_READ_SPEEDS as speed}
            <li
              role="option"
              aria-selected={speed.value === $autoReadSpeed}
              class:active={speed.value === $autoReadSpeed}
            >
              <button on:click={(e) => handleSpeedClick(e, speed.value)}>
                {speed.label}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{/if}

<!-- Botón flotante para reabrir cuando está minimizado -->
{#if !visible}
  <button
    class="auto-read__fab"
    on:click={() => (visible = true)}
    aria-label={$_('app.autoRead.open')}
    title={$_('app.autoRead.open')}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  </button>
{/if}

<style lang="scss">
  .auto-read {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 1rem;
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
    background: var(--color-header-bg, rgba(15, 23, 32, 0.96));
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.25);

    // Desktop: un poco más alto y espaciado
    @media (min-width: 640px) {
      gap: 1rem;
      padding: 0.75rem 1.5rem;
      padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
      border-top-left-radius: 1rem;
      border-top-right-radius: 1rem;
      left: auto;
      right: auto;
      max-width: 640px;
      margin: 0 auto;
    }
  }

  .auto-read__minimize {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: color 0.15s;

    &:hover {
      color: rgba(255, 255, 255, 0.9);
    }
  }

  .auto-read__play {
    background: var(--color-teal, #2E7D9B);
    border: none;
    border-radius: 50%;
    width: 2.5rem;
    height: 2.5rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #fff;
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    box-shadow: 0 2px 8px rgba(46, 125, 155, 0.4);

    &:hover {
      background: var(--color-teal-light, #3a9dc0);
      transform: scale(1.05);
    }

    &:active {
      transform: scale(0.95);
    }

    &.playing {
      background: var(--color-gold, #D4A853);
      box-shadow: 0 2px 12px rgba(212, 168, 83, 0.4);

      &:hover {
        background: #c9962f;
      }
    }
  }

  .auto-read__progress-wrap {
    flex: 1;
    min-width: 0;
  }

  .auto-read__progress-track {
    height: 3px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    overflow: hidden;
  }

  .auto-read__progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-teal, #2E7D9B), var(--color-gold, #D4A853));
    border-radius: 2px;
    transition: width 1s linear;
  }

  .auto-read__time {
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    min-width: 2.5rem;
    text-align: center;

    @media (min-width: 640px) {
      font-size: 0.875rem;
    }
  }

  .auto-read__speed-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .auto-read__speed-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 9999px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.625rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;

    &:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
    }
  }

  .auto-read__speed-menu {
    position: absolute;
    bottom: calc(100% + 0.5rem);
    right: 0;
    background: var(--color-header-bg, rgba(15, 23, 32, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.75rem;
    list-style: none;
    margin: 0;
    padding: 0.375rem;
    min-width: 6rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 300;

    li {
      button {
        display: block;
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        border-radius: 0.5rem;
        color: rgba(255, 255, 255, 0.75);
        font-size: 0.8125rem;
        padding: 0.4rem 0.625rem;
        cursor: pointer;
        transition: background 0.12s, color 0.12s;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
      }

      &.active button {
        color: var(--color-gold, #D4A853);
        font-weight: 700;
      }
    }
  }

  // FAB para reabrir
  .auto-read__fab {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 199;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: var(--color-teal, #2E7D9B);
    border: none;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(46, 125, 155, 0.5);
    transition: transform 0.15s, background 0.15s;

    &:hover {
      transform: scale(1.08);
      background: var(--color-teal-light, #3a9dc0);
    }

    &:active {
      transform: scale(0.95);
    }

    // Solo visible cuando no estamos en inmersivo (el FAB se oculta en inmersivo)
    :global(body.immersive-mode) & {
      display: none;
    }
  }
</style>
