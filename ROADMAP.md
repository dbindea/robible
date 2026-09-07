# RoBible — Roadmap

> Documento vivo. Actualizado en cada milestone.
> Última actualización: **7 sep 2026** (Fases 2-7: UX móvil · perfiles · player y música · «Predicile mele» con Modo Amvon offline · cinco paletas, cristal e iconos nuevos)

> Documentación de referencia: [CLAUDE.md](CLAUDE.md) · [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) · [docs/OPERACIONES.md](docs/OPERACIONES.md)
> Deuda técnica detectada: [docs/AUDITORIA-2026-09-04.md](docs/AUDITORIA-2026-09-04.md)

---

## Resumen ejecutivo

RoBible es una app web (PWA) de la Biblia con soporte offline, auth multi-device, índice temático (con temas compartibles), favoritos, notas y subrayados sincronizados, y lectura acompañada de música. **Cuatro** Biblias con datos (`vdc`, `rvl`, `en_kjv`, `zh_cuv`) e interfaz traducida a cuatro idiomas. Construida con Svelte 5 + Vite, SCSS, datos JSON estáticos, backend en Cloudflare Workers + D1.

**Stack:**
- Frontend: Svelte 5 (sintaxis legacy, no runes) + Vite 8, SCSS themeable (light/dark)
- Data: JSON estáticos en `/public/data/{vdc,rvl,en_kjv,zh_cuv}/bible.{map,json}` — entre 3 y 4,3 MB por Biblia
- i18n: propio, sin librería. JSON en `/public/lang/{ro,es,en,zh}.json`
- PWA: manifest + service worker (cache-first, versiones) — hoy `robible-v27`
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

### Fase 2 — Corregir el UX existente ✅ COMPLETADA (2026-09-07)

| # | Qué | Qué había realmente |
|---|---|---|
| 2.A ✅ | Selector idioma/versión con código corto visible (`RO · Biblia Română`) | Mostraba sólo el nombre del idioma |
| 2.B ✅ | Historial de búsqueda: 3 visibles, desaparece al escribir | Hacía scroll con 4; nada lo cerraba al teclear |
| 2.C ✅ | Abreviaturas de libro (`prov 3 4`), sin recuento de resultados, sin auto-salto | **Fallaban 8 de 11 abreviaturas comunes** |
| 2.D ✅ | Conservar el texto al cambiar palabras ↔ referencia | Se borraba **a propósito**; hubo que invertir la decisión |
| 2.E ✅ | Versículo: sólo copiar; el resto de acciones al seleccionar | Siete iconos permanentes |
| 2.F ✅ | El color del usuario sustituye al azul del estado activo | Fallo de especificidad: **sólo se veía en tema oscuro** |

**Lo que costó más de lo que parecía:**
- **El fallo de la búsqueda por referencia no estaba en la búsqueda.** Buscar, borrar con el aspa, teclear otra vez y tocar la sugerencia no navegaba porque el store `filter` entregaba **el mismo objeto** a `Sidebar` y a `Result`: mutarlo desde uno no disparaba la reactividad del otro. El store copia ahora en cada escritura.
- **`isPlausiblePrefix` rechazaba cualquier prefijo más de 4 caracteres más corto que el nombre.** Con 2 letras o más el prefijo ya es intencionado y se acepta; con una sola se mantiene la guarda. Eso desbloquea `prov`, `deut`, `apoc` y `ps` → Psalmii.
- **Un `{#if isVerseSelected(item.key)}` escondía la dependencia al compilador de Svelte**, así que los iconos no aparecían nunca. Comparando la variable directamente funciona (trampa 21).
- **En tema oscuro `:global(html[data-theme='dark']) .icon-btn` (3 clases) ganaba a `.icon-btn--marked` (2)** y devolvía el icono a azul mientras borde y fondo mantenían el color del usuario. Resuelto con `:not(.icon-btn--marked)`.

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

### Fase 5.B — Preparación guiada, documento final y schiță ✅ COMPLETADA (2026-09-07)

- [x] `sermon-content.service.js`: forma del documento, recuento, generación de la schiță (todo puro y probado)
- [x] Ruta `/predici/:id` con los siete pasos: TEXT → OBSERVARE → CONTEXT → IDEE → STRUCTURĂ → DEZVOLTARE → FINALIZARE
- [x] Marcado de palabras sobre la perícopa, asociado a esa predicación
- [x] Contexto anterior y posterior, abiertos sin salir de la preparación
- [x] Estructura con dos niveles, reordenable
- [x] Guardado automático con «Salvat» discreto; sin botón de guardar
- [x] Documento final con recuento de palabras y minutos
- [x] Schiță generada desde la estructura y **completamente editable**

