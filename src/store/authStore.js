/**
 * Auth store — estado reactivo de la sesión actual.
 *
 * `currentUser` es null si no hay sesión.
 * `authToken` es el token mock (cambia en cada login/register/recover).
 * `isAuthenticated` es un derived boolean.
 *
 * Cuando se añada el backend, se reemplaza la inicialización del store
 * con una llamada a `authService.me()` que también refresca el token.
 */

import { derived, writable, get } from 'svelte/store';
import * as authService from '../services/auth.service';
import { registrarSincronizacion } from '../services/resync.service';
import { tokenStore } from '../services/apiClient';

const initialUser = authService.me();
export const currentUser = writable(initialUser);
export const authToken = writable(initialUser ? localStorage.getItem('robible:session:v1') : null);

export const isAuthenticated = derived(currentUser, ($u) => !!$u);

const setSession = (result) => {
  if (result?.ok) {
    currentUser.set(result.user);
    authToken.set(result.token);
  }
  return result;
};

export const register = async (data) => {
  const result = await authService.register(data);
  return setSession(result);
};

export const login = async (nickname, password) => {
  const result = await authService.login(nickname, password);
  return setSession(result);
};

export const logout = () => {
  authService.logout();
  currentUser.set(null);
  authToken.set(null);
};

export const getSecurityQuestion = (nickname) =>
  authService.getSecurityQuestion(nickname);

export const verifySecurityAnswer = (nickname, answer) =>
  authService.verifySecurityAnswer(nickname, answer);

export const resetPassword = async (resetToken, newPassword) => {
  const result = await authService.resetPassword(resetToken, newPassword);
  return setSession(result);
};

/** Snapshot del usuario actual (no reactivo, para usar en handlers). */
export const snapshotUser = () => get(currentUser);

/**
 * Cómo se llama el usuario en pantalla.
 *
 * Si ha rellenado su nombre, manda el nombre; si no, el apodo con el que se
 * registró. Quien pone su nombre completo espera verlo, no un identificador.
 *
 * **Sólo para las pantallas propias.** El nickname sigue siendo lo único que
 * sale del lado público —la firma de una predicación publicada (trampa 68)—, y
 * eso NO se cambia aquí: el nombre real de alguien no se publica porque haya
 * rellenado un campo opcional de su perfil.
 */
export const nombreVisible = (user) => user?.fullName?.trim() || user?.nickname || '';

/** El apodo, sólo cuando aporta algo: si no hay nombre, ya se enseña arriba. */
export const apodoSecundario = (user) => (user?.fullName?.trim() ? user?.nickname || '' : '');

// ── El perfil también se resincroniza ───────────────────────────────────────
//
// `currentUser` se hidrataba UNA sola vez, de la copia que quedó en
// localStorage, y no se volvía a preguntar al servidor nunca: `verifySession`
// existía en `auth.service.js` y no la llamaba nadie. Con dos dispositivos,
// cambiar el lema, el nombre o el tipo de cuenta en uno no aparecía en el otro
// hasta cerrar sesión y volver a entrar — mientras que las notas, los favoritos
// y los temas sí se ponían al día, porque esos siete sí estaban registrados
// aquí y el perfil no.
//
// Mismo par que el resto: `sync` trae del servidor y escribe la caché,
// `refresh` vuelca la caché al store. `authService.me()` lee justo esa caché,
// así que el segundo paso es el mismo que usa el arranque.
//
// Si el token ha caducado o la cuenta se ha desactivado, `verifySession` limpia
// la sesión y `me()` devuelve null: `currentUser` pasa a null y la interfaz se
// entera en el acto. Es lo que se quiere (ver la comprobación de `is_disabled`
// en cada petición del worker). Un fallo de red NO hace eso: en ese caso
// devuelve el usuario cacheado y aquí no cambia nada.
registrarSincronizacion(
  'perfil',
  () => authService.verifySession(),
  () => currentUser.set(authService.me()),
);

// Y una vez al arrancar, porque los eventos que disparan la resincronización
// —volver a la pestaña, recuperar el foco, reconectar— no llegan a producirse
// si el usuario abre la aplicación y se queda leyendo. Sin esto, el dispositivo
// que lleva días sin abrirse enseña el perfil que guardó la última vez.
if (initialUser && tokenStore.get()) {
  authService
    .verifySession()
    .then(() => currentUser.set(authService.me()))
    .catch(() => { /* sin red se sigue con lo que hay guardado */ });
}
