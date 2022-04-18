<script>
  import { _ } from 'svelte-i18n';
  import { filter } from '../../store/stores';

  export let version;
  export let map;

  const form = JSON.parse(localStorage.getItem('filter') || '{}');

  let formValues = {
    searchText: form.searchText || null,
    searchType: form.searchType || 'aprox',
    testament: form.testament || 'all',
    book: form.book || [],
    chapter: form.chapter || [],
  };

  const updateFilter = (form) => {
    filter.update(() => form);
  };

  $: visibleBook = [];
  $: {
    formValues.testament, (visibleBook = map[formValues.testament]);
  }

  const resetForm = () => {
    formValues = {
      searchText: null,
      searchType: 'aprox',
      testament: 'all',
      book: [],
      chapter: [],
    };
    updateFilter(formValues);
  };

  const cleanBook = () => {
    formValues.book = [];
    formValues.chapter = [];
    updateFilter(formValues);
  };

  const clearInput = () => {
    formValues.searchText = null;
    updateFilter(formValues);
  };
</script>

<div class="sidebar sticky">
  <form on:change|preventDefault={updateFilter(formValues)} on:keyup|preventDefault={updateFilter(formValues)}>
    <div class="block-erase">
      <span class="icon-filter icon--L" />
      <button class="button__erase" on:click|preventDefault={resetForm}><span class="icon-delete icon--M" />Sterge Cautarea</button>
    </div>

    <div class="divider" />
    <label for="searchText">Cauta dupa cuvintele...</label>
    <div class="input-search">
      <input
        id="searchText"
        type="text"
        autocomplete="off"
        spellcheck="false"
        bind:value={formValues.searchText}
        placeholder={$_('app.sidebar.form.search_placeholder')}
      />
      <span class="icon-error icon--input" on:click={clearInput} />
    </div>

    <div class="margin-up">Cum se face cautarea?</div>

    <label class="radio__label" for="aprox">
      <input type="radio" id="aprox" name="searchType" value="aprox" bind:group={formValues.searchType} />
      <span>Cu aproximatie</span>
    </label>

    <label class="radio__label" for="exact">
      <input type="radio" id="exact" name="searchType" value="exact" bind:group={formValues.searchType} disabled />
      <span>Fraza exacta</span></label
    >

    <label class="radio__label" for="any">
      <input type="radio" id="any" name="searchType" value="any" bind:group={formValues.searchType} disabled />
      <span>Oricare cuvant</span>
    </label>

    <div class="margin-up">Unde se face cautarea?</div>

    <label class="radio__label" for="all">
      <input type="radio" id="all" name="testament" value="all" bind:group={formValues.testament} on:change={cleanBook} />
      <span>Toata Biblia</span>
    </label>

    <label class="radio__label" for="ot">
      <input type="radio" id="ot" name="testament" value="ot" bind:group={formValues.testament} on:change={cleanBook} />
      <span>Vechiul testament</span>
    </label>

    <label class="radio__label" for="nt">
      <input type="radio" id="nt" name="testament" value="nt" bind:group={formValues.testament} on:change={cleanBook} />
      <span>Noul Testament</span>
    </label>

    <div class="margin-up">O carte specifica?</div>

    <div class="radio-toolbar">
      {#each visibleBook as item}
        <input type="radio" id={item} value={item} bind:group={formValues.book} />
        <label for={item}>{map[item]}</label>
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
    padding: 0 2.5rem 0 0.5rem;
    border: solid 1px #ffffff;
    background-color: var(--color-bg-dark);
    color: #ffffff;
    outline: none;
    transition: var(--transition);
    width: 100%;
  }

  input[type='text']:hover,
  input[type='text']:focus {
    border-color: var(--color-blue);
  }

  input[type='text']::placeholder {
    color: #ffffff;
  }

  .radio__label {
    align-items: center;
    display: inline-flex;
    gap: 0.5rem;
    margin-left: 1rem;

    input[type='radio'] {
      position: absolute;
      cursor: pointer;
      opacity: 0;
      + span {
        &:before {
          content: '';
          border-radius: 100%;
          border: 1px solid darken(#f4f4f4, 25%);
          display: inline-block;
          width: 1.2em;
          height: 1.2em;
          top: -0.2em;
          margin-right: 1em;
          vertical-align: top;
          cursor: pointer;
          text-align: center;
          transition: all 250ms ease;
        }
      }
      &:checked {
        + span {
          &:before {
            background-color: var(--color-blue);
            box-shadow: inset 0 0 0 4px #f4f4f4;
          }
        }
      }
      &:focus {
        + span {
          &:before {
            outline: none;
            border-color: var(--color-blue);
          }
        }
      }
      &:disabled {
        + span {
          &:before {
            box-shadow: inset 0 0 0 4px #f4f4f4;
            border-color: darken(#f4f4f4, 25%);
            background: darken(#f4f4f4, 25%);
          }
        }
      }
      + span {
        &:empty {
          &:before {
            margin-right: 0;
          }
        }
      }
    }
  }

  .margin-up {
    padding-top: 1.2rem;
  }

  label {
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

  .button__erase {
    background: var(--color-blue);
    color: var(--color-white);
    border: 0.1rem var(--border-blue);
    height: var(--button-height);
    font-family: 'Open Sans';
    font-size: 14px;
    transition: var(--transition);
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &:hover {
      background: var(--color-blue-hover);
      border-color: var(--color-blue);
      box-shadow: 0 0 4px 1px var(--color-blue);
    }
  }

  .filter-icon {
    display: flex;
    align-items: flex-end;
  }

  form {
    display: contents;
  }

  .radio-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-left: 1rem;

    label {
      background-color: var(--color-blue);
      padding: 0.3rem;
      font-size: 14px;
      border: 0.1rem var(--border-blue);
    }

    input[type='radio'] {
      opacity: 0;
      position: fixed;
      width: 0;
    }

    input[type='radio']:hover + label,
    input[type='radio']:checked + label {
      background: var(--color-blue-hover);
      border-color: var(--color-blue-hover);
      border-color: var(--color-blue);
      box-shadow: 0 0 4px 1px var(--color-blue);
    }
  }

  .icon {
    &--L {
      font-size: 32px;
    }

    &--M {
      font-size: 18px;
    }

    &--input {
      margin-left: -32px;
      font-size: 22px;
      cursor: pointer;
      color: rgb(255 255 255 / 80%);
      &:hover {
        color: #ffffff;
      }
    }
  }

  .input-search {
    display: flex;
    align-items: center;
    padding-right: 0.6rem;
  }
</style>
