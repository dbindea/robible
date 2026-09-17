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
  <!-- Las estrellas van en TRES capas y no en una, que es lo que hace que
       titilen en vez de latir. Con las doce en un solo elemento sólo cabe una
       animación, así que se encienden y se apagan todas a la vez y el cielo
       entero parece respirar — el efecto de una bombilla con mal contacto, no
       el de un cielo. Repartidas en tres grupos con el ciclo desfasado, en
       cualquier instante hay unas subiendo y otras bajando.
       Son elementos de verdad y no pseudo porque `.proyeccion` sólo tiene dos y
       las dos están ocupadas: `::before` son las nubes de la nebulosa. -->
  {#if animado === 'nebula' && !enNegro}
    <span class="estrellas estrellas--a" aria-hidden="true"></span>
    <span class="estrellas estrellas--b" aria-hidden="true"></span>
    <span class="estrellas estrellas--c" aria-hidden="true"></span>
  {/if}

  {#if !enNegro && principal.texto}
    <!-- `{#key}` vuelve a montar la lámina en cada versículo, que es lo que
         dispara la transición de entrada. Sin él, Svelte reutiliza el nodo y
         el texto cambia de golpe.

         Va la referencia ADEMÁS del índice: al pasar del último versículo de un
         capítulo al primero del siguiente, el índice vuelve a 0 y en un capítulo
         de un solo versículo sería 0 antes y 0 después — misma clave, ninguna
         transición. Con la referencia delante, cada versículo tiene la suya. -->
    {#key `${principal.referencia}#${indice}`}
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
  /* TODAS las capas animadas declaran aquí `content` y `position`, las dos
     pseudo de cada fondo. Estaban repartidas —cada `::after` repetía las suyas—
     y al de agua se le olvidaron: la ola de fondo tenía su dibujo, su tamaño y
     su animación, y no se veía NADA, porque un pseudoelemento sin `content` no
     existe. Un fallo así no da error ni aviso; se cazó midiendo cuánto se movía
     cada capa y encontrando una parada en cero. En un solo sitio no vuelve a
     pasar. (La `::after` de nebulosa queda fuera a propósito: son las estrellas,
     van quietas y con su propio encuadre.) */
  .proyeccion--nebula::before,
  .proyeccion--water::before,
  .proyeccion--water::after,
  .proyeccion--clouds::before,
  .proyeccion--clouds::after,
  .proyeccion--mist::before,
  .proyeccion--mist::after {
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

  /* Las estrellas TITILAN desde el 17 sep 2026, en ciclo de 5 segundos.
     Antes iban quietas a propósito —un parpadeo es justo el movimiento que roba
     la vista mientras se lee— y es una decisión de producto que se ha revertido:
     lo pidió el propietario. Se ha conservado lo que hacía que aquella razón
     tuviera sentido: la oscilación no baja del 30 %, así que ninguna estrella
     llega a desaparecer, y el ciclo es largo y suave. Lo que molesta de un
     parpadeo es el corte, no el brillo.

     Van aparte de las nubes para que no se estiren con su escala —unas
     estrellas que crecen delatan el truco—, y son posiciones fijas y no una
     trama repetida: repetida se le ve la rejilla. El pintor del canvas las
     dibuja también, ahí quietas: una imagen para compartir es una foto. */
  .estrellas {
    position: absolute;
    inset: 0;
    pointer-events: none;
    // Sólo cambia la opacidad, que el compositor resuelve sin repintar nada.
    will-change: opacity;
    animation: titilar 5s ease-in-out infinite;
  }

  .estrellas--a {
    background-image:
      radial-gradient(1.5px 1.5px at 12% 18%, rgba(244, 247, 255, 0.75), transparent),
      radial-gradient(1px 1px at 56% 78%, rgba(244, 247, 255, 0.5), transparent),
      radial-gradient(1.5px 1.5px at 88% 84%, rgba(244, 247, 255, 0.6), transparent),
      radial-gradient(1px 1px at 63% 8%, rgba(244, 247, 255, 0.55), transparent);
  }

  // Los retardos son NEGATIVOS: así los tres grupos arrancan ya repartidos por
  // el ciclo. Con retardos positivos, los cinco primeros segundos las doce
  // estrellas estarían a la vez en el mismo punto de la animación, que es
  // exactamente lo que se quería evitar.
  .estrellas--b {
    animation-delay: -1.7s;
    background-image:
      radial-gradient(1px 1px at 27% 61%, rgba(244, 247, 255, 0.55), transparent),
      radial-gradient(2px 2px at 68% 26%, rgba(244, 247, 255, 0.8), transparent),
      radial-gradient(1px 1px at 33% 88%, rgba(244, 247, 255, 0.5), transparent),
      radial-gradient(1px 1px at 94% 34%, rgba(244, 247, 255, 0.45), transparent);
  }

  .estrellas--c {
    animation-delay: -3.4s;
    background-image:
      radial-gradient(1.5px 1.5px at 41% 12%, rgba(244, 247, 255, 0.65), transparent),
      radial-gradient(1px 1px at 79% 55%, rgba(244, 247, 255, 0.45), transparent),
      radial-gradient(1.5px 1.5px at 8% 72%, rgba(244, 247, 255, 0.5), transparent),
      radial-gradient(1px 1px at 47% 44%, rgba(244, 247, 255, 0.4), transparent);
  }

  /* Cinco segundos de encendido a apagado y vuelta: el ciclo COMPLETO son los
     cinco, no diez. Por eso no lleva `alternate` —que duplicaría la duración—
     sino una curva propia con el mínimo en el 50 %. */
  @keyframes titilar {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  /* ── Agua, nubes y vapor: sin mosaico ───────────────────────────────────
     Los tres se dibujaban repitiendo una baldosa en horizontal, y eso traía
     dos problemas que se veían en la pantalla grande:

     - **Un corte recto que se desliza.** El borde de la baldosa es una línea
       perfectamente horizontal, y al moverse cruzaba la proyección de lado a
       lado. Es lo que delataba el truco.
     - **Simetría.** Una baldosa que se repite es, por definición, un patrón: a
       los pocos segundos se le ve el ritmo. Las nubes salían circulares y la
       niebla acompasada, cuando lo que se pide es justo lo contrario — humo,
       que no se sabe adónde va.

     Ahora no hay baldosa: cada capa es UNA sola imagen, más ancha y más alta
     que la pantalla (`no-repeat`), y se mueve poco y en `alternate` — va y
     vuelve por el mismo camino, así que no hay salto de bucle ni borde que
     pueda entrar en cuadro.

     Lo que rompe la simetría son tres cosas a la vez: formas de proporciones
     distintas y posiciones sin orden, `filter: blur()` que las funde en manchas
     irregulares, y dos capas girando en sentidos contrarios con periodos que no
     son múltiplos entre sí. Los pares son primos entre sí a propósito (17/26,
     19/27, 23/31), así que en `alternate` tardan un cuarto de hora largo en
     volver a coincidir: un culto se acaba antes de que se repita un fotograma.

     Esos números bajaron a la mitad el 17 sep 2026. Estaban en 37 y 53 y el
     cálculo de arriba salía mal: a 4 % de recorrido en 37 segundos, el agua se
     desplazaba unos pocos píxeles en los diez que dura la diapositiva. Ahora el
     recorrido es el doble y el ciclo la mitad — cuatro veces más rápido, que es
     donde el movimiento empieza a verse sin llegar a distraer. */

  /* ── Agua ──────────────────────────────────────────────────────────── */
  .proyeccion--water::before,
  .proyeccion--water::after {
    inset: 0 -20%;
  }

  /* Las crestas son curvas irregulares escritas a mano —amplitudes desiguales,
     ningún periodo exacto—, no una senoide: una senoide perfecta se reconoce
     como dibujo, y el mar no tiene dos olas iguales. */
  .proyeccion--water::before {
    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 80' preserveAspectRatio='none'%3E%3Cpath d='M0 26 C 22 12 44 32 68 24 S 104 8 132 26 S 172 38 198 22 S 226 14 240 28 V80 H0 Z' fill='%235FD4E4' fill-opacity='.20'/%3E%3C/svg%3E"),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 80' preserveAspectRatio='none'%3E%3Cpath d='M0 34 C 30 22 52 44 84 34 S 128 18 160 36 S 206 46 240 30 V80 H0 Z' fill='%235FD4E4' fill-opacity='.13'/%3E%3C/svg%3E");
    background-size:
      190% 46%,
      210% 64%;
    background-repeat: no-repeat, no-repeat;
    background-position:
      0 100%,
      0 100%;
    animation: agua-cerca 17s ease-in-out infinite alternate;
  }

  .proyeccion--water::after {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 80' preserveAspectRatio='none'%3E%3Cpath d='M0 40 C 44 28 78 50 120 40 S 190 26 240 42 V80 H0 Z' fill='%235FD4E4' fill-opacity='.08'/%3E%3C/svg%3E");
    background-size: 230% 82%;
    background-repeat: no-repeat;
    background-position: 0 100%;
    animation: agua-lejos 26s ease-in-out infinite alternate;
  }

  /* El recorrido es el DOBLE que antes y en la mitad de tiempo, porque con 4%
     en 37 s el agua avanzaba tres píxeles mientras se leía el versículo y
     parecía una foto. La cresta sube y baja además de ir de lado: sin ese
     componente vertical, una ola que se desplaza en horizontal se lee como un
     dibujo arrastrado, no como agua. */
  @keyframes agua-cerca {
    from {
      transform: translate3d(-8%, 1.6%, 0);
    }
    to {
      transform: translate3d(8%, -1.6%, 0);
    }
  }

  @keyframes agua-lejos {
    from {
      transform: translate3d(6%, -1.1%, 0);
    }
    to {
      transform: translate3d(-6%, 1.1%, 0);
    }
  }

  /* ── Nubes ─────────────────────────────────────────────────────────────
     Sin las pequeñas, que parecían pompas de jabón, y las grandes bien
     difuminadas. El desenfoque va sobre una capa que sólo se transforma, así
     que el navegador lo rasteriza una vez y a partir de ahí sólo compone: no
     se vuelve a calcular en cada fotograma. */
  .proyeccion--clouds::before,
  .proyeccion--clouds::after {
    filter: blur(26px);
  }

  .proyeccion--clouds::before {
    background-image:
      radial-gradient(ellipse 19% 13% at 18% 26%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0) 64%),
      radial-gradient(ellipse 13% 17% at 31% 19%, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0) 66%),
      radial-gradient(ellipse 24% 10% at 62% 33%, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0) 62%),
      radial-gradient(ellipse 11% 15% at 73% 24%, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0) 66%),
      radial-gradient(ellipse 17% 9% at 88% 44%, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 64%);
    background-repeat: no-repeat;
    animation: nubes-a 19s ease-in-out infinite alternate;
  }

  .proyeccion--clouds::after {
    background-image:
      radial-gradient(ellipse 27% 11% at 34% 61%, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0) 66%),
      radial-gradient(ellipse 15% 18% at 12% 72%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0) 68%),
      radial-gradient(ellipse 21% 12% at 79% 68%, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0) 66%);
    background-repeat: no-repeat;
    animation: nubes-b 27s ease-in-out infinite alternate;
  }

  // Giro además del desplazamiento: es lo que hace que dos manchas que se
  // cruzan no vuelvan a cruzarse igual, y lo que le quita el aire de «círculos
  // que van de lado». El recorrido se dobló y el ciclo se partió por la mitad
  // por lo mismo que el agua: en diez segundos hay que ver que se mueven.
  @keyframes nubes-a {
    from {
      transform: translate3d(-10%, -3%, 0) rotate(-2.4deg) scale(1.02);
    }
    to {
      transform: translate3d(10%, 3%, 0) rotate(2.4deg) scale(1.16);
    }
  }

  @keyframes nubes-b {
    from {
      transform: translate3d(8%, 2.4%, 0) rotate(3deg) scale(1.14);
    }
    to {
      transform: translate3d(-8%, -2.4%, 0) rotate(-3deg) scale(1);
    }
  }

  /* ── Vapor ─────────────────────────────────────────────────────────────
     Humo de verdad, y por eso GRANULADO: la textura sale de `feTurbulence`,
     el ruido fractal de SVG, y no de degradados. Unas manchas difusas dan
     bruma; el humo tiene grano, hebras y densidad desigual, y eso no se
     consigue con `radial-gradient` por muchos que se acumulen — era lo que
     quedaba redondo y predecible.

     La receta del filtro: `feTurbulence` genera ruido en color y
     `feColorMatrix` lo convierte en blanco con alfa variable (la última fila,
     `1 0 0 0 0`, toma el canal rojo del ruido como transparencia). El
     resultado es humo blanco irregular sobre fondo transparente.

     Son TRES primitivas encadenadas, y ninguna sobra — se llegó a ellas
     descartando las versiones más simples, que se veían así:

     - `feTurbulence` solo, con las frecuencias muy desiguales (mucha en X, poca
       en Y): sale una cortina de rayas verticales regularmente espaciadas, una
       empalizada. El ruido anisótropo extremo peina, no humea.
     - Con las frecuencias al revés (poca en X, mucha en Y) salen bandas
       HORIZONTALES cruzando la pantalla: justo el «corte deslizante» del que se
       venía huyendo. Ojo con el orden, que es `x y` y **frecuencia alta =
       detalle fino**.

     Lo que sí funciona es un ruido de proporción suave —apenas el doble de alto
     que de ancho— DEFORMADO por un segundo ruido de escala grande
     (`feDisplacementMap`). Esa deformación es la que curva los penachos y hace
     que no se repitan: es la diferencia entre una textura y humo.

     `feComponentTransfer` decide cuánto se recorta. El ruido en crudo se agolpa
     alrededor del medio y pinta un velo gris parejo; la tabla estira esa franja
     central. Va SUAVE a propósito: con una curva dura salen jirones de bordes
     marcados, y el humo de un cigarrillo no tiene bordes.

     El `filter` lleva región ampliada (`x/y/width/height`): la de por defecto
     es un 10 % alrededor, y al desplazar 110 unidades entraban los bordes
     transparentes y el humo se cortaba en seco por los lados.

     **Humo de tabaco, no vapor granulado** (17 sep 2026). Hubo una versión con
     grano —un ruido fino multiplicado encima con `feComposite`— que daba humo de
     partículas, como el de una hoguera. Se retiró por decisión del propietario:
     lo que se quiere es la cinta translúcida y difuminada de un cigarrillo. La
     forma es la misma; lo que cambia es que el grano se fue y el desenfoque
     subió de 1 px a 16. Si vuelve a hacer falta, está en el historial de git.

     La máscara los deja densos junto al suelo y deshechos arriba, que es lo
     que los hace humo que se levanta y no una bruma parada. */
  .proyeccion--mist::before,
  .proyeccion--mist::after {
    -webkit-mask-image: linear-gradient(to top, #000 4%, rgba(0, 0, 0, 0.42) 30%, transparent 70%);
    mask-image: linear-gradient(to top, #000 4%, rgba(0, 0, 0, 0.42) 30%, transparent 70%);
  }

  .proyeccion--mist::before {
    // Desenfoque generoso: es lo que convierte el ruido en cinta de humo. El
    // desenfoque va sobre una capa que sólo se transforma, así que el navegador
    // lo rasteriza una vez y a partir de ahí sólo compone.
    filter: blur(16px);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='700' height='700'%3E%3Cfilter id='h' x='-30%25' y='-30%25' width='160%25' height='160%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.014 0.007' numOctaves='5' seed='17' result='humo'/%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.0035' numOctaves='2' seed='9' result='remolino'/%3E%3CfeDisplacementMap in='humo' in2='remolino' scale='110' xChannelSelector='R' yChannelSelector='G'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='table' tableValues='0 0.06 0.3 0.68 1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='700' height='700' filter='url(%23h)' opacity='.6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-size: 150% 120%;
    background-position: 50% 100%;
    animation: vapor-a 23s ease-in-out infinite alternate;
  }

  .proyeccion--mist::after {
    filter: blur(26px);
    // Otras semillas y otra escala de deformación: dos capas del mismo ruido se
    // delatarían como una sola moviéndose en paralelo. Ésta va más difusa y más
    // ancha, y hace de penacho de fondo para que el de delante se recorte contra
    // algo en vez de contra el verde liso.
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='700' height='700'%3E%3Cfilter id='h2' x='-30%25' y='-30%25' width='160%25' height='160%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.009 0.005' numOctaves='4' seed='53' result='humo'/%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.0025' numOctaves='2' seed='31' result='remolino'/%3E%3CfeDisplacementMap in='humo' in2='remolino' scale='150' xChannelSelector='G' yChannelSelector='B'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='table' tableValues='0 0.05 0.26 0.62 1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='700' height='700' filter='url(%23h2)' opacity='.45'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-size: 190% 140%;
    background-position: 50% 100%;
    animation: vapor-b 31s ease-in-out infinite alternate;
  }

  // Sube y se abre: el recorrido vertical manda sobre el lateral, y la escala
  // ensancha el penacho conforme sube, como hace el humo de verdad.
  @keyframes vapor-a {
    from {
      transform: translate3d(-2%, 9%, 0) rotate(-1deg) scale(1);
    }
    to {
      transform: translate3d(2%, -11%, 0) rotate(1deg) scale(1.22);
    }
  }

  @keyframes vapor-b {
    from {
      transform: translate3d(3%, 7%, 0) rotate(1.4deg) scale(1.16);
    }
    to {
      transform: translate3d(-3%, -12%, 0) rotate(-1.4deg) scale(1);
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
    .proyeccion--mist::before,
    .proyeccion--mist::after,
    // Las estrellas se quedan encendidas del todo, no a medio brillo: sin la
    // animación, la opacidad vuelve a su valor de reposo, que es 1.
    .estrellas {
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
    // No recibe clics, por lo mismo que la marca de agua: las dos mitades que
    // avanzan y retroceden van DEBAJO (llegan por el slot, después, pero sin
    // `z-index`, y un `z-index: 1` gana a un `auto` aunque vaya antes en el
    // DOM). Sin esto, el versículo —que en un móvil ocupa casi toda la
    // pantalla— se tragaba el toque y sólo avanzaba dando en los márgenes.
    // Dentro no hay nada que pulsar: es una cita, un filete y la referencia.
    pointer-events: none;
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
