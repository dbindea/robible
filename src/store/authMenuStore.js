/**
 * Auth menu store — controla el modal de autenticación.
 * Se abre desde el AppMenu (Autentificare) o desde el Footer.
 */

import { writable } from 'svelte/store';

export const authMenuOpen = writable(false);

/**
 * El token que llegó en el enlace del correo de recuperación.
 *
 * Lo rescata `App.svelte` de `window.__robibleRecuperare`, que a su vez lo deja
 * un script de `index.html` **antes de cargar nada** — ahí está el motivo de
 * todo este camino tan indirecto: si el token siguiera en la URL cuando arranca
 * Google Analytics, se lo llevaría dentro de `page_location`. Ver el comentario
 * de ese script.
 *
 * Mientras valga algo, `AuthModal` enseña la pantalla de contraseña nueva por
 * encima de cualquier otra cosa, sesión abierta incluida.
 */
export const tokenRecuperacion = writable('');

export const openAuthMenu = () => authMenuOpen.set(true);
export const closeAuthMenu = () => {
  authMenuOpen.set(false);
  // Se limpia al cerrar: si no, volver a abrir «Autentificare» más tarde
  // devolvería a la pantalla de contraseña nueva con un token ya gastado.
  tokenRecuperacion.set('');
};
export const toggleAuthMenu = () => authMenuOpen.update((v) => !v);

/** Abre el modal directamente en «escribe tu contraseña nueva». */
export const abrirRecuperacion = (token) => {
  tokenRecuperacion.set(token || '');
  authMenuOpen.set(true);
};
