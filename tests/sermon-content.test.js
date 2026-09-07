// Documento de preparación, recuento y generación de la schiță.
//
// Por qué importa cubrirlo: si `normalizeContent` deja de completar un campo,
// la pantalla de preparación revienta con el trabajo del predicador dentro; y
// si la generación de la schiță pierde un punto, él lo descubre en el púlpito.

globalThis.crypto ??= (await import('node:crypto')).webcrypto;

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STEPS,
  collectReferences,
  countWords,
  emptyContent,
  estimatedMinutes,
  generateOutline,
  movePoint,
  newPoint,
  newSubpoint,
  normalizeContent,
  normalizeOutline,
  outlineWordCount,
  sermonWordCount,
  stepCompletion,
} from '../src/services/sermon-content.service.js';

// ── Forma del documento ─────────────────────────────────

test('los pasos son los siete previstos y en orden', () => {
  assert.deepEqual(STEPS, ['text', 'observation', 'context', 'idea', 'structure', 'development', 'final']);
});

test('el documento vacío trae todas las claves', () => {
  const c = emptyContent();
  for (const clave of ['marks', 'observation', 'context', 'idea', 'structure', 'development', 'intro', 'conclusion']) {
    assert.ok(clave in c, `falta ${clave}`);
  }
});

test('normalizeContent completa lo que falte sin perder lo que hay', () => {
  // Un documento guardado por una versión anterior de la app.
  const viejo = { idea: { central: 'Auzirea și împlinirea' }, intro: 'Două case' };
  const c = normalizeContent(viejo);

  assert.equal(c.idea.central, 'Auzirea și împlinirea', 'no debe perder lo escrito');
  assert.equal(c.idea.purpose, '', 'lo que falta se completa vacío');
  assert.deepEqual(c.structure, [], 'y los arrays también');
  assert.equal(c.intro, 'Două case');
});

test('normalizeContent aguanta basura sin reventar', () => {
  for (const entrada of [null, undefined, '', 'no soy json', '{roto', 42, []]) {
    const c = normalizeContent(entrada);
    assert.ok(Array.isArray(c.structure), `falló con ${JSON.stringify(entrada)}`);
    assert.equal(typeof c.idea.central, 'string');
  }
});

test('normalizeContent acepta el JSON tal como se guarda', () => {
  const original = { ...emptyContent(), intro: 'Text' };
  const c = normalizeContent(JSON.stringify(original));
  assert.equal(c.intro, 'Text');
});

// ── Progreso ────────────────────────────────────────────

test('stepCompletion marca sólo lo que tiene algo escrito', () => {
  const c = emptyContent();
  let hecho = stepCompletion(c);
  assert.equal(Object.values(hecho).every((v) => v === false), true, 'un documento vacío no tiene nada hecho');

  c.idea.central = 'Ceva';
  c.structure.push(newPoint('Omul înțelept'));
  hecho = stepCompletion(c);
  assert.equal(hecho.idea, true);
  assert.equal(hecho.structure, true);
  assert.equal(hecho.observation, false);
});

test('los espacios en blanco no cuentan como progreso', () => {
  const c = emptyContent();
  c.observation.repeats = '   ';
  assert.equal(stepCompletion(c).observation, false);
});

// ── Estructura ──────────────────────────────────────────

test('los puntos y subpuntos reciben identificadores únicos', () => {
  const ids = new Set(Array.from({ length: 200 }, () => newPoint().id));
  assert.equal(ids.size, 200);
  assert.ok(newPoint().id.startsWith('p_'));
  assert.ok(newSubpoint().id.startsWith('s_'));
});

test('movePoint reordena sin tocar el array original', () => {
  const original = [newPoint('A'), newPoint('B'), newPoint('C')];
  const movido = movePoint(original, 0, 1);
  assert.equal(movido[0].title, 'B');
  assert.equal(movido[1].title, 'A');
  assert.equal(original[0].title, 'A', 'el original no debe mutar');
});

test('movePoint no se sale por los extremos', () => {
  const l = [newPoint('A'), newPoint('B')];
  assert.equal(movePoint(l, 0, -1), l, 'subir el primero no hace nada');
  assert.equal(movePoint(l, 1, 1), l, 'bajar el último tampoco');
});

// ── Recuento ────────────────────────────────────────────

test('countWords cuenta palabras, no espacios', () => {
  assert.equal(countWords('una dos tres'), 3);
  assert.equal(countWords('  una   dos  '), 2);
  assert.equal(countWords(''), 0);
  assert.equal(countWords(null), 0);
});

test('el recuento suma todo lo que se predica', () => {
  const c = emptyContent();
  c.intro = 'una dos tres';           // 3
  c.conclusion = 'cuatro cinco';       // 2
  const p = newPoint('seis siete');    // 2
  c.structure.push(p);
  c.development[p.id] = { explain: 'ocho', illustrate: 'nueve diez', apply: '' }; // 3

  assert.equal(sermonWordCount(c), 10);
});

test('el recuento no cuenta lo que no se predica', () => {
  const c = emptyContent();
  // La observación y el contexto son notas de estudio: no se leen en el púlpito.
  c.observation.repeats = 'esto no se predica en voz alta jamás';
  c.context.historical = 'ni esto tampoco';
  assert.equal(sermonWordCount(c), 0);
});

