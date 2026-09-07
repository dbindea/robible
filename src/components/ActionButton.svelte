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
  import Icon from './Icon.svelte';

  export let type = 'copy';
  export let active = false;
  export let disabled = false;
  export let title = '';
  export let ariaLabel = '';
  export let onClick = () => {};

  // El `type` nombra la acción de RoBible; el valor, el icono del catálogo.
  const ICONO = { copy: 'copy', favorite: 'star', note: 'note', topics: 'bookmark', compare: 'compare' };
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
  <!-- El peso relleno marca el estado activo, como en iOS: mismo dibujo,
       contorno cuando no está y macizo cuando sí. -->
  <Icon name={ICONO[type]} weight={active ? 'fill' : 'regular'} />
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
    transition: opacity var(--motion-fast) ease, border-color var(--motion-fast) ease, background var(--motion-fast) ease, box-shadow var(--motion-fast) ease;
    opacity: 0;

    // El tamaño va al contenedor: una regla `svg` de aquí no alcanza al
    // <svg> de Icon.svelte, que lleva otra clase de scope.
    --icon-size: 0.82rem;

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
      color: var(--color-success);
    }
  }

  // Reveal on hover del versículo padre (igual que los iconos originales)
  :global(.verse:hover) .action-btn,
  :global(.verse:focus-within) .action-btn,
  .action-btn--active {
    opacity: 1;
  }
</style>
