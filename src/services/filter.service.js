export function replaceDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export const getFilterResult = (bible, map, form) => {
  const _bible = [...bible];
  let result = [];

  let _books = form.book.length ? map[form.testament].filter((value) => form.book.includes(value)) : map[form.testament];

  console.log('form', form);
  console.log('_books', _books);

  localStorage.setItem('filter', JSON.stringify(form));

  // DEFAULT RESULT
  result = _bible[_books[0] || 0][form.chapter[0] || 0].map((verse, index) => {
    return {
      book: _books[0],
      chapter: (form.chapter[0] || 0) + 1,
      index: index + 1,
      text: verse,
      key: `${_books[0]}-${(form.chapter[0] || 0) + 1}-${index + 1}`,
    };
  });

  // SEARCH BY TEXT
  if (form.searchText) {
    result = [];
    if (form.searchText.length > 2) {
      let regex = new RegExp(replaceDiacritics(form.searchText), 'i');
      _bible.forEach((book, indexBook) => {
        if (_books.includes(indexBook)) {
          const _book = [...book];

          _book.forEach((chapter, indexChapter) => {
            const _chapter = [...chapter];
            let regexArray = null;

            switch (form.searchType) {
              case 'match':
                _chapter.forEach((verse, indexVerse) => {
                  if (regex.test(replaceDiacritics(verse))) {
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
                regexArray = form.searchText.split(/[ ,.-]+/).map((word) => new RegExp(replaceDiacritics(word), 'i'));
                _chapter.forEach((verse, indexVerse) => {
                  if (regexArray.every((regex) => regex.test(replaceDiacritics(verse)))) {
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
                regexArray = form.searchText.split(/[ ,.-]+/).map((word) => new RegExp(replaceDiacritics(word), 'i'));
                _chapter.forEach((verse, indexVerse) => {
                  if (regexArray.some((regex) => regex.test(replaceDiacritics(verse)))) {
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
