# Arquitectura de RoBible

> Mapa técnico del frontend y su relación con el backend.
> Backend en detalle: [workers/robible-api/README.md](../workers/robible-api/README.md).
> Despliegue y operación: [OPERACIONES.md](OPERACIONES.md).

## Stack

| Capa | Tecnología | Notas |
|---|---|---|
| UI | Svelte 5 (**sintaxis legacy**, no runes) | `export let` + `$:`, no `$state`/`$derived` |
| Build | Vite 8 | plugin `@sveltejs/vite-plugin-svelte` |
| Estilos | SCSS + variables CSS | dark mode con `html[data-theme]` |
| Routing | propio, sobre `window.location.pathname` | sin librería de router |
| i18n | propio, sin librería | `public/lang/*.json` |
| Datos | JSON estáticos | `public/data/{version}/` |
| Offline | Service Worker propio | `public/sw.js` |
| Backend | Hono + Cloudflare Workers + D1 | `workers/robible-api/` |
| Hosting | Netlify (frontend) + Cloudflare (API) | |

## Arranque

[src/main.js](../src/main.js) hace cuatro cosas, en orden:

1. Vacía `#app`. El HTML servido puede traer contenido pre-renderizado para SEO (lo genera `generate-seo.mjs`); si no se limpia, se vería duplicado con la SPA.
2. Si el path es `/` y no hay usuario en `localStorage`, hace `replaceState` a `/landing`. Los deep links (`/biblia/...`) nunca se redirigen.
3. Monta `App`.
4. Registra `/sw.js` **solo en `import.meta.env.PROD`**, con un flujo de update que avisa por el evento `robible:pwa-update-available` y recarga en `controllerchange`.

[src/App.svelte](../src/App.svelte) es el layout raíz y el cargador de datos:

- Carga síncrona del locale inicial antes del primer render (`loadLocaleSync`), tomando `?lang=` de la URL si estamos en la landing, si no el locale de la versión bíblica activa.
- `loadBibleVersion(version)` descarga `bible.map.json` + `bible.json` en paralelo y los guarda en `bibleCache` por versión.
- `loadCompareVersion(version)` hace lo mismo para la versión de comparación, reusando `bibleCache` si ya está.
- Envuelve `Navbar` + `Main` + `Footer` + `AppMenu` en `{#key $localeVersion}` para forzar el re-render cuando cambia el idioma.

**Guardas anti-race (no simplificar):**

| Guarda | Dónde | Protege de |
|---|---|---|
| `bibleLoadRequestId` | `App.svelte` | que una descarga de Biblia antigua pise a una más reciente |
| `_localeVersionTag` | `App.svelte` | cascadas de `loadLocaleSync` al cambiar de versión |
| `_pendingLocale` | `i18n.service.js` | aplicar un traductor de un locale ya descartado |

## Routing

No hay router. La navegación se hace con `window.history.pushState` seguido de un `PopStateEvent` sintético, y los componentes escuchan dos eventos:

- `popstate` — navegación real del navegador
- `robibile:navigate` — **errata intencional en el código** (`bibile`, no `bible`). Está así en todos los sitios; hay que escribirlo igual.

[src/layouts/main/Main.svelte](../src/layouts/main/Main.svelte) compara el `pathname` con los paths definidos por idioma en `bible-versions.js` y decide la vista.

### Rutas reales

| Ruta | Vista | Origen del path |
|---|---|---|
| `/` | `Result` (lectura) | — (redirige a `/landing` si no hay sesión) |
| `/landing`, `/landing?lang=ro\|es\|en\|zh` | `Landing` | fijo, cortocircuitado en `App.svelte` |
| `/biblia/:version/:libro-slug/:cap?/:ver?` | `Result` | `BIBLE_ROUTE_PREFIX` en `bible-route.service.js` |
| `/compara`, `/comparar`, `/compare` | `Compare` | `comparePath` por versión |
| `/indice`, `/index` | `Index` (temático) | `indexPath` por versión |
| `/favorites` | `Favorites` | `favoritesPath` (hoy igual en ro y es) |
| `/notes` | `Notes` | `notesPath` (hoy igual en ro y es) |
| `/verse/:version/:libro/:cap/:ver` | redirect Netlify a `verse-meta` | ruta legacy, `parseLegacyVersePath()` |
| `/og/verse/:version/:libro/:cap/:ver.svg` | Netlify Function `og-image` | imagen OG dinámica |

