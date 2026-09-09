// Memorización de versículos: API-first con cache en localStorage.
//
// Mismo patrón que favorites.service.js. Va al backend —y no sólo al
// dispositivo, como el progreso de lectura— porque aquí sí hay algo que perder:
// alguien que lleva ocho semanas repasando un salmo no puede quedarse sin ese
// avance por cambiar de teléfono.
//
// La mitad de arriba de este fichero son funciones puras (troceo, máscara,
// calendario de repasos). Están separadas a propósito: es lo único que se puede
// probar sin navegador y es donde de verdad se puede meter la pata.

import { api, ApiError, translateApiError } from './apiClient.js';
import { USE_BACKEND } from '../config.js';

// ── Troceo del texto ──────────────────────────────────────────────────────
//
// El mismo problema que en la imagen para compartir: `split(/\s+/)` no vale en
// chino, donde no hay espacios y el versículo entero saldría como una sola
// «palabra» — que ocultada al 50 % significa ocultarlo todo o nada. Aquí la
// unidad no es la línea sino la pieza que se tapa, así que en chino se trocea
// por carácter.
const RE_CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/;

export const tieneCJK = (texto = '') => RE_CJK.test(texto);

/**
 * Trocea el versículo en piezas ocultables.
 *
 * Devuelve objetos y no cadenas porque la vista necesita saber si una pieza es
 * ideográfica: una palabra latina tapada conserva su inicial —así se memoriza
 * de toda la vida— y un ideograma no tiene inicial que conservar.
 */
export const trocearPalabras = (texto = '') => {
  const limpio = String(texto).trim();
  if (!limpio) return [];

  const piezas = [];
  let acumulado = '';

  const cerrar = () => {
    if (acumulado) {
      piezas.push({ texto: acumulado, cjk: false });
      acumulado = '';
    }
  };

  for (const ch of limpio) {
    if (RE_CJK.test(ch)) {
      cerrar();
      piezas.push({ texto: ch, cjk: true });
    } else if (/\s/.test(ch)) {
      cerrar();
    } else {
      acumulado += ch;
    }
  }
  cerrar();

  return piezas;
};

// ── Qué se tapa en cada nivel ─────────────────────────────────────────────

export const NIVEL_MAXIMO = 5;

/**
 * Generador congruencial mínimo. No hace falta nada mejor: sólo se usa para
 * repartir los huecos, y lo único que importa es que **no cambie**.
 */
const aleatorioSembrado = (semilla) => {
  let estado = semilla % 2147483647;
  if (estado <= 0) estado += 2147483646;
  return () => {
    estado = (estado * 16807) % 2147483647;
    return (estado - 1) / 2147483646;
  };
};

/** Número estable a partir de la referencia, para que el reparto no baile. */
export const semillaDe = ({ book = 0, chapter = 0, verse = 0 } = {}) =>
  Math.abs(book * 1_000_000 + chapter * 1000 + verse) + 1;

/**
 * Índices tapados en un nivel dado.
 *
 * Los niveles son **anidados**: lo que se tapa en el 2 sigue tapado en el 3. Si
 * cada nivel sorteara sus huecos por su cuenta, al subir de nivel reaparecerían
 * palabras que ya estaban ocultas y la sensación sería de estar retrocediendo.
 * Por eso se baraja una vez y se van tomando los primeros N.
 */
export const indicesOcultos = (total, nivel, semilla = 1) => {
  const n = Math.max(0, Math.min(NIVEL_MAXIMO, Math.round(nivel)));
  if (!total || n <= 0) return new Set();
  if (n >= NIVEL_MAXIMO) return new Set(Array.from({ length: total }, (_, i) => i));

  const orden = Array.from({ length: total }, (_, i) => i);
  const azar = aleatorioSembrado(semilla);

  // Fisher-Yates con la semilla de la referencia.
  for (let i = orden.length - 1; i > 0; i -= 1) {
    const j = Math.floor(azar() * (i + 1));
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }

  const cuantos = Math.round((total * n) / NIVEL_MAXIMO);
  return new Set(orden.slice(0, cuantos));
};

