export const BIBLE_ROUTE_PREFIX = '/biblia';

/**
 * Convierte el nombre de un libro en un segmento de URL.
 *
 * `NFD` + quitar diacr\u00edticos deja "G\u00e9nesis" en "genesis" y "C\u00e2ntarea" en
 * "cantarea". Lo que sobrevive se filtra con `\p{L}\p{N}`, que conserva letras
 * y n\u00fameros de **cualquier alfabeto**, no solo a-z: con `[^a-z0-9]` los nombres
 * chinos se vaciaban enteros y los 66 libros de la CUV produc\u00edan el mismo slug
 * vac\u00edo, as\u00ed que todas las rutas colisionaban y ca\u00edan en G\u00e9nesis.
 *
 * Para alfabetos latinos el resultado es id\u00e9ntico al de antes: los diacr\u00edticos
 * ya se han eliminado y solo quedan caracteres ASCII.
 */
export function slugifyBookName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function getBookSlug(map = {}, book) {
  return slugifyBookName(map[book] || book);
}

export function getBookIdFromSlug(map = {}, slug = '') {
  const normalizedSlug = slugifyBookName(slug);

  return (map.all || [])
    .map(Number)
    .find((book) => getBookSlug(map, book) === normalizedSlug);
}

export function buildBiblePath({ version, map = {}, book, chapter, verse }) {
  if (!version || book === null || book === undefined) {
    return '/';
  }

  const parts = [BIBLE_ROUTE_PREFIX, encodeURIComponent(version), getBookSlug(map, book)];

  if (chapter !== null && chapter !== undefined) {
    parts.push(String(Number(chapter)));
  }

  if (verse !== null && verse !== undefined) {
    parts.push(String(Number(verse)));
  }

  return parts.join('/');
}

export function parseBiblePath(pathname = '') {
  const cleanPathname = pathname.replace(/\.html$/, '');
  const [, version, bookSlug, chapter, verse] =
    cleanPathname.match(/^\/biblia\/([^/]+)\/([^/]+)(?:\/(\d+))?(?:\/(\d+))?\/?$/) || [];

  if (!version || !bookSlug) {
    return null;
  }

  return {
    version: decodeURIComponent(version),
    bookSlug: decodeURIComponent(bookSlug),
    chapter: chapter ? Number(chapter) : null,
    verse: verse ? Number(verse) : null,
  };
}

export function parseLegacyVersePath(pathname = '') {
  const [, version, book, chapter, verse] = pathname.match(/^\/verse\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\/?$/) || [];

  if (!version || !book || !chapter || !verse) {
    return null;
  }

  return {
    version: decodeURIComponent(version),
    book: Number(book),
    chapter: Number(chapter),
    verse: Number(verse),
  };
}