Las URLs se construyen y parsean **siempre** con [bible-route.service.js](../src/services/bible-route.service.js): `buildBiblePath()`, `parseBiblePath()`, `getBookSlug()`, `getBookIdFromSlug()`. El slug del libro sale de normalizar el nombre traducido (`Geneza` → `geneza`), así que **depende del idioma activo**.

> El sitemap solo debe publicar rutas de esta tabla. Publicaba además `/temas`, `/favoritos`, `/favoriti`, `/notas` y `/notite`, que la app no resuelve y devolvían soft-404; se retiraron el 2026-09-04. Si algún día se traducen los `*Path` por idioma, hay que añadirlas de vuelta en `generate-seo.mjs`.

## Tests

`npm test` — 56 tests con el runner de Node (`node:test`), sin dependencias añadidas. Corren en menos de medio segundo.

| Archivo | Qué cubre | Por qué |
|---|---|---|
| `tests/i18n-keys.test.js` | Paridad de claves entre los 4 idiomas, valores vacíos, marcadores `{x}` coherentes | El traductor devuelve la clave cuando falta, así que una traducción ausente no rompe nada: sale `app.notes.title` en pantalla. Pasó de verdad, con 11 claves |
| `tests/bible-route.test.js` | Construir/parsear rutas, slugs de libro, ida y vuelta | Todas las URLs pasan por aquí y los slugs dependen del idioma. Un desajuste no lanza error: lleva al capítulo equivocado |
| `tests/reference-search.test.js` | Separadores, abreviaturas, erratas, ambigüedad | Sustituye al antiguo `scripts/test-reference-search.mjs`, que imprimía y llamaba a `process.exit` |
| `tests/filter.test.js` | Búsqueda por texto, acentos, testamento, libro, los tres `searchType` | Incluye que las `key` del resultado sean únicas: es lo que usa `Result.svelte` para el resaltado |
| `tests/worker-validators.test.js` | Validadores de entrada, PBKDF2, tokens HMAC | Frontera con la base de datos. Si `hashValue` cambia de forma, nadie puede entrar |

**Convenciones**: solo lógica pura importable sin navegador. Lo que toca `localStorage` se dobla con un stub mínimo (ver la cabecera de `filter.test.js`). Los componentes Svelte no se prueban aquí — para eso está la verificación en navegador.

> En Windows, `node --test tests` intenta cargar el directorio como módulo y falla. Por eso el script usa el glob `"tests/*.test.js"`.

Varios tests fijan valores a propósito (`PBKDF2_ITERATIONS`, `SESSION_TTL_MS`): no son tautologías, son avisos de que ese número no debería cambiar sin decidirlo.

## Sistema de diseño

Definido en [public/global.css](../public/global.css). Es la **única fuente de verdad**: la landing y la app consumen los mismos tokens.

Paleta fría: grises azulados de base, azul de acento, verde reservado al estado de lectura. Está organizada en tres capas, y esa separación es lo que permite recolorear el producto entero tocando un archivo:

**1. Escalas crudas** — no usarlas directamente en componentes:

- `--grey-50` … `--grey-900`: de fondo de página (`#f2f5f8`) a casi negro (`#0f1720`)
- `--blue-200` … `--blue-700`: acento e interacción, con `--blue-500` (`#2d96cd`) como principal
- `--green-300` … `--green-600`: estado de lectura, con `--green-500` (`#28a745`) como principal

**2. Alias semánticos** — estos son los que se usan:

