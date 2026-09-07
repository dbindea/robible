# RoBible — Roadmap

> Documento vivo. Actualizado en cada milestone.
> Última actualización: **5 sep 2026** (Phase 6.4: temas compartibles · cierre del audio · arreglo de caché de idiomas)

> Documentación de referencia: [CLAUDE.md](CLAUDE.md) · [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) · [docs/OPERACIONES.md](docs/OPERACIONES.md)
> Deuda técnica detectada: [docs/AUDITORIA-2026-09-04.md](docs/AUDITORIA-2026-09-04.md)

---

## Resumen ejecutivo

RoBible es una app web (PWA) de la Biblia con soporte offline, auth multi-device, índice temático (con temas compartibles), favoritos, notas y subrayados sincronizados, y lectura acompañada de música. **Cuatro** Biblias con datos (`vdc`, `rvl`, `en_kjv`, `zh_cuv`) e interfaz traducida a cuatro idiomas. Construida con Svelte 5 + Vite, SCSS, datos JSON estáticos, backend en Cloudflare Workers + D1.

**Stack:**
- Frontend: Svelte 5 (sintaxis legacy, no runes) + Vite 8, SCSS themeable (light/dark)
- Data: JSON estáticos en `/public/data/{vdc,rvl,en_kjv,zh_cuv}/bible.{map,json}` — entre 3 y 4,3 MB por Biblia
- i18n: propio, sin librería. JSON en `/public/lang/{ro,es,en,zh}.json`
- PWA: manifest + service worker (cache-first, versiones) — hoy `robible-v25`
- Rutas: path-based custom (parsea `window.location.pathname`)
- Backend: Cloudflare Workers (`robible-api`) + D1 (`robible-db`), router Hono
- Auth: PBKDF2 + HMAC tokens persistidos en D1 (revocables), TTL 30 días

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

## Fases

### 🐛 Bug del buscador ("Toda la Biblia" devolvía 0 resultados) ✅ RESUELTO (2026-08-28)

- **Síntoma**: con "Toda la Biblia" seleccionada, buscar texto existente devolvía 0 resultados. Cambiar a NT y volver a All lo arreglaba.
- **Causa**: `localStorage` guardaba `form.book: [bookId]` de una búsqueda anterior. Al recargar, el radio mostraba "All Bible" pero `book` seguía restringido. `cleanBook()` solo se disparaba en `on:change`, no en la carga inicial.
- **Fix**: en `Sidebar.svelte` `onMount`, si `form.testament === 'all'` y `form.book.length > 0`, se limpian `book` y `chapter`.
- **Verificado**: con el estado bugueado inyectado (testament=all + book=[0]), al cargar la página el book se limpia y la búsqueda devuelve 200 resultados en vez de 0.

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

### Phase 4.1 — Lectura acompañada de música ✅ CERRADA (2026-09-05)

> **Ojo: esta fase ya no es "audio TTS".** Nació como lectura en voz alta con
> Web Speech API y terminó siendo otra cosa: música de fondo + resaltado del
> versículo que toca, sin voz. La decisión es de producto (la voz del navegador
> no da la calidad que pide un texto bíblico), no una implementación a medias.
>
> Lo de abajo se conserva como historia de lo que se llegó a construir con voz.
> **Nada de eso está hoy en el código**: `tts.service.js` se retiró el 5 sep 2026.
> Lo que queda vivo es el FAB, el mini-player, la velocidad, el ambiente musical
> y el modo inmersivo. El nombre `tts` sobrevive en el store, el componente y las
> claves de i18n/localStorage por herencia; renombrarlo sería un cambio atómico.

- [x] Web Speech API: `SpeechSynthesisUtterance` con `lang` según versión bíblica (ro-RO, es-ES)
      (Tenía un bug: `getBibleVersionConfigOrDefault()` sin argumento hacía que el idioma fuese siempre `ro`. Arreglado el 2026-09-04, hallazgo 1 de la auditoría.)
