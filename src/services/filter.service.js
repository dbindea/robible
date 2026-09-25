import { indiceDeLibro, normalizar, quitarDiacriticos } from './search-index.service.js';

export function replaceDiacritics(str) {
  return quitarDiacriticos(str);
}

/**
 * Hasta cuántos resultados exactos se considera que la búsqueda se quedó corta.
 *
 * Lo describió el usuario así: «normalmente uno busca por expresión y, si no
 * encuentra, amplía a las palabras sueltas; hazlo tú, pero sólo cuando tenga
 * sentido». Con diez o veinte versículos la pantalla se queda a medias y unos
 * cuantos parecidos ayudan; con cincuenta o doscientos, ampliar sólo mete ruido
 * debajo de lo que ya estaba bien.
 *
 * Por eso es un tope y no un porcentaje: lo que decide no es la proporción, es
 * si al usuario le cabe en la pantalla lo que ha encontrado.
 */
export const UMBRAL_AMPLIACION = 20;

export const getFilterResult = (bible, map, form) => {
  let result = [];
  const booksByTestament = map[form.testament] || map.all || [];
  const selectedBooks = Array.isArray(form.book) ? form.book : [];
  const selectedChapters = Array.isArray(form.chapter) ? form.chapter : [];
  const searchText = form.searchText?.trim();
  const librosBiblia = Array.isArray(bible) ? bible.length : 0;

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
  //
  // Se ordena y se quitan los repetidos porque ahora el recorrido va por esta
  // lista y no por la Biblia entera comprobando la pertenencia: un libro
  // repetido daría el mismo versículo dos veces —y dos veces la misma `key`,
  // que es lo que hace reventar al `{#each}` de Svelte— y uno fuera de orden
  // sacaría los resultados desordenados respecto al canon.
  let _books = selectedBooks.length
    ? [...new Set(selectedBooks.filter((value) => Number.isInteger(value) && value >= 0 && value < librosBiblia))].sort(
        (a, b) => a - b,
      )
    : booksByTestament;

  // DEFAULT RESULT
  result = (bible?.[_books[0] || 0]?.[selectedChapters[0] || 0] || []).map((verse, index) => {
    return {
      book: _books[0],
      chapter: (selectedChapters[0] || 0) + 1,
      index: index + 1,
      text: verse,
      key: `${_books[0]}-${(selectedChapters[0] || 0) + 1}-${index + 1}`,
    };
  });

  // SEARCH BY TEXT
  //
  // Se recorre el índice normalizado (`search-index.service.js`) y no la Biblia
  // en crudo: normalizar los 31.102 versículos en cada pulsación costaba 65 ms,
  // y esa era la razón de que el buscador fuese a tirones en el móvil. El
  // índice se construye libro a libro la primera vez que se busca en él.
  if (searchText) {
    result = [];
    if (searchText.length > 2) {
      const normalizedSearchText = normalizar(searchText);
      const searchWords = normalizedSearchText.split(/[ ,.-]+/).filter(Boolean);

      const contieneLaExpresion = (texto) => texto.includes(normalizedSearchText);
      const contieneLasPalabras = (texto) => searchWords.every((word) => texto.includes(word));
      const contieneAlgunaPalabra = (texto) => searchWords.some((word) => texto.includes(word));

      /**
       * Recorre los libros elegidos y añade lo que cumpla `coincide`.
       *
       * @param {Function} coincide qué versículo entra, sobre el texto normalizado
       * @param {Set|null} yaEstan claves que no hay que repetir (segunda pasada)
       */
      const recolectar = (coincide, yaEstan = null) => {
        for (const indexBook of _books) {
          const indice = indiceDeLibro(bible, indexBook);
          if (!indice) continue;
          const { textos, capitulos, versiculos } = indice;

          for (let i = 0; i < textos.length; i++) {
            if (!coincide(textos[i])) continue;
            const indexChapter = capitulos[i];
            const indexVerse = versiculos[i];
            // Ojo: aquí la clave va en base 0 y en el resultado por defecto de
            // arriba en base 1. Es una incoherencia vieja, pero `Result.svelte`
            // la usa como clave del `{#each}` y para casar el versículo que se
            // está leyendo con música: cambiarla no es cosa de este servicio.
            const key = `${indexBook}-${indexChapter}-${indexVerse}`;
            if (yaEstan?.has(key)) continue;
            const encontrado = {
              book: indexBook,
              chapter: indexChapter + 1,
              index: indexVerse + 1,
              text: bible[indexBook][indexChapter][indexVerse],
              key,
            };
            // La marca sólo se pone cuando toca: así un resultado normal es
            // exactamente el mismo objeto que antes de que esto existiera.
            if (yaEstan) encontrado.ampliado = true;
            result.push(encontrado);
          }
        }
      };

      // ── El modo de siempre, y el que decide solo ────────────────────────
      //
      // `smart` es el que usa la aplicación desde el 25 sep 2026 y sustituye a
      // los dos radios que había («contiene la expresión» y «contiene las
      // palabras»). Los dos viejos siguen aquí porque el modo proyección pide
      // `match` explícitamente y porque hay búsquedas guardadas con esos
      // valores; sin `default`, un `searchType` que no sea ninguno devuelve
      // lista vacía, que es el contrato del que depende la proyección
      // (CLAUDE.md, trampa 87).
      switch (form.searchType) {
        case 'smart':
          recolectar(contieneLaExpresion);
          // Ampliar sólo cuando significa algo: con una palabra suelta, «la
          // expresión» y «todas las palabras» son la misma búsqueda, y con la
          // pantalla ya llena de resultados exactos nadie está pidiendo más.
          if (searchWords.length > 1 && result.length <= UMBRAL_AMPLIACION) {
            recolectar(contieneLasPalabras, new Set(result.map((v) => v.key)));
          }
          break;
        case 'match':
          recolectar(contieneLaExpresion);
          break;
        case 'every':
          recolectar(contieneLasPalabras);
          break;
        case 'some':
          recolectar(contieneAlgunaPalabra);
          break;
      }
    }
  }
  return result;
};

export default getFilterResult;
