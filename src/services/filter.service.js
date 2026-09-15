export function replaceDiacritics(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const getFilterResult = (bible, map, form) => {
  const _bible = [...bible];
  let result = [];
  const booksByTestament = map[form.testament] || map.all || [];
  const selectedBooks = Array.isArray(form.book) ? form.book : [];
  const selectedChapters = Array.isArray(form.chapter) ? form.chapter : [];
  const searchText = form.searchText?.trim();

  // Un libro elegido MANDA sobre el testamento, no se cruza con él.
  //
  // Antes esto era `booksByTestament.filter((b) => selectedBooks.includes(b))`,
  // es decir la intersección de los dos. Y la intersección puede ser vacía: con
  // Geneza seleccionada y el filtro en Nuevo Testamento, la búsqueda devolvía
  // **cero resultados para una palabra que está en media Biblia**, sin error ni
  // aviso. Es el peor fallo posible en un buscador, porque cero es una
  // respuesta legítima y no hay forma de distinguir «no existe» de «lo estás
  // buscando donde no está».
  //
  // El estado se alcanzaba sin querer: buscabas «Ioan 3» por referencia —eso
  // deja el libro puesto—, cambiabas el ámbito a Antiguo Testamento y ya no
  // encontrabas nada nunca más.
  //
  // Elegir un libro concreto es más específico que elegir un testamento, así
  // que gana el libro. Cubierto en `tests/filter-combinaciones.test.js`.
  let _books = selectedBooks.length
    ? selectedBooks.filter((value) => Number.isInteger(value) && value >= 0 && value < _bible.length)
    : booksByTestament;

  localStorage.setItem('filter', JSON.stringify(form));

  // DEFAULT RESULT
  result = (_bible[_books[0] || 0]?.[selectedChapters[0] || 0] || []).map((verse, index) => {
    return {
      book: _books[0],
      chapter: (selectedChapters[0] || 0) + 1,
      index: index + 1,
      text: verse,
      key: `${_books[0]}-${(selectedChapters[0] || 0) + 1}-${index + 1}`,
    };
  });

  // SEARCH BY TEXT
  if (searchText) {
    result = [];
    if (searchText.length > 2) {
      const normalizedSearchText = replaceDiacritics(searchText).toLowerCase();
      const searchWords = normalizedSearchText.split(/[ ,.-]+/).filter(Boolean);

      _bible.forEach((book, indexBook) => {
        if (_books.includes(indexBook)) {
          const _book = [...book];

          _book.forEach((chapter, indexChapter) => {
            const _chapter = [...chapter];

            switch (form.searchType) {
              case 'match':
                _chapter.forEach((verse, indexVerse) => {
                  if (replaceDiacritics(verse).toLowerCase().includes(normalizedSearchText)) {
                    result.push({
                      book: indexBook,
                      chapter: indexChapter + 1,
                      index: indexVerse + 1,
                      text: verse,
                      key: `${indexBook}-${indexChapter}-${indexVerse}`,
                    });
                  }
                });
                break;

              case 'every':
                _chapter.forEach((verse, indexVerse) => {
                  const normalizedVerse = replaceDiacritics(verse).toLowerCase();
                  if (searchWords.every((word) => normalizedVerse.includes(word))) {
                    result.push({
                      book: indexBook,
                      chapter: indexChapter + 1,
                      index: indexVerse + 1,
                      text: verse,
                      key: `${indexBook}-${indexChapter}-${indexVerse}`,
                    });
                  }
                });
                break;

              case 'some':
                _chapter.forEach((verse, indexVerse) => {
                  const normalizedVerse = replaceDiacritics(verse).toLowerCase();
                  if (searchWords.some((word) => normalizedVerse.includes(word))) {
                    result.push({
                      book: indexBook,
                      chapter: indexChapter + 1,
                      index: indexVerse + 1,
                      text: verse,
                      key: `${indexBook}-${indexChapter}-${indexVerse}`,
                    });
                  }
                });
                break;
            }
          });
        }
      });
    }
  }
  return result;
};

export default getFilterResult;
