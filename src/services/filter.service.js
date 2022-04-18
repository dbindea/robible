export const getFilterResult = (bible, map, form) => {
  const _bible = [...bible];
  let result = [];

  let _books = map[form.testament];
  if (!Array.isArray(form.book)) {
    _books = [form.book];
  }

  localStorage.setItem('filter', JSON.stringify(form));

  // DEFAULT RESULT
  result = _bible[_books[0]][form.chapter[0] || 0].map((verse, index) => {
    return {
      book: _books[0],
      chapter: (form.chapter[0] || 0) + 1,
      verse: index + 1,
      text: verse,
      key: `${_books[0]}-${(form.chapter[0] || 0) + 1}-${index + 1}`,
    };
  });

  // SEARCH BY TEXT
  if (form.searchText) {
    result = [];
    if (form.searchText.length > 2) {
      let regex = new RegExp(form.searchText, 'i');

      _bible.forEach((book, indexBook) => {
        if (_books.includes(indexBook)) {
          const _book = [...book];

          _book.forEach((chapter, indexChapter) => {
            const _chapter = [...chapter];

            _chapter.forEach((verse, indexVerse) => {
              if (regex.test(String(verse))) {
                result.push({
                  book: indexBook,
                  chapter: indexChapter + 1,
                  verse: indexVerse + 1,
                  text: verse,
                  key: `${indexBook}-${indexChapter}-${indexVerse}`,
                });
              }
            });
          });
        }
      });
    }
  }
  return result;
};

export default getFilterResult;
