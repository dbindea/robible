-- RoBible D1 schema
-- Aplicar con: `wrangler d1 execute robible-db --file=schema.sql`
-- O localmente: `wrangler d1 execute robible-db --local --file=schema.sql`

-- ============== USERS ==============
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                              -- 'u_<uuid>'
  nickname TEXT UNIQUE NOT NULL COLLATE NOCASE,     -- 3-24 chars, case-insensitive
  password_salt TEXT NOT NULL,                      -- hex 16 bytes
  password_hash TEXT NOT NULL,                      -- hex 32 bytes (PBKDF2-SHA256, 100k iter)
  -- La pregunta de seguridad la escribe siempre el usuario (schema_version 8).
  -- Antes se elegía de una lista de cinco, con el efecto de que mucha gente
  -- acababa compartiendo la misma. `sec_question` se queda en 'custom' y el
  -- texto real vive en `sec_question_text`; las filas antiguas conservan su
  -- clave ('siblings', 'favorite_number'…) y el frontend sigue traduciéndolas.
  sec_question TEXT NOT NULL,                       -- 'custom' | claves antiguas
  sec_question_text TEXT,                           -- la pregunta, cuando es 'custom'
  sec_answer_salt TEXT NOT NULL,                    -- hex 16 bytes
  sec_answer_hash TEXT NOT NULL,                    -- hex 32 bytes (PBKDF2-SHA256, 100k iter)
  -- Tipo de cuenta (schema_version 8): 'user' | 'preacher'.
  -- Un preacher es un user con las herramientas de predicación añadidas; no se
  -- le oculta nada, así que cambiar de tipo no toca ningún otro dato.
  user_type TEXT NOT NULL DEFAULT 'user',
  -- Email OPCIONAL para recuperar la cuenta (schema_version 8). Puede ser NULL
  -- y la app no debe insistir en pedirlo.
  --
  -- Ojo: esto revierte un principio del proyecto. El README de este worker decía
  -- "sin dependencias de OAuth ni de PII", y la tabla `user_profiles` se retiró
  -- en septiembre de 2026 justamente por guardar email. Se reintroduce como
  -- decisión de producto explícita, sólo para recuperación y sin nada más de PII.
  -- El envío de correo NO está implementado: hoy el email sólo se almacena.
  email TEXT,
  -- Rol de administración (schema_version 13). Vive en base de datos, no en
  -- código: ningún sitio compara un nickname a mano, todo pasa por esta
  -- columna. El primer alta es un `UPDATE` manual tras aplicar la migración;
  -- a partir de ahí un admin puede ascender a otros desde el propio panel.
  -- Revierte "ni roles más allá de Utilizator/Predicator" (ROADMAP.md,
  -- "Fuera de alcance") — decisión explícita del propietario, igual que en
  -- su día se revirtió "sin PII" al añadir `email`.
  is_admin INTEGER NOT NULL DEFAULT 0,               -- 0/1
  -- Cuenta desactivada por un admin (schema_version 13): no puede iniciar
  -- sesión, y las sesiones que ya tuviera abiertas se revocan en el momento
  -- de desactivarla (ver `auth.js`/`admin.js`). No es un borrado: los datos
  -- del usuario siguen intactos por si se reactiva.
  is_disabled INTEGER NOT NULL DEFAULT 0,            -- 0/1
  -- Datos de perfil opcionales (schema_version 13). Ninguno se pide en el
  -- alta ni la app insiste en rellenarlos: sólo existen para quien decide
  -- añadirlos después, desde su perfil.
  full_name TEXT,
  birth_date TEXT,                                   -- 'YYYY-MM-DD'
  church TEXT,
  country TEXT,
  confession TEXT,
  created_at TEXT NOT NULL,                          -- ISO 8601
  updated_at TEXT NOT NULL                           -- ISO 8601
);

CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);

-- ── Migración para bases ya desplegadas (schema_version 8) ───────────────────
-- Este archivo sólo crea; las columnas nuevas no aparecen en una tabla que ya
-- existía. En una base desplegada hay que aplicarlas a mano:
--
--   ALTER TABLE users ADD COLUMN user_type TEXT NOT NULL DEFAULT 'user';
--   ALTER TABLE users ADD COLUMN email TEXT;
--
-- Aplicado en producción el 7 sep 2026.

