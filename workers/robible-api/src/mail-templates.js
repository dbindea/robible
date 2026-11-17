// Los textos de los correos que manda el worker, en los cuatro idiomas.
//
// ── Por qué están duplicados aquí y no en public/lang/*.json ────────────────
// Es el mismo caso que `netlify/functions/sermons-index-meta.mjs` con los siete
// pasos de homilética (CLAUDE.md, trampa 52): esto es otro bundle y no puede
// importar del de la aplicación. Si cambias el tono de un mensaje, acuérdate de
// que la pantalla equivalente vive en `public/lang/*.json` y no se entera.
//
// El idioma lo manda el cliente en el cuerpo de la petición, como ya hace
// `register` con las categorías por defecto: el worker no sabe en qué idioma
// lee cada persona, y deducirlo del navegador acertaría menos.

const IDIOMAS = ['ro', 'es', 'en', 'zh'];

/** Cualquier cosa que no sea uno de los cuatro cae a rumano. */
const normalizarIdioma = (valor) => {
  const limpio = String(valor ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 2);
  return IDIOMAS.includes(limpio) ? limpio : 'ro';
};

/**
 * El apodo se escapa aunque hoy sólo pueda contener `[a-zA-Z0-9_.-]`: la
 * plantilla no debería depender de que un validador de otro fichero siga siendo
 * así de estricto dentro de un año.
 */
const escapar = (texto) =>
  String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const TEXTOS = {
  ro: {
    asunto: 'Recuperare parolă RoBible',
    saludo: (n) => `Bună, ${n}.`,
    cuerpo: 'Ai cerut să îți schimbi parola la RoBible. Apasă butonul și scrie una nouă:',
    boton: 'Setează o parolă nouă',
    alternativa: 'Dacă butonul nu funcționează, copiază adresa aceasta în browser:',
    caducidad: 'Linkul expiră într-o oră și poate fi folosit o singură dată.',
    ignorar: 'Dacă nu ai cerut tu acest mesaj, ignoră-l: parola ta actuală rămâne neschimbată.',
    pie: 'RoBible · Biblia în patru limbi · robible.com',
  },
  es: {
    asunto: 'Recuperar la contraseña de RoBible',
    saludo: (n) => `Hola, ${n}.`,
    cuerpo: 'Has pedido cambiar tu contraseña en RoBible. Pulsa el botón y escribe una nueva:',
    boton: 'Poner una contraseña nueva',
    alternativa: 'Si el botón no funciona, copia esta dirección en el navegador:',
    caducidad: 'El enlace caduca en una hora y solo se puede usar una vez.',
    ignorar: 'Si no has pedido este mensaje, ignóralo: tu contraseña actual sigue siendo válida.',
    pie: 'RoBible · La Biblia en cuatro idiomas · robible.com',
  },
  en: {
    asunto: 'Reset your RoBible password',
    saludo: (n) => `Hi ${n},`,
    cuerpo: 'You asked to change your RoBible password. Tap the button and choose a new one:',
    boton: 'Set a new password',
    alternativa: "If the button doesn't work, copy this address into your browser:",
    caducidad: 'The link expires in one hour and can only be used once.',
    ignorar: "If you didn't ask for this, just ignore the message: your current password still works.",
    pie: 'RoBible · The Bible in four languages · robible.com',
  },
  zh: {
    asunto: '重设 RoBible 密码',
    saludo: (n) => `${n}，你好。`,
    cuerpo: '你请求重设 RoBible 的密码。请点击下面的按钮设置新密码：',
    boton: '设置新密码',
    alternativa: '如果按钮无法使用，请把下面的地址复制到浏览器中：',
    caducidad: '链接一小时后失效，并且只能使用一次。',
    ignorar: '如果这不是你发起的请求，请忽略此邮件：你现在的密码仍然有效。',
    pie: 'RoBible · 四种语言的圣经 · robible.com',
  },
};

/**
 * El correo de recuperación: `{ asunto, html, texto }`.
 *
 * **El enlace va en las dos versiones**, HTML y texto plano. Quien lea el
 * correo en texto plano —o tenga las imágenes y los estilos cortados— se
 * quedaría sin poder recuperar nada si sólo estuviera en el botón, y no habría
 * forma de enterarse desde aquí.
 */
export function correoRecuperacion(locale, { nickname, url }) {
  const t = TEXTOS[normalizarIdioma(locale)];
  const apodo = escapar(nickname);
  const enlace = escapar(url);

  // Estilos en línea y nada más: ningún cliente de correo carga una hoja
  // externa, y la mitad descartan incluso un `<style>` en la cabecera.
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2933;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e1e5ea;border-radius:8px;">
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${t.saludo(apodo)}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;">${t.cuerpo}</p>
      <p style="margin:0 0 20px;">
        <a href="${enlace}" style="display:inline-block;padding:12px 20px;background:#1c6f91;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;">${t.boton}</a>
      </p>
      <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#52606d;">${t.alternativa}</p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${enlace}" style="color:#1c6f91;">${enlace}</a></p>
      <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#52606d;">${t.caducidad}</p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#52606d;">${t.ignorar}</p>
    </td></tr>
    <tr><td style="padding:0 28px 24px;border-top:1px solid #e1e5ea;">
      <p style="margin:16px 0 0;font-size:12px;color:#7b8794;">${t.pie}</p>
    </td></tr>
  </table>
</body></html>`;

  const texto = [t.saludo(nickname), '', t.cuerpo, '', url, '', t.caducidad, t.ignorar, '', t.pie].join('\n');

  return { asunto: t.asunto, html, texto };
}
