// Modo Amvon: lo que se guarda antes de subir al púlpito.
//
// La regla que protege este archivo es una sola: durante la predicación no se
// toca la red. Si la instantánea no lleva lo necesario, el predicador se queda
// mirando una pantalla vacía delante de la congregación — y ahí no hay
// reintentos que valgan.

globalThis.window ??= {};
globalThis.document ??= { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' };
globalThis.localStorage ??= {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};
globalThis.crypto ??= (await import('node:crypto')).webcrypto;

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FONT_SIZES,
  buildSnapshot,
  clearActive,
  clearPosition,
  clearSnapshot,
  formatElapsed,
  getActive,
  getFontSize,
  getPlannedMinutes,
  getPosition,
  getSnapshot,
  hasSnapshot,
  keepScreenAwake,
  markActive,
  savePosition,
  setFontSize,
  setPlannedMinutes,
} from '../src/services/sermon-pulpit.service.js';

const SERMON = { id: 'sermon_1', title: 'Casa zidită pe stâncă', reference: 'Matei 7:24-27' };
const OUTLINE = { version: 1, idea: 'Auzirea plus împlinirea', intro: [], points: [{ title: 'OMUL ÎNȚELEPT' }], application: '', conclusion: '' };

// ── Instantánea ─────────────────────────────────────────

test('la instantánea guarda todo lo que el púlpito va a necesitar', () => {
  clearSnapshot(SERMON.id);
  const snap = buildSnapshot({
    sermon: SERMON,
    outline: OUTLINE,
    pericope: [{ numero: 24, texto: 'De aceea…' }],
    references: [{ book: 58, chapter: 1, verse: 22, label: 'Iacov 1:22' }],
    resolveVerse: () => 'Fiţi împlinitori ai Cuvântului.',
  });

  assert.ok(snap, 'debería haberse guardado');
  assert.equal(snap.title, SERMON.title);
  assert.equal(snap.outline.points.length, 1);
  assert.equal(snap.pericope.length, 1);
  assert.equal(hasSnapshot(SERMON.id), true);
});

test('la instantánea guarda el TEXTO de las referencias, no sólo la cita', () => {
  // Es la diferencia entre poder abrir un versículo en el púlpito o no. Dejar
  // sólo las coordenadas obligaría a resolverlas contra la Biblia en marcha, y
  // si esa no llegó a cargarse el predicador se queda con un hueco.
  clearSnapshot(SERMON.id);
  buildSnapshot({
    sermon: SERMON,
    outline: OUTLINE,
    pericope: [],
    references: [{ book: 58, chapter: 1, verse: 22, label: 'Iacov 1:22' }],
    resolveVerse: () => 'Fiţi împlinitori ai Cuvântului.',
  });

  const guardada = getSnapshot(SERMON.id).references[0];
  assert.equal(guardada.text, 'Fiţi împlinitori ai Cuvântului.');
});

test('una referencia que no se puede resolver se guarda vacía, no se omite', () => {
  // En el púlpito se verá "no disponible", que es honesto. Omitirla haría
  // desaparecer un botón que el predicador espera encontrar.
  clearSnapshot(SERMON.id);
  buildSnapshot({
    sermon: SERMON, outline: OUTLINE, pericope: [],
    references: [{ book: 99, chapter: 1, verse: 1, label: 'Inexistent 1:1' }],
    resolveVerse: () => '',
  });

  const refs = getSnapshot(SERMON.id).references;
  assert.equal(refs.length, 1);
  assert.equal(refs[0].text, '');
  assert.equal(refs[0].label, 'Inexistent 1:1');
});

test('sin instantánea no se inventa nada', () => {
  clearSnapshot('sermon_inexistente');
  assert.equal(getSnapshot('sermon_inexistente'), null);
  assert.equal(hasSnapshot('sermon_inexistente'), false);
});

// ── Posición del scroll ─────────────────────────────────

test('la posición se guarda y se recupera', () => {
  clearPosition(SERMON.id);
  assert.equal(getPosition(SERMON.id), 0, 'sin nada guardado se empieza arriba');

  savePosition(SERMON.id, 609);
  assert.equal(getPosition(SERMON.id), 609);
});

