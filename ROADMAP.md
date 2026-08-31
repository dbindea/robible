# RoBible — Roadmap

> Documento vivo. Actualizado en cada milestone.
> Última actualización: 28 ago 2026 (Plan reescrito)

---

## Resumen ejecutivo

RoBible es una app web (PWA) bilingüe de la Biblia (rumano + español) con soporte offline, auth multi-device, índice temático, favoritos sincronizados y lectura con audio IA. Construida con Svelte 5 + Vite, SCSS, datos JSON estáticos, backend en Cloudflare Workers + D1.

**Stack:**
- Frontend: Svelte 5 + Vite 8, SCSS themeable (light/dark)
- Data: JSON estáticos en `/public/data/{vdc,rvl}/bible.{map,json}`
- i18n: JSON en `/public/lang/{ro,es}.json`
- PWA: manifest + service worker (cache-first, versiones)
- Rutas: path-based custom (parsea `window.location.pathname`)
- Backend: Cloudflare Workers (`robible-api`) + D1 (`robible-db`)
- Auth: PBKDF2 + HMAC tokens persistidos en D1 (revocables)

**Producción:**
- Frontend: `https://robible.com` (Netlify)
- Backend: `https://robible-api.robible.workers.dev`
- CORS: `robible.com`, `www.robible.com`, `robible.app`, `www.robible.app`, `localhost:5173`, `127.0.0.1:5173`

**Workflow git (importante):**
- Frontend → lo maneja el usuario (commits, PRs, merges)
- Backend → lo maneja el agente (deploys, tests, scripts)
- El agente **NO** debe hacer `git commit` / `push` / `PR` / `merge` de archivos frontend

---

## Fases completadas

