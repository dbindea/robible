import { writable } from 'svelte/store';
import {
  BIBLE_VERSIONS,
  DEFAULT_BIBLE_VERSION,
  getBibleVersionConfig,
  getBibleVersionConfigOrDefault,
  getAvailableBibleVersions,
  getDefaultCompareWith,
} from '../config/bible-versions';
import { parseBiblePath, parseLegacyVersePath } from '../services/bible-route.service';

export const BIBLE_VERSION_STORAGE_KEY = 'selectedBibleVersion';
export const COMPARE_WITH_STORAGE_KEY = 'robible:compareWith';
export const THEME_STORAGE_KEY = 'robible:theme';
export const IMMERSIVE_STORAGE_KEY = 'robible:immersive';
export { DEFAULT_BIBLE_VERSION, getBibleVersionConfig, getBibleVersionConfigOrDefault, getAvailableBibleVersions, getDefaultCompareWith };
export const bibleVersions = BIBLE_VERSIONS;

export const isValidBibleVersion = (value) => {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]*$/i.test(value);
};

const getSavedFilter = () => {
  try {
    return JSON.parse(localStorage.getItem('filter') || '{}');
  } catch {
    return {};
  }
};

const getSavedBibleVersion = () => {
  try {
    const url = new URL(window.location.href);
    const pathVersion = parseBiblePath(url.pathname)?.version || parseLegacyVersePath(url.pathname)?.version;
    const requestedVersion = url.searchParams.get('version') || pathVersion;

    if (isValidBibleVersion(requestedVersion)) {
      return requestedVersion;
    }

    const version = localStorage.getItem(BIBLE_VERSION_STORAGE_KEY);
    return isValidBibleVersion(version) ? version : DEFAULT_BIBLE_VERSION;
  } catch {
    return DEFAULT_BIBLE_VERSION;
  }
};

const isValidThemeMode = (value) => value === 'light' || value === 'dark';

const getSystemThemeMode = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

const getSavedThemeMode = () => {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return isValidThemeMode(savedTheme) ? savedTheme : getSystemThemeMode();
  } catch {
    return getSystemThemeMode();
  }
};

const applyThemeMode = (themeMode) => {
  try {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', themeMode === 'dark' ? '#0f1720' : '#3f5867');
  } catch {
    // The theme store can still be used in memory if document is unavailable.
  }
};

export const createDefaultSearchForm = () => ({
  searchText: null,
  searchType: 'match',
  testament: 'all',
  book: [],
  chapter: [],
});

const createSearchForm = (form = {}) => ({
  searchText: form.searchText || null,
  searchType: form.searchType || 'match',
  testament: form.testament || 'all',
  book: Array.isArray(form.book) ? form.book : [],
  chapter: Array.isArray(form.chapter) ? form.chapter : [],
});

export const filter = writable(createSearchForm(getSavedFilter()));

export const selectedBibleVersion = writable(getSavedBibleVersion());
export const themeMode = writable(getSavedThemeMode());

// Compare-with version: which secondary Bible to load for compare mode
const isValidCompareWith = (value, primary) => {
  if (typeof value !== 'string' || !isValidBibleVersion(value)) return false;
  // No puede ser igual a la versión primaria
  if (value === primary) return false;
  // Tiene que estar en la lista de versiones disponibles
  return BIBLE_VERSIONS.some((v) => v.value === value && v.available);
};

const getSavedCompareWith = () => {
  try {
    const saved = localStorage.getItem(COMPARE_WITH_STORAGE_KEY);
    const primary = localStorage.getItem(BIBLE_VERSION_STORAGE_KEY) || DEFAULT_BIBLE_VERSION;
    if (isValidCompareWith(saved, primary)) return saved;
  } catch {
    // ignore
  }
  return getDefaultCompareWith(getSavedBibleVersion());
};

// LAZY LOADING: No cargamos la compare Bible hasta que el usuario entre en modo comparación
// Esto evita descargar ~8MB (2 Biblias) en cada visita
export const compareWithVersion = writable(null); // Inicia null, se setea cuando usuario entra en compare

compareWithVersion.subscribe((value) => {
  try {
    if (value) {
      localStorage.setItem(COMPARE_WITH_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(COMPARE_WITH_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
});

// Helper para inicializar compareWith desde localStorage cuando usuario entra en modo comparación
export const initCompareVersion = () => {
  const saved = getSavedCompareWith();
  if (saved) {
    compareWithVersion.set(saved);
  }
};

selectedBibleVersion.subscribe((version) => {
  try {
    if (isValidBibleVersion(version)) {
      localStorage.setItem(BIBLE_VERSION_STORAGE_KEY, version);
    }
  } catch {
    // localStorage can be unavailable; the in-memory store still works.
  }

  // Si la versión primaria cambia y coincide con compareWith, reset compareWith al default
  compareWithVersion.update((cw) => {
    if (cw === version) {
      const fallback = getDefaultCompareWith(version);
      return fallback;
    }
    return cw;
  });
});

themeMode.subscribe((mode) => {
  if (!isValidThemeMode(mode)) {
    return;
  }

  applyThemeMode(mode);
});

try {
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  systemTheme.addEventListener('change', (event) => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      themeMode.set(event.matches ? 'dark' : 'light');
    }
  });
} catch {
  // System theme detection is optional.
}

export const toggleThemeMode = () => {
  themeMode.update((mode) => {
    const nextMode = mode === 'dark' ? 'light' : 'dark';

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch {
      // Theme changes still apply for this session if storage is unavailable.
    }

    return nextMode;
  });
};

export const resetFilter = () => {
  const searchForm = createDefaultSearchForm();

  try {
    localStorage.removeItem('filter');
  } catch {
    // Ignore storage errors; filter state is still reset for this session.
  }

  filter.set(searchForm);
  return searchForm;
};

// Immersive reading mode
const getSavedImmersiveMode = () => {
  try {
    const saved = localStorage.getItem(IMMERSIVE_STORAGE_KEY);
    return saved === 'true';
  } catch {
    return false;
  }
};

export const immersiveMode = writable(getSavedImmersiveMode());

immersiveMode.subscribe((value) => {
  try {
    localStorage.setItem(IMMERSIVE_STORAGE_KEY, String(value));
  } catch {
    // localStorage can be unavailable.
  }
  // Also toggle body class for CSS targeting
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('immersive-mode', value);
  }
});

export const toggleImmersiveMode = () => {
  immersiveMode.update((v) => !v);
};
