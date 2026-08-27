/**
 * Auth menu store — controla el modal de autenticación.
 * Se abre desde el AppMenu (Autentificare) o desde el Footer.
 */

import { writable } from 'svelte/store';

export const authMenuOpen = writable(false);

export const openAuthMenu = () => authMenuOpen.set(true);
export const closeAuthMenu = () => authMenuOpen.set(false);
export const toggleAuthMenu = () => authMenuOpen.update((v) => !v);
