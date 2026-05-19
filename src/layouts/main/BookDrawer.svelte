<script>
  import { onDestroy } from 'svelte';

  export let open = false;
  export let map;
  export let selectedBook = null;
  export let onClose = () => {};
  export let onSelect = () => {};

  const groups = [
    {
      title: 'Vechiul Testament',
      description: 'Primele 39 de carti',
      key: 'ot',
    },
    {
      title: 'Noul Testament',
      description: 'Ultimele 27 de carti',
      key: 'nt',
    },
  ];

  $: if (typeof document !== 'undefined') {
    document.body.classList.toggle('drawer-open', open);
  }

  const handleKeydown = (event) => {
    if (event.key === 'Escape' && open) {
      onClose();
    }
  };

  const selectBook = (bookId) => {
    onSelect(bookId);
    onClose();
  };

  onDestroy(() => {
    document.body.classList.remove('drawer-open');
  });
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="book-drawer__overlay" aria-hidden="true" on:click={onClose}></div>
{/if}

<aside class:book-drawer--open={open} class="book-drawer" aria-hidden={!open} aria-label="Cartile Bibliei">
  <div class="book-drawer__header">
    <div>
      <p>Biblioteca</p>
      <h2>Cartile Bibliei</h2>
    </div>
    <button
      class="book-drawer__close"
      type="button"
      tabindex={open ? 0 : -1}
      aria-label="Inchide meniul cartilor"
      on:click={onClose}
    >
      <span class="icon-cross" aria-hidden="true"></span>
    </button>
  </div>

  <div class="book-drawer__content">
    {#each groups as group (group.key)}
      <section class="book-group" aria-labelledby={`book-group-${group.key}`}>
        <div class="book-group__header">
          <h3 id={`book-group-${group.key}`}>{group.title}</h3>
          <span>{group.description}</span>
        </div>

        <div class="book-group__grid">
          {#each map[group.key] || [] as item (item)}
            <button
              class:book-button--active={selectedBook === item}
              class="book-button"
              type="button"
              tabindex={open ? 0 : -1}
              aria-current={selectedBook === item ? 'page' : undefined}
              on:click={() => selectBook(item)}
            >
              {map[item]}
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</aside>

<style lang="scss">
  .book-drawer__overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
    background-color: rgb(7 24 31 / 48%);
    backdrop-filter: blur(2px);
  }

  .book-drawer {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 21;
    display: flex;
    flex-direction: column;
    width: min(33rem, calc(100vw - 1.5rem));
    background-color: var(--color-white);
    box-shadow: 1rem 0 2rem rgb(24 47 61 / 24%);
    transform: translateX(-104%);
    transition: transform 0.24s ease;
    will-change: transform;
  }

  .book-drawer--open {
    transform: translateX(0);
  }

  .book-drawer__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem;
    border-bottom: 1px solid rgb(63 88 103 / 14%);

    p,
    h2 {
      margin: 0;
    }

    p {
      color: var(--color-blue);
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    h2 {
      color: var(--color-bg-dark);
      font-size: 1.4rem;
      line-height: 1.2;
    }
  }

  .book-drawer__close {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid rgb(63 88 103 / 18%);
    border-radius: 0.35rem;
    background: var(--color-white);
    color: var(--color-bg-dark);
    transition: var(--transition);

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 16%);
    }
  }

  .book-drawer__content {
    display: grid;
    gap: 1rem;
    overflow-y: auto;
    padding: 1rem;
  }

  .book-group {
    border: 1px solid rgb(63 88 103 / 14%);
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .book-group__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.8rem;

    h3 {
      margin: 0;
      color: var(--color-bg-dark);
      font-size: 1rem;
    }

    span {
      color: color-mix(in srgb, var(--color-bg-dark) 62%, white);
      font-size: 0.82rem;
      font-weight: 600;
      white-space: nowrap;
    }
  }

  .book-group__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 0.5rem;
  }

  .book-button {
    min-height: 2.35rem;
    border: 1px solid rgb(45 150 205 / 20%);
    border-radius: 0.35rem;
    background-color: #eeeff7;
    color: var(--color-bg-dark);
    font-weight: 600;
    text-align: left;
    transition: var(--transition);

    &:hover,
    &:focus-visible,
    &--active {
      border-color: var(--color-blue);
      background-color: rgb(45 150 205 / 10%);
      box-shadow: 0 0 0 3px rgb(45 150 205 / 12%);
    }
  }

  @media (max-width: 34rem) {
    .book-drawer {
      width: 100vw;
    }

    .book-group__header {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.2rem;
    }

    .book-group__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .book-drawer {
      transition: none;
    }
  }
</style>
