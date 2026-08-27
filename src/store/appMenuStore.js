/**
 * App menu store — controla el sidebar lateral que se abre al hacer
 * click en el logo. Es independiente del BookDrawer (libros) y
 * contendrá Compare, Favoritos, Usuario, Login/Logout, etc.
 */

import { writable } from 'svelte/store';

export const appMenuOpen = writable(false);

export const openAppMenu = () => appMenuOpen.set(true);
export const closeAppMenu = () => appMenuOpen.set(false);
export const toggleAppMenu = () => appMenuOpen.update((v) => !v);
