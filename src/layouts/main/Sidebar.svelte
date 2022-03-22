<script>
  export let version;
  export let map;
</script>

<div class="sidebar">
  <!-- Sidebar: {map[version]} -->
  <label for="search-input">Cauta ca si expresie</label>
  <input id="search-input" type="text" placeholder="isus plangea" />

  <label for="radio-vt">Unde Caut?</label>
  <div id="radio-vt" class="radio-in">
    <input id="srch-vt" type="radio" />
    <label for="srch-vt">Vechiul Testament</label>
  </div>
  <div id="radio-nt" class="radio-in">
    <input id="srch-nt" type="radio" />
    <label for="srch-nt">Noul Testament</label>
  </div>
<!--   <input id="search-radio-test" type="radio" />
  <input id="search-radio-test" type="radio" /> -->
  <p>INICIO</p>
  <p>
    Lorem ipsum dolor sit amet consectetur adipisicing elit. Deserunt similique
    perspiciatis, officia odit quo quidem necessitatibus dolorum aliquam
    nesciunt expedita magnam dicta unde suscipit distinctio sint molestias nemo
    id qui!
  </p>
  <p>FIN</p>
</div>

<style>
  div {
    color: #ffffff;
  }
  div.sidebar {
    flex-direction: column;
    padding: 2rem 2rem;
    gap: 0.5rem;
  }
  input {
    height: 3rem;
    padding: 0 0.5rem;
  }

  div.radio-in {
    align-items: center;
  }
</style>
