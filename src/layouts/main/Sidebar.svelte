<script>
  export let version;
  export let map;
</script>

<!-- Sidebar: {map[version]} -->

<div class="sidebar">
  <div class="block-erase">
    <span class="filter-icon"><img src="assets/img/filter.png" alt="" /> Filtru</span>
    <button class="button-erase">Sterge Cautarea</button>
  </div>

  <div class="divider" />

  <label for="search-input">Cauta dupa cuvintele...</label>
  <input id="search-input" type="text" placeholder="Isus plangea" />

  <div class="margin-up">Cum se face cautarea?</div>

  <div class="radio-in">
    <input type="radio" id="aprox" name="searchMode" value="" checked />
    <label for="aprox">Cu aproximatie</label>
  </div>

  <div class="radio-in">
    <input type="radio" id="exact" name="searchMode" value="" />
    <label for="exact">Fraza exacta</label>
  </div>

  <div class="radio-in">
    <input type="radio" id="any" name="searchMode" value="" />
    <label for="any">Oricare cuvant</label>
  </div>

  <div class="margin-up">Unde se face cautarea?</div>

  <div class="radio-in">
    <input type="radio" id="all" name="searchPlace" value="" checked />
    <label for="all">Toata Biblia</label>
  </div>

  <div class="radio-in">
    <input type="radio" id="nt" name="searchPlace" value="" />
    <label for="nt">Noul Testament</label>
  </div>

  <div class="radio-in">
    <input type="radio" id="vt" name="searchPlace" value="" />
    <label for="vt">Vechiul testament</label>
  </div>

  <div class="margin-up">O carte specifica?</div>

  <div class="libs">
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <!-- <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button>
    <button class="libs_btn">Lev.</button>
    <button class="libs_btn">Deut.</button>
    <button class="libs_btn">Ios.</button>
    <button class="libs_btn">Gen.</button>
    <button class="libs_btn">Exod.</button> -->
  </div>
</div>

<style>
  div {
    color: var(--color-white);
  }
  .sidebar {
    flex-direction: column;
    padding: 2rem 2rem;
    gap: 0.5rem;
  }
  input[type='text'] {
    height: var(--input-height);
    padding: 0 0.5rem;
  }

  .radio-in {
    align-items: center;
    gap: 0.5rem;
  }

  .margin-up {
    padding-top: 1.2rem;
  }

  label,
  input {
    cursor: pointer;
  }

  .divider {
    border-top: 0.1rem var(--border-gray);
    margin-top: 0.5rem;
    margin-bottom: 1rem;
  }

  .block-erase {
    justify-content: space-between;
  }

  .button-erase {
    background: var(--color-blue);
    color: var(--color-white);
    border: 0.1rem var(--border-blue);
    height: var(--button-height);
    font-family: 'Open Sans';
  }

  .filter-icon {
    display: flex;
    align-items: flex-end;
  }

  .libs {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .libs_btn {
    background: var(--color-blue);
    color: var(--color-white);
    border: 0.1rem var(--border-blue);
    height: var(--button-height);
    font-family: 'Open Sans';
    width: auto;
  }
</style>