/**
 * Cómo se ve una pieza tapada.
 *
 * En alfabeto latino se conserva la inicial y se marca el resto: es el método
 * de la primera letra, que es como se memoriza sin aplicación desde siempre y
 * además da la pista de longitud. Un ideograma no se puede recortar así, así que
 * se sustituye entero.
 */
export const enmascarar = ({ texto, cjk }) => {
  if (cjk) return '○';
  const sinPuntuacion = texto.replace(/[^\p{L}\p{N}]/gu, '');
  if (!sinPuntuacion) return texto;
  const inicial = [...texto][0];
  const resto = Math.max(1, [...sinPuntuacion].length - 1);
  return inicial + '·'.repeat(resto);
};

// ── Calendario de repasos ─────────────────────────────────────────────────

/**
 * Días hasta el repaso siguiente en cada escalón.
 *
 * Es repetición espaciada básica, no un algoritmo con pretensiones: cada acierto
 * dobla la espera. Se para en 180 días porque más allá el repaso ya no es lo que
 * sostiene el versículo.
 */
export const ESCALONES_DIAS = [1, 2, 4, 8, 16, 32, 64, 120, 180];

export const escalonSiguiente = (escalon = 0, acertado = true) => {
  if (!acertado) {
    // Un fallo no manda al principio: retroceder un escalón basta y evita que un
    // despiste tire ocho semanas de trabajo.
    return Math.max(0, (escalon || 0) - 1);
  }
  return Math.min(ESCALONES_DIAS.length - 1, (escalon || 0) + 1);
};

const AL_DIA = 86_400_000;

export const proximaFecha = (escalon = 0, desde = new Date()) => {
  const dias = ESCALONES_DIAS[Math.max(0, Math.min(ESCALONES_DIAS.length - 1, escalon))];
  return new Date(desde.getTime() + dias * AL_DIA).toISOString();
};

/** Toca repasarlo si la fecha ya pasó. Sin fecha, toca (es nuevo). */
export const tocaRepasar = (item, ahora = new Date()) => {
  if (!item?.dueAt) return true;
  return new Date(item.dueAt).getTime() <= ahora.getTime();
};

export const contarPendientes = (items = [], ahora = new Date()) =>
  items.filter((i) => tocaRepasar(i, ahora)).length;

// ── Persistencia ──────────────────────────────────────────────────────────

let currentUserId = null;
export const setCurrentUser = (userId) => {
  currentUserId = userId || null;
};

const STORAGE_PREFIX = 'robible:memorize:v1';
const storageKey = () => (currentUserId ? `${STORAGE_PREFIX}:${currentUserId}` : `${STORAGE_PREFIX}:anonymous`);

const readLS = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLS = (items) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(), JSON.stringify(items));
};

const refEqual = (a, b) => a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;

/**
 * ¿El worker todavía no conoce esta ruta?
 *
 * El frontend (Netlify) y el worker (Cloudflare) se despliegan por separado, así
 * que siempre hay una ventana en la que uno va por delante del otro. Si el
 * worker aún no tiene `/api/memorizations`, devuelve 404 con el código genérico
 * `not_found` — distinto del `memorization_not_found` que sí devuelven estas
 * rutas cuando existen. Sin esta distinción, un 4xx cortaba el camino y la
 * función NO caía a localStorage: la memorización parecía rota para todo el que
 * hubiera iniciado sesión.
 */
export const rutaNoDesplegada = (e) => e instanceof ApiError && e.status === 404 && e.code === 'not_found';

const normalizar = (m) => ({
  id: m.id,
  book: m.book,
  chapter: m.chapter,
  verse: m.verse,
  stage: m.stage ?? 0,
  dueAt: m.dueAt || m.due_at || null,
  reviewedAt: m.reviewedAt || m.reviewed_at || null,
  reviewCount: m.reviewCount ?? m.review_count ?? 0,
  createdAt: m.createdAt || m.created_at || null,
});

export const loadMemorizations = () => readLS().map(normalizar);

export const syncFromServer = async () => {
  if (!USE_BACKEND) return null;
  try {
    const res = await api.get('/api/memorizations');
    const list = (res.memorizations || []).map(normalizar);
    writeLS(list);
    return list;
  } catch (e) {
    console.warn('memorize syncFromServer failed:', e.message);
    return null;
  }
};

