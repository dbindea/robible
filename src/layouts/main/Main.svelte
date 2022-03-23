<script>
  import Sidebar from "./Sidebar.svelte";
  import Request from "./Request.svelte";
  import Result from "./Result.svelte";

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
    <Result {bible} />
  </div>
</div>

<style>
  .main {
    gap: 1.5rem;
    background-color: #f2f5f8;
  }
  .sidebar {
    background-color: #425968;
    max-width: 36vh;
    min-width: 34vh;
  }
  .layout {
    padding: 4rem 10rem 4rem 5rem;
  }
</style>
