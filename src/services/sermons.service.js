// Predicaciones: servicio local-first con sincronización a D1.
//
// **La inversión respecto al resto de servicios es deliberada.** Favoritos,
// notas o subrayados son API-first con localStorage de respaldo: si falla la
// red, se degrada. Aquí manda lo local y el backend es la copia.
//
// El motivo es el Modo Amvon. Un predicador en el púlpito no puede depender de
// que haya cobertura, y tampoco puede permitirse que un guardado se pierda
// porque el wifi de la iglesia va mal. Así que se escribe primero en el
// dispositivo —siempre, sin excepción— y después se intenta sincronizar. Si la
// sincronización falla, el trabajo ya está a salvo y se reintenta más tarde.

import { api, ApiError, translateApiError } from './apiClient.js';
import { USE_BACKEND } from '../config.js';

let currentUserId = null;
export const setCurrentUser = (userId) => { currentUserId = userId || null; };

const STORAGE_PREFIX = 'robible:sermons:v1';
const storageKey = () => `${STORAGE_PREFIX}:${currentUserId || 'anonymous'}`;
// Cola de cambios que no han llegado al servidor todavía.
const pendingKey = () => `${STORAGE_PREFIX}:pending:${currentUserId || 'anonymous'}`;

export const SERMON_TYPES = ['expositive', 'textual', 'thematic'];
export const SERMON_STATUSES = ['draft', 'ready', 'preached'];

const readLS = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const writeLS = (lista) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(lista));
  } catch (e) {
    // Cuota llena. No se puede hacer mucho más que avisar: perder el aviso
    // sería peor, porque el usuario creería que su predicación está guardada.
    console.error('[predici] No se pudo guardar en el dispositivo:', e.message);
  }
};

const readPending = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(pendingKey());
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const writePending = (mapa) => {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(pendingKey(), JSON.stringify(mapa)); } catch { /* cuota */ }
};

const marcarPendiente = (id) => {
  const p = readPending();
  p[id] = Date.now();
  writePending(p);
};

const limpiarPendiente = (id) => {
  const p = readPending();
  delete p[id];
  writePending(p);
};

const nowIso = () => new Date().toISOString();

// Identificador local. Lleva el prefijo `local_` para distinguirlo del que
// asigna el servidor: al sincronizar, una predicación creada sin conexión se
// crea de verdad y cambia de id.
const localId = () => `local_${crypto.randomUUID()}`;

const upsertLocal = (sermon) => {
  const lista = readLS().filter((s) => s.id !== sermon.id);
  lista.unshift(sermon);
  writeLS(lista);
  return sermon;
};

// ── Lectura ─────────────────────────────────────────────

/** Cabeceras para la lista, ordenadas por lo último tocado. */
export const loadSermons = () =>
  readLS()
    .map(({ content: _c, outline: _o, ...cabecera }) => cabecera)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

/** Una predicación entera, con preparación y schiță. Siempre desde local. */
export const getSermon = (id) => readLS().find((s) => s.id === id) || null;

/**
 * ¿El contenido que hay guardado localmente sigue siendo bueno frente a lo
 * que dice la cabecera que acaba de mandar el servidor?
 *
 * Aparte, como función pura, para poder probar el fallo de fondo sin tocar
 * red ni `USE_BACKEND`: **éste era el fallo real detrás de «lo que escribo en
 * un dispositivo no se ve en el otro»**. Antes se conservaba el contenido
 * local SIEMPRE que existiera, sin mirar la fecha. La primera vez que se
 * abría una predicación se descargaba su contenido; a partir de ahí, aunque
 * llegaran cien sincronizaciones, ese contenido se daba por bueno para
 * siempre —ni un refresco de página lo tocaba, porque `fetchDetail` hace
 * exactamente lo mismo: si ya hay algo en local, no vuelve a preguntar—. Un
 * cambio hecho en otro dispositivo nunca llegaba a reflejarse aquí.
 *
 * La condición es simplemente: ¿el `updatedAt` que tengo es al menos tan
 * nuevo como el del servidor? Los dos usan el mismo `nowIso()`, así que la
 * comparación de cadenas ISO 8601 basta.
 */
