<script>
  /**
   * IconPicker — paleta de iconos para elegir el de un tema.
   *
   * Ni la lista ni los trazos viven aquí: la lista está en config/topic-icons.js
   * (sus claves están en la base de datos) y los trazos en Icon.svelte.
   *
   * Props:
   *   value    — clave del icono actual
   *   onChange — callback(clave)
   */
  import Icon from './Icon.svelte';
  import { _ } from '../services/i18n.service';
  import { TOPIC_ICONS, DEFAULT_TOPIC_ICON } from '../config/topic-icons.js';

  export let value = DEFAULT_TOPIC_ICON;
  export let onChange = () => {};
</script>

<div class="icon-picker" role="listbox" aria-label="Icon">
  {#each TOPIC_ICONS as icon (icon.key)}
    <button
      type="button"
      class="icon-picker__item"
      class:icon-picker__item--selected={value === icon.key}
      title={$_(icon.labelKey)}
      aria-label={$_(icon.labelKey)}
      aria-pressed={value === icon.key}
      on:click={() => onChange(icon.key)}
    >
      <Icon name={icon.key} weight={value === icon.key ? 'fill' : 'regular'} size="1rem" />
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
      border: 1px solid var(--color-line);
      border-radius: 0.3rem;
      background: color-mix(in srgb, var(--color-bg-dark) 4%, var(--color-white));
      color: var(--color-ink-soft);
      cursor: pointer;
      transition: var(--transition);

      :global(svg) {
        width: 1rem;
        height: 1rem;
      }

      &:hover,
      &:focus-visible {
        border-color: var(--color-blue);
        background: color-mix(in srgb, var(--color-accent) 12%, transparent);
        color: var(--color-blue);
      }

      &--selected {
        border-color: var(--color-blue);
        background: color-mix(in srgb, var(--color-accent) 18%, transparent);
        color: var(--color-blue);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 22%, transparent);
      }
    }
  }

</style>