**Decisiones que conviene no deshacer:**
- **Nada es obligatorio.** Ningún paso bloquea al siguiente y todas las preguntas se pueden saltar. La aplicación acompaña, no examina.
- **La schiță se genera una sola vez** y luego no se regenera sola: pisaría los retoques hechos a mano. Hay un botón explícito para rehacerla.
- **La aplicación de la schiță va recortada.** El propósito se escribe con calma en el estudio y puede ocupar un párrafo; volcarlo entero convertiría la schiță en el resumen largo que no debe ser. Un test comprueba que una predicación de más de 1.500 palabras produce una schiță de 250 o menos.
- **El recuento no cuenta la observación ni el contexto**: son notas de estudio, no se leen en el púlpito. Contarlas daría una duración falsa.
- **Se guarda sin esperar al retardo al cambiar de paso y al salir de la pantalla.** Son los dos momentos en que se puede perder lo tecleado.
- `normalizeContent` completa lo que falte: un documento guardado por una versión anterior reventaría la pantalla con el trabajo del predicador dentro.

**Verificado en el navegador**: recorrido completo de los siete pasos —marcar dos palabras, idea central, dos puntos con subpunto, desarrollo, introducción y conclusión—, documento final con sus títulos y subtítulos, schiță generada con los títulos en mayúsculas, y todo persistido en el dispositivo.

### Fase 5.C — Modo Amvon ✅ COMPLETADA (2026-09-07)

- [x] `sermon-pulpit.service.js`: instantánea offline, posición, tamaño, cronómetro, `wakeLock` y recuperación
- [x] «Pregătită pentru predicare» deja en el dispositivo predicación, schiță, perícopa y el **texto** de las referencias
- [x] Antesala con tres comprobaciones, tamaño de letra (A− A A+) y duración prevista
- [x] Púlpito a pantalla completa: sin menú, sin cabecera, tipografía grande, página vertical continua
- [x] Referencias en overlay, con vuelta exacta a la misma posición del scroll
- [x] Recuperación tras interrupción desde `main.js`, con ventana de seis horas

**Decisiones que conviene no deshacer:**
- **La instantánea guarda el TEXTO de las referencias, no sus coordenadas.** Resolverlas contra la Biblia en memoria funcionaría casi siempre; «casi siempre» no vale en un púlpito. Si la Biblia no llegó a cargarse, el predicador se quedaría mirando un versículo vacío delante de la congregación.
- **Una referencia que no se puede resolver se guarda vacía, no se omite.** En el púlpito se lee «no disponible», que es honesto; quitarla haría desaparecer un botón que el predicador espera encontrar.
- **Es una capa propia a pantalla completa (`fixed inset:0`), no el modo inmersivo de la lectura.** El inmersivo esconde la interfaz pero deja debajo la lógica de lectura entera —swipe, iconos, player—: cualquiera de esas cosas apareciendo a mitad de una predicación es exactamente lo que no puede pasar.
- **Los controles de tamaño no siguen en pantalla.** Se elige antes de empezar. Lo que se toca por accidente en el atril se toca.
- **La ventana de recuperación es de seis horas.** Sin límite, un Modo Amvon olvidado secuestraría el arranque de la aplicación meses después; con menos, una interrupción larga te dejaría fuera.
- **`wakeLock` degrada en silencio.** Si el navegador no lo permite no se bloquea el modo ni se avisa: un predicador con un aviso rojo en pantalla está peor que uno que toca el móvil de vez en cuando. Se vuelve a pedir al recuperar la visibilidad, porque el navegador lo suelta al ocultar la pestaña.
- **Ni una petición de red mientras se predica.** Todo sale de `localStorage`.

**Verificado en el navegador (escenarios 5 y 6)**: con la **red cortada**, las tres comprobaciones en verde, el púlpito a pantalla completa con la letra a 37,6 px, las referencias abriéndose desde la instantánea y **cero peticiones de red** en todo el recorrido. Bajando al punto 2 (609 px), saliendo a la raíz y volviendo, la aplicación reabre la misma predicación en Modo Amvon en la posición **exacta**; abrir y cerrar una referencia también devuelve a 609.

