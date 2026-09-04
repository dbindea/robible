# Operaciones — RoBible

> Runbook: desarrollo local, build, despliegue y diagnóstico.
> Arquitectura: [ARQUITECTURA.md](ARQUITECTURA.md). Deuda conocida: [AUDITORIA-2026-09-04.md](AUDITORIA-2026-09-04.md).

## Entornos

| Entorno | Frontend | Backend |
|---|---|---|
| Local | `http://localhost:5173` (Vite) | `http://127.0.0.1:8787` (`dev-server.js` + SQLite) |
| Producción | `https://robible.com` (Netlify) | `https://robible-api.robible.workers.dev` (Workers + D1) |

Node ≥ 24.15.0 (`.nvmrc`). El backend requiere Node ≥ 22.5 por `node:sqlite`.

## Desarrollo local

```bash
# Terminal 1 — frontend
npm install
npm run dev                 # http://localhost:5173, escucha en 0.0.0.0

# Terminal 2 — backend
cd workers/robible-api
npm install
node dev-server.js          # http://127.0.0.1:8787
```

`dev-server.js` levanta el **router de producción real** (`src/index.js`) sobre un adaptador D1 falso montado en `node:sqlite`, así que lo que se prueba en local es el mismo código que se despliega. La base de datos se crea sola en `workers/robible-api/.dev-data/robible.db` aplicando `schema.sql`; borrar ese archivo es un reset limpio.

`.env.local` en la raíz apunta el frontend al backend local:

```
VITE_API_BASE_URL=http://127.0.0.1:8787
```

