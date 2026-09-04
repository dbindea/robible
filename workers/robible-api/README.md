# RoBible API — Backend (Cloudflare Workers + D1)

API para auth, índices temáticos, favoritos, notas y búsquedas persistentes. Diseñado para correr en **Cloudflare Workers** con **D1 (SQLite)**. La capa de frontend está en `../../src/` y habla con esta API vía `fetch`.

Sesiones con TTL de **30 días** (`SESSION_TTL_MS` en `src/utils.js`); los tokens de reset de contraseña caducan a los 5 minutos.

## Características

- **Auth sin OAuth**: nickname + password + pregunta/seguridad con respuesta numérica
- **Hashing**: PBKDF2-SHA256 (100k iteraciones) via Web Crypto API (compatible con el mock del frontend, misma migración posible)
- **Tokens**: HMAC-SHA256 firmados, persistidos en D1 (revocables)
- **Rate limiting**: persistente en D1 (sobrevive cold starts de Workers) por IP + endpoint + ventana
- **CORS**: configurable, solo orígenes allowlist
- **Sin dependencias de OAuth ni de PII** (email, nombre real, etc.)
- **Multi-idioma**: las preguntas de seguridad se devuelven como clave, el frontend las traduce

## Estructura

```
workers/robible-api/
├── package.json
├── wrangler.toml          # config de Cloudflare Workers
├── schema.sql             # D1 schema
├── src/
│   ├── index.js           # entry: Hono router + CORS + error handling
│   ├── auth.js            # register, login, recover (3 pasos), me, logout, change-password
│   ├── data.js            # topics CRUD, verse_refs, favorites, notes, searches, export
│   └── utils.js           # hashing, tokens (HMAC), validators, rate limit, helpers DB
├── dev-server.js          # emula Workers+D1 con Hono + node:sqlite (sin wrangler)
└── .env.example
```

## Endpoints

| Método | Path                                | Auth | Descripción                              |
|--------|-------------------------------------|------|------------------------------------------|
| GET    | `/api/health`                       | no   | health check                              |
| POST   | `/api/auth/register`                | no   | crea usuario, hashea password, devuelve token + user |
| POST   | `/api/auth/login`                   | no   | verifica password, devuelve token + user  |
| POST   | `/api/auth/recover/question`        | no   | devuelve la pregunta de seguridad         |
| POST   | `/api/auth/recover/verify`          | no   | verifica respuesta, devuelve resetToken  |
| POST   | `/api/auth/recover/reset`           | no   | cambia password usando resetToken, devuelve token |
| GET    | `/api/auth/me`                      | sí   | devuelve el usuario actual                |
| POST   | `/api/auth/logout`                  | sí   | invalida el token actual                  |
| POST   | `/api/auth/change-password`         | sí   | cambia password (con currentPassword)     |
| GET    | `/api/topics`                        | sí   | lista topics del user + verse_refs agrupados |
| POST   | `/api/topics`                        | sí   | crea un topic                             |
| PATCH  | `/api/topics/:id`                   | sí   | actualiza name/icon/color                 |
| DELETE | `/api/topics/:id`                   | sí   | borra topic (no permite defaults)         |
| POST   | `/api/topics/:id/verses`            | sí   | añade versículo al topic                 |
| DELETE | `/api/topics/:id/verses`            | sí   | quita versículo del topic                 |
| GET    | `/api/favorites`                     | sí   | lista favoritos del user                  |
| POST   | `/api/favorites`                     | sí   | añade favorito                            |
| DELETE | `/api/favorites`                     | sí   | quita favorito                            |
| GET    | `/api/notes`                         | sí   | lista notas del user                      |
| POST   | `/api/notes`                         | sí   | upsert nota `{book, chapter, verse, text, color?}` (una por versículo) |
| DELETE | `/api/notes`                         | sí   | borra la nota de un versículo             |
| GET    | `/api/searches`                      | sí   | últimas 25 búsquedas, por `last_used_at`  |
| POST   | `/api/searches`                      | sí   | upsert búsqueda (idempotente por texto, la mueve al top) |
| DELETE | `/api/searches`                      | sí   | borra una búsqueda por id                 |
| GET    | `/api/data/export`                   | sí   | exporta todo (topics + verse_refs + favorites + notes + searches) |