**Dos observaciones de la prueba:**
- Google Analytics dispara **una** petición al cambiar de ruta al entrar en Amvon. No sale del código del módulo y falla en silencio sin conexión, pero conviene saberlo.
- Quedan ~30 claves en rumano dentro del español fuera de `auth` (ver Fase 3).

### Fase 7 — Cinco paletas, cristal y iconos nuevos ✅ COMPLETADA (2026-09-07)

- [x] **Cinco paletas** en lugar del interruptor día/noche: Lumină · Noapte · Sepia · Minimal · Nocturn
- [x] Selector con muestra real de cada paleta y una pista de para qué sirve, en los cuatro idiomas
- [x] **Migración de la preferencia**: quien tenía `light`/`dark` guardado cae en Lumină/Noapte y no pierde su elección
- [x] Cristal esmerilado con bordes sobre transparencia en las superficies fijas
- [x] Movimiento unificado en tres duraciones y una curva de salida
- [x] **94 SVG inline → `Icon.svelte`** con trazos de Phosphor (MIT) copiados al árbol
- [x] SW bumpeado a `robible-v27`; 183 tests (12 nuevos de paletas)

**Lo que había que arreglar antes de poder hacer nada:**

Las paletas no eran el trabajo; el trabajo era que se pudieran tener. `global.css`
estaba bien montado, pero los componentes se lo saltaban: **~60 reglas
`html[data-theme='dark']`** repartidas por 15 ficheros, con **123 colores hex** y
**~170 rgba** escritos a mano. Esos valores son correctos en oscuro y falsos en
las otras cuatro paletas. Hoy **no queda ninguna regla por tema en ningún
componente**.

**Decisiones que conviene no deshacer:**
- **Los derivados se calculan desde `--color-ink`.** El tema claro ya mezclaba contra `--color-bg-dark` y el oscuro contra `rgb(255 255 255)`: dos dialectos para lo mismo. Como la tinta cambia con la paleta, un único `color-mix` da el valor correcto en las cinco. Eso convirtió ~30 reglas en cuatro tokens.
- **`--color-white` no es un color de texto.** Significa "fondo de tarjeta". Se usaba también como texto sobre el acento en 17 sitios, y en oscuro eso ya pintaba gris marengo sobre azul — un bug que llevaba ahí desde que existe el modo oscuro. Ahora es `--color-on-primary`.
- **El sidebar conserva sus blancos, pero con nombre.** Es chrome oscuro en las cinco paletas, así que su primer plano siempre es tinta clara: `--color-on-sidebar`, que en sepia se entibia sin tocar 18 reglas.
- **El velo de los diálogos va por paleta y no derivado.** Un scrim es siempre oscuro, también en las paletas oscuras; derivarlo de la tinta lo habría vuelto blanco en nocturn.
- **`tests/palettes.test.js` compara los cinco bloques token a token.** Un token que falta no falla: hereda el de Lumină, y el síntoma es un panel blanco en mitad de nocturn que sólo se ve cambiando de paleta a mano. El test cazó dos huecos reales (`--color-accent-ink`) el mismo día que se escribió.
- **El cristal, sólo en lo que está fijo.** Cada capa con `backdrop-filter` se recompone en cada fotograma del scroll: en un capítulo largo serían 40-80 capas y la lectura —lo único que esta app hace todo el rato— pierde fluidez en cualquier Android que no sea de gama alta. Navbar tampoco lo lleva: no es sticky, se va con el scroll. El Modo Amvon queda fuera a propósito.
- **Los botones de acción llevan cristal teñido de acento** (`--glass-accent`), no el neutro: con el neutro perdían el color y dejaban de leerse como botones.
- **Iconos copiados, no instalados.** Phosphor (MIT) vía `scripts/build-icons.mjs`; cero dependencias en tiempo de ejecución, coherente con el resto del proyecto. Se descartó Lucide **precisamente por ser el sucesor de Feather**: misma geometría, mismo trazo — habría sido tocar 94 sitios para que se viera igual. Los iconos parecían antiguos porque eran Feather de 2017.
- **El peso `fill` sustituye a `getFilledTopicIconSvg`**, que fabricaba la versión rellena quitando `fill="none"` de una cadena con un `replace`. Y el badge de tema metía un `<svg>` dentro de otro `<svg>`.
- **Las 14 claves de icono de tema están en D1** (`topics.icon`), ahora listadas en `src/config/topic-icons.js`. Antes la tabla estaba **copiada con los SVG dentro en tres ficheros** que tenían que coincidir y nadie comprobaba. De paso se arregló que `light` y `sun` dibujaran exactamente el mismo sol.

