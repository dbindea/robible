// Store de memorización: mismo patrón que favoritesStore.
// Al cambiar de usuario recarga del backend (o de la cache en localStorage).

import { writable, get } from 'svelte/store';
import * as memService from '../services/memorize.service';
import { currentUser } from './authStore';
import { tokenStore } from '../services/apiClient';

const initial = memService.loadMemorizations();
const { subscribe, set } = writable(initial);

currentUser.subscribe(async (user) => {
  memService.setCurrentUser(user?.id || null);
  if (user && tokenStore.get()) {
    await memService.syncFromServer();
  }
  set(memService.loadMemorizations());
});

export const memorizeStore = {
  subscribe,
  isMemorizing: (book, chapter, verse) => {
    const list = get({ subscribe });
    return list.some((m) => m.book === book && m.chapter === chapter && m.verse === verse);
  },
  toggle: async (book, chapter, verse) => {
    const result = await memService.toggleMemorization(book, chapter, verse);
    if (result.ok) set(memService.loadMemorizations());
    return result;
  },
  add: async (book, chapter, verse) => {
    const result = await memService.addMemorization(book, chapter, verse);
    if (result.ok) set(memService.loadMemorizations());
    return result;
  },
  remove: async (book, chapter, verse) => {
    const result = await memService.removeMemorization(book, chapter, verse);
    if (result.ok) set(memService.loadMemorizations());
    return result;
  },
  // Registrar un repaso siempre repinta, acierto o fallo: la fecha del próximo
  // cambia en los dos casos y la lista está ordenada justo por esa fecha.
  review: async (book, chapter, verse, acertado) => {
    const result = await memService.reviewMemorization(book, chapter, verse, acertado);
    set(memService.loadMemorizations());
    return result;
  },
  refresh: () => set(memService.loadMemorizations()),
};
