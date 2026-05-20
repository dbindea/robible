<script>
  import { onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { filter } from '../../store/stores';
  import BookDrawer from './BookDrawer.svelte';

  export let map;

  let searchForm = {
    searchText: null,
    searchType: 'match',
    testament: 'all',
    book: [],
    chapter: [],
  };

  let searchTextInput;
  let isBookDrawerOpen = false;

  $: searchForm = $filter;
  $: selectedBook = Array.isArray(searchForm.book) ? searchForm.book[0] : null;
  $: selectedBookName = selectedBook !== null && selectedBook !== undefined ? map[selectedBook] : 'Toata Biblia';

  onMount(() => {
    if (window.matchMedia('(min-width: 58rem)').matches) {
      searchTextInput?.focus();
    }
  });

  const updateFilter = (form) => {
    const nextForm = {
      ...form,
      chapter: [],
      book: Array.isArray(form.book) ? form.book : [form.book],
    };
    searchForm = nextForm;
    filter.set(nextForm);
  };

  const resetForm = () => {
    searchForm = {
      searchText: null,
      searchType: 'match',
      testament: 'all',
      book: [],
      chapter: [],
    };
    updateFilter(searchForm);
  };

  const selectBook = (bookId) => {
    searchForm = {
      ...searchForm,
      searchText: null,
      testament: Number(bookId) < 39 ? 'ot' : 'nt',
      book: [bookId],
      chapter: [],
    };
    filter.set({ ...searchForm });
  };

  const cleanBook = () => {
    searchForm.book = [];
    searchForm.chapter = [];
    updateFilter(searchForm);
  };

  const clearInput = () => {
    searchForm.searchText = null;
    updateFilter(searchForm);
  };
</script>

<BookDrawer
  open={isBookDrawerOpen}
  {map}
  {selectedBook}
  onClose={() => (isBookDrawerOpen = false)}
  onSelect={selectBook}
/>

<div class="sidebar sticky">
  <form
    on:change|stopPropagation={() => updateFilter(searchForm)}
    on:input|stopPropagation={() => updateFilter(searchForm)}
  >
    <div class="block-erase">
      <span class="filter-text">Filtru</span>
      <button class="button__erase" on:click|stopPropagation={resetForm} type="button">
        <span class="icon-delete icon--M" aria-hidden="true"></span>Sterge Cautarea
      </button>
    </div>

    <div class="divider"></div>
    <!-- <label for="searchText">Cauta dupa cuvintele...</label> -->
    <div class="input-search">
      <input
        id="searchText"
        type="text"
        autocomplete="off"
        spellcheck="false"
        bind:value={searchForm.searchText}
        placeholder={$_('app.sidebar.form.search_placeholder')}
        bind:this={searchTextInput}
      />
      <button class="clear-search" type="button" aria-label="Sterge textul cautarii" on:click={clearInput}>
        <span class="icon-error icon--input" aria-hidden="true"></span>
      </button>
    </div>

    <div class="margin-up">Cum se face cautarea?</div>

    <label class="radio__label" for="match">
      <input type="radio" id="match" name="searchType" value="match" bind:group={searchForm.searchType} />
      <span>Contine expresia</span>
    </label>

    <label class="radio__label" for="exact">
      <input type="radio" id="exact" name="searchType" value="every" bind:group={searchForm.searchType} />
      <span>Contine cuvintele</span></label
    >

    <label class="radio__label" for="any">
      <input type="radio" id="any" name="searchType" value="some" bind:group={searchForm.searchType} />
      <span>Oricare cuvant</span>
    </label>

    <div class="margin-up">Unde se face cautarea?</div>

    <label class="radio__label" for="all">
      <input
        type="radio"
        id="all"
        name="testament"
        value="all"
        bind:group={searchForm.testament}
        on:change={cleanBook}
      />
      <span>Toata Biblia</span>
    </label>

    <label class="radio__label" for="ot">
      <input type="radio" id="ot" name="testament" value="ot" bind:group={searchForm.testament} on:change={cleanBook} />
      <span>Vechiul testament</span>
    </label>

    <label class="radio__label" for="nt">
      <input type="radio" id="nt" name="testament" value="nt" bind:group={searchForm.testament} on:change={cleanBook} />
      <span>Noul Testament</span>
    </label>

    <div class="book-picker">
      <div>
        <span>Cartea selectata</span>
        <strong>{selectedBookName}</strong>
      </div>
      <button type="button" on:click={() => (isBookDrawerOpen = true)}> Alege cartea </button>
    </div>
  </form>
</div>

<style lang="scss">
  * {
    font-weight: 300;
  }

  div {
    color: var(--color-white);
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    max-height: 100dvh;
    overflow-y: auto;
    padding: 2rem;
    scrollbar-color: rgb(255 255 255 / 35%) transparent;
  }

  input[type='text'] {
    height: var(--input-height);
    padding: 0 2.5rem 0 0.5rem;
    border: solid 1px #7c8990;
    background-color: var(--color-bg-dark);
    color: #ffffff;
    outline: none;
    transition: var(--transition);
    width: 100%;
    min-width: 0;
    border-radius: 0.25rem;
  }

  input[type='text']:hover,
  input[type='text']:focus {
    border-color: var(--color-blue);
  }

  input[type='text']::placeholder {
    color: rgb(255 255 255 / 72%);
  }

  .radio__label {
    align-items: center;
    display: inline-flex;
    gap: 0.5rem;
    margin-left: 1rem;
    line-height: 1.45;

    input[type='radio'] {
      position: absolute;
      cursor: pointer;
      opacity: 0;
      + span {
        &:before {
          content: '';
          border-radius: 100%;
          border: 1px solid #b4b4b4;
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
            outline: 2px solid rgb(255 255 255 / 70%);
            outline-offset: 2px;
            border-color: var(--color-blue);
          }
        }
      }
      &:disabled {
        + span {
          &:before {
            box-shadow: inset 0 0 0 4px #f4f4f4;
            border-color: #b4b4b4;
            background: #b4b4b4;
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
    padding-top: 0.5em;
  }

  label {
    cursor: pointer;
    display: block;
    margin-bottom: 0.2rem;
    color: rgb(255 255 255 / 74%);
    font-size: 1rem;
  }

  .divider {
    border-top: 0.05rem var(--border-gray);
    margin-top: 0.5rem;
    margin-bottom: 1rem;
  }

  .block-erase {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    align-items: center;
  }

  .button__erase {
    background-color: var(--color-blue);
    color: var(--color-white);
    border: 0.1rem var(--border-blue);
    height: var(--button-height);
    font-size: 14px;
    transition: var(--transition);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 0.25rem;
    min-width: max-content;

    &:hover {
      background: var(--color-blue-hover);
      border-color: var(--color-blue);
      box-shadow: 0 0 4px 1px var(--color-blue);
    }

    &:focus-visible {
      outline: 2px solid rgb(255 255 255 / 75%);
      outline-offset: 2px;
    }
  }

  form {
    display: contents;
  }

  .book-picker {
    display: grid;
    gap: 0.75rem;
    border: 1px solid rgb(255 255 255 / 28%);
    border-radius: 0.5rem;
    padding: 0.9rem;
    background-color: rgb(255 255 255 / 7%);

    span {
      display: block;
      margin-bottom: 0.2rem;
      color: rgb(255 255 255 / 74%);
      font-size: 1rem;
    }

    strong {
      display: block;
      color: #ffffff;
      font-size: 1rem;
      font-weight: 700;
      line-height: 1.3;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      min-height: var(--button-height);
      border: 1px solid var(--color-blue);
      border: 0.1rem var(--border-blue);
      background-color: var(--color-blue);
      color: var(--color-white);
      transition: var(--transition);

      background-color: var(--color-blue);
      color: var(--color-white);

      height: var(--button-height);
      font-size: 14px;
      transition: var(--transition);
      border-radius: 0.25rem;

      &:hover {
        background-color: var(--color-blue-hover);
        border-color: var(--color-blue);
        box-shadow: 0 0 4px 1px var(--color-blue);
      }

      &:focus-visible {
        background-color: var(--color-blue-hover);
        box-shadow: 0 0 0 3px rgb(255 255 255 / 18%);
      }
    }
  }

  .icon {
    &--M {
      font-size: 18px;
    }

    &--input {
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
    position: relative;
  }

  .clear-search {
    display: grid;
    place-items: center;
    position: absolute;
    right: 0.35rem;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 0;
    background: transparent;

    &:focus-visible {
      outline: 2px solid rgb(255 255 255 / 75%);
      outline-offset: 2px;
    }
  }

  .filter-text {
    display: inline-flex;
    align-items: flex-end;
    font-weight: 600;
    font-size: 1.1rem;
  }

  @media (max-width: 58rem) {
    .sidebar {
      max-height: none;
      padding: 1.25rem;
    }

    .block-erase {
      flex-wrap: wrap;
    }

    .radio__label {
      margin-left: 0.25rem;
    }
  }
</style>