- [x] Voces preferidas: `selectVoice()` prioriza voces locales y de marca (Google > Microsoft) con fallback graceful
- [x] **Highlighting palabra por palabra**: `onboundary` + timings estimados + factor de calibración, con auto-scroll suave
- [ ] **Desde versículo**: **no implementado**. `playChapter()` siempre arranca en el versículo 0 (`playVersesSequentially(book, chapter, verses, 0)`)
- [ ] **Pantalla de búsqueda — "Leer resultados en voz alta"**: **no implementado**. `Sidebar.svelte` no tiene ninguna referencia al TTS
- [x] **Control de velocidad** — entregado como **0.75× / 1× / 1.5× / 2×** (el plan decía 1.25×; se cambió por 2×)
- [x] **Música de fondo opcional**: drone armónico procedural con Web Audio API, volumen independiente, loop mientras dura la lectura
  - [ ] Selector de ambiente ampliado (himno suave, canto gregoriano): **no implementado**, solo hay `none` y `procedural`. El comentario `'hymn'` en `ttsStore.js:33` no corresponde a nada
- [ ] Estado persistido `robible:tts:state`: **parcial**. Se persisten velocidad, ambiente y volúmenes (`robible:tts:{speed,ambient,volume,musicVolume}`); la posición y el estado de pausa **no** — `ttsState` está marcado explícitamente como no persistido
- [x] UI: FAB flotante en `Result.svelte` + panel expandible tipo mini-player en la parte inferior
- [x] Modo inmersivo automático al arrancar la lectura, y salida al parar

~~**Pendiente además**: los textos del mini-player están hardcodeados en `LABELS` dentro de `TtsPlayer.svelte`~~ — ya no: las 15 claves `app.tts.*` se usan todas desde la plantilla. Verificado el 5 sep 2026.

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
- [x] Impacto: reduce **~4,2 MB** de tráfico inicial por visitante (cada Biblia pesa 4,2 MB; 8,5 MB son las dos juntas)

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

### Phase 5.1 — Landing pública multiidioma ✅ COMPLETADA (2026-09-01/03)

> No estaba documentada: reconstruida el 2026-09-04 leyendo los commits `012473f`, `f75b971`, `66addb4`.

- [x] `src/layouts/landing/Landing.svelte` (1497 líneas): hero, features, FAQ acordeón, counters, CTA
- [x] Ruta `/landing`, cortocircuitada en `App.svelte` antes de montar `Main`
- [x] Redirect automático: `main.js` manda `/` → `/landing` si no hay usuario en localStorage. Los deep links no se redirigen
- [x] Selector de idioma independiente del de la Biblia, vía `?lang=ro|es|en|zh` (recarga la página para recargar el locale)
- [x] Micro-demo de búsqueda por referencia en el hero: descarga solo `bible.map.json` (2,5 KB), no la Biblia entera
- [x] SEO propio con `applyLandingSeoMetadata()` + hreflang de los 4 idiomas en el sitemap
- Pendiente: los counters muestran `users: null` — el dato real del backend no está conectado

### Phase 5.2 — i18n a 4 idiomas ✅ COMPLETADA (2026-09-01)

- [x] `public/lang/en.json` y `zh.json` completos (357 y 356 claves, a la par de `ro` y `es`)
- [x] Scripts auxiliares de traducción: `scripts/write-landing-translations.{cjs,py}`
- [x] `BIBLE_VERSIONS` amplía el catálogo con `en_kjv` y `zh_cuv`, ambas `available: false`
- ⚠️ **Ojo**: la interfaz está traducida a 4 idiomas pero solo hay **datos bíblicos en 2**. Un usuario que llega en inglés o chino ve la UI en su idioma y no encuentra Biblia. Ver [auditoría, hallazgo 10](docs/AUDITORIA-2026-09-04.md)

### Phase 5.3 — Búsqueda por referencia ✅ COMPLETADA (2026-09-01)

- [x] `src/services/referenceSearch.service.js` (356 líneas): parsea `Ioan 3:16`, `jn 3 16`, `1 Cor 13`, etc.
- [x] Fuzzy matching de nombres de libro por distancia de Levenshtein (tolera erratas)
- [x] Integrado en `Sidebar.svelte` (búsqueda principal y búsquedas recientes) y en el micro-demo de la landing
- [x] Verificado con tests: `tests/reference-search.test.js` (antes `scripts/test-reference-search.mjs`)

