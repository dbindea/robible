<script>
  import { filter } from '../../store/stores';
  import { copy } from 'svelte-copy';
  import { toast } from '@zerodevx/svelte-toast';
  import { getFilterResult, replaceDiacritics } from '../../services/filter.service';
  import { onMount } from 'svelte/internal';

  export let bible;
  export let map;

  let chapterForm = {
    chapter: [],
  };

  let chapterArray = [];

  $: result = [];
  $: count = 0;
  $: keywords = '';
  $: searchForm = {};

  $: {
    searchForm.testament, (chapterArray = []);
  }

  $: {
    searchForm.book, generateChapter();
  }

  function generateChapter() {
    if (Array.isArray(searchForm.book) && searchForm.book.length) {
      chapterArray = Array.from(Array(bible[searchForm.book[0]].length).keys());
    }
  }

  onMount(() => {
    filter.subscribe((form) => {
      keywords = form.searchText;
      result = getFilterResult(bible, map, form);
      count = result.length;
      result = [...result.slice(0, 200)];
      searchForm = form;
    });
  });

  const updateChapterForm = () => {
    searchForm.chapter = [chapterForm.chapter];
    filter.update(() => searchForm);
  };

  function markText(text, keywords) {
    switch (searchForm.searchType) {
      case 'match':
        if (keywords && keywords.length > 2) {
          const index = replaceDiacritics(text).toLowerCase().indexOf(replaceDiacritics(keywords).toLowerCase());
          const size = keywords.length;
          const fragment = text.substr(index, size);
          text = text.replace(fragment, `<span class='marked-key'>${fragment}</span>`);
        }
        break;

      case 'every':
      case 'some':
        if (keywords && keywords.length > 2) {
          const keywordsArray = keywords.split(/[ ,.-]+/).map((word) => replaceDiacritics(word));
          keywordsArray.forEach((word) => {
            const index = replaceDiacritics(text).toLowerCase().indexOf(replaceDiacritics(word).toLowerCase());
            const size = word.length;
            const fragment = text.substr(index, size);
            text = text.replace(fragment, `<span class='marked-key'>${fragment}</span>`);
          });
        }
        break;
    }
    return text;
  }
</script>

{#if !searchForm.searchText && chapterArray.length}
  <div class="radio-toolbar sticky">
    <form on:change|preventDefault={updateChapterForm}>
      {#each chapterArray as item}
        <input type="radio" id={`ch_ ${item}`} value={item} bind:group={chapterForm.chapter} />
        <label for={`ch_ ${item}`}>{Number(item + 1)}</label>
      {/each}
    </form>
  </div>
{/if}

<div class="result">
  <p>Se afiseaza <span class="count">{result.length}</span> rezultate din {count}</p>

  {#each result as item}
    <div class="verse">
      <p>
        <span class="verse-index">{item.index}.</span>
        {@html markText(item.text, keywords)}
        <span
          title="Click pentru a copia versetul"
          class="reference"
          use:copy={`[${map[item.book]} ${item.chapter}:${item.index}] ${item.text}`}
          on:click={() => toast.push('Verset copiat!')}
        >
          ({map[item.book]}
          {item.chapter}:{item.index})
        </span>
      </p>
    </div>
    <div class="divider div-transparent div-dot" />
  {/each}
</div>

<style type="scss">
  .result {
    padding: 2rem 6rem 4rem;
    background-color: var(--color-white);
    flex-direction: column;

    border-radius: 0.3rem;
    box-shadow: var(--box-shadow-up);
    border-top: 0.3rem var(--border-blue);
    border-bottom: 0.3rem var(--border-blue);
    margin: auto;
    margin-top: 2rem;
  }

  .divider {
    position: relative;
  }

  .div-transparent:before {
    content: '';
    position: absolute;
    top: 0;
    left: 5%;
    right: 5%;
    width: 90%;
    height: 1px;
    background-color: var(--color-bg-dark);
    box-shadow: var(--box-shadow-up);
  }

  .div-dot:after {
    content: '';
    position: absolute;
    top: -5px;
    left: calc(50% - 9px);
    width: 0.5rem;
    height: 0.5rem;
    background-color: var(--color-bg-dark);
    border: 1px solid var(--color-bg-dark);
    box-shadow: inset 0 0 0 2px white, 0 0 0 4px white;
  }

  .verse {
    padding: 0.5rem 2rem;
    &-index {
      font-size: 14px;
      font-weight: 600;
    }
  }

  .options {
    align-items: center;
    margin-left: 5rem;
  }

  .reference {
    font-weight: 600;
    font-size: 14px;
    font-style: italic;
    cursor: pointer;
    color: var(--color-link);
  }

  .count {
    font-weight: 700;
  }
  form {
    display: contents;
  }
  .radio-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 3rem 2rem;
    background-color: var(--color-bg-light);
    margin: 0 -1rem 0;
    z-index: 1;
    box-shadow: var(--box-shadow-up);

    label {
      background-color: var(--color-blue);
      padding: 0.2rem 0.4rem;
      font-size: 14px;
      border: 0.1rem var(--border-blue);
      color: #ffffff;
      cursor: pointer;
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
    }
  }

  :root {
    --toastBackground: var(--color-bg-light);
    --toastBarBackground: var(--color-blue);
  }
</style>