| Rol | Token | Claro | Oscuro |
|---|---|---|---|
| Fondo de página | `--color-page` | `--grey-50` | `--grey-900` |
| Tarjetas y paneles | `--color-surface` | `#ffffff` | `#17212b` |
| Superficie hundida | `--color-surface-sunken` | `--grey-100` | `#121b23` |
| Títulos y panel oscuro | `--color-ink` | `--grey-600` | `#d8e6ee` |
| Texto secundario | `--color-ink-soft` | `--grey-500` | `--grey-300` |
| Acento | `--color-accent` | `--blue-500` | `--blue-400` |
| Lectura en curso | `--color-success` | `--green-500` | `--green-400` |

El modo oscuro **solo reapunta los alias semánticos** a otros peldaños de las mismas escalas. Ningún componente necesita reglas propias de tema.

**3. Alias heredados** — `--color-blue`, `--color-white`, `--color-bg-light`, `--color-sidebar`… Existen porque hay ~500 usos repartidos por los componentes. Apuntan a los semánticos. **En código nuevo usa los de la capa 2.**

Además hay escalas de tipografía fluida (`--font-size-*` con `clamp()`), espaciado (`--space-*`), radios (`--radius-*`) y sombras.

### Componentes compartidos

**[Modal.svelte](../src/components/Modal.svelte)** — único diálogo de la app. Centrado en escritorio, hoja inferior al 92 % en móvil, cierra con Escape y con clic fuera, bloquea el scroll del fondo y lleva el foco dentro al abrir. Props: `open`, `title`, `eyebrow`, `size` (`sm`/`md`/`lg`), `onClose`, más un slot `footer`.

Lo usan comparar versión, nota y índice temático. Antes eran tres popups distintos anclados al botón con `getBoundingClientRect()`, que en móvil se recortaban contra el borde de la pantalla. Cualquier diálogo nuevo va aquí.

**Iconos de acción del versículo** — los cuatro (copiar, comparar, favorito, tema, nota) comparten la clase `.icon-btn` de `Result.svelte`. El estado marcado es **uno solo**, `.icon-btn--marked`, que se pinta a partir de `--marked-color`; cada icono aporta su color con un modificador:

| Icono | Modificador | Color |
|---|---|---|
| Favorito | `.icon-btn--marked-favorite` | `--color-marked-favorite` (ámbar) |
| Nota | `.icon-btn--marked-note` | `--color-marked-note` (verde) |
| Índice temático | `.icon-btn--marked-topic` | `--topic-color`, inline según el tema |

Así el usuario reconoce "esto está marcado" por la forma, y de qué marca se trata por el color. Para añadir un icono, define su modificador con `--marked-color` — no dupliques el bloque de estilos.

### Reglas de color

- El **verde** tiene un único significado: el versículo que se está leyendo (`.highlight-verse`) y el botón que lo activa. No usarlo para nada más — ya pasó con un botón de "libro seleccionado" y con un badge "NEW", y diluía la señal.
- La **única superficie oscura** en modo claro es el panel de filtros (`--color-sidebar`), que lleva texto en `--color-on-primary`.
- Nada de colores literales en los componentes. Si hace falta un tono intermedio, `color-mix(in srgb, var(--color-accent) N%, transparent)`.

### Logotipo

Tres SVG en el repo, todos con la misma marca (anillo + llama de tres lenguas sobre un atril):

| Archivo | Uso | Fondo |
|---|---|---|
| `public/assets/img/logo.svg` | Iconos PWA, og:image, navbar | Cuadrado `#1d3040` |
| `public/assets/img/logo-mark.svg` | Sobre superficies propias | Transparente |
| `public/favicon.svg` | Pestaña del navegador | Transparente, **dibujo simplificado** |

El favicon es a propósito un dibujo distinto: a 16 px el anillo interior, las lenguas laterales y el atril se empastan, así que solo lleva anillo y llama, con trazos mucho más gruesos.

