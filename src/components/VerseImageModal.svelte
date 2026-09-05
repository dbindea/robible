<script>
  /**
   * Diálogo para compartir un versículo como imagen.
   *
   * El dibujo vive en verse-image.service.js; aquí solo está la elección de
   * fondo y formato, la vista previa y el disparo de la hoja de compartir.
   *
   * Detalle importante: el PNG se genera en cuanto cambia la vista previa, no
   * al pulsar "Compartir". iOS Safari exige que navigator.share se llame dentro
   * del gesto del usuario, y un `await canvas.toBlob()` en medio ya rompe esa
   * condición: la hoja de compartir no llegaba a abrirse.
   */
  import { onMount } from 'svelte';
  import Modal from './Modal.svelte';
  import { _ } from '../services/i18n.service';
  import {
    IMAGE_BACKGROUNDS,
    IMAGE_FORMATS,
    canvasToBlob,
    drawVerseImage,
    ensureFontsReady,
    getBackground,
    shareVerseImage,
  } from '../services/verse-image.service';

  export let open = false;
  export let text = '';
  export let reference = '';
  export let versionName = '';
  export let onClose = () => {};
  /** Notifica el resultado para que el llamante enseñe su propio toast. */
  export let onResult = () => {};

  const KEY_BACKGROUND = 'robible:verseImage:background';
  const KEY_FORMAT = 'robible:verseImage:format';

  const readPref = (key, fallback) => {
    if (typeof window === 'undefined') return fallback;
    return localStorage.getItem(key) || fallback;
  };

  let backgroundKey = readPref(KEY_BACKGROUND, IMAGE_BACKGROUNDS[0].key);
  let formatKey = readPref(KEY_FORMAT, IMAGE_FORMATS[0].key);

  let canvas;
  let blob = null;
  let rendering = false;
  let fontsReady = false;
  let sharing = false;

  onMount(async () => {
    await ensureFontsReady();
    fontsReady = true;
  });

  const render = async () => {
    if (!canvas || !open || !text) return;
    rendering = true;
    blob = null;
    try {
      drawVerseImage(canvas, { text, reference, versionName, formatKey, backgroundKey });
      blob = await canvasToBlob(canvas);
    } catch (e) {
      console.warn('No se pudo generar la imagen del versículo:', e.message);
    } finally {
      rendering = false;
    }
  };

  // Redibuja al abrir y cada vez que cambia una de las opciones. `fontsReady`
  // entra en la dependencia para repintar cuando Open Sans termina de cargar:
  // el primer render en frío salía con la tipografía del sistema.
  $: if (open && canvas && fontsReady && text) {
    void backgroundKey;
    void formatKey;
    render();
  }

  const pickBackground = (key) => {
    backgroundKey = key;
    if (typeof window !== 'undefined') localStorage.setItem(KEY_BACKGROUND, key);
  };

  const pickFormat = (key) => {
    formatKey = key;
    if (typeof window !== 'undefined') localStorage.setItem(KEY_FORMAT, key);
  };

  const share = async () => {
    if (sharing) return;
    sharing = true;
    try {
      // Si la vista previa aún no ha terminado, se genera aquí. En ese camino
      // se pierde el gesto en iOS y acaba descargando, que es el fallback.
      const listo = blob || (canvas ? await canvasToBlob(canvas) : null);
      if (!listo) {
        onResult('failed');
        return;
      }
      const canal = await shareVerseImage(listo, { reference, text: `${reference} — robible.com` });
      if (canal !== 'cancelled') onResult(canal);
      if (canal === 'shared') onClose();
    } catch (e) {
      console.warn('No se pudo compartir la imagen:', e.message);
      onResult('failed');
    } finally {
      sharing = false;
    }
  };

  // Muestra de cada fondo en el selector: el mismo degradado que usa el canvas.
  const swatchStyle = (key) => {
    const bg = getBackground(key);
    return `background: linear-gradient(140deg, ${bg.stops.join(', ')});`;
  };
</script>

<Modal
  {open}
  eyebrow={$_('app.share.eyebrow')}
  title={reference}
  size="md"
  fitContent
  {onClose}
