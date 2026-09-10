// Volver a leer del servidor al regresar a la aplicación.
//
// Lo que importa cubrir no es que sincronice —eso se ve— sino las tres cosas
// que fallan en silencio: que NO dispare siete peticiones cada vez que se
// cambia de ventana, que un módulo caído no arrastre a los demás, y que sin
// sesión no pida nada.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// El servicio importa `tokenStore` de apiClient, que toca `localStorage`. Se
// dobla con el mínimo imprescindible, como hace `filter.test.js`.
const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
  clear: () => almacen.clear(),
  key: (i) => [...almacen.keys()][i] ?? null,
  get length() { return almacen.size; },
};
// `iniciarResincronizacion` se salta si no hay `document`; aquí no se llama,
// pero el módulo se importa entero.
globalThis.window = globalThis.window || { addEventListener() {} };

const { registrarSincronizacion, sincronizarTodo } = await import('../src/services/resync.service.js');
const { tokenStore } = await import('../src/services/apiClient.js');

// Un módulo de mentira que cuenta cuántas veces le piden datos.
const hacerModulo = (nombre, { falla = false } = {}) => {
  const m = {
    nombre,
    syncs: 0,
    refrescos: 0,
    sync: async () => {
      m.syncs += 1;
      if (falla) throw new Error('caído');
    },
    refresh: () => { m.refrescos += 1; },
  };
  return m;
};

const bueno = hacerModulo('bueno');
const roto = hacerModulo('roto', { falla: true });
registrarSincronizacion(bueno.nombre, bueno.sync, bueno.refresh);
registrarSincronizacion(roto.nombre, roto.sync, roto.refresh);

beforeEach(() => {
  bueno.syncs = 0; bueno.refrescos = 0;
  roto.syncs = 0; roto.refrescos = 0;
});

test('sin sesión no pide nada al servidor', async () => {
  tokenStore.clear?.();
  almacen.clear();
  await sincronizarTodo({ forzar: true });
  assert.equal(bueno.syncs, 0, 'ha llamado al servidor sin token');
});

test('con sesión sincroniza todos los módulos registrados', async () => {
  almacen.set('robible:auth:token', 'un-token-cualquiera');
  await sincronizarTodo({ forzar: true });
  assert.equal(bueno.syncs, 1);
  assert.equal(roto.syncs, 1);
});

test('un módulo caído no impide que los demás se refresquen', async () => {
  almacen.set('robible:auth:token', 'un-token-cualquiera');
  await sincronizarTodo({ forzar: true });
  // El que falla revienta en su `sync`, pero el refresco de TODOS se hace igual:
  // si no, un módulo con el backend a medias congelaría la pantalla entera.
  assert.equal(bueno.refrescos, 1, 'el módulo sano no se ha refrescado');
});

test('no repite si se acaba de sincronizar', async () => {
  almacen.set('robible:auth:token', 'un-token-cualquiera');
  await sincronizarTodo({ forzar: true });
  const trasLaPrimera = bueno.syncs;

  // Alternar entre dos ventanas dispara `focus` una y otra vez. Sin la ventana
  // de treinta segundos, cada cambio serían siete peticiones al worker.
  await sincronizarTodo();
  await sincronizarTodo();
  await sincronizarTodo();

  assert.equal(bueno.syncs, trasLaPrimera, 'está sincronizando en cada foco');
});

test('`forzar` se salta la ventana: es para cuando vuelve la conexión', async () => {
  almacen.set('robible:auth:token', 'un-token-cualquiera');
  await sincronizarTodo({ forzar: true });
  await sincronizarTodo({ forzar: true });
  assert.equal(bueno.syncs, 2);
});
