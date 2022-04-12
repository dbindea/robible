import { writable } from 'svelte/store';

const form = JSON.parse(localStorage.getItem('filter') || '{}');

const formValues = {
  searchText: form.searchText || null,
  searchType: form.searchType || 'aprox',
  testament: form.testament || '',
  book: form.book || [],
};

export const filter = writable(formValues);