<script>
  import Sidebar from "./Sidebar.svelte";
  import Request from "./Request.svelte";
  import Result from "./Result.svelte";

  export let bible;
  export let map;
  export let version;
</script>

<div class="main">
  <div class="sidebar-ct">
    <Sidebar {map} {version} />
  </div>
  <div class="layout-ct">
    <Request {map} {version} />
    <Result {bible} />
  </div>
</div>

<style>
  div.main {
    gap: 1.5rem;
  }
  div.sidebar-ct {
    background-color: #425968;
    max-width: 25%;
    min-width: 20%;
  }
  div.layout-ct {
    flex-direction: column;
  }

  /*   @media (max-width: 600px) {
    div.sidebar-ct {
    min-width: 100%;
  } 
}*/
</style>
