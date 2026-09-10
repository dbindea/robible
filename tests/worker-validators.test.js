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
  genPublicSlug,
  normalizeSecurityAnswer,
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

// ── Pregunta de seguridad escrita por el usuario (schema 8) ─────────────────
//
// Antes la pregunta se elegía de una lista de cinco y la respuesta tenía que
// ser un número de 1 a 6 dígitos. Ahora la pregunta la escribe el usuario, así
// que la respuesta es texto libre.

test('securityQuestionText: una línea, ni vacía ni un ensayo', () => {
  assert.ok(validators.securityQuestionText('Cum se numea câinele meu?'));
  assert.ok(!validators.securityQuestionText('¿?'), 'demasiado corta para significar algo');
  assert.ok(!validators.securityQuestionText(''));
  assert.ok(!validators.securityQuestionText('a'.repeat(121)));
  assert.ok(!validators.securityQuestionText(null));
});

test('securityAnswer: texto libre, no sólo números', () => {
  assert.ok(validators.securityAnswer('Rex'));
  assert.ok(validators.securityAnswer('7'), 'las respuestas numéricas antiguas siguen valiendo');
  assert.ok(validators.securityAnswer('  Bucureşti  '));
  assert.ok(!validators.securityAnswer(''));
  assert.ok(!validators.securityAnswer('   '), 'sólo espacios no es una respuesta');
  assert.ok(!validators.securityAnswer('a'.repeat(101)));
});

test('normalizeSecurityAnswer ignora mayúsculas, tildes y espacios de más', () => {
  // Es la razón de ser de la función: meses después nadie recuerda si escribió
  // "Rex", "rex" o " Rex ". Lo que se guarda es un hash, así que sin esto la
  // respuesta correcta no abriría la cuenta.
  const esperado = normalizeSecurityAnswer('Rex');
  for (const variante of ['rex', 'REX', '  Rex  ', 'Réx']) {
    assert.equal(normalizeSecurityAnswer(variante), esperado, `"${variante}" debería normalizar igual`);
  }
  assert.equal(normalizeSecurityAnswer('Cluj  Napoca'), 'cluj napoca', 'espacios internos colapsados');
});

test('normalizeSecurityAnswer no altera las respuestas numéricas', () => {
  // Las cuentas creadas antes del schema 8 guardan el hash de un número. Si la
  // normalización lo cambiara, esos usuarios perderían el acceso.
  for (const n of ['3', '42', '2010']) {
    assert.equal(normalizeSecurityAnswer(n), n);
  }
});

test('normalizeSecurityAnswer aguanta valores que no son texto', () => {
  assert.equal(normalizeSecurityAnswer(null), '');
  assert.equal(normalizeSecurityAnswer(undefined), '');
  assert.equal(normalizeSecurityAnswer(42), '42');
});

test('userType: sólo los dos tipos previstos', () => {
  assert.ok(validators.userType('user'));
  assert.ok(validators.userType('preacher'));
  assert.ok(!validators.userType('admin'), 'no se inventan roles nuevos');
  assert.ok(!validators.userType(''));
  assert.ok(!validators.userType(null));
});

test('email: laxo pero no cualquier cosa', () => {
  assert.ok(validators.email('a@b.co'));
  assert.ok(validators.email('nombre.apellido+etiqueta@dominio.com'));
  assert.ok(!validators.email('sin-arroba.com'));
  assert.ok(!validators.email('con espacio@dominio.com'));
  assert.ok(!validators.email('sin@dominio'));
  assert.ok(!validators.email('a'.repeat(250) + '@b.co'), 'más de 254 caracteres');
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

test('topicDescription: opcional, pero acotada', () => {
  // A diferencia del nombre, SÍ puede venir vacía: es opcional y '' significa
  // borrarla. Si el validador la rechazara, no habría forma de quitar una
  // descripción ya escrita.
  assert.ok(validators.topicDescription(''), 'la descripción vacía debe valer');
  assert.ok(validators.topicDescription('   '), 'sólo espacios equivale a vacía');
  assert.ok(validators.topicDescription('Versete despre nădejde'));
  assert.ok(validators.topicDescription('x'.repeat(200)));
  assert.ok(!validators.topicDescription('x'.repeat(201)));
  assert.ok(!validators.topicDescription(null));
  assert.ok(!validators.topicDescription(42));
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

// ── Slug público de los temas ───────────────────────────────────────────────
// Es la URL que el usuario reparte por ahí, así que conviene que no se rompa.

test('genPublicSlug conserva la parte legible del nombre', () => {
  assert.match(genPublicSlug('Ansiedad'), /^ansiedad-[0-9a-f]{4}$/);
  assert.match(genPublicSlug('Peace & Hope'), /^peace-hope-[0-9a-f]{4}$/);
});

test('genPublicSlug quita los diacríticos', () => {
  assert.match(genPublicSlug('Salvación'), /^salvacion-/);
  assert.match(genPublicSlug('Mântuire şi Îndurare'), /^mantuire-si-indurare-/);
});

test('genPublicSlug no vacía los nombres en alfabetos no latinos', () => {
  // La misma trampa que `slugifyBookName` (CLAUDE.md, trampa 6): filtrando con
  // [a-z0-9] los nombres chinos se quedaban en nada y el slug era solo el
  // sufijo aleatorio, ilegible e inútil para SEO.
  const chino = genPublicSlug('平安与盼望');
  assert.ok(chino.startsWith('平安与盼望-'), `se perdió el nombre: ${chino}`);

  const ruso = genPublicSlug('Надежда');
  assert.ok(ruso.startsWith('надежда-'), `se perdió el nombre: ${ruso}`);
});

test('genPublicSlug cae al sufijo aleatorio si no queda nada utilizable', () => {
  assert.match(genPublicSlug('🔥🔥🔥'), /^[0-9a-f]{4}$/);
  assert.match(genPublicSlug('---'), /^[0-9a-f]{4}$/);
  assert.match(genPublicSlug(''), /^[0-9a-f]{4}$/);
});

test('genPublicSlug no genera nada que rompa la URL', () => {
  for (const nombre of ['a/b', 'a?b', 'a#b', 'a b', 'a\\b', '../etc/passwd']) {
    const slug = genPublicSlug(nombre);
    assert.ok(validators.publicSlug(slug), `slug inválido para ${nombre}: ${slug}`);
    assert.ok(!/[/?#\s\\]/.test(slug), `caracteres peligrosos en ${slug}`);
  }
});

test('genPublicSlug acota la longitud y no colisiona', () => {
  const largo = genPublicSlug('a'.repeat(200));
  assert.ok(largo.length <= 53, `demasiado largo: ${largo.length}`);

  const slugs = new Set(Array.from({ length: 300 }, () => genPublicSlug('Ansiedad')));
  assert.ok(slugs.size > 290, `demasiadas colisiones: ${slugs.size}/300`);
});
