<script>
  /**
   * Botón de micrófono para dictar en un campo de texto.
   *
   * Se usa en el buscador del panel lateral y en los dos campos de la
   * proyección. La idea que lo justifica: en el púlpito no se teclea. El
   * predicador dice «Ioan trei șaisprezece» y el versículo aparece.
   *
   * **Si el navegador no sabe dictar, este componente no pinta nada.** Un botón
   * que no puede funcionar es peor que no tenerlo — el mismo criterio que usa
   * la tarjeta de notificaciones del perfil.
   *
   * El aviso de privacidad no es decorativo: en Chrome y Edge de escritorio el
   * audio se reconoce en servidores de Google. La landing promete «la Biblia
   * que no te sigue», así que eso se dice al lado del botón la primera vez y no
   * se esconde en una política que nadie abre.
   */
  import { onDestroy } from 'svelte';
  import { _ } from '../services/i18n.service';
  import { currentUser } from '../store/authStore';
  import { puedeUsar, esDePago } from '../services/features.service';
  import { dictar, soportado, usaServidorExterno, localeDeReconocimiento } from '../services/speech.service';
  import { normalizarDictado, normalizarDictadoLibre } from '../services/speech-reference.service';
  import Icon from './Icon.svelte';

  /** `referencia` convierte «trei șaisprezece» en «3 16»; `libre` no toca nada. */
  export let modo = 'referencia';
  /** Locale de la versión bíblica activa ('ro', 'es'…). */
  export let locale = 'ro';
  /** Se llama con el texto ya normalizado. `final` es false mientras se habla. */
  export let alDictar = () => {};
  /** Etiqueta accesible; cada campo dice para qué sirve el suyo. */
  export let etiqueta = '';

  const CLAVE_AVISO = 'robible:speech:aviso-visto';

  let escuchando = false;
  let sesion = null;
  let error = '';
  let avisoVisible = false;

  $: disponible = soportado() && puedeUsar($currentUser, 'voiceSearch');
  $: bloqueadoPorPlan = soportado() && !puedeUsar($currentUser, 'voiceSearch') && esDePago('voiceSearch');

  const yaVioElAviso = () => {
    try { return localStorage.getItem(CLAVE_AVISO) === '1'; } catch { return false; }
  };
  const marcarAvisoVisto = () => {
    try { localStorage.setItem(CLAVE_AVISO, '1'); } catch { /* da igual */ }
  };

  const parar = () => {
    sesion?.parar();
    sesion = null;
    escuchando = false;
  };

  const arrancar = () => {
    error = '';
    escuchando = true;
    sesion = dictar({
      locale: localeDeReconocimiento(locale),
      alEscuchar: (texto, final) => {
        const limpio = modo === 'referencia'
          ? normalizarDictado(texto, localeDeReconocimiento(locale))
          : normalizarDictadoLibre(texto);
        alDictar(limpio, final);
      },
      alFallar: (codigo) => {
        // `no-speech` es que no se dijo nada: no es un fallo que merezca un
        // mensaje rojo, simplemente no había voz.
        error = codigo === 'no-speech' ? '' : codigo;
        escuchando = false;
      },
      alTerminar: () => {
        escuchando = false;
        sesion = null;
      },
    });
  };

  const alPulsar = () => {
    if (escuchando) { parar(); return; }
    // El aviso de privacidad, una sola vez y sólo donde el audio sale del
    // dispositivo. Se enseña ANTES de abrir el micrófono, no después.
    if (usaServidorExterno() && !yaVioElAviso()) {
      avisoVisible = true;
      return;
    }
    arrancar();
  };

  const aceptarAviso = () => {
    marcarAvisoVisto();
    avisoVisible = false;
    arrancar();
  };

  onDestroy(parar);
</script>

