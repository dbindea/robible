<script>
  import Navbar from './layouts/header/Navbar.svelte';
  import Footer from './layouts/footer/Footer.svelte';
  import Main from './layouts/main/Main.svelte';
  import { onMount } from 'svelte';
  import { setupI18n, isLocaleLoaded } from './services/i18n.service';
  import { applySeoMetadata } from './services/seo.service';

  $: if (!$isLocaleLoaded) {
    const lang = localStorage.getItem('lang') || 'ro';
    setupI18n({ withLocale: lang });
  }

  const version = 'vdc';
  let map = {},
    bible = [];

  onMount(() => {
    applySeoMetadata();

    Promise.all([fetch(`data/${version}/bible.map.json`), fetch(`data/${version}/bible.json`)]).then(async (result) => {
      map = await result[0].json();
      bible = await result[1].json();
    });
  });
</script>

<main class="main">
  {#if $isLocaleLoaded && Object.keys(map).length}
    <Navbar />
    <Main {map} {bible} />
    <Footer />
  {:else}
    <p class="loading" role="status">Loading...</p>
  {/if}
</main>

<style>
  .main {
    min-height: 100dvh;
    background-color: var(--color-bg-light);
  }

  .loading {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    margin: 0;
    color: var(--color-bg-dark);
    font-weight: 600;
  }
</style>
