<script>
  /**
   * Modal reutilizable de la app.
   *
   * Un único diálogo para todo lo que antes eran popups anclados al botón que
   * los abría (comparar versión, nota, índice temático). Aquellos se posicionaban
   * con `getBoundingClientRect()` y quedaban estrechos y pegados al borde; este
   * va centrado, con ancho cómodo, y en móvil ocupa casi toda la pantalla.
   *
   * Uso:
   *   <Modal open={abierto} title="Título" onClose={() => (abierto = false)}>
   *     …contenido…
   *     <svelte:fragment slot="footer">…acciones…</svelte:fragment>
   *   </Modal>
   */
  import { onDestroy } from 'svelte';
  import { _ } from '../services/i18n.service';

  export let open = false;
  export let title = '';
  /** Texto pequeño sobre el título. */
  export let eyebrow = '';
  export let onClose = () => {};
  /** 'sm' 26rem · 'md' 34rem · 'lg' 44rem */
  export let size = 'md';
  /** Elemento que recibe el foco al abrir. */
  export let autofocus = null;

  let panel;

  const close = () => onClose();

  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };

  // Bloquea el scroll del fondo mientras el diálogo está abierto, para que al
  // hacer scroll dentro del modal no se mueva la página de detrás.
  let bloqueado = false;
  $: if (typeof document !== 'undefined') {
    if (open && !bloqueado) {
      document.body.classList.add('drawer-open');
      bloqueado = true;
    } else if (!open && bloqueado) {
      document.body.classList.remove('drawer-open');
      bloqueado = false;
    }
  }
  onDestroy(() => {
    if (typeof document !== 'undefined') document.body.classList.remove('drawer-open');
  });

  // Foco inicial dentro del panel: sin esto el lector de pantalla y el teclado
  // se quedan en el botón que abrió el diálogo.
  $: if (open && panel) {
    Promise.resolve().then(() => {
      const destino = autofocus || panel.querySelector('[data-autofocus]') || panel;
      destino?.focus?.();
    });
  }
</script>

<svelte:window on:keydown={open ? onKeydown : undefined} />

{#if open}
  <!-- El backdrop cierra al pulsar fuera; el panel detiene la propagación. -->
  <div
    class="modal"
    role="presentation"
    on:click={close}
  >
    <div
      class="modal__panel modal__panel--{size}"
      bind:this={panel}
      role="dialog"
      aria-modal="true"
      aria-label={title || undefined}
      tabindex="-1"
      on:click|stopPropagation
    >
      <button type="button" class="modal__close" aria-label={$_('auth.close')} on:click={close}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>

      {#if eyebrow}
        <p class="modal__eyebrow">{eyebrow}</p>
      {/if}
      {#if title}
        <h2 class="modal__title">{title}</h2>
      {/if}

      <div class="modal__body">
        <slot />
      </div>

      {#if $$slots.footer}
        <div class="modal__footer">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  .modal {
    position: fixed;
    inset: 0;
    z-index: 110;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 100dvh;
    background: rgb(0 0 0 / 50%);
    backdrop-filter: blur(3px);
    overflow-y: auto;
    animation: modal-fade 0.16s ease-out;
  }

  .modal__panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    max-height: calc(100dvh - 2rem);
    padding: 1.5rem 1.4rem;
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    box-shadow: var(--box-shadow-lg);
    color: var(--color-ink);
    animation: modal-rise 0.18s ease-out;

    &:focus-visible {
      outline: none;
    }

    &--sm { width: min(26rem, 100%); }
    &--md { width: min(34rem, 100%); }
    &--lg { width: min(44rem, 100%); }
  }

  .modal__close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-ink-soft);
    cursor: pointer;
    transition: var(--transition);

    svg { width: 1rem; height: 1rem; }

    &:hover,
    &:focus-visible {
      border-color: var(--color-accent);
      color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 10%, transparent);
    }
  }

  .modal__eyebrow {
    margin: 0;
    padding-right: 2.5rem;
    font-size: var(--font-size-tiny);
    font-weight: 600;
    letter-spacing: var(--letter-spacing-eyebrow);
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .modal__title {
    margin: 0;
    padding-right: 2.5rem;
    font-size: var(--font-size-h3);
    line-height: var(--line-height-tight);
  }

  // El cuerpo es lo que hace scroll: la cabecera y el pie quedan fijos.
  .modal__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    margin: 0 -0.35rem;
    padding: 0 0.35rem;
  }

  .modal__footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-end;
    padding-top: 0.35rem;
    border-top: 1px solid var(--color-line-soft);
  }

  // En móvil ocupa casi toda la pantalla: da sitio para escribir una nota o
  // recorrer una lista larga de categorías sin pelearse con el teclado.
  @media (max-width: 40rem) {
    .modal {
      padding: 0;
      align-items: flex-end;
    }

    .modal__panel {
      width: 100% !important;
      max-width: 100%;
      height: 92dvh;
      max-height: 92dvh;
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
      border-bottom: none;
      padding: 1.5rem 1.1rem calc(1.1rem + env(safe-area-inset-bottom, 0px));
      animation: modal-sheet 0.2s ease-out;
    }
  }

  @keyframes modal-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes modal-rise {
    from { opacity: 0; transform: translateY(0.5rem) scale(0.98); }
    to { opacity: 1; transform: none; }
  }

  @keyframes modal-sheet {
    from { transform: translateY(100%); }
    to { transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .modal,
    .modal__panel {
      animation: none;
    }
  }
</style>
