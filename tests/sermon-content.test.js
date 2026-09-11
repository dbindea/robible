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
  alternarMarca,
  citasDe,
  collectReferences,
  countWords,
  emptyContent,
  estimatedMinutes,
  generateOutline,
  insertarCita,
  marcadas,
  movePoint,
  newPoint,
  newSubpoint,
  quitarMarcas,
  normalizeContent,
  normalizeOutline,
  outlineWordCount,
  segmentarTexto,
  sermonWordCount,
  stepCompletion,
} from '../src/services/sermon-content.service.js';

// ── Forma del documento ─────────────────────────────────

test('los pasos son los ocho previstos y en orden', () => {
  // 'intro' va antes de 'development' a propósito, y no es lo que enseña el
  // curso (que dice escribirla al final): es una decisión del propietario
  // para no perder el hilo del orden en que se predica. Ver la nota de STEPS.
  assert.deepEqual(STEPS, ['text', 'observation', 'context', 'idea', 'structure', 'intro', 'development', 'final']);
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

test('intro y final son pasos independientes: uno no completa el otro', () => {
  // Antes eran el mismo paso (FINALIZARE); separarlos y que uno diera por
  // hecho al otro habría sido peor que no separarlos.
  const c = emptyContent();
  c.intro = 'Toți trecem prin încercări.';
  let hecho = stepCompletion(c);
  assert.equal(hecho.intro, true);
  assert.equal(hecho.final, false, 'la introducción no debe marcar la conclusión como hecha');

  const c2 = emptyContent();
  c2.conclusion = 'Bucurați-vă.';
  hecho = stepCompletion(c2);
  assert.equal(hecho.final, true);
  assert.equal(hecho.intro, false);
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

// ── Palabras marcadas a mano para la schiță ─────────────
//
// El corte automático adivina, y adivinar sobre el texto de una predicación
// sale mal: se queda con el principio de la frase, que casi nunca es lo que el
// predicador quiere ver desde el atril. Lo que marca con asteriscos manda.

test('marcadas saca las expresiones entre asteriscos, en orden', () => {
  const t = 'Dumnezeu nu cere *o credință perfectă*, ci *o credință care ascultă*.';
  assert.deepEqual(marcadas(t), ['o credință perfectă', 'o credință care ascultă']);
});

test('marcadas ignora asteriscos sueltos y marcas vacías', () => {
  // Un asterisco sin pareja es texto normal, no una marca a medias.
  assert.deepEqual(marcadas('esto * no marca nada'), []);
  assert.deepEqual(marcadas('ni ** esto'), []);
  assert.deepEqual(marcadas('ni *   * esto'), []);
});

test('una marca no cruza el salto de línea', () => {
  // Si lo hiciera, un asterisco olvidado se tragaría el resto del documento.
  assert.deepEqual(marcadas('empieza *aquí\ny sigue* abajo'), []);
});

test('quitarMarcas devuelve el texto limpio para leerlo', () => {
  assert.equal(quitarMarcas('la *fe* que *obedece*'), 'la fe que obedece');
  assert.equal(quitarMarcas(''), '');
  assert.equal(quitarMarcas(null), '');
});

// ── Citas en línea ────────────────────────────────────────
//
// Distinto de la marca con asteriscos: aquí no se destaca una palabra, se
// mete el VERSÍCULO ENTERO dentro del párrafo, en el sitio exacto donde se va
// a leer. Cubrir esto importa porque es justo la clase de fallo que no se ve
// hasta que se abre el PDF: si `quitarMarcas` no supiera de la sintaxis nueva,
// `{{Ioan 3:16|texto}}` se colaría tal cual en el documento impreso.

test('insertarCita mete la referencia y el versículo en el cursor', () => {
  const r = insertarCita('Textul spune că ', 16, 16, { label: 'Ioan 3:16', text: 'Fiindcă atât de mult a iubit Dumnezeu lumea…' });
  assert.equal(r.texto, 'Textul spune că {{Ioan 3:16|Fiindcă atât de mult a iubit Dumnezeu lumea…}}');
  assert.equal(r.cursor, r.texto.length, 'el cursor queda al final de lo insertado');
});

test('insertarCita sustituye la selección en vez de sumarse a ella', () => {
  // «la cita» ocupa los índices 9..16 de la frase de abajo.
  const r = insertarCita('pon aquí la cita después', 9, 16, { label: 'X 1:1', text: 'texto' });
  assert.equal(r.texto, 'pon aquí {{X 1:1|texto}} después');
});

test('quitarMarcas aplana una cita en línea a "referencia: versículo"', () => {
  const t = 'Textul spune că {{Ioan 3:16|Fiindcă atât de mult a iubit Dumnezeu lumea}}, și asta schimbă totul.';
  assert.equal(
    quitarMarcas(t),
    'Textul spune că Ioan 3:16: Fiindcă atât de mult a iubit Dumnezeu lumea, și asta schimbă totul.',
  );
});

test('quitarMarcas no deja escapar la sintaxis de llaves en ningún caso', () => {
  const t = 'Uno *marcado* y otro {{Rom 8:28|texto}} en la misma frase.';
  const limpio = quitarMarcas(t);
  assert.ok(!limpio.includes('{{') && !limpio.includes('}}'), `se coló la sintaxis: ${limpio}`);
  assert.ok(!limpio.includes('*'), `se coló un asterisco: ${limpio}`);
});

test('segmentarTexto separa negrita (marca) y cursiva (cita) del resto', () => {
  const t = 'Antes *destacado* y luego {{Ioan 3:16|Dumnezeu a iubit lumea}} y fin.';
  const seg = segmentarTexto(t);
  assert.deepEqual(seg, [
    { texto: 'Antes ' },
    { texto: 'destacado', bold: true },
    { texto: ' y luego ' },
    { texto: 'Ioan 3:16 ', bold: true, cita: true },
    { texto: 'Dumnezeu a iubit lumea', italica: true, cita: true },
    { texto: ' y fin.' },
  ]);
});

test('segmentarTexto sobre texto plano devuelve un único segmento', () => {
  assert.deepEqual(segmentarTexto('nada especial aquí'), [{ texto: 'nada especial aquí' }]);
  assert.deepEqual(segmentarTexto(''), [{ texto: '' }]);
});

test('una cita en línea cuenta como palabras predicadas', () => {
  const c = emptyContent();
  const p = newPoint('Un punto');
  c.structure.push(p);
  c.development[p.id] = {
    explain: 'Textul spune că {{Ioan 3:16|Fiindcă atât de mult a iubit Dumnezeu lumea}}.',
    illustrate: '', apply: '', refs: [],
  };
  // El recuento de `sermonWordCount` opera sobre el texto en bruto (ver el
  // comentario del propio archivo): no debe dar menos que las palabras que
  // hay de verdad en la explicación completa.
  assert.ok(sermonWordCount(c) >= 8, 'la cita insertada no está contando como predicada');
});

// El 11 sep 2026 se cambió a propósito: antes, en cuanto había algo marcado
// en el desarrollo, la schiță enseñaba SÓLO lo marcado y tiraba el comienzo
// de la frase; el predicador quiere las dos cosas — el arranque para
// situarse, y lo marcado para no perder el matiz — así que van juntas en la
// misma línea, y los asteriscos de lo marcado SÍ llegan a `keywords` (antes
// se prohibía expresamente). Lo pintan `TextoFormateado` y `runsDeTexto`
// (PDF) en negrita; no son texto plano suelto en ningún sitio.
test('la schiță combina el comienzo de la frase con lo marcado, no uno u otro', () => {
  const c = emptyContent();
  const p = newPoint('Omul înțelept');
  c.structure.push(p);
  c.development[p.id] = {
    explain: 'Una primera frase larga que el corte automático cogería entera. Pero lo que importa es *la roca*.',
    illustrate: '', apply: '', refs: [],
  };

  const o = generateOutline(c);
  assert.deepEqual(o.points[0].keywords, [
    'Una primera frase larga que…',
    'Pero lo que importa es… *la roca*',
  ]);
});

test('una marca más allá del recorte de palabras se añade igualmente', () => {
  const c = emptyContent();
  const p = newPoint('Punct');
  c.structure.push(p);
  // La marca ("cuatro cinco seis siete") empieza dentro de las 5 primeras
  // palabras y termina después: el recorte tiene que alargarse para no
  // partirla por la mitad.
  c.development[p.id] = {
    explain: 'Uno dos tres *cuatro cinco seis siete* ocho.',
    illustrate: '', apply: '', refs: [],
  };

  const o = generateOutline(c);
  assert.deepEqual(o.points[0].keywords, ['Uno dos tres *cuatro cinco seis siete*…']);
});

test('sin nada marcado, la schiță sigue cortando como antes', () => {
  const c = emptyContent();
  const p = newPoint('Punct');
  c.structure.push(p);
  c.development[p.id] = { explain: 'Prima frază. A doua frază.', illustrate: '', apply: '', refs: [] };

  const o = generateOutline(c);
  assert.deepEqual(o.points[0].keywords, ['Prima frază', 'A doua frază']);
});

test('los subpuntos salen siempre, antes que el desarrollo del punto', () => {
  const c = emptyContent();
  const p = newPoint('Punct');
  p.subpoints = [newSubpoint('Ascultarea')];
  c.structure.push(p);
  c.development[p.id] = { explain: 'texto con *marca*', illustrate: '', apply: '', refs: [] };

  const o = generateOutline(c);
  assert.deepEqual(o.points[0].keywords, ['Ascultarea', 'texto con *marca*']);
});

// ── Citas insertadas en la schiță ────────────────────────

test('citasDe convierte una cita en referencia negrita + primeras 5 palabras', () => {
  const t = 'Textul spune că {{Ioan 3:16|Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu}}.';
  assert.deepEqual(citasDe(t), ['*Ioan 3:16* Fiindcă atât de mult a…']);
});

test('citasDe no recorta un versículo ya corto', () => {
  assert.deepEqual(citasDe('{{Ioan 11:35|Isus a plâns}}'), ['*Ioan 11:35* Isus a plâns']);
});

test('una cita insertada en el desarrollo llega a la schiță aunque no se marque nada', () => {
  const c = emptyContent();
  const p = newPoint('Punct');
  c.structure.push(p);
  c.development[p.id] = {
    explain: 'Textul spune că {{Ioan 3:16|Fiindcă atât de mult a iubit Dumnezeu lumea}}.',
    illustrate: '', apply: '', refs: [],
  };

  const o = generateOutline(c);
  assert.ok(
    o.points[0].keywords.includes('*Ioan 3:16* Fiindcă atât de mult a…'),
    `la cita no llegó a la schiță: ${JSON.stringify(o.points[0].keywords)}`,
  );
});

test('una cita en la introducción o la conclusión también llega a la schiță', () => {
  const c = emptyContent();
  c.intro = 'Empezamos con {{Ioan 1:1|La început era Cuvântul}}.';
  c.conclusion = 'Terminamos con {{Apocalipsa 21:4|Dumnezeu va șterge orice lacrimă}}.';

  const o = generateOutline(c);
  assert.ok(o.intro.includes('*Ioan 1:1* La început era Cuvântul'), JSON.stringify(o.intro));
  assert.ok(o.conclusion.includes('*Apocalipsa 21:4*'), o.conclusion);
});

// ── El botón de marcar ──────────────────────────────────

test('alternarMarca envuelve la selección y deja el cursor donde toca', () => {
  const r = alternarMarca('la fe que obedece', 3, 5); // "fe"
  assert.equal(r.texto, 'la *fe* que obedece');
  assert.equal(r.texto.slice(r.desde, r.hasta), '*fe*', 'la selección debe abarcar la marca nueva');
});

test('el mismo botón desmarca lo que ya estaba marcado', () => {
  const r = alternarMarca('la *fe* que obedece', 4, 6); // "fe", ya marcada
  assert.equal(r.texto, 'la fe que obedece');
});

test('marcar y desmarcar deja el texto exactamente como estaba', () => {
  const original = 'Dumnezeu ne cere ascultare';
  const puesto = alternarMarca(original, 17, 26);
  const quitado = alternarMarca(puesto.texto, puesto.desde + 1, puesto.hasta - 1);
  assert.equal(quitado.texto, original);
});

test('los espacios de la selección quedan fuera de la marca', () => {
  // Seleccionar arrastrando con el dedo casi siempre se lleva un espacio; con
  // él dentro, `*palabra *` no sería una marca válida.
  const r = alternarMarca('la fe que obedece', 2, 6); // " fe " con espacios
  assert.equal(r.texto, 'la *fe* que obedece');
});

test('una selección vacía no toca el texto', () => {
  const r = alternarMarca('sin cambios', 4, 4);
  assert.equal(r.texto, 'sin cambios');
});

// ── Referencias del desarrollo ──────────────────────────

test('la schiță muestra las referencias del punto y las del desarrollo', () => {
  const c = emptyContent();
  const p = newPoint('Punct');
  p.refs = [{ book: 58, chapter: 1, verse: 22, label: 'Iacov 1:22' }];
  c.structure.push(p);
  c.development[p.id] = {
    explain: '', illustrate: '', apply: '',
    refs: [{ book: 42, chapter: 14, verse: 15, label: 'Ioan 14:15' }],
  };

  const o = generateOutline(c);
  assert.deepEqual(o.points[0].refs, ['Iacov 1:22', 'Ioan 14:15']);
});

test('una referencia repetida no sale dos veces en la schiță', () => {
  const c = emptyContent();
  const p = newPoint('Punct');
  p.refs = [{ book: 58, chapter: 1, verse: 22, label: 'Iacov 1:22' }];
  c.structure.push(p);
  c.development[p.id] = {
    explain: '', illustrate: '', apply: '',
    refs: [{ book: 58, chapter: 1, verse: 22, label: 'Iacov 1:22' }],
  };

  assert.deepEqual(generateOutline(c).points[0].refs, ['Iacov 1:22']);
});

// ── Los titulares de la schiță nunca llevan la sintaxis de marcado ─────────
//
// El título del punto y la idea central son titulares: se leen enteros y de
// un vistazo, así que los asteriscos no aportan nada y se quitan siempre. El
// 8 sep 2026 salían literalmente ("1. Pastorul care poarta de *grija*") en la
// predicación publicada.
//
// Las palabras clave (`keywords`) son harina de otro costal, y cambió el 11
// sep 2026: ahí el asterisco SÍ llega tal cual desde el 11 sep 2026, a
// propósito, para que el púlpito y el PDF puedan pintar en negrita lo que el
// predicador marcó. No es el mismo bug: quien pinta `keywords` (`SermonPulpit`,
// `definirSchita`) pasa siempre por `TextoFormateado` o `runsDeTexto`, así que
// el asterisco nunca llega a la pantalla como carácter literal.
test('generateOutline deja el título y la idea limpios, pero conserva la marca en las palabras clave', () => {
  const outline = generateOutline({
    idea: { central: 'Cine tiene al Señor por *pastor* no carece de nada' },
    structure: [
      {
        id: 'p1',
        title: 'El Pastor que *cuida*',
        subpoints: [{ title: 'No me *faltará* nada' }],
        refs: [],
      },
    ],
    development: { p1: { explain: 'David escribe como *pastor*.', illustrate: '', apply: '' } },
  });

  const punto = outline.points[0];
  assert.equal(punto.title, 'EL PASTOR QUE CUIDA');
  assert.ok(!outline.idea.includes('*'), `la idea conserva asteriscos: ${outline.idea}`);
  assert.deepEqual(punto.keywords, ['No me faltará nada', 'David escribe como *pastor*']);
});
