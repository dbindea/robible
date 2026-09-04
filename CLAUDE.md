# CLAUDE.md — Manual operativo de RoBible

> Guía para agentes que trabajan en este repo. Léela antes de tocar nada.
> Documentación ampliada en [docs/](docs/). Estado y pendientes en [ROADMAP.md](ROADMAP.md).

## Qué es RoBible

PWA de lectura bíblica multiidioma con audio TTS karaoke, comparación de versiones, índice temático, favoritos, notas y modo offline completo. Frontend Svelte 5 + Vite en Netlify; backend Cloudflare Workers + D1.

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
| `npm run lint` | ESLint. **Debe salir en 0 errores.** Quedan 14 avisos deliberados (`svelte/require-each-key`, `infinite-reactive-loop`): son señales reales pero no bloqueantes, no las silencies sin mirarlas |
| `npm run format` | Prettier sobre todo el repo |
| `node workers/robible-api/dev-server.js` | Backend local en `127.0.0.1:8787` (emula Workers+D1 con `node:sqlite`) |
| `node scripts/build-logo.js` | Regenera todos los favicons desde el SVG fuente |
| `node scripts/test-reference-search.mjs` | Único script de verificación del repo (búsqueda por referencia) |

Node ≥ 24.15.0 (ver `.nvmrc`). No hay suite de tests automatizados.

## Convenciones a respetar

- **Svelte 5 en sintaxis legacy**: el código usa `export let` y `$:`, no runes (`$state`, `$derived`). No migrar un archivo a runes de paso; si se hace, es una decisión explícita y completa.
- **Comentarios en castellano**, con separadores del estilo `// ── Sección ──────`. Explican el *porqué*, sobre todo en las guardas anti-race. Mantener ese registro.
- **Nada de texto hardcodeado en UI**: todo pasa por `$_('clave.anidada')` y la clave debe existir en los **cuatro** archivos `public/lang/{ro,es,en,zh}.json`.
- **Servicios de datos**: cualquier entidad nueva sigue el patrón API-first con fallback a `localStorage` vía `withFallback()` de [src/services/apiClient.js](src/services/apiClient.js). Ver `favorites.service.js` como referencia canónica (es el más corto).
- **SCSS**: variables CSS (`var(--color-blue)`) y dark mode con `html[data-theme='dark']`. Nunca colores literales sueltos.
- **Rutas**: se construyen con `buildBiblePath()` / se leen con `parseBiblePath()` de [src/services/bible-route.service.js](src/services/bible-route.service.js). No parsear `pathname` a mano.

## Trampas del repo

Cosas que rompen si no se saben:

1. **El evento de navegación se llama `robibile:navigate`** — con la errata, `bibile` en vez de `bible`. Está así en 10 sitios. Al escuchar o emitir, hay que escribirlo mal a propósito. Renombrarlo es un cambio atómico o no es.
2. **Tocar `public/sw.js` obliga a bumpear `CACHE_NAME`** (hoy `robible-v19`). Sin bump, los usuarios con la PWA instalada no reciben el cambio. `public/sw.js` es la única fuente de verdad de la versión de cache: no dupliques la constante en otro sitio.
3. **`bible.json` pesa 4,2 MB por versión.** No cargarlo en scripts ni en el arranque salvo que haga falta. La Biblia de comparación es lazy: solo se descarga al entrar en modo comparar.
4. **`App.svelte` tiene guardas anti-race deliberadas**: `bibleLoadRequestId`, `_localeVersionTag`, `_pendingLocale`. Parecen redundantes y no lo son — evitan que una carga vieja pise a una nueva al cambiar de versión/idioma. No simplificar.
5. **`getBibleVersionConfigOrDefault()` sin argumento devuelve siempre `vdc`**, no la versión activa. Pásale siempre `$selectedBibleVersion`. La única llamada sin argumento legítima es la de `src/config/seo.js:5`, que define a propósito la versión por defecto. Ya provocó un bug real (voz rumana leyendo español), ver auditoría hallazgo 1.

8. **La reproducción de audio está a medias**: el botón de play llama a `playMusicOnly()`, que solo pone música y simula el karaoke con timers. La ruta que habla de verdad (`playChapter` → `ttsService.speak`) está desconectada y marcada en el código. Ver auditoría, hallazgo 13, antes de tocar nada del TTS.
6. **`Result.svelte` tiene 2880 líneas.** Es la vista de lectura y concentra swipe, favoritos, notas, topics, TTS y SEO. Buscar por los marcadores `// === SECCIÓN ===` antes de leerlo entero.
7. **No hay router.** Añadir una ruta implica tocar `Main.svelte` (detección), `bible-versions.js` (el path por idioma), `AppMenu.svelte` (navegación) y `generate-seo.mjs` (sitemap).

## Mapa rápido

```
src/
  main.js                    arranque, redirect a /landing, registro del SW
  App.svelte                 carga de Biblia + locale, layout raíz
  config.js                  API_BASE_URL, USE_BACKEND
  config/bible-versions.js   catálogo de versiones: paths, locales, SEO
  layouts/main/              Result (lectura), Compare, Index, Favorites, Notes, Sidebar
  layouts/landing/           Landing pública (4 idiomas, ?lang=xx)
  services/                  datos (API-first), i18n, seo, tts, music, filtros, rutas
  store/                     stores Svelte + persistencia localStorage
workers/robible-api/         backend Hono sobre Workers + D1
scripts/generate-seo.mjs     páginas SEO estáticas + sitemaps (post-build)
netlify/functions/           og-image (SVG por versículo), verse-meta
public/data/{vdc,rvl}/       Biblias en JSON
public/lang/{ro,es,en,zh}/   traducciones de UI
```

Detalle completo en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Despliegue y runbook en [docs/OPERACIONES.md](docs/OPERACIONES.md).
