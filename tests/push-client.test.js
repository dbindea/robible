// Parte pura del cliente de push: hora elegida y conversión a UTC.
//
// El resto (permiso, PushManager, service worker) no existe fuera del navegador
// y probarlo aquí sería probar un doble.

import test from 'node:test';
import assert from 'node:assert/strict';

// `push.service.js` lee localStorage al arrancar. Se dobla con el mínimo, igual
// que en filter.test.js.
const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
};
globalThis.window = globalThis;

const { horaElegida, guardarHora, horaUtcDe, HORA_POR_DEFECTO } = await import('../src/services/push.service.js');

test('sin hora guardada se usa la de por defecto, no medianoche', () => {
  // `Number(null)` es 0, no NaN. Validar el número sin comprobar antes el null
  // daba las 00:00 por buenas y el aviso salía de madrugada a todo el que nunca
  // hubiera tocado el selector.
  almacen.clear();
  assert.equal(horaElegida(), HORA_POR_DEFECTO);
  assert.notEqual(HORA_POR_DEFECTO, 0);
});

test('una hora guardada se recupera tal cual', () => {
  almacen.clear();
  guardarHora(21);
  assert.equal(horaElegida(), 21);
});

test('las cero horas sí son una elección válida si el usuario la guardó', () => {
  almacen.clear();
  guardarHora(0);
  assert.equal(horaElegida(), 0);
});

test('una hora corrupta o fuera de rango cae en la de por defecto', () => {
  for (const basura of ['', 'ocho', '25', '-1', '7.5', 'null']) {
    almacen.clear();
    guardarHora(basura);
    assert.equal(horaElegida(), HORA_POR_DEFECTO, `«${basura}» debería descartarse`);
  }
});

test('la conversión a UTC es reversible en la zona horaria de la máquina', () => {
  // No se puede comprobar un número fijo —depende de dónde corra el test— pero
  // sí que la ida y la vuelta cuadran, que es lo que importa: el cliente manda
  // la hora UTC y el cron la compara contra `getUTCHours()`.
  const fecha = new Date('2026-06-15T12:00:00');
  for (let local = 0; local < 24; local += 1) {
    const utc = horaUtcDe(local, fecha);
    assert.ok(Number.isInteger(utc) && utc >= 0 && utc <= 23, `hora UTC inválida para ${local}`);

    const comprobacion = new Date(fecha);
    comprobacion.setHours(local, 0, 0, 0);
    assert.equal(comprobacion.getUTCHours(), utc);
  }
});

test('el desfase es el mismo para todas las horas del mismo día', () => {
  // Si no lo fuera, el aviso de las 8 y el de las 9 acabarían en horas UTC que
  // no guardan una hora de diferencia.
  const fecha = new Date('2026-06-15T12:00:00');
  const desfases = new Set();
  for (let local = 0; local < 24; local += 1) {
    desfases.add((horaUtcDe(local, fecha) - local + 24) % 24);
  }
  assert.equal(desfases.size, 1, 'el desfase no es constante dentro del mismo día');
});

test('en invierno y en verano el desfase puede ser distinto', () => {
  // Es justo el motivo de que la hora UTC se recalcule en cada arranque en vez
  // de guardarse una sola vez: en Europa cambia con el horario de verano.
  const invierno = horaUtcDe(8, new Date('2026-01-15T12:00:00'));
  const verano = horaUtcDe(8, new Date('2026-07-15T12:00:00'));
  assert.ok(Number.isInteger(invierno) && Number.isInteger(verano));
});
