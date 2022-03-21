<script>
  const version = "vdc";

  const _getBible = async () => {
    const bible = await fetch(`${version}/bible.json`).json();
  };

  const _getBibleMap = async () => {
    const bibleMap = await fetch(`${version}/bible.map.json`).json();
  };

  _getBible();
  _getBibleMap();

  // let getBible = fetch("vdc/bible.json").then((res) => res.json());
  // let getBibleMap = fetch("vdc/bible.map.json").then((res) => res.json());
</script>

<!-- {#await getBible}
  <p>Loading Bible...</p>
{:then result}
  {#await getBibleMap then map}
    <p>{map}</p>
    <table>
      <thead />
      <tbody>
        <tr>
          {#each Object.keys(result) as bookNumber}
            <td>
              {map[bookNumber]}
            </td>
          {/each}
        </tr>
      </tbody>
    </table>
  {/await}
{/await} -->

<table>
  <thead>
    <tr>
      <td>
        Cartea
      </td>
    </tr>
  </thead>
  <tbody>
    <tr>
      {#each Object.keys(bible) as bookNumber}
      <td>
        Cartea
      </td>
      {/each}
    </tr>
  </tbody>
</table>

<style>
  p {
    color: #666666;
  }
</style>
