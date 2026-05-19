import { derived, writable } from 'svelte/store';

const DEFAULT_LOCALE = 'ro';
const MESSAGE_FILE_URL_TEMPLATE = '/lang/{locale}.json';
const dictionaries = writable({});
const locale = writable(null);

function getMessage(messages, path) {
  return path.split('.').reduce((value, key) => value?.[key], messages);
}

function setupI18n({ withLocale: _locale } = { withLocale: DEFAULT_LOCALE }) {
  const messagesFileUrl = MESSAGE_FILE_URL_TEMPLATE.replace('{locale}', _locale);
  return fetch(messagesFileUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Could not load locale "${_locale}"`);
      }
      return response.json();
    })
    .then((messages) => {
      dictionaries.update((current) => ({ ...current, [_locale]: messages }));
      locale.set(_locale);
    });
}

const isLocaleLoaded = derived(locale, ($locale) => typeof $locale === 'string');
const _ = derived([dictionaries, locale], ([$dictionaries, $locale]) => {
  const activeMessages = $dictionaries[$locale || DEFAULT_LOCALE] || {};
  return (key) => getMessage(activeMessages, key) || key;
});

export { _, setupI18n, isLocaleLoaded };
