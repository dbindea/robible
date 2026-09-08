// Maquetación del texto de la imagen compartible.
//
// Se prueba solo la parte que no toca el canvas: partir en líneas y elegir el
// cuerpo de letra. El dibujo en sí necesita un navegador, pero es justo la
// parte que se ve a simple vista; lo que se rompe en silencio es esto — un
// versículo largo que se sale de la imagen o una línea que desborda el ancho.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IMAGE_BACKGROUNDS,
  IMAGE_FORMATS,
  buildFileName,
  fitTextBlock,
  getBackground,
  getFormat,
  wrapTextLines,
} from '../src/services/verse-image.service.js';

// Medidor falso: cada carácter mide `ancho` px. Suficiente para comprobar la
// lógica de corte sin depender de una fuente real.
const medidorFalso = (ancho) => (str) => str.length * ancho;

test('wrapTextLines respeta el ancho máximo', () => {
  const lineas = wrapTextLines('uno dos tres cuatro cinco', 100, medidorFalso(10));
  for (const linea of lineas) {
    assert.ok(linea.length * 10 <= 100, `línea demasiado ancha: "${linea}"`);
  }
});

test('wrapTextLines no pierde ni duplica palabras', () => {
  const texto = 'Fiindcă atât de mult a iubit Dumnezeu lumea încât a dat pe singurul Lui Fiu';
  const lineas = wrapTextLines(texto, 120, medidorFalso(9));
  assert.equal(lineas.join(' '), texto);
});

test('wrapTextLines colapsa espacios repetidos y saltos de línea', () => {
  const lineas = wrapTextLines('  uno   dos \n tres  ', 1000, medidorFalso(1));
  assert.deepEqual(lineas, ['uno dos tres']);
});

test('wrapTextLines devuelve lista vacía si no hay texto', () => {
  assert.deepEqual(wrapTextLines('', 100, medidorFalso(10)), []);
  assert.deepEqual(wrapTextLines('   ', 100, medidorFalso(10)), []);
  assert.deepEqual(wrapTextLines(null, 100, medidorFalso(10)), []);
});

test('una palabra más ancha que la caja se queda sola en su línea', () => {
  // Partirla por la mitad se lee peor que dejar que sobresalga.
  const lineas = wrapTextLines('a supercalifragilistico b', 50, medidorFalso(10));
  assert.ok(lineas.includes('supercalifragilistico'));
});

test('fitTextBlock elige el cuerpo más grande que quepa', () => {
  const { fontSize, lines, truncated } = fitTextBlock({
    text: 'uno dos tres cuatro',
    maxWidth: 400,
    maxHeight: 400,
    maxFontSize: 80,
    minFontSize: 20,
    measureAt: (size) => medidorFalso(size / 2),
  });
  assert.equal(truncated, false);
  assert.ok(fontSize <= 80 && fontSize >= 20);
  assert.ok(lines.length >= 1);
});

test('fitTextBlock nunca devuelve un bloque más alto que la caja', () => {
  const maxHeight = 300;
  const lineHeightRatio = 1.36;
  const { fontSize, lines } = fitTextBlock({
    text: Array.from({ length: 60 }, (_, i) => `palabra${i}`).join(' '),
    maxWidth: 400,
    maxHeight,
    maxFontSize: 80,
    minFontSize: 20,
    lineHeightRatio,
    measureAt: (size) => medidorFalso(size / 2),
  });
  assert.ok(
    lines.length * fontSize * lineHeightRatio <= maxHeight,
    `el bloque se sale: ${lines.length} líneas de ${fontSize}px`,
  );
});

test('un texto imposible se recorta con puntos suspensivos', () => {
  const { lines, truncated } = fitTextBlock({
    text: Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(' '),
    maxWidth: 200,
    maxHeight: 120,
    maxFontSize: 60,
    minFontSize: 30,
    measureAt: (size) => medidorFalso(size / 2),
  });
  assert.equal(truncated, true);
  assert.ok(lines.at(-1).endsWith('…'), 'la última línea debería cerrar con puntos suspensivos');
});

test('el texto recortado deja al menos una línea', () => {
  const { lines } = fitTextBlock({
    text: 'uno dos tres cuatro cinco seis siete ocho',
    maxWidth: 100,
    maxHeight: 1, // no cabe ni una línea
    maxFontSize: 40,
    minFontSize: 30,
    measureAt: (size) => medidorFalso(size / 2),
  });
  assert.ok(lines.length >= 1);
});

test('getFormat y getBackground caen al primero si la clave no existe', () => {
  assert.equal(getFormat('story').key, 'story');
  assert.equal(getFormat('no-existe').key, IMAGE_FORMATS[0].key);
  assert.equal(getBackground('ocean').key, 'ocean');
  assert.equal(getBackground('no-existe').key, IMAGE_BACKGROUNDS[0].key);
});

