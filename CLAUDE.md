# CLAUDE.md — Manual operativo de RoBible

> Guía para agentes que trabajan en este repo. Léela antes de tocar nada.
> Documentación ampliada en [docs/](docs/). Estado y pendientes en [ROADMAP.md](ROADMAP.md).

## Qué es RoBible

PWA de lectura bíblica multiidioma con lectura acompañada de música, comparación de versiones, índice temático, favoritos, notas y modo offline completo. Frontend Svelte 5 + Vite en Netlify; backend Cloudflare Workers + D1.

- Producción: **https://robible.com** (Netlify)
- API: **https://robible-api.robible.workers.dev** (Cloudflare Workers + D1 `robible-db`)
- Repo: `github.com/dbindea/robible` — rama de trabajo `develop`, producción `master`

## Reglas de trabajo

**Git — regla heredada, sigue vigente:**

- El agente **NO** hace `git commit` / `push` / `PR` / `merge` de archivos del frontend. Se dejan los cambios en el working tree y el usuario los revisa y commitea.
- El agente **sí** gestiona: backend (`workers/`), deploys a Cloudflare, queries a D1, scripts de mantenimiento.
- Nunca trabajar directamente sobre `master`. `master` solo recibe merges hechos por el usuario.

**Alcance:** este proyecto está en producción con usuarios reales. Antes de cambiar comportamiento de auth, service worker o datos bíblicos, avisar del impacto.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Vite en `localhost:5173` (`--host 0.0.0.0`, accesible desde el móvil en la misma red) |
| `npm run build` | `vite build` → `dist/` + `scripts/generate-seo.mjs` (páginas SEO estáticas y sitemaps) |
| `npm run preview` | Sirve el build de `dist/` |
| `npm run lint` | ESLint. **Debe salir en 0 errores.** Quedan 12 avisos deliberados (`svelte/require-each-key`, `infinite-reactive-loop`): son señales reales pero no bloqueantes, no las silencies sin mirarlas |
| `npm run format` | Prettier sobre todo el repo |
| `node workers/robible-api/dev-server.js` | Backend local en `127.0.0.1:8787` (emula Workers+D1 con `node:sqlite`) |
| `node scripts/build-logo.js` | Regenera todos los favicons desde el SVG fuente |
| `node scripts/build-bible-data.mjs [ver]` | Descarga y valida los datos de una versión bíblica (ver `public/data/CREDITS.md`) |
| `node scripts/build-daily-verses.mjs` | Regenera `public/data/daily-verses.json` y valida las referencias contra **todas** las versiones instaladas |
| `node scripts/build-icons.mjs` | Regenera `src/components/Icon.svelte` desde los SVG de Phosphor (ver `public/data/CREDITS.md`) |
| `npm test` | Suite con `node --test` (183 tests, sin dependencias). **En Windows el glob es obligatorio**: `node --test tests` a secas intenta cargar el directorio como módulo y falla |

Node ≥ 24.15.0 (ver `.nvmrc`).

## Convenciones a respetar

- **Svelte 5 en sintaxis legacy**: el código usa `export let` y `$:`, no runes (`$state`, `$derived`). No migrar un archivo a runes de paso; si se hace, es una decisión explícita y completa.
- **Comentarios en castellano**, con separadores del estilo `// ── Sección ──────`. Explican el *porqué*, sobre todo en las guardas anti-race. Mantener ese registro.
- **Nada de texto hardcodeado en UI**: todo pasa por `$_('clave.anidada')` y la clave debe existir en los **cuatro** archivos `public/lang/{ro,es,en,zh}.json`.
- **Servicios de datos**: cualquier entidad nueva sigue el patrón API-first con fallback a `localStorage` vía `withFallback()` de [src/services/apiClient.js](src/services/apiClient.js). Ver `favorites.service.js` como referencia canónica (es el más corto).
- **SCSS**: siempre tokens (`var(--color-accent)`, `var(--color-surface)`…) definidos en `public/global.css`, y dark mode con `html[data-theme='dark']`. Nunca colores literales sueltos.
- **Tests**: en `tests/*.test.js`, con el runner de Node (`node:test` + `node:assert/strict`). Nada de frameworks. Solo se prueba lógica pura importable sin navegador; lo que toca `localStorage` se dobla con un stub mínimo (ver `filter.test.js`). Si arreglas un fallo, deja antes el test que lo reproduce.
- **Rutas**: se construyen con `buildBiblePath()` / se leen con `parseBiblePath()` de [src/services/bible-route.service.js](src/services/bible-route.service.js). No parsear `pathname` a mano.

