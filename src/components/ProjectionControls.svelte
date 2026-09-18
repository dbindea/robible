<script>
  /**
   * La botonera del operador y sus tres paneles.
   *
   * Se extrajo de `Projection.svelte` el 16 sep 2026 porque ahora se pinta en
   * dos sitios: encima de la lámina cuando se proyecta en esta misma pantalla,
   * y en la consola cuando la proyección va a un segundo monitor. Duplicar
   * ciento y pico líneas de botones habría garantizado que un día un ajuste
   * existiera en un sitio y no en el otro.
   *
   * No guarda nada ni decide nada: recibe las preferencias y avisa por
   * callbacks. El dueño del estado sigue siendo `Projection.svelte`.
   */
  import Icon from './Icon.svelte';
  import { _ } from '../services/i18n.service';
  import { BIBLE_VERSIONS } from '../config/bible-versions.js';
  import { backgroundCss, IMAGE_BACKGROUNDS } from '../services/verse-image.service';
  import { ANIMACIONES, OCUPACION_MAXIMA, OCUPACION_MINIMA, acotarOcupacion } from '../services/projection.service';
  import { compareWithVersion, selectedBibleVersion } from '../store/stores';

  export let prefs;
  /** '' | 'fondo' | 'animacion' | 'idioma' */
  export let panelAbierto = '';
  export let indice = 0;
  export let total = 0;
  /** Sólo se esconden solos sobre la lámina; en la consola están siempre. */
  export let visibles = true;
  /**
   * De qué borde entra la barra: 'izq' | 'der' | '' (sin entrada lateral).
   *
   * Sólo lo usa el modo lectura del móvil, donde la barra se pide deslizando de
   * lado: que aparezca desde el borde hacia el que ha ido el dedo es lo que
   * conecta el gesto con el resultado. En proyección se queda vacío y la barra
   * aparece y desaparece como siempre, sólo con opacidad.
   */
  export let lado = '';
  /**
   * En la consola NO se ofrece pantalla completa: pondría a pantalla completa
   * el portátil del operador, que es justo lo contrario de lo que hace falta.
   * La pantalla completa del proyector se pone en su propia ventana con F11.
   */
  export let conPantallaCompleta = true;

  export let onPanel = () => {};
  export let onSalir = () => {};
  export let onMasGrande = () => {};
  export let onMasPequeno = () => {};
  export let onNegro = () => {};
  export let onPantallaCompleta = () => {};
  export let onFondo = () => {};
  export let onAnimacion = () => {};
  export let onSegundoIdioma = () => {};
  export let onSegundaVersion = () => {};
  export let onIntercambiar = () => {};
  export let onEntrar = () => {};
  export let onSalirDeControles = () => {};
  /** Recibe el porcentaje ya escrito a mano en el campo. */
  export let onOcupacion = () => {};
  /** Sello de la imagen de la pantalla en blanco, o '' si no hay ninguna. */
  export let selloBlanco = '';
  /** Mensaje de error al elegir la imagen. Lo compone el dueño del estado. */
  export let avisoBlanco = '';
  export let onImagenBlanco = () => {};
  export let onQuitarBlanco = () => {};

  const elegirImagen = (e) => {
    const file = e.currentTarget.files?.[0];
    // El campo se vacía siempre: si no, elegir el mismo fichero dos veces
    // seguidas —después de un fallo, por ejemplo— no dispara ningún evento.
    e.currentTarget.value = '';
    if (file) onImagenBlanco(file);
  };

  /**
   * El campo del porcentaje.
   *
   * Es estado propio y no `prefs.ocupacion` a secas porque mientras se escribe
   * el valor pasa por estados que no son un número —vacío, «7»— y derivarlo del
   * store devolvería el texto al valor anterior en cada tecla. Se sincroniza
   * cuando el porcentaje cambia por fuera (los botones, la rueda) y se aplica
   * al salir del campo o al pulsar Intro. Es la misma lección del `textarea` de
   * las palabras clave de la schiță.
   */
  let textoOcupacion = String(prefs.ocupacion);
  let editando = false;
  $: if (!editando) textoOcupacion = String(prefs.ocupacion);

  const aplicarOcupacion = () => {
    editando = false;
    const valor = parseInt(textoOcupacion, 10);
    // Un campo vacío o con basura vuelve a lo que había, no al mínimo: borrarlo
    // para escribir otro número no puede dejar la pantalla de la iglesia con la
    // letra más pequeña posible a mitad de la frase.
    const destino = Number.isFinite(valor) ? acotarOcupacion(valor) : prefs.ocupacion;
    textoOcupacion = String(destino);
    if (destino !== prefs.ocupacion) onOcupacion(destino);
  };
