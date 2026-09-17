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
  // La clave del fondo animado, si lo es: 'nebula', 'water', 'clouds' o
  // 'mist'. Enciende la capa de abajo; el resto de fondos no tienen ninguna y
  // no pagan nada por ello.
  $: animado = fondo?.animado || '';

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
<!-- Una directiva `class:` por fondo animado, y no `proyeccion--{animado}`: con
     el nombre construido, Svelte no ve estas clases escritas en la plantilla y
     poda sus estilos como CSS muerto (CLAUDE.md, trampa 21). Al añadir un fondo
     animado hay que añadir aquí su línea. -->
<div
  class="proyeccion"
  class:proyeccion--negro={enNegro}
  class:proyeccion--nebula={animado === 'nebula' && !enNegro}
  class:proyeccion--water={animado === 'water' && !enNegro}
  class:proyeccion--clouds={animado === 'clouds' && !enNegro}
  class:proyeccion--mist={animado === 'mist' && !enNegro}
  style="--escala: {escala}; --fondo: {fondoCss}; --tinta: {fondo.ink}; --acento: {fondo.accent}"
  on:mousemove
  on:touchstart
  on:touchend
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
          <!-- El mismo filete corto y centrado que lleva la imagen para
               compartir encima de la referencia. Aquí separa los dos idiomas:
               pegados, y con el segundo ya bastante más pequeño, se leían como
               un solo párrafo que cambia de letra a media frase. -->
          <hr class="lamina__filete" />
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

  /* ── Los fondos que se mueven ───────────────────────────────────────────
     Van en una capa aparte (`::before`) y no en el `background` del div: el
     fondo estático tiene que seguir siendo el mismo que pinta el canvas de la
     imagen compartida y que la muestra del selector, así que el movimiento se
     añade ENCIMA en vez de sustituirlo.

     Los ciclos van de 13 a 110 segundos según el motivo: unas olas se mueven
     deprisa y unas nubes no. Empezaron todos en 90-120 —«que no se note»— y
     eso resultó ser demasiado: **un versículo está en pantalla entre
     cinco y diez segundos**, así que en todo el tiempo que alguien mira la
     diapositiva el fondo recorría un 5 % de su ciclo y parecía una imagen
     fija. Si se va a mover, tiene que moverse lo bastante para que se aprecie
     dentro de esa ventana; lo que no puede es cambiar de ritmo ni dar saltos,
     que es lo que roba la atención de verdad. */
  .proyeccion--nebula::before,
  .proyeccion--water::before,
  .proyeccion--clouds::before,
  .proyeccion--mist::before {
    content: '';
    position: absolute;
    // Se sale del marco por los cuatro lados para que al desplazarse no asome
    // ningún borde de la capa.
    inset: -25%;
    pointer-events: none;
    will-change: transform;
  }

  .proyeccion--nebula::before {
    background:
      radial-gradient(ellipse 38% 30% at 26% 32%, rgba(108, 92, 224, 0.4) 0%, rgba(0, 0, 0, 0) 68%),
      radial-gradient(ellipse 34% 26% at 74% 64%, rgba(46, 134, 216, 0.32) 0%, rgba(0, 0, 0, 0) 68%),
      radial-gradient(ellipse 28% 22% at 56% 16%, rgba(180, 85, 200, 0.26) 0%, rgba(0, 0, 0, 0) 68%);
    animation: nebulosa 18s ease-in-out infinite alternate;
  }

  /* Las estrellas, en su propia capa y QUIETAS: el pintor del canvas las
     dibuja, así que sin ellas la imagen compartida y la proyección no eran el
     mismo fondo. Van aparte de las nubes para que no se estiren con su escala
     —unas estrellas que crecen delatan el truco— y sin parpadeo, que es
     precisamente el tipo de movimiento que roba la vista mientras se lee.
     Son posiciones fijas y no una trama repetida: repetida se ve la rejilla. */
  .proyeccion--nebula::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      radial-gradient(1.5px 1.5px at 12% 18%, rgba(244, 247, 255, 0.75), transparent),
      radial-gradient(1px 1px at 27% 61%, rgba(244, 247, 255, 0.55), transparent),
      radial-gradient(1.5px 1.5px at 41% 12%, rgba(244, 247, 255, 0.65), transparent),
      radial-gradient(1px 1px at 56% 78%, rgba(244, 247, 255, 0.5), transparent),
      radial-gradient(2px 2px at 68% 26%, rgba(244, 247, 255, 0.8), transparent),
      radial-gradient(1px 1px at 79% 55%, rgba(244, 247, 255, 0.45), transparent),
      radial-gradient(1.5px 1.5px at 88% 84%, rgba(244, 247, 255, 0.6), transparent),
      radial-gradient(1px 1px at 33% 88%, rgba(244, 247, 255, 0.5), transparent),
      radial-gradient(1px 1px at 63% 8%, rgba(244, 247, 255, 0.55), transparent),
      radial-gradient(1.5px 1.5px at 8% 72%, rgba(244, 247, 255, 0.5), transparent),
      radial-gradient(1px 1px at 94% 34%, rgba(244, 247, 255, 0.45), transparent),
      radial-gradient(1px 1px at 47% 44%, rgba(244, 247, 255, 0.4), transparent);
  }

  /* ── Agua ─────────────────────────────────────────────────────────────
     Crestas de ola, no bandas de luz: las bandas se leían como un degradado a
     rayas. Cada fila es un círculo transparente hasta el 66 % del radio y con
     color a partir de ahí, repetido en horizontal — eso deja exactamente el
     arco de una ola.

     El bucle es SIN COSTURA porque cada capa se desplaza justo el ancho de una
     baldosa (`background-size`) y vuelve a empezar donde estaba. Si se cambia
     un `background-size` hay que cambiar su `@keyframes`, o el mar da un salto
     cada vuelta. */
  /* Una onda DE VERDAD, dibujada con una curva en un SVG embebido. El primer
     intento las hacía con `radial-gradient` recortado y el resultado era una
     fila de arcos de medio punto: parecía un acueducto, no el mar. Un círculo
     no es una ola por mucho que se recorte; una senoide sí.

     Tres detalles que costaron una vuelta cada uno:

     - Las capas se anclan ABAJO (`background-position: 0 100%`) y la baldosa es
       mucho más alta que la ola. Con baldosas bajas, el relleno terminaba en el
       borde inferior de la baldosa y dejaba una raya horizontal recta cruzando
       la pantalla debajo de cada fila de olas.
     - Por eso el desbordamiento de esta capa es sólo LATERAL (`inset: 0 -30%`):
       el movimiento es horizontal, y desbordando también por abajo el anclaje
       se iba fuera de la pantalla y las olas desaparecían.
     - `preserveAspectRatio='none'` es lo que deja estirar la baldosa a lo alto
       sin que la ola se haga enorme: la curva se deforma con ella. */
  .proyeccion--water::before,
  .proyeccion--water::after {
    inset: 0 -30%;
  }

  .proyeccion--water::before {
    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 60' preserveAspectRatio='none'%3E%3Cpath d='M0 12 Q 15 3 30 12 T 60 12 T 90 12 T 120 12 V60 H0 Z' fill='%235FD4E4' fill-opacity='.20'/%3E%3C/svg%3E"),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 60' preserveAspectRatio='none'%3E%3Cpath d='M0 10 Q 30 2 60 10 T 120 10 V60 H0 Z' fill='%235FD4E4' fill-opacity='.12'/%3E%3C/svg%3E");
    background-size:
      260px 300px,
      260px 430px;
    background-repeat: repeat-x, repeat-x;
    background-position:
      0 100%,
      0 100%;
    animation: olas-cerca 13s linear infinite;
  }

  /* La fila de fondo, más ancha y en sentido contrario: dos capas cruzándose
     es lo que hace que parezca agua y no un friso que se desliza. */
  .proyeccion--water::after {
    content: '';
    position: absolute;
    inset: -25%;
    pointer-events: none;
    will-change: transform;
    // Dos crestas y no una: con una sola curva a lo ancho de toda la baldosa el
    // borde quedaba casi recto y se leía como una regla cruzando la pantalla.
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 60' preserveAspectRatio='none'%3E%3Cpath d='M0 9 Q 30 1 60 9 T 120 9 V60 H0 Z' fill='%235FD4E4' fill-opacity='.08'/%3E%3C/svg%3E");
    background-size: 520px 560px;
    background-repeat: repeat-x;
    background-position: 0 100%;
    animation: olas-lejos 23s linear infinite;
  }

  // El desplazamiento es EXACTAMENTE el ancho de una baldosa, así que el bucle
  // no tiene costura: acaba donde empezó. Si se cambia un `background-size`,
  // hay que cambiar aquí el mismo número o el mar dará un salto cada vuelta.
  @keyframes olas-cerca {
    to {
      transform: translate3d(-260px, 0, 0);
    }
  }

  @keyframes olas-lejos {
    to {
      transform: translate3d(520px, 0, 0);
    }
  }

  /* ── Nubes ────────────────────────────────────────────────────────────
     Un cielo despejado. Se desplazan en porcentaje y no en píxeles: la baldosa
     mide el 50 % del ancho de la capa, así que moverse un 50 % la deja
     exactamente donde estaba, quepa lo que quepa en la pantalla. */
  /* Cada nube son CUATRO lóbulos solapados con la base más plana que la
     cúspide, no una mancha redonda: con un solo degradado por nube parecían
     pompas de jabón flotando. Las cuatro capas comparten `background-size`,
     `repeat` y `position`, así que sus baldosas caen alineadas y los lóbulos
     se juntan siempre formando la misma nube. */
  .proyeccion--clouds::before {
    background-image:
      radial-gradient(ellipse 13% 15% at 30% 60%, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0) 62%),
      radial-gradient(ellipse 17% 21% at 46% 44%, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0) 62%),
      radial-gradient(ellipse 14% 16% at 62% 54%, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0) 62%),
      radial-gradient(ellipse 24% 9% at 46% 68%, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0) 66%);
    background-size: 50% 46%;
    background-repeat: repeat-x;
    background-position: 0 14%;
    animation: nubes-altas 70s linear infinite;
  }

  /* Las de abajo, más pequeñas y más lentas: es la parte que da la sensación
     de distancia. */
  .proyeccion--clouds::after {
    content: '';
    position: absolute;
    inset: -25%;
    pointer-events: none;
    will-change: transform;
    background-image:
      radial-gradient(ellipse 12% 14% at 38% 56%, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0) 64%),
      radial-gradient(ellipse 15% 18% at 54% 44%, rgba(255, 255, 255, 0.66) 0%, rgba(255, 255, 255, 0) 64%),
      radial-gradient(ellipse 20% 8% at 50% 64%, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 68%);
    background-size: 40% 34%;
    background-repeat: repeat-x;
    background-position: 0 66%;
    animation: nubes-bajas 110s linear infinite;
  }

  @keyframes nubes-altas {
    to {
      transform: translate3d(-50%, 0, 0);
    }
  }

  @keyframes nubes-bajas {
    to {
      transform: translate3d(-40%, 0, 0);
    }
  }

  /* ── Vapor ────────────────────────────────────────────────────────────
     Jirones que suben desde el campo. La máscara es lo que lo convierte en
     vapor y no en niebla uniforme: denso abajo, deshecho arriba. Donde no haya
     soporte de máscara se ve parejo, que sigue siendo aceptable. */
  .proyeccion--mist::before {
    background-image:
      radial-gradient(ellipse 60% 5% at 38% 50%, rgba(255, 255, 255, 0.34) 0%, rgba(255, 255, 255, 0) 70%),
      radial-gradient(ellipse 70% 4% at 66% 82%, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0) 70%);
    background-size: 100% 30%;
    background-repeat: repeat-y;
    -webkit-mask-image: linear-gradient(to top, #000 12%, rgba(0, 0, 0, 0.45) 45%, transparent 88%);
    mask-image: linear-gradient(to top, #000 12%, rgba(0, 0, 0, 0.45) 45%, transparent 88%);
    animation: vapor 26s linear infinite;
  }

  @keyframes vapor {
    to {
      transform: translate3d(0, -30%, 0);
    }
  }

  // Deriva y un punto de escala: las nubes se separan y se juntan sin llegar a
  // cruzarse, que es lo que haría que se notara el bucle. El recorrido cabe de
  // sobra en el margen que da `inset: -25%`.
  @keyframes nebulosa {
    from {
      transform: translate3d(-5%, -3%, 0) scale(1);
    }
    to {
      transform: translate3d(5%, 3.5%, 0) scale(1.14);
    }
  }

  // Quien pide menos movimiento se queda con el fondo quieto. No pierde nada:
  // el dibujo es el mismo, sólo deja de derivar.
  @media (prefers-reduced-motion: reduce) {
    .proyeccion--nebula::before,
    .proyeccion--water::before,
    .proyeccion--water::after,
    .proyeccion--clouds::before,
    .proyeccion--clouds::after,
    .proyeccion--mist::before {
      animation: none;
    }
  }

  // `position: relative` y `z-index`, o la capa animada de arriba le pasa por
  // encima: una caja posicionada se pinta después que sus hermanas normales,
  // así que las nubes quedaban delante del versículo.
  .lamina {
    position: relative;
    z-index: 1;
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

  // El segundo idioma: más pequeño, debajo y con menos peso — pero LEGIBLE.
  // Estaba al 58 % del principal y en una pantalla de iglesia eso no se leía
  // desde las últimas filas: quien sigue el texto en el segundo idioma tiene el
  // mismo derecho a leerlo que el resto. Subido a ~72 %, que es donde se lee sin
  // llegar a discutirle el sitio al principal.
  .lamina--dos .lamina__texto--secundario {
    font-size: calc(clamp(1.2rem, 2.4vw + 0.7vh, 3.1rem) * var(--escala, 1));
  }

  .lamina__texto--secundario {
    font-size: calc(clamp(1.1rem, 2.4vw + 0.7vh, 3.2rem) * var(--escala, 1));
    font-weight: 400;
    opacity: 0.9;
  }

  // El filete entre los dos idiomas. Corto, centrado y en el acento del fondo
  // al 55 %: exactamente el de la imagen para compartir, que es de donde salió.
  .lamina__filete {
    width: min(18%, 9rem);
    height: 0;
    margin: clamp(0.7rem, 2vh, 1.6rem) auto;
    border: 0;
    border-top: 2px solid var(--acento, #f0c674);
    opacity: 0.55;
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

  // En vertical, el relleno lateral de escritorio se comía media línea por
  // lado. El de abajo reserva la franja de los controles.
  @media (max-width: 40rem) {
    .proyeccion {
      padding: 1.25rem 1rem 4.5rem;
    }

    .lamina {
      max-width: 100%;
    }
  }
</style>