export const contenidoSigueValido = (local, remoto) =>
  local?.content != null && String(local.updatedAt) >= String(remoto?.updatedAt);

/**
 * Trae la cabecera de todas las predicaciones y decide, para cada una, si el
 * contenido que hay en el dispositivo sigue siendo bueno o si hay que
 * olvidarlo para que se vuelva a pedir.
 *
 * Se llama al iniciar sesión, al volver a la aplicación (ver
 * `resync.service.js`) y al abrir una predicación en `SermonPrep`, justo
 * antes de leerla — nunca DURANTE la edición: esto no toca lo que ya está
 * cargado en el componente, sólo la cache en disco de la que se lee la
 * próxima vez. Sobrescribir mientras el usuario escribe le borraría lo que
 * acaba de teclear. Los cambios aún sin subir se conservan siempre.
 */
export const syncFromServer = async () => {
  if (!USE_BACKEND || !currentUserId) return null;
  try {
    const res = await api.get('/api/sermons');
    const remotas = res.sermons || [];
    const pendientes = readPending();
    const locales = readLS();

    // Una predicación con cambios sin subir gana sobre la del servidor: lo que
    // hay en el dispositivo es más reciente por definición.
    const fusionadas = remotas.map((r) => {
      const local = locales.find((s) => s.id === r.id);
      if (local && pendientes[r.id]) return local;

      // El detalle (content/outline) no viene en esta lista — ver
      // `listSermons` en el worker—; si mi copia local está anticuada se
      // descarta (queda `null`) para que `fetchDetail` la vuelva a pedir la
      // próxima vez que se abra. No se pide aquí mismo para no descargar el
      // cuerpo entero de cada predicación sólo por refrescar la lista.
      const localAlDia = contenidoSigueValido(local, r);
      return {
        ...r,
        content: localAlDia ? local.content : null,
        outline: localAlDia ? local.outline : null,
      };
    });

    // Las creadas sin conexión todavía no existen arriba: no se pierden.
    const soloLocales = locales.filter((s) => s.id.startsWith('local_'));
    writeLS([...fusionadas, ...soloLocales]);
    return loadSermons();
  } catch (e) {
    console.warn('[predici] No se pudo sincronizar:', e.message);
    return null;
  }
};

/**
 * Vuelve a pedir el detalle al servidor, saltándose la cache local aunque ya
 * la hubiera.
 *
 * A diferencia de `fetchDetail` —que una vez descargado el contenido no lo
 * vuelve a pedir nunca—, esto SIEMPRE va al servidor. Es lo que hace el botón
 * «Actualizează»: se niega si hay cambios de ESTE dispositivo sin subir
 * todavía, porque pisarlos sería perder lo último que se ha escrito, que es
 * justo lo que el botón promete no hacer. El propio botón, antes de llamar
 * aquí, fuerza el guardado pendiente (ver `guardarYa` en `SermonPrep.svelte`),
 * así que llegar aquí con algo en la cola normalmente significa que ese
 * guardado ha fallado por falta de conexión.
 */
export const refreshDetail = async (id) => {
  if (!USE_BACKEND) return { ok: false, reason: 'offline' };
  if (id.startsWith('local_')) return { ok: false, reason: 'offline' };
  if (readPending()[id]) return { ok: false, reason: 'pending' };
  try {
    const res = await api.get(`/api/sermons/${encodeURIComponent(id)}`);
    return { ok: true, sermon: upsertLocal({ ...res.sermon }) };
  } catch (e) {
    return { ok: false, reason: 'network', error: e.message };
  }
};