### Phase 5.4 — Sitemaps troceados ✅ COMPLETADA (2026-09-01/02)

- [x] `generate-seo.mjs` genera `dist/sitemaps/{static,books,chapters,topics,verses-N}.xml` con 45.000 URLs por archivo
- [x] `dist/sitemap.xml` pasa a ser el **índice** de sitemaps
- [x] hreflang de los 4 idiomas en las entradas de la landing
- [x] Cloudflare delante del dominio (commit `97a1a98`)
- Cinco rutas del sitemap (`/temas`, `/favoritos`, `/favoriti`, `/notas`, `/notite`) no existían en la app y devolvían soft-404. Retiradas el 2026-09-04 (hallazgo 5).

### Phase 6.1 — Subrayados de color por versículo ✅ COMPLETADA (2026-09-05)

- [x] D1 table `highlights(id, user_id, book, chapter, verse, color, created_at, updated_at)` con UNIQUE en `(user_id, book, chapter, verse)` — schema_version **6**
- [x] Endpoints `GET` / `POST` (upsert) / `DELETE` `/api/highlights`, incluidos en `/api/data/export`
- [x] `highlights.service.js` API-first con fallback a localStorage + `highlightsStore.js`
- [x] Sexto icono en el versículo, con la paleta en un `Modal`; repintar con el color actual lo quita
- [x] El versículo se pinta con `color-mix()` sobre `--highlight-color`: una sola regla vale para claro y oscuro
- **Paleta de cinco colores, no seis**: descontada la franja verde-turquesa (reservada al estado de lectura, trampa 13) queda un arco de ~210°, y con seis colores el amarillo y el naranja caían a 16° — como lavado al 26 % eran el mismo color. `tests/highlights.test.js` vigila las dos condiciones
- **El estado de lectura manda sobre el subrayado**: `.verse--user-highlight:global(.highlight-verse)` existe porque el scoping de Svelte le daba más especificidad al subrayado que a `.highlight-verse` de `global.css`

### Phase 6.2 — Compartir el versículo como imagen ✅ COMPLETADA (2026-09-05)

- [x] `verse-image.service.js`: dibujo procedural en `<canvas>` (degradado + halo + bokeh + viñeta), 6 fondos
- [x] Formatos 1080×1920 (estado de WhatsApp) y 1080×1080
- [x] Ajuste automático del cuerpo de letra y recorte con puntos suspensivos en los versículos largos
- [x] `navigator.share({files})` con descarga del PNG como alternativa
- [x] `VerseImageModal.svelte`, reutilizado desde el versículo y desde el diálogo del día
- **Sin fotos empaquetadas a propósito**: habría que versionar varios MB de JPG, resolver licencias y precachearlos en el SW. Mismo criterio que en `music.service.js`
- **El PNG se genera al cambiar la vista previa, no al pulsar "Compartir"**: iOS Safari exige que `navigator.share` salga del gesto del usuario y un `await toBlob()` por medio ya rompe esa condición

### Phase 6.3 — Versículo del día ✅ COMPLETADA (2026-09-05)

- [x] `scripts/build-daily-verses.mjs` → `public/data/daily-verses.json`: 283 referencias curadas, **validadas contra las cuatro versiones** y barajadas con semilla fija
- [x] `daily-verse.service.js`: elección determinista por fecha local (`días desde epoch % longitud`)
- [x] `DailyVerseModal.svelte`, montado en `App.svelte` fuera del `{#key $localeVersion}` para que no se remonte al cambiar de idioma
- [x] No aparece si la URL ya apunta a un versículo: quien llega de un enlace compartido viene a leer eso. En ese caso tampoco se marca como visto
- [x] "No volver a mostrar" persistente en `robible:dailyVerse:enabled`
- [x] `Modal.svelte` gana `fitContent`: en móvil la hoja se ajusta al contenido en vez de ocupar 92dvh fijos

### Phase 6.4 — Temas compartibles ✅ COMPLETADA (2026-09-05)