## Trampas del repo

Cosas que rompen si no se saben:
1. **El evento de navegación se llama `robibile:navigate`** — con la errata, `bibile` en vez de `bible`. Está así en 10 sitios. Al escuchar o emitir, hay que escribirlo mal a propósito. Renombrarlo es un cambio atómico o no es.
2. **Tocar `public/sw.js` obliga a bumpear `CACHE_NAME`** (hoy `robible-v27`). Sin bump, los usuarios con la PWA instalada no reciben el cambio. `public/sw.js` es la única fuente de verdad de la versión de cache: no dupliques la constante en otro sitio.
   - Y el bump no basta para que lo vean *ya*: si el usuario tiene un SW controlando la página, el nuevo se queda en `waiting` y [main.js](src/main.js) solo avisa (`robible:pwa-update-available`); es el usuario quien acepta. Purgar Cloudflare no cambia nada, porque el SW responde antes de llegar a la red.
3. **`Cache-Control: immutable` solo vale para URLs con hash en el nombre.** `/assets/*` lo lleva y está bien; `/lang/*.json` lo llevaba y estaba mal — es una URL estable cuyo contenido cambia en cada release, así que los usuarios veían la clave en crudo (`app.share.eyebrow`) en vez del texto. Y hacía más daño de lo que parece: también anulaba el `stale-while-revalidate` del service worker, cuyo fetch de refresco se resolvía contra la caché HTTP sin tocar la red y volvía a guardar los mismos bytes viejos, en bucle cerrado. Por eso ese refresco usa hoy `cache: 'reload'`. Antes de poner `immutable` en algo, pregúntate si la URL cambia de nombre al cambiar el contenido.
4. **Los códigos de versión no describen el texto.** `rvl` **no es Reina-Valera**: es la Biblia en Español Sencillo (CC BY 4.0, atribución pendiente). `vdc` es la Cornilescu *corregida*, no la de 1924. Se mantienen así por decisión del propietario; ver `public/data/CREDITS.md`.
5. **Hay cuatro Biblias y `bible.json` pesa entre 1 y 4 MB cada una.** No cargarlas en scripts ni en el arranque salvo que haga falta. La de comparación es lazy, y el SW solo precachea `vdc` y `rvl` (ver `public/data/CREDITS.md`).
6. **No se generan páginas estáticas por versículo, a propósito.** Las hubo (~31.000 por versión) y se quitaron: `dist` bajó de 628 MB a 83 MB y el build de 4 min a 13 s. Los versículos siguen siendo direccionables — `netlify.toml` enruta `/biblia/:v/:libro/:cap/:versiculo` a la función `verse-meta`, que genera las etiquetas al vuelo. No las reintroduzcas sin medir el coste.
7. **Los slugs de libro admiten cualquier alfabeto.** `slugifyBookName` filtra con `\p{L}\p{N}`, no con `[a-z0-9]`: con lo segundo los nombres chinos se vaciaban enteros y los 66 libros compartían un slug vacío.
8. **`App.svelte` tiene guardas anti-race deliberadas**: `bibleLoadRequestId`, `_localeVersionTag`, `_pendingLocale`. Parecen redundantes y no lo son — evitan que una carga vieja pise a una nueva al cambiar de versión/idioma. No simplificar.
9. **`getBibleVersionConfigOrDefault()` sin argumento devuelve siempre `vdc`**, no la versión activa. Pásale siempre `$selectedBibleVersion`. La única llamada sin argumento legítima es la de `src/config/seo.js:5`, que define a propósito la versión por defecto. Ya provocó un bug real (voz rumana leyendo español), ver auditoría hallazgo 1.
10. **`Result.svelte` tiene 2880 líneas.** Es la vista de lectura y concentra swipe, favoritos, notas, topics, TTS y SEO. Buscar por los marcadores `// === SECCIÓN ===` antes de leerlo entero.
11. **No hay router.** Añadir una ruta implica tocar `Main.svelte` (detección), `bible-versions.js` (el path por idioma), `AppMenu.svelte` (navegación) y `generate-seo.mjs` (sitemap). Excepción deliberada: `/tema/:slug` **no** pasa por `bible-versions.js`. Es un enlace que se reparte por fuera y tiene que abrir igual para quien lo reciba; con un path por idioma el mismo tema tendría varias URLs y el enlace se rompería al cambiar de versión.
12. **La lectura no tiene voz, por decisión de producto**: es música + resaltado visual, y el avance va por temporizador. `TtsPlayer` recibe `playlist` (lo que hay en pantalla), no un capítulo. Todo lo que se llama `tts` —el store, el componente, las claves `app.tts.*` y las de localStorage `robible:tts:*`— es herencia de una versión con `SpeechSynthesis` que se retiró; renombrarlo es un cambio atómico o no es. `tts.service.js` se borró el 5 sep 2026: si buscas la síntesis de voz, está en el historial de git, no en el árbol. No la reconectes sin decisión de producto: la auditoría la levantó como bug y no lo era.
13. **El sistema de diseño vive en `public/global.css`** y es la única fuente de verdad; la landing consume esos mismos tokens. Cuatro capas: escalas crudas (`--grey-*`, `--blue-*`, `--green-*`) → **paleta activa** (`--color-page`, `--color-surface`, `--color-ink`…) → derivados (`--wash-*`, `--color-line*`, que se calculan solos desde `--color-ink` y `--color-accent`) → alias heredados (`--color-blue`, `--color-white`…). **Usa la paleta y los derivados**; los heredados solo existen por los ~500 usos ya escritos.
    - **Hay cinco paletas, no un interruptor**: `html[data-theme]` vale `lumina` | `noapte` | `sepia` | `minimal` | `nocturn`. **Ningún componente lleva reglas por tema.** Si escribes `html[data-theme='…']` en un componente, estás arreglando una paleta y rompiendo las otras cuatro: lo que falta es un token.
    - Los bordes y las veladuras se mezclan **contra la tinta**, no contra el negro ni el blanco: `color-mix(in srgb, var(--color-ink) 14%, transparent)` da el valor correcto en las cinco porque `--color-ink` cambia con la paleta. Por eso `--color-line`, `--wash-hover` y compañía no se redefinen en ningún bloque.
    - **Un token que falta en una paleta no falla: hereda el de LUMINĂ.** El síntoma es un panel blanco en mitad de nocturn, y sólo se ve abriendo la app y cambiando de paleta una a una. `tests/palettes.test.js` compara los cinco bloques y ya cazó dos huecos reales (`--color-accent-ink`) el día que se escribió.
    - `--color-white` **no** sirve como color de texto: significa "fondo de tarjeta" (`--color-surface`). Para texto sobre el acento es `--color-on-primary`. Estaban mezclados en 17 sitios y en oscuro pintaban gris marengo sobre azul.
    - **`@media (prefers-color-scheme: dark)` no vale para nada aquí.** Responde al sistema operativo, no a la paleta que ha elegido el usuario: con el sistema en oscuro y Sepia puesta, la regla se aplica igual. Ya mordió dos veces —el fondo del player en la fase 4 y todo su panel en la 7, donde dejó el desplegable y los botones de velocidad invisibles— porque una limpieza parcial no las cazó todas. Si necesitas distinguir claro de oscuro, es un token.
    - **Un token de borde no es un color de texto.** `--color-line` es una tinta al 14 %; usarlo en `color:` da texto casi transparente. Era lo que dejaba el desplegable del player en blanco.
    - **Ojo con `var(--inexistente, var(--real))`.** Había tres tokens que no existían (`--color-text`, `--color-text-secondary`, `--border-color-dark`) escritos así: siempre caían al fallback, así que el primero era decorado y parecía que había un sistema donde no lo había.
    - **Una superficie que fija su fondo tiene que fijar también su color de texto.** El sidebar pintaba `--color-sidebar` (oscuro en las cinco paletas) y dejaba que el texto heredara la tinta del `body`, que es oscura: los títulos de sección salían casi negros sobre casi negro. Para eso está `--color-on-sidebar`.
    - **El acento tiene dos tokens porque tiene dos trabajos.** `--color-accent` vale para bordes e iconos, donde el mínimo es 3:1. Como **fondo bajo texto** no vale: el azul de la casa da 3.30:1 con blanco y AA pide 4.5:1. Para eso está `--color-accent-solid` (+ `--color-accent-solid-hover`), que es el mismo acento oscurecido lo justo. **Todo `background` de acento que lleve texto encima usa el token de relleno.** Se prefirió esto a oscurecer `--color-accent`, que habría cambiado el azul de RoBible en toda la aplicación.
    - **En las paletas oscuras el acento es claro, así que `--color-on-primary` es oscuro.** Significa exactamente "texto sobre `--color-accent-solid`" y nada más; sobre el chrome del sidebar va `--color-on-sidebar`. Estuvieron mezclados y en Noapte eso daba 2.38:1.
    - `tests/contrast.test.js` calcula el contraste WCAG de 27 pares por paleta. No es cosmético: encontró siete fallos reales en cuatro de las cinco paletas la primera vez que se ejecutó, incluidos dos que venían de antes de que hubiera paletas. **Comprueba que el token sea correcto, no que el componente use el token correcto** — para eso hace falta mirar el DOM renderizado.
    - **`accent-color` no sirve para los `input[type=range]`.** Parece la solución de una línea y Chromium, al fijarlo, pinta la parte sin rellenar de la pista **casi negra**: sobre fondo claro se ve una franja negra a la derecha del pulgar. `global.css` los dibuja a mano; el relleno se pasa en `--range-fill`.
    - **El player publica su altura en `--player-offset`** (medida con `ResizeObserver`, no escrita a mano: la barra crece al abrir el panel). El botón de subir y los de modo lectura la usan para apartarse. Antes había un `bottom: 3.5rem !important` con el valor a ojo que además ganaba a cualquier arreglo posterior.
    - **Abajo del todo hay tres controles fijos** —salir del modo lectura, leer con música y subir— y el pie **reserva su franja** como relleno inferior (`--floating-band` + `--player-offset`). Sin esa reserva, al llegar al final de la página se plantaban encima de «Autentificare» y del selector de paleta, que quedaban intocables. El orden de abajo arriba es: player → flotantes → botones del pie. Si añades otro control fijo abajo, súmalo a la franja.
