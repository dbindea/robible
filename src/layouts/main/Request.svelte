<!-- NO UTILIZADO -->
<script>
  import { filter } from '../../store/stores';

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
  <p>Map: {Object.keys(map)}</p>
</div>
