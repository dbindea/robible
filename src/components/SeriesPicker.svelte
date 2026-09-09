<script>
  /**
   * Selector de serie (tema) de una predicación.
   *
   * Antes era un campo de texto libre y cada uno escribía la suya: «Predica de
   * pe munte», «predica de pe munte», «Pe munte» acababan siendo tres series
   * para lo mismo, y el filtro del blog público repartido entre las tres.
   *
   * Ahora propone las que ya existen —las del propio predicador, publicadas o
   * no, y las de las predicaciones públicas de los demás— y deja escribir una
   * nueva sólo si ninguna sirve. Reutilizar es lo cómodo; crear, lo
   * deliberado.
   *
   * **Sigue siendo un valor, no varios.** `series` es una columna de la tabla y
   * el blog filtra por ella; convertirlo en lista pediría otra tabla y cambiar
   * el filtro. Se dibuja como etiquetas porque se elige como una etiqueta.
   */
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { _ } from '../services/i18n.service';
  import { fetchPublicSeries } from '../services/sermons.service';
  import { sermonsStore } from '../store/sermonsStore';
  import Icon from './Icon.svelte';

  /** Serie actual. Cadena vacía = sin serie. */
  export let value = '';
  /** Se llama con el valor nuevo cada vez que cambia. */
  export let onChange = () => {};

  let sugerencias = [];
  let escribiendo = false;
  let borrador = '';
  let campo;

  const normalizar = (s) => String(s || '').trim().toLowerCase();

  /** Deja la serie en `nombre` ('' = ninguna) y lo cuenta hacia arriba. */
  const fijar = (nombre) => {
    // Una serie recién creada se añade a la lista en el momento. Si sólo se
    // guardara, el selector volvería a enseñar las de siempre y ninguna activa:
    // parecería que el botón no ha hecho nada.
    if (nombre && !sugerencias.some((s) => normalizar(s) === normalizar(nombre))) {
      sugerencias = [...sugerencias, nombre].sort((a, b) => a.localeCompare(b));
    }
    value = nombre;
    escribiendo = false;
    borrador = '';
    onChange(nombre);
  };

  /**
   * Tocar una etiqueta. Si ya estaba activa, la quita: es la única forma de
   * dejar la predicación sin serie sin tener que borrar un campo de texto.
   *
   * Crear NO pasa por aquí: escribir un nombre y darle a añadir tiene que
   * seleccionarlo siempre. Cuando compartían función, teclear el nombre de la
   * serie que ya estaba puesta la desactivaba, que es justo lo contrario de lo
   * que uno acaba de pedir.
   */
  const alternarEtiqueta = (nombre) => {
    fijar(normalizar(nombre) === normalizar(value) ? '' : nombre);
  };

  const abrirNueva = async () => {
    escribiendo = true;
    borrador = '';
    await Promise.resolve();
    campo?.focus();
  };

  const confirmarNueva = () => {
    const limpio = borrador.trim();
    if (!limpio) { escribiendo = false; return; }
    // Si ya existe con otras mayúsculas, se reutiliza la que hay en vez de
    // crear una gemela: es justo el caso que este selector viene a evitar.
    const existente = sugerencias.find((s) => normalizar(s) === normalizar(limpio));
    fijar(existente || limpio);
  };

  const alTeclear = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmarNueva(); }
    if (e.key === 'Escape') { escribiendo = false; borrador = ''; }
  };

  onMount(async () => {
    // Las propias salen de la lista que ya está en memoria: no hace falta pedir
    // nada para que el selector funcione desde la primera predicación.
    const mias = (get(sermonsStore) || []).map((s) => s?.series).filter(Boolean);
    const publicas = (await fetchPublicSeries()).map((s) => s.name).filter(Boolean);

    const vistas = new Map();
    for (const nombre of [...mias, ...publicas, value].filter(Boolean)) {
      const clave = normalizar(nombre);
      if (!vistas.has(clave)) vistas.set(clave, nombre);
    }
    sugerencias = [...vistas.values()].sort((a, b) => a.localeCompare(b));
  });
</script>

<div class="series">
  {#if sugerencias.length}
    <div class="series__etiquetas">
      {#each sugerencias as s (s)}
        <button
          type="button"
          class="series__etiqueta"
          class:series__etiqueta--activa={normalizar(s) === normalizar(value)}
          aria-pressed={normalizar(s) === normalizar(value)}
          on:click={() => alternarEtiqueta(s)}
        >
          <span aria-hidden="true">#</span>{s}
        </button>
      {/each}
    </div>
  {/if}

  {#if escribiendo}
    <div class="series__nueva">
      <input spellcheck="false"
        type="text"
        bind:this={campo}
        bind:value={borrador}
        placeholder={$_('app.sermons.series_new_placeholder')}
        on:keydown={alTeclear}
        on:blur={confirmarNueva}
      />
      <button type="button" class="series__confirmar" on:click={confirmarNueva}>
        {$_('app.sermons.series_add')}
      </button>
    </div>
  {:else}
    <button type="button" class="series__crear" on:click={abrirNueva}>
      <Icon name="pencil" size="0.8rem" />
      {sugerencias.length ? $_('app.sermons.series_new') : $_('app.sermons.series_first')}
    </button>
  {/if}
</div>

<style lang="scss">
  .series {
    display: grid;
    gap: 0.5rem;
  }

  .series__etiquetas {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .series__etiqueta {
    padding: 0.25rem 0.7rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    color: var(--color-ink-soft);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);

    /* La almohadilla es más tenue que el nombre: marca que es una etiqueta
       sin robarle protagonismo al texto. */
    span { opacity: 0.5; margin-right: 0.1rem; }

    &:hover { border-color: var(--color-accent); color: var(--color-accent-ink); }

    &--activa {
      border-color: var(--color-accent);
      background: var(--color-accent-solid);
      color: var(--color-on-primary);

      span { opacity: 0.7; }
      &:hover { background: var(--color-accent-solid-hover); color: var(--color-on-primary); }
    }
  }

  .series__crear {
    display: inline-flex;
    align-items: center;
    justify-self: start;
    gap: 0.35rem;
    padding: 0.25rem 0.7rem;
    border: 1px dashed var(--color-line-accent);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-accent-ink);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    --icon-size: 0.8rem;

    &:hover { border-style: solid; background: var(--wash-accent); }
  }

  .series__nueva {
    display: flex;
    gap: 0.4rem;

    input {
      flex: 1;
      min-width: 0;
      padding: 0.4rem 0.6rem;
      border: 1px solid var(--color-accent);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
      font-size: var(--font-size-small);

      &:focus-visible { outline: none; }
    }
  }

  .series__confirmar {
    flex: 0 0 auto;
    padding: 0.4rem 0.85rem;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-sm);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    font: inherit;
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;
  }
</style>
