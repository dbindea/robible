/**
 * Instalar RoBible, desde donde haga falta.
 *
 * Hay ya dos sitios que lo ofrecen —el diálogo que sale solo la primera vez y
 * la insignia del pie— y van a ser más. Sin un dueño único, cada uno se
 * guardaba su copia del evento `beforeinstallprompt` y bastaba con que uno lo
 * consumiera para que el otro se quedara con un botón muerto.
 *
 * El evento lo captura `main.js` antes de que monte nada y lo deja en
 * `window.robibleDeferredInstallPrompt`. Aquí se envuelve en un store para que
 * los componentes reaccionen, y se centraliza el consumo: el navegador sólo
 * deja usarlo UNA vez, así que después de aceptarlo hay que soltarlo.
 */
import { writable } from 'svelte/store';

/** `true` cuando el navegador ofrece instalarla. */
export const puedeInstalar = writable(false);

const leerEvento = () => (typeof window !== 'undefined' && window.robibleDeferredInstallPrompt) || null;

const refrescar = () => puedeInstalar.set(!!leerEvento());

if (typeof window !== 'undefined') {
  refrescar();
  window.addEventListener('robible:pwa-install-available', refrescar);
  window.addEventListener('beforeinstallprompt', () => {
    // `main.js` ya lo guardó; aquí sólo hace falta enterarse. El `setTimeout`
    // a cero deja que su manejador corra primero, sea cual sea el orden en que
    // se registraron los dos.
    setTimeout(refrescar, 0);
  });
  window.addEventListener('appinstalled', () => {
    window.robibleDeferredInstallPrompt = null;
    refrescar();
  });
}

/**
 * ¿Está abierta como aplicación instalada?
 *
 * No hay forma directa de preguntar «¿la tiene descargada?» desde una pestaña,
 * pero entre esto y `beforeinstallprompt` se cubre: el evento sólo se dispara
 * si NO está instalada, y esto dice si estamos DENTRO de la instalada.
 */
export const estaInstalada = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

/**
 * Lanza el diálogo del navegador. Devuelve `true` si el usuario aceptó.
 *
 * El evento se suelta pase lo que pase: el navegador no deja reutilizarlo, y
 * conservarlo dejaría los botones encendidos ofreciendo algo que ya no
 * funciona. Si el usuario dijo que no, el navegador volverá a ofrecerlo más
 * adelante por su cuenta y el evento llegará de nuevo.
 */
export const instalar = async () => {
  const evento = leerEvento();
  if (!evento) return false;

  try {
    evento.prompt();
    const { outcome } = await evento.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  } finally {
    window.robibleDeferredInstallPrompt = null;
    refrescar();
  }
};
