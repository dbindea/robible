// La recuperación de la contraseña por correo.
//
// Hasta el 17 nov 2026 era un trámite manual: quien olvidaba la contraseña
// escribía al propietario y éste se la generaba a mano contra la base de datos.
// Ahora el worker manda un enlace, y eso trae dos riesgos que no se ven desde
// fuera y que son los que vigila este fichero:
//
//   1. Un correo al que le falte el enlace —o que llegue sin el idioma de la
//      persona— deja a su destinatario sin NINGUNA forma de recuperar la
//      cuenta, y en este proyecto no hay registro de lo que se mandó.
//   2. Un enlace reutilizable es una llave permanente en un buzón ajeno.
//
// Lo que no se puede probar aquí es que el correo llegue: la firma del dominio
// sólo existe en producción. Eso se comprueba mandándose uno a sí mismo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correoRecuperacion } from '../workers/robible-api/src/mail-templates.js';
import { enviarCorreo, REMITENTE } from '../workers/robible-api/src/mail.js';
import { huellaDeContrasena } from '../workers/robible-api/src/auth.js';
import { makeToken, readToken } from '../workers/robible-api/src/utils.js';

const URL_EJEMPLO = 'https://robible.com/?recuperare=rb.AAA.BBB';
const IDIOMAS = ['ro', 'es', 'en', 'zh'];

// ── La plantilla ────────────────────────────────────────────────────────────

test('el correo existe en los cuatro idiomas y ninguno sale a medias', () => {
  for (const idioma of IDIOMAS) {
    const { asunto, html, texto } = correoRecuperacion(idioma, { nickname: 'dbindea', url: URL_EJEMPLO });
    assert.ok(asunto.length > 5, `${idioma}: asunto`);
    assert.ok(html.length > 200, `${idioma}: html`);
    assert.ok(texto.length > 60, `${idioma}: texto`);
    // Un `undefined` dentro del cuerpo es el síntoma de una clave que falta en
    // ese idioma, y en un correo no hay forma de enterarse después.
    assert.ok(!html.includes('undefined'), `${idioma}: html con undefined`);
    assert.ok(!texto.includes('undefined'), `${idioma}: texto con undefined`);
    assert.ok(html.includes('dbindea') && texto.includes('dbindea'), `${idioma}: saludo`);
  }
});

test('el enlace va en las DOS versiones, html y texto plano', () => {
  // Quien lea el correo en texto plano —o con los estilos cortados, que es lo
  // normal en los clientes corporativos— se quedaría sin poder recuperar nada
  // si el enlace viviera sólo en el botón.
  for (const idioma of IDIOMAS) {
    const { html, texto } = correoRecuperacion(idioma, { nickname: 'ana', url: URL_EJEMPLO });
    assert.ok(html.includes(URL_EJEMPLO), `${idioma}: el html tiene que llevar el enlace`);
    assert.ok(texto.includes(URL_EJEMPLO), `${idioma}: el texto plano también`);
    assert.ok(html.includes(`href="${URL_EJEMPLO}"`), `${idioma}: y como href, no sólo escrito`);
  }
});

test('un idioma desconocido cae al rumano en vez de salir vacío', () => {
  const rumano = correoRecuperacion('ro', { nickname: 'ana', url: URL_EJEMPLO });
  for (const raro of ['fr', '', null, undefined, 'xx', 'ROMANA']) {
    assert.equal(correoRecuperacion(raro, { nickname: 'ana', url: URL_EJEMPLO }).asunto, rumano.asunto);
  }
  // Y las variantes regionales se reconocen por las dos primeras letras.
  assert.equal(
    correoRecuperacion('es-ES', { nickname: 'ana', url: URL_EJEMPLO }).asunto,
    correoRecuperacion('es', { nickname: 'ana', url: URL_EJEMPLO }).asunto,
  );
});

test('el apodo se escapa antes de entrar en el html', () => {
  // Hoy el validador de apodos no deja ni `<` ni `"`, así que esto no puede
  // pasar. Se comprueba igual porque la plantilla no debería depender de que un
  // validador de otro fichero siga siendo así de estricto.
  const { html } = correoRecuperacion('ro', { nickname: '<b>ana</b>', url: URL_EJEMPLO });
  assert.ok(!html.includes('<b>ana</b>'));
  assert.ok(html.includes('&lt;b&gt;ana&lt;/b&gt;'));
});

// ── El envío ────────────────────────────────────────────────────────────────