### Phase 0 — Logo + infraestructura base
- Logo rediseñado: emblema circular (doble anillo + planta/llama 3 hojas) en cobre (#d28456) sobre teal (#1f4a5c) + pedestal
- `favicon.svg` con fondo transparente
- Todos los favicons PNG regenerados desde el SVG fuente
- `index.html` con meta theme-color actualizado
- `browserconfig.xml` + `site.webmanifest` actualizados
- Pipeline de iconos con `scripts/build-logo.js` (sharp-only, sin jimp)

### Phase 1 — Navegación y UX móvil
- Swipe gestures (touchstart/move/end) en Result.svelte
- Modo inmersivo con `immersiveMode` store
- Navegación flotante desktop (pill ← →)
- Navbar responsive: 3 breakpoints (60rem, 40rem, 22rem) sin overflow

### Phase 2.1 — Comparar versiones
- Ruta `/compara/:libro/:capitulo`
- `BIBLE_VERSIONS` soporta N versiones
- Selector de versión a comparar en header
- Botón "Comparar con..." por versículo
- Mobile split horizontal con scroll sync
- Dark mode completo

### Phase 2.2 — Índice temático
- Ruta `/indice` (multi-idioma)
- 3 categorías seedeadas (Mântuire/Salvación, Îndurare/Misericordia, Vindecare/Sanación)
- CRUD de topics con verse_refs
- Modal para crear categoría + crear inline desde versículo
- Persistencia en localStorage (interface lista para backend)

### Phase 2.3 — Lectura continua (auto-advance) ✅ DEPRECADA
- ~~Auto-advance al siguiente capítulo con timer~~ → **será reemplazado por audio IA en Phase 4.1**
- Velocidades configurables, persistencia, FAB flotante

### Phase 3.0 — Auth + favoritos (con localStorage)
- Nickname + password + pregunta seguridad (respuesta numérica)
- Hashing PBKDF2-SHA256 100k iter
- Tokens HMAC-SHA256 firmados
- Favoritos por versículo
- Índice temático con temas default

### Phase 3.2 — Backend + multi-device sync ✅ DESPLEGADO
- Cloudflare Workers + D1 (SQLite en el edge)
- Endpoints: register, login, logout, me, recover (3 pasos), change-password
- Endpoints: topics CRUD, verse_refs, favorites, export
- CORS configurado (ver bloque "Producción")
- Rate limiting persistente (30/min, 500/h)
- Service interface + localStorage fallback (offline-first)
- **Bugs encontrados y arreglados en producción**:
  - `requireAuth` ahora valida sesión en DB (logout revoca correctamente)
  - GET endpoints devuelven `{ok: true, ...data}` consistentemente
  - CORS añadidos `robible.com` y `www.robible.com`

---

## Pendientes — Plan reescrito

### 🐛 Bug activo (a verificar)

**Búsqueda con "Toda la Biblia" devuelve 0 resultados cuando hay un libro específico seleccionado del estado guardado**

- **Síntoma**: usuario selecciona "Toda la Biblia" en el radio, escribe texto que existe, recibe 0 resultados. Cambia a NT y vuelve a All → encuentra.
- **Causa probable**: `localStorage` guarda `form.book: [bookId]` cuando el usuario previamente seleccionó un libro. Al recargar, el radio muestra "All Bible" pero `book` sigue restringido a ese libro. `cleanBook()` solo se dispara en `on:change`, no en carga inicial.
- **Estado**: detectado, no arreglado. Documentado para el frontend.
- **Fix propuesto** (para el usuario):
  1. En `Sidebar.svelte` onMount: si `form.testament === 'all'` y `form.book.length > 0`, limpiar `form.book` y `form.chapter`
  2. O alternativamente: hacer que "All Bible" en el radio signifique realmente "all" (ignorar `book`)
  3. O mostrar visualmente que hay un libro activo cuando `book.length > 0` aunque testament sea 'all'

### 🐛 Fix buscador ✅ RESUELTO (2026-08-28)
- En `Sidebar.svelte` onMount: si `form.testament === 'all'` y `form.book.length > 0`, se limpia el book y chapter automáticamente
- Verificado: con estado bugueado inyectado (testament=all + book=[0]), al cargar la página el book se limpia y la búsqueda funciona correctamente (200 resultados vs 0 antes)

### Phase 3.3 — Notas por versículo (Backend) ✅ COMPLETADA (2026-08-29)

- [x] Endpoint `GET /api/notes` — lista notas del usuario
- [x] Endpoint `POST /api/notes` — upsert nota `{book, chapter, verse, text, color?}`
- [x] Endpoint `DELETE /api/notes` — borra nota por versículo
- [x] D1 table: `notes(id, user_id, book, chapter, verse, text, color, created_at, updated_at)` con CASCADE
- [x] UNIQUE constraint: un usuario solo puede tener UNA nota por versículo (upsert natural)
- [x] Validación: text min 1, max 500 chars; color hex `#xxxxxx` o null
- [x] Service `notes.service.js` en frontend con API-first + localStorage fallback
- [x] Store `notesStore.js` reactivo (con sync on login)
- [x] UI: modal de nota junto al versículo en Result.svelte, página /notite con lista agrupada por libro
- [x] Notas.svelte: grouped by book, with delete, navigate-to-verse, date display

### Phase 3.4 — Búsqueda persistente multi-device (Backend) ✅ COMPLETADA (2026-08-29)

- [x] D1 table: `user_searches(id, user_id, search_text, search_type, testament, book_json, chapter_json, created_at, last_used_at)` con UNIQUE en `(user_id, search_text)`
- [x] Endpoint `GET /api/searches` — últimas 25 búsquedas del usuario (ordenadas por last_used_at)
- [x] Endpoint `POST /api/searches` — upsert búsqueda (idempotente por texto, mueve al top)
- [x] Endpoint `DELETE /api/searches` — borra búsqueda por id
- [x] Almacenamiento localStorage: `robible:searches:v1:{userId}` (key versionada por usuario)
- [x] Frontend: dropdown con búsquedas recientes al hacer focus en el input (max 8 visibles)
- [x] Sincronización: al login, merge local + server; al buscar, save a ambos
- [x] Cada item del dropdown: click para aplicar, X para eliminar

### Phase 3.5 — Nickname hints + sugerencias en conflicto (Backend)

**Nickname hint (no olvidar el nickname):**
- [ ] D1 table: `nickname_hints(user_id, hint_text, created_at)` con UNIQUE en `user_id`
- [ ] Endpoint `GET /api/auth/me/hint` — devuelve el hint si existe
- [ ] Endpoint `POST /api/auth/me/hint` — guarda hint del usuario actual
- [ ] Frontend: al abrir "olvidé mi nickname", input de hint (muestra "antes te registraste como ___?")
- [ ] Login flow extendido: si el usuario introduce un nickname que no existe, mostrar "guardaste una pista: sí/no" → si sí, pedir la pista

**Sugerencias en conflicto de registro:**
- [ ] Endpoint `POST /api/auth/suggest-nickname` body `{nickname: "x"}` → devuelve array `["x_1", "x_42", "x_2026"]`
- [ ] Lógica: probar sufijos numéricos cortos (1, 2, 42, 123, 2026) hasta encontrar uno disponible
- [ ] Frontend: al recibir `nickname_taken`, llamar a este endpoint y mostrar chips con sugerencias
- [ ] i18n: "El nickname 'x' ya existe. Prueba con:" + chips clickables que rellenan el input

### Phase 4.1 — Audio TTS con highlighting (Frontend — **punto fuerte innovative**) ✅ COMPLETADA (2026-08-31)

> Reemplaza el auto-advance timer. Lee el capítulo (o desde un versículo) en voz alta con IA, resaltando palabra por palabra.

- [ ] Web Speech API: `SpeechSynthesisUtterance` con `lang` según versión bíblica (ro-RO, es-ES)
- [ ] Voces preferidas: elegir las mejores voces disponibles del sistema (Google voices en Chrome, Microsoft en Edge, etc.) con fallback graceful
- [ ] **Highlighting palabra por palabra**:
  - Calcular tiempo estimado por palabra (duración / número de palabras)
  - `SpeechSynthesisUtterance.onboundary` para eventos de palabra
  - Pintar la palabra actual con color + animación (subrayado o glow que pulsa)
  - Auto-scroll suave para mantener la palabra visible
- [ ] **Desde versículo**: al pulsar play en un versículo concreto, empezar desde ahí hasta final del capítulo (o final del libro, configurable)
- [ ] **Pantalla de búsqueda**: botón "Leer resultados en voz alta" → lee cada versículo encontrado secuencialmente con pausas entre versículos
- [ ] **Control de velocidad**: 0.75x, 1x, 1.25x, 1.5x
- [ ] **Música de fondo opcional** (drama mode):
  - Selector de ambiente (sin música / himno suave / canto gregoriano / etc.)
  - Volumen independiente (TTS vs música)
  - Loop de música mientras dura la lectura
- [ ] Estado persistido: `robible:tts:state` (posición, velocidad, ambiente, pausado)
- [ ] UI: botón play flotante en Result.svelte; control expandible en parte inferior

### Phase 4.2 — Sidebar hamburger ✅ COMPLETADA (2026-08-28)
- [x] Reemplazado el logo de marca en Navbar por un botón hamburguesa
- [x] Animación 3 líneas → X con CSS transitions (rotación 45°/-45°, opacidad de la del medio)
- [x] Botón con `aria-expanded` y `aria-controls` para accesibilidad
- [x] Click-outside para cerrar el AppMenu
- [x] Responsive: con texto "Meniu" en desktop, solo icono en mobile (<40rem)
- [x] Verificado con Playwright: hamburger → X al abrir, X → 3 líneas al cerrar
- Pendiente: badge de notificaciones en la esquina
- Pendiente: tooltip al hover

### Phase 4.3 — Fix CSS menus ✅ COMPLETADA (2026-08-28)
- [x] `verse-compare-menu` ahora es `position: fixed` con coordenadas calculadas vía `getBoundingClientRect()` del botón
- [x] `save-topic-menu` igual: `position: fixed` con coordenadas dinámicas
- [x] z-index: 50/55 (encima de todo el .result con su overflow:hidden para swipe)
- [x] Click-outside para cerrar (ya estaba implementado)
- [x] Verificado con Playwright: ambos menus aparecen correctamente fuera del .result
- Pendiente: en mobile, hacer los menus a ancho completo o bottom sheet

### Phase 4.4 — Mobile play overlap
- PENDIENTE. El botón TTS aún no existe (Phase 4.1). Cuando se implemente, coordinar z-index y posiciones con `.scroll-top-button`.

### Phase 4.5 — Eliminar plan de lectura + historial ✅ COMPLETADA (2026-08-28)
- [x] Eliminado `src/components/AutoRead.svelte` (auto-advance con timer)
- [x] Eliminado `src/store/autoReadStore.js` (timer, speed, progress, callbacks)
- [x] Limpiadas todas las referencias en `Result.svelte` (import, onMount callback, onDestroy cleanup, JSX)
- [x] Limpiada la key `autoRead.*` en `ro.json` y `es.json` (i18n)
- [x] Bumpeado SW a `robible-v15` (invalida cache v14)
- [x] Config.js actualizado a v15
- Bundle size debería bajar ~5-10kb al no incluir el componente

### Phase 4.7 — Lazy Loading Biblias (optimización tráfico) ✅ COMPLETADA (2026-08-31)
- [x] La segunda Biblia (compare version) ya no se carga al iniciar la app
- [x] `compareWithVersion` ahora inicia como `null` en lugar de leer de localStorage
- [x] Solo se descarga (~8MB) cuando usuario entra en modo comparación
- [x] Función `initCompareVersion()` en stores.js restaura preferencia desde localStorage bajo demanda
- [x] Impacto: reduce ~8MB de tráfico inicial por visitante

### Phase 4.6 — SEO Review (Frontend, recurrente) ✅ COMPLETADA (2026-08-31)

> **Acción continua**: revisar el SEO periódicamente conforme cambien las best practices y la app gane nuevas funcionalidades. Esto va más allá de las meta-tags básicas.

Checklist recurrente:
- [ ] **Schema.org JSON-LD**: ¿se actualiza para reflejar nuevas features? (WebSite + Book entity ya están; considerar adding `SearchAction` con target template)
- [ ] **Open Graph + Twitter Cards**: ¿imágenes optimizadas? (actualmente `/assets/img/logo.png` 512x512 — OK para OG)
- [ ] **Canonical URLs**: ¿todas las páginas tienen `<link rel="canonical">` apuntando a la versión canónica?
- [ ] **Hreflang**: `ro` y `es` ya están declarados; verificar que apunten a URLs distintas (no a sí mismos)
- [ ] **Sitemap**: `public/sitemap.xml` ¿refleja las nuevas rutas (`/indice`, `/favoriti`, `/favoritos`)?
- [ ] **robots.txt**: ¿se actualizó para permitir/desbloquear lo que deba ser público?
- [ ] **Performance budgets** (Core Web Vitals):
  - LCP < 2.5s (medir con PageSpeed Insights en `/` y `/Gen/1`)
  - CLS < 0.1 (cuidado con el SW bump que cambia el layout)
  - INP < 200ms (cuidado con el hamburger y los menus fixed)
- [ ] **Rich results** (Google Search Console): validar que el Book entity sigue mostrando info
- [ ] **PWA install prompts**: ¿se siguen ofreciendo correctamente en iOS Safari y Android Chrome?
- [ ] **Apple Smart App Banner** para iOS: considerar añadir `<meta name="apple-itunes-app">` si publicas en App Store
- [ ] **Topic/cluster pages**: cada categoría del índice temático (`/indice/topic/{id}`) ¿tiene meta description única?

Tools a usar:
- PageSpeed Insights (mobile y desktop)
- Google Search Console (cobertura, rich results, performance)
- Bing Webmaster Tools
- Schema.org validator
- Lighthouse CI (integrar en el build para no degradar)

Cuándo revisar: cada release mayor (Phase 4.1, 4.6, etc.) + cada 3 meses como mínimo.

---

## Decisiones de arquitectura

### Backend (CF Workers + D1)
- **Schema versionado**: cada tabla tiene `_meta` row con `schema_version`. Migraciones futuras aplican diffs.
- **CORS**: lista explícita de orígenes (no `*`). En el futuro, considerar wildcard con allowlist dinámica.
- **Auth tokens**: HMAC-SHA256 firmados con `JWT_SECRET` + persistidos en `auth_sessions` (revocables). TTL: 7 días.
- **Passwords**: PBKDF2-SHA256 con 100k iter + salt aleatorio de 16 bytes. Mismo algoritmo que el mock del frontend (compatible con migración).
- **Rate limit**: persistente en D1 (sobrevive cold starts). Por IP+endpoint, ventanas minute y hour.
- **i18n backend**: solo se devuelven claves (ej. `siblings`), el frontend traduce.

### Frontend
- **Service interface**: cada `*.service.js` expone la misma API (CRUD + sync). El switch API/localStorage es interno. Permite migrar a backend sin tocar componentes.
- **Storage versionado**: `robible:topics:v1`, `robible:searches:v1`, etc. Migraciones automáticas al detectar version bump.
- **i18n por Biblia**: el idioma se infiere de la versión bíblica activa (vdc → ro, rvl → es). No se mezcla.
- **Dark mode**: `html[data-theme="dark|light"]` con CSS variables. Logo en navbar con clases `logo-bg` y `logo-accent` que se mantienen consistentes.
- **Responsive breakpoints**: 22rem (extreme), 40rem (mobile), 60rem (tablet), 80rem+ (desktop).

---

## Próximos pasos inmediatos (orden sugerido)

1. ✅ ~~Frontend — Bug búsqueda~~ (completado 2026-08-28)
2. ✅ ~~Frontend — Eliminar plan de lectura + historial~~ (completado 2026-08-28)
3. ✅ ~~Frontend — Sidebar hamburger~~ (completado 2026-08-28)
4. ✅ ~~Frontend — Fix CSS menus~~ (completado 2026-08-28)
5. ✅ ~~Backend — Phase 3.3 Notas~~ (completado 2026-08-29)
6. ✅ ~~Backend — Phase 3.4 Búsqueda persistente~~ (completado 2026-08-29)
7. **Backend — Phase 3.5 Nickname hints + sugerencias**
8. ✅ ~~Frontend — Phase 4.1 Audio TTS con highlighting~~ (completado 2026-08-31)
9. **Frontend — Phase 4.4 Mobile play overlap** (post-TTS, coordinar z-index con FAB)
10. ✅ ~~Frontend — Phase 4.6 SEO Review~~ (completado 2026-08-31)

---

## TODO futuro: CAPTCHA

> Anotado para cuando el rate limit de D1 se quede corto (probablemente ~100 usuarios reales).

- **Opción A**: Cloudflare Turnstile (gratis, invisible, sin fricción). Requiere añadir widget en el frontend + verificar token en el backend.
- **Opción B**: reCAPTCHA v3 de Google. Más invasivo, scoring-based.
- **Trigger**: cuando un mismo IP tenga > X registros fallidos en 1h, mostrar CAPTCHA antes de permitir registro.
- **Scope**: solo registro (no login, para no molestar al usuario legítimo).
- **Esfuerzo**: 1-2 días. Requiere cuenta en Cloudflare/Google.

---

## Stack técnico

### Backend
- `workers/robible-api/src/index.js` — Hono router + CORS
- `workers/robible-api/src/auth.js` — register, login, recover, me, logout
- `workers/robible-api/src/data.js` — topics, verse_refs, favorites, export
- `workers/robible-api/src/utils.js` — hashing, tokens (HMAC), validators, rate limit
- `workers/robible-api/schema.sql` — D1 schema
- `workers/robible-api/wrangler.toml` — bindings + env vars
- `workers/robible-api/dev-server.js` — emulador local con `node:sqlite`
- `workers/robible-api/scripts/build-logo.js` — genera iconos desde SVGs

### Frontend
- `src/App.svelte` — carga Biblia, layout raíz
- `src/layouts/main/Main.svelte` — grid principal
- `src/layouts/main/Result.svelte` — vista lectura (swipe, nav, favs, save-to-topic, **futuro: TTS**)
- `src/layouts/main/Compare.svelte` — comparar versiones
- `src/layouts/main/Index.svelte` — índice temático
- `src/layouts/main/Favorites.svelte` — lista de favoritos
- `src/layouts/main/Sidebar.svelte` — filtros y búsqueda
- `src/layouts/header/Navbar.svelte` — logo, nav-links, version picker
- `src/layouts/header/AppMenu.svelte` — menú lateral (hamburger)
- `src/components/TtsPlayer.svelte` — FAB flotante + panel expandible para lectura en voz alta
- `src/layouts/footer/Footer.svelte` — info, about
- `src/layouts/auth/AuthModal.svelte` — login/register/recover
- `src/layouts/pwa/PwaManager.svelte` — install prompt
- `src/store/stores.js` — stores globales (filter, selectedBibleVersion, themeMode, immersiveMode)
- `src/store/ttsStore.js` — TTS karaoke state (speed, ambient, volume, playback)
- `src/services/{auth,topics,favorites,apiClient}.service.js` — API-first con fallback
- `src/services/tts.service.js` — SpeechSynthesis wrapper con highlighting palabra por palabra
- `src/services/music.service.js` — drone armónico procedural con Web Audio API
- `src/services/filter.service.js` — búsqueda local
- `src/services/i18n.service.js` — i18n
- `src/config/{bible-versions,config}.js` — configuración
- `src/components/AutoRead.svelte` — ~~eliminado~~ (reemplazado por TTS karaoke en Phase 4.1)

### Comandos
- `npm run dev` — Vite dev server (puerto 5173)
- `npm run build` — build a `dist/`
- `node scripts/generate-seo.mjs` — genera SEO pages tras build
- `node scripts/build-logo.js` — regenera todos los favicons
- `node workers/robible-api/dev-server.js` — emulador backend

### Service Worker
- Cache version: `robible-v18` (a bumpar con cada release)
- Pre-cachea: ambas Biblias, todos los assets, lang files
- Network-first para navegación
- Cache-first para assets/data/lang

---

## Historial de cambios recientes

**2026-08-31 — Phase 4.1 TTS Karaoke + Phase 4.6 SEO completados**
- **TTS Karaoke implementado**: lectura en voz alta con highlighting palabra por palabra usando Web Speech API. Drone armónico procedural con Web Audio API (música de fondo gratuita, sin dependencias externas). FAB flotante con panel expandible. Velocidades 0.75×, 1×, 1.25×, 1.5×. Ambient: sin música / drone ambiental. Volúmenes independientes. SW bumpeado a v18.
- **SEO mejorado**: `generate-seo.mjs` ahora genera `sitemap.xml` automáticamente en `public/` y añade hreflang a todos los chapter/verse URLs. `sitemap.xml` actualizado con rutas estáticas (`/indice`, `/favorites`, `/notes`, topics).
- **Build**: v1.1.0, bundle 237kb/67kb gzip.

**2026-08-28 — Puntos 1-2-3-4 del plan completados + SEO añadido**
- **Bug buscador RESUELTO**: `Sidebar.svelte` limpia automáticamente `book` cuando `testament='all'` y hay un book guardado del estado anterior. Verificado: 200 resultados vs 0 antes.
- **AutoRead eliminado**: componente + store + i18n keys + SW cache bumpeado a v15. Bundle debería bajar ~5-10kb.
- **Hamburger animado**: botón en Navbar reemplaza al logo de marca. 3 líneas → X con CSS transitions. aria-expanded/aria-controls para accesibilidad.
- **Menus fuera del .result**: `verse-compare-menu` y `save-topic-menu` ahora son `position: fixed` con coordenadas calculadas vía `getBoundingClientRect()`. z-index 50/55.
- **SEO review añadido (Phase 4.6)**: checklist recurrente con Core Web Vitals, Schema.org, Open Graph, hreflang, sitemap, robots.txt, etc.
- TTS (Phase 4.1) queda para más adelante, según indicación del usuario.

**2026-08-28 — Plan reescrito + nuevos pendientes**
- Limpieza de datos de producción: 5 usuarios de prueba borrados, queda solo `dbindea`
- CORS: añadido `robible.com` y `www.robible.com`
- Logo rediseñado con nuevo emblema
- Bug del buscador detectado (estado guardado con `book: []` pero `testament: 'all'`)
- Phase 3.3 / 3.4 / 3.5 planificadas (notas, búsqueda persistente, nickname hints)
- Phase 4.1 (TTS con highlighting) definida como punto fuerte
- Phase 4.5 (eliminar auto-advance + historial) planificada

**2026-08-28 — Phase 3.2 backend desplegado**
- Backend en producción: `https://robible-api.robible.workers.dev`
- 17 queries ejecutadas en D1, schema aplicado
- Subdominio `robible` registrado para workers.dev
- JWT_SECRET configurado (32-byte hex)
- E2E verificado con Playwright: register, login, favorites, multi-device

**2026-08-27 — Phase 2.2 + 2.3**
- Índice temático completo (Topics CRUD, verse_refs, favoritos por categoría)
- Auto-advance con timer (será reemplazado por TTS en 4.1)
