// La imagen de la pantalla en blanco del Modo Proyección.
//
// Para qué: entre un pasaje y el siguiente, la pantalla en negro deja la sala a
// oscuras. Una iglesia prefiere poner ahí lo suyo —su logotipo, un fondo con su
// nombre—, y eso no es contenido de RoBible: es de cada congregación.
//
// **No sale del dispositivo.** No se sube a ningún servidor ni se sincroniza
// con la cuenta: es del equipo que proyecta, como las preferencias y el
// historial. Y tiene que sobrevivir a cerrar el navegador, así que no vale
// tenerla sólo en memoria.
//
// Se guarda en la **Cache API** y no en `localStorage`:
//
//   - `localStorage` sólo guarda cadenas, así que habría que convertirla a
//     base64 —un tercio más de tamaño— y el hueco total son unos 5 MB para
//     TODO el origen, compartido con las notas, los favoritos y el historial.
//     Un logotipo decente se lo come entero.
//   - La Cache API guarda `Blob` tal cual, tiene cuota de disco de verdad y ya
//     se usa en el proyecto para las preferencias del push.
//   - Y la lee **cualquier ventana del mismo origen**, que es justo lo que hace
//     falta: la elige el operador en su ventana y la pinta la del proyector,
//     que son dos documentos distintos. Mandarla por el canal significaría
//     copiar megabytes en cada cambio de versículo.
//
// Lo único que va por el canal es el SELLO: una marca de tiempo que cambia
// cuando cambia la imagen. La ventana proyectada la vuelve a leer del disco al
// verlo cambiar, sin que nadie tenga que mover los bytes.

const CACHE = 'robible-proiectie';
const RUTA = '/__robible/projection-blank';
const CLAVE_SELLO = 'robible:projection:blank';

/** El tope. Por encima no es un logotipo, es una foto sin redimensionar. */
export const MAX_BYTES = 8 * 1024 * 1024;

/** Códigos de error, para que la interfaz elija el mensaje traducido. */
export const ERROR_TIPO = 'tipo';
export const ERROR_TAMANO = 'tamano';

const hayCache = () => typeof caches !== 'undefined';

/**
 * El sello de la imagen guardada, o cadena vacía si no hay ninguna.
 *
 * Es síncrono a propósito: lo lee el estado que se manda a la ventana
 * proyectada en cada cambio, y ahí no cabe esperar a una promesa.
 */
export const selloImagenBlanco = () => {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(CLAVE_SELLO) || '';
  } catch {
    return '';
  }
};

/**
 * Guarda la imagen elegida y devuelve el sello nuevo.
 *
 * Lanza `ERROR_TIPO` o `ERROR_TAMANO`: quien llama decide qué mensaje enseña.
 * No se toca el fichero —ni se redimensiona ni se recomprime—: lo que sube la
 * iglesia es lo que se ve, y un logotipo con transparencia pasado por un canvas
 * acabaría con un fondo negro alrededor.
 */
export const guardarImagenBlanco = async (file) => {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error(ERROR_TIPO);
  if (file.size > MAX_BYTES) throw new Error(ERROR_TAMANO);
  if (!hayCache()) throw new Error(ERROR_TIPO);

  const cache = await caches.open(CACHE);
  await cache.put(RUTA, new Response(file, { headers: { 'Content-Type': file.type } }));

  const sello = String(Date.now());
  try {
    localStorage.setItem(CLAVE_SELLO, sello);
  } catch {
    /* sin localStorage la imagen sigue guardada; sólo que no se avisa a la otra ventana */
  }
  return sello;
};

/**
 * Devuelve una URL de objeto para pintarla, o cadena vacía.
 *
 * **Quien la use tiene que llamar a `URL.revokeObjectURL`** al cambiarla o al
 * desmontarse: una URL de objeto mantiene el blob en memoria mientras viva, y
 * esta pantalla está encendida una hora seguida.
 */
export const leerImagenBlanco = async () => {
  if (!hayCache()) return '';
  try {
    const cache = await caches.open(CACHE);
    const respuesta = await cache.match(RUTA);
    if (!respuesta) return '';
    return URL.createObjectURL(await respuesta.blob());
  } catch {
    return '';
  }
};

export const borrarImagenBlanco = async () => {
  try {
    localStorage.removeItem(CLAVE_SELLO);
  } catch {
    /* da igual */
  }
  if (!hayCache()) return;
  try {
    const cache = await caches.open(CACHE);
    await cache.delete(RUTA);
  } catch {
    /* ya no estaba */
  }
};
