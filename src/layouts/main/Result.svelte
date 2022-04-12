<script>
  import { filter } from '../../store/stores';
  import { getFilterResult } from '../../services/filter.service';
  import { onMount } from 'svelte/internal';

  export let bible;
  export let map;

  $: result = [];
  $: keywords = '';
  $: time = 0;

  onMount(() => {
    filter.subscribe((form) => {
      const snapshot = new Date();
      keywords = form.searchText;
      result = getFilterResult(bible, map, form);
      time = new Date().getMilliseconds() - snapshot.getMilliseconds();
    });
  })


  function markText(text, keywords) {
    let regex = new RegExp(keywords, 'i');
    if (regex.test(text)) {
      let result = text.match(regex);
      result.forEach((e) => {
        text = text.replace(e, `<span class='marked-key'>${e}</span>`);
      });
      return text;
    } else {
      return text;
    }
  }
</script>

<div class="result">
  <p>S-au gasit <span class="count">{result.length}</span> rezultate <span>in {time} milisecunde</span></p>

  {#each result as item}
    <div class="verse">
      <p class="verse__text">
        {@html markText(item.text, keywords)} <span class="reference">({map[item.book]} {item.chapter}:{item.verse})</span>
      </p>
      <div class="options">
        <!-- <span><img src="assets/img/filter.png" alt="" /> Copiar</span> -->
      </div>
    </div>
    <div class="divider div-transparent div-dot" />
  {/each}
</div>

<style style="scss">
  .result {
    padding: 2rem 6rem 4rem;
    background-color: var(--color-white);
    flex-direction: column;

    border-radius: 0.3rem;
    box-shadow: var(--box-shadow-up);
    border-top: 0.3rem var(--border-blue);
    border-bottom: 0.3rem var(--border-blue);
    margin: auto;
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
    background-image: linear-gradient(to right, transparent, rgb(48, 49, 51), transparent);
  }

  .div-dot:after {
    content: '';
    position: absolute;
    z-index: 1;
    top: -5px;
    left: calc(50% - 9px);
    width: 0.5rem;
    height: 0.5rem;
    background-color: var(--color-bg-dark);
    border: 1px solid var(--color-bg-dark);
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px white, 0 0 0 4px white;
  }

  .verse {
    padding: 0.5rem 2rem;
  }

  .verse__text {
    max-width: 40rem;
  }

  .options {
    align-items: center;
    margin-left: 5rem;
  }

  .reference {
    font-weight: 600;
    font-size: 14px;
    font-style: italic;
  }

  .count {
    font-weight: 700;
  }
</style>
