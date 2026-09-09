<script>
  /**
   * Selector de capítulo. Uno solo para la lectura y para la comparación.
   *
   * Antes había dos, y los dos se rompían con los Salmos en un móvil:
   *
   *   - Lectura: una tira horizontal de 6903 px dentro de una ventana de 341.
   *     El capítulo activo caía fuera de la pantalla y **no se desplazaba solo
   *     hasta él**, así que abrir el Salmo 119 desde un enlace enseñaba los
   *     capítulos 1-9 y había que arrastrar unas diecinueve pantallas.
   *   - Comparación: los 150 capítulos repartidos en ~25 filas metidas en una
   *     ventana de 72 px de alto.
   *
   * Aquí es una rejilla que envuelve, con altura de unas tres filas y **el
   * capítulo activo centrado al abrir**. Los libros cortos —la mayoría— caben
   * enteros sin desplazar nada; los largos se recorren, pero empezando por
   * donde estás.
   *
   * Se centra tocando `scrollTop` del contenedor y no con `scrollIntoView`,
   * que además arrastra a los ancestros: en la lectura la barra es pegajosa y
   * mover la página al cargar es justo lo que no se quiere.
   */
  import { tick } from 'svelte';

  /** Índices de capítulo, 0. Se pasan tal cual desde los dos sitios. */
  export let chapters = [];
  /** Capítulo activo, en base 0. `null` = ninguno. */
  export let current = null;
  export let onSelect = () => {};
  export let label = '';

  let caja;

  const centrar = () => {
    if (!caja) return;
    // Se busca en el DOM en vez de guardar las referencias en un array: con
    // `bind:this={botones[i]}` el array se rellena sin reasignarse, así que el
    // bloque reactivo podía correr antes de que hubiera botones y quedarse sin
    // reintentar. Pasaba en la comparación, donde el capítulo llega de la URL.
    const activo = caja.querySelector('.capitole__btn--activo');
    if (!activo) return;
    // Sólo si de verdad hace falta: si el capítulo ya se ve, moverlo despista.
    const arriba = activo.offsetTop;
    const abajo = arriba + activo.offsetHeight;
    if (arriba >= caja.scrollTop && abajo <= caja.scrollTop + caja.clientHeight) return;
    caja.scrollTop = arriba - caja.clientHeight / 2 + activo.offsetHeight / 2;
  };

  // Al cambiar de capítulo o de libro hay que volver a centrar. `tick` porque
  // los botones del libro nuevo aún no están en el DOM cuando esto se dispara.
  $: if (caja && chapters.length && (current || current === 0)) {
    tick().then(centrar);
  }
</script>

<div class="capitole" role="group" aria-label={label} bind:this={caja}>
  {#each chapters as ch (ch)}
    <button
      type="button"
      class="capitole__btn"
      class:capitole__btn--activo={ch === current}
      aria-current={ch === current ? 'true' : undefined}
      on:click={() => onSelect(ch)}
    >
      {ch + 1}
    </button>
  {/each}
</div>

<style lang="scss">
  .capitole {
    display: grid;
    /* `position: relative` para que el `offsetTop` de los botones se mida
       contra ESTA caja. Sin ella el `offsetParent` era la cabecera pegajosa de
       la comparación y el centrado saltaba a una posición absurda. */
    position: relative;
    /* En la comparación esto va dentro de una fila flex, entre las flechas de
       capítulo anterior y siguiente. Sin `flex` la rejilla se encogía hasta UNA
       columna: 150 filas y 6480 px de alto. Con base 0 ocupa lo que sobra, y
       en la lectura —donde es un bloque normal— el `flex` se ignora. */
    flex: 1 1 0;
    min-width: 0;
    /* Se reparten solos según el ancho: ocho por fila en un móvil estrecho,
       más en escritorio. Sin número de columnas fijo no hay que mantener una
       media query por tamaño de pantalla. */
    grid-template-columns: repeat(auto-fill, minmax(2.4rem, 1fr));
    gap: 0.3rem;
    /* Unas tres filas. Los libros de hasta ~24 capítulos entran enteros; los
       largos se recorren desde el capítulo activo, que llega ya centrado. */
    max-height: 8.4rem;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    padding: 0.2rem;
    scrollbar-color: color-mix(in srgb, var(--color-accent) 45%, transparent) transparent;
  }

  .capitole__btn {
    min-width: 2.4rem;
    /* 2.4rem ≈ 38 px: por debajo del ideal de 44, pero es una rejilla densa a
       propósito y WCAG 2.5.8 pide 24. Bajar de aquí sí sería un problema. */
    min-height: 2.4rem;
    padding: 0.2rem 0.3rem;
    border: 1px solid color-mix(in srgb, var(--color-accent) 32%, transparent);
    border-radius: 0.25rem;
    background: var(--color-surface);
    color: var(--color-ink-strong);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition: var(--transition);

    &:hover,
    &:focus-visible {
      border-color: var(--color-accent);
      background: var(--wash-accent-strong);
    }

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
    }

    &--activo {
      border-color: var(--color-accent);
      /* Relleno de acento, no el acento a secas: aquí lleva texto encima y
         `--color-accent` sólo garantiza 3:1 (CLAUDE.md, sistema de diseño). */
      background: var(--color-accent-solid);
      color: var(--color-on-primary);

      &:hover,
      &:focus-visible {
        background: var(--color-accent-solid-hover);
        color: var(--color-on-primary);
      }
    }
  }
</style>
