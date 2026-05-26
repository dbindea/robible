<script>
  import { onDestroy, onMount } from 'svelte';
  import { _ } from '../../services/i18n.service';

  const INSTALL_DISMISSED_KEY = 'robible:pwa-install-dismissed';
  const IOS_HELP_DISMISSED_KEY = 'robible:pwa-ios-help-dismissed';

  let installPromptEvent = null;
  let canInstall = false;
  let showIosHelp = false;
  let updateRegistration = null;
  let isUpdateAvailable = false;

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

  const handleBeforeInstallPrompt = (event) => {
    event.preventDefault();
    installPromptEvent = event;

    if (!getDismissed(INSTALL_DISMISSED_KEY)) {
      canInstall = true;
    }
  };

  const handleInstallAvailable = () => {
    installPromptEvent = window.robibleDeferredInstallPrompt || installPromptEvent;

    if (installPromptEvent && !getDismissed(INSTALL_DISMISSED_KEY)) {
      canInstall = true;
    }
  };

  const handleInstall = async () => {
    if (!installPromptEvent) {
      return;
    }

    canInstall = false;
    installPromptEvent.prompt();

    try {
      await installPromptEvent.userChoice;
    } finally {
      installPromptEvent = null;
    }
  };

  const dismissInstall = () => {
    canInstall = false;
    installPromptEvent = null;
    setDismissed(INSTALL_DISMISSED_KEY);
  };

  const dismissIosHelp = () => {
    showIosHelp = false;
    setDismissed(IOS_HELP_DISMISSED_KEY);
  };

  const handleAppInstalled = () => {
    canInstall = false;
    showIosHelp = false;
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
      showIosHelp = true;
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('robible:pwa-install-available', handleInstallAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('robible:pwa-update-available', handleUpdateAvailable);
  });

  onDestroy(() => {
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
{:else if canInstall}
  <aside class="pwa-notice" role="status" aria-live="polite">
    <div>
      <strong>{$_('app.pwa.install_title')}</strong>
      <p>{$_('app.pwa.install_text')}</p>
    </div>
    <div class="pwa-notice__actions">
      <button type="button" class="pwa-notice__primary" on:click={handleInstall}>
        {$_('app.pwa.install_action')}
      </button>
      <button type="button" class="pwa-notice__ghost" on:click={dismissInstall}>
        {$_('app.pwa.dismiss')}
      </button>
    </div>
  </aside>
{:else if showIosHelp}
  <aside class="pwa-notice" role="status" aria-live="polite">
    <div>
      <strong>{$_('app.pwa.ios_title')}</strong>
      <p>{$_('app.pwa.ios_text')}</p>
    </div>
    <button type="button" class="pwa-notice__ghost" on:click={dismissIosHelp}>
      {$_('app.pwa.dismiss')}
    </button>
  </aside>
{/if}

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
    border: 1px solid rgb(63 88 103 / 18%);
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
      color: color-mix(in srgb, var(--color-bg-dark) 82%, white);
      font-size: 0.88rem;
      line-height: 1.4;
    }
  }

  .pwa-notice__actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
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
    background: var(--color-blue);
    color: var(--color-on-primary);

    &:hover,
    &:focus-visible {
      border-color: var(--color-blue-hover);
      background: var(--color-blue-hover);
    }
  }

  .pwa-notice__ghost {
    border: 1px solid rgb(63 88 103 / 22%);
    background: transparent;
    color: var(--color-bg-dark);

    &:hover,
    &:focus-visible {
      border-color: var(--color-bg-dark);
      background: rgb(63 88 103 / 7%);
    }
  }

  @media (max-width: 38rem) {
    .pwa-notice {
      right: 0.75rem;
      bottom: 0.75rem;
      grid-template-columns: minmax(0, 1fr);
    }

    .pwa-notice__actions {
      justify-content: flex-end;
    }
  }
</style>