Todos los endpoints con `Bearer` requieren header `Authorization: Bearer <token>`.

La tabla refleja las rutas registradas en [`src/index.js`](src/index.js); si se añade un endpoint, actualizarla aquí también.

## Setup local (sin Cloudflare, con SQLite)

```bash
cd workers/robible-api
npm install
npm run dev
# Server en http://127.0.0.1:8787
# DB SQLite en ./.dev-data/robible.db (se crea automáticamente con el schema)
```

Frontend: en el root del proyecto, crear `.env` o `.env.local` con:

```
VITE_API_BASE_URL=http://127.0.0.1:8787
```

Y arrancar:

```bash
cd ../..   # al root del proyecto
npm run dev
# Abre http://localhost:5173
```

## Despliegue en Cloudflare

> **Importante**: ejecuta los comandos desde el directorio `workers/robible-api/`. Si wrangler dice `Required Worker name missing`, casi siempre es porque lo estás lanzando desde un nivel superior.

1. **Instalar wrangler** (≥ 4.0):

   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **Crear la base de datos D1**:

   ```bash
   cd workers/robible-api
   wrangler d1 create robible-db
   # Si ya existe y quieres reciclar: wrangler d1 list
   # Copia el `database_id` que imprime y reemplaza en wrangler.toml
   ```

3. **Configurar secreto JWT** (token HMAC para firmar sesiones):

   ```bash
   wrangler secret put JWT_SECRET
   # Pega un valor aleatorio fuerte: openssl rand -hex 32
   ```

4. **Aplicar schema**:

   ```bash
   wrangler d1 execute robible-db --file=schema.sql --remote
   ```

5. **(Solo la primera vez por cuenta) Registrar subdominio `workers.dev`**:

   Sin subdominio, el deploy no asigna URL pública. Solo hay que hacerlo una vez por cuenta de Cloudflare.

   ```bash
   # El subdominio debe ser DNS-compliant (a-z, 0-9, guion)
   # Reemplaza con tu nombre preferido. La API de Cloudflare lo rechaza si ya existe.
   curl -X PUT \
     -H "Authorization: Bearer $(wrangler auth whoami --json | jq -r .access_token)" \
     -H "Content-Type: application/json" \
     -d '{"subdomain":"robible"}' \
     "https://api.cloudflare.com/client/v4/accounts/$(wrangler whoami --json | jq -r .accounts[0].id)/workers/subdomain/robible"
   ```

   Si lo prefieres por UI: **Workers & Pages → Subdomain → Setup**.

6. **Configurar ALLOWED_ORIGIN** (en `wrangler.toml` ya hay valores por defecto, ajústalos si tu frontend vive en otro dominio):

   ```toml
   ALLOWED_ORIGIN = "https://robible.app,https://www.robible.app"
   ```

7. **Desplegar**:

   ```bash
   wrangler deploy
   # Output: Uploaded robible-api (X.XX sec)
   #         Deployed robible-api triggers (X.XX sec)
   #         https://robible-api.<tu-subdomain>.workers.dev
   ```

   Si sale error `CPU limits are not supported for the Free plan`, edita `wrangler.toml` y comenta el bloque `[limits] cpu_ms = 50` (ya viene comentado en la última versión).

8. **Configurar el frontend** (en Netlify o tu hosting):

   Variable de entorno de build:

   ```
   VITE_API_BASE_URL=https://robible-api.<tu-subdomain>.workers.dev
   ```

   Eso activa automáticamente `USE_BACKEND=true` en el frontend, que prefiere el backend y cae a localStorage solo si la API no responde.

## Rate limiting

- **Por minuto**: 30 requests por IP por endpoint (configurable con `RATE_LIMIT_PER_MINUTE`)
- **Por hora**: 500 requests por IP por endpoint (configurable con `RATE_LIMIT_PER_HOUR`)
- Headers de respuesta en caso de 429: `Retry-After: <segundos>`

