<script>
  import { onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { filter } from '../../store/stores';
  import BookDrawer from './BookDrawer.svelte';

  export let map;
  export let result = [];
  export let count = 0;

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
  $: selectedBookName =
    selectedBook !== null && selectedBook !== undefined ? map[selectedBook] : $_('app.sidebar.scope.'+searchForm.testament);

  // Si el estado restaurado dice "toda la biblia" pero quedó un libro
  // seleccionado de una búsqueda anterior, limpiamos para que el radio
  // "All Bible" signifique realmente TODOS los libros.
  // (Bug antiguo: el radio mostraba "all" pero searchForm.book seguía
  // restringido a un libro específico, devolviendo 0 resultados.
  // El usuario descubría que cambiando a NT y volviendo a All funcionaba.)
  onMount(() => {
    if ($filter.testament === 'all' && Array.isArray($filter.book) && $filter.book.length > 0) {
      const cleaned = { ...$filter, book: [], chapter: [] };
      filter.set(cleaned);
    }
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
      testament: 'all',
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
      <span class="filter-text">{$_('app.sidebar.filter')}</span>
      <button class="button__erase" on:click|stopPropagation={resetForm} type="button">
        <span class="icon-delete icon--M" aria-hidden="true"></span>{$_('app.sidebar.clear_search')}
      </button>
    </div>

    <div class="divider"></div>
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
      <button class="clear-search" type="button" aria-label={$_('app.sidebar.clear_search_text')} on:click={clearInput}>
        <span class="icon-error icon--input" aria-hidden="true"></span>
      </button>
    </div>
    {#if searchForm.searchText}
      <p class="search-result-count" aria-live="polite">
        {$_('app.result.result_count_start')}
        <span>{result.length}</span>
        {$_('app.result.result_count_end', { total: count })}
      </p>
    {/if}

    <div class="margin-up">{$_('app.sidebar.search_type_label')}</div>

    <label class="radio__label" for="match">
      <input type="radio" id="match" name="searchType" value="match" bind:group={searchForm.searchType} />
      <span>{$_('app.sidebar.search_type.match')}</span>
    </label>

    <label class="radio__label" for="exact">
      <input type="radio" id="exact" name="searchType" value="every" bind:group={searchForm.searchType} />
      <span>{$_('app.sidebar.search_type.every')}</span></label
    >

    <label class="radio__label" for="any">
      <input type="radio" id="any" name="searchType" value="some" bind:group={searchForm.searchType} />
      <span>{$_('app.sidebar.search_type.some')}</span>
    </label>

    <div class="margin-up">{$_('app.sidebar.search_scope_label')}</div>

    <label class="radio__label" for="all">
      <input
        type="radio"
        id="all"
        name="testament"
        value="all"
        bind:group={searchForm.testament}
        on:change={cleanBook}
      />
      <span>{$_('app.sidebar.scope.all')}</span>
    </label>

    <label class="radio__label" for="ot">
      <input type="radio" id="ot" name="testament" value="ot" bind:group={searchForm.testament} on:change={cleanBook} />
      <span>{$_('app.sidebar.scope.ot')}</span>
    </label>

    <label class="radio__label" for="nt">
      <input type="radio" id="nt" name="testament" value="nt" bind:group={searchForm.testament} on:change={cleanBook} />
      <span>{$_('app.sidebar.scope.nt')}</span>
    </label>

    <div class="book-picker">
      <div>
        <strong>{selectedBookName}</strong>
      </div>
      <button
        type="button"
        class:book-picker__button--active={selectedBook !== null && selectedBook !== undefined}
        class="book-picker__button"
        on:click={() => (isBookDrawerOpen = true)}
      >
        {$_('app.sidebar.choose_book')}
      </button>
    </div>
  </form>
</div>

<style lang="scss">
  * {
    font-weight: 300;
  }

  div {
    color: var(--color-on-primary);
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
    background-color: var(--color-sidebar);
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
    color: var(--color-on-primary);
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

    .book-picker__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      min-height: 2.35rem;
      border: 1px solid rgb(45 150 205 / 54%);
      background: rgb(255 255 255 / 8%);
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      border-radius: 0.25rem;
      transition: var(--transition);

      &:hover,
      &:focus-visible {
        background: rgb(45 150 205 / 28%);
        border-color: var(--color-blue);
        box-shadow: 0 0 0 3px rgb(45 150 205 / 18%);
      }

      &--active {
        border-color: var(--color-blue-hover);
        background: var(--color-blue);
        color: var(--color-on-primary);
        box-shadow: 0 0 0 3px rgb(45 150 205 / 22%);
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

  .search-result-count {
    margin: 0.35rem 0 0;
    color: rgb(255 255 255 / 68%);
    font-size: 0.78rem;
    line-height: 1.35;
    text-align: right;

    span {
      color: #ffffff;
      font-weight: 600;
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
