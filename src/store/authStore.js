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
