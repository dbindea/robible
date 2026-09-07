/**
 * Metadatos Open Graph de un tema compartido (`/tema/<slug>`).
 *
 * Por qué existe: quien pega el enlace en WhatsApp o Telegram provoca que un
 * bot pida la URL, y ese bot no ejecuta JavaScript. Sin esto vería el título
 * genérico de la app en vez del nombre del tema, que es justo lo que hace que
 * merezca la pena compartirlo.
 *
 * Ojo con el bucle: `verse-meta` puede redirigir al usuario a la ruta canónica
 * porque es distinta de la suya (`/verse/...` → `/biblia/...`). Aquí la
 * canónica **es** `/tema/<slug>`, así que redirigir ahí volvería a entrar en
 * esta misma función indefinidamente. Se rompe con `?app=1`: una regla previa
 * en netlify.toml sirve la SPA cuando ese parámetro está presente, y
 * PublicTopic.svelte lo borra de la barra de direcciones al arrancar para que
 * el usuario no acabe copiando una URL con basura.
 *
 * A diferencia de verse-meta, los datos no están en disco: el tema vive en D1,
 * así que hay que preguntárselos al worker.
 */

const SITE_URL = 'https://robible.com';
const API_URL = 'https://robible-api.robible.workers.dev';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Mismo criterio que el validador del worker: nada que pueda salirse de la ruta.
function isValidSlug(slug) {
  return typeof slug === 'string' && slug.length >= 1 && slug.length <= 80 && !/[/?#\s]/.test(slug);
}

function getSlug(event) {
  const fromQuery = (event.queryStringParameters || {}).slug;
  if (fromQuery) return fromQuery;
  const [, slug] = (event.path || '').match(/^\/tema\/([^/]+)\/?$/) || [];
  return slug ? decodeURIComponent(slug) : '';
}

function buildHtml({ topic, canonicalUrl, redirectPath, verseCount }) {
  const title = `${topic.name} — RoBible`;
  const description = `${verseCount} ${verseCount === 1 ? 'versículo' : 'versículos'} sobre ${topic.name}, listos para leer y compartir.`;
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const ogImage = `${SITE_URL}/assets/img/logo.png`;

  // `noindex, follow` a propósito: los temas los escriben los usuarios y no se
  // quiere que Google indexe cientos de páginas finas o con nombres sin
  // sentido. El enlace sigue sirviendo para compartir, que es su función.
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, follow" />
    <meta name="theme-color" content="#3f5867" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${safeCanonicalUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="RoBible" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeCanonicalUrl}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <script>window.location.replace(${JSON.stringify(redirectPath)});</script>
  </head>
  <body>
    <p><a href="${escapeHtml(redirectPath)}">${safeTitle}</a></p>
  </body>
</html>`;
}

export async function handler(event) {
  const slug = getSlug(event);

  if (!isValidSlug(slug)) {
    return { statusCode: 404, body: 'Topic not found' };
  }

  try {
    const res = await fetch(`${API_URL}/api/public/topics/${encodeURIComponent(slug)}`);

    if (!res.ok) {
      // Un tema despublicado o inexistente: se deja pasar a la SPA, que ya
      // enseña su propio mensaje de "este tema no existe".
      return {
        statusCode: 302,
        headers: { Location: `/tema/${encodeURIComponent(slug)}?app=1` },
        body: '',
      };
    }

    const data = await res.json();
    const topic = data?.topic;

    if (!topic?.name) {
      return { statusCode: 404, body: 'Topic not found' };
    }

    const canonicalUrl = `${SITE_URL}/tema/${encodeURIComponent(slug)}`;

    return {
      statusCode: 200,
      headers: {
        // Corto: el usuario puede añadir versículos al tema o despublicarlo.
        'Cache-Control': 'public, max-age=300',
        'Content-Type': 'text/html; charset=utf-8',
      },
      body: buildHtml({
        topic,
        canonicalUrl,
        redirectPath: `/tema/${encodeURIComponent(slug)}?app=1`,
        verseCount: Array.isArray(topic.verses) ? topic.verses.length : 0,
      }),
    };
  } catch (error) {
    console.error('topic-meta:', error);
    // Si el worker no responde, mejor mandar al usuario a la SPA que darle un
    // 500: allí verá el mensaje de error correcto.
    return {
      statusCode: 302,
      headers: { Location: `/tema/${encodeURIComponent(slug)}?app=1` },
      body: '',
    };
  }
}