Sin backend levantado la app **sigue funcionando**: los servicios caen a `localStorage` (ver el patrón API-first en [ARQUITECTURA.md](ARQUITECTURA.md#patrón-api-first-con-fallback)).

Para probar desde el móvil en la misma red, usar la IP que imprime Vite (`http://192.168.x.x:5173`). Ojo: el TTS y la PWA requieren contexto seguro; algunas features solo funcionan del todo en HTTPS o en `localhost`.

## Build

```bash
npm run build       # vite build → dist/ ; luego scripts/generate-seo.mjs
npm run preview     # sirve dist/
```

`generate-seo.mjs` escribe **dentro de `dist/`**:

- páginas HTML estáticas de libro, capítulo y versículo con texto real (para crawlers)
- páginas temáticas (`/versiculos/amor`, `/versiculos/fe`, …)
- `dist/sitemaps/{static,books,chapters,topics,verses-N}.xml` (45.000 URLs por archivo)
- `dist/sitemap.xml` como índice

Ojo con dos copias en `public/` que confunden:

- **`public/sitemap.xml`** sí lo reescribe el build (`generate-seo.mjs:524`), además de generar el de `dist/`. Por eso aparece como modificado en `git status` después de cada `npm run build`, aunque solo cambien las fechas `lastmod`. Es ruido esperado en el diff.
- **`public/sitemaps/static.xml`** es una instantánea vieja que **nadie regenera**: los sitemaps troceados solo se escriben en `dist/sitemaps/`. No la edites a mano pensando que sirve para algo.

## Despliegue del frontend (Netlify)

Automático al mergear a `master`. Configuración en [netlify.toml](../netlify.toml):

- `command = "npm run build"`, `publish = "dist"`
- Functions en `netlify/functions/`, con `public/data/**` incluido en el bundle (las necesita `og-image` para leer el versículo)
- CSP estricta: cualquier dominio externo nuevo (analytics, fuentes, API) hay que **añadirlo a la cabecera `Content-Security-Policy`** o el navegador lo bloqueará
- `connect-src` ya incluye `https://robible-api.robible.workers.dev`
- SPA fallback: `/*` → `/index.html` con status 200

**Variable de entorno obligatoria en Netlify:**

```
VITE_API_BASE_URL=https://robible-api.robible.workers.dev
```

Sin ella `USE_BACKEND` es `false`: la app funciona en modo offline puro sobre `localStorage`, sin sincronización entre dispositivos, y avisa por consola en builds de producción. (Antes de arreglar el hallazgo 2, en ese caso apuntaba a `http://127.0.0.1:8787` y fallaba en silencio.)

## Despliegue del backend (Cloudflare)

Siempre desde `workers/robible-api/`; si wrangler dice `Required Worker name missing`, es que se lanzó desde otro directorio.

```bash
cd workers/robible-api

wrangler deploy                                       # desplegar
wrangler d1 execute robible-db --file=schema.sql --remote   # aplicar/actualizar schema
wrangler secret put JWT_SECRET                        # rotar secreto (openssl rand -hex 32)
wrangler tail                                         # logs en vivo
```

Configuración en [wrangler.toml](../workers/robible-api/wrangler.toml): binding `DB` a `robible-db`, `ALLOWED_ORIGIN` (CSV de orígenes CORS) y los límites de rate. El bloque `[limits] cpu_ms` está comentado a propósito: **no está disponible en el plan Free** y rompe el deploy.

`JWT_SECRET` es un *secret*, no una var: no está en `wrangler.toml` ni en el repo. Rotarlo invalida todas las sesiones activas.

**Añadir un origen CORS** (dominio nuevo del frontend): editar `ALLOWED_ORIGIN` en `wrangler.toml` y redesplegar. La lista es explícita, no hay comodines.

## Release del service worker

Cualquier cambio en `public/sw.js` o en la lista de assets precacheados exige:

1. Bumpear `CACHE_NAME` en [public/sw.js](../public/sw.js) (hoy `robible-v19`). Es la **única** fuente de verdad de la versión de cache.
2. Anotar la versión nueva en `ROADMAP.md`.

`activate` borra todas las caches cuyo nombre no coincida con `CACHE_NAME`, así que el bump es lo que fuerza la actualización en las PWA instaladas. Sin bump, un usuario con la app instalada puede quedarse indefinidamente en la versión vieja.

## Analytics

Ambos cargados directamente en [index.html](../index.html) y contemplados en la CSP:

- Google Analytics 4 — `G-MX8YYQ3DRY`
- Microsoft Clarity — `wxqy1enrvf`

## Base de datos (D1)

```bash
cd workers/robible-api

# Producción
wrangler d1 execute robible-db --remote --command "SELECT COUNT(*) FROM users"
wrangler d1 execute robible-db --remote --command "SELECT nickname, created_at FROM users ORDER BY created_at DESC LIMIT 20"
wrangler d1 execute robible-db --remote --command "SELECT COUNT(*) FROM auth_sessions WHERE expires_at > unixepoch()*1000"

# Local (el mismo fichero que usa dev-server.js)
wrangler d1 execute robible-db --local --command "..."
```

Tablas: `users`, `auth_sessions`, `topics`, `verse_refs`, `favorites`, `notes`, `user_searches`, `user_profiles`, `rate_limits`, `_meta`. Versión de schema actual: **4** (fila en `_meta`).

`schema.sql` está escrito con `CREATE TABLE IF NOT EXISTS`, así que re-ejecutarlo es idempotente y seguro; **no aplica migraciones destructivas**. Un `ALTER TABLE` hay que ejecutarlo a mano y luego subir `schema_version`.

Las `FOREIGN KEY ... ON DELETE CASCADE` garantizan que borrar un usuario borra todos sus datos:

```bash
wrangler d1 execute robible-db --remote --command "DELETE FROM users WHERE nickname = 'xxx'"
```

## Diagnóstico

| Síntoma | Comprobar |
|---|---|
| La app funciona pero no sincroniza entre dispositivos | `VITE_API_BASE_URL` en Netlify. Sin ella se cae a localStorage sin avisar |
| Errores CORS en consola | El origen debe estar en `ALLOWED_ORIGIN` de `wrangler.toml`, y redesplegado |
| `401 invalid_or_expired_token` | La sesión se valida contra la tabla `auth_sessions`, no solo por firma. Un logout o una rotación de `JWT_SECRET` la revocan |
| `429` con `Retry-After` | Rate limit: 30/min y 500/h por IP y endpoint. Ajustable en `wrangler.toml` |
| Los usuarios no ven los cambios tras un deploy | ¿Se bumpeó `CACHE_NAME` del SW? |
| Un recurso externo no carga en producción y sí en local | La CSP de `netlify.toml` no lo incluye |
| Un texto sale como `app.algo.clave` | Falta esa clave en el `public/lang/*.json` de ese idioma |
| El health del API | `curl https://robible-api.robible.workers.dev/api/health` |

## Verificación rápida del backend

```bash
curl http://127.0.0.1:8787/api/health

curl -X POST http://127.0.0.1:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nickname":"test","password":"secret123","securityQuestion":"favorite_number","securityAnswer":"7"}'

TOKEN="..."   # el token que devuelve register o login
curl http://127.0.0.1:8787/api/auth/me -H "Authorization: Bearer $TOKEN"
```
