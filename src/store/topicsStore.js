import { writable, get } from 'svelte/store';
import * as topicsService from '../services/topics.service';
import { currentUser } from './authStore';
import { tokenStore } from '../services/apiClient';

// Reaccionar al usuario actual: cuando cambia, recargar topics del namespace
// y, si hay token, sincronizar del backend (multi-device).
currentUser.subscribe(async (user) => {
  topicsService.setCurrentUser(user?.id || null);
  if (user && tokenStore.get()) {
    await topicsService.syncFromServer();
    // Si tras sincronizar no tiene topics, seedear defaults
    const topics = topicsService.loadTopics();
    if (topics.length === 0) {
      await topicsService.seedDefaultsForUser();
    }
  }
  setTimeout(() => topicsStore.refresh(), 0);
});

const initial = {
  topics: topicsService.loadTopics(),
  verseRefs: topicsService.loadVerseRefs(),
};

const createTopicsStore = () => {
  const { subscribe, set } = writable(initial);

  const refresh = () => {
    set({
      topics: topicsService.loadTopics(),
      verseRefs: topicsService.loadVerseRefs(),
    });
  };

  return {
    subscribe,
    create: async (data) => {
      const t = await topicsService.createTopic(data);
      refresh();
      return t;
    },
    update: async (id, patch) => {
      const t = await topicsService.updateTopic(id, patch);
      refresh();
      return t;
    },
    remove: async (id) => {
      const ok = await topicsService.deleteTopic(id);
      refresh();
      return ok;
    },
    addVerse: async (topicId, ref) => {
      const ok = await topicsService.addVerseRef(topicId, ref);
      if (ok) refresh();
      return ok;
    },
    removeVerse: async (topicId, ref) => {
      const ok = await topicsService.removeVerseRef(topicId, ref);
      if (ok) refresh();
      return ok;
    },
    reset: () => {
      topicsService.resetAll();
      refresh();
    },
    refresh,
  };
};

export const topicsStore = createTopicsStore();

export const topicsContainingVerse = (book, chapter, verse) => {
  const state = get(topicsStore);
  return state.topics.filter((t) =>
    (state.verseRefs[t.id] || []).some(
      (v) => v.book === book && v.chapter === chapter && v.verse === verse,
    ),
  );
};