-- ============== AUTH SESSIONS ==============
-- Tokens mock-JWT con expiración. Persistidos en DB para poder invalidar.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,                           -- 'rb.' + base64url
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,                      -- Unix epoch ms
  created_at TEXT NOT NULL,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON auth_sessions(expires_at);

-- ============== TOPICS ==============
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,                              -- 'topic-abc123'
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,                               -- 1-40 chars
  icon TEXT NOT NULL DEFAULT '📌',
  color TEXT NOT NULL DEFAULT '#2E7D9B',
  is_default INTEGER NOT NULL DEFAULT 0,            -- 0/1
  created_at TEXT NOT NULL,
  -- ── Publicación (schema_version 7) ──────────────────────────────────────
  -- Un tema publicado se puede leer sin cuenta en /tema/<public_slug>.
  -- `public_slug` se conserva al despublicar para que, si el usuario vuelve a
  -- publicarlo, los enlaces que ya compartió sigan valiendo.
  -- `public_version` es la versión bíblica con la que se publicó: el tema son
  -- referencias, y sin esto no se sabría con qué texto renderizarlo.
  is_public INTEGER NOT NULL DEFAULT 0,             -- 0/1
  public_slug TEXT,                                 -- 'ansiedad-a3f2', único
  public_version TEXT,                              -- 'vdc' | 'rvl' | ...
  published_at TEXT,
  -- ── Descripción y orden (schema_version 12) ─────────────────────────────
  -- `description` es la frase que explica de qué va el tema, como las de las
  -- colecciones curadas. Opcional: un tema sin ella se ve igual que antes.
  description TEXT,
  -- `position` es el orden que el usuario decide con las flechas. Se rellena
  -- al migrar siguiendo `created_at`, para que nadie se encuentre el índice
  -- barajado. Entero con huecos permitidos: al reordenar se reescriben todas
  -- las posiciones del usuario, así que no hace falta que sean consecutivas
  -- entre operaciones.
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, name)                            -- no duplicar nombres por usuario
);

CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_topics_public_slug ON topics(public_slug)
  WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_topics_public ON topics(is_public, published_at DESC)
  WHERE is_public = 1;

-- ── Migración para bases ya desplegadas ──────────────────────────────────────
-- Este archivo solo crea; las columnas de arriba NO aparecen en una tabla que
-- ya existía. En una base ya desplegada hay que aplicarlas a mano:
--
--   ALTER TABLE topics ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE topics ADD COLUMN public_slug TEXT;
--   ALTER TABLE topics ADD COLUMN public_version TEXT;
--   ALTER TABLE topics ADD COLUMN published_at TEXT;
--   CREATE UNIQUE INDEX IF NOT EXISTS idx_topics_public_slug ON topics(public_slug) WHERE public_slug IS NOT NULL;
--   CREATE INDEX IF NOT EXISTS idx_topics_public ON topics(is_public, published_at DESC) WHERE is_public = 1;
--
-- Aplicado en producción el 5 sep 2026.

-- ============== VERSE REFS (versículos asignados a topics) ==============
CREATE TABLE IF NOT EXISTS verse_refs (
  id TEXT PRIMARY KEY,                              -- 'vref-<uuid>'
  user_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  book INTEGER NOT NULL,                            -- 0-65
  chapter INTEGER NOT NULL,                          -- 1-based
  verse INTEGER NOT NULL,                            -- 1-based
  added_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  UNIQUE (topic_id, book, chapter, verse)            -- no duplicar versículo en mismo topic
);

CREATE INDEX IF NOT EXISTS idx_verse_refs_topic ON verse_refs(topic_id);
CREATE INDEX IF NOT EXISTS idx_verse_refs_user ON verse_refs(user_id);

-- ============== FAVORITES ==============
CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,                              -- 'fav-<uuid>'
  user_id TEXT NOT NULL,
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  added_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, book, chapter, verse)            -- un favorito por versículo por usuario
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_added ON favorites(user_id, added_at DESC);

