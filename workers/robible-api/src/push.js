// Web Push: firma VAPID y envío.
//
// ── Por qué NO se manda payload ──────────────────────────────────────────
//
// Un push con datos obliga a cifrar el cuerpo con aes128gcm (RFC 8291): ECDH
// contra la clave pública del navegador, HKDF, GCM… varios cientos de líneas de
// criptografía a mano dentro del worker, y cada una de ellas una forma nueva de
// que el aviso no llegue.
//
// Aquí no hace falta ninguna. El versículo del día es **determinista a partir de
// la fecha** (ver daily-verse.service.js) y la lista vive en un JSON que el
// service worker ya tiene precacheado. Así que el push va vacío —sólo dice
// «despierta»— y es el propio service worker el que calcula qué versículo toca y
// escribe la notificación. Menos código, menos secretos en tránsito y el aviso
// funciona igual.
//
// Consecuencia buscada: por el cable no viaja **nada** sobre el usuario. El
// servidor de push de Google o de Mozilla ve una petición vacía.

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const b64urlDecode = (texto) => {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = normal + '='.repeat((4 - (normal.length % 4)) % 4);
  const cadena = atob(relleno);
  return Uint8Array.from(cadena, (c) => c.charCodeAt(0));
};

const textoABytes = (s) => new TextEncoder().encode(s);

/**
 * Importa la clave privada VAPID.
 *
 * Se guarda como los tres componentes de la JWK (d, x, y) en lugar de un PKCS#8
 * en PEM porque un secreto de Cloudflare es una línea de texto: un PEM con sus
 * saltos de línea se corrompe al pegarlo y el fallo aparece meses después, en el
 * primer envío.
 */
const importarClavePrivada = async (privadaB64, publicaB64) => {
  const publica = b64urlDecode(publicaB64);
  if (publica.length !== 65 || publica[0] !== 4) {
    throw new Error('VAPID_PUBLIC_KEY no es un punto P-256 sin comprimir');
  }

  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: privadaB64,
      x: b64url(publica.slice(1, 33)),
      y: b64url(publica.slice(33, 65)),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
};

/**
 * Construye la cabecera `Authorization` de un envío.
 *
 * `aud` es el **origen** del endpoint, no el endpoint entero: mandarlo completo
 * es el error clásico y el servidor de push responde 401 sin más explicación.
 */
export const buildVapidHeader = async ({ endpoint, publicKey, privateKey, subject }) => {
  const aud = new URL(endpoint).origin;
  const cabecera = { typ: 'JWT', alg: 'ES256' };
  // 12 horas. La especificación permite hasta 24; se deja margen para que un
  // reloj desajustado en el servidor de push no invalide el token.
  const carga = { aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject };

  const cuerpo = `${b64url(textoABytes(JSON.stringify(cabecera)))}.${b64url(textoABytes(JSON.stringify(carga)))}`;
  const clave = await importarClavePrivada(privateKey, publicKey);

  // WebCrypto devuelve la firma ECDSA ya como r||s de 64 bytes, que es
  // exactamente lo que pide JWS. No hay que desenvolver ningún DER.
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clave, textoABytes(cuerpo));

  return `vapid t=${cuerpo}.${b64url(firma)}, k=${publicKey}`;
};

/**
 * Envía un push vacío a un endpoint.
 *
 * Devuelve `{ ok, status, gone }`. `gone` marca las suscripciones que el
 * navegador ya ha tirado (404/410): son las que hay que borrar de la base, y no
 * borrarlas hace que la lista crezca para siempre con destinos muertos.
 */
export const sendPush = async (endpoint, { publicKey, privateKey, subject, ttl = 12 * 3600 }) => {
  const authorization = await buildVapidHeader({ endpoint, publicKey, privateKey, subject });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      TTL: String(ttl),
      // Sin cuerpo, pero la cabecera es obligatoria en algunos servidores.
      'Content-Length': '0',
      // `normal` y no `high`: es un recordatorio diario, no un mensaje urgente.
      Urgency: 'normal',
    },
  });

  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
};