**Efecto en el bundle**: CSS 183 kB → **170 kB** (−13 kB, al desaparecer las reglas por tema); JS 369 kB → 371 kB (+2 kB netos: entran los trazos de 45 iconos y salen 94 SVG inline).

⚠️ **Sin verificación en navegador**: el servidor de Playwright no conectó. Verificado con `npm run lint` (0 errores), `npm test` (183/183) y `npm run build`, más el test de paridad de paletas. Falta pasar las cinco paletas por la pantalla.

### Fase 7.1 — Correcciones tras la primera revisión visual ✅ (2026-09-07)

Tres cosas que sólo se ven abriendo la aplicación, reportadas con capturas:

- **El panel del player salía en blanco.** Tres causas encadenadas: nueve `@media (prefers-color-scheme: dark)` que responden al **sistema operativo** y no a la paleta elegida; tres tokens que nunca existieron (`--color-text`, `--color-text-secondary`, `--border-color-dark`) escritos como `var(--inexistente, var(--real))`, así que el primero era decorado; y `color: var(--color-line)` en el desplegable — `--color-line` es el token de **borde**, una tinta al 14 %, de ahí el texto invisible. El desplegable lleva ahora `appearance: none` con la flecha dibujada aparte, porque el nativo de Windows ignora `color` y sale gris sobre gris.
- **Los botones de capítulo anterior/siguiente se solapaban con el footer**, que es fijo, y quedaban debajo sin poder pulsarse. Pasan al centro vertical (`top: 50%` + `translateY(-50%)`). El keyframe de entrada animaba `translateY`, que habría anulado el centrado: ahora sólo anima opacidad.
- **Minimal fuera, Cald dentro.** La paleta monocroma dejaba tinta fuerte y chrome a un paso el uno del otro, y ya había dos paletas oscuras. La sustituye la crema y cobre con la que nació la landing (`#F5F0E6` / `#FAF6EE` / `#B8763E`, recuperados de su primer commit).
- **Y el fallo de fondo que destapó lo anterior**: el sidebar fijaba su color de fondo pero **no el del texto**, así que todo lo que no llevaba color propio heredaba la tinta oscura del `body`. Sobre el chrome oscuro del sidebar, los dos títulos de sección salían negro sobre negro — en las cinco paletas, no sólo en Minimal. Arreglado en un sitio con `--color-on-sidebar`.

### Fase 7.2 — Contraste medido en las cinco paletas ✅ (2026-09-07)

`tests/contrast.test.js` calcula el contraste WCAG 2.1 de **26 pares por paleta**
(4.5:1 para texto, 3:1 para iconos y bordes con significado). La primera
ejecución falló en **cuatro de las cinco**:

| Paleta | Qué falló | Antes | Ahora |
|---|---|---|---|
| lumina | texto del botón de acento | 3.30:1 | **5.54:1** |
| lumina | ámbar de favorito sobre tarjeta | 2.94:1 | **4.92:1** |
| noapte | texto del botón de acento | 2.38:1 | **7.58:1** |
| noapte | el mismo, en hover | 1.87:1 | **9.67:1** |
| sepia | acento sobre el chrome del sidebar | 1.22:1 | **4.52:1** |
| cald | texto secundario sobre la página | 4.42:1 | **4.90:1** |
| cald | texto del botón de acento | 3.60:1 | **5.31:1** |

**Dos de estos venían de antes de que hubiera paletas**: el blanco sobre el azul
de la casa lleva fallando AA desde siempre, y el ámbar de favorito también.

**Lo que se decidió:**
- **El acento pasa a tener dos tokens.** `--color-accent` sigue siendo el azul de RoBible y vale para bordes e iconos (3:1, pasa de sobra). Como **fondo bajo texto** no valía, así que ahí va `--color-accent-solid`, el mismo acento oscurecido. Se prefirió esto a oscurecer `--color-accent` a secas, que habría cambiado el color de la marca en toda la aplicación para arreglar un problema que sólo aparece bajo texto. 35 rellenos migrados.
- **En las paletas oscuras el acento es claro, así que lo que va encima es oscuro.** `--color-on-primary` pasa a ser `--grey-900` en Noapte. Para poder hacerlo hubo que sacarlo antes del sidebar: allí no era texto sobre un botón, era texto sobre chrome oscuro —el propio comentario del archivo lo decía— y ahora usa `--color-on-sidebar`. Ocho usos movidos, dos se quedaron porque ahí el fondo sí era el acento.
- **`--color-accent-soft` significa "acento sobre chrome oscuro"** y en Sepia estaba puesto un cobre oscuro. Sobre el sidebar marrón daba 1.22:1, es decir, invisible.