/** Descarga el detalle de una predicación si aún no está en el dispositivo. */
export const fetchDetail = async (id) => {
  const local = getSermon(id);
  if (local?.content !== null && local?.content !== undefined) return local;
  if (!USE_BACKEND || id.startsWith('local_')) return local;
  try {
    const res = await api.get(`/api/sermons/${encodeURIComponent(id)}`);
    return upsertLocal({ ...res.sermon });
  } catch (e) {
    console.warn('[predici] No se pudo cargar el detalle:', e.message);
    return local;
  }
};

// ── Escritura ───────────────────────────────────────────

/**
 * Crea una predicación. Se guarda en el dispositivo de inmediato y se sube
 * después; sin conexión queda con un id local hasta la próxima sincronización.
 */
export const createSermon = async (datos) => {
  const ahora = nowIso();
  const borrador = {
    id: localId(),
    title: datos.title?.trim() || null,
    book: datos.book,
    chapter: datos.chapter,
    verseStart: datos.verseStart,
    verseEnd: datos.verseEnd ?? datos.verseStart,
    version: datos.version || null,
    type: datos.type || 'expositive',
    status: 'draft',
    series: datos.series?.trim() || null,
    content: null,
    outline: null,
    createdAt: ahora,
    updatedAt: ahora,
    preparedAt: null,
    preachedAt: null,
  };

  upsertLocal(borrador);

  if (USE_BACKEND && currentUserId) {
    try {
      const res = await api.post('/api/sermons', {
        title: borrador.title,
        book: borrador.book,
        chapter: borrador.chapter,
        verseStart: borrador.verseStart,
        verseEnd: borrador.verseEnd,
        version: borrador.version,
        type: borrador.type,
        series: borrador.series,
      });
      // El servidor manda su id: se sustituye el local para que ambos hablen
      // de la misma predicación.
      const lista = readLS().filter((s) => s.id !== borrador.id);
      const creada = { ...borrador, ...res.sermon, content: null, outline: null };
      lista.unshift(creada);
      writeLS(lista);
      return { ok: true, sermon: creada };
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        return { ok: false, error: translateApiError(e.code) };
      }
      // Sin red: queda con id local y marcada como pendiente.
      marcarPendiente(borrador.id);
    }
  }

  return { ok: true, sermon: borrador };
};

/**
 * Guarda cambios. Escribe en el dispositivo siempre y sube después.
 *
 * Devuelve `ok: true` en cuanto lo local está a salvo, aunque la subida falle:
 * para el usuario el trabajo ESTÁ guardado, y decir lo contrario le haría
 * repetirlo sin necesidad. `synced` distingue los dos casos.
 */
export const updateSermon = async (id, cambios) => {
  const actual = getSermon(id);
  if (!actual) return { ok: false, error: 'auth.errors.sermon_not_found' };

  const ahora = nowIso();
  const actualizada = { ...actual, ...cambios, id, updatedAt: ahora };
  if (cambios.status === 'ready') actualizada.preparedAt = ahora;
  if (cambios.status === 'preached') actualizada.preachedAt = ahora;
  upsertLocal(actualizada);

  if (!USE_BACKEND || !currentUserId || id.startsWith('local_')) {
    marcarPendiente(id);
    return { ok: true, sermon: actualizada, synced: false };
  }

  try {
    const res = await api.patch(`/api/sermons/${encodeURIComponent(id)}`, cambios);
    const confirmada = upsertLocal({ ...actualizada, ...res.sermon });
    limpiarPendiente(id);
    return { ok: true, sermon: confirmada, synced: true };
  } catch (e) {
    marcarPendiente(id);
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
      return { ok: true, sermon: actualizada, synced: false, error: translateApiError(e.code) };
    }
    return { ok: true, sermon: actualizada, synced: false };
  }
};