`node scripts/build-logo.js` regenera los 12 PNG y el `.ico` desde esos SVG. Al cambiar el logo hay que actualizar también el color de tema en `index.html`, `public/site.webmanifest` y `public/browserconfig.xml`, y bumpear el service worker.

> Ojo con los comentarios XML de los SVG: no pueden contener `--`, así que los nombres de token se escriben ahí como `(grey 800)` y no `--grey-800`. Con `--` dentro, `sharp` falla al leer el archivo.

## Datos bíblicos

Dos archivos por versión en `public/data/{version}/`:

**`bible.json`** — array de 66 libros, cada libro array de capítulos, cada capítulo array de versículos (strings). Índices 0-based:

```js
bible[0][0][0] // "La început, Dumnezeu a făcut cerurile şi pământul."
//    │  │  └── versículo 1
//    │  └───── capítulo 1
//    └──────── libro 0 = Geneza
```

**`bible.map.json`** — nombres y agrupaciones:

```json
{ "0": "Geneza", "1": "Exodul", ..., "65": "Apocalipsa",
  "ot": [0..38], "nt": [39..65], "all": [0..65] }
```

Pesos: **4,2 MB por Biblia** (8,5 MB las dos). `vdc` (Biblia Română) y `rvl` (Biblia Español) tienen datos; `en_kjv` y `zh_cuv` están declaradas con `available: false` y **sin datos**.

En las URLs los capítulos y versículos son **1-based**; en los formularios y arrays son **0-based**. `Result.svelte` hace la conversión al reaccionar a la URL.

## Stores

Todos en `src/store/`. Los de datos se recargan solos cuando cambia `currentUser`.

| Store | Contenido | Persistencia |
|---|---|---|
| `stores.js` | `filter`, `selectedBibleVersion`, `compareWithVersion`, `themeMode`, `immersiveMode` | `filter`, `selectedBibleVersion`, `robible:compareWith`, `robible:theme`, `robible:immersive` |
| `authStore.js` | `currentUser`, `authToken`, `isAuthenticated` | `robible:auth:token`, `robible:auth:user`, `robible:session:v1` |
| `favoritesStore.js` | lista de favoritos | `robible:favorites:v1:{userId}` |
| `notesStore.js` | notas por versículo | `robible:notes:v1:{userId}` |
| `topicsStore.js` | topics + `verse_refs` | `robible:topics:v1:{userId}` |
| `searchesStore.js` | búsquedas recientes (máx. 25) | `robible:searches:v1:{userId}` |
| `ttsStore.js` | velocidad, ambiente, volúmenes, estado de reproducción | `robible:tts:{speed,ambient,volume,musicVolume}` |
| `appMenuStore.js` / `authMenuStore.js` | apertura de menú lateral / modal de auth | — |

Las claves de datos llevan sufijo de usuario (`:anonymous` si no hay sesión), así que cambiar de usuario no mezcla datos en el mismo dispositivo.

Otras claves sin prefijo, heredadas: `filter`, `lang`, `selectedBibleVersion`.

## Servicios

`src/services/`. Los de datos comparten un patrón único.

### Patrón API-first con fallback

Referencia canónica: [favorites.service.js](../src/services/favorites.service.js) (el más corto). Todo servicio de datos expone:

```js
setCurrentUser(userId)   // fija el sufijo de la clave localStorage
loadXxx()                // lectura síncrona desde localStorage (cache local)
syncFromServer()         // trae del backend y sobrescribe la cache
addXxx / removeXxx / ... // escribe en backend y en cache; si el backend falla, solo cache
resetAll()               // limpia al hacer logout
```

El switch backend/local es interno: los componentes nunca saben de dónde vienen los datos. `withFallback()` en [apiClient.js](../src/services/apiClient.js) implementa la política: los **5xx y errores de red caen a localStorage**, los **4xx se propagan** como error real (un `nickname_taken` no debe silenciarse).

El store correspondiente se suscribe a `currentUser` y hace `syncFromServer()` en login.

### Resto de servicios

