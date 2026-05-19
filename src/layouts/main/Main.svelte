<script>
  import Sidebar from './Sidebar.svelte';
  import Result from './Result.svelte';

  export let bible;
  export let map;
</script>

<div class="main">
  <div class="sidebar">
    <Sidebar {map} />
  </div>
  <div class="layout">
    {#if Object.keys(bible).length}
      <Result {bible} {map} />
    {/if}
  </div>
</div>

<style lang="scss">
  .main {
    display: grid;
    grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
    gap: clamp(1rem, 2vw, 1.5rem);
    background-color: var(--color-bg-light);
    min-height: calc(100dvh - 9rem);
  }

  .sidebar {
    background-color: var(--color-bg-dark);
    min-width: 0;
  }

  .layout {
    width: 100%;
    min-width: 0;
    max-width: 96rem;
    margin-inline: auto;
    padding: clamp(1rem, 3vw, 2.5rem) clamp(1rem, 5vw, 5rem) clamp(2rem, 6vw, 4rem);
  }

  @media (max-width: 58rem) {
    .main {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
    }
  }
</style>