test('la estimación de minutos usa el ritmo de la especificación', () => {
  // 1.927 palabras ≈ 29 minutos, que es la referencia del documento original.
  assert.equal(estimatedMinutes(1927), 29);
  assert.equal(estimatedMinutes(0), 1, 'nunca menos de un minuto');
});

// ── Schiță ──────────────────────────────────────────────

test('la schiță se genera desde la estructura ya escrita', () => {
  const c = emptyContent();
  c.idea.central = 'Auzirea plus împlinirea';
  c.idea.purpose = 'Să pună în practică ce aud';
  const p1 = newPoint('Omul înțelept ascultă');
  const p2 = newPoint('Furtuna descoperă temelia');
  c.structure.push(p1, p2);
  c.development[p1.id] = { explain: 'Aude. Face.', illustrate: 'Două case', apply: '' };

  const o = generateOutline(c);
  assert.equal(o.idea, 'Auzirea plus împlinirea');
  assert.equal(o.points.length, 2, 'no debe perder ningún punto');
  assert.equal(o.points[0].title, 'OMUL ÎNȚELEPT ASCULTĂ', 'los títulos van en mayúsculas para el púlpito');
  assert.equal(o.application, 'Să pună în practică ce aud');
});

test('la schiță de una predicación real cabe en el púlpito', () => {
  // Es su razón de ser: 1.500-2.500 palabras de predicación frente a 150-250 de
  // schiță. Se construye una predicación de tamaño realista, porque con una
  // muestra de treinta palabras el ratio no dice nada: los recortes de
  // `claves()` son topes absolutos, no porcentajes.
  const parrafo = (n) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ') + '.';

  const c = emptyContent();
  c.intro = `${parrafo(60)} ${parrafo(60)} ${parrafo(60)}`;
  c.conclusion = `${parrafo(50)} ${parrafo(50)}`;
  c.idea.central = 'Auzirea plus împlinirea';
  c.idea.purpose = parrafo(40);

  for (let i = 0; i < 3; i++) {
    const p = newPoint(`Punctul ${i + 1}`);
    p.subpoints = [newSubpoint('Subpunct unu'), newSubpoint('Subpunct doi')];
    c.structure.push(p);
    c.development[p.id] = {
      explain: `${parrafo(120)} ${parrafo(120)}`,
      illustrate: parrafo(100),
      apply: parrafo(80),
    };
  }

  const palabrasPredica = sermonWordCount(c);
  const palabrasSchita = outlineWordCount(generateOutline(c));

  assert.ok(palabrasPredica > 1500, `la muestra debería ser realista, son ${palabrasPredica} palabras`);
  assert.ok(
    palabrasSchita <= 250,
    `la schiță se ha ido de largo: ${palabrasSchita} palabras (el tope del púlpito son ~250)`,
  );
  assert.ok(
    palabrasSchita < palabrasPredica / 8,
    `la schiță (${palabrasSchita}) debería ser una fracción de la predicación (${palabrasPredica})`,
  );
});

test('un propósito largo no se cuela entero en la schiță', () => {
  // El propósito se escribe con calma en el estudio y puede ocupar un párrafo.
  // Volcarlo tal cual convertiría la schiță en el resumen largo que no debe ser.
  const c = emptyContent();
  c.idea.purpose = 'Quiero que el oyente entienda que la obediencia no es opcional, que la crea de verdad en su corazón, y que actúe en consecuencia toda la semana.';
  const o = generateOutline(c);
  assert.ok(
    countWords(o.application) <= 9,
    `la aplicación debería ir recortada, tiene ${countWords(o.application)} palabras`,
  );
});

test('la schiță recorta las frases largas', () => {
  const c = emptyContent();
  c.intro = 'Esta es una frase con bastantes más de seis palabras seguidas';
  const o = generateOutline(c);
  assert.ok(o.intro[0].endsWith('…'), `debería recortarse: ${o.intro[0]}`);
});

test('generar la schiță de un documento vacío no revienta', () => {
  const o = generateOutline(emptyContent());
  assert.deepEqual(o.points, []);
  assert.equal(o.idea, '');
});

test('normalizeOutline aguanta basura', () => {
  for (const entrada of [null, '{roto', 42, 'texto']) {
    const o = normalizeOutline(entrada);
    assert.ok(Array.isArray(o.points), `falló con ${JSON.stringify(entrada)}`);
  }
});

// ── Referencias ─────────────────────────────────────────

test('se recogen todas las referencias citadas, sin repetir', () => {
  // Es lo que hay que dejar disponible sin conexión antes de subir al púlpito.
  const c = emptyContent();
  const p = newPoint('Punct');
  p.refs = [{ book: 58, chapter: 1, verse: 22, label: 'Iacov 1:22' }];
  c.structure.push(p);
  c.development[p.id] = {
    explain: '', illustrate: '', apply: '',
    refs: [
      { book: 58, chapter: 1, verse: 22, label: 'Iacov 1:22' }, // repetida
      { book: 39, chapter: 7, verse: 24, label: 'Matei 7:24' },
    ],
  };

  const refs = collectReferences(c);
  assert.equal(refs.length, 2, 'la repetida no debe contarse dos veces');
});

test('collectReferences ignora referencias mal formadas', () => {
  const c = emptyContent();
  const p = newPoint('Punct');
  p.refs = [null, {}, { chapter: 1 }, { book: 0, chapter: 1, verse: 1, label: 'Geneza 1:1' }];
  c.structure.push(p);
  const refs = collectReferences(c);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].book, 0, 'Génesis es el libro 0: un índice falsy no debe descartarse');
});
