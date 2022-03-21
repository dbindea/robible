<script>
  import Navbar from "./layouts/header/Navbar.svelte";
  import Footer from "./layouts/footer/Footer.svelte";
  import Main from "./layouts/main/Main.svelte";
  import { onMount } from "svelte/internal";

  const version = "vdc";
  let map = {},
    bible = [];

  onMount(() => {
    Promise.all([
      fetch(`${version}/bible.map.json`),
      fetch(`${version}/bible.json`),
    ]).then(async (result) => {
      map = await result[0].json();
      bible = await result[1].json();
    });
  });
</script>

<main>
  <Navbar />
  <Main {map} {bible} {version} />
  <Footer />
</main>
