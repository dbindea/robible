<script>
  /**
   * ActionButton — botón de icono reutilizable con estilos consistentes.
   * Props:
   *   type    — 'copy' | 'favorite' | 'note' | 'topics' | 'compare'
   *   active  — boolean, estilo activo (filled para favorite, color para note)
   *   disabled — boolean
   *   title   — string
   *   ariaLabel — string
   *   onClick — función
   */
  export let type = 'copy';
  export let active = false;
  export let disabled = false;
  export let title = '';
  export let ariaLabel = '';
  export let onClick = () => {};
</script>

<button
  type="button"
  class="action-btn action-btn--{type}"
  class:action-btn--active={active}
  class:action-btn--disabled={disabled}
  {title}
  aria-label={ariaLabel}
  {disabled}
  on:click={onClick}
>
  {#if type === 'copy'}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  {:else if type === 'favorite'}
    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      fill={active ? 'currentColor' : 'none'}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  {:else if type === 'note'}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  {:else if type === 'topics'}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
    </svg>
  {:else if type === 'compare'}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="18" rx="1"/>
      <rect x="14" y="3" width="7" height="18" rx="1"/>
    </svg>
  {/if}
</button>

<style lang="scss">
  .action-btn {
    display: inline-grid;
    place-items: center;
    width: 1.65rem;
    height: 1.65rem;
    flex-shrink: 0;
    border: 1px solid color-mix(in srgb, var(--color-accent) 24%, transparent);
    border-radius: 0.28rem;
    background: color-mix(in srgb, var(--color-accent) 7%, transparent);
    color: var(--color-link);
    cursor: pointer;
    transition: opacity 0.15s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    opacity: 0;

    svg {
      width: 0.82rem;
      height: 0.82rem;
    }

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
      border-color: var(--color-blue);
      background: color-mix(in srgb, var(--color-accent) 18%, transparent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 14%, transparent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }

    &--active {
      color: var(--color-blue);
    }

    &--disabled,
    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;

      &:hover {
        border-color: color-mix(in srgb, var(--color-accent) 24%, transparent);
        background: color-mix(in srgb, var(--color-accent) 7%, transparent);
        box-shadow: none;
      }
    }
  }

  // Estilos por tipo
  .action-btn--favorite {
    &.action-btn--active {
      color: #28a745;
    }
  }

  // Reveal on hover del versículo padre (igual que los iconos originales)
  :global(.verse:hover) .action-btn,
  :global(.verse:focus-within) .action-btn,
  .action-btn--active {
    opacity: 1;
  }
</style>
