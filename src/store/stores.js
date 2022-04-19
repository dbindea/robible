import { writable } from 'svelte/store';

const form = JSON.parse(localStorage.getItem('filter') || '{}');

const searchForm = {
  searchText: form.searchText || null,
  searchType: form.searchType || 'match',
  testament: form.testament || 'all',
  book: form.book || [],
  chapter: form.chapter || [],
};

export const filter = writable(searchForm);
