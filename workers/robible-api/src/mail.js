// Envío de correo transaccional desde el worker.
//
// ── Por qué un proveedor externo ────────────────────────────────────────────
// Cloudflare tiene envío propio (`send_email`) y NO sirve aquí: en plan
// gratuito sólo escribe a direcciones verificadas una por una en la cuenta, y
// llegar a destinatarios cualesquiera exige Workers Paid *más* el mismo trabajo
// de DNS. Resend es una petición HTTP, 3.000 correos al mes gratis, y no añade
// ninguna dependencia: el worker sigue dependiendo sólo de hono.
//
// ── Lo que hace falta configurado ───────────────────────────────────────────
//   - `RESEND_API_KEY` como secreto (`wrangler secret put RESEND_API_KEY`).
//   - El dominio dado de alta y verificado en Resend. Los registros van en el
//     subdominio `send.robible.com` y en `resend._domainkey`, así que el MX de
//     la raíz —el correo de IONOS— no se toca.
//   - `SITE_URL` en `wrangler.toml`, que es la base de los enlaces.
//
// Lo único que NO se puede probar en local es que el correo llegue: la firma
// DKIM existe sólo en producción. Lo demás sí, ver `MAIL_DEBUG` más abajo.

/**
 * Remitente. Elegido por el propietario el 17 nov 2026: `support@` en lugar del
 * `noreply@` que había. La dirección **no necesita buzón para enviar** —lo que
 * autoriza el envío es el DKIM del dominio, no una cuenta—, pero `support@`
 * promete lo contrario que `noreply@`: quien la lea dará por hecho que hay
 * alguien detrás y escribirá a ella directamente, no con «responder». Esos
 * mensajes rebotan si el buzón no existe, así que **conviene que `support@`
 * exista o sea un alias** al correo del propietario en IONOS.
 *
 * Mientras tanto `reply_to` sigue apuntando a una dirección que se lee de
 * verdad, que es lo que salva las respuestas aunque el alias no esté hecho: la
 * gente contesta a los correos automáticos, y una respuesta perdida no produce
 * ningún síntoma por el que enterarse.
 */
export const REMITENTE = 'RoBible <support@robible.com>';
export const RESPONDER_A = 'dbindea@gmail.com';

const ENDPOINT = 'https://api.resend.com/emails';

/**
 * Manda un correo. Devuelve `{ ok }` o `{ ok: false, motivo }` con un código ya
 * traducible por el frontend (`mail_not_configured` | `mail_failed`).
 *
 * **No miente nunca.** Sin clave configurada devuelve error en vez de un `ok`
 * de cortesía: un `ok` falso dejaría a la persona esperando delante del buzón
 * un correo que nadie envió, y eso es indistinguible desde fuera de un correo
 * perdido en el camino.
 *
 * `fetchImpl` se inyecta sólo en los tests, para poder comprobar que sin clave
 * no se llama a la red.
 */
export async function enviarCorreo(env, { para, asunto, html, texto }, { fetchImpl } = {}) {
  const clave = env?.RESEND_API_KEY;

  // ── Modo local ───────────────────────────────────────────────────────────
  // `dev-server.js` pone `MAIL_DEBUG=1`. El correo entero sale por el terminal,
  // enlace incluido, y así el flujo de recuperación se prueba de principio a
  // fin sin dominio, sin clave y sin mandar nada a nadie.
  if (!clave && env?.MAIL_DEBUG === '1') {
    console.log('\n── correo (MAIL_DEBUG, no se envía) ──────────────────────');
    console.log(`Para:   ${para}`);
    console.log(`Asunto: ${asunto}`);
    console.log(texto);
    console.log('─────────────────────────────────────────────────────────\n');
    return { ok: true, simulado: true };
  }

  if (!clave) return { ok: false, motivo: 'mail_not_configured' };

  const pedir = fetchImpl || fetch;
  try {
    const respuesta = await pedir(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: REMITENTE,
        to: para,
        subject: asunto,
        html,
        // La versión de texto va siempre. Un correo sólo-HTML puntúa peor en
        // los filtros de spam, y éste es justo el que no puede acabar ahí.
        text: texto,
        reply_to: RESPONDER_A,
      }),
    });

    if (respuesta.ok) return { ok: true };

    // El cuerpo del error se registra pero no se devuelve al cliente: trae el
    // destinatario y detalles del proveedor. Los dos que importan en la
    // práctica son `daily_quota_exceeded` (100/día en el plan gratuito) y el
    // dominio sin verificar; los dos se ven aquí con `wrangler tail`.
    const detalle = await respuesta.text().catch(() => '');
    console.error(`resend ${respuesta.status}: ${detalle.slice(0, 300)}`);
    return { ok: false, motivo: 'mail_failed' };
  } catch (e) {
    console.error(`resend inalcanzable: ${String(e?.message || e).slice(0, 200)}`);
    return { ok: false, motivo: 'mail_failed' };
  }
}
