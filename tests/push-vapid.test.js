// Firma VAPID.
//
// Esto no se puede «probar mirándolo»: un JWT mal firmado da un 401 del servidor
// de push, sin cuerpo ni explicación, y meses después. Aquí se genera un par de
// claves de verdad, se firma y se **verifica la firma con la clave pública**,
// que es la única comprobación que significa algo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { buildVapidHeader } from '../workers/robible-api/src/push.js';

const b64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (t) => Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// `push.js` usa las globales del entorno Workers. Node las tiene todas menos la
// garantía de `crypto.subtle`, así que se asegura aquí.
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;

const generarPar = async () => {
  const par = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    publicKey: b64url(await webcrypto.subtle.exportKey('raw', par.publicKey)),
    privateKey: (await webcrypto.subtle.exportKey('jwk', par.privateKey)).d,
    verificador: par.publicKey,
  };
};

test('la cabecera tiene la forma que espera el servidor de push', async () => {
  const { publicKey, privateKey } = await generarPar();
  const cabecera = await buildVapidHeader({
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    publicKey,
    privateKey,
    subject: 'mailto:dbindea@gmail.com',
  });

  assert.match(cabecera, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
  assert.ok(cabecera.endsWith(`k=${publicKey}`));
});

test('la firma se verifica con la clave pública', async () => {
  const { publicKey, privateKey, verificador } = await generarPar();
  const cabecera = await buildVapidHeader({
    endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/xyz',
    publicKey,
    privateKey,
    subject: 'mailto:dbindea@gmail.com',
  });

  const jwt = cabecera.slice('vapid t='.length, cabecera.indexOf(', k='));
  const [cabeceraB64, cargaB64, firmaB64] = jwt.split('.');

  const valida = await webcrypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    verificador,
    b64urlDecode(firmaB64),
    Buffer.from(`${cabeceraB64}.${cargaB64}`),
  );
  assert.equal(valida, true, 'la firma no verifica contra su propia clave pública');
});

test('el JWT declara ES256 y lleva las tres reclamaciones obligatorias', async () => {
  const { publicKey, privateKey } = await generarPar();
  const cabecera = await buildVapidHeader({
    endpoint: 'https://wns2-par02p.notify.windows.com/w/?token=xyz',
    publicKey,
    privateKey,
    subject: 'mailto:dbindea@gmail.com',
  });

  const jwt = cabecera.slice('vapid t='.length, cabecera.indexOf(', k='));
  // Sólo las dos primeras partes son JSON; la tercera es la firma.
  const [h, c] = jwt
    .split('.')
    .slice(0, 2)
    .map((p) => JSON.parse(b64urlDecode(p).toString('utf8')));

  assert.equal(h.alg, 'ES256');
  assert.equal(h.typ, 'JWT');
  assert.equal(c.sub, 'mailto:dbindea@gmail.com');
  assert.ok(c.exp > Math.floor(Date.now() / 1000), 'el token nace caducado');
  assert.ok(c.exp <= Math.floor(Date.now() / 1000) + 24 * 3600, 'la especificación no permite más de 24 h');
});

test('`aud` es el origen del endpoint, no el endpoint entero', async () => {
  // Es el error clásico de VAPID: con la ruta incluida el servidor devuelve 401
  // sin decir por qué.
  const { publicKey, privateKey } = await generarPar();
  const cabecera = await buildVapidHeader({
    endpoint: 'https://fcm.googleapis.com/fcm/send/token-largo-con/barras',
    publicKey,
    privateKey,
    subject: 'mailto:dbindea@gmail.com',
  });

  const jwt = cabecera.slice('vapid t='.length, cabecera.indexOf(', k='));
  const carga = JSON.parse(b64urlDecode(jwt.split('.')[1]).toString('utf8'));
  assert.equal(carga.aud, 'https://fcm.googleapis.com');
});

test('una clave pública que no es un punto P-256 se rechaza', async () => {
  const { privateKey } = await generarPar();
  await assert.rejects(
    () =>
      buildVapidHeader({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        publicKey: b64url(Buffer.alloc(10)),
        privateKey,
        subject: 'mailto:dbindea@gmail.com',
      }),
    /P-256/,
  );
});

test('dos endpoints distintos producen firmas distintas', async () => {
  const { publicKey, privateKey } = await generarPar();
  const comun = { publicKey, privateKey, subject: 'mailto:dbindea@gmail.com' };
  const a = await buildVapidHeader({ ...comun, endpoint: 'https://fcm.googleapis.com/x' });
  const b = await buildVapidHeader({ ...comun, endpoint: 'https://updates.push.services.mozilla.com/y' });
  assert.notEqual(a, b);
});
