# Auditoría de traspaso — 4 septiembre 2026

Revisión del estado del repo al asumir su gestión. Estado del código de partida: rama `develop`, commit `66addb4`.

Resumen: **15 hallazgos** — 3 altos, 5 medios, 7 informativos. Ninguno es un fallo de seguridad.

**Estado**: 13 arreglados en la sesión del 4 sep 2026 (sin commitear, en el working tree). Los 2 restantes son decisiones de producto, más una acción de git pendiente.

| # | Hallazgo | Prioridad | Estado |
|---|---|---|---|
| 1 | El TTS lee siempre con voz rumana | Alta | ✅ Arreglado |
| 2 | `USE_BACKEND` apunta a localhost en producción | Alta | ✅ Arreglado |
| 13 | La lectura con música no lee: la ruta de TTS está desconectada | Alta | ✅ Rediseñado |
| 3 | Idioma de las categorías deducido de la pregunta de seguridad | Media | ✅ Arreglado |
| 4 | `SW_CACHE_VERSION` muerto y desincronizado | Media | ✅ Arreglado |
| 5 | El sitemap publica 5 rutas que la app no resuelve | Media | ✅ Arreglado |
| 6 | `npm run lint` falla con 99 errores | Media | ✅ Arreglado (0 errores) |
| 14 | Faltan 11 claves `app.notes.*` en español y 1 en chino | Media | ✅ Arreglado |
| 7 | Rama muerta de `Landing` en `Main.svelte` | Info | ✅ Arreglado |
| 8 | 16 MB de imágenes del pipeline de logo versionadas | Info | ⚠️ Requiere acción del usuario |
| 9 | Tabla `user_profiles` sin endpoints | Info | ✅ Retirada del schema |
| 10 | 2 versiones bíblicas anunciadas sin datos | Info | ✅ KJV y CUV añadidas |
| 11 | Sin tests automatizados | Info | ✅ Suite mínima añadida |
| 12 | El health del dev-server local siempre reportaba `db: down` | Info | ✅ Arreglado |
| 15 | El JSON-LD de FAQ emitía cinco veces la misma pregunta | Info | ✅ Arreglado |

Los hallazgos 1, 3, 12, 13, 14 y 15 se verificaron ejecutando el código; el resto por lectura.

---

## Prioridad alta

### 1. El TTS lee siempre con voz rumana, también en la Biblia en español ✅ ARREGLADO

**Evidencia**

```js
// src/layouts/main/Result.svelte:1438
lang={getBibleVersionConfigOrDefault()?.locale === 'es' ? 'es' : 'ro'}

// src/components/TtsPlayer.svelte:159
const cfg = getBibleVersionConfigOrDefault();
const verseLang = cfg?.locale || lang;
```

`getBibleVersionConfigOrDefault(value)` hace `getBibleVersionConfig(value) || getBibleVersionConfig(DEFAULT_BIBLE_VERSION)`. Llamada **sin argumento**, `value` es `undefined`, no encuentra nada y devuelve siempre la versión por defecto: `vdc`, locale `ro`.

Consecuencia: `verseLang` es `'ro'` pase lo que pase, `tts.service.js` mapea a `ro-RO` y selecciona voz rumana. Un usuario leyendo la Biblia en español (`rvl`) oye el texto castellano pronunciado por una voz rumana. Por el mismo motivo, `labels` del mini-player (`$: labels = LABELS[lang] || LABELS.ro`) sale siempre en rumano.

De las tres llamadas sin argumento del repo, la de `src/config/seo.js:5` sí es intencional (define `DEFAULT_VERSION`); las otras dos no.

**Impacto** — Funcionalidad destacada del producto (Phase 4.1, "punto fuerte innovative") degradada para la mitad de los usuarios.

**Propuesta** — Pasar `$selectedBibleVersion` en ambas llamadas. En `TtsPlayer.svelte` el componente ya importa el store; en `Result.svelte` ya está suscrito. Verificable a oído en `/biblia/rvl/genesis/1`.

---

