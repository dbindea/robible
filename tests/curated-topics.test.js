// Vigila el JSON que se publica, no el generador que lo escribe.
//
// La distinción importa: `build-curated-topics.mjs` valida mucho, pero sólo se
// ejecuta cuando alguien lo lanza a mano. El fichero de `public/data/` está en
// el repositorio y se puede editar directamente — es justo lo que uno hace para
// «cambiar una coma» sin volver a generar. Estas comprobaciones son las que
// sobreviven a eso.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { TOPIC_ICONS } from '../src/config/topic-icons.js';

const RAIZ = path.join(import.meta.dirname, '..');
const datos = JSON.parse(readFileSync(path.join(RAIZ, 'public', 'data', 'curated-topics.json'), 'utf8'));
const IDIOMAS = ['ro', 'es', 'en', 'zh'];

test('el fichero tiene colecciones', () => {
  assert.ok(Array.isArray(datos.topics), 'topics debe ser un array');
  assert.ok(datos.topics.length > 0, 'no hay ninguna colección');
});

test('cada colección tiene nombre y presentación en los cuatro idiomas', () => {
  for (const tema of datos.topics) {
    for (const idioma of IDIOMAS) {
      assert.ok(tema.names?.[idioma]?.trim(), `${tema.slug}: falta names.${idioma}`);
      assert.ok(tema.intros?.[idioma]?.trim(), `${tema.slug}: falta intros.${idioma}`);
    }
  }
});

test('los slugs son únicos y válidos en una URL', () => {
  const vistos = new Set();

  for (const tema of datos.topics) {
    assert.ok(!vistos.has(tema.slug), `slug repetido: ${tema.slug}`);
    vistos.add(tema.slug);
    // Sin mayúsculas ni caracteres que haya que escapar: la URL se comparte a
    // mano y se escribe en el sitemap sin codificar.
    assert.match(tema.slug, /^[a-z0-9-]+$/, `slug no apto para URL: ${tema.slug}`);
  }
});

test('los iconos existen en el catálogo', () => {
  // `resolveTopicIcon` cambia una clave desconocida por el marcador sin avisar,
  // así que un icono mal escrito sólo se ve mirando la página.
  const claves = new Set(TOPIC_ICONS.map((i) => i.key));

  for (const tema of datos.topics) {
    assert.ok(claves.has(tema.icon), `${tema.slug}: icono desconocido '${tema.icon}'`);
  }
});

test('cada colección tiene versículos con coordenadas enteras', () => {
  for (const tema of datos.topics) {
    assert.ok(tema.verses?.length > 0, `${tema.slug}: sin versículos`);

    for (const v of tema.verses) {
      assert.ok(Number.isInteger(v.book) && v.book >= 0 && v.book < 66, `${tema.slug}: libro fuera de rango`);
      assert.ok(Number.isInteger(v.chapter) && v.chapter > 0, `${tema.slug}: capítulo inválido`);
      assert.ok(Number.isInteger(v.verse) && v.verse > 0, `${tema.slug}: versículo inválido`);
    }
  }
});

test('los cuatro slugs heredados siguen existiendo', () => {
  // Estas URLs estaban indexadas antes de que hubiera colecciones curadas: se
  // servían como páginas estáticas desde generate-seo.mjs. Si alguien renombra
  // uno de estos slugs, se pierde el posicionamiento que ya tenían.
  const slugs = new Set(datos.topics.map((t) => t.slug));

  for (const heredado of ['dragoste', 'speranta', 'credinta', 'casatorie']) {
    assert.ok(slugs.has(heredado), `falta el slug heredado /versete/${heredado}`);
  }
});
