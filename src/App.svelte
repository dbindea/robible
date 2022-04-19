<script>
  import Navbar from './layouts/header/Navbar.svelte';
  import Footer from './layouts/footer/Footer.svelte';
  import Main from './layouts/main/Main.svelte';
  import { onMount } from 'svelte/internal';
  import { setupI18n, isLocaleLoaded } from './services/i18n.service';
  import { SvelteToast } from '@zerodevx/svelte-toast'

  $: if (!$isLocaleLoaded) {
    const lang = localStorage.getItem('lang') || 'ro';
    setupI18n({ withLocale: lang });
  }

  const version = 'vdc';
  let map = {},
    bible = [];

  onMount(() => {
    Promise.all([fetch(`data/${version}/bible.map.json`), fetch(`data/${version}/bible.json`)]).then(async (result) => {
      map = await result[0].json();
      bible = await result[1].json();
    });
  });
</script>

<main class="main">
  {#if $isLocaleLoaded && Object.keys(map).length}
    <Navbar />
    <Main {map} {bible} {version} />
    <Footer />
  {:else}
    <p>Loading...</p>
  {/if}
  <SvelteToast />
</main>