Contraste final de los pares principales:

```
paleta     cuerpo/página  secundario/tarjeta  acento/tarjeta  botón   sidebar
lumina         6.85            4.97               5.54         5.54    7.49
noapte        14.16            8.32               8.73         7.58   13.56
sepia          7.51            5.05               6.70         5.12    8.36
cald           8.13            5.17               5.04         5.31    8.57
nocturn       16.55            7.72              11.87         9.80   19.80
```

### Fase 7.3 — Revisión pantalla por pantalla ✅ (2026-09-07)

Con Playwright ya conectado, recorrido de las cinco paletas en escritorio
(1440×900) y móvil (390×844): lectura, comparación, índice, menú, selector de
paletas, modal de autenticación, modo inmersivo y player.

**Lo que se encontró y arregló:**
- **El deslizador de volumen tenía la pista negra.** No era el tema oscuro ni el navegador headless: **`accent-color` hace que Chromium pinte la parte sin rellenar casi negra**. Comprobado poniendo un `range` sin estilos al lado de otro que sólo llevaba `accent-color`. La pista y el pulgar se dibujan ahora a mano en `global.css`, con el relleno pasado en `--range-fill`.
- **El botón de subir y el de modo lectura quedaban debajo del player** (z-index 8 y 50 contra 60): se veía asomar media pastilla. Había un apaño previo al mismo problema —`bottom: 3.5rem !important` con la altura a ojo— que además ganaba a cualquier arreglo posterior. Ahora el player mide su altura real con `ResizeObserver` y la publica en `--player-offset`; los otros dos se apartan, también con el panel abierto (101 px cerrado, 228 px abierto).
- **El botón del pie parecía la media luna que sustituye**: sus tres franjas eran fondo/superficie/acento, y en las paletas claras las dos primeras son el mismo blanco. Pasan a fondo/acento/tinta.
- **Las muestras de Sepia y Cald se confundían** en el selector: el acento era una línea de 0,16 rem. Ahora es más gruesa y la tarjeta lleva borde, que es lo que las separa cuando fondo y superficie están a un paso.
- **El breadcrumb se quedaba en 3,74:1** en las tres paletas claras: usaba `color-mix(…, white)` con blanco **literal**, que no se adapta. Cuatro colores de texto más estaban lavados igual.
- **El botón verde «Citește cu muzică»**: 3,13:1. Mismo caso que el acento, y misma solución — `--color-success-solid`.
- **El eyebrow del menú** usaba `--color-accent` como texto: 3,02:1 en Lumină.

**Cómo se encontraron los cuatro últimos:** un barrido en el navegador que recorre
cada elemento con texto en las cinco paletas, resuelve su fondo real subiendo por
el árbol y calcula el contraste. Es lo que ve cosas que el test de tokens no
puede: allí se comprueba que el token sea correcto, aquí que el componente use el
token correcto. Terminó en **cero fallos en las cinco paletas**, con el player y
el menú abiertos.

Un aviso sobre el método: la primera pasada dio cuatro falsos positivos porque
`color-mix()` devuelve `color(srgb 0.89 …)` con los canales en 0-1, y el parser
los estaba dividiendo entre 255. El fallo era de la medición, no de la aplicación.

**Playwright**: configuración global arreglada (`@latest` → `@0.0.80`). `@latest`
obliga a consultar el registro de npm en cada arranque y eso se comía el margen
de 60 s del handshake; con la versión fija arranca en 4,3 s.

**Y una regresión de la propia migración de iconos, encontrada al revisar la
lista de pendientes:** al pasar los 94 SVG sueltos a `<Icon>`, las **17 reglas**
`.contenedor svg { width; height }` dejaron de alcanzar al icono —el scoping de
Svelte le pone otra clase— y se quedaron muertas. Los iconos volvieron al tamaño
por defecto sin que nada fallara, y dentro de un botón estrecho el
`max-width: 100%` que `global.css` da a todo `svg` recortaba el ancho y no el
alto: el icono de acción del versículo salía a **13×16 px**, deformado. Ahora el
tamaño se pasa con `--icon-size` en el contenedor y `Icon.svelte` lleva
`max-width: none`. Verificado en pantalla: los cuatro iconos medidos salen
cuadrados y al tamaño pedido. **Lo delató el aviso de "Unused CSS selector" del
build**, que conviene no ignorar.

