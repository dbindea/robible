/**
 * Reference search service — busqueda por referencia flexible.
 * Acepta multiples formatos: "rom 3 5", "romani 3:5", "rom 3.5", "1 ioan 2 6", "io 1 5".
 *
 * Para "io 1 5" devuelve multiples matches (1 Ioan 1:5, 2 Ioan 1:5, 3 Ioan 1:5).
 * Para "1 ioan 2 6" devuelve solo 1 Ioan 2:6.
 */

// ── Normalizacion de texto ──────────────────────────────────────────
function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar diacriticos
    .replace(/[.,;:]/g, ' ') // . , ; : → espacio
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Distancia Levenshtein (typo tolerance) ──────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j < b.length; j++) matrix[0][j + 1] = j + 1;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

// ── Heuristica de prefijo plausible ─────────────────────────────────
// Para queries cortas, evitar falsos positivos.
// Regla: el nombre del libro debe estar a 1-3 chars del query (no más).
function isPlausiblePrefix(query, name) {
  // Si el nombre es igual al query, OK
  if (query === name) return true;

  const lengthDiff = name.length - query.length;

  // Si la query incluye un numero de libro (ej: "1 co"), el nombre
  // puede ser mucho más largo. Solo exigir que la query sea plausible.
  const hasNumberPrefix = /^([123])\s/.test(query) || /^([123])[a-z]/.test(query);
  if (hasNumberPrefix) {
    // Para "1 co" matching "1 Corinteni" — el resto del query debe ser al menos 1 letra
    const rest = query.replace(/^[123]\s?/, '').trim();
    if (rest.length < 1) return false;
    return true;
  }

  // Sin numero: el nombre debe estar cerca del query
  if (lengthDiff > 4) return false;
  // Si la query es muy corta (1-2 chars), el nombre debe ser 2x mas largo como maximo
  if (query.length <= 2 && lengthDiff > 2) return false;
  return true;
}

// ── Buscar libro por nombre flexible ───────────────────────────────
function matchBooks(map, query) {
  if (!map || !query) return [];
  const q = normalize(query);

  const matches = [];
  const bookCount = (map.all || []).length;

  for (let i = 0; i < bookCount; i++) {
    const name = map[i];
    if (!name) continue;
    const nameNorm = normalize(name);

    // Quitar el prefijo numerico "1 ", "2 ", "3 " para comparar
    const stripped = nameNorm.replace(/^[123] /, '');

    let score = Infinity;
    let prefixLen = 0;

    // 1. Match exacto (sin prefijo)
    if (stripped === q || nameNorm === q) score = 0;
    // 2. Prefix match (el usuario escribe los primeros chars)
    // Comparar contra stripped (sin numero) y nameNorm (con numero)
    else if (stripped.startsWith(q) && isPlausiblePrefix(q, stripped)) {
      score = 1;
      prefixLen = q.length;
    }
    // 2b. Prefix match incluyendo el numero "1 ", "2 ", "3 "
    else if (nameNorm.startsWith(q) && isPlausiblePrefix(q, nameNorm)) {
      score = 1;
      prefixLen = q.length;
    }
    // 3. Prefix match: query "1 co" → "1 Corinteni"
    else {
      const numMatch = q.match(/^([123]) (.+)$/);
      if (numMatch) {
        const [, num, rest] = numMatch;
        const nameNum = nameNorm.match(/^([123]) /);
        if (nameNum && nameNum[1] === num && stripped.startsWith(rest) && isPlausiblePrefix(rest, stripped)) {
          score = 2;
          prefixLen = rest.length;
        }
      }
    }
    // 4. Match por numero solo: "1" → 1 Samuel, 1 Împărați, 1 Cronici...
    if (score === Infinity) {
      const numOnly = q.match(/^([123])$/);
      if (numOnly) {
        const num = numOnly[1];
        const nameNum = nameNorm.match(/^([123]) /);
        if (nameNum && nameNum[1] === num) {
          // Match todos los libros que empiezan con este numero
          score = 3;
          prefixLen = 0;
        }
      }
    }
    // 5. Typo tolerance (Levenshtein <= 1) para typos como "iona" → "ioan"
    if (score === Infinity) {
      // Solo aplicar si la longitud es >= 3 (no aceptar "a" → match aleatorio)
      if (q.length >= 3 && stripped.length >= 3) {
        const dist = levenshtein(q, stripped);
        if (dist <= 1) {
          score = 4;
          prefixLen = 0;
        }
      }
    }

    if (score !== Infinity) {
      matches.push({ book: i, name, score, prefixLen });
    }
  }

  // Ordenar: menor score primero, luego libros mas cortos
  matches.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.name.length - b.name.length;
  });

  return matches;
}