| Servicio | Función |
|---|---|
| `apiClient.js` | wrapper de `fetch` con `Authorization`, `ApiError`, mapeo de códigos del backend a claves i18n, `withFallback()` |
| `auth.service.js` | register/login/logout/recover. Incluye un mock completo en localStorage (PBKDF2 100k, mismo algoritmo que el backend) que se usa si no hay API |
| `i18n.service.js` | traductor propio (ver abajo) |
| `filter.service.js` | búsqueda por texto sobre la Biblia en memoria; `replaceDiacritics()` |
| `referenceSearch.service.js` | búsqueda por referencia (`Ioan 3:16`, `jn 3 16`) con fuzzy matching por Levenshtein. Usado en `Sidebar` y en el micro-demo de la landing |
| `bible-route.service.js` | construir/parsear rutas |
| `seo.service.js` | inyecta title, meta, canonical, hreflang, Open Graph y JSON-LD en runtime |
| `tts.service.js` | wrapper de `SpeechSynthesis` con timings palabra a palabra |
| `music.service.js` | drone armónico procedural con Web Audio API (sin archivos de audio) |

## i18n

Implementación propia en [i18n.service.js](../src/services/i18n.service.js), sin dependencias:

- `_` es un **`writable` que contiene la función traductora**. Por eso en los templates se usa `$_('clave')`: se está invocando el valor del store.
- `localeVersion` es un contador que se incrementa **de forma síncrona** al aplicar un traductor nuevo. Los `{#key $localeVersion}` de `App.svelte` dependen de él para re-renderizar todo el árbol.
- Los archivos viven en `public/lang/{ro,es,en,zh}.json`, ~350 claves cada uno, bajo tres raíces: `app`, `auth`, `landing`.
- El locale sale de la versión bíblica activa (`vdc` → `ro`, `rvl` → `es`), salvo en la landing, donde manda `?lang=xx` y es independiente.
- Si falta una clave, el traductor devuelve **la clave misma** — así se detectan a simple vista en la UI.
- El SW sirve `/lang/*` con *stale-while-revalidate* para que las traducciones se actualicen sin esperar a un bump de cache.

**Añadir una clave:** hay que añadirla a los cuatro archivos. Si falta en uno, ese idioma mostrará la clave cruda.

## Añadir una versión bíblica

1. `public/data/{codigo}/bible.json` + `bible.map.json` con el formato de arriba.
2. `public/lang/{locale}.json` si el idioma es nuevo.
3. Entrada en `BIBLE_VERSIONS` de [bible-versions.js](../src/config/bible-versions.js): `value`, `label`, `locale`, `ogLocale`, `hreflang`, `slug`, los `*Path` por idioma, los textos de UI y el bloque `seo` completo.
4. `available: true` (con `false` aparece en el catálogo pero no en el selector de comparación).
5. Añadir las dos rutas de datos a `CORE_ASSETS` en `public/sw.js` y **bumpear `CACHE_NAME`**.
6. `npm run build` regenera sitemaps y páginas SEO de la versión nueva.

## Lectura con música

**No hay voz**: es música de fondo más el versículo resaltado avanzando por la pantalla. Decisión de producto del 4 sep 2026.

- [TtsPlayer.svelte](../src/components/TtsPlayer.svelte) recibe `playlist`, el **mismo array que Result.svelte está pintando**. Recorre esa lista y marca cada versículo por su `key`, la misma que usa la plantilla para el resaltado. De ahí que funcione igual leyendo un capítulo que leyendo los resultados de una búsqueda, aunque cada modo construya la `key` de forma distinta.
- El ritmo se estima en `MS_POR_PALABRA` (380 ms) dividido por la velocidad elegida. Es una aproximación: no hay audio de voz con el que sincronizar.
- Estados: **play** entra en modo lectura a pantalla completa · **pausa** congela manteniendo el resaltado y sin salir · **parar** resetea posición, música y modo lectura. El modo lectura lo gobierna un solo sitio, `Result.svelte`, a partir de `playing || paused`.
- [music.service.js](../src/services/music.service.js) reproduce un MP3 en bucle infinito con `AudioBufferSourceNode.loop = true` (empalme exacto, sin el hueco que deja `<audio loop>`), con fades de entrada y salida. Si el archivo no carga, cae a un pad sintético de osciladores. La pista y su licencia CC0 están en [public/assets/audio/CREDITS.md](../public/assets/audio/CREDITS.md).
- Velocidades: **0,75× / 1× / 1,5× / 2×**. Ambientes: **`prayer`** (el MP3) y **`none`**.
- [tts.service.js](../src/services/tts.service.js) envuelve `SpeechSynthesisUtterance` y **hoy no lo importa nadie**. Se conserva por si se añade voz más adelante; al no importarse no entra en el bundle.