### 2. `USE_BACKEND` apunta a localhost en producción si falta la variable de Netlify ✅ ARREGLADO

**Evidencia** — [src/config.js:10-17](../src/config.js#L10-L17)

```js
const DEV_DEFAULT = 'http://127.0.0.1:8787';
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || DEV_DEFAULT).replace(/\/$/, '');
export const USE_BACKEND = !!import.meta.env?.VITE_API_BASE_URL
  || (typeof window !== 'undefined' && !window.location.hostname.endsWith('robible.app'));
```

La segunda condición se escribió cuando el dominio era `robible.app`. Hoy la producción es **`robible.com`**, que no termina en `robible.app`, así que `USE_BACKEND` da `true` aunque no exista `VITE_API_BASE_URL` — y entonces `API_BASE_URL` es `http://127.0.0.1:8787`. Todas las llamadas fallan por red, `withFallback()` las absorbe y la app cae a `localStorage` **sin ningún aviso**: parece funcionar, pero no sincroniza entre dispositivos.

**Impacto** — Si la variable está bien puesta en Netlify, hoy no pasa nada; el riesgo es que la configuración es frágil y el fallo sería silencioso. Es una comprobación de 30 segundos en el panel de Netlify.

**Propuesta** — (a) Verificar `VITE_API_BASE_URL` en Netlify. (b) Simplificar a `export const USE_BACKEND = !!import.meta.env?.VITE_API_BASE_URL;`: la referencia a `robible.app` ya no describe la realidad. (c) Considerar un `console.warn` en build de producción si la variable falta.

---

### 13. La "lectura con música" no lee: la ruta de TTS está desconectada ✅ RESUELTO (rediseñado)

> **Resolución (4 sep 2026)**: el usuario decidió que la lectura sea **música + resaltado visual, sin voz**. La reproducción se rediseñó sobre ese modelo: el reproductor recibe la lista de versículos que hay en pantalla y la recorre. `tts.service.js` queda sin uso, marcado en el propio archivo. Detalle abajo.



**Evidencia** — El único control que arranca la reproducción es el botón del final de [TtsPlayer.svelte](../src/components/TtsPlayer.svelte):

```svelte
<button class="tts-start-btn tts-start-btn--music" on:click={playMusicOnly} ...>
  <span>Música + lectura</span>
</button>
```

`playMusicOnly()` **nunca llama a `ttsService.speak()`**. Lo que hace es:

1. `musicService.play('procedural')` — arranca el drone.
2. `playMusicOnlySequentially()` — simula el karaoke con `setTimeout`, avanzando una palabra cada `380 / $ttsSpeed` ms y pasando de versículo cuando se acaba el tiempo estimado.

La ruta que sí habla — `playChapter()` → `playVersesSequentially()` → `ttsService.speak()` — no la invoca nadie: ESLint la marcaba como función no usada. Igual que `startTtsVerse()` en `ttsStore.js`.

Es decir: **no hay voz en absoluto**. El resaltado va a ciegas por un temporizador, así que se desincroniza en cuanto un versículo se sale de la media de 380 ms por palabra, y el usuario solo oye el drone.

**Impacto** — La funcionalidad estrella del producto (Phase 4.1) no hace lo que anuncia el botón. Explica la percepción de "no funciona bien".

**Sobre la música**: `music.service.js` genera un drone armónico procedural con osciladores de Web Audio API. No hay muestras ni instrumentos reales, así que el resultado es un zumbido sostenido — barato y sin licencias, pero pobre como acompañamiento de lectura. Merece replanteo aparte del bug de la voz.

**Qué se hizo**

`TtsPlayer` ya no recibe `book`/`chapter`, sino `playlist`: el mismo array que `Result.svelte` está pintando. Recorre esa lista marcando cada versículo con su `key`, la misma que usa la plantilla para el resaltado. De ahí salen dos arreglos de golpe:

- En **resultados de búsqueda** el play lee los resultados en orden, en vez de arrancar un capítulo que no está en pantalla.
- El resaltado funciona en ambos modos, que antes construían la `key` de forma distinta (1-based en capítulo, 0-based en búsqueda) y por eso no casaba nunca en búsqueda.

Comportamiento de los controles, según lo pedido:

| Acción | Efecto |
|---|---|
| Play | Arranca la música, entra en modo lectura a pantalla completa y empieza por el primer versículo de la lista |
| Pausa | Congela: se mantiene el resaltado verde sobre el versículo y **no** se sale del modo lectura |
| Continuar | Sigue desde el versículo congelado |
| Parar | Para la música, borra la posición, limpia el resaltado y vuelve a pantalla normal |
| Fin de la lista | Igual que parar |

El modo lectura lo controla un único sitio (`Result.svelte`), a partir de `playing || paused`. Antes dependía solo de `playing`, y por eso al pausar se salía de pantalla completa.

**La música** pasó de un generador de acordes aleatorios a un MP3 en bucle: `AudioBufferSourceNode.loop = true`, que empalma sin hueco (un `<audio loop>` deja un salto audible en cada vuelta). Con fade de entrada y salida, y fallback al pad sintético si el archivo no carga. Pista: *Contemplation* de Joth, **CC0**, documentada en `public/assets/audio/CREDITS.md`.

`tts.service.js` queda sin importar y marcado como tal en su cabecera: si algún día se quiere voz, es la base; si no, se puede borrar.

---

## Prioridad media

### 3. El idioma de las categorías por defecto se deduce de la pregunta de seguridad ✅ ARREGLADO

**Evidencia** — [workers/robible-api/src/auth.js:82](../workers/robible-api/src/auth.js#L82)

```js
// Seed de topics default (Mântuire/Îndurare/Vindecare o equivalentes)
const locale = securityQuestion && securityQuestion.startsWith('b') ? 'es' : 'ro';
await seedDefaultTopics(db, userId, locale, now);
```

El idioma del usuario se infiere de **la inicial de la clave de su pregunta de seguridad**. De las cinco preguntas disponibles (`siblings`, `favorite_number`, `bible_start_year`, `pets_count`, `countries_visited`), solo una empieza por `b`. El resultado es que el idioma de las categorías depende de una elección que no tiene nada que ver con el idioma.

**Verificado empíricamente** contra el dev-server el 2026-09-04:

| Pregunta elegida | Categorías creadas |
|---|---|
| `favorite_number` | Mântuire, Îndurare, Vindecare (rumano) |
| `bible_start_year` | Salvación, Misericordia, Sanación (español) |

Un usuario español que elija cualquier pregunta salvo `bible_start_year` recibe categorías en rumano; un rumano que elija esa recibe categorías en español.

**Impacto** — Primera impresión del índice temático incorrecta para una parte de los registros. No rompe nada: el usuario puede renombrar o borrar las categorías.

**Propuesta** — Enviar el locale explícitamente desde el frontend en el body de `/api/auth/register` (el cliente sí lo conoce, sale de la versión bíblica activa), validarlo contra la lista de locales soportados y usar `ro` como fallback.

*Nota menor del mismo bloque*: `auth.js:38` comprueba `securityQuestion === 'custom'`, pero la línea 35 ya rechaza cualquier valor fuera de `SECURITY_QUESTIONS`, que no incluye `'custom'`. Es una rama muerta — aunque el schema y el frontend sí contemplan preguntas personalizadas, así que la decisión es implementarlo o retirar los restos.

---

### 4. `SW_CACHE_VERSION` está muerto y desincronizado ✅ ARREGLADO

`src/config.js:20` declara `SW_CACHE_VERSION = 'robible-v18'`; `public/sw.js:1` usa `CACHE_NAME = 'robible-v19'`. La constante de `config.js` **no la importa nadie** (`grep -rn SW_CACHE_VERSION src/ scripts/ public/` solo devuelve su propia declaración).

**Impacto** — Ninguno en runtime. Es una trampa de mantenimiento: invita a pensar que bumpeando ahí se actualiza el cache.

**Propuesta** — Eliminarla, y documentar `public/sw.js` como única fuente de verdad (ya está en [OPERACIONES.md](OPERACIONES.md#release-del-service-worker)). Si se quiere mantener sincronía, que el SW la lea en vez de duplicarla.

---

### 5. El sitemap publica cinco rutas que la app no resuelve ✅ ARREGLADO

**Evidencia** — final de [scripts/generate-seo.mjs](../scripts/generate-seo.mjs), `staticRoutes`:

```
/temas  /favoritos  /favoriti  /notas  /notite
```

Los paths reales vienen de `bible-versions.js` y son `indice`, `favorites`, `notes` — **idénticos en `vdc` y `rvl`**, no traducidos. `Main.svelte` compara el pathname contra esos valores; los cinco de arriba no coinciden con nada, caen al `else` y pintan la vista de lectura.

Devuelven 200 con contenido que no corresponde a la URL: soft-404 desde el punto de vista de Google.

**Impacto** — Dilución de SEO y posibles avisos en Search Console.

**Propuesta** — Elegir una de dos: (a) quitar esas cinco entradas del sitemap, o (b) traducir de verdad `indexPath`/`favoritesPath`/`notesPath` por idioma en `bible-versions.js` y dejar que las URLs existan. La opción (b) es más trabajo pero es coherente con el diseño original de rutas por idioma, que hoy está a medias.

---

### 6. `npm run lint` falla con 99 errores y no sirve como red de seguridad ✅ ARREGLADO

28 archivos afectados. La causa principal es de configuración: [eslint.config.js](../eslint.config.js) declara `globals.browser` y `globals.es2022` para **todo** el repo, incluidos `scripts/`, `netlify/functions/` y `workers/`, que son Node y usan `process`.

Desglose aproximado:

- `process is not defined` en scripts, funciones Netlify y `dev-server.js` — falso positivo puro
- imports declarados y no usados (`json`, `error` en `index.js`; `requireAuth` en `data.js`; `SESSION_TTL_MS` en `auth.js`; `corsHeaders`, `_reqAuth` en `dev-server.js`)
- `catch {}` vacíos, muchos deliberados (el patrón `try { localStorage… } catch {}` es intencional)
- `no-useless-escape` en el regex de nickname de `utils.js:8`

**Impacto** — Con 99 errores nadie mira la salida, así que un error real pasaría inadvertido.

**Propuesta** — Añadir un bloque de configuración con `globals.node` para `scripts/**`, `netlify/**` y `workers/**`; limpiar los imports muertos; y decidir sobre `no-empty` (probablemente `allowEmptyCatch: true`, dado que el patrón es intencional en todo el código). Objetivo: dejar el lint en cero para que vuelva a ser señal.

---

### 14. Faltaban 11 claves de traducción en español y 1 en chino ✅ ARREGLADO

La página `/notes` en español renderizaba las claves en crudo (`app.notes.title`, `APP.NOTES.EYEBROW`…) porque `es.json` no tenía ninguna de las 11 claves que usa `Notes.svelte`: `color`, `saved`, `deleted`, `eyebrow`, `title`, `lead`, `empty`, `empty_hint`, `open_verse`, `remove`, `remove_reference`. En `zh.json` faltaba `app.sidebar.form.reference_placeholder`.

Detectado al navegar la app, no leyendo el código: el traductor devuelve la clave cuando no la encuentra, así que el fallo solo se ve en pantalla.

**Arreglado**: los cuatro idiomas tienen ahora las mismas 357 claves. Comprobación rápida de que no vuelve a pasar:

```bash
node -e "
const fs=require('fs');
const flat=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?flat(v,p+k+'.'):[p+k]);
const L={}; for(const l of ['ro','es','en','zh']) L[l]=new Set(flat(JSON.parse(fs.readFileSync('public/lang/'+l+'.json','utf8'))));
const all=new Set(Object.values(L).flatMap(s=>[...s]));
for(const l in L) console.log(l, 'faltan', [...all].filter(k=>!L[l].has(k)).length);
"
```

Es un buen candidato a test automatizado (ver hallazgo 11).

---

## Informativos

### 15. El JSON-LD de FAQ emitía cinco veces la misma pregunta ✅ ARREGLADO

En `Landing.svelte`, el esquema `FAQPage` mapeaba `faqItems` pero ignoraba el elemento:

```js
mainEntity: faqItems.map((item) => ({
  '@type': 'Question',
  name: $_('landing.faq.q1'),                                    // ← siempre q1
  acceptedAnswer: { '@type': 'Answer', text: $_('landing.faq.a1') },
})),
```

Resultado: cinco entradas idénticas con la primera pregunta. Los otros cuatro FAQ nunca llegaban a los datos estructurados.

Salió a la luz al arreglar un problema de tooling: los cuatro bloques JSON-LD estaban escritos como `{@html}` con un `<script>` dentro de un template literal en el markup, lo que rompía el parser de ESLint (`Parsing error: Unexpected token {`) y dejaba **el archivo entero de 1497 líneas sin analizar**. Con el archivo ya analizable, la regla `no-unused-vars` señaló el `item` sin usar.

**Arreglado**: los esquemas se construyen ahora en el bloque `<script>` y el markup solo llama a `{@html jsonLdTag(schema)}`. Salida idéntica, salvo el FAQ que ya emite las cinco preguntas reales (verificado en navegador).

---

### 7. Landing duplicada, una de las dos ramas es código muerto ✅ ARREGLADO

`App.svelte:218` corta antes con `{#if isLandingRoute}<Landing />{:else}…`, de modo que `Main` no llega a montarse en `/landing`. Pero `Main.svelte:120` tiene su propia rama `{#if isLandingMode}<Landing />`, con su `updateLandingMode()` y dos listeners registrados en `onMount` que nunca sirven para nada.

**Propuesta** — Eliminar de `Main.svelte` el import de `Landing`, la variable `isLandingMode`, la función `updateLandingMode` y sus cuatro registros de listener.

---

### 8. 16 MB de imágenes sueltas versionadas en `robible/` ⚠️ REQUIERE ACCIÓN DEL USUARIO

`git ls-files robible` devuelve 16 archivos: `logo-*.png` en todos los tamaños, `logo-main.svg` (3,4 MB), `logo-transparent*.png`, y un `test-resize.png` de 190 KB. Son la salida del pipeline de `scripts/build-logo.js`; los iconos que la app usa de verdad están en `public/`.

**Propuesta** — Comprobar cuál es el SVG fuente real (¿`robible/logo-main.svg` o `public/assets/img/logo-source.svg`?), conservarlo, y sacar el resto del control de versiones añadiendo `robible/` a `.gitignore`. Como mínimo, borrar `test-resize.png`.

---

### 9. Tabla `user_profiles` en el schema sin ningún endpoint ✅ RESUELTO

[workers/robible-api/schema.sql:120-131](../workers/robible-api/schema.sql#L120-L131) define `user_profiles` (name, email, confession, avatar_url, settings, colors) con un índice único parcial sobre `email`. Ni `data.js` ni `auth.js` la tocan. El comentario la atribuye a una "Phase 3.5 extendido" que el ROADMAP no describe.

Merece una decisión consciente: el proyecto declara explícitamente que **no quiere PII** (README del worker: "Sin dependencias de OAuth ni de PII"), y esta tabla guarda email y nombre. O se implementa con ese criterio revisado, o se retira del schema.

---

### 10. Dos versiones bíblicas anunciadas sin datos ✅ RESUELTO

`en_kjv` y `zh_cuv` están en `BIBLE_VERSIONS` con `available: false` y no tienen datos en `public/data/`. Sin embargo, `public/lang/en.json` y `zh.json` están **completos** (357 y 356 claves) y la landing ofrece los cuatro idiomas en su selector.

Un usuario que llega en inglés o chino ve la interfaz traducida y luego no encuentra Biblia en su idioma. No es un bug, pero sí una expectativa creada. Conviene decidir si son un objetivo próximo (conseguir los JSON de KJV y CUV) o si se recorta el selector de la landing mientras tanto.

---

### 11. Sin tests automatizados ✅ RESUELTO (suite mínima)

El único script de verificación del repo es `scripts/test-reference-search.mjs`, que cubre `referenceSearch.service.js`. No hay runner ni CI de tests; la verificación histórica se ha hecho manualmente y con Playwright ad hoc (según el ROADMAP).

**Resuelto (4 sep 2026)**: `npm test` con 56 tests sobre el runner de Node, sin dependencias nuevas. Cubre exactamente los candidatos que se habían identificado —rutas, búsqueda, referencias y validadores del backend— más la paridad de claves i18n, que no estaba en la lista y es la que habría cazado el hallazgo 14. Detalle en [docs/ARQUITECTURA.md](ARQUITECTURA.md#tests).

Sigue sin cubrirse la capa de componentes Svelte: eso requeriría un runner de navegador y de momento se verifica a mano.

---

### 12. El health check local siempre reporta `db: down` ✅ ARREGLADO

**Verificado el 2026-09-04**: con `dev-server.js` corriendo, `GET /api/health` devuelve `{"ok":true,...,"db":"down"}` aunque la base de datos funcione perfectamente (register, login, `/api/auth/me` y `/api/topics` responden bien en la misma sesión).

La causa está en el adaptador D1 del dev-server. `health()` hace:

```js
await db.prepare('SELECT 1 AS ok').first();   // data.js:495
```

es decir, `.first()` directamente sobre `prepare()`, **sin `.bind()`**. El adaptador de [dev-server.js:38-78](../workers/robible-api/dev-server.js#L38-L78) devuelve desde `prepare()` un objeto que solo expone `bind()`; los métodos `first`/`all`/`run` cuelgan del resultado de `bind()`. Así que `.first()` es `undefined`, lanza, y el `try/catch` de `health()` lo traduce a `db: 'down'`.

En D1 real `prepare().first()` sí funciona sin bind, así que **en producción el health es correcto**. Es solo el emulador el que miente.

**Impacto** — Ninguno funcional, pero da un falso negativo justo en la herramienta que se usa para comprobar que el entorno local está sano.

**Propuesta** — Exponer `first`/`all`/`run`/`raw` también en el objeto que devuelve `prepare()` del adaptador, delegando en `bind()` sin argumentos. Son cuatro líneas y alinea el emulador con el comportamiento de D1.

---

## A verificar fuera del repo

No se puede comprobar desde el código; requiere acceso a los paneles:

- [ ] **Netlify** → `VITE_API_BASE_URL` presente en las variables de entorno del sitio (hallazgo 2)
- [ ] **Cloudflare** → `JWT_SECRET` configurado como secret del worker `robible-api`
- [ ] **Cloudflare D1** → versión de schema aplicada en remoto = 4 (`SELECT value FROM _meta WHERE key='schema_version'`)
- [ ] **Search Console** → si aparecen soft-404 en las cinco rutas del hallazgo 5
- [ ] **Search Console** → cobertura del sitemap troceado (`/sitemap.xml` como índice)
- [ ] **Netlify** → que las Functions `og-image` y `verse-meta` están desplegadas y responden

## Lo que está bien

Para no dejar solo la lista de problemas — el estado general del proyecto es sólido:

- La **política de fallback** está bien pensada: 5xx y errores de red caen a localStorage, los 4xx se propagan. Es la decisión correcta y está aplicada de forma consistente en los cuatro servicios de datos.
- La **auth** es sensata para lo que necesita: PBKDF2 100k con salt por usuario, tokens firmados **y** persistidos para que el logout revoque de verdad, rate limiting que sobrevive a los cold starts. Sin OAuth ni PII, por diseño.
- Las **guardas anti-race** de `App.svelte` e `i18n.service.js` resuelven un problema real de cargas concurrentes y están comentadas explicando el porqué.
- El **lazy loading** de la segunda Biblia ahorra 4,2 MB por visita.
- La **CSP** de `netlify.toml` es restrictiva y está bien mantenida.
- `dev-server.js` monta el **router de producción real** sobre SQLite en vez de reimplementarlo: lo que se prueba en local es lo que se despliega.
