<script>
  /**
   * Instalar la aplicación y avisar de que hay versión nueva.
   *
   * **La invitación a instalar es un diálogo centrado, y vuelve a salir cada
   * vez que se entra** (16 sep 2026). Antes era un aviso pegado abajo a la
   * derecha, y ahí tenía dos problemas: en el móvil el botón flotante de
   * «leer con música» caía justo encima y no dejaba pulsarlo, y cerrarlo una
   * sola vez lo apagaba PARA SIEMPRE — quien lo descartaba sin leerlo no
   * volvía a saber que la Biblia se podía instalar.
   *
   * Ahora hay dos salidas distintas y esa diferencia es el punto:
   *
   *   «Más tarde»            cierra y reaparece la próxima vez que entre
   *   «No mostrarme más»     se guarda y no vuelve nunca
   *
   * El aviso de versión nueva se queda como estaba, abajo a la derecha: no
   * pide nada y no puede cortar lo que se está leyendo.
   */
  import { onDestroy, onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import Modal from '../../components/Modal.svelte';
  import Icon from '../../components/Icon.svelte';
  import InstalarInsignia from '../../components/InstalarInsignia.svelte';
  import { instalar } from '../../services/pwa-install.service';

  const INSTALL_DISMISSED_KEY = 'robible:pwa-install-dismissed';
  const IOS_HELP_DISMISSED_KEY = 'robible:pwa-ios-help-dismissed';

  /**
   * Cuánto se espera antes de ofrecerlo.
   *
   * El diálogo del versículo del día sale a los 900 ms; dos diálogos a la vez
   * es lo que hay que evitar, así que éste entra después y además comprueba
   * que no haya ninguno abierto — `Modal` marca el `body` con `drawer-open`.
   */
  const ESPERA_MS = 2600;
  const REINTENTO_MS = 1500;
  const REINTENTOS = 8;

  let installPromptEvent = null;
  let updateRegistration = null;
  let isUpdateAvailable = false;
  // Qué se está ofreciendo: '' | 'install' | 'ios'. Es el único estado del
  // diálogo; había además un `canInstall` y un `showIosHelp` que decían lo
  // mismo con otras palabras, y tres banderas para una caja que sólo puede
  // estar abierta o cerrada es donde se cuelan las incoherencias.
  let ofreciendo = '';
  let temporizador = null;

  const getStandaloneState = () => {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  };

  const getIsIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isTouchMac = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;

    return /iphone|ipad|ipod/.test(userAgent) || isTouchMac;
  };

  const getDismissed = (key) => {
    try {
      return window.localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  };

  const setDismissed = (key) => {
    try {
      window.localStorage.setItem(key, 'true');
    } catch {
      // The prompt can be dismissed for the current session even if storage is unavailable.
    }
  };

  /**
   * ¿La tiene instalada?
   *
   * No hay una respuesta directa que funcione en todas partes, pero entre dos
   * señales se cubre: `beforeinstallprompt` **sólo se dispara si NO está
   * instalada**, así que en Android y escritorio su mera llegada es la
   * respuesta; en iOS ese evento no existe y lo que se mira es si la página se
   * abrió en modo aplicación (`display-mode: standalone`). No hace falta
   * preguntarle nada al usuario.
   */
  const handleBeforeInstallPrompt = (event) => {
    event.preventDefault();
    installPromptEvent = event;

    if (!getDismissed(INSTALL_DISMISSED_KEY)) {
      ofrecer('install');
    }
  };

  const handleInstallAvailable = () => {
    installPromptEvent = window.robibleDeferredInstallPrompt || installPromptEvent;

    if (installPromptEvent && !getDismissed(INSTALL_DISMISSED_KEY)) {
      ofrecer('install');
    }
  };

  // El diálogo del navegador lo lanza el servicio, que es el único dueño del
  // evento: el pie ofrece lo mismo desde su insignia y el navegador sólo deja
  // usarlo una vez, así que dos copias del evento dejaban un botón muerto.
  const handleInstall = async () => {
    ofreciendo = '';
    installPromptEvent = null;
    await instalar();
  };

  /**
   * «Más tarde»: cierra y ya está.
   *
   * NO se guarda nada, a propósito. El diálogo vuelve a salir la próxima vez
   * que se abra la aplicación, porque instalarla es lo que la hace servir sin
   * internet y quien todavía no la tiene se está perdiendo justo eso. Para no
   * volver a verlo está el otro botón, que sí lo dice expresamente.
   */
  const masTarde = () => {
    ofreciendo = '';
  };

  /** «No mostrarme más»: esto sí se recuerda, y para siempre. */
  const noMostrarMas = () => {
    const clave = ofreciendo === 'ios' ? IOS_HELP_DISMISSED_KEY : INSTALL_DISMISSED_KEY;
    ofreciendo = '';
    setDismissed(clave);
  };

  /**
   * Abre el diálogo cuando no haya otro por medio.
   *
   * Reintenta unas cuantas veces en vez de rendirse a la primera: el diálogo
   * del versículo del día puede estar abierto un buen rato, y si nos rindiéramos
   * la invitación a instalar no saldría precisamente el día que más se usa.
   */
  const ofrecer = (tipo, espera = ESPERA_MS, intentos = REINTENTOS) => {
    // Se llama desde los manejadores y NO desde un bloque reactivo: `ofrecer`
    // escribe `ofreciendo`, así que un `$:` que dependiera de él se
    // reevaluaría a sí mismo — el aviso de `infinite-reactive-loop` que salta
    // el linter, y con razón.
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(() => {
      if (ofreciendo) return; // ya hay uno abierto
      const hayOtroDialogo = document.body.classList.contains('drawer-open');
      if (hayOtroDialogo) {
        if (intentos > 0) ofrecer(tipo, REINTENTO_MS, intentos - 1);
        return;
      }
      ofreciendo = tipo;
    }, espera);
  };

  const handleAppInstalled = () => {
    ofreciendo = '';
    installPromptEvent = null;
  };

  const handleUpdateAvailable = (event) => {
    updateRegistration = event.detail?.registration || window.robibleUpdateRegistration || null;
    isUpdateAvailable = Boolean(updateRegistration?.waiting);
  };

  const applyUpdate = () => {
    if (!updateRegistration?.waiting) {
      window.location.reload();
      return;
    }

    updateRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  onMount(() => {
    const isStandalone = getStandaloneState();

    handleInstallAvailable();
    handleUpdateAvailable({});

    if (getIsIos() && !isStandalone && !getDismissed(IOS_HELP_DISMISSED_KEY)) {
      // En iOS no hay `beforeinstallprompt`, así que la explicación de
      // «Compartir → Añadir a pantalla de inicio» es la única forma de
      // instalarla y sale por su cuenta.
      ofrecer('ios');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('robible:pwa-install-available', handleInstallAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('robible:pwa-update-available', handleUpdateAvailable);
  });

  onDestroy(() => {
    window.clearTimeout(temporizador);
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('robible:pwa-install-available', handleInstallAvailable);
    window.removeEventListener('appinstalled', handleAppInstalled);
    window.removeEventListener('robible:pwa-update-available', handleUpdateAvailable);
  });
</script>

{#if isUpdateAvailable}
  <aside class="pwa-notice" role="status" aria-live="polite">
    <div>
      <strong>{$_('app.pwa.update_title')}</strong>
      <p>{$_('app.pwa.update_text')}</p>
    </div>
    <button type="button" class="pwa-notice__primary" on:click={applyUpdate}>
      {$_('app.pwa.update_action')}
    </button>
  </aside>
{/if}

<!-- ── Instalar: diálogo centrado ──────────────────────────────────────────
     En el centro y no en una esquina porque es una oferta que hay que leer, y
     abajo a la derecha competía con tres botones flotantes. `fitContent`
     porque es corto: sin él, la hoja de móvil ocupa 92 dvh y sale medio vacía
     (CLAUDE.md, trampa 20). -->
<Modal
  open={ofreciendo !== ''}
  title={ofreciendo === 'ios' ? $_('app.pwa.ios_title') : $_('app.pwa.install_title')}
  eyebrow="RoBible"
  size="sm"
  fitContent
  onClose={masTarde}
>
  <p class="instalar__texto">
    {ofreciendo === 'ios' ? $_('app.pwa.ios_text') : $_('app.pwa.install_text')}
  </p>

  <!-- Para qué sirve instalarla. Sin esto, «Instalar» es una palabra que la
       gente asocia a ocupar espacio en el móvil, no a leer sin cobertura. -->
  <ul class="instalar__ventajas">
    <li><Icon name="globe" size="0.95rem" /> {$_('app.pwa.install_benefit_offline')}</li>
    <li><Icon name="expand" size="0.95rem" /> {$_('app.pwa.install_benefit_screen')}</li>
    <li><Icon name="flame" size="0.95rem" /> {$_('app.pwa.install_benefit_fast')}</li>
  </ul>

  <!-- La misma insignia que el pie. Es lo que hace que «instalar» se lea como
       «descargar una aplicación» y no como un ajuste del navegador, y que los
       dos sitios que lo ofrecen se reconozcan como lo mismo. -->
  {#if ofreciendo === 'install'}
    <div class="instalar__insignia">
      <InstalarInsignia onClick={handleInstall} />
    </div>
  {/if}

  <svelte:fragment slot="footer">
    <!-- «No mostrarme más» a la izquierda y sin marco: es una salida, no una
         de las dos acciones. Puestos los dos con el mismo aspecto, se pulsa
         por error el que apaga el aviso para siempre. -->
    <button type="button" class="instalar__nunca" on:click={noMostrarMas}>
      {$_('app.pwa.install_never')}
    </button>
    <button type="button" class="pwa-notice__ghost" on:click={masTarde}>
      {$_('app.pwa.install_later')}
    </button>
  </svelte:fragment>
</Modal>

<style lang="scss">
  .pwa-notice {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 20;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.85rem;
    align-items: center;
    width: min(30rem, calc(100vw - 2rem));
    padding: 0.9rem;
    border: 1px solid var(--color-line-strong);
    border-left: 0.3rem solid var(--color-blue);
    border-radius: 0.35rem;
    background: var(--color-white);
    box-shadow: var(--box-shadow-down);
    color: var(--color-bg-dark);

    strong {
      display: block;
      margin-bottom: 0.12rem;
      font-weight: 700;
      line-height: 1.25;
    }

    p {
      margin: 0;
      color: var(--color-ink-soft);
      font-size: 0.88rem;
      line-height: 1.4;
    }
  }

  .pwa-notice__primary,
  .pwa-notice__ghost {
    min-height: 2.25rem;
    border-radius: 0.25rem;
    padding: 0 0.85rem;
    font-size: 0.88rem;
    font-weight: 600;
    transition: var(--transition);
  }

  .pwa-notice__primary {
    border: 1px solid var(--color-blue);
    background: var(--color-accent-solid);
    color: var(--color-on-primary);

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue-hover);
      background: var(--color-blue-hover);
    }
  }

  .pwa-notice__ghost {
    border: 1px solid var(--color-line-strong);
    background: transparent;
    color: var(--color-bg-dark);

    &:hover,
    &:focus-visible {
      border-color: var(--color-bg-dark);
      background: var(--color-line-soft);
    }
  }

  @media (max-width: 38rem) {
    .pwa-notice {
      right: 0.75rem;
      bottom: 0.75rem;
      grid-template-columns: minmax(0, 1fr);
    }
  }

  // ── Diálogo de instalación ────────────────────────────────────────────────
  .instalar__insignia {
    display: flex;
    justify-content: center;
    margin-top: 1.1rem;
  }

  .instalar__texto {
    margin: 0 0 0.9rem;
    color: var(--color-ink);
    font-size: var(--font-size-small);
    line-height: 1.5;
  }

  .instalar__ventajas {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      color: var(--color-ink-soft);
      font-size: 0.85rem;
      line-height: 1.4;
      --icon-size: 0.95rem;
    }
  }

  // Sin marco y a la izquierda del todo: apaga el aviso para siempre, así que
  // no puede parecerse a los otros dos botones.
  .instalar__nunca {
    margin-right: auto;
    min-height: 2.25rem;
    padding: 0 0.35rem;
    border: 0;
    background: transparent;
    color: var(--color-ink-soft);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      color: var(--color-ink);
      text-decoration: underline;
    }
  }
  // ── Cristal ───────────────────────────────────────────────────────────
  // El fondo opaco de la regla de arriba es la base y se queda: si el
  // navegador no desenfoca, el texto se lee sobre color sólido en vez de
  // sobre el contenido de la página. La transparencia sólo entra donde hay
  // desenfoque real.
  @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
    .pwa-notice {
      background: var(--glass-tint);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
      border-color: var(--glass-line);
    }
  }
</style>