## Backend, en una vista

Hono sobre Cloudflare Workers, D1 como base de datos.

- [index.js](../workers/robible-api/src/index.js) — router, CORS por allowlist, middleware `requireAuthMw`, 404 y handler de errores.
- [auth.js](../workers/robible-api/src/auth.js) — registro, login, recuperación en 3 pasos, cambio de contraseña. PBKDF2-SHA256 100k iteraciones, salt de 16 bytes.
- [data.js](../workers/robible-api/src/data.js) — CRUD de topics, verse_refs, favoritos, notas, búsquedas y export.
- [utils.js](../workers/robible-api/src/utils.js) — hashing, tokens HMAC, validadores, rate limiting persistente en D1.

Los tokens son HMAC-SHA256 firmados **y** persistidos en `auth_sessions`: `requireAuth` valida la firma *y* la existencia de la fila, de modo que el logout revoca de verdad.

Tabla de endpoints y schema: [workers/robible-api/README.md](../workers/robible-api/README.md).

## SEO y PWA

- [scripts/generate-seo.mjs](../scripts/generate-seo.mjs) corre tras `vite build` y genera en `dist/` páginas HTML estáticas de **libro y capítulo** (con contenido real para los crawlers), páginas temáticas tipo `/versiculos/amor`, y el índice de sitemaps en `dist/sitemaps/`.

### Por qué no hay páginas por versículo

Las hubo: una por versículo y versión, unas 31.000 por Biblia. Se eliminaron el 5 sep 2026 porque el coste no compensaba:

| | Antes | Ahora |
|---|---|---|
| Archivos en `dist` | 67.368 | **5.163** |
| Tamaño de `dist` | 628 MB | **83 MB** |
| Duración del build | 4 min 07 s | **13 s** |
| URLs en el sitemap | ~67.000 | **5.028** |

Además eran contradictorias: se marcaban `noindex` **y** se anunciaban en el sitemap, así que Googlebot gastaba presupuesto de rastreo recorriendo decenas de miles de URLs casi idénticas para luego no indexarlas.

Los versículos **siguen siendo direccionables**. `/biblia/<version>/<libro>/<cap>/<versiculo>` lo resuelve la aplicación, y `netlify.toml` enruta esa forma a la función [verse-meta](../netlify/functions/verse-meta.mjs), que genera título, descripción, Open Graph y JSON-LD del versículo al vuelo. Compartir un enlace sigue mostrando el texto correcto; solo cambia que las etiquetas se calculan en la petición en vez de estar precocinadas en disco.

Solo pasa por la función quien abre el enlace directamente —al compartirlo, o un rastreador—. Dentro de la aplicación, moverse entre versículos es navegación de cliente y no llega al servidor.
- [seo.service.js](../src/services/seo.service.js) actualiza en runtime title, description, canonical, hreflang, Open Graph, Twitter Card y JSON-LD según la vista.
- Netlify Functions: `og-image.mjs` genera un SVG por versículo para compartir; `verse-meta.mjs` sirve HTML con metadatos para la ruta legacy `/verse/...`.
- [public/sw.js](../public/sw.js): *network-first* para navegación, *cache-first* para assets y datos, *stale-while-revalidate* para `/lang/`. Precachea las dos Biblias completas en la instalación.
