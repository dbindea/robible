<script>
  import Sidebar from './Sidebar.svelte';
  import Request from './Request.svelte';
  import Result from './Result.svelte';

  export let bible;
  export let map;
  export let version;
</script>

<div class="main">
  <div class="sidebar">
    <Sidebar {map} {version} />
  </div>
  <div class="layout">
    <!-- <Request {map} {version} /> -->
    {#if Object.keys(bible).length}
      <Result {bible} {map} />
    {/if}
  </div>
</div>

<style type="scss">
  .main {
    display: flex;
    gap: 1.5rem;
    background-color: var(--color-bg-light);
  }
  .sidebar {
    background-color: var(--color-bg-dark);
    max-width: 36vh;
    min-width: 34vh;
  }
  .layout {
    padding: 4rem 10rem 4rem 5rem;
  }
</style>
