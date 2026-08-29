<script>
  /**
   * IconPicker — paleta de iconos SVG para elegir.
   * Props:
   *   value   — valor actual (string con nombre del icono)
   *   onChange — callback(selectedIconKey)
   */
  export let value = 'bookmark';
  export let onChange = (icon) => {};

  const ICONS = [
    {
      key: 'cross',
      label: 'Cross',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/></svg>`,
    },
    {
      key: 'heart',
      label: 'Heart',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
    },
    {
      key: 'star',
      label: 'Star',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    },
    {
      key: 'bookmark',
      label: 'Bookmark',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>`,
    },
    {
      key: 'sun',
      label: 'Sun',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    },
    {
      key: 'moon',
      label: 'Moon',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`,
    },
    {
      key: 'shield',
      label: 'Shield',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    },
    {
      key: 'crown',
      label: 'Crown',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><line x1="5" y1="20" x2="19" y2="20"/></svg>`,
    },
    {
      key: 'dove',
      label: 'Dove',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20c-4-4-8-6-8-10a4 4 0 018 0 4 4 0 018 0c0 4-4 6-8 10z"/><path d="M12 10c-2 0-4-1-4-3"/><line x1="12" y1="7" x2="12" y2="10"/></svg>`,
    },
    {
      key: 'hands',
      label: 'Praying hands',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V6a2 2 0 00-2-2H4a2 2 0 00-2 2v7a2 2 0 002 2h8"/><path d="M14 4v8a6 6 0 0012 0V6"/></svg>`,
    },
    {
      key: 'flame',
      label: 'Flame',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>`,
    },
    {
      key: 'water',
      label: 'Water',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>`,
    },
    {
      key: 'home',
      label: 'Home',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    },
    {
      key: 'light',
      label: 'Light',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    },
    {
      key: 'peace',
      label: 'Peace',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20"/><path d="M2 12h20"/></svg>`,
    },
  ];
</script>

<div class="icon-picker" role="listbox" aria-label="Icon">
  {#each ICONS as icon (icon.key)}
    <button
      type="button"
      class="icon-picker__item"
      class:icon-picker__item--selected={value === icon.key}
      title={icon.label}
      aria-label={icon.label}
      aria-pressed={value === icon.key}
      on:click={() => onChange(icon.key)}
    >
      {@html icon.svg}
    </button>
  {/each}
</div>

<style lang="scss">
  .icon-picker {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.35rem;

    &__item {
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border: 1px solid color-mix(in srgb, var(--color-bg-dark) 15%, transparent);
      border-radius: 0.3rem;
      background: color-mix(in srgb, var(--color-bg-dark) 4%, var(--color-white));
      color: color-mix(in srgb, var(--color-bg-dark) 70%, transparent);
      cursor: pointer;
      transition: var(--transition);

      :global(svg) {
        width: 1rem;
        height: 1rem;
      }

      &:hover,
      &:focus-visible {
        border-color: var(--color-blue);
        background: rgb(45 150 205 / 12%);
        color: var(--color-blue);
      }

      &--selected {
        border-color: var(--color-blue);
        background: rgb(45 150 205 / 18%);
        color: var(--color-blue);
        box-shadow: 0 0 0 2px rgb(45 150 205 / 22%);
      }
    }
  }

  :global(html[data-theme='dark']) .icon-picker__item {
    background: #1a2733;
    border-color: rgb(255 255 255 / 10%);
    color: rgb(255 255 255 / 60%);

    &:hover,
    &:focus-visible {
      border-color: #7ec8e3;
      background: rgb(45 150 205 / 18%);
      color: #7ec8e3;
    }

    &--selected {
      border-color: #7ec8e3;
      background: rgb(45 150 205 / 22%);
      color: #7ec8e3;
    }
  }
</style>
