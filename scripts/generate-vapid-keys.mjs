// Genera el par de claves VAPID para las notificaciones push.
//
// Se ejecuta UNA vez. Cambiar la clave pública invalida todas las suscripciones
// que ya tengan los usuarios: sus navegadores dejarían de aceptar los envíos y
// no hay forma de avisarles, así que si algún día hay que rotarla, hay que
// borrar la tabla de suscripciones y pedirlas otra vez.
//
// Uso:
//   node scripts/generate-vapid-keys.mjs
//
// Después:
//   1. La pública va a wrangler.toml, en [vars] VAPID_PUBLIC_KEY. No es secreta:
//      el navegador la necesita para suscribirse.
//   2. La privada va como secreto, nunca al repositorio:
//        npx wrangler secret put VAPID_PRIVATE_KEY
//   3. VAPID_SUBJECT es un `mailto:` de contacto — lo exige la especificación
//      para que el servidor de push sepa a quién escribir si algo va mal.
//
// El frontend NO necesita ninguna variable de entorno para esto: la pública se
// la pide al worker en `GET /api/push/key`. Así rotar la clave es un despliegue
// del worker y no dos, y no hay forma de que las dos copias se descoordinen.

import { webcrypto } from 'node:crypto';

const b64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const par = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);

const publicaRaw = await webcrypto.subtle.exportKey('raw', par.publicKey);
const jwkPrivada = await webcrypto.subtle.exportKey('jwk', par.privateKey);

const publica = b64url(publicaRaw);
const privada = jwkPrivada.d; // ya viene en base64url

console.log('');
console.log('VAPID_PUBLIC_KEY  (pública, va en wrangler.toml y en VITE_VAPID_PUBLIC_KEY)');
console.log(publica);
console.log('');
console.log('VAPID_PRIVATE_KEY (secreta: npx wrangler secret put VAPID_PRIVATE_KEY)');
console.log(privada);
console.log('');
console.log('Longitudes:', publica.length, 'y', privada.length, '— la pública debe empezar por B.');