- [x] `topics` gana `is_public` / `public_slug` / `public_version` / `published_at` — schema_version **7**
- [x] `PATCH /api/topics/:id` acepta `isPublic` y `version`; el slug se genera una sola vez
- [x] `GET /api/public/topics/:slug` y `GET /api/public/topics`, **sin autenticación** y con rate limit
- [x] Ruta `/tema/:slug` + `PublicTopic.svelte`: se abre sin cuenta, con el texto resuelto desde la Biblia del cliente
- [x] Panel de publicar/copiar/compartir en el detalle del tema, con `navigator.share` y respaldo a copiar
- [x] `netlify/functions/topic-meta.mjs` para las etiquetas Open Graph al pegar el enlace en WhatsApp

**Decisiones que conviene no deshacer:**
- **La respuesta pública no lleva nada del usuario.** Ni id, ni nickname, ni fechas de cuenta. Un tema compartido no debe servir para averiguar quién lo escribió.
- **`/tema/:slug` no se traduce por idioma**, a diferencia de `indexPath` y compañía. El enlace se reparte por fuera y tiene que abrir igual sea cual sea la versión de quien lo recibe; con un path por idioma el mismo tema tendría varias URLs y el enlace se rompería al cambiar de versión.
- **Los temas de usuario van con `noindex, follow`.** Ver la nota sobre SEO más abajo.
- **Despublicar conserva el slug**: si el usuario vuelve a publicar, los enlaces que ya repartió siguen valiendo.
- **El listado público excluye los temas sin versículos**: publicar uno vacío daría una página en blanco.

**Sobre el SEO — lo que NO se hizo y por qué.** La idea original era que los temas de usuario fuesen indexables. No se ha hecho: indexar contenido escrito por usuarios llenaría el sitemap de páginas tituladas "aaa" o "mis versículos", que es contenido fino y Google lo penaliza — exactamente lo que se evitó al quitar las 31.000 páginas por versículo (trampa 6 de CLAUDE.md). El tráfico de cola larga sigue viniendo de las páginas curadas `/versiculos/*` de `generate-seo.mjs`, que hoy son **8 y solo en español**. Llevarlas a los cuatro idiomas (8 → 32 páginas de calidad controlada) es la continuación natural y está en los próximos pasos.

---

## Deuda técnica

Levantada en la revisión de traspaso del **4 sep 2026**. Detalle, evidencia y verificación en **[docs/AUDITORIA-2026-09-04.md](docs/AUDITORIA-2026-09-04.md)**.

15 hallazgos, **12 arreglados** el mismo día. Lo que queda:

| # | Hallazgo | Prioridad | Estado |
|---|---|---|---|
| 8 | 17 MB de PNG/SVG del pipeline de logo versionados en `robible/` (16 ficheros) | Info | ⚠️ Falta `git rm -r --cached robible/` |

Arreglados: idioma del TTS, `USE_BACKEND` en producción, idioma de las categorías por defecto, `SW_CACHE_VERSION` muerto, rutas fantasma del sitemap, configuración de ESLint (99 errores → 0), claves de traducción que faltaban en `es` y `zh`, rama muerta de `Landing`, adaptador D1 del dev-server, y el JSON-LD de FAQ que repetía la misma pregunta cinco veces.

**Hallazgo 13 cerrado el 5 sep 2026 — no era un bug.** La auditoría lo levantó como "la lectura con música no lee", pero CLAUDE.md ya lo describía como decisión de producto: la voz del navegador no da la calidad que pide un texto bíblico. Los dos documentos se contradecían. Resuelto a favor de la decisión de producto: se retiró `tts.service.js` (394 líneas huérfanas, no lo importaba nadie), se limpiaron los restos del store (`ttsVolume`, `ttsProgress`, `ttsDisplayState`, el ambiente `'hymn'` que nunca existió) y se renombró el botón, que era lo único que mentía — decía "Música + lectura" y ahora dice "Leer con música", con el usuario como sujeto. El `start_hint` ya era honesto ("los versículos se resaltan uno a uno").

**Hallazgo 2 cerrado el 5 sep 2026**: `VITE_API_BASE_URL` **sí está** configurada en Netlify. Verificado sobre el bundle de producción, que contiene `robible-api.robible.workers.dev` y no el fallback `127.0.0.1:8787`.

---

## Decisiones de arquitectura

