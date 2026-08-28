// Dev server local que emula Cloudflare Workers + D1 sin necesidad de wrangler.
// Usa node:sqlite (built-in en Node 22+) o sql.js como fallback.
// Misma API que el worker, así el frontend no nota la diferencia.

import { Hono } from 'hono';
import { corsHeaders, requireAuth as _reqAuth } from './src/utils.js';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { serve } from '@hono/node-server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8787', 10);
const DB_PATH = process.env.DB_PATH || join(__dirname, '.dev-data', 'robible.db');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production-please-make-it-long';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173';

// ── Inicializar DB local con node:sqlite (Node 22+ built-in) ─
let sqlite;
try {
  const { DatabaseSync } = await import('node:sqlite');
  if (!existsSync(dirname(DB_PATH))) mkdirSync(dirname(DB_PATH), { recursive: true });
  sqlite = new DatabaseSync(DB_PATH);
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');
  console.log('  DB: node:sqlite (built-in) en ' + DB_PATH);
} catch (e) {
  console.error('  Error: node:sqlite no disponible. Se necesita Node 22+ con --experimental-sqlite flag.');
  console.error('  Alternativa: usar wrangler dev (recomendado para producción).');
  process.exit(1);
}

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
sqlite.exec(schema);

// Adaptador D1-like sobre node:sqlite (mismas firmas que el adapter de better-sqlite3).
function makeD1Adapter() {
  return {
    prepare(sql) {
      // node:sqlite usa `?` como placeholder posicional (estilo SQLite estándar).
      // No necesitamos renombrar nada.
      const stmt = sqlite.prepare(sql);
      return {
        bind(...args) {
          const bound = args.map(normalizeArg);
          return {
            async first() {
              try {
                const row = stmt.get(...bound);
                return row || null;
              } catch (e) {
                return null;
              }
            },
            async all() {
              try {
                const rows = stmt.all(...bound);
                return { results: rows };
              } catch (e) {
                return { results: [] };
              }
            },
            async run() {
              try {
                const info = stmt.run(...bound);
                return { meta: { changes: info.changes ?? 0, last_row_id: info.lastInsertRowid } };
              } catch (e) {
                return { meta: { changes: 0 } };
              }
            },
            async raw() {
              return stmt.all(...bound);
            },
          };
        },
      };
    },
  };
}

function normalizeArg(arg) {
  if (arg === null || arg === undefined) return null;
  if (typeof arg === 'bigint') return Number(arg);
  if (typeof arg === 'boolean') return arg ? 1 : 0;
  return arg;
}

const DB = makeD1Adapter();
const env = { DB, JWT_SECRET, ALLOWED_ORIGIN, RATE_LIMIT_PER_MINUTE: '30', RATE_LIMIT_PER_HOUR: '500' };

// ── Importar el router de producción ─────────────────────
const prodApp = (await import('./src/index.js')).default;

const app = new Hono();
app.all('*', async (c) => {
  return prodApp.fetch(c.req.raw, env, {});
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`\n  RoBible API dev server`);
  console.log(`  ─────────────────────`);
  console.log(`  Local:   http://127.0.0.1:${info.port}`);
  console.log(`  Origins: ${ALLOWED_ORIGIN}`);
  console.log(`  Secret:  ${JWT_SECRET === 'dev-secret-change-me-in-production-please-make-it-long' ? '(dev default — cámbialo en producción)' : '(custom)'}`);
  console.log(`\n  Endpoints:`);
  console.log(`    GET  /api/health`);
  console.log(`    POST /api/auth/register | login | recover/question | recover/verify | recover/reset`);
  console.log(`    GET  /api/auth/me  (Bearer)`);
  console.log(`    POST /api/auth/logout | change-password  (Bearer)`);
  console.log(`    GET  /api/topics  POST /api/topics  PATCH/DELETE /api/topics/:id  (Bearer)`);
  console.log(`    POST /api/topics/:id/verses  DELETE /api/topics/:id/verses  (Bearer)`);
  console.log(`    GET  /api/favorites  POST /api/favorites  DELETE /api/favorites  (Bearer)`);
  console.log(`    GET  /api/data/export  (Bearer)`);
  console.log(`\n  Listo para peticiones.\n`);
});

process.on('SIGINT', () => {
  console.log('\nCerrando DB...');
  try { sqlite.close(); } catch {}
  process.exit(0);
});
