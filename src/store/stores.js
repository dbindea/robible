import { writable } from "svelte/store";

export const filter = writable({
  testament: 'a',
  book: 'a',
  chapter: 'a',
  verse: 'a',
});