### Backend (CF Workers + D1)
- **Schema versionado**: cada tabla tiene `_meta` row con `schema_version`. Migraciones futuras aplican diffs.
- **CORS**: lista explícita de orígenes (no `*`). En el futuro, considerar wildcard con allowlist dinámica.
- **Auth tokens**: HMAC-SHA256 firmados con `JWT_SECRET` + persistidos en `auth_sessions` (revocables). TTL: **30 días** (`SESSION_TTL_MS` en `utils.js`; el reset token, 5 min).
- **Passwords**: PBKDF2-SHA256 con 100k iter + salt aleatorio de 16 bytes. Mismo algoritmo que el mock del frontend (compatible con migración).
- **Rate limit**: persistente en D1 (sobrevive cold starts). Por IP+endpoint, ventanas minute y hour.
- **i18n backend**: solo se devuelven claves (ej. `siblings`), el frontend traduce.

### Frontend
- **Service interface**: cada `*.service.js` expone la misma API (CRUD + sync). El switch API/localStorage es interno. Permite migrar a backend sin tocar componentes.
- **Storage versionado**: `robible:topics:v1`, `robible:searches:v1`, etc. Migraciones automáticas al detectar version bump.
- **i18n por Biblia**: en la app el idioma se infiere de la versión bíblica activa (vdc → ro, rvl → es). No se mezcla. **Excepción**: la landing usa `?lang=` y es independiente, para poder captar tráfico en idiomas cuya Biblia aún no existe.
- **Dark mode**: `html[data-theme="dark|light"]` con CSS variables. Logo en navbar con clases `logo-bg` y `logo-accent` que se mantienen consistentes.
- **Responsive breakpoints**: 22rem (extreme), 40rem (mobile), 60rem (tablet), 80rem+ (desktop).

---

## Dirección de producto (7 sep 2026)

> **Los pendientes anteriores se han retirado.** La lista que había aquí (páginas SEO en
> cuatro idiomas, nickname hints, paths por idioma, avisos de lint, CAPTCHA…) ya no
> refleja hacia dónde va el producto. Se sustituye por la especificación de abajo.
>
> Especificación completa, con el análisis del código que la sostiene:
> **[docs/PLAN-2026-09-07.md](docs/PLAN-2026-09-07.md)**

El objetivo es doble: **limpiar el UX en móvil** y **abrir el producto a los predicadores**.

### Fase 2 — Corregir el UX existente

| # | Qué | Estado real encontrado |
|---|---|---|
| 2.A | Selector idioma/versión con código corto visible (`RO · Biblia Română`) | Hoy muestra sólo el nombre del idioma |
| 2.B | Historial de búsqueda: 3 visibles, desaparece al escribir | Ya hace scroll con 4; nada lo cierra al teclear |
| 2.C | Abreviaturas de libro (`prov 3 4`), sin recuento de resultados, sin auto-salto | **8 de 11 abreviaturas comunes fallan** |
| 2.D | Conservar el texto al cambiar palabras ↔ referencia | Hoy se borra **a propósito**; hay que invertir la decisión |
| 2.E | Versículo: sólo copiar; el resto de acciones al seleccionar | Siete iconos permanentes |
| 2.F | El color del usuario sustituye al azul del estado activo | Fallo de especificidad: **sólo se ve en tema oscuro** |

### Fase 3 — Perfiles (schema 8) — hecha, ver arriba

`user_type` (`user` | `preacher`) y `email` opcional en `users`. Pregunta de seguridad
escrita por el usuario, con respuesta de texto libre normalizada.

⚠️ Guardar email **revierte** el principio «sin PII» del README del worker. Hay que
actualizarlo. El envío de correo queda pendiente: hoy no hay proveedor.

### Fase 3 — Perfiles ✅ COMPLETADA (2026-09-07, schema 8)

- [x] `users` gana `user_type` ('user' | 'preacher') y `email` opcional
- [x] La pregunta de seguridad la **escribe el usuario**; se retira la lista de cinco
- [x] Respuesta de texto libre, normalizada al comparar (minúsculas, sin diacríticos, espacios colapsados)
- [x] `PATCH /api/auth/me` para cambiar tipo, email y pregunta
- [x] Formulario de registro con selector de tipo y email opcional
- [x] Desplegado en producción (versión `38b626b5`)

