import { writable, get } from 'svelte/store';
import * as searchesService from '../services/searches.service';
import { currentUser } from './authStore';
import { tokenStore } from '../services/apiClient';
import { registrarSincronizacion } from '../services/resync.service';

// Reaccionar al usuario actual: cuando cambia, recargar searches del namespace
// y, si hay token, sincronizar del backend (multi-device).
currentUser.subscribe(async (user) => {
  searchesService.setCurrentUser(user?.id || null);
  if (user && tokenStore.get()) {
    await searchesService.syncFromServer();
  }
  setTimeout(() => searchesStore.refresh(), 0);
});

const createSearchesStore = () => {
  const { subscribe, set } = writable(searchesService.loadSearches());

  const refresh = () => set(searchesService.loadSearches());

  return {
    subscribe,
    // Guardar una búsqueda (llamar desde el filter cuando cambia searchText)
    save: async (form) => {
      const result = await searchesService.saveSearch(form);
      refresh();
      return result;
    },
    // Eliminar una búsqueda del historial
    remove: async (id) => {
      const result = await searchesService.removeSearch(id);
      refresh();
      return result;
    },
    // Devolver las últimas N búsquedas para el dropdown
    recent: (n = 10) => get({ subscribe }).slice(0, n),
    // Devolver últimas N búsquedas filtradas por tipo + idioma + version
    //
    // El tipo se compara en dos grupos y no valor a valor: hoy sólo hay
    // «referencia» y «lo demás», pero el historial guarda `match`, `every` y
    // `some` de cuando eran tres radios. Comparando el valor exacto, todo lo
    // buscado antes del 25 sep 2026 desaparecía del desplegable sin que el
    // usuario hubiera borrado nada.
    recentFiltered: (n = 10, opts = {}) => {
      const all = get({ subscribe });
      const grupo = (tipo) => (tipo === 'reference' ? 'reference' : 'palabras');
      return all
        .filter((s) => {
          if (opts.searchType && grupo(s.searchType) !== grupo(opts.searchType)) return false;
          if (opts.locale && s.locale && s.locale !== opts.locale) return false;
          if (opts.version && s.version && s.version !== opts.version) return false;
          return true;
        })
        .slice(0, n);
    },
    reset: () => {
      searchesService.resetAll();
      refresh();
    },
    refresh,
  };
};

export const searchesStore = createSearchesStore();

// Releer del servidor al volver a la aplicación. Ver `resync.service.js`.
registrarSincronizacion("searches", searchesService.syncFromServer, searchesStore.refresh);