test('sin clave configurada no se llama a la red y se dice que no se envió', async () => {
  const fetchQueFalla = () => {
    throw new Error('no se puede tocar la red sin clave');
  };
  const res = await enviarCorreo(
    {},
    { para: 'a@b.com', asunto: 'x', html: 'y', texto: 'z' },
    { fetchImpl: fetchQueFalla },
  );
  // Lo importante es el `ok: false`: un `ok` de cortesía dejaría a la persona
  // esperando delante del buzón un correo que nadie mandó, y por fuera eso es
  // indistinguible de un correo perdido.
  assert.equal(res.ok, false);
  assert.equal(res.motivo, 'mail_not_configured');
});

test('con MAIL_DEBUG se simula el envío, que es como se prueba en local', async () => {
  const errores = [];
  const res = await enviarCorreo(
    { MAIL_DEBUG: '1' },
    { para: 'a@b.com', asunto: 'x', html: 'y', texto: 'z' },
    { fetchImpl: () => errores.push('se llamó a la red') },
  );
  assert.equal(res.ok, true);
  assert.equal(res.simulado, true);
  assert.deepEqual(errores, [], 'en modo local no se manda nada de verdad');
});

test('con clave, manda a Resend lo que hay que mandar', async () => {
  let recibido = null;
  const fetchFalso = (url, opciones) => {
    recibido = { url, opciones };
    return { ok: true, status: 200, text: async () => '' };
  };
  const res = await enviarCorreo(
    { RESEND_API_KEY: 're_clave_de_pruebas' },
    { para: 'ana@gmail.com', asunto: 'Asunto', html: '<p>hola</p>', texto: 'hola' },
    { fetchImpl: fetchFalso },
  );

  assert.equal(res.ok, true);
  assert.equal(recibido.url, 'https://api.resend.com/emails');
  assert.equal(recibido.opciones.method, 'POST');
  assert.equal(recibido.opciones.headers.Authorization, 'Bearer re_clave_de_pruebas');

  const cuerpo = JSON.parse(recibido.opciones.body);
  assert.equal(cuerpo.to, 'ana@gmail.com');
  assert.equal(cuerpo.from, REMITENTE);
  assert.equal(cuerpo.subject, 'Asunto');
  // La versión de texto no es opcional: un correo sólo-html puntúa peor en los
  // filtros de spam, y éste es justo el que no puede acabar ahí.
  assert.equal(cuerpo.text, 'hola');
  assert.ok(cuerpo.reply_to, 'alguien tiene que leer las respuestas');
});

test('un error del proveedor no se cuenta como enviado', async () => {
  for (const respuesta of [
    { ok: false, status: 429, text: async () => '{"name":"daily_quota_exceeded"}' },
    { ok: false, status: 403, text: async () => '{"name":"domain_not_verified"}' },
  ]) {
    const res = await enviarCorreo(
      { RESEND_API_KEY: 're_x' },
      { para: 'a@b.com', asunto: 'x', html: 'y', texto: 'z' },
      { fetchImpl: () => respuesta },
    );
    assert.equal(res.ok, false);
    assert.equal(res.motivo, 'mail_failed');
  }

  // Y la red caída tampoco: el worker no puede reventar por esto, porque el
  // mismo manejador tiene que poder contestar al cliente.
  const caido = await enviarCorreo(
    { RESEND_API_KEY: 're_x' },
    { para: 'a@b.com', asunto: 'x', html: 'y', texto: 'z' },
    {
      fetchImpl: () => {
        throw new Error('ECONNRESET');
      },
    },
  );
  assert.equal(caido.ok, false);
  assert.equal(caido.motivo, 'mail_failed');
});

// ── Un solo uso ─────────────────────────────────────────────────────────────

test('el enlace deja de valer en cuanto la contraseña cambia', async () => {
  const hashViejo = 'a'.repeat(64);
  const hashNuevo = 'b'.repeat(64);

  const pv = await huellaDeContrasena(hashViejo);
  const token = await makeToken('u_1', 'secreto', 60_000, { pv });
  const payload = await readToken(token, 'secreto');

  // Mientras no se haya tocado la contraseña, el enlace vale.
  assert.equal(payload.pv, await huellaDeContrasena(hashViejo));
  // Después de cambiarla, no. Es la comprobación entera que hace
  // `resetPassword`, y lo único que impide que el enlace del correo siga
  // abriendo la cuenta semanas después.
  assert.notEqual(payload.pv, await huellaDeContrasena(hashNuevo));
});

test('la huella no transporta nada del hash guardado', async () => {
  const hash = 'deadbeef'.repeat(8);
  const pv = await huellaDeContrasena(hash);
  assert.equal(pv.length, 12);
  // Se hashea el hash a propósito: el token viaja por correo y acaba en
  // servidores ajenos, así que no puede llevar ni un trozo de lo que hay en la
  // base de datos.
  assert.ok(!hash.includes(pv));
  assert.equal(pv, await huellaDeContrasena(hash), 'y es determinista, o nada funcionaría');
});
