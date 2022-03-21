<script>
  import Sidebar from "./Sidebar.svelte";
  import Request from "./Request.svelte";
  import Result from "./Result.svelte";

  export let bible;
  export let map;
  export let version;
</script>

<div>
  <Sidebar {map} {version} />
  <Request {map} {version} />
  <Result {bible}/>
</div>

<style>
  div {
    background-color: rgb(229, 240, 240);
  }
</style>