-- ============== RATE LIMITS ==============
-- Almacén persistente de rate limiting (sobrevive cold starts de Workers).
-- Una entrada por (ip, endpoint, ventana de 1 minuto).
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,                            -- 'register' | 'login' | ...
  window_start INTEGER NOT NULL,                     -- Unix epoch ms (inicio de la ventana)
  count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (ip, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip, window_start);

-- ============== NOTES (Phase 3.3) ==============
-- Notas personales del usuario por versículo. UNIQUE por (user, versículo)
-- permite upsert natural (sobrescribir la nota de un versículo).
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,                              -- 'note-<uuid>'
  user_id TEXT NOT NULL,
  book INTEGER NOT NULL,                            -- 0-65
  chapter INTEGER NOT NULL,                          -- 1-based
  verse INTEGER NOT NULL,                            -- 1-based
  text TEXT NOT NULL,                               -- 1-500 chars
  color TEXT,                                       -- '#xxxxxx' o null
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, book, chapter, verse),            -- una nota por versículo
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_verse ON notes(user_id, book, chapter, verse);

-- ============== USER PROFILES — RETIRADA (schema_version 5) ==============
-- Existió una tabla `user_profiles` (name, email, confession, avatar_url,
-- settings, colors) que nunca llegó a usarse: ni un solo endpoint la
-- referenciaba y estaba a cero filas. Además guardaba PII (email, nombre real,
-- avatar) que este proyecto dice expresamente no querer — ver el README del
-- worker, sección Seguridad.
--
-- Se retira del schema el 4 sep 2026. En una base de datos ya desplegada la
-- tabla sigue existiendo, porque este archivo solo crea; para eliminarla:
--
--   wrangler d1 execute robible-db --remote --command "DROP TABLE IF EXISTS user_profiles"
--
-- Si algún día se quiere perfil de usuario, conviene rediseñarlo partiendo de
-- qué datos hacen falta de verdad, no rescatar esta tabla.

-- ============== USER SEARCHES (Phase 3.4) ==============
-- Historial de búsquedas persistente multi-device. Cap de 25 enforced en código.
-- UNIQUE(user_id, search_text) permite upsert idempotente (mover a top + actualizar timestamp).
CREATE TABLE IF NOT EXISTS user_searches (
  id TEXT PRIMARY KEY,                              -- 'search-<uuid>'
  user_id TEXT NOT NULL,
  search_text TEXT NOT NULL,                         -- texto tal como lo escribió el usuario
  search_type TEXT NOT NULL DEFAULT 'match',         -- 'match' | 'every' | 'some'
  testament TEXT NOT NULL DEFAULT 'all',             -- 'all' | 'ot' | 'nt'
  book_json TEXT,                                   -- JSON array de book indices
  chapter_json TEXT,                                -- JSON array de chapter indices
  last_used_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, search_text),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_searches_user_used ON user_searches(user_id, last_used_at DESC);

-- ============== HIGHLIGHTS (subrayados de color) ==============
-- Subrayado de color por versículo. Misma forma que `notes`: UNIQUE por
-- (usuario, versículo) para que repintar un versículo sea un upsert y no
-- acumule filas. El color se guarda como hex y no como nombre de paleta:
-- así el día que se ofrezca un color libre no hace falta migrar la columna.
CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,                              -- 'hl_<uuid>'
  user_id TEXT NOT NULL,
  book INTEGER NOT NULL,                            -- 0-65
  chapter INTEGER NOT NULL,                          -- 1-based
  verse INTEGER NOT NULL,                            -- 1-based
  color TEXT NOT NULL,                              -- '#xxxxxx'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, book, chapter, verse),            -- un subrayado por versículo
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_verse ON highlights(user_id, book, chapter, verse);