14. **Colores con significado fijo**: verde = versículo en lectura (`--color-success`) y el botón que lo activa; ámbar = favorito; el color del tema = índice temático; el color elegido = subrayado. Los siete iconos del versículo comparten `.icon-btn` y el estado `.icon-btn--marked`, que solo lee `--marked-color`. Para un icono nuevo, añade un modificador que fije esa variable — no dupliques el bloque de estilos.
15. **La paleta de subrayado se salta la franja verde-turquesa a propósito** (`src/config/highlight-palette.js`). El verde ya significa "versículo en lectura", y el subrayado se pinta como un lavado del fondo al 26 %: a esa intensidad un turquesa y el verde de lectura no se distinguen. Por lo mismo son cinco colores y no seis — en el arco que queda, seis dejaban el amarillo y el naranja a 16°, indistinguibles como lavado. `tests/highlights.test.js` vigila ambas cosas, así que si añades un color y falla, es esto.
16. **El estado de lectura tiene que ganarle al subrayado del usuario.** `.highlight-verse` vive en `global.css` con un solo selector de clase; el scoping de Svelte le añade una clase más a `.verse--user-highlight`, así que sin la regla explícita `.verse--user-highlight:global(.highlight-verse)` de `Result.svelte` el subrayado tapaba el verde de lectura.
17. **La imagen para compartir se genera al cambiar la vista previa, no al pulsar el botón** (`VerseImageModal.svelte`). iOS Safari exige que `navigator.share` salga del gesto del usuario, y un `await canvas.toBlob()` por medio rompe esa condición: la hoja de compartir no llega a abrirse y acaba descargando el PNG.
18. **Diálogos**: usa `src/components/Modal.svelte` (centrado, hoja inferior en móvil, Escape y clic fuera). En móvil la hoja ocupa 92dvh fijos para que el teclado no la encoja al escribir; si el diálogo solo muestra algo corto, pásale `fitContent` o queda medio vacío. No vuelvas a anclar popups al botón con `getBoundingClientRect()`: se recortaban contra el borde en móvil.
19. **En la landing, las clases que añade JS necesitan `:global()`**. Svelte poda como CSS muerto lo que no ve en la plantilla: por eso la animación de aparición (`.is-visible`) nunca funcionó hasta que se envolvió en `:global()`.
20. **Los comentarios XML de los SVG no pueden contener `--`**: `sharp` revienta al leerlos. Por eso los nombres de token en `logo.svg` se escriben `(grey 800)`. Tras tocar un SVG del logo, `node scripts/build-logo.js` y bumpea el SW.
21. **Svelte sólo reacciona a lo que ve escrito en la plantilla.** Envolver una condición en un helper —`{#if isVerseSelected(item.key)}` en lugar de `{#if selectedVerseKey === item.key}`— le esconde la dependencia al compilador y deja de repintar: el estado cambia y la pantalla no. Pasó con la selección de versículo. Es el mismo motivo del `void $topicsStore` que verás en un `{@const}` de `Result.svelte`. Compara contra la variable directamente.
22. **Cuando una acción tiene color propio, ese color sustituye al azul de estado activo; no se mezclan.** Esto costó un bug que sólo se veía en oscuro: `:global(html[data-theme='dark']) .icon-btn` tenía tres clases de especificidad y `.icon-btn--marked` sólo dos, así que el icono marcado perdía su color y volvía al azul mientras el borde sí lo conservaba. Se resolvió con `:not(.icon-btn--marked)` y **hoy el problema ya no existe**: al pasar a cinco paletas desapareció la regla por tema, y sin regla por tema no hay nada que pisar el color de la acción. No la reintroduzcas.
23. **El buscador de referencias acepta prefijos desde 2 letras** (`isPlausiblePrefix`). Antes medía la diferencia de longitud contra el nombre del libro y descartaba todo lo que sobrepasara 4 caracteres, lo que tumbaba las abreviaturas más escritas: `prov`, `deut`, `apoc`, `fapte`… `prov 3 4` no devolvía nada. El umbral está en 2 y no en 1 porque con una sola letra el peor caso ("i") empareja 14 libros. Cubierto en `tests/reference-search.test.js` contra el mapa real.
24. **El store `filter` guarda una copia, no el objeto que le pasas** (`stores.js`). Sidebar hace `bind:value={searchForm.searchText}` sobre su propio objeto y luego lo mete en el store; Result lee `$: searchForm = $filter`. Cuando el store se quedaba con la referencia, los dos componentes compartían el MISMO objeto y teclear en el buscador mutaba el estado de Result por la espalda, sin notificar al store. El síntoma: buscabas por referencia, borrabas con el aspa, escribías otra vez y al pulsar la sugerencia cambiaba la URL pero no el texto. **No devuelvas `filter` a un `writable` pelado.** Cubierto en `tests/filter-store.test.js`.
25. **La respuesta de seguridad se normaliza en un solo sitio** (`normalizeSecurityAnswer` en `workers/robible-api/src/utils.js`). La usan el registro **y** la verificación al recuperar la cuenta. Lo que se guarda es un hash, así que si las dos rutas normalizaran distinto el usuario escribiría la respuesta correcta y no entraría jamás — y no habría forma de diagnosticarlo desde fuera. No dupliques esa lógica ni la cambies en una sola de las dos rutas.
26. **Los iconos son de Phosphor (MIT) y están copiados al árbol, no instalados.** Los trazos viven en `src/components/Icon.svelte`, generado por `scripts/build-icons.mjs`; no hay dependencia en tiempo de ejecución. Para añadir uno, sigue las instrucciones de la cabecera de ese script y de `public/data/CREDITS.md` — **no** metas `<svg>` a mano en un componente, que es de donde venían los 94 sueltos que había.
    - `<Icon name="x" weight="fill" />` es el patrón de iOS: mismo dibujo en contorno cuando la acción está inactiva y macizo cuando está activa. Sustituye a `getFilledTopicIconSvg`, que quitaba `fill="none"` de una cadena con un `replace`.
    - **Las claves de `src/config/topic-icons.js` están guardadas en D1** (columna `icon` de `topics`). Se pueden añadir; renombrar o quitar una deja sin icono a los temas que ya la usaban y no hay forma de recuperarlo.
    - `class:` es una directiva de elemento: sobre `<Icon>` no compila. Si necesitas alternar una clase (girar un chevron, por ejemplo), ponla en un `<span>` envolvente.
    - **El tamaño se fija con `--icon-size` en el contenedor**, no con una regla `.mi-boton svg { width: … }`: el scoping de Svelte le pone al `<svg>` la clase de `Icon.svelte`, así que esa regla no le alcanza. Es un fallo silencioso —el icono simplemente vuelve al tamaño por defecto— y en la migración dejó **17 reglas muertas**; sólo se vio porque el build avisa de selectores sin usar. Ojo también con el `max-width: 100%` que `global.css` da a todo `svg`: recorta el ancho y no el alto, y dentro de un botón estrecho dejaba el icono a 13×16. Por eso `Icon.svelte` lleva `max-width: none`.
    - **`size` es una medida CSS, no un número.** `size="18"` produce `width: 18`, que el navegador descarta, y el icono se dibuja a su tamaño intrínseco — enorme. Reventó los dos botones de la landing, que quedaron con el texto a una letra por línea. `Icon.svelte` convierte ahora un número suelto a píxeles, pero escribe la unidad igualmente. El fallo venía de la migración: el `width="18"` del SVG original sí era válido **como atributo**, y al pasar a CSS dejó de serlo.
