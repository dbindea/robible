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

  let _books = selectedBooks.length
    ? booksByTestament.filter((value) => selectedBooks.includes(value))
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
