export const getFilterResult = (bible, map, form) => {
  const _bible = [...bible];
  const result = [];

  switch (form.testament) {
    case 'ot':
      form.book = map['ot'];
      break;

    case 'nt':
      form.book = map['nt'];
      break;

    default:
      form.book = map['ot'].concat(map['nt']);
      break;
  }
  if (!form.book.length) {
    form.book = map['ot'].concat(map['nt']);
  }

  console.log('Filtro', form);

  const isReadyForSearch = form.book.length && form.searchText && form.searchText.length > 2;

  if (isReadyForSearch) {
    console.log('Filtrando...');

    _bible.forEach((book, indexBook) => {
      if (form.book.includes(indexBook)) {
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
