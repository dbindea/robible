// Los versículos que sí se indexan uno a uno.
//
// Riesgo que cubre: una referencia mal escrita aquí no rompe nada visible —
// produce una URL que va al sitemap, recibe su `Allow` en robots.txt y devuelve
// una página sin texto. El único síntoma es un aviso en Search Console semanas
// después. Por eso se validan contra el texto real de las cuatro Biblias.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  GOLDEN_VERSES,
  MAXIMO_INDEXABLES,
  combinarIndexables,
  crearIndice,
  esIndexable,
} from '../src/config/golden-verses.js';

const DATA_DIR = fileURLToPath(new URL('../public/data/', import.meta.url));

// La de referencia para validar. No se cargan las cuatro: son 4 MB cada una y
// basta con una para saber si una referencia existe — las diferencias de
// numeración entre versiones ya las filtra el generador, que comprueba el texto
// versión por versión antes de escribir nada.
const bible = JSON.parse(readFileSync(join(DATA_DIR, 'vdc', 'bible.json'), 'utf8'));

test('todas las referencias existen en la Biblia', () => {
  const rotas = [];
  for (const ref of GOLDEN_VERSES) {
    const texto = bible?.[ref.book]?.[ref.chapter - 1]?.[ref.verse - 1];
    if (!texto || !String(texto).trim()) {
      rotas.push(`${ref.book}/${ref.chapter}/${ref.verse}`);
    }
  }
  assert.deepEqual(rotas, [], `referencias que no existen (libro/capítulo/versículo): ${rotas.join(', ')}`);
});

test('los índices de libro están dentro de rango', () => {
  for (const ref of GOLDEN_VERSES) {
    assert.ok(
      Number.isInteger(ref.book) && ref.book >= 0 && ref.book <= 65,
      `libro fuera de rango: ${JSON.stringify(ref)}`,
    );
    assert.ok(Number.isInteger(ref.chapter) && ref.chapter >= 1, `capítulo inválido: ${JSON.stringify(ref)}`);
    assert.ok(Number.isInteger(ref.verse) && ref.verse >= 1, `versículo inválido: ${JSON.stringify(ref)}`);
  }
});

test('no hay referencias repetidas', () => {
  const vistas = new Set();
  const repes = [];
  for (const ref of GOLDEN_VERSES) {
    const k = `${ref.book}-${ref.chapter}-${ref.verse}`;
    if (vistas.has(k)) repes.push(k);
    vistas.add(k);
  }
  assert.deepEqual(repes, [], `duplicadas: ${repes.join(', ')}`);
});

test('la lista no se desborda', () => {
  // Cada referencia son doce líneas de `Allow` en el robots.txt generado
  // (cuatro versiones × tres grupos de user-agent). Si esto crece sin freno, el
  // fichero se hace impracticable y la lista blanca deja de ser una selección.
  assert.ok(
    GOLDEN_VERSES.length <= MAXIMO_INDEXABLES,
    `${GOLDEN_VERSES.length} referencias, el tope es ${MAXIMO_INDEXABLES}`,
  );
});

test('predomina el Nuevo Testamento, que es donde está la búsqueda', () => {
  // Criterio de producto, no capricho: la lista se pidió «sobre todo del Nuevo
  // Testamento». Si alguien la llena de genealogías del Antiguo, esto avisa.
  const nuevo = GOLDEN_VERSES.filter((r) => r.book >= 39).length;
  assert.ok(
    nuevo > GOLDEN_VERSES.length / 2,
    `sólo ${nuevo} de ${GOLDEN_VERSES.length} son del Nuevo Testamento`,
  );
});

// ── Combinación con los del versículo del día ───────────────────────────────

test('combinarIndexables une, quita repetidos y ordena', () => {
  const diarios = JSON.parse(readFileSync(join(DATA_DIR, 'daily-verses.json'), 'utf8')).verses;
  const combinada = combinarIndexables(diarios);

  assert.ok(combinada.length >= GOLDEN_VERSES.length, 'la combinación no puede perder referencias');
  assert.ok(combinada.length <= GOLDEN_VERSES.length + diarios.length, 'no puede inventar referencias');

  const claves = combinada.map((r) => `${r.book}-${r.chapter}-${r.verse}`);
  assert.equal(new Set(claves).size, claves.length, 'no debe haber repetidas');

  // Orden canónico: es lo que hace que el robots.txt y el sitemap generados no
  // cambien de un build a otro sin motivo.
  const ordenada = [...combinada].sort((a, b) => a.book - b.book || a.chapter - b.chapter || a.verse - b.verse);
  assert.deepEqual(combinada, ordenada);
});

test('combinarIndexables aguanta entrada corrupta', () => {
  const sucio = [null, undefined, {}, { book: '1', chapter: 1, verse: 1 }, { book: 42, chapter: 3, verse: 16 }];
  const combinada = combinarIndexables(sucio);
  // Lo válido entra; lo demás se ignora sin reventar el build.
  assert.ok(combinada.some((r) => r.book === 42 && r.chapter === 3 && r.verse === 16));
  assert.ok(combinada.every((r) => Number.isInteger(r.book)));
});

test('esIndexable distingue los de la lista de los demás', () => {
  const indice = crearIndice(combinarIndexables([]));
  assert.equal(esIndexable(indice, 42, 3, 16), true, 'Ioan 3:16 debe indexarse');
  assert.equal(esIndexable(indice, 0, 1, 1), true, 'Geneza 1:1 debe indexarse');
  assert.equal(esIndexable(indice, 3, 7, 41), false, 'un versículo cualquiera no');
});

// ── El fichero generado ─────────────────────────────────────────────────────
// Sólo si hay build: en un árbol recién clonado `dist/` no existe y este test
// no tendría nada que mirar.

test('el robots.txt generado abre los de oro y cierra el resto', { skip: !existsSync(fileURLToPath(new URL('../dist/robots.txt', import.meta.url))) }, () => {
  const generado = readFileSync(fileURLToPath(new URL('../dist/robots.txt', import.meta.url)), 'utf8');

  assert.ok(!generado.includes('{{VERSICULOS_INDEXABLES}}'), 'el marcador debe haberse sustituido');
  assert.match(generado, /^Allow: \/biblia\/vdc\/ioan\/3\/16$/m, 'Ioan 3:16 debe llevar su Allow');
  assert.ok(!/^Allow: \/biblia\/vdc\/numeri\/7\/41$/m.test(generado), 'un versículo cualquiera NO lleva Allow');

  // Uno por grupo de user-agent: `*`, Googlebot y Bingbot. Con menos, el bot al
  // que le falte su bloque no verá ni uno.
  const conteo = (generado.match(/^Allow: \/biblia\/vdc\/ioan\/3\/16$/gm) || []).length;
  assert.equal(conteo, 3, 'cada Allow tiene que aparecer en los tres grupos');

  // Google se lee el fichero entero y corta a 500 KB.
  assert.ok(generado.length < 500_000, `robots.txt de ${generado.length} bytes, el límite de Google son 500 KB`);
});
