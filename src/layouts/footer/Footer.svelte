<script>
  import { onDestroy, onMount } from 'svelte';
  import packageInfo from '../../../package.json';
  import { _ } from '../../services/i18n.service';
  import { themeMode, toggleThemeMode } from '../../store/stores';

  let isAboutOpen = false;
  const appVersion = packageInfo.version;

  $: isDarkMode = $themeMode === 'dark';

  const closeAbout = () => {
    isAboutOpen = false;
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      closeAbout();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="footer">
  <div class="footer__content">
    <p class="footer__meta">
      <span>{$_('app.footer.made_with_love')}</span>
      <span class="only-desktop">·</span>
      <strong>{$_('app.footer.maranata')}</strong>
    </p>
  </div>

  <div class="footer__actions">
    <button type="button" class="footer__about" on:click={() => (isAboutOpen = true)}>
      {$_('app.footer.about_action')}
      <span>v{appVersion}</span>
    </button>
    <button
      type="button"
      class="theme-toggle"
      aria-label={isDarkMode ? $_('app.footer.theme_light') : $_('app.footer.theme_dark')}
      title={isDarkMode ? $_('app.footer.theme_light') : $_('app.footer.theme_dark')}
      on:click={toggleThemeMode}
    >
      <span class:theme-toggle__icon--sun={isDarkMode} class="theme-toggle__icon" aria-hidden="true"></span>
    </button>
  </div>
</div>

{#if isAboutOpen}
  <div class="footer-modal" role="presentation" on:click={closeAbout}>
    <div
      class="footer-modal__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="footer-about-title"
      tabindex="-1"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <button type="button" class="footer-modal__close" aria-label={$_('app.footer.close_about')} on:click={closeAbout}>
        <span aria-hidden="true"></span>
      </button>
      <p class="footer-modal__eyebrow">RoBible v{appVersion}</p>
      <h2 id="footer-about-title">{$_('app.footer.about_title')}</h2>
      <p>{$_('app.footer.about_text')}</p>
      <a class="footer-modal__repo" href="https://github.com/dbindea/robible" target="_blank" rel="noreferrer">
        dbindea/robible
      </a>
      <p class="footer-modal__blessing">{$_('app.footer.maranata')}</p>
    </div>
  </div>
{/if}

<style lang="scss">
  .footer {
    min-height: 5.25rem;
    box-shadow: var(--box-shadow-up);
    align-items: center;
    gap: 1.25rem;
    padding: 1rem clamp(1rem, 5vw, 5rem);
    display: flex;
    color: var(--color-bg-dark);
    justify-content: space-between;
    background-color: var(--color-white);
    border-top: 1px solid color-mix(in srgb, var(--color-bg-dark) 10%, transparent);
  }

  .footer__content {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }

  .footer__meta {
    margin: 0;
  }

  .footer__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    color: color-mix(in srgb, var(--color-bg-dark) 68%, var(--color-white));
    font-size: 0.82rem;
  }

  .footer__actions {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex: 0 0 auto;
  }

  .footer__about {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 2.35rem;
    border: 1px solid rgb(45 150 205 / 28%);
    border-radius: 0.25rem;
    background: color-mix(in srgb, var(--color-blue) 9%, var(--color-white));
    color: var(--color-bg-dark);
    padding: 0 0.75rem;
    transition: var(--transition);
    font-size: 0.78rem;
    font-weight: 600;

    span {
      color: color-mix(in srgb, var(--color-bg-dark) 62%, var(--color-white));
      font-size: 0.78rem;
      font-weight: 600;
    }

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 15%, var(--color-white));
      box-shadow: 0 0 0 3px rgb(45 150 205 / 12%);
    }
  }

  .theme-toggle {
    display: grid;
    place-items: center;
    width: 2.35rem;
    height: 2.35rem;
    flex: 0 0 auto;
    border: 1px solid rgb(63 88 103 / 22%);
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-bg-dark);
    transition: var(--transition);

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: rgb(45 150 205 / 10%);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 12%);
    }
  }

  .theme-toggle__icon {
    position: relative;
    width: 1.05rem;
    height: 1.05rem;
    border-radius: 999px;
    box-shadow: inset -0.32rem 0 0 currentcolor;
    color: currentcolor;

    &--sun {
      border: 2px solid currentcolor;
      box-shadow:
        0 -0.48rem 0 -0.24rem currentcolor,
        0 0.48rem 0 -0.24rem currentcolor,
        0.48rem 0 0 -0.24rem currentcolor,
        -0.48rem 0 0 -0.24rem currentcolor,
        0.34rem 0.34rem 0 -0.24rem currentcolor,
        -0.34rem -0.34rem 0 -0.24rem currentcolor,
        0.34rem -0.34rem 0 -0.24rem currentcolor,
        -0.34rem 0.34rem 0 -0.24rem currentcolor;
    }
  }

  .footer-modal {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgb(0 0 0 / 42%);
  }

  .footer-modal__panel {
    position: relative;
    display: grid;
    gap: 0.75rem;
    width: min(30rem, 100%);
    padding: 1.25rem;
    border: 1px solid color-mix(in srgb, var(--color-bg-dark) 14%, transparent);
    border-radius: 0.45rem;
    background: var(--color-white);
    box-shadow: var(--box-shadow-down);
    color: var(--color-bg-dark);

    h2,
    p {
      margin: 0;
    }

    h2 {
      padding-right: 2rem;
      font-size: clamp(1.25rem, 3vw, 1.55rem);
      line-height: 1.2;
    }
  }

  .footer-modal__eyebrow {
    color: var(--color-blue);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .footer-modal__repo {
    justify-self: start;
    border-radius: 0.25rem;
    background: color-mix(in srgb, var(--color-blue) 10%, var(--color-white));
    padding: 0.45rem 0.65rem;
    font-weight: 700;
  }

  .footer-modal__blessing {
    color: color-mix(in srgb, var(--color-bg-dark) 76%, var(--color-white));
    font-weight: 700;
  }

  .footer-modal__close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid color-mix(in srgb, var(--color-bg-dark) 18%, transparent);
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-bg-dark);

    span,
    span::after {
      width: 0.9rem;
      height: 2px;
      border-radius: 999px;
      background: currentcolor;
    }

    span {
      transform: rotate(45deg);

      &::after {
        content: '';
        display: block;
        transform: rotate(90deg);
      }
    }

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 10%, var(--color-white));
    }
  }

  @media (max-width: 32rem) {
    .footer {
      align-items: stretch;
      flex-direction: column;
      font-size: 14px;
    }

    .footer__actions {
      justify-content: space-between;
    }

    .only-desktop {
      display: none;
    }
  }
</style>
