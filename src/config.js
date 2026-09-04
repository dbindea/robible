// Configuración de la app (entorno + endpoints)
//
// En desarrollo (npm run dev), el frontend se sirve en localhost:5173
// y el backend de RoBible corre en localhost:8787 (workers/robible-api/dev-server.js),
// con VITE_API_BASE_URL definida en .env.local.
//
// En producción, VITE_API_BASE_URL se setea como variable de entorno en Netlify.
// Si no está definida, USE_BACKEND es false y la app funciona en modo offline
// puro sobre localStorage (sin sincronización entre dispositivos).

const DEV_DEFAULT = 'http://127.0.0.1:8787';

export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || DEV_DEFAULT).replace(/\/$/, '');

// La presencia de VITE_API_BASE_URL es la única condición: si hay backend
// configurado se usa, y si falla (red, 5xx) los servicios caen a localStorage.
//
// Antes esto incluía además `!hostname.endsWith('robible.app')`, heredado de
// cuando el dominio era robible.app. Con el dominio actual (robible.com) esa
// condición daba siempre true, así que sin la variable de entorno la app
// apuntaba a 127.0.0.1:8787 en producción y fallaba en silencio.
export const USE_BACKEND = !!import.meta.env?.VITE_API_BASE_URL;

if (import.meta.env?.PROD && !USE_BACKEND) {
  console.warn(
    '[robible] VITE_API_BASE_URL no está definida: la app funciona solo con localStorage, ' +
      'sin sincronización entre dispositivos. Configúrala en las variables de entorno del hosting.',
  );
}