</script>

<!-- ── Paneles de ajuste ────────────────────────────────────────────────── -->
{#if panelAbierto === 'fondo'}
  <div class="panel">
    <p class="panel__titulo">{$_('app.projection.panel_background')}</p>
    <div class="muestras">
      {#each IMAGE_BACKGROUNDS as b (b.key)}
        <button
          type="button"
          class="muestra"
          class:muestra--activa={prefs.fondo === b.key}
          style="background: {backgroundCss(b)}"
          aria-label={b.key}
          aria-pressed={prefs.fondo === b.key}
          on:click={() => onFondo(b.key)}
        ></button>
      {/each}
    </div>

    <!-- La imagen de la pantalla en blanco. Va en este panel y no en uno propio
         porque es «cómo se ve la pantalla», igual que el fondo; y va al final
         porque se elige una vez y no se vuelve a tocar en todo el culto. -->
    <p class="panel__titulo panel__titulo--segundo">{$_('app.projection.blank_image')}</p>
    <div class="opciones">
      <!-- El `input` va escondido dentro de la etiqueta: el control que pinta
           el navegador no se puede vestir, y aquí tiene que parecerse a los
           demás botones del panel. -->
      <label class="opcion">
        {selloBlanco ? $_('app.projection.blank_image_change') : $_('app.projection.blank_image_pick')}
        <input type="file" accept="image/*" on:change={elegirImagen} />
      </label>
      {#if selloBlanco}
        <button type="button" class="opcion" on:click={onQuitarBlanco}>
          {$_('app.projection.blank_image_clear')}
        </button>
      {/if}
    </div>
    <p class="panel__nota">{$_('app.projection.blank_image_hint')}</p>
    {#if avisoBlanco}
      <p class="panel__nota panel__nota--error" role="alert">{avisoBlanco}</p>
    {/if}
  </div>
{:else if panelAbierto === 'animacion'}
  <div class="panel">
    <p class="panel__titulo">{$_('app.projection.panel_animation')}</p>
    <div class="opciones">
      {#each ANIMACIONES as a (a)}
        <button
          type="button"
          class="opcion"
          class:opcion--activa={prefs.animacion === a}
          aria-pressed={prefs.animacion === a}
          on:click={() => onAnimacion(a)}
        >
          {$_(`app.projection.animation_${a}`)}
        </button>
      {/each}
    </div>
  </div>
{:else if panelAbierto === 'idioma'}
  <div class="panel">
    <p class="panel__titulo">{$_('app.projection.panel_language')}</p>
    <div class="opciones">
      <button
        type="button"
        class="opcion"
        class:opcion--activa={prefs.segundoIdioma}
        aria-pressed={prefs.segundoIdioma}
        on:click={onSegundoIdioma}
      >
        {$_(prefs.segundoIdioma ? 'app.projection.second_on' : 'app.projection.second_off')}
      </button>
      {#if prefs.segundoIdioma}
        {#each BIBLE_VERSIONS.filter((v) => v.value !== $selectedBibleVersion) as v (v.value)}
          <button
            type="button"
            class="opcion"
            class:opcion--activa={$compareWithVersion === v.value}
            aria-pressed={$compareWithVersion === v.value}
            on:click={() => onSegundaVersion(v.value)}
          >
            {v.bibleName}
          </button>
        {/each}
        <button type="button" class="opcion" on:click={onIntercambiar}>
          <Icon name="swap" />
          {$_('app.projection.key_swap')}
        </button>
      {/if}
    </div>
  </div>
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="controles"
  class:controles--ocultos={!visibles}
  class:controles--izq={lado === 'izq'}
  class:controles--der={lado === 'der'}
  on:mouseenter={onEntrar}
  on:mouseleave={onSalirDeControles}
>
  <button
    type="button"
    on:click={onSalir}
    title={$_('app.projection.key_exit')}
    aria-label={$_('app.projection.key_exit')}
  >
    <Icon name="close" />
  </button>
  <button type="button" on:click={onMasPequeno} aria-label={$_('app.projection.key_size')}><Icon name="minus" /></button
  >
  <!-- Cuánto de la pantalla llena el texto. Es un número, no una sensación: sin
       verlo, el operador no sabe si está al 60 o al 95 y acaba pulsando hasta
       que «se vea bien», que en una pantalla de iglesia es tarde.
       Y se puede escribir: ir del 95 al 60 son siete pulsaciones del botón y
       una sola tecleada. -->
  <label class="controles__ocupacion">
    <input
      type="number"
      min={OCUPACION_MINIMA}
      max={OCUPACION_MAXIMA}
      step="1"
      inputmode="numeric"
      bind:value={textoOcupacion}
      on:focus={() => (editando = true)}
      on:blur={aplicarOcupacion}
      on:keydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          aplicarOcupacion();
          e.currentTarget.blur();
        }
      }}
      aria-label={$_('app.projection.key_size')}
      title={$_('app.projection.key_size')}
    />
    <span aria-hidden="true">%</span>
  </label>
  <button type="button" on:click={onMasGrande} aria-label={$_('app.projection.key_size')}><Icon name="plus" /></button>
  <button
    type="button"
    class:controles__activo={panelAbierto === 'fondo'}
    on:click={() => onPanel('fondo')}
    title={$_('app.projection.panel_background')}
    aria-label={$_('app.projection.panel_background')}
  >
    <Icon name="palette" />
  </button>
  <button
    type="button"
    class:controles__activo={panelAbierto === 'animacion'}
    on:click={() => onPanel('animacion')}
    title={$_('app.projection.panel_animation')}
    aria-label={$_('app.projection.panel_animation')}
  >
    <Icon name="play" />
  </button>
  <button
    type="button"
    class:controles__activo={panelAbierto === 'idioma'}
    on:click={() => onPanel('idioma')}
    title={$_('app.projection.panel_language')}
    aria-label={$_('app.projection.panel_language')}
  >
    <Icon name="globe" />
  </button>
  <button
    type="button"
    on:click={onNegro}
    title={$_('app.projection.key_black')}
    aria-label={$_('app.projection.key_black')}
  >
    <Icon name="eye" />
  </button>
  {#if conPantallaCompleta}
    <button
      type="button"
      on:click={onPantallaCompleta}
      title={$_('app.projection.key_fullscreen')}
      aria-label={$_('app.projection.key_fullscreen')}
    >
      <Icon name="expand" />
    </button>
  {/if}
  <span class="controles__posicion">{indice + 1} / {total}</span>
</div>

<style lang="scss">
  // Colores fijos y no los de la paleta: esta botonera se pinta encima de la
  // lámina, que tiene su propio fondo elegido entre nueve. Con los tokens del
  // usuario, sobre `sand` o `arcs` quedaba texto claro sobre fondo claro.
  .controles {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-pill);
    background: rgba(20, 24, 30, 0.86);
    transition: opacity var(--motion-base, 200ms) ease;

    button {
      display: inline-grid;
      place-items: center;
      // 2.25rem = 36px: por encima del mínimo de 24 px de objetivo táctil
      // (WCAG 2.5.8) y cómodo de acertar con prisa.
      width: 2.25rem;
      height: 2.25rem;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: #f2f4f7;
      cursor: pointer;
      --icon-size: 1.05rem;

      &:hover {
        background: rgba(255, 255, 255, 0.12);
      }
    }
  }

  .controles--ocultos {
    opacity: 0;
    // Sin esto seguirían recibiendo clics invisibles justo donde el operador
    // toca para avanzar.
    pointer-events: none;
  }

  // Entrada lateral, sólo en el modo lectura del móvil. Las reglas van aquí y
  // no en la media query de abajo porque el `transform` que se compone es el de
  // esa media query (`translateX(-50%)`), y separarlos deja media regla sin la
  // otra mitad si alguien toca una de las dos.
  @media (max-width: 40rem) {
    .controles {
      transition:
        opacity var(--motion-base, 200ms) ease,
        transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1);
    }

    // El `translateX(-50%)` de la media query centra la barra; el segundo la
    // saca por el borde. Los dos en el mismo `transform` o el centrado se
    // pierde.
    .controles--ocultos.controles--izq {
      transform: translateX(-50%) translateX(-150%);
    }

    .controles--ocultos.controles--der {
      transform: translateX(-50%) translateX(150%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .controles {
      transition: opacity var(--motion-base, 200ms) ease;
    }

    .controles--ocultos.controles--izq,
    .controles--ocultos.controles--der {
      transform: translateX(-50%);
    }
  }

  .controles__activo {
    background: rgba(255, 255, 255, 0.2) !important;
  }

  // El campo y su «%», como una sola pieza. Colores fijos igual que el resto de
  // la botonera: se pinta sobre la lámina, que tiene su propio fondo.
  .controles__ocupacion {
    display: inline-flex;
    align-items: center;
    gap: 0.1rem;
    padding: 0 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: var(--radius-pill);
    color: #f2f4f7;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    // «100 %» no puede partirse en dos renglones y doblar el alto de la barra.
    white-space: nowrap;

    &:focus-within {
      border-color: rgba(255, 255, 255, 0.55);
      background: rgba(255, 255, 255, 0.12);
    }

    input {
      width: 2.1rem;
      height: 1.9rem;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: right;
      // Sin las flechitas del navegador: ya están los botones + y −, y arriba y
      // abajo cambian de versículo aunque el foco esté aquí, así que un
      // incrementador que no responde a las flechas sólo confundiría.
      appearance: textfield;
      -moz-appearance: textfield;

      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        appearance: none;
        margin: 0;
      }

      &:focus {
        outline: none;
      }
    }
  }

  .controles__posicion {
    padding: 0 0.35rem;
    color: #98a2b3;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    // Sin esto, «12 / 150» se parte en dos renglones en cuanto la barra va
    // justa de ancho y la hace el doble de alta.
    white-space: nowrap;
  }

  /* ── Móvil ────────────────────────────────────────────────────────────────
     Centrada abajo y algo por encima del borde: sobre esa franja inferior es
     donde el navegador móvil enseña y esconde su propia barra de direcciones.

     En UNA fila y compacta. Con los botones de 2,6 rem que tenía, los ocho no
     cabían a lo ancho de un móvil: la barra se partía en dos renglones, se
     salía por la izquierda y el contador quedaba cortado. A 2,2 rem (35 px)
     entran los ocho y el contador en una sola fila — por encima del mínimo de
     24 px que pide WCAG 2.5.8, aunque por debajo de lo cómodo para un pulgar.
     Es el precio de que esta pantalla también sirva para LEER en el móvil, que
     es para lo que se pidió: cuanto menos ocupe la barra, mejor. */
  @media (max-width: 40rem) {
    .controles {
      right: auto;
      left: 50%;
      bottom: 1rem;
      transform: translateX(-50%);
      flex-wrap: nowrap;
      justify-content: center;
      gap: 0.15rem;
      padding: 0.3rem 0.45rem;
      max-width: calc(100vw - 1rem);

      button {
        width: 2.2rem;
        height: 2.2rem;
        --icon-size: 1rem;
      }
    }

    .controles__posicion {
      padding: 0 0.25rem;
      font-size: 0.72rem;
    }

    .controles__ocupacion {
      padding: 0 0.2rem;
      font-size: 0.68rem;

      input {
        width: 1.7rem;
        height: 1.7rem;
      }
    }

    // El panel se apoya justo encima de los controles, también centrado.
    .panel {
      right: auto;
      left: 50%;
      bottom: 4.25rem;
      transform: translateX(-50%);
      width: calc(100vw - 2rem);
    }
  }

  .panel {
    position: absolute;
    right: 1rem;
    bottom: 4.25rem;
    z-index: 3;
    max-width: min(26rem, calc(100vw - 2rem));
    padding: 0.75rem 0.85rem;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-md);
    // Opaco y no translúcido: sobre un fondo claro como `sand` o `arcs`, un
    // panel semitransparente dejaba los textos ilegibles.
    background: #14181e;
    color: #f2f4f7;
  }

  .panel__titulo {
    margin: 0 0 0.5rem;
    color: #98a2b3;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  // Un filete separa la imagen de la pantalla en blanco de las muestras de
  // fondo: son dos ajustes distintos y pegados se leían como una sola lista.
  .panel__titulo--segundo {
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid rgba(255, 255, 255, 0.14);
  }

  .panel__nota {
    max-width: 34ch;
    margin: 0.5rem 0 0;
    color: #98a2b3;
    font-size: 0.72rem;
    line-height: 1.45;
  }

  .panel__nota--error {
    color: #f7a8a8;
    font-weight: 600;
  }

  // El selector de fichero: la etiqueta hace de botón y el campo de verdad se
  // esconde. `display: none` lo dejaría fuera del alcance del teclado, así que
  // se tapa sin sacarlo del flujo de foco.
  .opcion input[type='file'] {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .muestras {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2.75rem, 1fr));
    gap: 0.45rem;
  }

  .muestra {
    width: 2.75rem;
    height: 2.75rem;
    border: 2px solid transparent;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  .muestra--activa {
    border-color: #f2f4f7;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
  }

  .opciones {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .opcion {
    // Para el campo de fichero escondido, que se posiciona contra su etiqueta.
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2.25rem;
    padding: 0.35rem 0.8rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: var(--radius-pill);
    background: transparent;
    color: #f2f4f7;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    --icon-size: 0.9rem;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }

  .opcion--activa {
    border-color: #f2f4f7;
    background: rgba(255, 255, 255, 0.16);
  }
</style>