**Detalles que conviene no perder:**
- `normalizeSecurityAnswer` vive en `utils.js` y la usan **registro y verificación**. Si las dos rutas normalizaran distinto, el usuario escribiría la respuesta correcta y no entraría nunca: lo guardado es un hash.
- Con respuestas numéricas la normalización no cambia nada ("3" sigue siendo "3"), así que las cuentas antiguas no habrían perdido el acceso.
- `sec_question` vale ahora siempre `'custom'`; `LEGACY_SECURITY_QUESTIONS` se conserva sólo para traducir las claves de cuentas anteriores al recuperar el acceso.
- Cambiar de tipo **no borra nada**: verificado que las categorías sobreviven.
- El item de menú "Predicile mele" **no** se ha añadido todavía: llevaría a una ruta que aún no existe. Va con la Fase 5, donde tiene destino.
- ⚠️ El email **sólo se almacena**. El envío de correo necesita un proveedor y está pendiente. `workers/robible-api/README.md` está actualizado.

**Arreglo colateral**: la sección `auth` del español estaba **entera en rumano** (63 claves). Un usuario hispano veía el registro, el login y todos los errores en un idioma que no es el suyo. Corregido. Quedan ~30 claves más fuera de `auth` en la misma situación.

### Fase 4 — Player y música

Player como tarjeta flotante translúcida (con degradación si no hay `backdrop-filter`).
Tres ambientes **procedurales** extendiendo `music.service.js`: Ebraică (frigia dominante),
Rugăciune (drone grave), Liniște. Sin ficheros nuevos: cero licencias y offline por construcción.

### Fase 4 — Player y música ✅ COMPLETADA (2026-09-07)

- [x] Player como tarjeta flotante translúcida, con degradación si no hay `backdrop-filter`
- [x] Tres ambientes: **ebraică** (frigia dominante), **rugăciune** (grave y envolvente), **liniște** (suave)
- [x] Cada ambiente admite **fichero de audio opcional**; si no hay o falla, se sintetiza
- [x] Migración del valor guardado (`prayer` → `rugaciune`)
- [x] SW bumpeado a `robible-v26`

**Cosas que conviene saber:**
- El selector de ambiente **no tenía ningún efecto**: `TtsPlayer` llamaba a `musicService.play('prayer')` en duro, eligieras lo que eligieras. Ahora pasa el ambiente seleccionado.
- Se retiró un `@media (prefers-color-scheme: dark)` del player. Competía con `html[data-theme]`, que es como el resto de la app decide el tema, y dejaba el player en oscuro aunque el usuario hubiera elegido claro.
- `prayer-ambient.mp3` (CC0, «Contemplation» de Joth) pasó a llamarse `rugaciune.mp3`: es exactamente el uso que ya tenía, y así uno de los tres ambientes tiene audio real desde el primer día. Los otros dos suenan sintetizados hasta que haya pistas.
- Los ficheros de audio **no se precachean** en el service worker: son opcionales y precargar uno inexistente daría 404 en cada instalación. Caen bajo la regla cache-first de `/assets/`, así que se guardan en la primera reproducción.
- La transparencia va dentro de `@supports (backdrop-filter: ...)` con fondo opaco de base. Sin eso, en un navegador sin desenfoque el texto del player se leería sobre el contenido de la página.

**Verificado en el navegador**: los tres ambientes generan registros distintos (rugăciune 65-131 Hz, ebraică 131-262, liniște 262-494); la escala hebrea produce Do, Do#, Mi, Fa, Sol, Sol# — frigia dominante con la segunda aumentada característica; `rugaciune` reproduce desde fichero y los otros dos caen a síntesis.

### Fase 5.A — «Predicile mele»: cimientos y lista ✅ COMPLETADA (2026-09-07, schema 9)

- [x] Tabla `sermons` con `content_json` y `outline_json`
- [x] `GET/POST/GET:id/PATCH/DELETE /api/sermons`, desplegado (versión `319fbad1`)
- [x] `sermons.service.js` **local-first** + `sermonsStore.js`
- [x] Item "Predicile mele" en el menú, sólo para `preacher`
- [x] Ruta `/predici` con lista, filtros por estado, búsqueda y creación con vista previa de la perícopa

