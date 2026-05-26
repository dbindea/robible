<script>
  import { onDestroy, onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { bibleVersions, selectedBibleVersion } from '../../store/stores';

  let isVersionMenuOpen = false;
  let versionPickerElement;

  $: selectedVersion = $selectedBibleVersion;
  $: selectedVersionLabel =
    visibleBibleVersions.find((version) => version.value === selectedVersion)?.label || selectedVersion;
  $: visibleBibleVersions = bibleVersions.some((version) => version.value === selectedVersion)
    ? bibleVersions
    : [{ value: selectedVersion, label: selectedVersion }, ...bibleVersions];

  const selectVersion = (version) => {
    selectedBibleVersion.set(version.value);
    isVersionMenuOpen = false;
  };

  const handleDocumentClick = (event) => {
    if (!versionPickerElement?.contains(event.target)) {
      isVersionMenuOpen = false;
    }
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      isVersionMenuOpen = false;
    }
  };

  onMount(() => {
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="header">
  <a class="logo" href="/" aria-label={$_('app.nav.logo_label')}>
    <img class="logo__img" src="/assets/img/logo.png" alt="" width="48" height="48" />
    <span class="logo__text">{$_('app.nav.logo_text')}</span>
  </a>

  <div class="version-picker" bind:this={versionPickerElement}>
    <button
      type="button"
      class="version-picker__button"
      aria-haspopup="listbox"
      aria-expanded={isVersionMenuOpen}
      aria-label={$_('app.nav.version_label')}
      on:click|stopPropagation={() => (isVersionMenuOpen = !isVersionMenuOpen)}
    >
      <span>{selectedVersionLabel}</span>
      <span class="version-picker__chevron" aria-hidden="true"></span>
    </button>

    {#if isVersionMenuOpen}
      <div class="version-picker__menu" role="listbox" aria-label={$_('app.nav.version_label')}>
        {#each visibleBibleVersions as version (version.value)}
          <button
            type="button"
            class:version-picker__option--selected={version.value === selectedVersion}
            class="version-picker__option"
            role="option"
            aria-selected={version.value === selectedVersion}
            on:click={() => selectVersion(version)}
          >
            <span>{version.label}</span>
            {#if version.value === selectedVersion}
              <span class="version-picker__check" aria-hidden="true"></span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .header {
    display: flex;
    min-height: 5rem;
    box-shadow: var(--box-shadow-down);
    align-items: center;
    gap: 1rem;
    padding: 0.75rem clamp(1rem, 5vw, 5rem);
    justify-content: space-between;
    background-color: var(--color-white);
    font-family: var(--font-family-base);
  }

  .version-picker {
    position: relative;
    flex: 0 0 auto;
    min-width: min(13rem, 48vw);
  }

  .version-picker__button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: var(--button-height);
    border: 1px solid rgb(45 150 205 / 42%);
    border-radius: 0.28rem;
    background: color-mix(in srgb, var(--color-blue) 11%, var(--color-white));
    color: var(--color-bg-dark);
    padding: 0 0.85rem 0 1rem;
    font-weight: 700;
    transition: var(--transition);

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-blue) 18%, var(--color-white));
      box-shadow: 0 0 0 3px rgb(45 150 205 / 14%);
    }
  }

  .version-picker__chevron {
    width: 0.55rem;
    height: 0.55rem;
    flex: 0 0 auto;
    border-right: 2px solid currentcolor;
    border-bottom: 2px solid currentcolor;
    transform: translateY(-0.12rem) rotate(45deg);
  }

  .version-picker__menu {
    position: absolute;
    top: calc(100% + 0.45rem);
    right: 0;
    z-index: 30;
    display: grid;
    gap: 0.25rem;
    width: max(100%, 13rem);
    max-width: calc(100vw - 2rem);
    padding: 0.35rem;
    border: 1px solid rgb(63 88 103 / 18%);
    border-radius: 0.35rem;
    background: var(--color-white);
    box-shadow: var(--box-shadow-down);
  }

  .version-picker__option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: 2.45rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-bg-dark);
    padding: 0 0.65rem;
    text-align: left;
    transition: var(--transition);

    &:hover,
    &:focus-visible {
      border-color: rgb(45 150 205 / 34%);
      background: color-mix(in srgb, var(--color-blue) 12%, var(--color-white));
    }

    &--selected {
      border-color: var(--color-blue);
      background: var(--color-blue);
      color: var(--color-on-primary);
      font-weight: 700;
    }
  }

  .version-picker__check {
    width: 0.75rem;
    height: 0.45rem;
    flex: 0 0 auto;
    border-left: 2px solid currentcolor;
    border-bottom: 2px solid currentcolor;
    transform: translateY(-0.08rem) rotate(-45deg);
  }

  .logo {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 0.65rem;

    &__img {
      width: 3rem;
      height: 3rem;
      flex: 0 0 auto;
    }

    &__text {
      color: var(--color-bg-dark);
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1;
    }
  }

  a.logo:hover {
    text-decoration: none;
  }

  @media (max-width: 32rem) {
    .version-picker {
      min-width: min(11rem, 48vw);
    }
  }
</style>