>
  <div class="share-image">
    <div class="share-image__preview" class:share-image__preview--busy={rendering}>
      <canvas bind:this={canvas} class="share-image__canvas" class:share-image__canvas--square={formatKey === 'square'}></canvas>
    </div>

    <fieldset class="share-image__group">
      <legend>{$_('app.share.background')}</legend>
      <div class="share-image__swatches">
        {#each IMAGE_BACKGROUNDS as bg (bg.key)}
          <button
            type="button"
            class="share-image__swatch"
            class:share-image__swatch--active={backgroundKey === bg.key}
            style={swatchStyle(bg.key)}
            title={$_(`app.share.backgrounds.${bg.key}`)}
            aria-label={$_(`app.share.backgrounds.${bg.key}`)}
            aria-pressed={backgroundKey === bg.key}
            on:click={() => pickBackground(bg.key)}
          ></button>
        {/each}
      </div>
    </fieldset>

    <fieldset class="share-image__group">
      <legend>{$_('app.share.format')}</legend>
      <div class="share-image__formats">
        {#each IMAGE_FORMATS as format (format.key)}
          <button
            type="button"
            class="share-image__format"
            class:share-image__format--active={formatKey === format.key}
            aria-pressed={formatKey === format.key}
            on:click={() => pickFormat(format.key)}
          >
            {$_(`app.share.format_${format.key}`)}
          </button>
        {/each}
      </div>
    </fieldset>

    <p class="share-image__hint">{$_('app.share.hint')}</p>
  </div>

  <svelte:fragment slot="footer">
    <button type="button" class="share-image__cancel" on:click={onClose}>
      {$_('app.share.close')}
    </button>
    <button type="button" class="share-image__submit" on:click={share} disabled={rendering || sharing}>
      {rendering ? $_('app.share.preparing') : $_('app.share.share')}
    </button>
  </svelte:fragment>
</Modal>

<style lang="scss">
  .share-image {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .share-image__preview {
    display: grid;
    place-items: center;
    padding: 0.6rem;
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
    transition: opacity 0.2s ease;

    &--busy {
      opacity: 0.55;
    }
  }

  // El canvas es de 1080 px de ancho; aquí se escala por altura para que la
  // proporción 9:16 quepa en el modal sin empujar el pie fuera de la pantalla.
  .share-image__canvas {
    height: min(46vh, 22rem);
    width: auto;
    max-width: 100%;
    border-radius: var(--radius-md);
    box-shadow: var(--box-shadow-down);

    &--square {
      height: min(34vh, 17rem);
    }
  }

  .share-image__group {
    margin: 0;
    padding: 0;
    border: 0;

    legend {
      padding: 0 0 0.35rem;
      font-size: var(--font-size-tiny);
      font-weight: 600;
      letter-spacing: var(--letter-spacing-eyebrow);
      text-transform: uppercase;
      color: var(--color-ink-soft);
    }
  }

  .share-image__swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .share-image__swatch {
    width: 2.4rem;
    height: 2.4rem;
    border: 2px solid transparent;
    border-radius: var(--radius-pill);
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%), var(--box-shadow-up);
    cursor: pointer;
    transition: var(--transition), transform 0.15s ease;

    &:hover {
      transform: translateY(-1px);
    }

    &--active {
      border-color: var(--color-accent);
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%), 0 0 0 3px color-mix(in srgb, var(--color-accent) 25%, transparent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  .share-image__formats {
    display: flex;
    gap: 0.5rem;
  }

  .share-image__format {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-ink);
    font-size: var(--font-size-small);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);

    &:hover {
      border-color: var(--color-accent);
    }

    &--active {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 12%, transparent);
      color: var(--color-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  .share-image__hint {
    margin: 0;
    font-size: var(--font-size-tiny);
    color: var(--color-ink-soft);
  }

  .share-image__cancel,
  .share-image__submit {
    padding: 0.5rem 1.1rem;
    border-radius: var(--radius-pill);
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
  }

  .share-image__cancel {
    border: 1px solid var(--color-line);
    background: transparent;
    color: var(--color-ink);

    &:hover {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }
  }

  .share-image__submit {
    border: 1px solid var(--color-accent);
    background: var(--color-accent);
    color: var(--color-on-primary);

    &:hover:not(:disabled) {
      background: var(--color-accent-hover);
      border-color: var(--color-accent-hover);
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }
</style>
