-- RoBible D1 schema
-- Aplicar con: `wrangler d1 execute robible-db --file=schema.sql`
-- O localmente: `wrangler d1 execute robible-db --local --file=schema.sql`

-- ============== USERS ==============
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                              -- 'u_<uuid>'
  nickname TEXT UNIQUE NOT NULL COLLATE NOCASE,     -- 3-24 chars, case-insensitive
  password_salt TEXT NOT NULL,                      -- hex 16 bytes
  password_hash TEXT NOT NULL,                      -- hex 32 bytes (PBKDF2-SHA256, 100k iter)
  sec_question TEXT NOT NULL,                       -- 'siblings' | 'favorite_number' | ... | 'custom'
  sec_question_text TEXT,                          -- cuando sec_question = 'custom'
  sec_answer_salt TEXT NOT NULL,                    -- hex 16 bytes
  sec_answer_hash TEXT NOT NULL,                    -- hex 32 bytes (PBKDF2-SHA256, 100k iter)
  created_at TEXT NOT NULL,                          -- ISO 8601
  updated_at TEXT NOT NULL                           -- ISO 8601
);

CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);

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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, name)                            -- no duplicar nombres por usuario
);

CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);

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
INSERT OR IGNORE INTO _meta (key, value) VALUES ('schema_version', '6');
UPDATE _meta SET value = '6' WHERE key = 'schema_version' AND value < '6';