{#if disponible}
  <div class="dictado">
    <button
      type="button"
      class="dictado__boton"
      class:dictado__boton--activo={escuchando}
      aria-pressed={escuchando}
      aria-label={etiqueta || $_('app.speech.start')}
      title={escuchando ? $_('app.speech.stop') : $_('app.speech.start')}
      on:click|stopPropagation={alPulsar}
    >
      <Icon name="microphone" weight={escuchando ? 'fill' : 'regular'} />
    </button>

    {#if escuchando}
      <!-- Sin esto no hay forma de saber si el micrófono está abierto: el
           navegador enseña su propio indicador, pero en una pestaña de fondo o
           en un televisor no se ve. -->
      <span class="dictado__estado" role="status">{$_('app.speech.listening')}</span>
    {:else if error}
      <span class="dictado__estado dictado__estado--error" role="status">
        {$_(error === 'not-allowed' ? 'app.speech.denied' : 'app.speech.failed')}
      </span>
    {/if}
  </div>

  {#if avisoVisible}
    <div class="aviso" role="dialog" aria-label={$_('app.speech.notice_title')}>
      <p class="aviso__titulo">{$_('app.speech.notice_title')}</p>
      <p class="aviso__texto">{$_('app.speech.notice_text')}</p>
      <div class="aviso__acciones">
        <button type="button" class="aviso__no" on:click={() => (avisoVisible = false)}>
          {$_('app.topics.cancel')}
        </button>
        <button type="button" class="aviso__si" on:click={aceptarAviso}>
          {$_('app.speech.notice_accept')}
        </button>
      </div>
    </div>
  {/if}
{:else if bloqueadoPorPlan}
  <!-- Con los planes activos y sin suscripción: se enseña que existe, no se
       esconde. Quien no lo ve no puede echarlo de menos ni pagarlo. -->
  <button type="button" class="dictado__boton dictado__boton--plan" title={$_('app.speech.plan_needed')} aria-label={$_('app.speech.plan_needed')}>
    <Icon name="microphone" />
  </button>
{/if}

<style lang="scss">
  .dictado {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .dictado__boton {
    display: inline-grid;
    place-items: center;
    // 2.25rem = 36px: por encima del mínimo de objetivo táctil (WCAG 2.5.8).
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: 1px solid var(--color-line);
    border-radius: 50%;
    background: var(--color-surface);
    color: var(--color-ink-soft);
    cursor: pointer;
    transition: var(--transition);
    --icon-size: 1.05rem;

    &:hover { border-color: var(--color-accent); color: var(--color-accent-ink); }
  }

  .dictado__boton--activo {
    border-color: var(--color-accent);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
    // Late mientras escucha. Es la única señal dentro de la aplicación de que
    // el micrófono está abierto.
    animation: latido 1.4s ease-in-out infinite;
  }

  .dictado__boton--plan {
    opacity: 0.55;
    cursor: default;
  }

  @keyframes latido {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 55%, transparent); }
    50% { box-shadow: 0 0 0 0.35rem color-mix(in srgb, var(--color-accent) 0%, transparent); }
  }

  @media (prefers-reduced-motion: reduce) {
    .dictado__boton--activo { animation: none; }
  }

  .dictado__estado {
    color: var(--color-ink-soft);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .dictado__estado--error { color: var(--color-marked-favorite); }

  // El aviso de privacidad. Va pegado al botón y no en un modal centrado: es
  // una frase, y un diálogo a pantalla completa para esto sería desproporcionado.
  .aviso {
    position: absolute;
    // Anclado bajo el botón, no en su posición estática: sin `top`/`right` el
    // navegador lo dejaba donde habría caído en el flujo, que era encima del
    // campo de al lado.
    top: 100%;
    right: 0;
    z-index: 60;
    width: max-content;
    max-width: min(22rem, calc(100vw - 2rem));
    margin-top: 0.4rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--box-shadow-lg);
  }

  .aviso__titulo {
    margin: 0 0 0.35rem;
    color: var(--color-ink-strong);
    font-size: 0.9rem;
    font-weight: 700;
  }

  .aviso__texto {
    margin: 0 0 0.75rem;
    color: var(--color-ink-soft);
    font-size: 0.82rem;
    line-height: 1.5;
  }

  .aviso__acciones {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .aviso__no,
  .aviso__si {
    min-height: 2.2rem;
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    color: var(--color-ink);
    font: inherit;
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;
  }

  .aviso__si {
    border-color: var(--color-accent);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);
  }
</style>
