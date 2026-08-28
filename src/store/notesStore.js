import { writable, get } from 'svelte/store';
import * as notesService from '../services/notes.service';
import { currentUser } from './authStore';
import { tokenStore } from '../services/apiClient';

// Reaccionar al usuario actual: cuando cambia, recargar notes del namespace
// y, si hay token, sincronizar del backend (multi-device).
currentUser.subscribe(async (user) => {
  notesService.setCurrentUser(user?.id || null);
  if (user && tokenStore.get()) {
    await notesService.syncFromServer();
  }
  setTimeout(() => notesStore.refresh(), 0);
});

const createNotesStore = () => {
  const { subscribe, set } = writable(notesService.loadNotes());

  const refresh = () => set(notesService.loadNotes());

  return {
    subscribe,
    save: async (book, chapter, verse, text, color) => {
      const result = await notesService.saveNote(book, chapter, verse, text, color);
      if (result.ok) refresh();
      return result;
    },
    remove: async (book, chapter, verse) => {
      const result = await notesService.deleteNote(book, chapter, verse);
      if (result.ok) refresh();
      return result;
    },
    get: (book, chapter, verse) => {
      const notes = get({ subscribe });
      return notes.find((n) => n.book === book && n.chapter === chapter && n.verse === verse) || null;
    },
    reset: () => {
      notesService.resetAll();
      refresh();
    },
    refresh,
  };
};

export const notesStore = createNotesStore();
