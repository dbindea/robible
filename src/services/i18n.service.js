import { derived, get, writable } from 'svelte/store';

export const DEFAULT_LOCALE = 'ro';
const MESSAGE_FILE_URL_TEMPLATE = '/lang/{locale}.json';
const dictionaries = writable({});
const locale = writable(null);
let pendingLocale = null;

function getMessage(messages, path) {
  return path.split('.').reduce((value, key) => value?.[key], messages);
}

function interpolateMessage(message, params = {}) {
  if (typeof message !== 'string') {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(params, key) ? params[key] : match;
  });
}

function setupI18n({ withLocale: _locale } = { withLocale: DEFAULT_LOCALE }) {
  const loadedDictionaries = get(dictionaries);

  if (get(locale) === _locale && loadedDictionaries[_locale]) {
    return Promise.resolve();
  }

  pendingLocale = _locale;

  if (loadedDictionaries[_locale]) {
    locale.set(_locale);
    return Promise.resolve();
  }

  const messagesFileUrl = MESSAGE_FILE_URL_TEMPLATE.replace('{locale}', _locale);
  return fetch(messagesFileUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Could not load locale "${_locale}"`);
      }
      return response.json();
    })
    .then((messages) => {
      if (pendingLocale !== _locale) {
        return;
      }

      dictionaries.update((current) => ({ ...current, [_locale]: messages }));
      locale.set(_locale);
    });
}

const currentLocale = derived(locale, ($locale) => $locale || DEFAULT_LOCALE);
const isLocaleLoaded = derived(locale, ($locale) => typeof $locale === 'string');
const _ = derived([dictionaries, locale], ([$dictionaries, $locale]) => {
  const activeMessages = $dictionaries[$locale || DEFAULT_LOCALE] || {};
  return (key, params) => interpolateMessage(getMessage(activeMessages, key), params) || key;
});

export { _, setupI18n, isLocaleLoaded, currentLocale };
