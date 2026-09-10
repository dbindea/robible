/**
 * Metadatos de una predicación compartida (`/predica/<slug>`).
 *
 * Por qué existe: quien pega el enlace en WhatsApp provoca que un bot pida la
 * URL, y ese bot no ejecuta JavaScript. Sin esto vería el título genérico de la
 * aplicación en vez del de la predicación. Y los buscadores, lo mismo.
 *
 * **Diferencia deliberada con `topic-meta`: esto SÍ se indexa.** Un tema
 * compartido es un enlace que se pasa a alguien concreto, y por eso allí va
 * `noindex`. Una predicación publicada es lo contrario: su autor la pone en
 * internet para que se encuentre. Por eso aquí van `index, follow` y datos
 * estructurados de artículo.
 *
 * Ojo con el bucle: la ruta canónica **es** `/predica/<slug>`, así que
 * redirigir ahí volvería a entrar en esta misma función indefinidamente. Se
 * rompe con `?app=1`: una regla previa en netlify.toml sirve la SPA cuando ese
 * parámetro está presente.
 */

const SITE_URL = 'https://robible.com';
const API_URL = 'https://robible-api.robible.workers.dev';

/**
 * Quita los asteriscos del marcado manual de palabras clave.
 *
 * Duplica a propósito `quitarMarcas` de sermon-content.service.js: esto es una
 * función de Netlify y no puede importar del bundle del frontend. Es un
 * `replace` de una línea sin estado; si algún día el marcado deja de ser
 * `*palabra*`, hay que tocar los dos sitios.
 */
function sinMarcas(value = '') {
  return String(value).replace(/\*([^*\n]+)\*/g, '$1');
}

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
  const [, slug] = (event.path || '').match(/^\/predica\/([^/]+)\/?$/) || [];
  return slug ? decodeURIComponent(slug) : '';
}

/** Nombres de libro en rumano: es la Biblia con la que se predica casi siempre. */
const LIBROS = [
  'Geneza', 'Exodul', 'Leviticul', 'Numeri', 'Deuteronomul', 'Iosua', 'Judecători', 'Rut',
  '1 Samuel', '2 Samuel', '1 Împăraţi', '2 Împăraţi', '1 Cronici', '2 Cronici', 'Ezra',
  'Neemia', 'Estera', 'Iov', 'Psalmii', 'Proverbe', 'Eclesiastul', 'Cântarea Cântărilor',
  'Isaia', 'Ieremia', 'Plângerile lui Ieremia', 'Ezechiel', 'Daniel', 'Osea', 'Ioel', 'Amos',
  'Obadia', 'Iona', 'Mica', 'Naum', 'Habacuc', 'Ţefania', 'Hagai', 'Zaharia', 'Maleahi',
  'Matei', 'Marcu', 'Luca', 'Ioan', 'Faptele Apostolilor', 'Romani', '1 Corinteni',
  '2 Corinteni', 'Galateni', 'Efeseni', 'Filipeni', 'Coloseni', '1 Tesaloniceni',
  '2 Tesaloniceni', '1 Timotei', '2 Timotei', 'Tit', 'Filimon', 'Evrei', 'Iacov', '1 Petru',
  '2 Petru', '1 Ioan', '2 Ioan', '3 Ioan', 'Iuda', 'Apocalipsa',
];

function referenciaDe(sermon) {
  const libro = LIBROS[sermon.book] || '';
  if (!libro || !sermon.chapter) return '';
  const fin = sermon.verseEnd && sermon.verseEnd !== sermon.verseStart ? `-${sermon.verseEnd}` : '';
  return `${libro} ${sermon.chapter}:${sermon.verseStart}${fin}`;
}

