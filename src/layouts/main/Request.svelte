<script>
  import { filter } from "../../store/stores";

  export let version;
  export let map;
  // export let bible;

  //let form;

  const updateFilter = (form) => {
    filter.update(() => {
      return form;
    });
  };
</script>

<div>
  <p>{map[version]}</p>
  <pre>
    Map: {Object.keys(map)}
  </pre>
</div>
