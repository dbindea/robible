// Beacon de visitas para las analíticas del panel de admin.
//
// Fire-and-forget a propósito: un fallo de red aquí no puede interrumpir la
// navegación de nadie. Se manda el token si hay sesión (lo añade `api.post`
// solo) para que el worker pueda excluir la propia navegación de un admin por
// su panel — ver `analytics.js` en el worker.

import { api } from './apiClient.js';
import { USE_BACKEND } from '../config.js';

export const registrarVisita = (path) => {
  if (!USE_BACKEND || typeof path !== 'string' || !path) return;
  api.post('/api/analytics/pageview', { path }).catch(() => {
    // Sin conexión o backend caído: no hay nada que reintentar, la próxima
    // visita ya manda la suya.
  });
};
