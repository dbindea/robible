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
  alternarSubtitulo,
  bloquesDe,
  citasDe,
  collectReferences,
  countWords,
  etiquetaDeReferencia,
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
  subtituloDe,
} from '../src/services/sermon-content.service.js';

// ── Forma del documento ─────────────────────────────────

test('los pasos son los siete previstos y en orden', () => {
  // 'intro' NO es un paso: se escribe dentro de 'development', en la misma
  // pantalla y antes de los puntos. Sigue yendo antes que ellos —al revés de
  // lo que enseña el curso, que la deja para el final— pero sin pantalla
  // propia. Ver la nota de STEPS.
  assert.deepEqual(STEPS, ['text', 'observation', 'context', 'idea', 'structure', 'development', 'final']);
  assert.ok(!STEPS.includes('intro'), 'la introducción dejó de ser un paso');
});

test('el documento vacío trae todas las claves', () => {
  const c = emptyContent();
  // `intro` y `diagram` siguen en el documento aunque no tengan paso propio:
  // lo que cambió es dónde se editan, no lo que se guarda.
  for (const clave of ['marks', 'observation', 'context', 'idea', 'structure', 'development', 'intro', 'diagram', 'conclusion']) {
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

test('el recuento de la schiță cuenta lo que se LEE, no la sintaxis', () => {
  // Mide sobre el texto limpio, igual que `sermonWordCount`. Contando la
  // cadena cruda, un rótulo sumaba una palabra de más (el `##` suelto) y una
  // cita una de menos, porque `3:16|Fiindcă` no tiene espacio en medio y
  // cuenta como un solo token. Con setenta claves la cuenta se va lo bastante
  // como para que el predicador no se fíe de ella.
  const soloClave = (k) => outlineWordCount({ points: [{ id: 'p', title: '', keywords: [k], refs: [] }] });

  assert.equal(soloClave('{{Ioan 3:16|Fiindcă atât de mult a iubit}}'), 8);
  assert.equal(soloClave('## ZIDIREA CASEI'), 2);
  assert.equal(soloClave('Aceasta este o *frază* normală'), 5);
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

// ── La tercera sintaxis: el subtítulo del predicador ────
//
// `## Zidirea casei` al principio de una línea. Es de LÍNEA y no de
// delimitadores, así que no puede chocar con `*marca*` ni con `{{cita}}`.

test('subtituloDe reconoce el rótulo y exige el espacio detrás', () => {
  assert.equal(subtituloDe('## Zidirea casei'), 'Zidirea casei');
  assert.equal(subtituloDe('   ###  Terminarea casei  '), 'Terminarea casei');
  // Sin espacio no es un rótulo: «#1 problema» es texto normal.
  assert.equal(subtituloDe('#1 problema'), '');
  assert.equal(subtituloDe('texto ## en medio'), '');
  assert.equal(subtituloDe('##'), '');
});

test('quitarMarcas no deja escapar la almohadilla en ningún caso', () => {
  // El gemelo del test de las llaves: la tercera sintaxis nace con la misma
  // red que las otras dos. Si un `##` llega a pantalla, es la trampa 33 otra
  // vez — y la vez anterior se vio en una predicación ya publicada.
  const t = 'Primul rând.\n## Zidirea casei\nAl doilea rând cu *marcaj* și {{Rom 8:28|text}}.';
  const limpio = quitarMarcas(t);
  assert.ok(!limpio.includes('#'), `se coló una almohadilla: ${limpio}`);
  assert.ok(limpio.includes('Zidirea casei'), 'el texto del rótulo tiene que quedarse');
  assert.ok(!limpio.includes('*') && !limpio.includes('{{'), limpio);
});

test('bloquesDe parte por línea en blanco y conserva el salto simple', () => {
  // Es la respuesta a «no tengo cómo poner párrafo nuevo»: la línea en blanco
  // deja de imprimirse como un renglón vacío y pasa a ser un párrafo.
  const bloques = bloquesDe('Primul paragraf.\ncu salt simplu\n\nAl doilea paragraf.');
  assert.deepEqual(bloques, [
    { tipo: 'parrafo', texto: 'Primul paragraf.\ncu salt simplu' },
    { tipo: 'parrafo', texto: 'Al doilea paragraf.' },
  ]);
});

test('un subtítulo a media línea parte el párrafo en dos', () => {
  const bloques = bloquesDe('Antes.\n## Zidirea casei\nDespués.');
  assert.deepEqual(bloques, [
    { tipo: 'parrafo', texto: 'Antes.' },
    { tipo: 'subtitulo', texto: 'Zidirea casei' },
    { tipo: 'parrafo', texto: 'Después.' },
  ]);
});

test('una cita en mitad de la frase se queda EN LÍNEA; sola en su línea sale a bloque', () => {
  // Sacar a bloque una cita que está entre comas dejaría el resto de la frase
  // huérfano en un párrafo que empieza por «, y asta…».
  const enMedio = bloquesDe('Textul spune că {{Ioan 3:16|Dumnezeu a iubit lumea}}, și asta schimbă tot.');
  assert.deepEqual(enMedio, [
    { tipo: 'parrafo', texto: 'Textul spune că {{Ioan 3:16|Dumnezeu a iubit lumea}}, și asta schimbă tot.' },
  ]);

  const sola = bloquesDe('{{Ioan 3:16|Dumnezeu a iubit lumea}}');
  assert.deepEqual(sola, [{ tipo: 'cita', label: 'Ioan 3:16', texto: 'Dumnezeu a iubit lumea' }]);
});

test('el punto que cierra la frase se queda pegado al versículo', () => {
  // «Domnul spune: {{…}}.» es como se escribe casi siempre. El punto suelto no
  // puede abrir un párrafo nuevo con un carácter dentro.
  const bloques = bloquesDe('Domnul spune: {{Ioan 3:16|Dumnezeu a iubit lumea}}.');
  assert.deepEqual(bloques, [
    { tipo: 'parrafo', texto: 'Domnul spune:' },
    { tipo: 'cita', label: 'Ioan 3:16', texto: 'Dumnezeu a iubit lumea.' },
  ]);
});

test('alternarSubtitulo pone y quita sobre la línea del cursor', () => {
  const texto = 'una\nTerminarea casei\ntres';
  const puesto = alternarSubtitulo(texto, 6, 6); // cursor dentro de la 2ª línea
  assert.equal(puesto.texto, 'una\n## Terminarea casei\ntres');
  assert.equal(puesto.texto.slice(puesto.desde, puesto.hasta), '## Terminarea casei');

  // El mismo botón quita, y el texto vuelve a estar exactamente como estaba.
  assert.equal(alternarSubtitulo(puesto.texto, 6, 6).texto, texto);
});

test('un subtítulo entra en la schiță CONSERVANDO el marcador de rótulo', () => {
  const c = emptyContent();
  const p = newPoint('Punct');
  c.structure.push(p);
  c.development[p.id] = { explain: '## Zidirea casei\nPrima frază.', illustrate: '', apply: '', refs: [] };

  const [clave, frase] = generateOutline(c).points[0].keywords;
  // En mayúsculas y CON su `##` desde el 2 nov 2026. Antes se convertía en una
  // marca entera (`*ZIDIREA CASEI*`) y entonces era indistinguible de una
  // frase marcada: quien la pintaba le ponía el guion de un elemento más de la
  // lista. Con el marcador, el que imprime sabe que es un rótulo y lo saca sin
  // guion, que es justo lo que pidió el propietario.
  assert.equal(clave, '## ZIDIREA CASEI');
  assert.equal(frase, 'Prima frază');
  // Y el marcador NO llega nunca al papel: lo quita quien lo pinta.
  assert.equal(quitarMarcas(clave), 'ZIDIREA CASEI');
});

test('un subtítulo con una marca dentro no imprime los asteriscos', () => {
  // Marcar una palabra y convertir después esa línea en subtítulo es un gesto
  // de lo más normal, y dejaba `ZIDIREA *CASEI*` en el papel y
  // `*ZIDIREA *CASEI**` —asteriscos impares— en la schiță, que en el púlpito
  // se traga en negrita el resto de la línea.
  assert.deepEqual(bloquesDe('## Zidirea *casei*'), [{ tipo: 'subtitulo', texto: 'Zidirea casei' }]);

  const c = emptyContent();
  const p = newPoint('Punct');
  c.structure.push(p);
  c.development[p.id] = { explain: '## Zidirea *casei*', illustrate: '', apply: '', refs: [] };
  assert.deepEqual(generateOutline(c).points[0].keywords, ['## ZIDIREA CASEI']);

  // Pero el botón de la interfaz NO le toca el marcado al predicador: lo que
  // quita es la almohadilla y nada más.
  assert.equal(subtituloDe('## Zidirea *casei*'), 'Zidirea *casei*');
});

test('una marca que envuelve una cita no deja las llaves a la vista', () => {
  // Se selecciona una frase entera que ya llevaba un versículo insertado y se
  // pulsa «Marchează». La cita tiene que seguir siendo una cita dentro de la
  // negrita, no un trozo de sintaxis.
  const seg = segmentarTexto('*Domnul spune {{Ioan 3:16|Dumnezeu a iubit}} si noi ascultam*');
  assert.ok(!seg.some((s) => s.texto.includes('{{') || s.texto.includes('|')), JSON.stringify(seg));
  assert.ok(seg.some((s) => s.texto === 'Ioan 3:16 ' && s.cita && s.bold));
  assert.ok(seg.some((s) => s.texto === 'Dumnezeu a iubit' && s.italica));
  assert.ok(seg.every((s) => s.bold || s.cita), 'todo lo demás va en negrita, que es lo que se marcó');
});

test('una marca que se traga el punto final no parte los asteriscos', () => {
  // Marcar una frase entera con el ratón se lleva el punto dentro. Partiendo
  // por puntos a ciegas quedaba `*Dumnezeu zidește casa` por un lado —marca
  // sin cerrar— y la frase siguiente por otro.
  const c = emptyContent();
  const p = newPoint('Punct');
  c.structure.push(p);
  c.development[p.id] = {
    explain: '*Dumnezeu zidește casa.* Omul doar ascultă.',
    illustrate: '', apply: '', refs: [],
  };

  const claves = generateOutline(c).points[0].keywords;
  assert.deepEqual(claves, ['*Dumnezeu zidește casa.*', 'Omul doar ascultă']);
  for (const k of claves) {
    assert.equal((k.match(/\*/g) || []).length % 2, 0, `asteriscos impares en «${k}»`);
  }
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
  // La regla cambió el 2 nov 2026: sin nada marcado entran ocho palabras —y la
  // frase entera si acaba en diez o menos, que es el caso de la primera—; con
  // algo marcado, hasta cinco palabras de arranque más lo marcado. Los puntos
  // suspensivos sólo si de verdad se ha quedado texto fuera, y en la segunda
  // frase no queda nada: cinco palabras y la marca es la frase completa.
  assert.deepEqual(o.points[0].keywords, [
    'Una primera frase larga que el corte automático cogería entera',
    'Pero lo que importa es *la roca*',
  ]);
});

test('la regla de ocho a diez palabras: diez van enteras, once se cortan', () => {
  const claves = (explain) => {
    const c = emptyContent();
    const p = newPoint('Punct');
    c.structure.push(p);
    c.development[p.id] = { explain, illustrate: '', apply: '', refs: [] };
    return generateOutline(c).points[0].keywords;
  };

  // Nueve palabras: entera y sin puntos suspensivos, que es lo que significa
  // «entre ocho y diez» — cortar a ocho una frase de nueve es tonto.
  assert.deepEqual(claves('Nouă cuvinte exacte are această frază de aici acum'), [
    'Nouă cuvinte exacte are această frază de aici acum',
  ]);
  // Once: se queda en ocho y avisa con los puntos suspensivos.
  assert.deepEqual(claves('Unsprezece cuvinte are această frază ca să se vadă cum se taie'), [
    'Unsprezece cuvinte are această frază ca să se…',
  ]);
});

test('entra CADA frase del campo, no las dos primeras', () => {
  // Antes el tope era dos frases de `explain` y una de `illustrate`/`apply`, y
  // el resto del desarrollo no llegaba al atril sin que nada lo avisara. El
  // propietario lo cambió el 2 nov 2026: entran todas.
  const c = emptyContent();
  const p = newPoint('Punct');
  c.structure.push(p);
  c.development[p.id] = {
    explain: 'Prima. A doua. A treia. A patra.',
    illustrate: 'Una. Doua.',
    apply: 'Hai. Acum.',
    refs: [],
  };

  assert.deepEqual(generateOutline(c).points[0].keywords, [
    'Prima', 'A doua', 'A treia', 'A patra', 'Una', 'Doua', 'Hai', 'Acum',
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
  // El arranque son las palabras de ANTES de la marca, nunca las de dentro: si
  // se contaran desde el principio de la frase, «cuatro cinco» saldría dos
  // veces, una en el arranque y otra en negrita.
  assert.deepEqual(o.points[0].keywords, ['Uno dos tres… *cuatro cinco seis siete*']);
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

test('citasDe deja la cita COMO CITA, con la referencia y el arranque del versículo', () => {
  // Mismo recorte que cualquier otra frase (8-10 palabras) desde el 2 nov
  // 2026: con cinco, el predicador no reconocía el versículo de un vistazo.
  // La coma de «lumea,» se va con el corte: «lumea,…» se lee como un borrón.
  //
  // Y sale con la sintaxis de cita, no como `*ref* texto`: es lo que hace que
  // la pinten con su barra vertical azul el Modo Amvon, el PDF de la schiță y
  // la pantalla, sin una rama por sitio.
  const t = 'Textul spune că {{Ioan 3:16|Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu}}.';
  assert.deepEqual(citasDe(t), ['{{Ioan 3:16|Fiindcă atât de mult a iubit Dumnezeu lumea…}}']);
});

test('citasDe no recorta un versículo ya corto', () => {
  assert.deepEqual(citasDe('{{Ioan 11:35|Isus a plâns}}'), ['{{Ioan 11:35|Isus a plâns}}']);
});

test('una cita sin texto no puede salir como cita, y cae a marca normal', () => {
  // `CITA` exige las DOS partes: `{{ref|}}` no empareja con nada y el renglón
  // se imprimiría con las llaves a la vista.
  assert.deepEqual(citasDe('{{Ioan 3:16|.}}'), ['*Ioan 3:16*']);
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
  // El punto final de la frase se queda pegado al versículo: la cita cierra la
  // línea, así que sale como bloque y ese punto no abre un párrafo nuevo con un
  // carácter dentro (ver `bloquesDe`).
  assert.ok(
    o.points[0].keywords.includes('{{Ioan 3:16|Fiindcă atât de mult a iubit Dumnezeu lumea.}}'),
    `la cita no llegó a la schiță: ${JSON.stringify(o.points[0].keywords)}`,
  );
});

test('una cita en la introducción o la conclusión también llega a la schiță', () => {
  const c = emptyContent();
  c.intro = 'Empezamos con {{Ioan 1:1|La început era Cuvântul}}.';
  c.conclusion = 'Terminamos con {{Apocalipsa 21:4|Dumnezeu va șterge orice lacrimă}}.';

  const o = generateOutline(c);
  assert.ok(o.intro.some((l) => l.startsWith('{{Ioan 1:1|')), JSON.stringify(o.intro));
  assert.ok(o.conclusion.includes('{{Apocalipsa 21:4|'), o.conclusion);
});

test('la cita llega a la schiță en el ORDEN en que está escrita', () => {
  // Antes `generateOutline` sacaba las frases de un campo y luego añadía sus
  // citas al final de la lista: desde el atril, el versículo aparecía después
  // de todo lo que venía detrás de él en el texto.
  const c = emptyContent();
  const p = newPoint('Punct');
  c.structure.push(p);
  c.development[p.id] = {
    explain: 'Prima frază.\n{{Ioan 3:16|Dumnezeu a iubit lumea}}\nUltima frază.',
    illustrate: '', apply: '', refs: [],
  };

  assert.deepEqual(generateOutline(c).points[0].keywords, [
    'Prima frază',
    '{{Ioan 3:16|Dumnezeu a iubit lumea}}',
    'Ultima frază',
  ]);
});

test('también la cita que se queda EN LÍNEA, en mitad de una frase', () => {
  // Ésta seguía saliendo al final: como su texto trae puntos propios, se
  // sacaba del párrafo ANTES de trocearlo en frases y se añadía después. El
  // versículo aparecía en la schiță detrás de la frase que en el texto va
  // después de él, y desde el atril eso se lee en el orden equivocado.
  const c = emptyContent();
  const p = newPoint('Punct');
  c.structure.push(p);
  c.development[p.id] = {
    explain: 'Prima frază. Textul spune că {{Ioan 3:16|Dumnezeu a iubit lumea}}, și asta schimbă tot. Ultima frază.',
    illustrate: '', apply: '', refs: [],
  };

  assert.deepEqual(generateOutline(c).points[0].keywords, [
    'Prima frază',
    'Textul spune că',
    '{{Ioan 3:16|Dumnezeu a iubit lumea}}',
    'și asta schimbă tot',
    'Ultima frază',
  ]);
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
  // Sin texto guardado no hay cita que formar, así que se quedan en una marca
  // a secas. Es el caso raro: el selector de referencias guarda el texto.
  assert.deepEqual(o.points[0].refs, ['*Iacov 1:22*', '*Ioan 14:15*']);
});

test('una referencia de apoyo lleva el arranque del versículo, con la misma regla', () => {
  // Hasta el 2 nov 2026 la schiță sólo decía «Ioan 3:16». En papel no se puede
  // tocar una referencia para abrirla, así que el predicador tenía delante un
  // código que no le decía qué dice el versículo.
  const c = emptyContent();
  const p = newPoint('Punct');
  c.structure.push(p);
  c.development[p.id] = {
    explain: '', illustrate: '', apply: '',
    refs: [
      { label: 'Luca 6:46', text: 'De ce-Mi ziceţi: Doamne, Doamne, şi nu faceţi ce spun Eu?' },
      { label: 'Ioan 11:35', text: 'Isus plângea' },
    ],
  };

  const [largo, corto] = generateOutline(c).points[0].refs;
  // Ocho palabras y puntos suspensivos cuando sobra texto…
  assert.equal(largo, '{{Luca 6:46|De ce-Mi ziceţi: Doamne, Doamne, şi nu faceţi…}}');
  // …y entero cuando cabe, sin puntos suspensivos que no significan nada.
  assert.equal(corto, '{{Ioan 11:35|Isus plângea}}');
});

test('el Modo Amvon puede sacar la etiqueta pelada de una referencia', () => {
  // El botón del púlpito abre el versículo buscándolo por su `label` en la
  // copia guardada en el dispositivo. Si le llega la línea con formato no
  // encuentra nada y el panel sale vacío delante de la congregación.
  assert.equal(etiquetaDeReferencia('{{Luca 6:46|De ce-Mi ziceţi: Doamne…}}'), 'Luca 6:46');
  assert.equal(etiquetaDeReferencia('*Matei 7:21*'), 'Matei 7:21');
  assert.equal(etiquetaDeReferencia(''), '');
});

test('una referencia repetida no sale dos veces en la schiță', () => {
  const c = emptyContent();
  const p = newPoint('Punct');
  p.refs = [{ book: 58, chapter: 1, verse: 22, label: 'Iacov 1:22', text: 'Fiţi împlinitori ai Cuvântului' }];
  c.structure.push(p);
  c.development[p.id] = {
    explain: '', illustrate: '', apply: '',
    // La misma referencia con OTRO texto: se repite por etiqueta, no por
    // línea, o la deduplicación dejaría de funcionar en cuanto el texto
    // difiera en un carácter.
    refs: [{ book: 58, chapter: 1, verse: 22, label: 'Iacov 1:22', text: 'Otro texto cualquiera' }],
  };

  assert.deepEqual(generateOutline(c).points[0].refs, ['{{Iacov 1:22|Fiţi împlinitori ai Cuvântului}}']);
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