27. **El cristal esmerilado es sólo para superficies fijas.** Navbar no, porque no es sticky y se va con el scroll; versículos y tarjetas de lista tampoco, porque cada capa con `backdrop-filter` se recompone en cada fotograma y un capítulo largo son 40-80 capas. La transparencia va **dentro** de `@supports (backdrop-filter: …)` con el fondo opaco como base: sin desenfoque, un fondo translúcido deja leer el texto de la página a través del panel. Y el Modo Amvon queda fuera a propósito: en el púlpito la legibilidad no se negocia.
28. **El Modo Amvon no hace ni una petición de red, y eso condiciona cómo se guarda.** `sermon-pulpit.service.js` deja en el dispositivo el **texto** de cada referencia citada, no sus coordenadas: resolverlas contra la Biblia en memoria funcionaría casi siempre, y "casi siempre" no vale delante de una congregación. Una referencia que no se pudo resolver se guarda con texto vacío en lugar de omitirse, para que el botón siga donde el predicador lo espera. Es también una **capa propia a pantalla completa** (`fixed inset:0; z-index:200`) y no el modo inmersivo de `Result.svelte`: el inmersivo esconde la interfaz pero deja debajo swipe, iconos y player, y cualquiera de esos apareciendo a mitad de predicación es justo lo que no puede pasar. La recuperación tras interrupción (`getActive`, en `main.js`) caduca a las seis horas para que un Amvon olvidado no secuestre el arranque meses después.

## Mapa rápido

```
src/
  main.js                    arranque, redirect a /landing, registro del SW
  App.svelte                 carga de Biblia + locale, layout raíz
  config.js                  API_BASE_URL, USE_BACKEND
  config/bible-versions.js   catálogo de versiones: paths, locales, SEO
  layouts/main/              Result (lectura), Compare, Index, Favorites, Notes, Sidebar
  layouts/landing/           Landing pública (4 idiomas, ?lang=xx)
  services/                  datos (API-first), i18n, seo, music, filtros, rutas
  store/                     stores Svelte + persistencia localStorage
workers/robible-api/         backend Hono sobre Workers + D1
scripts/generate-seo.mjs     páginas SEO estáticas + sitemaps (post-build)
netlify/functions/           og-image (SVG por versículo), verse-meta
public/data/{vdc,rvl}/       Biblias en JSON
public/lang/{ro,es,en,zh}/   traducciones de UI
```

Detalle completo en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Despliegue y runbook en [docs/OPERACIONES.md](docs/OPERACIONES.md).