### Fase 7.4 — Música y apilado de diálogos ✅ (2026-09-07)

**El player no respondía a los mandos.** Diagnosticado midiendo la salida de audio
real: se coló un `AnalyserNode` antes del `destination` y se comparó nivel y
centroide espectral en cada transición. Dos fallos, ambos de diseño:

- **Todo colgaba de un único nodo de ganancia**, el mismo que regula el volumen del usuario. `stop()` programaba un desvanecido de un segundo sobre él y el `play()` siguiente lo cancelaba para hacer su propio fundido de entrada: **la pista vieja seguía sonando, y subiendo de volumen, encima de la nueva**. Ahora cada reproducción tiene su `voiceGain` propio; apagar una no toca a la otra y `musicGain` queda sólo para el usuario — antes cada `play()` lo reescribía y borraba el nivel del deslizador.
- **El apagado se remataba con `node.stop(cuando)`, sobre el reloj del contexto.** Al pausar se llama a `suspend()` y ese reloj se congela, así que un stop programado **no llega nunca**: la pista quedaba viva y volvía a sonar en cuanto algo reanudaba el contexto. Ahora se desconecta con `setTimeout`, que es reloj de pared.
- **Los tres ambientes se sintetizaban sobre la misma tónica** (Do), así que sonaban a variaciones de lo mismo y el desplegable parecía no hacer nada. Cada uno tiene ya la suya: Re, La y Fa. Medido: los centroides pasan de 60/26/31 a 75/28/42.
- De paso, `activeVoices` crecía sin límite — ninguna voz se retiraba al acabar sola.

Verificado con el analizador: transición limpia (el nuevo ambiente domina ya a
1,4 s, antes se mezclaban) y nivel **exactamente 0** tras el stop, incluido el
caso de pausar antes de parar.

⚠️ Honestidad sobre el método: **no conseguí reproducir los síntomas con
secuencias simples** —ni rápidas, ni con el contexto suspendido—. Los arreglos
salen de leer el código con las medidas delante, no de ver el fallo. Si algo
sigue sin responder, hay que volver a mirar.

**El selector de libros no se podía usar dentro del diálogo de predicación
nueva.** Un solo fallo con tres síntomas: `BookDrawer` estaba en z-index 20/21 y
el `Modal` en 110, así que el cajón se dibujaba **debajo** del velo — se veía
desenfocado, los clics no le llegaban, y al pulsar un libro el clic caía en el
velo, que cierra el diálogo. El cajón pasa a 120/121: por encima de cualquier
modal y por debajo del Modo Amvon (200). Verificado en pantalla: se elige el
libro, el cajón se cierra y la predicación sigue abierta.

**Los botones flotantes tapaban el pie al llegar al final de la página.** El
arreglo anterior los apartaba del player, pero no del pie: «Subir» y «pantalla
completa» caían justo encima de «Autentificare» y del selector de paleta, que
quedaban intocables — en móvil sobre todo, pero también en escritorio. El pie
reserva ahora esa franja como relleno inferior (`--floating-band` +
`--player-offset`), así que hay scroll de sobra y el orden de abajo arriba queda:
player → flotantes → botones del pie. Los tres flotantes comparten además la
misma línea base, para que se lean como una fila. Verificado en móvil (390×844) y
escritorio (1440×900), con el player parado y en marcha.

**Y el arreglo de los iconos destapó otro, en los dos botones de la landing:** siete
llamadas tenían `size="18"` sin unidad. Como atributo del `<svg>` eso era válido
—y por eso nadie lo notó—, pero al pasar el tamaño a CSS `width: 18` se descarta
y el icono se dibuja a su tamaño intrínseco: empujaba el texto a **una letra por
línea**. Corregidas las siete, y `Icon.svelte` convierte ahora un número suelto a
píxeles para que no vuelva a fallar en silencio.

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
- `workers/robible-api/src/sermons.js` — predicaciones (lista, detalle, creación, edición, borrado)
- `workers/robible-api/schema.sql` — D1 schema (versión 9)
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
