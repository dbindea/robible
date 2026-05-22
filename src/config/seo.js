import { BIBLE_VERSIONS, getBibleVersionConfigOrDefault } from './bible-versions';

export const SITE_URL = 'https://robible.com';

export const DEFAULT_VERSION = getBibleVersionConfigOrDefault();

export const SUPPORTED_LOCALES = BIBLE_VERSIONS.map((version) => ({
  id: version.locale,
  hreflang: version.hreflang,
  label: version.label,
  pathPrefix: version.pathPrefix,
}));

export const SEO_ROUTES = {
  home: '/',
  version: (version = DEFAULT_VERSION) => `/${version.locale}/${version.slug}`,
  book: (bookSlug, version = DEFAULT_VERSION) => `/${version.locale}/${version.slug}/${bookSlug}`,
  chapter: (bookSlug, chapter, version = DEFAULT_VERSION) =>
    `/${version.locale}/${version.slug}/${bookSlug}/${chapter}`,
  search: (version = DEFAULT_VERSION) => `/${version.locale}/${version.slug}/${version.searchPath}`,
  compare: (version = DEFAULT_VERSION) => `/${version.locale}/${version.slug}/${version.comparePath}`,
};
