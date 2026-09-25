// La hora del aviso diario es de la PERSONA, no del aparato.
//
// El fallo que cierran estas pruebas: la suscripción push es por dispositivo —
// forzoso, el endpoint lo emite cada navegador— y la hora viajaba dentro de ella.
// Cambiabas el aviso a las 20:00 en el móvil y el portátil seguía notificando a
// las 8:00: dos avisos del mismo versículo, a dos horas distintas, sin nada en
// pantalla que lo explicara.
//
// Se prueba contra SQLite de verdad, con el `schema.sql` de producción, y no con
// un doble de la base de datos: lo que hay que verificar es precisamente el SQL
// —el `COALESCE` y el `UPDATE` que propaga a los demás dispositivos—, y un doble
// que devuelva lo que le pidamos no comprueba nada de eso.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import { listPushSubscriptions, savePushSubscription } from '../workers/robible-api/src/data.js';

const ESQUEMA = readFileSync(fileURLToPath(new URL('../workers/robible-api/schema.sql', import.meta.url)), 'utf8');

let sqlite;
let db;

/** Lo mínimo de la interfaz de D1 que usan estas funciones. */
const adaptadorD1 = () => ({
  prepare(sql) {
    const stmt = sqlite.prepare(sql);
    const conArgs = (...args) => ({
      async first() { return stmt.get(...args) ?? null; },
      async all() { return { results: stmt.all(...args) }; },
      async run() { return { meta: { changes: stmt.run(...args).changes ?? 0 } }; },
    });
    return { bind: conArgs, ...conArgs() };
  },
});

const peticion = (cuerpo) => new Request('https://x/api/push', { method: 'POST', body: JSON.stringify(cuerpo) });

const USUARIO = 'u_prueba';
const MOVIL = 'https://fcm.googleapis.com/fcm/send/movil-0000000000';
const PORTATIL = 'https://fcm.googleapis.com/fcm/send/portatil-000000000';

const filas = () =>
  sqlite.prepare('SELECT endpoint, utc_hour, local_hour FROM push_subscriptions ORDER BY endpoint').all();

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(ESQUEMA);
  sqlite
    .prepare(
      `INSERT INTO users (id, nickname, password_salt, password_hash, sec_question, sec_answer_salt, sec_answer_hash, created_at, updated_at)
       VALUES (?, 'dorel', 'x', 'x', 'custom', 'x', 'x', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(USUARIO);
  db = adaptadorD1();
});

// ── Lo que el usuario nota ──────────────────────────────────────────────────

test('cambiar la hora en un dispositivo la cambia en TODOS', async () => {
  // Los dos activan el aviso a las 8:00 (UTC 6 en invierno peninsular).
  await savePushSubscription(peticion({ endpoint: MOVIL, utcHour: 6, localHour: 8 }), db, USUARIO, {});
  await savePushSubscription(peticion({ endpoint: PORTATIL, utcHour: 6, localHour: 8 }), db, USUARIO, {});
  assert.deepEqual(filas().map((f) => f.local_hour), [8, 8]);

  // Desde el móvil se cambia a las 20:00.
  await savePushSubscription(peticion({ endpoint: MOVIL, utcHour: 18, localHour: 20 }), db, USUARIO, {});

  // El portátil tiene que haberse enterado SIN abrirse: si esperáramos a que
  // arranque, seguiría avisando a las 8:00 quién sabe cuánto tiempo.
  assert.deepEqual(filas().map((f) => f.local_hour), [20, 20], 'la hora elegida es la misma en los dos');
  assert.deepEqual(filas().map((f) => f.utc_hour), [18, 18], 'y avisan en el mismo instante');
});

test('no se toca la hora de OTRA persona', async () => {
  sqlite
    .prepare(
      `INSERT INTO users (id, nickname, password_salt, password_hash, sec_question, sec_answer_salt, sec_answer_hash, created_at, updated_at)
       VALUES ('u_otro', 'otro', 'x', 'x', 'custom', 'x', 'x', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run();
  const ajeno = 'https://fcm.googleapis.com/fcm/send/ajeno-00000000000';
  await savePushSubscription(peticion({ endpoint: ajeno, utcHour: 4, localHour: 6 }), db, 'u_otro', {});
  await savePushSubscription(peticion({ endpoint: MOVIL, utcHour: 18, localHour: 20 }), db, USUARIO, {});

  const suya = filas().find((f) => f.endpoint === ajeno);
  assert.equal(suya.local_hour, 6);
  assert.equal(suya.utc_hour, 4);
});

// ── Que el despliegue por separado no rompa nada (trampa 36) ────────────────

test('un cliente viejo, que no manda la hora local, no borra la elegida', async () => {
  await savePushSubscription(peticion({ endpoint: MOVIL, utcHour: 18, localHour: 20 }), db, USUARIO, {});
  // El mismo dispositivo con el bundle anterior: sólo manda `utcHour`. Pasa en
  // la ventana entre desplegar el worker y desplegar el frontend.
  await savePushSubscription(peticion({ endpoint: MOVIL, utcHour: 18 }), db, USUARIO, {});

  const fila = filas()[0];
  assert.equal(fila.local_hour, 20, 'la elección tiene que sobrevivir al cliente viejo');
  assert.equal(fila.utc_hour, 18);
});

test('una suscripción anterior a la columna se queda en NULL, no en una hora inventada', async () => {
  // Es lo que hay en producción el día del despliegue: filas con `utc_hour` y
  // sin `local_hour`. Ponerles una por defecto le habría cambiado el aviso a
  // quien tuviera otra.
  sqlite
    .prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, utc_hour, created_at)
       VALUES ('push_viejo', ?, ?, 4, '2026-01-01T00:00:00.000Z')`,
    )
    .run(USUARIO, PORTATIL);
  assert.equal(filas()[0].local_hour, null);

  const { subscriptions } = await listPushSubscriptions(db, USUARIO);
  assert.equal(subscriptions[0].localHour, null, 'el cliente tiene que poder distinguir «no se sabe»');

  // Y en cuanto ese dispositivo arranca con el bundle nuevo, se completa.
  await savePushSubscription(peticion({ endpoint: PORTATIL, utcHour: 4, localHour: 6 }), db, USUARIO, {});
  assert.equal(filas()[0].local_hour, 6);
});

// ── Validación ──────────────────────────────────────────────────────────────

test('una hora local imposible se rechaza, y no a medias', async () => {
  for (const mala of [24, -1, 7.5, 'ocho']) {
    const res = await savePushSubscription(peticion({ endpoint: MOVIL, utcHour: 6, localHour: mala }), db, USUARIO, {});
    assert.equal(res.status, 400, `localHour=${mala} debería rechazarse`);
  }
  assert.equal(filas().length, 0, 'y no debería haber guardado nada');
});

test('la hora local llega hasta el cliente', async () => {
  await savePushSubscription(peticion({ endpoint: MOVIL, utcHour: 18, localHour: 20 }), db, USUARIO, {});
  const { subscriptions } = await listPushSubscriptions(db, USUARIO);
  assert.equal(subscriptions.length, 1);
  assert.equal(subscriptions[0].localHour, 20);
  assert.equal(subscriptions[0].utcHour, 18);
});
