export const getFilterResult = (bible, map, form) => {
  const _bible = [...bible];
  const result = [];

  let _books = [];

  switch (form.testament) {
    case 'ot':
      _books = map['ot'];
      break;

    case 'nt':
      _books = map['nt'];
      break;

    default:
      _books = map['ot'].concat(map['nt']);
      break;
  }
  /*   if (!form.book.length) {
    form.book = map['ot'].concat(map['nt']);
  } */

  if (!Array.isArray(form.book)) {
    _books = [form.book];
  }

  localStorage.setItem('filter', JSON.stringify(form));

  // console.log('Filtro', form);

  const isReadyForSearch = _books.length && form.searchText && form.searchText.length > 2;

  if (isReadyForSearch) {
    // console.log('Filtrando...');

    _bible.forEach((book, indexBook) => {
      if (_books.includes(indexBook)) {
        const _book = [...book];

        _book.forEach((chapter, indexChapter) => {
          const _chapter = [...chapter];
          _chapter.forEach((verse, indexVerse) => {
            if (String(verse).toLowerCase().includes(String(form.searchText).toLowerCase())) {
              const object = {
                book: indexBook,
                chapter: indexChapter + 1,
                verse: indexVerse + 1,
                text: verse,
              };
              result.push(object);
            }
          });
        });
      }
    });
  }

  return result;
};

export default getFilterResult;