test('todos los fondos declaran los campos que usa el dibujo', () => {
  for (const bg of IMAGE_BACKGROUNDS) {
    assert.ok(Array.isArray(bg.stops) && bg.stops.length >= 2, `${bg.key}: faltan stops`);
    assert.match(bg.ink, /^#|^rgb/, `${bg.key}: ink inválido`);
    assert.ok(bg.glow, `${bg.key}: falta glow`);
    assert.ok(bg.accent, `${bg.key}: falta accent`);
  }
});

test('los formatos declarados son verticales o cuadrados', () => {
  for (const f of IMAGE_FORMATS) {
    assert.ok(f.width > 0 && f.height > 0);
    assert.ok(f.height >= f.width, `${f.key}: un formato apaisado no sirve para un estado`);
  }
});

test('buildFileName produce un nombre de archivo seguro', () => {
  assert.equal(buildFileName('Ioan 3:16'), 'robible-ioan-3-16.png');
  assert.equal(buildFileName('Cântarea cântărilor 8:7'), 'robible-cantarea-cantarilor-8-7.png');
  assert.equal(buildFileName('1 Corinteni 13:4'), 'robible-1-corinteni-13-4.png');
  assert.equal(buildFileName(''), 'robible-versiculo.png');
  // Nombres en alfabetos no latinos: no queda nada tras el filtro, pero el
  // fichero tiene que seguir teniendo nombre.
  assert.equal(buildFileName('約翰福音 3:16'), 'robible-3-16.png');
});

// ── Chino: el corte de línea no depende de los espacios ─────────────────────
//
// El chino no usa espacios, así que `split(/\s+/)` devolvía el versículo entero
// como una sola «palabra» y por tanto como una sola línea: en la imagen se veía
// una tira de texto con el principio y el final fuera del lienzo. El corte se
// hace ahora entre ideogramas, que es como se compone el chino de verdad.

/** Juan 3:16 en chino (Biblia china de unión). */
const JUAN_316_ZH =
  '神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不至灭亡，反得永生。';

test('un versículo en chino se parte en varias líneas', () => {
  // 10 px por carácter, caja de 100 px → 10 caracteres por línea.
  const lineas = wrapTextLines(JUAN_316_ZH, 100, medidorFalso(10));

  assert.ok(lineas.length > 1, `esperaba varias líneas, hubo ${lineas.length}`);
  for (const linea of lineas) {
    assert.ok(linea.length <= 11, `línea demasiado ancha: "${linea}" (${linea.length})`);
  }
});

test('el chino no pierde ni añade caracteres al partirse', () => {
  const lineas = wrapTextLines(JUAN_316_ZH, 100, medidorFalso(10));
  // Sin espacios entre ideogramas: al unir hay que recuperar el original.
  assert.equal(lineas.join(''), JUAN_316_ZH);
});

test('la puntuación china no se queda huérfana al principio de línea', () => {
  const lineas = wrapTextLines(JUAN_316_ZH, 100, medidorFalso(10));
  for (const linea of lineas) {
    assert.ok(
      !'、。，．：；！？）」』'.includes(linea[0]),
      `una línea empieza por puntuación de cierre: "${linea}"`,
    );
  }
});

test('mezcla de chino y latín: los espacios latinos se conservan', () => {
  const lineas = wrapTextLines('Ioan 3:16 神爱世人', 1000, medidorFalso(1));
  assert.deepEqual(lineas, ['Ioan 3:16 神爱世人']);
});

test('el texto latino se sigue partiendo exactamente igual que antes', () => {
  // Misma expectativa que el test de arriba: la reescritura para chino no
  // podía cambiar el comportamiento de las cuatro lenguas latinas.
  const lineas = wrapTextLines('uno dos tres cuatro cinco', 100, medidorFalso(10));
  for (const linea of lineas) {
    assert.ok(linea.length * 10 <= 100, `línea demasiado ancha: "${linea}"`);
  }
  assert.equal(lineas.join(' '), 'uno dos tres cuatro cinco');
});

test('fitTextBlock reduce el cuerpo hasta que el chino cabe', () => {
  const r = fitTextBlock({
    text: JUAN_316_ZH,
    maxWidth: 400,
    maxHeight: 300,
    maxFontSize: 60,
    minFontSize: 20,
    measureAt: (fs) => (s) => s.length * fs,
  });
  assert.ok(r.lines.length > 1, 'el chino tiene que ocupar varias líneas');
  assert.ok(r.fontSize <= 60 && r.fontSize >= 20);
  assert.ok(
    r.lines.length * r.fontSize * 1.36 <= 300 || r.truncated,
    'o cabe en la caja o viene marcado como recortado',
  );
});
