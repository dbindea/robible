import { writable, get } from 'svelte/store';

export const DEFAULT_LOCALE = 'ro';
const MESSAGE_FILE_URL_TEMPLATE = '/lang/{locale}.json';

// ── Estado ────────────────────────────────────────────────────────────────────
const _cache = {};  // locale → messages
export const currentLocale = writable(DEFAULT_LOCALE);
// Track the locale that was most recently REQUESTED (not necessarily set yet).
// Exportado para que App.svelte pueda verificarlo antes de cascadas de loadLocaleSync.
export let _pendingLocale = null;

// ── Traductor: writable store que Svelte 5 reconoce correctamente ─────────────
// value = función traductor actual.
// Exportamos DIRECTAMENTE el writable store como `_` para que {$_('key')} funcione.
export const _ = writable((key) => key);

// ── Store para forzar re-renders en componentes ──────────────────────────────
// Se actualiza cada vez que el locale cambia. Los componentes lo usan
// via {#key $localeChanged} para forzar re-render y leer el nuevo traductor.
export const localeChanged = writable(0);

// Aplica el traductor para un locale dado
function _applyTranslator(locale, messages) {
  // Primero: actualizar el store de traducciones (sincrónico)
  _.set((key, params = {}) => {
    const value = key.split('.').reduce((v, k) => v?.[k], messages);
    if (typeof value !== 'string') return key;
    return value.replace(/\{(\w+)\}/g, (match, k) =>
      Object.prototype.hasOwnProperty.call(params, k) ? params[k] : match
    );
  });
  // Segundo: actualizar el counter del {#key} (sincrónico, fuerza re-render)
  _keyCounter.update((n) => n + 1);
  // Tercero: actualizar currentLocale y DOM (sincrónico)
  currentLocale.set(locale);
  document.documentElement.lang = locale;
  localStorage.setItem('lang', locale);
}

// Counter privado para forzar re-render en {#key}
// (No es un export público; se usa solo para el bloque {#key})
const _keyCounter = writable(0);
export { _keyCounter as localeVersion };

// Alias para localeChanged (disponible como $t in templates via {#key $t})
export { currentLocale as locale };

// ── Carga síncrona (primer render) ──────────────────────────────────────────
export function loadLocaleSync(locale) {
  _pendingLocale = locale;
  const url = MESSAGE_FILE_URL_TEMPLATE.replace('{locale}', locale);
  fetch(url, { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error(`Locale ${locale} not found`);
      return r.json();
    })
    .then((messages) => {
      _cache[locale] = messages;
      if (_pendingLocale !== locale) return; // Race guard
      _applyTranslator(locale, messages);
    })
    .catch(() => {
      if (locale !== DEFAULT_LOCALE) loadLocaleSync(DEFAULT_LOCALE);
    });
}

// ── Carga async (cambios de versión) ─────────────────────────────────────────
export function setupI18n({ withLocale: locale } = { withLocale: DEFAULT_LOCALE }) {
  _pendingLocale = locale;

  if (_cache[locale]) {
    if (_pendingLocale !== locale) return Promise.resolve();
    _applyTranslator(locale, _cache[locale]);
    return Promise.resolve();
  }

  const url = MESSAGE_FILE_URL_TEMPLATE.replace('{locale}', locale);
  return fetch(url, { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error(`Locale ${locale} not found`);
      return r.json();
    })
    .then((messages) => {
      _cache[locale] = messages;
      if (_pendingLocale !== locale) return; // Race guard
      _applyTranslator(locale, messages);
    })
    .catch(() => {
      if (locale !== DEFAULT_LOCALE) {
        const fallbackUrl = MESSAGE_FILE_URL_TEMPLATE.replace('{locale}', DEFAULT_LOCALE);
        return fetch(fallbackUrl, { cache: 'no-store' })
          .then((r) => r.ok ? r.json() : {})
          .then((messages) => {
            _cache[DEFAULT_LOCALE] = messages;
            if (_pendingLocale !== DEFAULT_LOCALE) return;
            _applyTranslator(DEFAULT_LOCALE, messages);
          });
      }
    });
}
