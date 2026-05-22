import { writable } from 'svelte/store';
import {
  BIBLE_VERSIONS,
  DEFAULT_BIBLE_VERSION,
  getBibleVersionConfig,
  getBibleVersionConfigOrDefault,
} from '../config/bible-versions';

export const BIBLE_VERSION_STORAGE_KEY = 'selectedBibleVersion';
export { DEFAULT_BIBLE_VERSION, getBibleVersionConfig, getBibleVersionConfigOrDefault };
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
    const version = localStorage.getItem(BIBLE_VERSION_STORAGE_KEY);
    return isValidBibleVersion(version) ? version : DEFAULT_BIBLE_VERSION;
  } catch {
    return DEFAULT_BIBLE_VERSION;
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

selectedBibleVersion.subscribe((version) => {
  try {
    if (isValidBibleVersion(version)) {
      localStorage.setItem(BIBLE_VERSION_STORAGE_KEY, version);
    }
  } catch {
    // localStorage can be unavailable; the in-memory store still works.
  }
});

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
