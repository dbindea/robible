<script>
  /*   const getBible = async () => {
    const res = await fetch("cornilescu.json");
    const bible = res.json();
    console.log(bible);
  };
  getBible(); */

  let getBible = fetch("vdc/bible.json").then((res) => res.json());
  let getBibleMap = fetch("vdc/bible.map.json").then((res) => res.json());
</script>

{#await getBible}
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
{/await}

<style>
  p {
    color: #666666;
  }
</style>
