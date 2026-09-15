// El ciclo de vida del dictado: que el micrófono se cierre SIEMPRE.
//
// Lo que se cubre aquí no es que reconozca bien —eso es del navegador— sino lo
// único que puede salir caro: **dejar el micrófono abierto**. `continuous =
// false` debería cerrarlo en cuanto detecta que has terminado de hablar, y
// normalmente lo hace; pero con ruido de sala —que es justo donde se va a usar,
// una iglesia con gente— el detector de silencio puede no dispararse nunca.
//
// Un micrófono abierto que nadie sabe que está abierto no es aceptable, así que
// hay dos redes: se para al recibir la frase final, y hay un tope duro por
// tiempo. Este fichero comprueba las dos.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// El servicio lee `window.SpeechRecognition` al importarse, así que el doble
// tiene que estar puesto ANTES del import.
class ReconocedorFalso {
  static ultima = null;

  constructor() {
    ReconocedorFalso.ultima = this;
    this.arrancado = false;
    this.parado = false;
    this.paradas = 0;
  }

  start() { this.arrancado = true; }

  stop() {
    this.parado = true;
    this.paradas += 1;
    this.onend?.();
  }

  /** Simula lo que emite el navegador al entender algo. */
  emitir(texto, final) {
    this.onresult?.({
      resultIndex: 0,
      results: Object.assign([[{ transcript: texto }]], { 0: Object.assign([{ transcript: texto }], { isFinal: final }) }),
    });
  }
}

// Sólo `window`: es lo único que el módulo lee al importarse. `navigator` no se
// toca porque en Node 24 es de sólo lectura, y tampoco hace falta — las
// funciones que lo usan (`usaServidorExterno`, `pedirPermiso`) no entran aquí.
globalThis.window = { SpeechRecognition: ReconocedorFalso };

const { dictar, soportado, localeDeReconocimiento } = await import('../src/services/speech.service.js');

test('detecta el soporte del navegador', () => {
  assert.equal(soportado(), true);
});

test('cada versión bíblica dicta en su idioma', () => {
  assert.equal(localeDeReconocimiento('ro'), 'ro-RO');
  assert.equal(localeDeReconocimiento('es'), 'es-ES');
  assert.equal(localeDeReconocimiento('en'), 'en-US');
  assert.equal(localeDeReconocimiento('zh'), 'zh-CN');
  // Un idioma que no tenemos cae al de la casa en vez de romper.
  assert.equal(localeDeReconocimiento('de'), 'ro-RO');
  assert.equal(localeDeReconocimiento(undefined), 'ro-RO');
});

test('el micrófono se cierra solo al recibir la frase final', () => {
  // Sin esto había que esperar a que el reconocedor lo decidiera, y en algunos
  // navegadores tarda varios segundos más con el indicador de grabación
  // encendido para nada.
  const recibido = [];
  dictar({ locale: 'ro-RO', alEscuchar: (t, final) => recibido.push([t, final]) });
  const rec = ReconocedorFalso.ultima;

  rec.emitir('ioan trei', false);
  assert.equal(rec.parado, false, 'con la frase a medias sigue escuchando');

  rec.emitir('ioan trei saisprezece', true);
  assert.equal(rec.parado, true, 'con la frase cerrada tiene que parar');
  assert.deepEqual(recibido.at(-1), ['ioan trei saisprezece', true]);
});

test('hay un tope duro: el micrófono no se queda abierto para siempre', async (t) => {
  // Es la red de seguridad para cuando el detector de silencio no salta, que es
  // lo que pasa con ruido de fondo.
  t.mock.timers.enable({ apis: ['setTimeout'] });

  dictar({ locale: 'ro-RO', topeMs: 15000, alEscuchar: () => {} });
  const rec = ReconocedorFalso.ultima;

  t.mock.timers.tick(14000);
  assert.equal(rec.parado, false, 'antes del tope sigue escuchando');

  t.mock.timers.tick(2000);
  assert.equal(rec.parado, true, 'pasado el tope se cierra solo');
});

test('parar a mano cancela el tope: no se para dos veces', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const sesion = dictar({ locale: 'ro-RO', topeMs: 15000, alEscuchar: () => {} });
  const rec = ReconocedorFalso.ultima;

  sesion.parar();
  assert.equal(rec.paradas, 1);

  // El temporizador ya no debe existir: si siguiera vivo, llamaría a `stop()`
  // sobre una sesión cerrada y, con el botón ya pulsado otra vez, podría cortar
  // la siguiente escucha a mitad.
  t.mock.timers.tick(30000);
  assert.equal(rec.paradas, 1, 'el tope tenía que haberse cancelado al parar');
});

test('el aviso de fin llega una sola vez', () => {
  let fines = 0;
  const sesion = dictar({ locale: 'ro-RO', alEscuchar: () => {}, alTerminar: () => { fines += 1; } });
  sesion.parar();
  assert.equal(fines, 1);
});

test('`aborted` tras parar a mano no se cuenta como error', () => {
  // Es lo que emite el propio `stop()`. Avisar de él enseñaría un mensaje de
  // error cada vez que el usuario suelta el botón.
  const errores = [];
  const sesion = dictar({ locale: 'ro-RO', alEscuchar: () => {}, alFallar: (c) => errores.push(c) });
  const rec = ReconocedorFalso.ultima;
  sesion.parar();
  rec.onerror?.({ error: 'aborted' });
  assert.deepEqual(errores, []);
});

test('los errores de verdad sí se avisan, con su código', () => {
  // Cada código pide una acción distinta del usuario, así que tienen que llegar
  // distinguidos y no como un «algo ha fallado» genérico.
  for (const codigo of ['not-allowed', 'service-not-allowed', 'audio-capture', 'network']) {
    const errores = [];
    dictar({ locale: 'ro-RO', alEscuchar: () => {}, alFallar: (c) => errores.push(c) });
    ReconocedorFalso.ultima.onerror?.({ error: codigo });
    assert.deepEqual(errores, [codigo]);
  }
});
