import { writable } from 'svelte/store';

const form = JSON.parse(localStorage.getItem('filter') || '{}');

const formValues = {
  searchText: form.searchText || null,
  searchType: form.searchType || 'aprox',
  testament: form.testament || 'all',
  book: form.book || [],
  chapter: form.chapter || [],
};

const loadingValues = {
  isLoading: false,
  time: null
}

export const filter = writable(formValues);
export const loading = writable(loadingValues);
