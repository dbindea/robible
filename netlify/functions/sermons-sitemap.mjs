/**
 * Sitemap de las predicaciones publicadas (`/sitemaps/sermons.xml`).
 *
 * Se genera al vuelo y no en el build a propósito: una predicación se publica
 * cuando su autor termina de prepararla, no cuando se despliega el sitio. Con
 * un sitemap estático, todo lo publicado entre dos despliegues tardaría en
 * aparecer en los buscadores — y en un sitio que quiere funcionar como blog de
 * predicaciones, eso es justo lo que no puede pasar.
 *
 * El resto de sitemaps sí son estáticos porque su contenido —libros, capítulos,
 * temas curados— sólo cambia al desplegar.
 */

const SITE_URL = 'https://robible.com';
const API_URL = 'https://robible-api.robible.workers.dev';

const escapar = (v = '') =>
  String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const vacio = () =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>';

export async function handler() {
  try {
    const res = await fetch(`${API_URL}/api/public/sermons`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const sermones = data?.sermons || [];

    const urls = sermones
      .filter((s) => s.slug)
      .map((s) => {
        const loc = `${SITE_URL}/predica/${encodeURIComponent(s.slug)}`;
        // `lastmod` sale de la fecha de publicación, que el servidor pone una
        // sola vez. Si faltara, se omite: una fecha inventada es peor que
        // ninguna, porque el buscador la usa para decidir cuándo volver.
        const fecha = s.publishedAt ? String(s.publishedAt).slice(0, 10) : '';
        return (
          '  <url>\n' +
          `    <loc>${escapar(loc)}</loc>\n` +
          (fecha ? `    <lastmod>${escapar(fecha)}</lastmod>\n` : '') +
          '    <changefreq>monthly</changefreq>\n' +
          '    <priority>0.7</priority>\n' +
          '  </url>'
        );
      });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // Una hora: suficiente para no castigar al worker y poco para que una
        // predicación nueva no espere al siguiente despliegue.
        'Cache-Control': 'public, max-age=3600',
      },
      body:
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        `${urls.join('\n')}\n` +
        '</urlset>',
    };
  } catch {
    // Si el worker no responde se devuelve un sitemap vacío y válido. Un 500
    // aquí haría que el buscador marcara el sitemap como roto.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      body: vacio(),
    };
  }
}
