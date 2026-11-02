#!/usr/bin/env node
/**
 * Genera `src/services/pdf-font.js`: la serif con la que se imprime la schiță.
 *
 *     node scripts/build-pdf-font.mjs
 *
 * Se ejecuta a mano y muy de tarde en tarde — sólo si hace falta otro corte o
 * cubrir caracteres nuevos. El resultado se commitea, como el `Icon.svelte` de
 * `build-icons.mjs`: en tiempo de ejecución no hay ninguna descarga.
 *
 * ── Por qué Tinos y no Times New Roman ───────────────────────────────────────
 *
 * El propietario pidió Times New Roman. Times New Roman es de Monotype y no se
 * puede empotrar en una aplicación web. Tinos (SIL OFL 1.1) es su gemela de
 * licencia abierta: **misma métrica**, mismo dibujo, hecha justo para esto.
 *
 * ── Por qué no las fuentes estándar del PDF ──────────────────────────────────
 *
 * El formato PDF trae catorce fuentes de serie, Times-Roman entre ellas, y
 * salen gratis: no hay que empotrar ni un byte. No valen, y conviene saber por
 * qué antes de volver a intentarlo: van en WinAnsi (CP1252), que tiene â e î
 * pero NO tiene ă, ș ni ț. En rumano eso no es un detalle.
 *
 * ── Por qué WOFF y no WOFF2 ──────────────────────────────────────────────────
 *
 * El woff2 lleva la tabla `glyf` *transformada*. fontkit la abre, pero cuando
 * pdfkit va a empotrarla tiene que volver a subsetearla, y ahí revienta con
 * «Offset is outside the bounds of the DataView». El WOFF es el mismo sfnt
 * comprimido con zlib, sin transformar, y pasa sin problema. Lo pide el
 * `User-Agent` antiguo de aquí abajo: a un navegador moderno Google le sirve
 * woff2 y a IE 11, WOFF.
 *
 * ── Por qué se le pide a Google y no se recorta aquí ─────────────────────────
 *
 * Tinos entera son 2,2 MB las cuatro variantes. La API de Google Fonts acepta
 * `text=` y devuelve la fuente recortada a EXACTAMENTE esos caracteres: 85 KB
 * las cuatro. Recortarla aquí haría falta `fonttools` (no hay Python) o
 * `fontkit` (su subconjunto se queda sin `cmap`, porque está pensado para que
 * la codificación la escriba pdfkit, no para producir una fuente suelta).
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'src/services/pdf-font.js');

// IE 11. Con un User-Agent moderno Google devuelve woff2, que no sirve.
const UA = 'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko';

/**
 * Todo lo que puede llegar a imprimirse. Un carácter que no esté aquí sale
 * como un hueco en el papel, así que se peca de largo: cuesta ~50 bytes.
 */
const juegoDeCaracteres = () => {
  let j = '';
  for (let c = 0x20; c <= 0x7e; c++) j += String.fromCharCode(c); // ASCII imprimible
  for (let c = 0xa0; c <= 0xff; c++) j += String.fromCharCode(c); // Latin-1: español, francés
  j += 'ăâîșțĂÂÎȘȚ'; // rumano, forma correcta (coma debajo)
  j += 'şţŞŢ'; // rumano heredado (cedilla): sale de textos viejos pegados
  j += 'őűŐŰčšžČŠŽłŁđĐ'; // vecinos que aparecen en nombres propios
  j += '«»“”‘’‚„'; // comillas de los cuatro idiomas
  j += '…—–·•†‡‰'; // puntuación tipográfica
  return [...new Set([...j])].join('');
};

const variantes = [
  { clave: 'normal', peso: 400, cursiva: false },
  { clave: 'bold', peso: 700, cursiva: false },
  { clave: 'italics', peso: 400, cursiva: true },
  { clave: 'bolditalics', peso: 700, cursiva: true },
];

const caras = async (texto) => {
  const url = 'https://fonts.googleapis.com/css?family=Tinos:400,400i,700,700i' + `&text=${encodeURIComponent(texto)}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Google Fonts respondió ${r.status}`);
  const css = await r.text();

  const encontradas = [];
  for (const bloque of css.split('@font-face').slice(1)) {
    const u = bloque.match(/url\((https:[^)]+)\)/)?.[1];
    if (!u) continue;
    encontradas.push({
      url: u,
      peso: /font-weight:\s*700/.test(bloque) ? 700 : 400,
      cursiva: /font-style:\s*italic/.test(bloque),
      formato: bloque.match(/format\('([^']+)'\)/)?.[1] || '?',
    });
  }
  return encontradas;
};

const texto = juegoDeCaracteres();
console.log(`Caracteres pedidos: ${texto.length}`);

const encontradas = await caras(texto);
const formatos = [...new Set(encontradas.map((c) => c.formato))];
if (formatos.some((f) => f !== 'woff')) {
  throw new Error(`Google ha devuelto ${formatos.join('/')} y hace falta woff — ver la cabecera de este archivo`);
}

const datos = {};
let total = 0;
for (const v of variantes) {
  const cara = encontradas.find((c) => c.peso === v.peso && c.cursiva === v.cursiva);
  if (!cara) throw new Error(`Falta la variante ${v.clave}`);
  const buf = Buffer.from(await (await fetch(cara.url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  datos[v.clave] = buf.toString('base64');
  total += buf.length;
  console.log(`  ${v.clave.padEnd(12)} ${Math.round(buf.length / 1024)} KB`);
}

const salida = `// GENERADO por scripts/build-pdf-font.mjs — no editar a mano.
//
// Tinos (SIL OFL 1.1), recortada a los caracteres que imprime la aplicación.
// Es la gemela libre de Times New Roman: misma métrica, mismo dibujo. Se usa
// en el PDF de la schiță, que se lee desde el atril.
//
// Va en base64 y no como ficheros en \`public/\` para que la schiță se pueda
// imprimir SIN RED: este módulo se importa dinámicamente dentro de \`cargar()\`
// de sermon-pdf.service.js, así que no entra en el bundle principal, pero una
// vez cargada la aplicación ya no hace falta pedir nada.
//
// Atribución en public/data/CREDITS.md. ${Math.round(total / 1024)} KB las cuatro variantes.
export const TINOS = {
${variantes.map((v) => `  ${v.clave}: '${datos[v.clave]}',`).join('\n')}
};
`;

writeFileSync(DESTINO, salida);
console.log(`\n${DESTINO} · ${Math.round(salida.length / 1024)} KB`);
