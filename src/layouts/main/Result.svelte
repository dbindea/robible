<script>
  import { filter } from "../../store/stores";
  import { getFilterResult } from "../../services/filter.service";

  export let bible;

  let result;

  filter.subscribe((e) => {
    result = getFilterResult(bible, e);
  });
</script>

<div>
  <pre>
    Resultado Búsqueda {JSON.stringify(result)}
  </pre>
</div>
