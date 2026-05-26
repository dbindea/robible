import App from './App.svelte';
import { mount } from 'svelte';

const app = mount(App, {
  target: document.getElementById('app'),
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.robibleDeferredInstallPrompt = event;
  window.dispatchEvent(new CustomEvent('robible:pwa-install-available'));
});

window.addEventListener('appinstalled', () => {
  window.robibleDeferredInstallPrompt = null;
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let isRefreshing = false;
  let hadController = Boolean(navigator.serviceWorker.controller);

  const notifyUpdateAvailable = (registration) => {
    window.robibleUpdateRegistration = registration;
    window.dispatchEvent(new CustomEvent('robible:pwa-update-available', { detail: { registration } }));
  };

  const activateInitialWorker = (registration) => {
    if (!navigator.serviceWorker.controller && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const handleInstalledWorker = (registration) => {
    if (navigator.serviceWorker.controller) {
      notifyUpdateAvailable(registration);
      return;
    }

    activateInitialWorker(registration);
  };

  const watchInstallingWorker = (registration) => {
    const worker = registration.installing;

    if (!worker) {
      return;
    }

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        handleInstalledWorker(registration);
      }
    });
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !isRefreshing) {
      isRefreshing = true;
      window.location.reload();
      return;
    }

    hadController = true;
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (registration.waiting) {
          handleInstalledWorker(registration);
        }

        registration.addEventListener('updatefound', () => {
          watchInstallingWorker(registration);
        });

        registration.update().catch(() => {});
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}

export default app;