-- ============== MEMORIZACIONES (schema_version 11) ==============
--
-- Versículos que el usuario está memorizando, con el escalón de repetición
-- espaciada en el que está cada uno.
--
-- No cuelga de `favorites` aunque se le parezca: un favorito es una marca
-- permanente y un versículo en memorización es un proceso con estado, que además
-- se abandona cuando ya está aprendido. Mezclarlos obligaría a que quitar un
-- favorito borrase el avance de repasos.
--
-- El texto del versículo NO se guarda: sale de la Biblia que el cliente ya tiene,
-- y guardarlo aquí lo ataría a una versión concreta.
CREATE TABLE IF NOT EXISTS memorizations (
  id TEXT PRIMARY KEY,                              -- 'mem_<uuid>'
  user_id TEXT NOT NULL,
  book INTEGER NOT NULL,                            -- 0-65
  chapter INTEGER NOT NULL,                          -- 1-based
  verse INTEGER NOT NULL,                            -- 1-based
  -- Índice dentro de ESCALONES_DIAS (memorize.service.js). El calendario vive en
  -- el cliente a propósito: aquí sólo se guarda en qué peldaño está, así que
  -- afinar los intervalos no obliga a migrar ninguna fila.
  stage INTEGER NOT NULL DEFAULT 0,
  due_at TEXT NOT NULL,                             -- cuándo toca el próximo repaso
  reviewed_at TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, book, chapter, verse),            -- un versículo se memoriza una vez
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_memorizations_user ON memorizations(user_id, due_at);

-- ============== SUSCRIPCIONES PUSH (schema_version 11) ==============
--
-- Un dispositivo suscrito al aviso diario. Es por dispositivo y no por usuario:
-- el endpoint lo emite el navegador, así que el mismo usuario en el móvil y en
-- el portátil son dos filas — y así debe ser, porque cada uno concede el permiso
-- por su cuenta y puede revocarlo por su cuenta.
--
-- NO se guardan `p256dh` ni `auth`, las claves de cifrado del navegador. Sólo
-- hacen falta para mandar contenido dentro del push, y aquí el push va vacío:
-- el service worker calcula el versículo del día por su cuenta (ver push.js).
-- Guardar claves que no se usan es superficie de ataque a cambio de nada.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,                              -- 'push_<uuid>'
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,                    -- la URL que da el navegador
  -- Hora UTC en la que toca avisar a ESTE dispositivo. La convierte el cliente
  -- desde la hora local elegida, y la reenvía en cada arranque: así el cambio de
  -- horario de verano se corrige solo, sin tocar la base de datos.
  utc_hour INTEGER NOT NULL DEFAULT 6,              -- 0-23
  created_at TEXT NOT NULL,
  last_sent_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- El cron pregunta exactamente por esto: «todas las de esta hora».
