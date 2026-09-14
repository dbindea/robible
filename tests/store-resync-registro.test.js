// Todo store que lea del servidor tiene que apuntarse a la resincronización.
//
// Este test existe por una ausencia, y las ausencias no las caza ningún test de
// comportamiento: `authStore` era el único store con datos del servidor que NO
// llamaba a `registrarSincronizacion`. Resultado, `currentUser` se hidrataba una
// vez de localStorage y no se volvía a preguntar nunca — `verifySession` existía
// en `auth.service.js` y no la invocaba nadie. Con dos dispositivos, el lema, el
// nombre o el tipo de cuenta cambiados en uno no aparecían en el otro hasta
// cerrar sesión y volver a entrar, mientras que las notas y los favoritos sí se
// ponían al día. No falla nada, no hay error en consola: simplemente ves datos
// viejos y no tienes forma de saber por qué.
//
// Se mira el código fuente y no el comportamiento a propósito: `USE_BACKEND`
// sale de `import.meta.env`, que fuera de Vite es undefined, así que en Node
// ningún servicio llega a pedir nada. Mismo enfoque que `i18n-keys.test.js`,
// que recorre `src/` buscando claves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const DIR_STORES = fileURLToPath(new URL('../src/store/', import.meta.url));

// Lo que delata que un store tiene datos que viven en el servidor.
const TRAE_DEL_SERVIDOR = /syncFromServer|verifySession/;

const ficheros = readdirSync(DIR_STORES).filter((f) => f.endsWith('.js'));

test('hay stores que leer (el test no se ha quedado sin nada que mirar)', () => {
  assert.ok(ficheros.length >= 8, `sólo se han encontrado ${ficheros.length} stores`);
});

test('todo store que lee del servidor se registra en la resincronización', () => {
  const olvidados = [];
  const registrados = [];

  for (const fichero of ficheros) {
    const codigo = readFileSync(join(DIR_STORES, fichero), 'utf8');
    if (!TRAE_DEL_SERVIDOR.test(codigo)) continue; // puramente local, no aplica
    if (codigo.includes('registrarSincronizacion(')) registrados.push(fichero);
    else olvidados.push(fichero);
  }

  assert.deepEqual(
    olvidados,
    [],
    `estos stores leen del servidor y no se resincronizan, así que enseñarán datos viejos `
    + `en el segundo dispositivo sin dar ningún síntoma: ${olvidados.join(', ')}`,
  );

  // Los siete de datos más el perfil. Si este número baja, alguien ha quitado
  // un registro y lo ha roto sin enterarse.
  assert.ok(
    registrados.length >= 8,
    `sólo ${registrados.length} stores registrados (${registrados.join(', ')}); deberían ser 8 o más`,
  );
});

test('el perfil del usuario está entre ellos', () => {
  // Nombrado aparte porque es el que faltaba y el que se nota menos: los datos
  // del perfil se miran poco, así que un desfase puede durar meses.
  const codigo = readFileSync(join(DIR_STORES, 'authStore.js'), 'utf8');
  assert.match(
    codigo,
    /registrarSincronizacion\(\s*['"]perfil['"]/,
    'authStore debe registrar la sincronización del perfil, o el lema y los datos '
    + 'de la cuenta se quedan congelados en cada dispositivo hasta el siguiente login',
  );
});