test('una posición corrupta no rompe la vuelta al púlpito', () => {
  localStorage.setItem(`robible:pulpit:pos:v1:${SERMON.id}`, '{roto');
  assert.equal(getPosition(SERMON.id), 0);
  localStorage.setItem(`robible:pulpit:pos:v1:${SERMON.id}`, JSON.stringify({ scrollTop: 'mucho' }));
  assert.equal(getPosition(SERMON.id), 0, 'un valor no numérico cae a cero');
});

// ── Recuperación tras interrupción ──────────────────────

test('vuelve a la predicación que se estaba predicando', () => {
  clearActive();
  assert.equal(getActive(), null);
  markActive(SERMON.id);
  assert.equal(getActive(), SERMON.id);
});

test('un Modo Amvon olvidado no secuestra el arranque para siempre', () => {
  // Sin ventana de tiempo, entrar en la aplicación meses después te devolvería
  // al púlpito de una predicación ya dada.
  const hace7Horas = Date.now() - 7 * 60 * 60 * 1000;
  localStorage.setItem('robible:pulpit:active', JSON.stringify({ sermonId: SERMON.id, at: hace7Horas }));
  assert.equal(getActive(), null, 'más de seis horas: se descarta');

  const hace1Hora = Date.now() - 60 * 60 * 1000;
  localStorage.setItem('robible:pulpit:active', JSON.stringify({ sermonId: SERMON.id, at: hace1Hora }));
  assert.equal(getActive(), SERMON.id, 'dentro de la ventana: se recupera');
});

test('salir del púlpito limpia la marca', () => {
  markActive(SERMON.id);
  clearActive();
  assert.equal(getActive(), null);
});

test('una marca corrupta no revienta el arranque de la aplicación', () => {
  for (const basura of ['{roto', '{}', JSON.stringify({ sermonId: 'x' })]) {
    localStorage.setItem('robible:pulpit:active', basura);
    assert.doesNotThrow(() => getActive());
  }
});

// ── Preferencias ────────────────────────────────────────

test('el tamaño por defecto es grande, no normal', () => {
  // El tamaño de lectura de mano no se ve desde el atril; empezar en "normal"
  // obligaría a todo el mundo a cambiarlo la primera vez.
  localStorage.removeItem('robible:pulpit:fontSize');
  assert.equal(getFontSize(), 'large');
});

test('el tamaño se recuerda y se rechaza lo que no está previsto', () => {
  setFontSize('xlarge');
  assert.equal(getFontSize(), 'xlarge');
  setFontSize('gigante');
  assert.equal(getFontSize(), 'xlarge', 'un valor inventado no debe aplicarse');
  assert.deepEqual(FONT_SIZES, ['normal', 'large', 'xlarge']);
});

test('la duración prevista se acota y admite no tener cronómetro', () => {
  setPlannedMinutes(35);
  assert.equal(getPlannedMinutes(), 35);

  setPlannedMinutes(0);
  assert.equal(getPlannedMinutes(), 0, 'cero significa sin cronómetro');

  setPlannedMinutes(9999);
  assert.equal(getPlannedMinutes(), 180, 'se acota a tres horas');
});

// ── Cronómetro ──────────────────────────────────────────

test('el reloj se lee de un vistazo', () => {
  assert.equal(formatElapsed(0), '0:00');
  assert.equal(formatElapsed(65_000), '1:05');
  assert.equal(formatElapsed(18 * 60_000 + 42_000), '18:42');
  assert.equal(formatElapsed(-500), '0:00', 'nunca en negativo');
});

// ── Pantalla encendida ──────────────────────────────────

test('sin soporte de wakeLock no se bloquea el modo ni se lanza un error', () => {
  // La especificación es explícita: si el navegador no lo permite, no se
  // impide predicar ni se llena la pantalla de avisos.
  delete globalThis.navigator;
  globalThis.navigator = {};
  const bloqueo = keepScreenAwake();
  assert.equal(bloqueo.supported, false);
  assert.doesNotThrow(() => bloqueo.release());
});
