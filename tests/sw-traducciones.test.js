// Las traducciones del service worker van con la RED primero.
//
// Antes iban con stale-while-revalidate, y eso no fallaba de vez en cuando:
// garantizaba que la PRIMERA carga después de cada despliegue sirviera el
// fichero del día anterior. Quien añadía una clave y subía la veía en crudo en
// pantalla (`app.scroll.seo_title`) hasta recargar. Reproducido en producción
// el 21 sep 2026.
//
// Volver a SWR sería un cambio de una línea y el síntoma tardaría un
// despliegue en aparecer, así que aquí se ejecuta la función de verdad —
// extraída del propio public/sw.js — contra una red rápida, una caída y una
// lenta. Ver la trampa 3 de CLAUDE.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..');
const RUTA_SW = path.join(RAIZ, 'public', 'sw.js');
const sw = readFileSync(RUTA_SW, 'utf8');

const PETICION = { url: 'https://robible.com/lang/ro.json' };
const claveDe = (peticion) => (typeof peticion === 'string' ? peticion : peticion.url);

// El service worker no exporta nada: es un script clásico con todo en un solo
// ámbito. Se envuelve entero en una función que devuelve lo que hace falta y se
// le inyectan los globales del navegador que no existen en Node.
const cargarSW = ({ caches: cachesFalso, fetch: fetchFalso }) => {
  const cuerpo = `${sw}\nreturn { traduccionesDeRed, TOPE_TRADUCCIONES, CACHE_NAME };`;
  const crear = new Function('self', 'caches', 'fetch', cuerpo);

  return crear(
    { addEventListener() {}, clients: {}, location: { origin: 'https://robible.com' } },
    cachesFalso,
    fetchFalso,
  );
};

const crearCaches = (guardado) => {
  const almacen = new Map(guardado ? [[claveDe(PETICION), guardado]] : []);
  const cache = {
    put: async (peticion, respuesta) => {
      almacen.set(claveDe(peticion), respuesta);
    },
  };

  return {
    almacen,
    api: {
      open: async () => cache,
      match: async (peticion) => almacen.get(claveDe(peticion)),
    },
  };
};

const respuesta = (texto) => new Response(texto, { status: 200, headers: { 'Content-Type': 'application/json' } });
const guardadoDe = async (almacen) => almacen.get(claveDe(PETICION)).clone().text();

const crearEvento = () => {
  const pendientes = [];
  return { evento: { waitUntil: (p) => pendientes.push(p) }, pendientes };
};

test('con red, sirve el fichero del servidor y no la copia guardada', async () => {
  const { almacen, api } = crearCaches(respuesta('{"viejo":1}'));
  const { traduccionesDeRed } = cargarSW({ caches: api, fetch: async () => respuesta('{"nuevo":1}') });
  const { evento } = crearEvento();

  const servida = await traduccionesDeRed(evento, PETICION);

  assert.equal(await servida.text(), '{"nuevo":1}', 'se sirvió la copia vieja: ha vuelto el parpadeo');
  assert.equal(await guardadoDe(almacen), '{"nuevo":1}', 'la cache no se actualizó');
});

test('sin red, sirve la copia guardada', async () => {
  const { api } = crearCaches(respuesta('{"viejo":1}'));
  const { traduccionesDeRed } = cargarSW({
    caches: api,
    fetch: async () => {
      throw new Error('sin conexión');
    },
  });
  const { evento } = crearEvento();

  const servida = await traduccionesDeRed(evento, PETICION);

  assert.equal(await servida.text(), '{"viejo":1}', 'sin conexión hay que seguir teniendo interfaz traducida');
});

// El tope es lo que impide que este cambio empeore las conexiones malas: si la
// red tarda más de la cuenta se sirve lo guardado, que es justo lo que hacía el
// stale-while-revalidate. La actualización sigue viva y entra para la próxima.
test('con red lenta sirve lo guardado dentro del tope, y la actualización llega igual', async () => {
  const { almacen, api } = crearCaches(respuesta('{"viejo":1}'));
  const { traduccionesDeRed, TOPE_TRADUCCIONES } = cargarSW({
    caches: api,
    fetch: () => new Promise((resolve) => setTimeout(() => resolve(respuesta('{"nuevo":1}')), TOPE_TRADUCCIONES + 150)),
  });
  const { evento, pendientes } = crearEvento();

  const arranque = Date.now();
  const servida = await traduccionesDeRed(evento, PETICION);
  const tardanza = Date.now() - arranque;

  assert.equal(await servida.text(), '{"viejo":1}');
  assert.ok(tardanza < TOPE_TRADUCCIONES + 100, `esperó ${tardanza} ms, el tope son ${TOPE_TRADUCCIONES}`);

  assert.equal(pendientes.length, 1, 'sin waitUntil el navegador puede matar al SW antes de guardar');
  await Promise.all(pendientes);
  assert.equal(await guardadoDe(almacen), '{"nuevo":1}', 'la descarga tardía tenía que dejar la cache al día');
});

test('la primera visita, sin nada guardado, espera a la red', async () => {
  const { api } = crearCaches(null);
  const { traduccionesDeRed } = cargarSW({
    caches: api,
    fetch: () => new Promise((resolve) => setTimeout(() => resolve(respuesta('{"nuevo":1}')), 60)),
  });
  const { evento } = crearEvento();

  const servida = await traduccionesDeRed(evento, PETICION);

  assert.equal(await servida.text(), '{"nuevo":1}');
});

test('/lang/ sigue enrutado a traduccionesDeRed en el manejador de fetch', () => {
  assert.match(sw, /startsWith\('\/lang\/'\)[^}]*traduccionesDeRed/, 'la ruta de /lang/ ya no usa traduccionesDeRed');
  assert.ok(!sw.includes('staleWhileRevalidate'), 'ha vuelto el stale-while-revalidate de las traducciones');
});
