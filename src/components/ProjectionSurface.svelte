<script>
  /**
   * La lámina que ve la congregación. Nada más.
   *
   * Se extrajo de `Projection.svelte` el 16 sep 2026 porque ahora la pintan
   * DOS ventanas: la del operador (proyección en una sola pantalla) y la que
   * se manda al proyector (`/proiectie?ecran=1`). Con el marcado duplicado,
   * un cambio de tamaño o de color en una habría dejado las dos pantallas
   * distintas sin que nadie lo notara hasta el culto.
   *
   * No sabe nada de Biblias, de búsquedas ni de canales: recibe el texto ya
   * resuelto y lo pinta. Los controles, las zonas táctiles y los paneles se
   * pasan por el slot, porque sólo existen en la ventana del operador.
   *
   * Colores propios y no los de la paleta activa: la pantalla de una iglesia
   * los necesita tenga el operador puesta Sepia, Lumină o Nocturn. Cada fondo
   * trae su `ink` y su `accent` ya comprobados contra él.
   */
  import { fade, fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { backgroundCss, getBackground } from '../services/verse-image.service';

  /** `{ texto, referencia }` — lo que va grande, arriba. */
  export let principal = { texto: '', referencia: '' };
  /** `{ texto, referencia }` — el segundo idioma, más pequeño. Puede ir vacío. */
  export let secundario = { texto: '', referencia: '' };
  /** Clave del fondo (`IMAGE_BACKGROUNDS`). */
  export let fondoKey = 'night';
  export let escala = 1;
  /** 'none' | 'fade' | 'slide' | 'zoom' */
  export let animacion = 'fade';
  /** Cambiarlo vuelve a montar la lámina, que es lo que dispara la animación. */
  export let indice = 0;
  export let enNegro = false;

  $: fondo = getBackground(fondoKey);
  $: fondoCss = backgroundCss(fondo);

  /**
   * Una sola transición para las cuatro opciones, elegida en tiempo de
   * ejecución. Antes había un `in:fade` en la lámina y otro `in:fly`/`in:scale`
   * en un `<div>` interior según el ajuste; con una sola función no hay dos
   * capas que puedan discrepar.
   *
   * **Tiene que usarse con `|global`.** En Svelte las transiciones son locales
   * por defecto, y «local» significa que NO se reproducen cuando quien crea el
   * elemento es un bloque contenedor — que es justo el caso: lo recrea el
   * `{#key indice}` al cambiar de versículo. El síntoma era exacto: animaba el
   * primer versículo (montaje) y ninguno de los siguientes.
   */
  const animarEntrada = (node, { tipo }) => {
    switch (tipo) {
      case 'fade':
        return fade(node, { duration: 260, easing: cubicOut });
      // Sube un poco al entrar: leído de lejos, el movimiento vertical se nota
      // más que el horizontal y no arrastra la vista fuera de la pantalla.
      case 'slide':
        return fly(node, { y: 34, duration: 320, easing: cubicOut });
      case 'zoom':
        return scale(node, { start: 0.94, duration: 300, easing: cubicOut, opacity: 0 });
      default:
        return { duration: 0 };
    }
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="proyeccion"
  class:proyeccion--negro={enNegro}
  style="--escala: {escala}; --fondo: {fondoCss}; --tinta: {fondo.ink}; --acento: {fondo.accent}"
  on:mousemove
  on:touchstart
  on:wheel
>
  {#if !enNegro && principal.texto}
    <!-- `{#key}` vuelve a montar la lámina en cada versículo, que es lo que
         dispara la transición de entrada. Sin él, Svelte reutiliza el nodo y
         el texto cambia de golpe. -->
    {#key indice}
      <figure class="lamina" class:lamina--dos={!!secundario.texto} in:animarEntrada|global={{ tipo: animacion }}>
        <blockquote class="lamina__texto">{principal.texto}</blockquote>

        {#if secundario.texto}
          <blockquote class="lamina__texto lamina__texto--secundario">{secundario.texto}</blockquote>
        {/if}

        <!-- Sólo la referencia. El nombre de la versión no pinta nada en una
             pantalla de iglesia: la congregación sabe qué Biblia se usa, y
             ocupaba sitio al lado de lo único que de verdad hay que leer ahí.
             Sigue estando en la antesala, donde se elige. -->
        <figcaption class="lamina__ref">{principal.referencia}</figcaption>
      </figure>
    {/key}
  {/if}

  <!-- Controles, zonas táctiles y paneles: sólo los pone la ventana del
       operador. La que va al proyector no lleva ni uno. -->
  <slot />

  <!-- Marca de agua. La aplicación es gratuita y esto es toda su publicidad:
       quien vea el versículo en la pantalla de la iglesia sabe de dónde sale.
       Va tenue a propósito —compite con el texto si se nota demasiado— y
       desaparece con la pantalla en negro, que existe justamente para que no
       se vea nada. -->
  {#if !enNegro}
    <p class="marca" aria-hidden="true">robible.com</p>
  {/if}
</div>

<style lang="scss">
  .proyeccion {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: clamp(1.5rem, 5vw, 4rem);
    background: var(--fondo, #0b0d10);
    color: var(--tinta, #f2f4f7);
    cursor: default;
  }

  // Negro de verdad: es el «apaga la pantalla» de entre canto y canto, así que
  // ignora el fondo elegido a propósito.
  .proyeccion--negro {
    background: #000;
  }

  .lamina {
    max-width: 90vw;
    margin: 0;
    text-align: center;
  }

  // El tamaño se calcula con `vw` y `vh` a la vez: sólo con `vw`, un televisor
  // panorámico daba letras enormes que no cabían a lo alto, y sólo con `vh`
  // quedaban pequeñas en una pantalla ancha. `--escala` es el ajuste manual.
  .lamina__texto {
    margin: 0 0 clamp(1rem, 3vh, 2.5rem);
    font-size: calc(clamp(1.75rem, 4.2vw + 1.2vh, 5.5rem) * var(--escala, 1));
    font-weight: 600;
    line-height: 1.3;
    text-wrap: balance;
  }

  // Con dos idiomas hay que repartir el alto de la pantalla entre los dos, así
  // que el principal se encoge. Sin esto, un versículo largo en dos idiomas
  // —Ioan 3:2, por ejemplo— llenaba la pantalla de borde a borde y el operador
  // tenía que bajar el tamaño a mano justo cuando menos tiempo tiene.
  .lamina--dos .lamina__texto {
    font-size: calc(clamp(1.4rem, 3.1vw + 0.9vh, 4rem) * var(--escala, 1));
    margin-bottom: clamp(0.75rem, 2vh, 1.5rem);
  }

  // El segundo idioma: más pequeño, debajo y con menos peso. La proporción
  // (58 %) es la que deja leer los dos sin que compitan — al 80 % parecían dos
  // textos principales y la vista no sabía dónde posarse.
  .lamina--dos .lamina__texto--secundario {
    font-size: calc(clamp(0.95rem, 1.9vw + 0.55vh, 2.5rem) * var(--escala, 1));
  }

  .lamina__texto--secundario {
    font-size: calc(clamp(1.1rem, 2.4vw + 0.7vh, 3.2rem) * var(--escala, 1));
    font-weight: 400;
    opacity: 0.86;
  }

  .lamina__ref {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 0.6rem;
    color: var(--acento, #f0c674);
    font-size: calc(clamp(1rem, 1.4vw + 0.6vh, 2rem) * var(--escala, 1));
    font-weight: 700;
  }

  // ── Marca de agua ─────────────────────────────────────────────────────────
  //
  // Hereda la tinta del fondo elegido, así que se lee sobre los nueve sin
  // comprobarlo a mano. Al 38 %: suficiente para reconocerla de cerca, poco
  // para que compita con el versículo desde la última fila.
  .marca {
    position: absolute;
    right: 1rem;
    bottom: 0.9rem;
    margin: 0;
    color: var(--tinta, #f2f4f7);
    opacity: 0.38;
    font-size: clamp(0.7rem, 0.9vw, 1rem);
    font-weight: 600;
    letter-spacing: 0.03em;
    // No recibe clics: está justo donde la mitad derecha avanza de versículo.
    pointer-events: none;
    transition: opacity var(--motion-base, 200ms) ease;
  }

  // Con los controles a la vista, la marca se aparta: comparten esquina y
  // superpuestas no se entiende ninguna de las dos. `:global` porque los
  // controles llegan por el slot y los pinta el padre, así que el scoping de
  // Svelte no los ve al compilar (CLAUDE.md, trampa 21).
  .proyeccion:has(:global(.controles):not(:global(.controles--ocultos))) .marca {
    opacity: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .marca {
      transition: none;
    }
  }
</style>
