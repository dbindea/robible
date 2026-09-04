// Validadores y criptografía del backend.
//
// Son la frontera entre el mundo exterior y la base de datos: si un validador
// se afloja, entran datos basura; si `hashValue` cambia de forma, las
// contraseñas existentes dejan de verificar y nadie puede entrar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validators,
  hashValue,
  verifyHash,
  makeToken,
  readToken,
  genId,
  genShortId,
  PBKDF2_ITERATIONS,
  SESSION_TTL_MS,
} from '../workers/robible-api/src/utils.js';

// ── Validación de entrada ───────────────────────────────────────────────────

test('nickname: acepta lo válido y rechaza lo demás', () => {
  for (const bueno of ['ana', 'dbindea', 'user_1', 'a.b-c', 'A1_2.3-4', 'x'.repeat(24)]) {
    assert.ok(validators.nickname(bueno), `debería aceptar "${bueno}"`);
  }
  for (const malo of ['ab', 'x'.repeat(25), 'con espacio', 'acentué', 'sim@bolo', '', null, undefined, 123]) {
    assert.ok(!validators.nickname(malo), `debería rechazar ${JSON.stringify(malo)}`);
  }
});

test('password: mínimo 6, máximo 128', () => {
  assert.ok(validators.password('secret'));
  assert.ok(validators.password('x'.repeat(128)));
  assert.ok(!validators.password('short'));
  assert.ok(!validators.password('x'.repeat(129)));
  assert.ok(!validators.password(null));
  assert.ok(!validators.password(123456));
});

test('numericAnswer: solo dígitos, de 1 a 6', () => {
  assert.ok(validators.numericAnswer('7'));
  assert.ok(validators.numericAnswer('2010'));
  assert.ok(validators.numericAnswer('  42  '), 'debería tolerar espacios alrededor');
  assert.ok(!validators.numericAnswer('1234567'));
  assert.ok(!validators.numericAnswer('siete'));
  assert.ok(!validators.numericAnswer(''));
  assert.ok(!validators.numericAnswer(7), 'un número no es una cadena');
});

test('verseRef: rangos de libro, capítulo y versículo', () => {
  assert.ok(validators.verseRef({ book: 0, chapter: 1, verse: 1 }), 'Génesis 1:1 es válido');
  assert.ok(validators.verseRef({ book: 65, chapter: 22, verse: 21 }));
  assert.ok(!validators.verseRef({ book: 66, chapter: 1, verse: 1 }), 'solo hay 66 libros (0-65)');
  assert.ok(!validators.verseRef({ book: -1, chapter: 1, verse: 1 }));
  assert.ok(!validators.verseRef({ book: 0, chapter: 0, verse: 1 }), 'los capítulos empiezan en 1');
  assert.ok(!validators.verseRef({ book: 0, chapter: 1, verse: 0 }), 'los versículos empiezan en 1');
  assert.ok(!validators.verseRef({ book: 1.5, chapter: 1, verse: 1 }), 'no acepta decimales');
  assert.ok(!validators.verseRef(null));
});

test('color: solo hexadecimal de 6 dígitos con almohadilla', () => {
  assert.ok(validators.color('#2E7D9B'));
  assert.ok(validators.color('#abcdef'));
  assert.ok(!validators.color('2E7D9B'), 'falta la almohadilla');
  assert.ok(!validators.color('#abc'), 'la forma corta no vale');
  assert.ok(!validators.color('red'));
});

test('noteText y topicName: longitud acotada', () => {
  assert.ok(validators.noteText('a'));
  assert.ok(validators.noteText('x'.repeat(500)));
  assert.ok(!validators.noteText('x'.repeat(501)));
  assert.ok(!validators.noteText('   '), 'espacios en blanco no cuentan');

  assert.ok(validators.topicName('Fe'));
  assert.ok(validators.topicName('x'.repeat(40)));
  assert.ok(!validators.topicName('x'.repeat(41)));
  assert.ok(!validators.topicName('  '));
});

// ── Hashing ─────────────────────────────────────────────────────────────────

test('hashValue es determinista y verifica correctamente', async () => {
  const salt = 'a'.repeat(32);
  const h1 = await hashValue('secret123', salt);
  const h2 = await hashValue('secret123', salt);

  assert.equal(h1, h2, 'el mismo valor y salt deben dar el mismo hash');
  assert.equal(h1.length, 64, 'PBKDF2 de 256 bits en hexadecimal son 64 caracteres');
  assert.ok(await verifyHash('secret123', salt, h1));
  assert.ok(!(await verifyHash('otra-clave', salt, h1)));
});

test('el mismo valor con distinto salt da hashes distintos', async () => {
  const h1 = await hashValue('secret123', 'a'.repeat(32));
  const h2 = await hashValue('secret123', 'b'.repeat(32));
  assert.notEqual(h1, h2);
});

test('el coste de PBKDF2 no se ha bajado por accidente', () => {
  // Bajar las iteraciones abarata un ataque por fuerza bruta. Si esto cambia
  // debe ser una decisión consciente, no un descuido.
  assert.equal(PBKDF2_ITERATIONS, 100_000);
});

// ── Tokens ──────────────────────────────────────────────────────────────────

test('makeToken y readToken hacen ida y vuelta', async () => {
  const token = await makeToken('u_123', 'secreto-de-pruebas');
  assert.ok(token.startsWith('rb.'));
  assert.equal(token.split('.').length, 3);

  const payload = await readToken(token, 'secreto-de-pruebas');
  assert.equal(payload.sub, 'u_123');
  assert.ok(payload.exp > Date.now());
});

test('readToken rechaza firma inválida, formato roto y token caducado', async () => {
  const token = await makeToken('u_123', 'secreto-de-pruebas');

  assert.equal(await readToken(token, 'otro-secreto'), null, 'firma con otro secreto');
  assert.equal(await readToken('rb.aaa.bbb', 'secreto-de-pruebas'), null, 'contenido manipulado');
  assert.equal(await readToken('sin-prefijo', 'secreto-de-pruebas'), null);
  assert.equal(await readToken('', 'secreto-de-pruebas'), null);
  assert.equal(await readToken(null, 'secreto-de-pruebas'), null);

  const caducado = await makeToken('u_123', 'secreto-de-pruebas', -1000);
  assert.equal(await readToken(caducado, 'secreto-de-pruebas'), null, 'token ya caducado');
});

test('la sesión dura 30 días', () => {
  assert.equal(SESSION_TTL_MS, 30 * 24 * 60 * 60 * 1000);
});

// ── Identificadores ─────────────────────────────────────────────────────────

test('genId y genShortId generan identificadores únicos y con prefijo', () => {
  const ids = new Set(Array.from({ length: 200 }, () => genId('u')));
  assert.equal(ids.size, 200, 'no debería haber colisiones');
  assert.ok([...ids][0].startsWith('u_'));

  const corto = genShortId('topic', 'Mântuire şi Îndurare');
  assert.match(corto, /^topic_[a-z0-9-]+$/, 'el slug va sin diacríticos ni mayúsculas');
  assert.ok(genShortId('topic', '🙏').startsWith('topic_x-'), 'sin caracteres utilizables cae a "x"');
});
