// Lógica de memorización: troceo, máscara y calendario de repasos.
//
// Sólo la parte pura. El resto del servicio toca localStorage y `api`, y ahí lo
// que se probaría es el doble, no el código.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  trocearPalabras,
  tieneCJK,
  indicesOcultos,
  enmascarar,
  semillaDe,
  escalonSiguiente,
  proximaFecha,
  tocaRepasar,
  contarPendientes,
  ESCALONES_DIAS,
  NIVEL_MAXIMO,
} from '../src/services/memorize.service.js';

// ── Troceo ────────────────────────────────────────────────────────────────

test('trocea una frase latina por espacios', () => {
  const piezas = trocearPalabras('Nu vă îngrijoraţi de nimic');
  assert.equal(piezas.length, 5);
  assert.deepEqual(piezas.map((p) => p.texto), ['Nu', 'vă', 'îngrijoraţi', 'de', 'nimic']);
  assert.ok(piezas.every((p) => !p.cjk));
});

test('trocea el chino por carácter, que es el fallo que tuvo la imagen', () => {
  // Sin espacios, `split(/\s+/)` devolvería una sola pieza y «ocultar la mitad»
  // sería ocultarlo todo o nada.
  const piezas = trocearPalabras('神爱世人');
  assert.equal(piezas.length, 4);
  assert.ok(piezas.every((p) => p.cjk));
});

test('un texto mixto separa los ideogramas de las palabras latinas', () => {
  const piezas = trocearPalabras('约翰 3:16');
  const textos = piezas.map((p) => p.texto);
  assert.deepEqual(textos, ['约', '翰', '3:16']);
  assert.deepEqual(piezas.map((p) => p.cjk), [true, true, false]);
});

test('el texto vacío no produce piezas', () => {
  assert.deepEqual(trocearPalabras(''), []);
  assert.deepEqual(trocearPalabras('   '), []);
  assert.deepEqual(trocearPalabras(undefined), []);
});

test('tieneCJK distingue los dos alfabetos', () => {
  assert.equal(tieneCJK('神爱世人'), true);
  assert.equal(tieneCJK('Nu vă îngrijoraţi'), false);
});

// ── Niveles ───────────────────────────────────────────────────────────────

test('el nivel 0 no tapa nada y el máximo lo tapa todo', () => {
  assert.equal(indicesOcultos(10, 0, 7).size, 0);
  assert.equal(indicesOcultos(10, NIVEL_MAXIMO, 7).size, 10);
});

test('los niveles son anidados: nada reaparece al subir', () => {
  // Si cada nivel sorteara sus huecos por su cuenta, al endurecer volverían a
  // verse palabras que ya estaban tapadas y parecería que se retrocede.
  const semilla = semillaDe({ book: 49, chapter: 4, verse: 6 });
  for (let n = 1; n < NIVEL_MAXIMO; n += 1) {
    const antes = indicesOcultos(12, n, semilla);
    const despues = indicesOcultos(12, n + 1, semilla);
    for (const i of antes) {
      assert.ok(despues.has(i), `el índice ${i} reaparece al pasar del nivel ${n} al ${n + 1}`);
    }
  }
});

test('el reparto no cambia entre llamadas con la misma referencia', () => {
  const semilla = semillaDe({ book: 18, chapter: 23, verse: 4 });
  const a = [...indicesOcultos(15, 3, semilla)].sort((x, y) => x - y);
  const b = [...indicesOcultos(15, 3, semilla)].sort((x, y) => x - y);
  assert.deepEqual(a, b);
});

test('referencias distintas reparten los huecos de forma distinta', () => {
  const a = [...indicesOcultos(20, 2, semillaDe({ book: 1, chapter: 1, verse: 1 }))].sort();
  const b = [...indicesOcultos(20, 2, semillaDe({ book: 40, chapter: 7, verse: 12 }))].sort();
  assert.notDeepEqual(a, b);
});

test('la proporción tapada crece con el nivel', () => {
  const semilla = semillaDe({ book: 0, chapter: 1, verse: 1 });
  const tamanos = [0, 1, 2, 3, 4, 5].map((n) => indicesOcultos(20, n, semilla).size);
  for (let i = 1; i < tamanos.length; i += 1) {
    assert.ok(tamanos[i] > tamanos[i - 1], `el nivel ${i} no tapa más que el ${i - 1}`);
  }
});

test('un nivel fuera de rango no revienta', () => {
  assert.equal(indicesOcultos(10, -3, 1).size, 0);
  assert.equal(indicesOcultos(10, 99, 1).size, 10);
  assert.equal(indicesOcultos(0, 3, 1).size, 0);
});

// ── Máscara ───────────────────────────────────────────────────────────────

test('una palabra tapada conserva su inicial y marca el resto', () => {
  assert.equal(enmascarar({ texto: 'nimic', cjk: false }), 'n····');
});

