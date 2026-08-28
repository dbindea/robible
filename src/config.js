// Configuración de la app (entorno + endpoints)
//
// En desarrollo (npm run dev), el frontend se sirve en localhost:5173
// y el backend de RoBible corre en localhost:8787 (workers/robible-api/dev-server.js).
//
// En producción, VITE_API_BASE_URL se setea vía variable de entorno en Netlify
// (o similar). Si no está definida, cae a un placeholder vacío y la app
// sigue funcionando con el fallback localStorage (offline-first).

const DEV_DEFAULT = 'http://127.0.0.1:8787';

export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || DEV_DEFAULT).replace(/\/$/, '');

// Si true, intenta usar el backend; si falla (red, error), cae a localStorage.
// Si false, usa siempre localStorage (modo offline puro).
export const USE_BACKEND = !!import.meta.env?.VITE_API_BASE_URL
  || (typeof window !== 'undefined' && !window.location.hostname.endsWith('robible.app'));

// Versión del SW cache (debe coincidir con la del SW y package.json)
export const SW_CACHE_VERSION = 'robible-v15';
