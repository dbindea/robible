// Volver a leer del servidor cuando el usuario vuelve a la aplicación.
//
// El problema: cada store sincronizaba **una sola vez**, dentro de
// `currentUser.subscribe`, es decir al arrancar o al iniciar sesión. Después
// nadie volvía a pedir nada. Con el móvil y el escritorio abiertos a la vez,
// lo que hacías en uno no aparecía en el otro hasta cerrar la aplicación del
// todo y volver a abrirla. Los datos estaban en D1 desde el primer momento;
// lo que faltaba era releerlos.
//
// **Esto no es tiempo real y no puede serlo con D1.** D1 no empuja cambios al
// cliente: para eso haría falta un Durable Object manteniendo un WebSocket por
// usuario. Lo que se consigue aquí es la propiedad que de verdad importa en el
// uso normal — *cuando miras la pantalla, lo que ves está al día*—, porque
// mirar la pantalla implica volver a la pestaña, a la aplicación o a la red.
//
// Se sincroniza en tres momentos:
//   - la pestaña vuelve a ser visible (`visibilitychange`),
//   - la ventana recupera el foco (`focus`),
//   - vuelve la conexión (`online`).
//
// Y NO se sincroniza si se acaba de hacer: sin esa guarda, alternar entre dos
// ventanas dispararía siete peticiones por cada cambio de foco.

// Con extensión, como el resto de los servicios: sin ella el resolutor de
// Node no lo encuentra y el módulo deja de poder probarse fuera del navegador.
import { tokenStore } from './apiClient.js';

/**
 * Cada módulo se apunta con su par: leer del servidor y refrescar su store.
 * Se registran desde el propio store, para que el enganche viva al lado del
 * código que sincroniza y no en una lista central que se olvida de actualizar.
 */
const registrados = [];

/**
 * @param {string} nombre  Para poder decir cuál falló sin adivinar.
 * @param {() => Promise<unknown>} sync  Trae del servidor y escribe la cache.
 * @param {() => void} refresh  Vuelca la cache al store de Svelte.
 */
export const registrarSincronizacion = (nombre, sync, refresh) => {
  registrados.push({ nombre, sync, refresh });
};

// Ventana mínima entre sincronizaciones. Treinta segundos es bastante más de
// lo que tarda nadie en cambiar de ventana y volver, y bastante menos de lo
// que tarda en molestar que algo esté desactualizado.
const MINIMO_ENTRE_SYNC_MS = 30_000;

let ultima = 0;
let enCurso = false;

/**
 * Sincroniza todos los módulos registrados.
 *
 * Van en paralelo porque son independientes y esperar en fila multiplicaría la
 * latencia por siete. Cada `syncFromServer` ya se traga sus propios errores y
 * devuelve `null`, así que un módulo caído no arrastra a los demás; aun así se
 * usa `allSettled` para no depender de que eso siga siendo verdad.
 */
export const sincronizarTodo = async ({ forzar = false } = {}) => {
  if (enCurso) return;
  if (!tokenStore.get()) return; // sin sesión no hay nada que traer
  const ahora = Date.now();
  if (!forzar && ahora - ultima < MINIMO_ENTRE_SYNC_MS) return;

  enCurso = true;
  ultima = ahora;
  try {
    await Promise.allSettled(registrados.map((m) => m.sync()));
    // El refresco va después de TODAS: cada `refresh` publica en su store y
    // eso repinta; hacerlo según llegan da varios repintados seguidos.
    for (const m of registrados) {
      try { m.refresh(); } catch (e) { console.warn(`[resync] ${m.nombre}:`, e.message); }
    }
  } finally {
    enCurso = false;
  }
};

let arrancado = false;

/** Engancha los eventos. Se llama una vez desde `main.js`. */
export const iniciarResincronizacion = () => {
  if (arrancado || typeof document === 'undefined') return;
  arrancado = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sincronizarTodo();
  });

  // `focus` además de `visibilitychange` porque no son lo mismo: pasar de otra
  // ventana a ésta sin que la pestaña llegara a ocultarse dispara sólo `focus`.
  window.addEventListener('focus', () => sincronizarTodo());

  // Al recuperar la conexión se fuerza: lo que falló mientras no había red no
  // se reintenta solo, y aquí la ventana de treinta segundos estorba en vez de
  // proteger.
  window.addEventListener('online', () => sincronizarTodo({ forzar: true }));
};