CREATE INDEX IF NOT EXISTS idx_push_hour ON push_subscriptions(utc_hour);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- ============== SERMONS / PREDICI (schema_version 9) ==============
--
-- Una sola tabla, y dos columnas JSON dentro. No es pereza: el proceso de
-- preparación (observaciones, contexto, idea central, estructura de puntos y
-- subpuntos, desarrollo de cada uno) es un árbol profundo y de forma variable
-- que **nunca se consulta por dentro** — siempre se carga entero para pintar la
-- pantalla y se guarda entero al escribir. Modelarlo en tablas relacionales
-- daría seis tablas y un JOIN por pantalla sin ganar una sola consulta útil.
--
-- Las columnas escalares existen sólo para lo que sí se filtra y se ordena en
-- la lista: título, pasaje, tipo, estado y fechas.
--
-- `outline_json` va aparte de `content_json` porque la schiță es un artefacto
-- distinto y se edita por separado: la predicación ronda las 1.500-2.500
-- palabras y la schiță las 150-250. Mezclarlas obligaría a reescribir la
-- predicación entera cada vez que se retoca una palabra clave del púlpito.
CREATE TABLE IF NOT EXISTS sermons (
  id TEXT PRIMARY KEY,                              -- 'sermon_<uuid>'
  user_id TEXT NOT NULL,
  title TEXT,                                       -- opcional: se puede empezar sin título
  -- Pasaje. Se guarda por referencia y no por texto: el texto sale de la Biblia
  -- que el cliente ya tiene, y así la predicación no queda atada a una versión.
  book INTEGER,                                     -- 0-65
  chapter INTEGER,
  verse_start INTEGER,
  verse_end INTEGER,
  version TEXT,                                     -- versión con la que se preparó
  type TEXT NOT NULL DEFAULT 'expositive',          -- expositive | textual | thematic
  status TEXT NOT NULL DEFAULT 'draft',             -- draft | ready | preached
  series TEXT,                                      -- agrupación libre, sin carpetas
  content_json TEXT,                                -- todo el proceso de preparación
  outline_json TEXT,                                -- la schiță del púlpito
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  prepared_at TEXT,                                 -- cuándo se marcó lista para predicar
  preached_at TEXT,                                 -- cuándo se predicó

  -- Publicación (schema_version 10). Misma mecánica que los temas: una
  -- predicación publicada se lee sin cuenta en /predica/<public_slug>, y el
  -- slug se conserva al despublicar para que los enlaces ya repartidos sigan
  -- valiendo si vuelve a publicarse.
  is_public INTEGER NOT NULL DEFAULT 0,             -- 0/1
  public_slug TEXT,                                 -- 'casa-zidita-pe-stanca-a3f2', único
  published_at TEXT,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sermons_user ON sermons(user_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sermons_public_slug ON sermons(public_slug)
  WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sermons_public ON sermons(is_public, published_at DESC)
  WHERE is_public = 1;
CREATE INDEX IF NOT EXISTS idx_sermons_user_status ON sermons(user_id, status);

-- ============== VISITAS (analíticas del panel de admin, schema_version 13) ==============
--
-- Una fila por visita de página. Deliberadamente NO guarda la IP: `visitor_hash`
-- es un SHA-256 de `día|IP|user-agent|secreto del servidor`, así que cambia cada
-- día y no sirve para seguir a nadie entre sesiones ni se puede revertir a la IP
-- original. Es el mismo compromiso que usan los analíticos "sin cookies" — sirve
-- para contar visitantes únicos por día sin tratar la IP como dato persistido.
--
-- `country` sale de `request.cf.country`, que Cloudflare añade gratis a cada
-- petición en el borde: no hace falta ningún servicio de geolocalización aparte.
--
-- No hay FOREIGN KEY a `users`: una visita no tiene por qué venir de una cuenta,
-- y la tabla tiene que seguir funcionando igual para quien no ha iniciado sesión.
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,                                -- 'YYYY-MM-DD' UTC
  path TEXT NOT NULL,
  country TEXT,                                     -- código de 2 letras, o NULL si Cloudflare no lo manda
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_page_views_day ON page_views(day);
CREATE INDEX IF NOT EXISTS idx_page_views_day_hash ON page_views(day, visitor_hash);
CREATE INDEX IF NOT EXISTS idx_page_views_day_path ON page_views(day, path);

-- ============== CLEANUP JOBS ==============
-- Se ejecuta al inicio de cada request para limpiar sesiones/rate_limits expirados.
-- (Cloudflare Workers no tiene cron, así que la limpieza es best-effort on-request.)

-- Versión del schema para migraciones
CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- 5: se retira user_profiles (nunca usada, guardaba PII no deseada)
-- 6: se añade highlights (subrayados de color por versículo)
-- 7: topics gana is_public / public_slug / public_version / published_at
-- 8: users gana user_type y email; la pregunta de seguridad pasa a ser libre
-- 9: se añade sermons (módulo «Predicile mele»)
-- 10: sermons gana is_public / public_slug / published_at
-- 11: se añaden memorizations y push_subscriptions
-- 12: topics gana description y position
-- 13: users gana is_admin / is_disabled / full_name / birth_date / church /
--     country / confession; se añade page_views (analíticas del panel de admin)
--
-- El literal de abajo se había quedado en '9' aunque los comentarios de más
-- abajo documentaban hasta la 12 (aplicadas a mano en producción sin bumpear
-- este valor). Se corrige de una vez al llegar a la 13, en vez de arrastrar
-- la deriva una migración más.
INSERT OR IGNORE INTO _meta (key, value) VALUES ('schema_version', '13');
UPDATE _meta SET value = '13' WHERE key = 'schema_version' AND value < '13';

-- 10: sermons gana is_public / public_slug / published_at
--   ALTER TABLE sermons ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE sermons ADD COLUMN public_slug TEXT;
--   ALTER TABLE sermons ADD COLUMN published_at TEXT;
--   CREATE UNIQUE INDEX IF NOT EXISTS idx_sermons_public_slug ON sermons(public_slug) WHERE public_slug IS NOT NULL;
--   CREATE INDEX IF NOT EXISTS idx_sermons_public ON sermons(is_public, published_at DESC) WHERE is_public = 1;
--
-- 11: se añaden memorizations y push_subscriptions
--   CREATE TABLE IF NOT EXISTS push_subscriptions (
--     id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE,
--     utc_hour INTEGER NOT NULL DEFAULT 6, created_at TEXT NOT NULL, last_sent_at TEXT,
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
--   CREATE INDEX IF NOT EXISTS idx_push_hour ON push_subscriptions(utc_hour);
--   CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
--
--   CREATE TABLE IF NOT EXISTS memorizations (
--     id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
--     book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
--     stage INTEGER NOT NULL DEFAULT 0, due_at TEXT NOT NULL, reviewed_at TEXT,
--     review_count INTEGER NOT NULL DEFAULT 0,
--     created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
--     UNIQUE (user_id, book, chapter, verse),
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
--   CREATE INDEX IF NOT EXISTS idx_memorizations_user ON memorizations(user_id, due_at);
--
-- 12: topics gana description y position (descripción y orden manual)
--   ALTER TABLE topics ADD COLUMN description TEXT;
--   ALTER TABLE topics ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
--   -- Sembrar el orden actual para que nadie vea su índice barajado. SQLite en
--   -- D1 no tiene ROW_NUMBER() en UPDATE, así que se cuenta con una subconsulta
--   -- correlacionada dentro de cada usuario.
--   --
--   -- OJO con el desempate por `id`: los temas que siembra `seedDefaultsForUser`
--   -- al crear la cuenta comparten `created_at` al milisegundo, así que un
--   -- `t2.created_at < topics.created_at` a secas les da posición 0 a TODOS y
--   -- el orden queda sin definir. Pasó al aplicar esta migración y lo cazó el
--   -- censo posterior.
--   UPDATE topics SET position = (
--     SELECT COUNT(*) FROM topics AS t2
--     WHERE t2.user_id = topics.user_id
--       AND (t2.created_at < topics.created_at
--            OR (t2.created_at = topics.created_at AND t2.id < topics.id))
--   );
--   CREATE INDEX IF NOT EXISTS idx_topics_orden ON topics(user_id, position);
--
-- Aplicado en producción el 10 sep 2026: 6 temas y 2 usuarios antes y después,
-- 0 colisiones de posición.

-- 13: rol de admin, cuenta desactivable, perfil opcional y analíticas propias
--   ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE users ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE users ADD COLUMN full_name TEXT;
--   ALTER TABLE users ADD COLUMN birth_date TEXT;
--   ALTER TABLE users ADD COLUMN church TEXT;
--   ALTER TABLE users ADD COLUMN country TEXT;
--   ALTER TABLE users ADD COLUMN confession TEXT;
--
--   CREATE TABLE IF NOT EXISTS page_views (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     day TEXT NOT NULL, path TEXT NOT NULL, country TEXT,
--     visitor_hash TEXT NOT NULL, created_at TEXT NOT NULL);
--   CREATE INDEX IF NOT EXISTS idx_page_views_day ON page_views(day);
--   CREATE INDEX IF NOT EXISTS idx_page_views_day_hash ON page_views(day, visitor_hash);
--   CREATE INDEX IF NOT EXISTS idx_page_views_day_path ON page_views(day, path);
--
--   -- Primer alta de administrador. A partir de aquí el rol se gestiona desde
--   -- el propio panel (un admin puede ascender a otro), no con SQL a mano.
--   UPDATE users SET is_admin = 1 WHERE nickname = 'dbindea';
--
-- Aplicado en producción el 12 sep 2026.
