<script>
  /**
   * Versículo del día: aparece una vez al día al entrar en la app.
   *
   * Reglas de aparición (todas tienen que cumplirse):
   *   - no se ha mostrado ya hoy (fecha local, en localStorage)
   *   - el usuario no lo ha desactivado
   *   - la Biblia está cargada y la referencia existe en esta versión
   *   - la URL no apunta ya a un versículo concreto: quien llega desde un enlace
   *     compartido viene a leer ese versículo, no a que le tapen la pantalla
   */
  import { onMount, onDestroy } from 'svelte';
  import Modal from './Modal.svelte';
  import VerseImageModal from './VerseImageModal.svelte';
  import { _ } from '../services/i18n.service';
  import { buildBiblePath, parseBiblePath } from '../services/bible-route.service';
  import { getVerseForToday, markShownToday, setEnabled } from '../services/daily-verse.service';
  import { getBibleVersionConfigOrDefault, selectedBibleVersion } from '../store/stores';

  export let bible = [];
  export let map = {};

  // Margen para no competir con el primer render ni con la carga de la Biblia.
  const RETRASO_MS = 900;

  let verse = null;      // { book, chapter, verse, text }
  let showShare = false;
  let temporizador;

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
  $: versionName = versionConfig?.bibleName || '';
  $: reference = verse ? `${map[verse.book]} ${verse.chapter}:${verse.verse}` : '';

  const llegaAUnVersiculo = () => {
    if (typeof window === 'undefined') return false;
    return !!parseBiblePath(window.location.pathname)?.verse;
  };

  onMount(() => {
    temporizador = window.setTimeout(async () => {
      if (llegaAUnVersiculo()) return;

      const ref = await getVerseForToday();
      if (!ref) return;

      const text = bible[ref.book]?.[ref.chapter - 1]?.[ref.verse - 1];
      // Si la referencia no existe en esta versión no se marca como vista:
      // así el usuario la recibe al cambiar a una versión que sí la tenga.
      if (typeof text !== 'string' || !text.trim()) return;

      verse = { ...ref, text };
      markShownToday();
    }, RETRASO_MS);
  });

  onDestroy(() => window.clearTimeout(temporizador));

  const close = () => {
    verse = null;
    showShare = false;
  };

  const noVolverAMostrar = () => {
    setEnabled(false);
    close();
  };

  const abrirEnContexto = () => {
    const path = buildBiblePath({
      version: $selectedBibleVersion,
      map,
      book: verse.book,
      chapter: verse.chapter,
      verse: verse.verse,
    });
    close();
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
      // La errata `robibile` es la del resto del proyecto — ver CLAUDE.md.
      window.dispatchEvent(new CustomEvent('robibile:navigate'));
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };
</script>

{#if verse}
  <Modal
    open={!showShare}
    eyebrow={$_('app.daily_verse.eyebrow')}
    title={reference}
    size="md"
    fitContent
    onClose={close}
  >
    <div class="daily-verse">
      <blockquote class="daily-verse__text">{verse.text}</blockquote>
      <p class="daily-verse__hint">{$_('app.daily_verse.hint')}</p>
    </div>

    <svelte:fragment slot="footer">
      <button type="button" class="daily-verse__never" on:click={noVolverAMostrar}>
        {$_('app.daily_verse.never')}
      </button>
      <button type="button" class="daily-verse__secondary" on:click={() => (showShare = true)}>
        {$_('app.daily_verse.share')}
      </button>
      <button type="button" class="daily-verse__primary" on:click={abrirEnContexto}>
        {$_('app.daily_verse.open')}
      </button>
    </svelte:fragment>
  </Modal>

  <VerseImageModal
    open={showShare}
    text={verse.text}
    {reference}
    {versionName}
    onClose={() => (showShare = false)}
  />
{/if}

<style lang="scss">
  .daily-verse {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .daily-verse__text {
    margin: 0;
    padding: 0.35rem 0 0.35rem 1rem;
    border-left: 0.25rem solid var(--color-accent);
    font-size: var(--font-size-lead);
    line-height: 1.6;
    color: var(--color-ink);
  }

  .daily-verse__hint {
    margin: 0;
    font-size: var(--font-size-tiny);
    color: var(--color-ink-soft);
  }

  .daily-verse__never,
  .daily-verse__secondary,
  .daily-verse__primary {
    padding: 0.5rem 1.1rem;
    border-radius: var(--radius-pill);
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
  }

  // "No volver a mostrar" queda a la izquierda y sin peso visual: es una salida,
  // no una de las dos acciones que se ofrecen.
  .daily-verse__never {
    margin-right: auto;
    border: 0;
    background: transparent;
    color: var(--color-ink-soft);
    font-weight: 400;
    text-decoration: underline;

    &:hover {
      color: var(--color-ink);
    }
  }

  .daily-verse__secondary {
    border: 1px solid var(--color-line);
    background: transparent;
    color: var(--color-ink);

    &:hover {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }
  }

  .daily-verse__primary {
    border: 1px solid var(--color-accent);
    background: var(--color-accent);
    color: var(--color-on-primary);

    &:hover {
      background: var(--color-accent-hover);
      border-color: var(--color-accent-hover);
    }
  }

  .daily-verse__never:focus-visible,
  .daily-verse__secondary:focus-visible,
  .daily-verse__primary:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  // En pantallas estrechas los tres botones no caben en una fila y "Vezi în
  // context" caía sola a la segunda, descolgada. Se reparten la fila las dos
  // acciones y la salida se va debajo, centrada.
  @media (max-width: 30rem) {
    .daily-verse__never {
      order: 3;
      width: 100%;
      margin-right: 0;
      padding-top: 0.75rem;
      text-align: center;
    }

    .daily-verse__secondary,
    .daily-verse__primary {
      flex: 1;
    }
  }
</style>
