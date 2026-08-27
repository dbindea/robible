import { writable, derived, get } from 'svelte/store';
import * as topicsService from '../services/topics.service';
import { currentUser } from './authStore';

// Reaccionar al usuario actual: cuando cambia, recargar topics del namespace
currentUser.subscribe((user) => {
  topicsService.setCurrentUser(user?.id || null);
  // Forzar recarga del store
  setTimeout(() => {
    topicsStore.refresh();
  }, 0);
});

const initial = {
  topics: topicsService.loadTopics(),
  verseRefs: topicsService.loadVerseRefs(),
};

const createTopicsStore = () => {
  const { subscribe, set, update } = writable(initial);

  const refresh = () => {
    set({
      topics: topicsService.loadTopics(),
      verseRefs: topicsService.loadVerseRefs(),
    });
  };

  return {
    subscribe,
    create: (data) => {
      const t = topicsService.createTopic(data);
      refresh();
      return t;
    },
    update: (id, patch) => {
      const t = topicsService.updateTopic(id, patch);
      refresh();
      return t;
    },
    remove: (id) => {
      const ok = topicsService.deleteTopic(id);
      refresh();
      return ok;
    },
    addVerse: (topicId, ref) => {
      const ok = topicsService.addVerseRef(topicId, ref);
      if (ok) refresh();
      return ok;
    },
    removeVerse: (topicId, ref) => {
      const ok = topicsService.removeVerseRef(topicId, ref);
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

// Helpers
export const topicsContainingVerse = (book, chapter, verse) => {
  const state = get(topicsStore);
  return state.topics.filter((t) =>
    (state.verseRefs[t.id] || []).some(
      (v) => v.book === book && v.chapter === chapter && v.verse === verse,
    ),
  );
};