**Decisiones que conviene no deshacer:**
- **El servicio invierte el patrón del resto de la app.** Favoritos o notas son API-first con localStorage de respaldo; aquí manda lo local y el backend es la copia. El motivo es el Modo Amvon: un predicador en el púlpito no puede depender de la cobertura, y un guardado perdido por un wifi malo es trabajo tirado.
- **`updateSermon` devuelve `ok: true` aunque la subida falle.** Para el usuario el trabajo está guardado —lo está, en su dispositivo— y decirle lo contrario le haría repetirlo. El campo `synced` distingue los dos casos.
- **Los endpoints NO filtran por tipo de cuenta.** El tipo decide qué menús se ven, no de quién son los datos: si alguien vuelve a `user`, sus predicaciones siguen siendo suyas. Bloquear aquí las escondería sin borrarlas.
- **La lista no devuelve `content_json` ni `outline_json`.** Con veinte predicaciones preparadas la diferencia son megabytes en cada carga de pantalla.
- **Las fechas de preparada y predicada las pone el servidor**, derivadas del estado. Si las mandara el cliente podría afirmar que predicó algo el año pasado.
- La ruta `/predici` no se traduce por idioma: es privada, va con `noindex` y no gana nada teniendo cuatro formas.

**Verificado en el navegador**: el item aparece para el predicador y no para el usuario normal (escenario 4); crear desde la interfaz llega a pantalla, servidor y dispositivo; **cortando la red**, crear y editar siguen funcionando, quedan marcadas como pendientes, y la predicación creada sin conexión **sobrevive a la siguiente sincronización con su contenido intacto**.

**Pendiente (5.B y 5.C)**: la preparación guiada en siete pasos, el documento final, la schiță y el Modo Amvon.

### Fase 5 — Módulo «Predicile mele» (schema 9)

Sólo para `preacher`. Preparación guiada por pasos → predicación → schiță → **Modo Amvon
offline**. Una tabla `sermons` con `content_json` y `outline_json`: el árbol de preparación
nunca se consulta por dentro, siempre se carga entero.

**RoBible no escribe la predicación.** Sin IA, ni como dependencia ni como opción.

### Fuera de alcance

IA, chatbot, red social, predicaciones públicas, marketplace, comentarios, seguidores,
colaboración, editor tipo Word, ni roles más allá de Utilizator/Predicator.

---

## Stack técnico

> Mapa completo y comentado en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Aquí solo el índice.

### Backend
- `workers/robible-api/src/index.js` — Hono router + CORS
- `workers/robible-api/src/auth.js` — register, login, recover, me, logout, change-password
- `workers/robible-api/src/data.js` — topics, verse_refs, favorites, notes, highlights, searches, export, health
- `workers/robible-api/src/utils.js` — hashing, tokens (HMAC), validators, rate limit
- `workers/robible-api/schema.sql` — D1 schema (versión 7)
- `workers/robible-api/wrangler.toml` — bindings + env vars
- `workers/robible-api/dev-server.js` — emulador local con `node:sqlite`