test('la puntuación no cuenta para la longitud de la máscara', () => {
  // «nimic;» son cinco letras: la pista de longitud sería falsa si el punto y
  // coma sumara un carácter.
  assert.equal(enmascarar({ texto: 'nimic;', cjk: false }), 'n····');
});

test('un ideograma se sustituye entero, porque no tiene inicial', () => {
  assert.equal(enmascarar({ texto: '神', cjk: true }), '○');
});

test('una palabra de una letra deja al menos una marca', () => {
  // Sin el mínimo saldría sólo la inicial y no se vería que hay algo tapado.
  assert.equal(enmascarar({ texto: 'a', cjk: false }), 'a·');
});

test('una pieza sin letras se deja como está', () => {
  assert.equal(enmascarar({ texto: '—', cjk: false }), '—');
});

// ── Calendario ────────────────────────────────────────────────────────────

test('acertar sube un escalón y fallar baja uno solo', () => {
  assert.equal(escalonSiguiente(0, true), 1);
  assert.equal(escalonSiguiente(3, true), 4);
  // Un despiste no puede tirar ocho semanas de trabajo.
  assert.equal(escalonSiguiente(5, false), 4);
});

test('los escalones no se salen del calendario', () => {
  assert.equal(escalonSiguiente(0, false), 0);
  assert.equal(escalonSiguiente(ESCALONES_DIAS.length - 1, true), ESCALONES_DIAS.length - 1);
});

test('la fecha siguiente respeta los días del escalón', () => {
  const desde = new Date('2026-01-01T10:00:00.000Z');
  const dia = 86_400_000;
  for (const [escalon, dias] of ESCALONES_DIAS.entries()) {
    const fecha = new Date(proximaFecha(escalon, desde));
    assert.equal(fecha.getTime() - desde.getTime(), dias * dia, `escalón ${escalon}`);
  }
});

test('la espera crece en cada escalón', () => {
  for (let i = 1; i < ESCALONES_DIAS.length; i += 1) {
    assert.ok(ESCALONES_DIAS[i] > ESCALONES_DIAS[i - 1]);
  }
});

test('toca repasar lo vencido y lo que aún no tiene fecha', () => {
  const ahora = new Date('2026-03-10T12:00:00.000Z');
  assert.equal(tocaRepasar({ dueAt: '2026-03-09T12:00:00.000Z' }, ahora), true);
  assert.equal(tocaRepasar({ dueAt: '2026-03-11T12:00:00.000Z' }, ahora), false);
  // Recién añadido: nace pendiente, se memoriza hoy y no mañana.
  assert.equal(tocaRepasar({ dueAt: null }, ahora), true);
  assert.equal(tocaRepasar({}, ahora), true);
});

test('contarPendientes cuenta sólo lo vencido', () => {
  const ahora = new Date('2026-03-10T12:00:00.000Z');
  const items = [
    { dueAt: '2026-03-01T00:00:00.000Z' },
    { dueAt: '2026-03-10T11:59:00.000Z' },
    { dueAt: '2026-04-01T00:00:00.000Z' },
  ];
  assert.equal(contarPendientes(items, ahora), 2);
  assert.equal(contarPendientes([], ahora), 0);
});

test('una ronda completa de aciertos llega al escalón más largo', () => {
  let escalon = 0;
  for (let i = 0; i < ESCALONES_DIAS.length * 2; i += 1) escalon = escalonSiguiente(escalon, true);
  assert.equal(ESCALONES_DIAS[escalon], ESCALONES_DIAS[ESCALONES_DIAS.length - 1]);
});

// ── Frontend por delante del worker ───────────────────────────────────────

test('un 404 de ruta desconocida se distingue de uno de negocio', async () => {
  // Netlify y Cloudflare se despliegan por separado, así que siempre hay una
  // ventana en la que el frontend pide una ruta que el worker aún no tiene. Los
  // dos casos son 404; sólo el código los separa. Confundirlos dejaba la
  // memorización rota —sin caer a localStorage— para todo el que hubiera
  // iniciado sesión.
  const { ApiError } = await import('../src/services/apiClient.js');
  const { rutaNoDesplegada } = await import('../src/services/memorize.service.js');

  // Lo que devuelve el worker cuando no conoce la ruta.
  assert.equal(rutaNoDesplegada(new ApiError('not_found', 404)), true);
  // Lo que devuelve la ruta cuando existe y el versículo no está memorizado.
  assert.equal(rutaNoDesplegada(new ApiError('memorization_not_found', 404)), false);
  // Y nada que no sea un 404.
  assert.equal(rutaNoDesplegada(new ApiError('invalid_verse_ref', 400)), false);
  assert.equal(rutaNoDesplegada(new ApiError('not_found', 500)), false);
  assert.equal(rutaNoDesplegada(new Error('not_found')), false);
});
