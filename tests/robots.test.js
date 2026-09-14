// Qué puede rastrear cada bot.
//
// Este fichero se prueba porque ya falló en silencio y salió caro. Tenía al
// final un grupo:
//
//     User-agent: Googlebot
//     Allow: /
//
// que parecía una cortesía y era lo contrario: un rastreador obedece UN SOLO
// grupo —el más específico que le aplique— e ignora el resto, así que ese
// `Allow: /` anulaba para Googlebot todos los `Disallow` del grupo `*`,
// incluido `/data/`, donde vive una Biblia de 4,3 MB por versión. Nada avisa de
// esto: el sitio funciona igual y la factura sube.
//
// El matcher de abajo implementa las reglas de robots.txt tal como las aplican
// Google y Bing: comodín `*`, ancla `$`, gana la regla cuyo patrón coincide y
// es más largo, y en empate gana `Allow`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const TEXTO = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');

/** Parsea el fichero a `{ <user-agent en minúsculas>: [{ tipo, patron }] }`. */
function parsear(texto) {
  const grupos = {};
  let agentesActuales = [];
  // Un grupo son varias líneas `User-agent` seguidas y luego sus reglas. En
  // cuanto aparece una regla, el siguiente `User-agent` empieza un grupo nuevo.
  let esperandoReglas = false;

  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.replace(/#.*$/, '').trim();
    if (!limpia) continue;
    const [campoCrudo, ...resto] = limpia.split(':');
    const campo = campoCrudo.trim().toLowerCase();
    const valor = resto.join(':').trim();
    if (!valor) continue;

    if (campo === 'user-agent') {
      if (esperandoReglas) {
        agentesActuales = [];
        esperandoReglas = false;
      }
      const agente = valor.toLowerCase();
      agentesActuales.push(agente);
      grupos[agente] ||= [];
    } else if (campo === 'allow' || campo === 'disallow') {
      esperandoReglas = true;
      for (const agente of agentesActuales) {
        grupos[agente].push({ tipo: campo, patron: valor });
      }
    }
  }
  return grupos;
}

const GRUPOS = parsear(TEXTO);

/** ¿Casa el patrón de robots con la ruta? `*` es cualquier cosa, `$` es fin. */
function casa(patron, ruta) {
  const anclado = patron.endsWith('$');
  const cuerpo = anclado ? patron.slice(0, -1) : patron;
  const regex = new RegExp(
    '^' + cuerpo.split('*').map((t) => t.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anclado ? '$' : ''),
  );
  return regex.test(ruta);
}

/**
 * ¿Puede este bot pedir esta ruta? Elige el grupo más específico que le aplique
 * —igual que hace el rastreador de verdad— y dentro de él la regla más larga.
 */
function puedeRastrear(agente, ruta) {
  const clave = agente.toLowerCase();
  const reglas = GRUPOS[clave] || GRUPOS['*'] || [];
  let mejor = null;
  for (const regla of reglas) {
    if (!casa(regla.patron, ruta)) continue;
    if (
      !mejor ||
      regla.patron.length > mejor.patron.length ||
      (regla.patron.length === mejor.patron.length && regla.tipo === 'allow')
    ) {
      mejor = regla;
    }
  }
  return !mejor || mejor.tipo === 'allow';
}

// ── El fallo que costó el ancho de banda ────────────────────────────────────

test('un grupo propio de un bot repite sus Disallow, no sólo un Allow', () => {
  // El síntoma de la regresión: un grupo con `Allow: /` y nada más. Si alguien
  // vuelve a escribirlo, ese bot queda sin ninguna restricción y no se nota
  // hasta que llega la factura.
  for (const agente of ['googlebot', 'bingbot']) {
    const reglas = GRUPOS[agente];
    assert.ok(reglas?.length, `debería existir un grupo para ${agente}`);
    const prohibiciones = reglas.filter((r) => r.tipo === 'disallow');
    assert.ok(
      prohibiciones.length >= 4,
      `el grupo de ${agente} tiene ${prohibiciones.length} Disallow: al tener grupo propio, `
      + 'ignora por completo el de `*`, así que lo que no se le repita aquí no se le aplica',
    );
  }
});

