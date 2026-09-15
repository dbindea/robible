// La política de permisos del sitio.
//
// Existe por un fallo que costó dos rondas de depuración: `netlify.toml`
// mandaba `Permissions-Policy: microphone=()`, y una lista vacía **no** quiere
// decir «restringido», quiere decir *ningún origen, ni siquiera el propio*. Con
// eso, el dictado por voz no es que fallara al pedir permiso: el navegador ni
// llegaba a preguntar. `getUserMedia` devolvía `NotAllowedError` en el acto y
// `SpeechRecognition` quedaba muerto.
//
// Lo peor era el síntoma: **en desarrollo funcionaba**. Vite no manda esa
// cabecera, así que sólo se rompía en producción, y allí parecía un problema
// del navegador o del permiso del sistema.
//
// Por eso se prueba el fichero de configuración y no el comportamiento: esto no
// se puede cazar en local de ninguna otra forma.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');

/** La línea de la política, sin el comentario ni las comillas. */
const politica = () => {
  const linea = toml
    .split(/\r?\n/)
    .find((l) => /^\s*Permissions-Policy\s*=/.test(l));
  assert.ok(linea, 'netlify.toml tiene que declarar Permissions-Policy');
  return linea.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
};

test('el micrófono está permitido para el propio sitio', () => {
  const p = politica();
  assert.match(
    p,
    /microphone=\(\s*self\s*\)/,
    'con `microphone=()` el navegador no pide permiso: lo deniega en el acto, y el dictado por voz '
    + 'queda muerto en producción aunque en desarrollo funcione',
  );
});

test('cámara y ubicación siguen cerradas', () => {
  // No se usan. Una política abierta para algo que no existe sólo amplía la
  // superficie sin que nadie lo note.
  const p = politica();
  assert.match(p, /camera=\(\)/, 'la cámara no se usa: debe seguir cerrada');
  assert.match(p, /geolocation=\(\)/, 'la ubicación no se usa: debe seguir cerrada');
});

test('la CSP deja hablar con el worker', () => {
  // No es de permisos, pero es el otro sitio donde una cabecera de seguridad
  // puede dejar la aplicación muda sin dar un error legible.
  const csp = toml.split(/\r?\n/).find((l) => /Content-Security-Policy\s*=/.test(l)) || '';
  assert.match(csp, /connect-src[^;"]*robible-api\.robible\.workers\.dev/, 'sin esto no hay backend');
});