export const deleteSermon = async (id) => {
  writeLS(readLS().filter((s) => s.id !== id));
  limpiarPendiente(id);

  if (USE_BACKEND && currentUserId && !id.startsWith('local_')) {
    try {
      await api.delete(`/api/sermons/${encodeURIComponent(id)}`);
    } catch (e) {
      console.warn('[predici] No se pudo borrar en el servidor:', e.message);
    }
  }
  return { ok: true };
};

/** Copia para volver a predicar sin tocar el original. */
export const duplicateSermon = async (id) => {
  const original = getSermon(id);
  if (!original) return { ok: false, error: 'auth.errors.sermon_not_found' };

  const res = await createSermon({
    title: original.title,
    book: original.book,
    chapter: original.chapter,
    verseStart: original.verseStart,
    verseEnd: original.verseEnd,
    version: original.version,
    type: original.type,
    series: original.series,
  });
  if (!res.ok) return res;

  // La copia arranca en borrador y hereda la preparación, que es lo que se
  // quiere reaprovechar; las fechas de preparada y predicada no se copian.
  if (original.content || original.outline) {
    await updateSermon(res.sermon.id, { content: original.content, outline: original.outline });
  }
  return { ok: true, sermon: getSermon(res.sermon.id) };
};

/** Cuántos cambios esperan a subirse. La interfaz lo usa para avisar. */
export const pendingCount = () => Object.keys(readPending()).length;

export const resetAll = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey());
  localStorage.removeItem(pendingKey());
};

// ── Publicación ───────────────────────────────────────────────────────────
//
// A diferencia del resto del módulo, esto **no** es local-first: publicar es
// dar de alta una URL que va a leer gente de fuera, y eso sólo tiene sentido si
// el servidor lo confirma. Sin conexión no se puede publicar, y decir lo
// contrario sería mentir: el enlace no existiría.

/** Publica o retira de internet. Devuelve la predicación con su slug. */
export const setSermonPublic = async (id, isPublic) => {
  if (!USE_BACKEND) return { ok: false, error: 'app.sermons.share.needs_connection' };
  try {
    const res = await api.patch(`/api/sermons/${encodeURIComponent(id)}`, { isPublic });
    if (res?.sermon) {
      // Sin esto, el interruptor de publicar se quedaba con el valor viejo en
      // la copia local hasta la siguiente sincronización.
      upsertLocal(res.sermon);
    }
    return { ok: true, sermon: res?.sermon || null };
  } catch (e) {
    return { ok: false, error: translateApiError(e?.code) };
  }
};

/**
 * Lee una predicación publicada. Sin token a propósito: la gracia es que
 * funcione para quien recibe el enlace y no tiene cuenta.
 */
export const fetchPublicSermon = async (slug) => {
  if (!USE_BACKEND) return null;
  try {
    const res = await api.get(`/api/public/sermons/${encodeURIComponent(slug)}`, { auth: false });
    return res.sermon || null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    console.warn('fetchPublicSermon falló:', e.message);
    return null;
  }
};

/** Las últimas publicadas. Alimenta la sección de la landing. */
export const fetchPublicSermons = async () => {
  if (!USE_BACKEND) return [];
  try {
    const res = await api.get('/api/public/sermons', { auth: false });
    return res.sermons || [];
  } catch (e) {
    console.warn('fetchPublicSermons falló:', e.message);
    return [];
  }
};

/**
 * Las series ya usadas en predicaciones publicadas.
 *
 * Se combinan en el selector con las del propio predicador, que salen de su
 * lista local: las suyas cuentan aunque no haya publicado nada, y así el
 * selector sirve desde la primera predicación.
 */
export const fetchPublicSeries = async () => {
  if (!USE_BACKEND) return [];
  try {
    const res = await api.get('/api/public/sermon-series', { auth: false });
    return res.series || [];
  } catch (e) {
    console.warn('fetchPublicSeries falló:', e.message);
    return [];
  }
};

export const buildPublicSermonUrl = (slug) =>
  typeof window === 'undefined' ? '' : `${window.location.origin}/predica/${encodeURIComponent(slug)}`;
