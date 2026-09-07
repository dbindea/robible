// Genera `src/components/Icon.svelte` a partir de los SVG de Phosphor.
//
// Por qué un generador y no una dependencia: RoBible no lleva librerías en
// tiempo de ejecución (ver CLAUDE.md). Los trazos se copian una vez al árbol,
// con su licencia, y a partir de ahí no hay paquete que actualizar ni bundle
// que vigilar. Para añadir un icono: descarga @phosphor-icons/core en
// `.tmp-icons/`, añade su nombre a ICONOS y vuelve a ejecutar esto.
//
//   cd .tmp-icons && npm pack @phosphor-icons/core && tar -xzf phosphor-icons-core-*.tgz
//   node scripts/build-icons.mjs
//
// Phosphor Icons — MIT © 2023 Phosphor Icons. Ver public/data/CREDITS.md.

import fs from 'node:fs';
import path from 'node:path';

const ORIGEN = path.join('.tmp-icons', 'package', 'assets');
const DESTINO = path.join('src', 'components', 'Icon.svelte');

// Nombre en RoBible → nombre en Phosphor.
//
// Los nombres de la izquierda son los que se escriben en las plantillas, así
// que describen para qué sirve el icono aquí, no cómo se llama en el catálogo.
// Las catorce claves de tema (cross…peace) NO se pueden renombrar: están
// guardadas en la columna `icon` de la tabla `topics` en D1.
const ICONOS = {
  // ── Claves de tema (persistidas en D1: no tocar) ──
  cross: 'cross',
  heart: 'heart',
  bookmark: 'bookmark-simple',
  sun: 'sun',
  moon: 'moon',
  shield: 'shield',
  crown: 'crown-simple',
  // Phosphor no tiene "dove"; `bird` es el más cercano y mantiene el registro.
  dove: 'bird',
  hands: 'hands-praying',
  flame: 'flame',
  water: 'drop',
  home: 'house',
  // Antes `light` dibujaba exactamente el mismo sol que `sun`: dos claves
  // distintas para el mismo icono. Aquí ya se distinguen.
  light: 'lightbulb',
  peace: 'peace',
  star: 'star',

  // ── Interfaz ──
  copy: 'copy',
  compare: 'columns',
  close: 'x',
  check: 'check',
  trash: 'trash',
  pencil: 'pencil-simple',
  note: 'note-pencil',
  share: 'share-network',
  search: 'magnifying-glass',
  external: 'arrow-square-out',
  swap: 'swap',
  // Subrayado del versículo: la paleta de colores del usuario.
  palette: 'palette',
  highlight: 'highlighter-circle',
  'arrow-right': 'arrow-right',
  'chevron-up': 'caret-up',
  expand: 'corners-out',
  collapse: 'corners-in',
  globe: 'globe',
  lock: 'lock-simple',
  'sign-in': 'sign-in',
  'file-text': 'file-text',
  book: 'book',
  'book-open': 'book-open',
  lectern: 'lectern',
  music: 'music-notes',
  play: 'play',
  pause: 'pause',
  stop: 'stop',
  user: 'user',
  users: 'users',
};

// Sólo estos llevan versión rellena: son los que tienen estado marcado o
// seleccionado. Generar `fill` para los treinta y tantos duplicaría el archivo
// para nada.
const CON_RELLENO = new Set([
  'heart', 'bookmark', 'star', 'note', 'cross', 'sun', 'moon', 'shield', 'crown',
  'dove', 'hands', 'flame', 'water', 'home', 'light', 'peace', 'play', 'pause', 'stop',
]);

const contenido = (peso, nombre) => {
  const sufijo = peso === 'regular' ? '' : `-${peso}`;
  const f = path.join(ORIGEN, peso, `${nombre}${sufijo}.svg`);
  if (!fs.existsSync(f)) throw new Error(`No existe ${f}`);
  const svg = fs.readFileSync(f, 'utf8');
  const dentro = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  // Los SVG de origen ponen fill="currentColor" en el <svg>; aquí lo pone el
  // componente, así que sobra en cada <path>.
  return dentro.replace(/\s*fill="currentColor"/g, '').trim();
};

const lineas = [];
for (const [clave, nombre] of Object.entries(ICONOS)) {
  const reg = contenido('regular', nombre);
  const fil = CON_RELLENO.has(clave) ? contenido('fill', nombre) : null;
  lineas.push(
    `  '${clave}': {\n    regular: \`${reg}\`,${fil ? `\n    fill: \`${fil}\`,` : ''}\n  },`,
  );
}

const salida = `<script>
  /**
   * Icono.
   *
   * Trazos de Phosphor Icons (MIT), copiados al árbol por \`scripts/build-icons.mjs\`.
   * No hay dependencia en tiempo de ejecución: sólo estos trazos, que no cambian.
   *
   * Uso:
   *   <Icon name="heart" />
   *   <Icon name="heart" weight="fill" />          ← estado marcado
   *   <Icon name="bookmark" size="1.2rem" />
   *
   * El peso \`fill\` es el patrón de iOS: mismo dibujo en contorno cuando la
   * acción está inactiva y relleno cuando está activa. Sustituye al truco de
   * \`getFilledTopicIconSvg\`, que quitaba \`fill="none"\` de una cadena a mano.
   * Sólo los iconos con estado tienen relleno; el resto cae en \`regular\`.
   *
   * El viewBox es 0 0 256 256 —el de Phosphor— y no 0 0 24 24. Los tamaños se
   * siguen fijando desde CSS con \`width\`/\`height\`, así que ningún estilo
   * existente cambia por esto.
   */
  export let name;
  /** 'regular' | 'fill' */
  export let weight = 'regular';
  /** Cualquier medida CSS. Por defecto hereda el tamaño de la fuente. */
  export let size = '1em';

  const PATHS = ${'{'}
${lineas.join('\n')}
  ${'}'};

  // Si el nombre no existe se dibuja el marcador: un hueco vacío en la interfaz
  // es más difícil de detectar que un icono equivocado.
  $: icono = PATHS[name] || PATHS.bookmark;
  $: trazos = icono[weight] || icono.regular;
</script>

<svg
  viewBox="0 0 256 256"
  fill="currentColor"
  width={size}
  height={size}
  aria-hidden="true"
  focusable="false"
>
  {@html trazos}
</svg>

<style>
  svg {
    display: block;
    flex-shrink: 0;
  }
</style>
`;

fs.writeFileSync(DESTINO, salida);
console.log(`${DESTINO}: ${Object.keys(ICONOS).length} iconos, ${CON_RELLENO.size} con relleno`);
