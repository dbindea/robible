// Favorites store: reactivo a currentUser.
// Cuando el usuario cambia, recarga del backend (o cache LS).

import { writable, get } from 'svelte/store';
import * as favsService from '../services/favorites.service';
import { currentUser } from './authStore';
import { tokenStore } from '../services/apiClient';

const initial = favsService.loadFavorites();
const { subscribe, set } = writable(initial);

currentUser.subscribe(async (user) => {
  favsService.setCurrentUser(user?.id || null);
  // Intentar sincronizar con backend si hay token
  if (user && tokenStore.get()) {
    await favsService.syncFromServer();
  }
  set(favsService.loadFavorites());
});

export const favoritesStore = {
  subscribe,
  isFavorite: (book, chapter, verse) => {
    const list = get({ subscribe });
    return list.some((f) => f.book === book && f.chapter === chapter && f.verse === verse);
  },
  toggle: async (book, chapter, verse) => {
    const result = await favsService.toggleFavorite(book, chapter, verse);
    if (result.ok) set(favsService.loadFavorites());
    return result;
  },
  add: async (book, chapter, verse) => {
    const result = await favsService.addFavorite(book, chapter, verse);
    if (result.ok) set(favsService.loadFavorites());
    return result;
  },
  remove: async (book, chapter, verse) => {
    const result = await favsService.removeFavorite(book, chapter, verse);
    if (result.ok) set(favsService.loadFavorites());
    return result;
  },
  refresh: () => set(favsService.loadFavorites()),
};