function buildHtml({ sermon, canonicalUrl, redirectPath }) {
  const referencia = referenciaDe(sermon);
  const title = `${sermon.title}${referencia ? ` — ${referencia}` : ''} | RoBible`;
  // La idea central es lo que mejor describe una predicación; si no la hay, el
  // principio de la introducción. Nunca el título repetido, que no aporta nada.
  const description = sinMarcas(sermon.idea || sermon.intro || `Predică din ${referencia}`)
    .trim()
    .slice(0, 155);

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const ogImage = `${SITE_URL}/assets/img/logo.png`;

  // Datos estructurados: le dicen al buscador que esto es un artículo con su
  // fecha, no una página cualquiera de la aplicación.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: sermon.title,
    description,
    datePublished: sermon.publishedAt || undefined,
    url: canonicalUrl,
    isPartOf: { '@type': 'WebSite', name: 'RoBible', url: SITE_URL },
    about: referencia ? { '@type': 'Thing', name: referencia } : undefined,
  };

  return `<!doctype html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow" />
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
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <script>window.location.replace(${JSON.stringify(redirectPath)});</script>
  </head>
  <body>
    <!-- El buscador que no ejecuta JavaScript se queda con esto, así que lleva
         el texto de verdad y no sólo un enlace. -->
    <article>
      <h1>${escapeHtml(sermon.title)}</h1>
      ${referencia ? `<p>${escapeHtml(referencia)}</p>` : ''}
      ${sermon.idea ? `<p>${escapeHtml(sinMarcas(sermon.idea))}</p>` : ''}
      ${sermon.transition ? `<p>${escapeHtml(sinMarcas(sermon.transition))}</p>` : ''}
      ${(sermon.points || [])
        .map((p, i) => {
          // Punto y, debajo, sus subpuntos numerados. El subpunto viaja como
          // `{ title, text }` desde que tiene desarrollo propio, pero las
          // predicaciones servidas por un worker anterior lo mandan como cadena
          // suelta: se aceptan las dos formas, igual que en PublicSermon.svelte.
          const subs = (p.subpoints || [])
            .map((s, j) => {
              const titulo = typeof s === 'string' ? s : s?.title || '';
              return titulo ? `<h3>${i + 1}.${j + 1} ${escapeHtml(sinMarcas(titulo))}</h3>` : '';
            })
            .filter(Boolean)
            .join('\n      ');
          return `<h2>${escapeHtml(sinMarcas(p.title || ''))}</h2>${subs ? `\n      ${subs}` : ''}`;
        })
        .join('\n      ')}
      <p><a href="${escapeHtml(redirectPath)}">${safeTitle}</a></p>
    </article>
  </body>
</html>`;
}

export async function handler(event) {
  const slug = getSlug(event);

  if (!isValidSlug(slug)) {
    return { statusCode: 404, body: 'Sermon not found' };
  }

  try {
    const res = await fetch(`${API_URL}/api/public/sermons/${encodeURIComponent(slug)}`);

    if (!res.ok) {
      // Retirada o inexistente: se deja pasar a la SPA, que enseña su propio
      // mensaje de "esta predicación no existe".
      return {
        statusCode: 302,
        headers: { Location: `/predica/${encodeURIComponent(slug)}?app=1` },
        body: '',
      };
    }

    const data = await res.json();
    const sermon = data?.sermon;

    if (!sermon?.title) {
      return { statusCode: 404, body: 'Sermon not found' };
    }

    const canonicalUrl = `${SITE_URL}/predica/${encodeURIComponent(slug)}`;

    return {
      statusCode: 200,
      headers: {
        // Más largo que el de los temas: una predicación publicada ya no se
        // toca casi nunca, mientras que a un tema se le añaden versículos.
        'Cache-Control': 'public, max-age=1800',
        'Content-Type': 'text/html; charset=utf-8',
      },
      body: buildHtml({
        sermon,
        canonicalUrl,
        redirectPath: `/predica/${encodeURIComponent(slug)}?app=1`,
      }),
    };
  } catch {
    // Si el worker no responde, la SPA se apaña: pedirle al visitante que
    // vuelva más tarde sería peor que enseñarle la aplicación.
    return {
      statusCode: 302,
      headers: { Location: `/predica/${encodeURIComponent(slug)}?app=1` },
      body: '',
    };
  }
}
