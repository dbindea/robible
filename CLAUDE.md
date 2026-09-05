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
| `npm test` | Suite con `node --test` (59 tests, sin dependencias). **En Windows el glob es obligatorio**: `node --test tests` a secas intenta cargar el directorio como módulo y falla |

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
2. **Tocar `public/sw.js` obliga a bumpear `CACHE_NAME`** (hoy `robible-v23`). Sin bump, los usuarios con la PWA instalada no reciben el cambio. `public/sw.js` es la única fuente de verdad de la versión de cache: no dupliques la constante en otro sitio.
3. **Los códigos de versión no describen el texto.** `rvl` **no es Reina-Valera**: es la Biblia en Español Sencillo (CC BY 4.0, atribución pendiente). `vdc` es la Cornilescu *corregida*, no la de 1924. Se mantienen así por decisión del propietario; ver `public/data/CREDITS.md`.
4. **Hay cuatro Biblias y `bible.json` pesa entre 1 y 4 MB cada una.** No cargarlas en scripts ni en el arranque salvo que haga falta. La de comparación es lazy, y el SW solo precachea `vdc` y `rvl` (ver `public/data/CREDITS.md`).
5. **No se generan páginas estáticas por versículo, a propósito.** Las hubo (~31.000 por versión) y se quitaron: `dist` bajó de 628 MB a 83 MB y el build de 4 min a 13 s. Los versículos siguen siendo direccionables — `netlify.toml` enruta `/biblia/:v/:libro/:cap/:versiculo` a la función `verse-meta`, que genera las etiquetas al vuelo. No las reintroduzcas sin medir el coste.
6. **Los slugs de libro admiten cualquier alfabeto.** `slugifyBookName` filtra con `\p{L}\p{N}`, no con `[a-z0-9]`: con lo segundo los nombres chinos se vaciaban enteros y los 66 libros compartían un slug vacío.
7. **`App.svelte` tiene guardas anti-race deliberadas**: `bibleLoadRequestId`, `_localeVersionTag`, `_pendingLocale`. Parecen redundantes y no lo son — evitan que una carga vieja pise a una nueva al cambiar de versión/idioma. No simplificar.
8. **`getBibleVersionConfigOrDefault()` sin argumento devuelve siempre `vdc`**, no la versión activa. Pásale siempre `$selectedBibleVersion`. La única llamada sin argumento legítima es la de `src/config/seo.js:5`, que define a propósito la versión por defecto. Ya provocó un bug real (voz rumana leyendo español), ver auditoría hallazgo 1.
9. **`Result.svelte` tiene 2880 líneas.** Es la vista de lectura y concentra swipe, favoritos, notas, topics, TTS y SEO. Buscar por los marcadores `// === SECCIÓN ===` antes de leerlo entero.
10. **No hay router.** Añadir una ruta implica tocar `Main.svelte` (detección), `bible-versions.js` (el path por idioma), `AppMenu.svelte` (navegación) y `generate-seo.mjs` (sitemap).
11. **La lectura no tiene voz, por decisión de producto**: es música + resaltado visual. `TtsPlayer` recibe `playlist` (lo que hay en pantalla), no un capítulo. `tts.service.js` existe pero no lo importa nadie.
12. **El sistema de diseño vive en `public/global.css`** y es la única fuente de verdad; la landing consume esos mismos tokens. Tres capas: escalas crudas (`--grey-*`, `--blue-*`, `--green-*`) → alias semánticos (`--color-accent`, `--color-surface`, `--color-ink`…) → alias heredados (`--color-blue`, `--color-white`…). **Usa los semánticos**; los heredados solo existen por los ~500 usos ya escritos. El modo oscuro solo reapunta los semánticos, así que los componentes no llevan reglas de tema.
13. **Colores con significado fijo**: verde = versículo en lectura (`--color-success`) y el botón que lo activa; ámbar = favorito; el color del tema = índice temático. Los cuatro iconos del versículo comparten `.icon-btn` y el estado `.icon-btn--marked`, que solo lee `--marked-color`. Para un icono nuevo, añade un modificador que fije esa variable — no dupliques el bloque de estilos.
14. **Diálogos**: usa `src/components/Modal.svelte` (centrado, hoja inferior en móvil, Escape y clic fuera). No vuelvas a anclar popups al botón con `getBoundingClientRect()`: se recortaban contra el borde en móvil.
15. **En la landing, las clases que añade JS necesitan `:global()`**. Svelte poda como CSS muerto lo que no ve en la plantilla: por eso la animación de aparición (`.is-visible`) nunca funcionó hasta que se envolvió en `:global()`.
16. **Los comentarios XML de los SVG no pueden contener `--`**: `sharp` revienta al leerlos. Por eso los nombres de token en `logo.svg` se escriben `(grey 800)`. Tras tocar un SVG del logo, `node scripts/build-logo.js` y bumpea el SW.

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
