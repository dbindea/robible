// Predicaciones. Mismo patrón que los demás stores, con una diferencia: la
// lista sale SIEMPRE de localStorage, nunca de la respuesta del servidor.
// El servidor sólo alimenta la copia local (ver sermons.service.js).

import { writable, get } from 'svelte/store';
import * as sermonsService from '../services/sermons.service';
import { currentUser } from './authStore';
import { tokenStore } from '../services/apiClient';

const { subscribe, set } = writable(sermonsService.loadSermons());

const refresh = () => set(sermonsService.loadSermons());

currentUser.subscribe(async (user) => {
  sermonsService.setCurrentUser(user?.id || null);
  if (user && tokenStore.get()) {
    await sermonsService.syncFromServer();
  }
  refresh();
});

export const sermonsStore = {
  subscribe,
  refresh,

  get: (id) => sermonsService.getSermon(id),

  /** Descarga el detalle si hace falta; devuelve la predicación completa. */
  load: async (id) => {
    const s = await sermonsService.fetchDetail(id);
    refresh();
    return s;
  },

  create: async (datos) => {
    const res = await sermonsService.createSermon(datos);
    refresh();
    return res;
  },

  update: async (id, cambios) => {
    const res = await sermonsService.updateSermon(id, cambios);
    refresh();
    return res;
  },

  remove: async (id) => {
    const res = await sermonsService.deleteSermon(id);
    refresh();
    return res;
  },

  duplicate: async (id) => {
    const res = await sermonsService.duplicateSermon(id);
    refresh();
    return res;
  },

  pendingCount: () => sermonsService.pendingCount(),

  reset: () => {
    sermonsService.resetAll();
    refresh();
  },
};

/** Cuenta por estado, para las pestañas de filtro. */
export const countByStatus = () => {
  const lista = get({ subscribe });
  return {
    all: lista.length,
    draft: lista.filter((s) => s.status === 'draft').length,
    ready: lista.filter((s) => s.status === 'ready').length,
    preached: lista.filter((s) => s.status === 'preached').length,
  };
};