test('los versículos sueltos están cerrados para todos los rastreadores', () => {
  // 124.400 URLs (31.100 × 4 versiones), cada una mandando a la aplicación
  // completa, que se descarga la Biblia entera para pintar una frase.
  const versiculos = [
    '/biblia/vdc/geneza/1/1',
    '/biblia/rvl/ioan/3/16',
    '/biblia/en_kjv/psalms/119/105',
    '/biblia/zh_cuv/matei/5/3',
  ];
  for (const agente of ['*', 'googlebot', 'bingbot']) {
    for (const ruta of versiculos) {
      assert.equal(puedeRastrear(agente, ruta), false, `${agente} no debería poder pedir ${ruta}`);
    }
  }
});

test('los capítulos SIGUEN abiertos: son el contenido real del sitio', () => {
  // El patrón `/biblia/*/*/*/*` exige cuatro segmentos. Si alguien lo cambia a
  // `/biblia/*` para «asegurarse», se lleva por delante las 4.756 URLs del
  // sitemap y con ellas todo el posicionamiento.
  const capitulos = [
    '/biblia/vdc/geneza/1',
    '/biblia/rvl/ioan/3',
    '/biblia/en_kjv/psalms/119',
    '/biblia/vdc/apocalipsa/22',
  ];
  for (const agente of ['*', 'googlebot', 'bingbot']) {
    for (const ruta of capitulos) {
      assert.equal(puedeRastrear(agente, ruta), true, `${agente} debería poder pedir ${ruta}`);
    }
  }
});

test('Google puede renderizar: necesita el CSS y el JavaScript', () => {
  // Las páginas de capítulo las pinta la aplicación, no una función de Netlify.
  // Si se le bloquea `/assets/`, Googlebot ve una página en blanco y deja de
  // posicionar lo único que de verdad interesa posicionar.
  assert.equal(puedeRastrear('googlebot', '/assets/index-abc123.js'), true);
  assert.equal(puedeRastrear('googlebot', '/assets/index-abc123.css'), true);
});

test('las Biblias en crudo están cerradas a todos MENOS a Google y Bing', () => {
  // La excepción es deliberada y cuesta explicarla, así que va en un test: el
  // texto de un capítulo lo pinta la aplicación desde `bible.json`, de modo que
  // un Googlebot sin acceso a ese fichero ve una página en blanco y deja de
  // posicionar las 4.756 URLs del sitemap. El ahorro nunca estuvo en cerrarle
  // los datos, sino en no hacerle repetir ese render 124.400 veces.
  assert.equal(puedeRastrear('*', '/data/vdc/bible.json'), false);
  assert.equal(puedeRastrear('*', '/data/rvl/bible.json'), false);

  for (const agente of ['googlebot', 'bingbot']) {
    assert.equal(puedeRastrear(agente, '/data/vdc/bible.json'), true, agente);
    assert.equal(puedeRastrear(agente, '/data/vdc/bible.map.json'), true, agente);
  }
});

test('las páginas públicas que se quieren posicionar siguen abiertas', () => {
  const publicas = [
    '/', '/predici', '/predica/una-predica-abc1', '/teme', '/versete/dragoste', '/landing',
    // La presentación del Modo Proyección. Va aquí porque el patrón que la
    // podría romper es fácil de escribir sin querer: un `Disallow: /proiectie`
    // sin ancla se llevaría también `/proiectie-biserici`, que es la página con
    // la que se quiere aparecer en el buscador.
    '/proiectie-biserici',
  ];
  for (const ruta of publicas) {
    assert.equal(puedeRastrear('googlebot', ruta), true, `Googlebot debería poder pedir ${ruta}`);
  }
});

test('lo privado y las funciones están cerrados', () => {
  for (const ruta of ['/admin', '/profil', '/predicile-mele', '/.netlify/functions/og-image', '/api/notes']) {
    assert.equal(puedeRastrear('googlebot', ruta), false, `no debería poder pedir ${ruta}`);
    assert.equal(puedeRastrear('*', ruta), false, `no debería poder pedir ${ruta}`);
  }
});

test('los rastreadores de modelos de lenguaje están fuera del todo', () => {
  for (const agente of ['gptbot', 'claudebot', 'ccbot', 'bytespider', 'perplexitybot', 'google-extended']) {
    assert.equal(puedeRastrear(agente, '/'), false, `${agente} debería estar bloqueado en la raíz`);
    assert.equal(puedeRastrear(agente, '/biblia/vdc/geneza/1'), false, `${agente} en un capítulo`);
  }
});

test('el sitemap sigue anunciado', () => {
  assert.match(TEXTO, /^Sitemap:\s*https:\/\/robible\.com\/sitemap\.xml$/m);
});
