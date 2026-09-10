/**
 * Portada de predicaciones (`/predici`) para quien no ejecuta JavaScript.
 *
 * Por qué existe: `/predici` es la página con la que se quiere aparecer al
 * buscar «predică expozitivă» o «cum să fac o predică expozitivă». La aplicación
 * pinta ese contenido, pero lo pinta el navegador; un rastreador que no ejecute
 * JS —o que lo ejecute tarde— vería el `index.html` genérico. Aquí sale ya
 * escrito: título, descripción, los siete pasos del método y las predicaciones
 * publicadas, más los datos estructurados de tipo HowTo.
 *
 * Mismo par de reglas y mismo truco del `?app=1` que `/tema` y `/predica`: la
 * ruta canónica es ésta, así que redirigir aquí sería un bucle.
 *
 * Los textos van en rumano y no traducidos: es el idioma por defecto del sitio
 * y el de las búsquedas que se persiguen. La aplicación, al montar, reemplaza
 * todo esto por la versión en el idioma del visitante.
 */

const SITE_URL = 'https://robible.com';
const API_URL = 'https://robible-api.robible.workers.dev';

const escapeHtml = (v = '') =>
  String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const TITULO = 'Predici expozitive — exemple și unealtă de pregătire | RoBible';
const DESCRIPCION =
  'Predici expozitive, tematice și textuale publicate de predicatori. Vezi cum se face o predică expozitivă, pas cu pas, și pregătește-o în RoBible.';

/**
 * Los siete pasos, copiados de `app.homiletics.*` en rumano.
 *
 * Se duplican a propósito: esto es una función de Netlify y no puede importar
 * del bundle ni leer `public/lang/ro.json` sin empaquetarlo. Si cambian los
 * textos del guía, conviene repasar éstos — pero desincronizarse aquí sólo
 * afecta a lo que ve el rastreador, no a lo que lee el usuario.
 */
const PASOS = [
  ['Text', 'Predica expozitivă expune învățătura acestui text. Tot ce vei spune trebuie să iasă de aici, nu din ce ai vrea tu să spui.'],
  ['Observare', 'Cuvintele cheie se recunosc după trei semne: se repetă în text, sunt explicate chiar de scriitorul biblic, sau sunt importante în desfășurarea acțiunii ori a argumentației.'],
  ['Context', 'Un text scos din context ajunge pretext. Contextul îți arată ce a vrut să spună autorul, nu ce ne-ar conveni nouă să spună.'],
  ['Idee', 'Aici se decide predica, și se ajunge în trei pași: ce a spus textul atunci, ce vrea Dumnezeu să schimbe acum și cum se spune asta astăzi.'],
  ['Structură', 'Diviziunile argumentează, explică sau aplică ideea omiletică. Se obțin punând o întrebare analitică ideii omiletice: De ce? Cum? Când? Cu ce condiții? Ce înseamnă? Tot aici se scrie propoziția de tranziție: numărul diviziunilor, cuvântul cheie la plural și întrebarea analitică — fraza care duce de la introducere la primul punct.'],
  ['Dezvoltare', 'Fiecare diviziune se dezvoltă prin trei secțiuni: explicarea și aplicarea sunt obligatorii, ilustrarea este opțională.'],
  ['Finalizare', 'Introducerea se scrie la sfârșit, pentru că abia acum știi unde duci predica.'],
];

const NOMBRES_LIBROS = [
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

const referenciaDe = (s) => {
  const libro = NOMBRES_LIBROS[s.book];
  if (!libro || !s.chapter) return '';
  const fin = s.verseEnd && s.verseEnd !== s.verseStart ? `-${s.verseEnd}` : '';
  return `${libro} ${s.chapter}:${s.verseStart}${fin}`;
};

export async function handler() {
  let sermones = [];
  try {
    const res = await fetch(`${API_URL}/api/public/sermons`);
    if (res.ok) sermones = (await res.json())?.sermons || [];
  } catch {
    // Sin la lista la página sigue teniendo el método, que es el contenido
    // por el que se quiere posicionar. Un 500 aquí sería mucho peor.
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Predici',
        description: DESCRIPCION,
        url: `${SITE_URL}/predici`,
        inLanguage: 'ro',
      },
      {
        '@type': 'HowTo',
        name: 'Cum se face o predică expozitivă',
        description:
          'Șapte pași. Îi parcurgi în RoBible cu ghid de omiletică la fiecare, iar la final ai predica și schița pentru amvon.',
        totalTime: 'PT3H',
        step: PASOS.map(([nombre, texto], i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: nombre,
          text: texto,
        })),
      },
    ],
  };

  const listaHtml = sermones
    .filter((s) => s.slug && s.title)
    .slice(0, 60)
    .map((s) => {
      const ref = referenciaDe(s);
      return (
        '<li>' +
        `<a href="/predica/${encodeURIComponent(s.slug)}">${escapeHtml(s.title)}</a>` +
        (ref ? ` — ${escapeHtml(ref)}` : '') +
        (s.series ? ` (${escapeHtml(s.series)})` : '') +
        '</li>'
      );
    })
    .join('\n      ');

  const pasosHtml = PASOS.map(
    ([nombre, texto], i) => `<li><h3>${i + 1}. ${escapeHtml(nombre)}</h3><p>${escapeHtml(texto)}</p></li>`,
  ).join('\n        ');

  const body = `<!doctype html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#3f5867" />
    <title>${escapeHtml(TITULO)}</title>
    <meta name="description" content="${escapeHtml(DESCRIPCION)}" />
    <link rel="canonical" href="${SITE_URL}/predici" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="RoBible" />
    <meta property="og:title" content="${escapeHtml(TITULO)}" />
    <meta property="og:description" content="${escapeHtml(DESCRIPCION)}" />
    <meta property="og:url" content="${SITE_URL}/predici" />
    <meta property="og:image" content="${SITE_URL}/assets/img/logo.png" />
    <meta name="twitter:card" content="summary" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <script>window.location.replace('/predici?app=1');</script>
  </head>
  <body>
    <main>
      <h1>Predici expozitive, tematice și textuale</h1>
      <p>${escapeHtml(DESCRIPCION)}</p>

      <h2>Cum se face o predică expozitivă</h2>
      <ol>
        ${pasosHtml}
      </ol>

      <h2>Predici publicate</h2>
      <ul>
      ${listaHtml || '<li>Încă nu a fost publicată nicio predică.</li>'}
      </ul>

      <p><a href="/predici?app=1">Deschide RoBible</a></p>
    </main>
  </body>
</html>`;

  return {
    statusCode: 200,
    headers: {
      // Media hora: se publican predicaciones entre despliegues, pero tampoco
      // tan a menudo como para no cachear nada.
      'Cache-Control': 'public, max-age=1800',
      'Content-Type': 'text/html; charset=utf-8',
    },
    body,
  };
}
