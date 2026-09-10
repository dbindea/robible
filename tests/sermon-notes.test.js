// Las notas de trabajo y la propoziția de tranziție.
//
// Son dos campos nuevos del documento de preparación y tiran en direcciones
// contrarias, que es justo por lo que conviene fijarlos con tests:
//
//   - `notes` es el cuaderno del predicador. Se escribe, se relee y **no sale
//     de ahí**: ni al recuento, ni al documento, ni al PDF, ni a la página
//     pública. Un apunte a medio pensar publicado bajo su nombre es el peor
//     fallo posible de este módulo, y no habría forma de saber que ha pasado.
//   - `transition` es lo contrario: se predica, así que cuenta, se imprime y
//     se publica.

globalThis.crypto ??= (await import('node:crypto')).webcrypto;

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  emptyContent,
  generateOutline,
  mergeOutline,
  normalizeContent,
  normalizeOutline,
  outlineWordCount,
  sermonWordCount,
  stepCompletion,
} from '../src/services/sermon-content.service.js';
import { definirPredica, definirSchita } from '../src/services/sermon-pdf.service.js';
import { tieneNotaDeTipo, sugerenciasDeTransicion } from '../src/config/homiletics.js';

const SECRETO = 'ZZQUENADIEVEA';

const contenidoDePrueba = () => ({
  ...emptyContent(),
  notes: `Ilustrația cu marinarul ${SECRETO}`,
  transition: 'Să vedem trei MOTIVE pentru care creștinul suferă',
  idea: { exegetical: '', purpose: '', central: 'Ideea', question: '' },
  structure: [{ id: 'p_1', title: 'Primul punct', refs: [], subpoints: [] }],
  development: { p_1: { explain: 'Explicație', illustrate: '', apply: '', refs: [] } },
  intro: 'Introducere',
  conclusion: 'Încheiere',
});

/** Todo el texto de una definición de pdfmake, aplanado. */
const textoDelPdf = (definicion) => {
  const trozos = [];
  const rec = (n) => {
    if (Array.isArray(n)) return n.forEach(rec);
    if (!n || typeof n !== 'object') return;
    if (n.stack) return rec(n.stack);
    if (n.columns) return rec(n.columns);
    if (typeof n.text === 'string') trozos.push(n.text);
    else if (Array.isArray(n.text)) rec(n.text);
  };
  rec(definicion.content);
  return trozos.join('\n');
};

// ── Las notas no salen de la preparación ──────────────────────────────────

test('normalizeContent completa notes y transition en documentos viejos', () => {
  // Un documento guardado antes de que existieran los dos campos. Sin esto, la
  // pantalla accede a `content.notes.trim()` sobre `undefined` y revienta con
  // el trabajo del predicador dentro.
  const viejo = normalizeContent({ version: 1, structure: [], development: {} });
  assert.equal(viejo.notes, '');
  assert.equal(viejo.transition, '');
});

test('las notas no cuentan como palabras predicadas', () => {
  const c = contenidoDePrueba();
  const conNotas = sermonWordCount(c);
  const sinNotas = sermonWordCount({ ...c, notes: '' });
  assert.equal(conNotas, sinNotas, 'el cuaderno de trabajo está inflando la duración');
});

test('la transición sí cuenta como palabras predicadas', () => {
  const c = contenidoDePrueba();
  const conTransicion = sermonWordCount(c);
  const sinTransicion = sermonWordCount({ ...c, transition: '' });
  assert.ok(conTransicion > sinTransicion, 'la transición se predica y no se está contando');
});

test('las notas no llegan al PDF de la predicación', () => {
  const texto = textoDelPdf(definirPredica({ title: 'T' }, contenidoDePrueba()));
  assert.ok(!texto.includes(SECRETO), 'el cuaderno de trabajo se ha impreso en el PDF');
  assert.ok(texto.includes('MOTIVE'), 'falta la transición, que sí se predica');
});

test('las notas no llegan a la schiță', () => {
  const o = generateOutline(contenidoDePrueba());
  assert.ok(!JSON.stringify(o).includes(SECRETO), 'el cuaderno de trabajo se ha colado en la schiță');
  assert.equal(o.transition, 'Să vedem trei MOTIVE pentru care creștinul suferă');
});

test('las notas cuentan para dar el paso TEXT por hecho', () => {
  // Hay quien llega al texto con una página de apuntes y ni una palabra
  // subrayada todavía; la línea de progreso lo daba por vacío.
  const solo = { ...emptyContent(), notes: 'un gând' };
  assert.equal(stepCompletion(solo).text, true);
  assert.equal(stepCompletion(emptyContent()).text, false);
});

// ── La transición, de la preparación al atril ─────────────────────────────

test('la transición se imprime entera en la schiță, sin guion', () => {
  const o = generateOutline(contenidoDePrueba());
  const texto = textoDelPdf(definirSchita({ title: 'T' }, o));
  assert.ok(texto.includes('Să vedem trei MOTIVE pentru care creștinul suferă'));
  assert.ok(!texto.includes('- Să vedem trei MOTIVE'), 'la transición no es una línea de lista');
});

test('la transición cuenta en el recuento de la schiță', () => {
  const o = generateOutline(contenidoDePrueba());
  assert.ok(outlineWordCount(o) > outlineWordCount({ ...o, transition: '' }));
});

test('regenerar respeta la transición que reescribió el predicador', () => {
  const generada = generateOutline(contenidoDePrueba());
  const aMano = { ...generada, transition: 'Trei motive, și le vom lua pe rând' };

  const contenidoNuevo = { ...contenidoDePrueba(), transition: 'Otra cosa distinta' };
  const { outline } = mergeOutline(aMano, generateOutline(contenidoNuevo));

  assert.equal(outline.transition, 'Trei motive, și le vom lua pe rând');
});

test('regenerar sí refresca la transición que nadie tocó', () => {
  const generada = generateOutline(contenidoDePrueba());
  const contenidoNuevo = { ...contenidoDePrueba(), transition: 'Patru PAȘI spre biruință' };
  const { outline } = mergeOutline(generada, generateOutline(contenidoNuevo));

  assert.equal(outline.transition, 'Patru PAȘI spre biruință');
});

test('normalizeOutline completa transition en schițe anteriores', () => {
  assert.equal(normalizeOutline({ version: 1, points: [] }).transition, '');
});

// ── El guion de los tres tipos ────────────────────────────────────────────

test('textual y temática tienen nota propia en los SIETE pasos', () => {
  // Antes eran tres. Quedarse a medias era peor que no estar: en las otras
  // cuatro pantallas se leía la guía de un curso de expositiva sin que nada lo
  // advirtiera.
  const PASOS = ['text', 'observation', 'context', 'idea', 'structure', 'development', 'final'];
  for (const tipo of ['textual', 'thematic']) {
    for (const paso of PASOS) {
      assert.equal(tieneNotaDeTipo(tipo, paso), true, `falta la nota de ${tipo} en ${paso}`);
    }
  }
});

test('la expositiva no lleva nota de tipo: la guía entera ya es suya', () => {
  assert.equal(tieneNotaDeTipo('expositive', 'text'), false);
  assert.equal(tieneNotaDeTipo('expositive', 'final'), false);
});

test('hay tres plantillas de transición y se nombran s1..s3', () => {
  assert.deepEqual(sugerenciasDeTransicion(), ['s1', 's2', 's3']);
});