export const isMemorizing = (book, chapter, verse) =>
  readLS().some((m) => m.book === book && m.chapter === chapter && m.verse === verse);

export const addMemorization = async (book, chapter, verse) => {
  const ref = { book, chapter, verse };

  if (USE_BACKEND) {
    try {
      const res = await api.post('/api/memorizations', ref);
      const items = readLS();
      if (!items.some((m) => refEqual(m, ref))) {
        items.unshift(normalizar(res.memorization));
        writeLS(items);
      }
      return { ok: true, memorization: normalizar(res.memorization) };
    } catch (e) {
      if (!rutaNoDesplegada(e) && e instanceof ApiError && e.status >= 400 && e.status < 500) {
        return { ok: false, error: translateApiError(e.code) };
      }
      console.warn('addMemorization: backend failed, falling back');
    }
  }

  const items = readLS();
  if (items.some((m) => refEqual(m, ref))) {
    return { ok: false, error: 'auth.errors.memorization_already_exists' };
  }

  const ahora = new Date();
  const nuevo = normalizar({
    id: 'mem-' + crypto.randomUUID(),
    book,
    chapter,
    verse,
    stage: 0,
    // Nace pendiente: se añade para repasarlo hoy, no mañana.
    dueAt: ahora.toISOString(),
    reviewCount: 0,
    createdAt: ahora.toISOString(),
  });
  items.unshift(nuevo);
  writeLS(items);
  return { ok: true, memorization: nuevo };
};

export const removeMemorization = async (book, chapter, verse) => {
  const ref = { book, chapter, verse };

  if (USE_BACKEND) {
    try {
      await api.delete('/api/memorizations', { body: ref });
      writeLS(readLS().filter((m) => !refEqual(m, ref)));
      return { ok: true };
    } catch (e) {
      if (!rutaNoDesplegada(e) && e instanceof ApiError && e.status >= 400 && e.status < 500) {
        return { ok: false, error: translateApiError(e.code) };
      }
      console.warn('removeMemorization: backend failed, falling back');
    }
  }

  const items = readLS();
  const despues = items.filter((m) => !refEqual(m, ref));
  if (despues.length === items.length) return { ok: false, error: 'auth.errors.memorization_not_found' };
  writeLS(despues);
  return { ok: true };
};

export const toggleMemorization = async (book, chapter, verse) =>
  isMemorizing(book, chapter, verse)
    ? removeMemorization(book, chapter, verse)
    : addMemorization(book, chapter, verse);

/**
 * Registra un repaso y recoloca la fecha del siguiente.
 *
 * Se escribe en local **antes** de llamar al backend: el repaso ocurre con la
 * aplicación en la mano y a veces sin cobertura, y perder la marca por eso sería
 * exactamente el fallo que la gente no perdona.
 */
export const reviewMemorization = async (book, chapter, verse, acertado = true) => {
  const ref = { book, chapter, verse };
  const items = readLS();
  const item = items.find((m) => refEqual(m, ref));
  if (!item) return { ok: false, error: 'auth.errors.memorization_not_found' };

  const ahora = new Date();
  const stage = escalonSiguiente(item.stage ?? 0, acertado);
  const actualizado = {
    ...item,
    stage,
    dueAt: proximaFecha(stage, ahora),
    reviewedAt: ahora.toISOString(),
    reviewCount: (item.reviewCount ?? 0) + 1,
  };

  writeLS(items.map((m) => (refEqual(m, ref) ? actualizado : m)));

  if (USE_BACKEND) {
    try {
      // Se manda el escalón y la fecha ya calculados: el calendario es una
      // decisión de producto y vive aquí (ver ESCALONES_DIAS), no en el worker.
      const res = await api.post('/api/memorizations/review', {
        ...ref,
        stage,
        dueAt: actualizado.dueAt,
        correct: !!acertado,
      });
      if (res?.memorization) {
        const delServidor = normalizar(res.memorization);
        writeLS(readLS().map((m) => (refEqual(m, ref) ? delServidor : m)));
        return { ok: true, memorization: delServidor };
      }
    } catch (e) {
      console.warn('reviewMemorization: backend failed, se conserva lo local:', e.message);
    }
  }

  return { ok: true, memorization: actualizado };
};

export const resetAll = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey());
};
