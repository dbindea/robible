// Highlights store: reactivo a currentUser.
// Misma mecánica que favoritesStore — al cambiar de usuario recarga del backend
// (o de la cache localStorage si no hay red).

import { writable, get } from 'svelte/store';
import * as highlightsService from '../services/highlights.service';
import { currentUser } from './authStore';
import { tokenStore } from '../services/apiClient';

const initial = highlightsService.loadHighlights();
const { subscribe, set } = writable(initial);

currentUser.subscribe(async (user) => {
  highlightsService.setCurrentUser(user?.id || null);
  if (user && tokenStore.get()) {
    await highlightsService.syncFromServer();
  }
  set(highlightsService.loadHighlights());
});

export const highlightsStore = {
  subscribe,
  get: (book, chapter, verse) => {
    const list = get({ subscribe });
    return list.find((h) => h.book === book && h.chapter === chapter && h.verse === verse) || null;
  },
  set: async (book, chapter, verse, color) => {
    const result = await highlightsService.setHighlight(book, chapter, verse, color);
    if (result.ok) set(highlightsService.loadHighlights());
    return result;
  },
  toggle: async (book, chapter, verse, color) => {
    const result = await highlightsService.toggleHighlight(book, chapter, verse, color);
    // Aunque el backend responda 404 al borrar, la cache local ya quedó limpia:
    // refrescamos siempre para que la UI no muestre un subrayado que ya no está.
    set(highlightsService.loadHighlights());
    return result;
  },
  remove: async (book, chapter, verse) => {
    const result = await highlightsService.removeHighlight(book, chapter, verse);
    set(highlightsService.loadHighlights());
    return result;
  },
  refresh: () => set(highlightsService.loadHighlights()),
};