// ── Parsear entrada: extraer libro, capítulo, versículo ────────────
// Regla: el primer token numérico pequeño (1, 2 o 3) seguido de un word
// se interpreta como prefijo de libro numerado ("1 ioan" = 1 Ioan).
// Si no hay word, los números solos son query.
// "1ioan" o "1ioa" — split del dígito pegado.
// "rom 3 5" → bookQuery="rom", chapter=3, verse=5.
function parseInput(input) {
  if (!input) return { bookQuery: '', chapter: null, verse: null };

  const normalized = normalize(input);
  const tokens = normalized.split(' ').filter(Boolean);
  if (!tokens.length) return { bookQuery: '', chapter: null, verse: null };

  const numbers = [];
  const words = [];
  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      numbers.push(parseInt(token, 10));
    } else {
      words.push(token);
    }
  }

  // Solo numeros: "1" → "1 Samuel", "1 Împărați" (prefijo ambiguo)
  if (words.length === 0) {
    if (numbers.length > 0) {
      return { bookQuery: numbers[0].toString(), chapter: null, verse: null };
    }
    return { bookQuery: '', chapter: null, verse: null };
  }

  // Caso "1ioan", "1ioa" — split numero pegado al inicio
  const firstWord = words[0];
  if (/^\d/.test(firstWord) && !/^\d+$/.test(firstWord)) {
    const match = firstWord.match(/^(\d+)(.+)$/);
    if (match) {
      const [, num, rest] = match;
      const remainingWords = words.slice(1);
      const remainingNumbers = numbers;
      const bookQueryWithNum = [num, rest, ...remainingWords].filter(Boolean).join(' ');
      return {
        bookQuery: bookQueryWithNum,
        chapter: remainingNumbers[0] || null,
        verse: remainingNumbers[1] || null,
      };
    }
  }

  // Caso "1 ioan" — primer token es un numero pequeño, lo tratamos como prefijo de libro
  // Esto solo aplica si el primer token es un numero (no si hay un word primero)
  if (numbers.length > 0 && /^[123]$/.test(numbers[0].toString())) {
    // Determinar si el PRIMER token es un numero
    const firstTokenIsNumber = /^\d+$/.test(tokens[0]);
    if (firstTokenIsNumber && words.length >= 1) {
      const firstNum = numbers[0];
      const remainingNumbers = numbers.slice(1);
      const bookQueryWithNum = [firstNum, ...words].join(' ');
      return {
        bookQuery: bookQueryWithNum,
        chapter: remainingNumbers[0] || null,
        verse: remainingNumbers[1] || null,
      };
    }
  }

  // Caso normal: "rom 3 5" → bookQuery="rom", chapter=3, verse=5
  let chapter = null;
  let verse = null;
  if (numbers.length >= 1) {
    chapter = numbers[0];
    if (numbers.length >= 2) {
      verse = numbers[1];
    }
  }

  return { bookQuery: words.join(' '), chapter, verse };
}

/**
 * Devuelve TODAS las interpretaciones posibles del input.
 * Por ejemplo, "io 1 5" puede ser:
 *   1) bookQuery="io", chapter=1, verse=5 → Ioan 1:5, 1 Ioan 1:5, 2 Ioan 1:5, 3 Ioan 1:5
 *   2) bookQuery="1 io", chapter=1, verse=5 → 1 Ioan 1:5
 */
