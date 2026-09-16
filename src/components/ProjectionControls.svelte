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
  import { ANIMACIONES } from '../services/projection.service';
  import { compareWithVersion, selectedBibleVersion } from '../store/stores';

  export let prefs;
  /** '' | 'fondo' | 'animacion' | 'idioma' */
  export let panelAbierto = '';
  export let indice = 0;
  export let total = 0;
  /** Sólo se esconden solos sobre la lámina; en la consola están siempre. */
  export let visibles = true;
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
<div class="controles" class:controles--ocultos={!visibles} on:mouseenter={onEntrar} on:mouseleave={onSalirDeControles}>
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

  .controles__activo {
    background: rgba(255, 255, 255, 0.2) !important;
  }

  .controles__posicion {
    padding: 0 0.35rem;
    color: #98a2b3;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
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
