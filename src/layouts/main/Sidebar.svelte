<script>
  import { _ } from 'svelte-i18n';
  import { filter } from '../../store/stores';

  export let version;
  export let map;

  const form = JSON.parse(localStorage.getItem('filter') || '{}');

  const formValues = {
    searchText: form.searchText || null,
    searchType: form.searchType || 'aprox',
    testament: form.testament || '',
    book: form.book || [],
  };

  // REACTIVE
  /*   $: {
    map,
      () => {
        if (!formValues.book.length) {
          formValues.book = concat(map['ot'], map['nt']);
        }
        updateFilter(formValues);
      };
  } */

  const updateFilter = (form) => {
    filter.update(() => form);
  };

  $: visibleBook = [];
  $: {
    formValues.testament, getDinamicBook(formValues.testament);
  }

  function getDinamicBook(testament) {
    switch (testament) {
      case 'ot':
      case 'nt':
        visibleBook = map[testament];
        break;

      default:
        visibleBook = map['ot'].concat(map['nt']);
        break;
    }
  }
</script>

<div class="sidebar sticky">
  <div class="block-erase">
    <span class="filter-icon"><img src="assets/img/filter.png" alt="" /> Filtru</span>
    <button class="button-erase">Sterge Cautarea</button>
  </div>

  <div class="divider" />
  <form on:change|preventDefault={updateFilter(formValues)} on:keyup|preventDefault={updateFilter(formValues)}>
    <label for="searchText">Cauta dupa cuvintele...</label>
    <input id="searchText" type="text" autocomplete="off" bind:value={formValues.searchText} placeholder={$_('app.sidebar.form.search_placeholder')} />

    <div class="margin-up">Cum se face cautarea?</div>

    <label class="radio__label" for="aprox">
      <input type="radio" id="aprox" name="searchType" value="aprox" bind:group={formValues.searchType} />
      <span>Cu aproximatie</span>
    </label>

    <label class="radio__label" for="exact">
      <input type="radio" id="exact" name="searchType" value="exact" bind:group={formValues.searchType} />
      <span>Fraza exacta</span></label
    >

    <label class="radio__label" for="any">
      <input type="radio" id="any" name="searchType" value="any" bind:group={formValues.searchType} />
      <span>Oricare cuvant</span>
    </label>

    <div class="margin-up">Unde se face cautarea?</div>

    <label class="radio__label" for="all">
      <input type="radio" id="all" name="testament" value="" bind:group={formValues.testament} />
      <span>Toata Biblia</span>
    </label>

    <label class="radio__label" for="ot">
      <input type="radio" id="ot" name="testament" value="ot" bind:group={formValues.testament} />
      <span>Vechiul testament</span>
    </label>

    <label class="radio__label" for="nt">
      <input type="radio" id="nt" name="testament" value="nt" bind:group={formValues.testament} />
      <span>Noul Testament</span>
    </label>

    <div class="margin-up">O carte specifica?</div>

    <div class="libs">
      {#each visibleBook as item}
        <label for={item} class="book">{map[item]}<input type="checkbox" id={item} value={item} bind:group={formValues.book} /></label>
      {/each}
    </div>
  </form>
</div>

<style type="scss">
  * {
    font-weight: 300;
  }
  div {
    color: var(--color-white);
  }
  .sidebar {
    display: flex;
    flex-direction: column;
    padding: 2rem 2rem;
    gap: 0.5rem;
  }
  input[type='text'] {
    height: var(--input-height);
    padding: 0 0.5rem;
  }

  input[type='text']:focus {
    border-color: transparent;
    border-radius: 2px;
    outline: none;
    transition: background-color 0.4s cubic-bezier(0, 0, 0, 1);
    box-shadow: 0 0 4px 1px var(--color-blue);
  }

  .radio__label {
    align-items: center;
    display: inline-flex;
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
    border-top: 0.05rem var(--border-gray);
    margin-top: 0.5rem;
    margin-bottom: 1rem;
  }

  .block-erase {
    display: flex;
    justify-content: space-between;
  }

  .button-erase {
    background: var(--color-blue);
    color: var(--color-white);
    border: 0.1rem var(--border-blue);
    height: var(--button-height);
    font-family: 'Open Sans';
    font-size: 14px;
  }

  .filter-icon {
    display: flex;
    align-items: flex-end;
  }

  .libs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  form {
    display: contents;
  }

  label {
    &.book {
      background: var(--color-blue);
      border: 0.1rem var(--border-blue);
      width: auto;
      gap: 0.5rem;
      padding: 0.3rem;
      font-size: 14px;
    }
    input[type='checkbox'] {
      display: contents;
    }
  }
</style>