function parseInputAll(input) {
  const interpretations = [];
  const base = parseInput(input);
  if (base.bookQuery) {
    interpretations.push(base);
  }

  if (!input) return interpretations;

  const normalized = normalize(input);
  const tokens = normalized.split(' ').filter(Boolean);
  if (!tokens.length) return interpretations;

  // Detectar si el primer token es un numero y el segundo un word
  // Generar interpretacion alternativa: numero como prefijo de libro
  const numbers = [];
  const words = [];
  for (const token of tokens) {
    if (/^\d+$/.test(token)) numbers.push(parseInt(token, 10));
    else words.push(token);
  }

  // Si hay al menos un numero y un word, generar version con numero como prefijo
  if (numbers.length >= 1 && words.length >= 1) {
    const firstNum = numbers[0];
    const remainingNumbers = numbers.slice(1);
    interpretations.push({
      bookQuery: [firstNum, ...words].join(' '),
      chapter: remainingNumbers[0] || null,
      verse: remainingNumbers[1] || null,
    });
  }

  // Si el primer word empieza con numero pegado
  const firstWord = words[0];
  if (firstWord && /^\d/.test(firstWord) && !/^\d+$/.test(firstWord)) {
    const match = firstWord.match(/^(\d+)(.+)$/);
    if (match) {
      const [, num, rest] = match;
      const remainingWords = words.slice(1);
      const remainingNumbers = numbers;
      interpretations.push({
        bookQuery: [num, rest, ...remainingWords].filter(Boolean).join(' '),
        chapter: remainingNumbers[0] || null,
        verse: remainingNumbers[1] || null,
      });
    }
  }

  return interpretations;
}

// ── API principal ───────────────────────────────────────────────────
/**
 * Busca referencias que coincidan con el input.
 * Devuelve hasta maxResults matches combinando todas las interpretaciones posibles.
 * @param {string} input - Texto del usuario
 * @param {object} map - bible.map.json (libro → nombre)
 * @param {number} [maxResults=5] - Maximo de resultados a devolver
 * @returns {Array<{book: number, name: string, chapter: number|null, verse: number|null}>}
 */
export function searchReferences(input, map, maxResults = 5) {
  if (!input || !map) return [];

  // Generar TODAS las interpretaciones posibles
  const interpretations = parseInputAll(input);
  if (!interpretations.length) return [];

  const seen = new Set();
  const results = [];

  for (const { bookQuery, chapter, verse } of interpretations) {
    if (!bookQuery) continue;

    const matches = matchBooks(map, bookQuery);
    for (const m of matches) {
      const key = `${m.book}-${chapter}-${verse}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        book: m.book,
        name: m.name,
        chapter,
        verse,
      });
      if (results.length >= maxResults) break;
    }
    if (results.length >= maxResults) break;
  }

  return results;
}

/**
 * Parsea una entrada y devuelve un match unico si es inequivoco.
 * @returns {object|null} - Si solo hay 1 match con libro+cap+vers, lo devuelve
 */
export function parseReference(input, map) {
  const results = searchReferences(input, map, 5);
  if (results.length === 1 && results[0].chapter && results[0].verse) {
    return results[0];
  }
  return null;
}

/**
 * Formatea una referencia como string legible.
 * Ej: {name: 'Romani', chapter: 3, verse: 5} → 'Romani 3:5'
 */
export function formatReference(match) {
  if (!match) return '';
  const parts = [match.name];
  if (match.chapter !== null) {
    parts.push(match.chapter);
    if (match.verse !== null) {
      // Reemplazar el último elemento con la versión con dos puntos
      parts[parts.length - 1] = `${match.chapter}:${match.verse}`;
    }
  }
  return parts.join(' ');
}

export { normalize, matchBooks, parseInput, parseInputAll, levenshtein };
