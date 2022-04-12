import { writable } from 'svelte/store';

export const filter = writable({
  searchText: null,
  searchType: 'aprox',
  testament: '',
  book: [],
});