### Frontend
- `src/main.js` — arranque, redirect a `/landing`, registro del SW
- `src/App.svelte` — carga Biblia + locale, layout raíz
- `src/layouts/main/Main.svelte` — grid principal + detección de ruta
- `src/layouts/main/Result.svelte` — vista lectura (swipe, nav, favs, notas, topics, TTS, SEO) — 2880 líneas
- `src/layouts/main/Compare.svelte` — comparar versiones
- `src/layouts/main/Index.svelte` — índice temático (con el panel de publicar)
- `src/layouts/main/PublicTopic.svelte` — tema compartido, visible sin cuenta
- `src/layouts/main/Favorites.svelte` — lista de favoritos
- `src/layouts/main/Notes.svelte` — notas agrupadas por libro
- `src/layouts/main/Sidebar.svelte` — filtros, búsqueda por texto y por referencia
- `src/layouts/main/BookDrawer.svelte` — selector de libro
- `src/layouts/landing/Landing.svelte` — landing pública multiidioma
- `src/layouts/header/Navbar.svelte` — hamburger, nav-links, version picker
- `src/layouts/header/AppMenu.svelte` — menú lateral
- `src/layouts/footer/Footer.svelte` — info, about
- `src/layouts/auth/AuthModal.svelte` — login/register/recover
- `src/layouts/pwa/PwaManager.svelte` — install prompt
- `src/components/TtsPlayer.svelte` — FAB flotante + panel expandible para lectura en voz alta
- `src/components/{IconPicker,ActionButton}.svelte`
- `src/store/stores.js` — stores globales (filter, selectedBibleVersion, compareWithVersion, themeMode, immersiveMode)
- `src/store/{auth,favorites,notes,highlights,topics,searches,tts,appMenu,authMenu}Store.js`
- `src/services/{auth,topics,favorites,notes,highlights,searches}.service.js` — API-first con fallback
- `src/services/apiClient.js` — cliente API + política de fallback (`withFallback`)
- `src/services/referenceSearch.service.js` — búsqueda por referencia con fuzzy matching
- `src/services/filter.service.js` — búsqueda por texto
- `src/services/bible-route.service.js` — construir/parsear rutas
- `src/services/seo.service.js` — metadatos en runtime
- `src/services/tts.service.js` — SpeechSynthesis wrapper con highlighting palabra por palabra
- `src/services/music.service.js` — drone armónico procedural con Web Audio API
- `src/services/i18n.service.js` — traductor propio
- `src/config.js` + `src/config/{bible-versions,seo}.js` — configuración
- `netlify/functions/{og-image,verse-meta,topic-meta}.mjs` — OG dinámico, metadatos de ruta legacy y OG de tema compartido
- `src/components/AutoRead.svelte` — ~~eliminado~~ (reemplazado por TTS karaoke en Phase 4.1)

### Comandos
- `npm run dev` — Vite dev server (puerto 5173, host 0.0.0.0)
- `npm run build` — build a `dist/` + `generate-seo.mjs`
- `npm run lint` — ESLint (**debe salir en 0 errores**; quedan 14 avisos deliberados)
- `node scripts/generate-seo.mjs` — genera SEO pages y sitemaps tras build
- `node scripts/build-logo.js` — regenera todos los favicons
- `npm test` — suite con el runner de Node (105 tests, sin dependencias)
- `node workers/robible-api/dev-server.js` — emulador backend

### Service Worker
- Cache version: **`robible-v25`** (a bumpar a mano en `public/sw.js` con cada release)
- `public/sw.js` es la **única** fuente de verdad de la versión de cache (la constante duplicada de `config.js` se eliminó el 2026-09-04)
- Pre-cachea: ambas Biblias, todos los assets, lang files
- Network-first para navegación · cache-first para assets y data · stale-while-revalidate para `/lang/`

---

## Historial de cambios recientes

**2026-09-04 — Revisión de traspaso**
- Documentación creada: `CLAUDE.md` (manual operativo), `docs/ARQUITECTURA.md`, `docs/OPERACIONES.md`, `docs/AUDITORIA-2026-09-04.md`
- `README.md`, `ROADMAP.md` y `workers/robible-api/README.md` puestos al día contra el código real
- Estado de Phase 4.1 corregido de "completada" a **parcial**: tres puntos del plan original no se implementaron (play desde versículo, lectura de resultados de búsqueda, ambientes musicales extra)
- 10 hallazgos de deuda técnica levantados, ninguno aplicado — ver la sección "Deuda técnica"
- Sin cambios en código de aplicación

**2026-09-01/03 — Landing, 4 idiomas, búsqueda por referencia** (reconstruido desde los commits)
- Landing pública en `/landing` con selector de idioma independiente (ro/es/en/zh), FAQ, counters y micro-demo de búsqueda por referencia
- Redirect de `/` a `/landing` para usuarios sin sesión
- `public/lang/en.json` y `zh.json` completos; `en_kjv` y `zh_cuv` añadidas al catálogo como `available: false`
- `referenceSearch.service.js`: parseo de referencias con fuzzy matching por Levenshtein
- Sitemaps troceados con índice; Cloudflare delante del dominio
- SW bumpeado a `robible-v19`
- Commits: `021d1a0`, `012473f`, `21a9f7b`, `f75b971`, `66addb4`

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
