// Aviso diario del versículo, por notificación push.
//
// ── Lo que hay que saber antes de tocar esto ─────────────────────────────
//
// 1. **En iOS sólo funciona si la aplicación está instalada** en la pantalla de
//    inicio (iOS 16.4+). En Safari abierto como pestaña, `Notification` ni
//    siquiera existe. No es un fallo nuestro y no tiene rodeo: por eso la
//    interfaz comprueba el soporte antes de ofrecer nada, en vez de enseñar un
//    interruptor que no haría nada.
// 2. **El permiso hay que pedirlo desde un gesto del usuario.** Pedirlo al
//    arrancar es lo que hace que la gente lo deniegue para siempre, y una vez
//    denegado no se puede volver a preguntar desde el código.
// 3. La suscripción es **por dispositivo**, no por cuenta: el endpoint lo emite
//    el navegador. El mismo usuario en el móvil y en el portátil son dos.

import { api, ApiError } from './apiClient.js';
import { USE_BACKEND } from '../config.js';

const PREFS_URL = '/__robible/push-prefs';
const KEY_HORA = 'robible:push:hour';

/** Hora local por defecto del aviso. Media mañana, no de madrugada. */
export const HORA_POR_DEFECTO = 8;

export const soportado = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const permiso = () => (soportado() ? Notification.permission : 'unsupported');

export const guardarHora = (hora) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_HORA, String(hora));
};

export const horaElegida = () => {
  if (typeof window === 'undefined') return HORA_POR_DEFECTO;
  const bruto = localStorage.getItem(KEY_HORA);
  // Se descarta lo vacío ANTES de convertir: tanto `Number(null)` como
  // `Number('')` valen 0 —no NaN—, así que la validación numérica los daba por
  // buenos y el selector salía en medianoche a todo el que no hubiera elegido
  // hora nunca.
  if (bruto === null || bruto.trim() === '') return HORA_POR_DEFECTO;
  const guardada = Number(bruto);
  return Number.isInteger(guardada) && guardada >= 0 && guardada <= 23 ? guardada : HORA_POR_DEFECTO;
};

/**
 * Convierte una hora local a la hora UTC equivalente de hoy.
 *
 * Se recalcula en cada arranque y se reenvía al servidor: así el cambio de
 * horario de verano se corrige solo. Guardar el desfase en la base de datos
 * habría significado que en marzo y en octubre los avisos llegan una hora
 * corridos hasta que alguien lo arregle a mano.
 */
export const horaUtcDe = (horaLocal, fecha = new Date()) => {
  const d = new Date(fecha);
  d.setHours(horaLocal, 0, 0, 0);
  return d.getUTCHours();
};

// ── Preferencias para el service worker ───────────────────────────────────

/**
 * Deja la versión bíblica y el idioma donde el service worker pueda leerlos.
 *
 * Va por la Cache API porque un service worker no tiene localStorage y, cuando
 * llega un push, lo normal es que no haya ninguna pestaña abierta a la que
 * preguntar.
 */
export const guardarPreferencias = async ({ version, locale }) => {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open('robible-push-prefs');
    await cache.put(PREFS_URL, new Response(JSON.stringify({ version, locale })));
  } catch {
    // Sin preferencias el aviso sale igualmente, en rumano y con la Cornilescu.
  }
};

// ── Suscripción ───────────────────────────────────────────────────────────

const claveAUint8 = (base64) => {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const cadena = atob(normal);
  return Uint8Array.from(cadena, (c) => c.charCodeAt(0));
};

/** La clave pública VAPID. Sale del worker para no compilarla en el bundle. */
let clavePublica = null;

export const obtenerClavePublica = async () => {
  if (clavePublica !== null) return clavePublica;
  if (!USE_BACKEND) return (clavePublica = '');
  try {
    const res = await api.get('/api/push/key', { auth: false });
    clavePublica = res.publicKey || '';
  } catch {
    clavePublica = '';
  }
  return clavePublica;
};

export const suscripcionActual = async () => {
  if (!soportado()) return null;
  const registro = await navigator.serviceWorker.ready;
  return registro.pushManager.getSubscription();
};

export const estaActivo = async () => !!(await suscripcionActual());

/**
 * Pide permiso, se suscribe y lo registra en el servidor.
 *
 * Tiene que llamarse desde un manejador de clic: si no, el navegador descarta la
 * petición de permiso sin preguntar.
 */
export const activar = async ({ horaLocal = horaElegida(), version = 'vdc', locale = 'ro' } = {}) => {
  if (!soportado()) return { ok: false, error: 'app.push.unsupported' };

  const clave = await obtenerClavePublica();
  if (!clave) return { ok: false, error: 'app.push.not_configured' };

  const concedido = await Notification.requestPermission();
  if (concedido !== 'granted') return { ok: false, error: 'app.push.denied' };

  const registro = await navigator.serviceWorker.ready;
  // `userVisibleOnly` es obligatorio en Chromium y significa que cada push
  // mostrará una notificación. Es justo lo que hacemos.
  const suscripcion =
    (await registro.pushManager.getSubscription()) ||
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: claveAUint8(clave),
    }));

  localStorage.setItem(KEY_HORA, String(horaLocal));
  await guardarPreferencias({ version, locale });

  try {
    await api.post('/api/push', { endpoint: suscripcion.endpoint, utcHour: horaUtcDe(horaLocal) });
  } catch (e) {
    // Si el servidor no la acepta, la suscripción del navegador se deshace: una
    // suscripción viva que el servidor no conoce no avisa nunca y deja el
    // interruptor encendido mintiendo.
    await suscripcion.unsubscribe().catch(() => {});
    const noDesplegado = e instanceof ApiError && e.status === 404 && e.code === 'not_found';
    return { ok: false, error: noDesplegado ? 'app.push.not_configured' : 'auth.errors.unknown' };
  }

  return { ok: true };
};

export const desactivar = async () => {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return { ok: true };

  // Primero el servidor: si se cancela en el navegador y falla el servidor, la
  // fila se queda huérfana y el dispositivo recibe avisos que ya no puede
  // mostrar.
  if (USE_BACKEND) {
    try {
      await api.delete('/api/push', { body: { endpoint: suscripcion.endpoint } });
    } catch (e) {
      // Un 404 aquí significa que el servidor ya no la tenía: se sigue.
      if (!(e instanceof ApiError && e.status === 404)) {
        return { ok: false, error: 'auth.errors.unknown' };
      }
    }
  }

  await suscripcion.unsubscribe().catch(() => {});
  return { ok: true };
};

/**
 * Refresca la hora UTC y las preferencias en cada arranque.
 *
 * Es lo que hace que el horario de verano se corrija solo y que la notificación
 * salga en el idioma que el usuario tiene puesto hoy, no en el de cuando activó
 * el aviso. No pide permisos ni suscribe nada: si no hay suscripción, calla.
 */
export const refrescar = async ({ version, locale }) => {
  if (!soportado() || !USE_BACKEND) return;
  try {
    const suscripcion = await suscripcionActual();
    if (!suscripcion) return;
    await guardarPreferencias({ version, locale });
    await api.post('/api/push', { endpoint: suscripcion.endpoint, utcHour: horaUtcDe(horaElegida()) });
  } catch {
    // Silencio a propósito: es mantenimiento de fondo, no una acción del usuario.
  }
};
