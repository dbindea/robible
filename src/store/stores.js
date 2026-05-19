import { writable } from 'svelte/store';

const getSavedFilter = () => {
  try {
    return JSON.parse(localStorage.getItem('filter') || '{}');
  } catch {
    return {};
  }
};

const form = getSavedFilter();

const searchForm = {
  searchText: form.searchText || null,
  searchType: form.searchType || 'match',
  testament: form.testament || 'all',
  book: Array.isArray(form.book) ? form.book : [],
  chapter: Array.isArray(form.chapter) ? form.chapter : [],
};

export const filter = writable(searchForm);