Para endurecer contra bots, en el dashboard de Cloudflare puedes añadir **Rate Limiting Rules** (gratis hasta 10k req/mes) que limiten por IP de origen y ASN. Recomendado activar antes de producción.

## Seguridad

- ✅ PBKDF2 con 100k iteraciones + SHA-256 (mismo algoritmo que el frontend mock, así los hashes son compatibles)
- ✅ Salt aleatorio de 16 bytes por usuario
- ✅ Tokens HMAC-SHA256 firmados con `JWT_SECRET`
- ✅ Tokens persistidos en DB (revocables al hacer logout)
- ✅ CORS estricto (solo orígenes allowlist)
- ✅ Rate limiting persistente en D1 (sobrevive cold starts)
- ✅ Validación de inputs (longitud, formato, rangos)
- ✅ Constraints UNIQUE en DB (no nicknames duplicados, no verse_refs duplicados en mismo topic, no favoritos duplicados)
- ✅ Foreign keys con CASCADE (borrar user borra sus datos)
- ❌ Sin OAuth (por diseño, el user no quiere PII ni OAuth)
- ❌ Sin CAPTCHA (si se necesitan más controles, integrar Cloudflare Turnstile en el frontend)

## Modelo de datos (D1)

Schema en [`schema.sql`](schema.sql). Versión actual: **4** (fila `schema_version` en `_meta`).

- `users` — id, nickname (UNIQUE), password_hash, sec_question, sec_answer_hash, timestamps
- `auth_sessions` — token, user_id, expires_at, user_agent
- `topics` — id, user_id (FK), name, icon, color, is_default · UNIQUE (user_id, name)
- `verse_refs` — id, user_id (FK), topic_id (FK), book, chapter, verse · UNIQUE (topic_id, book, chapter, verse)
- `favorites` — id, user_id (FK), book, chapter, verse, added_at · UNIQUE (user_id, book, chapter, verse)
- `notes` — id, user_id (FK), book, chapter, verse, text (1-500), color, timestamps · UNIQUE (user_id, book, chapter, verse), lo que permite el upsert natural
- `user_searches` — id, user_id (FK), search_text, search_type, testament, book_json, chapter_json, last_used_at · UNIQUE (user_id, search_text); el cap de 25 se aplica en código
- `user_profiles` — user_id (PK), name, email, confession, avatar_url, settings (JSON), colors (JSON) · **definida pero sin endpoints que la usen**, ver [docs/AUDITORIA-2026-09-04.md](../../docs/AUDITORIA-2026-09-04.md) hallazgo 9
- `rate_limits` — ip, endpoint, window_start, count (cleanup on-request)
- `_meta` — key/value; guarda `schema_version`

`schema.sql` usa `CREATE TABLE IF NOT EXISTS`, así que re-ejecutarlo es idempotente. No aplica migraciones destructivas: cualquier `ALTER TABLE` va a mano, seguido de subir `schema_version`.

## Migración desde el mock (localStorage)

Si tienes usuarios creados con el mock del frontend (Phase 3.0 Opción A), el hash es compatible (PBKDF2 100k SHA-256). Solo necesitas:
1. Crear la DB D1
2. Para cada usuario, ejecutar un INSERT manual con su `id`, `nickname`, `password_salt`, `password_hash`, etc.

(El script de migración no está incluido porque cada deploy es nuevo — empezar limpio es más seguro.)

## Tests

```bash
# Health
curl http://127.0.0.1:8787/api/health

# Register
curl -X POST http://127.0.0.1:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nickname":"test","password":"secret123","securityQuestion":"favorite_number","securityAnswer":"7"}'

# Login
curl -X POST http://127.0.0.1:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nickname":"test","password":"secret123"}'

# Con token:
TOKEN="..."
curl http://127.0.0.1:8787/api/auth/me -H "Authorization: Bearer $TOKEN"
curl http://127.0.0.1:8787/api/topics -H "Authorization: Bearer $TOKEN"
```
