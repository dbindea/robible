# RoBible — Roadmap

> Documento vivo. Actualizado en cada milestone.
> Última actualización: **11 sep 2026** (Predicación: citas visibles en el púlpito, versículos con barra en PDF y página pública, alineación del PDF y una traducción mixta corregida)

> Documentación de referencia: [CLAUDE.md](CLAUDE.md) · [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) · [docs/OPERACIONES.md](docs/OPERACIONES.md)
> Deuda técnica detectada: [docs/AUDITORIA-2026-09-04.md](docs/AUDITORIA-2026-09-04.md)

---

## Resumen ejecutivo

RoBible es una app web (PWA) de la Biblia con soporte offline, auth multi-device, índice temático (con temas compartibles), favoritos, notas y subrayados sincronizados, memorización de versículos, lectura acompañada de música y un módulo completo de preparación de predicaciones con Modo Amvon. **Cuatro** Biblias con datos (`vdc`, `rvl`, `en_kjv`, `zh_cuv`) e interfaz traducida a cuatro idiomas. Construida con Svelte 5 + Vite, SCSS, datos JSON estáticos, backend en Cloudflare Workers + D1.

**Stack:**
- Frontend: Svelte 5 (sintaxis legacy, no runes) + Vite 8, SCSS themeable (light/dark)
- Data: JSON estáticos en `/public/data/{vdc,rvl,en_kjv,zh_cuv}/bible.{map,json}` — entre 3 y 4,3 MB por Biblia
- i18n: propio, sin librería. JSON en `/public/lang/{ro,es,en,zh}.json`
- PWA: manifest + service worker (cache-first, versiones) — hoy `robible-v31`
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
- ✅ Cerrado (9 sep 2026): el contador `users: null` no se mostraba en ninguna parte y se retiró

### Phase 5.2 — i18n a 4 idiomas ✅ COMPLETADA (2026-09-01)

- [x] `public/lang/en.json` y `zh.json` completos (357 y 356 claves, a la par de `ro` y `es`)
- [x] Scripts auxiliares de traducción: `scripts/write-landing-translations.{cjs,py}`
- [x] `BIBLE_VERSIONS` amplía el catálogo con `en_kjv` y `zh_cuv`, ambas `available: false`
- ✅ Resuelto: hoy hay **datos bíblicos en las cuatro** (`vdc`, `rvl`, `en_kjv`, `zh_cuv`). El aviso de la auditoría (hallazgo 10) sobre llegar en inglés o chino y no encontrar Biblia ya no aplica. El service worker sigue precacheando sólo `vdc` y `rvl`: las otras dos se descargan la primera vez que se abren

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

## Siguiente release

Estado a **9 sep 2026**. La aplicación está desplegada y funcionando; esto es lo que queda.

### Listo para subir (en el árbol de trabajo, sin commitear)

| Qué | Por qué importa |
|---|---|
| Navegación entre colecciones curadas (`CuratedTopic.svelte`) | **Bug vivo en producción**: los chips de «Alte colecții» no hacen nada. Ir de `/versete/x` a `/versete/y` no cambia el tipo de ruta, así que `Main.svelte` no vuelve a montar el componente y `onMount` no se ejecuta otra vez |
| Rescate manual de cuenta (`AuthModal.svelte`) | Quien no recuerda su respuesta de seguridad se quedaba sin salida y se creaba otra cuenta |
| Texto del campo email en los 4 idiomas | Prometía «sólo para recuperar la cuenta» y no se usa para nada |
| `VAPID_SUBJECT` → `dbindea@gmail.com` | Es a donde escriben Google o Mozilla si los envíos de push dan problemas |

**El backend ya está desplegado** (schema 11, worker con el cron horario). El frontend lo sube el propietario.

### Pendiente de comprobar en el mundo real

- **Entrega de un push a un dispositivo.** La firma VAPID está verificada contra su propia clave pública y el cron desplegado, pero nadie ha recibido todavía una notificación. Se confirma suscribiéndose desde el móvil y esperando a la hora elegida. **En iOS hace falta tener la PWA instalada** (iOS 16.4+).
- **El aviso de actualización de la PWA.** El service worker va por `robible-v31`; quien la tenga instalada verá el aviso y tiene que aceptarlo. Purgar Cloudflare no cambia nada, porque responde el service worker.

### Candidatos para más adelante

Sin fecha ni compromiso. Por orden de valor aparente:

1. **Uso del email**, cuando haya volumen: validación de la cuenta o aviso al autor cuando su predicación recibe visitas. Hoy no se envía nada y no hay proveedor elegido.
2. **Estadísticas de repaso** en memorización: la columna `correct` llega al worker y **no se guarda**, a propósito, porque no hay pantalla que la lea. Si algún día se quiere una racha o un histórico, se añade la columna entonces.
3. **Sonido o vibración del aviso diario**, y poder elegir varios días de la semana en vez de todos.
4. **Precachear `en_kjv` y `zh_cuv`** sólo para quien las use: hoy se descargan la primera vez que se abren, y hasta entonces esas dos no funcionan sin conexión.
5. **Menús a ancho completo o bottom sheet en móvil** (heredado de la Phase 4.3, sin verificar si sigue molestando).
6. **Badge de notificaciones y tooltip al hover** en el sidebar (heredado de la Phase 4.2, sin verificar si sigue teniendo sentido).

### Lo que NO está pendiente aunque lo parezca

- Los **12 avisos de lint** son deliberados (`svelte/require-each-key`, `infinite-reactive-loop`). Son señales reales pero no bloqueantes; no se silencian sin mirarlas.
- **`tts.service.js` no existe** y no hay que reconectarlo: la lectura es música + resaltado, por decisión de producto. Todo lo que se llama `tts` es herencia del nombre.
- **No se generan páginas por versículo**, a propósito (ver trampa 6 de CLAUDE.md).

---

## Deuda técnica

Levantada en la revisión de traspaso del **4 sep 2026**. Detalle, evidencia y verificación en **[docs/AUDITORIA-2026-09-04.md](docs/AUDITORIA-2026-09-04.md)**.

15 hallazgos, **12 arreglados** el mismo día. **No queda ninguno abierto.**

| # | Hallazgo | Estado |
|---|---|---|
| 8 | 17 MB de PNG/SVG del pipeline de logo versionados en `robible/` | ✅ Cerrado (9 sep 2026): `git ls-files robible/` devuelve 0 ficheros. La carpeta sigue en disco, ignorada, porque es la fuente del pipeline del logo |

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
- El email **sólo se almacena, y así se queda por ahora** (decisión del propietario, 9 sep 2026). No hay envío de correo ni lo habrá hasta que haya volumen — entonces se valorará para validaciones o avisos. Mientras tanto, quien pierde el acceso y tampoco recuerda su respuesta de seguridad **escribe a `dbindea@gmail.com`** y la cuenta se recupera a mano contra D1; el diálogo de recuperación lo dice (`auth.recover_manual`). El texto del campo se cambió para no prometer lo que no hace: antes decía «sólo para recuperar la cuenta». `workers/robible-api/README.md` está actualizado.

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

Seguían aquí 5.B y 5.C —la preparación guiada, el documento final, la schiță y el
Modo Amvon—, hechas más abajo el mismo día.

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

Se entregó **sin verificación en navegador** —Playwright no conectaba entonces—,
sólo con lint, tests y build. Las cinco paletas se pasaron por pantalla después,
en la fase 7.3, que es donde salieron los fallos que faltaban.

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

### Fase 8 — Referencias, marcado y papel ✅ (2026-09-08)

Cuatro peticiones del predicador tras usar el módulo de verdad.

**Referencias a otros pasajes dentro del desarrollo.** Hallazgo al empezar: `refs`
**ya existía** en el modelo (en los puntos y en el desarrollo) y `collectReferences`
ya las recogía para el púlpito — pero **no había ninguna interfaz para añadirlas**,
así que siempre estaban vacías. La fontanería estaba puesta a medias. Ahora un
botón «+ Referință» abre el buscador que ya usa la Biblia (`searchReferences`), y
la referencia se guarda **con su texto bíblico resuelto**: en la schiță se ve sólo
la cita, y en el Modo Amvon se abre entera sin tocar la red.

**Marcado manual de palabras clave.** El corte automático adivinaba —se quedaba con
el principio de la frase, que casi nunca es lo que se quiere ver desde el atril—.
Ahora se selecciona el texto y se pulsa «Marchează»: la aplicación lo envuelve
entre asteriscos y eso es lo que sale en la schiță. El mismo botón desmarca. Si no
se marca nada, sigue funcionando el corte de antes, para que nadie se encuentre la
schiță en blanco.

**Impresión.** Sin librerías: `window.print()` y CSS de papel. El documento en
retrato y la schiță en apaisado a dos columnas con línea de doblez, para plegarla
por la mitad y llevarla en la Biblia. Se usan **páginas con nombre**
(`@page retrato` / `@page apaisado` + `page:` en el elemento), que es la forma
estándar de tener dos orientaciones en un mismo documento: `@page` no se puede
condicionar con una clase. Se imprime siempre en negro sobre blanco, sea cual sea
la paleta — en Nocturn una hoja negra se lleva el cartucho.

**Más sitio para escribir.** El contenedor pasa de 46rem a 69rem (+50%) y los
campos del desarrollo de 3 a 6 líneas; introducción y conclusión, a 8.

**Y un fallo que me comí yo, documentado en las trampas de este mismo repo:** el
botón de marcar no se activaba nunca porque la condición estaba envuelta en un
helper (`disabled={!haySeleccion(...)}`) y **Svelte sólo reacciona a lo que ve
escrito en la plantilla**. Es la trampa 23, tal cual. Comparando contra la variable
directamente funciona.

Verificado en pantalla el ciclo entero: seleccionar → marcar → desmarcar, buscar
«iacov 1 22» → elegir la sugerencia → la cita aparece en la schiță y llega al
púlpito con texto. 14 tests nuevos (203 en total).

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

### Fase 5.D — Predicación compartida, PDF y portada ✅ COMPLETADA (2026-09-08, schema 10)

- [x] **PDF con librería, sin servidor**: `sermon-pdf.service.js` sobre pdfmake, cargado con `import()` dinámico para que no engorde el bundle de quien nunca imprime. Predicación en vertical; schiță apaisada a dos columnas con línea de plegado
- [x] **Cuadernillo de cuatro caras** cuando la schiță no cabe en dos, con la imposición correcta (`4|1` delante, `2|3` detrás) para que al doblar por el lado corto se lea seguida. Con poco contenido se queda en una hoja a una cara, para no sacar dos caras en blanco. Cubierto en `tests/sermon-pdf.test.js`, que además falla si alguien vuelve al orden natural
- [x] **Publicar una predicación**: `is_public` + `public_slug` + `published_at` (schema 10), con el mismo mecanismo de slug irrepetible que los temas
- [x] **Vista pública de sólo lectura** (`/predica/<slug>`) sin cuenta, con botón de compartir el enlace
- [x] **Indexada a propósito**: `netlify/functions/sermon-meta.mjs` emite `index, follow`, JSON-LD de artículo y el texto real en el `<body>` para el rastreador sin JavaScript
- [x] **Sitemap dinámico** (`/sitemaps/sermons.xml`) servido por función, no generado en el build
- [x] **Sección en la landing** con las últimas publicadas
- [x] Marcado manual de palabras clave (`*palabra*`) y referencias a otros pasajes dentro del desarrollo

**Decisiones que conviene no deshacer:**
- **Una predicación publicada se indexa; un tema compartido no.** Son cosas distintas y por eso las funciones de Netlify difieren: `topic-meta` va con `noindex` porque un tema es un enlace que se pasa a alguien concreto, mientras que quien publica una predicación quiere que se encuentre.
- **El sitemap de predicaciones se sirve al vuelo.** Se publican entre despliegues; uno estático las dejaría fuera hasta la siguiente subida, que es justo lo que no puede pasar en algo que quiere funcionar como blog.
- **El endpoint público no devuelve el cuaderno de preparación.** `paraElPublico()` deja fuera observación y contexto: son apuntes personales, a menudo con dudas del propio predicador.
- **La lista de la landing no bloquea nada.** Si el worker no responde, la sección simplemente no se pinta: la portada es la puerta de entrada y no puede depender de que la API esté viva.

**Lo que costó más de lo que parecía:**
- **Los asteriscos del marcado manual se veían en la predicación publicada** («1. Pastorul care poarta de *grija*»). Se escapaban por seis sitios a la vez: vista pública, Modo Amvon, documento final, los dos PDF y el HTML del rastreador. Se corta ahora en origen, en `generateOutline`, y se limpia además en cada punto de presentación. `tests/sermon-content.test.js` lo vigila.
- **La sección de la landing salía en blanco.** Las tarjetas nacen con `data-reveal` y el `IntersectionObserver` se crea al montar, cuando aún no existen: nadie las observaba y se quedaban en `opacity: 0`. Se vuelve a barrer tras cargarlas.
- **Cinco tokens `--landing-*` que no existen.** `var()` de un token inexistente no falla: el fondo queda transparente y el borde cae a `currentColor`, así que la tarjeta se ve «casi bien». La landing no tiene tokens propios, usa los semánticos de `global.css`.
- **`app.topics.share.copy` no existía** (se llama `copy_link`), así que el botón de copiar el enlace mostraba el identificador en crudo. El test de i18n sólo comparaba los cuatro idiomas **entre sí**, y una clave ausente en los cuatro cuadraba perfectamente. Hay ahora un test que recorre `src/` y comprueba que toda clave usada exista.

### Fase 5.E — Guía de homilética, schiță editable y blog público ✅ COMPLETADA (2026-09-08)

- [x] **Guía de homilética contextual** (`Ajutor.svelte` + `src/config/homiletics.js`): una nota al margen por paso, sacada del curso de predicación expositiva del Institutul Teologic Penticostal din București
- [x] **Paso IDEE reordenado según el curso**: idea exegética → propósito → idea homilética → pregunta analítica, con el campo `idea.exegetical` nuevo
- [x] **La schiță se edita como listas de texto**: una idea por línea con guion, en `textarea` que respeta los saltos
- [x] **Siete pasos sin scroll horizontal** en móvil, y un indicador de en qué vista se está
- [x] **Blog público de predicaciones** (`/predici`) con búsqueda y filtros por tema, texto bíblico y año
- [x] La lista privada se muda a `/predicile-mele`

**Decisiones que conviene no deshacer:**
- **La guía va en línea, no en un modal ni en un tooltip.** Se lee mientras se escribe en el campo de al lado; un diálogo obligaría a cerrarlo para volver a mirar el texto, y en un globo flotante no caben cinco viñetas y un ejemplo.
- **El ejemplo es siempre Tito 2:11-14.** El curso lo usa de hilo conductor y ver la misma predicación avanzar paso a paso enseña más que siete ejemplos sueltos.
- **El orden del paso IDEE no es decorativo.** Primero lo que el texto dijo entonces, después lo que Dios quiere cambiar hoy, y sólo con esos dos delante la idea homilética. Invertirlo lleva a escribir la frase bonita y buscarle el respaldo bíblico después.
- **`/predici` es el blog público y `/predicile-mele` el cuaderno privado.** El plural suelto describe mejor «todas las publicadas» que «las mías», y deja corta la URL que se comparte y se indexa. Encaja además con `/predica/<slug>`: singular una, plural todas.
- **Los filtros del blog no van en la URL.** Serían mil variantes de la misma página para el buscador. Se resuelven en el navegador sobre la lista ya descargada, que son cabeceras y no predicaciones enteras.
- **Los ejes de navegación se calculan de lo publicado**, no de una lista fija: un desplegable con los 66 libros donde sólo cuatro tienen predicaciones son sesenta y dos callejones sin salida.
- **La serie es una columna, no parte de `content_json`.** El listado público filtra por ella, y filtrar por dentro de un JSON obligaría a cargar todas las predicaciones enteras.

**Lo que costó más de lo que parecía:**
- **El texto de las listas no puede derivarse del array mientras se escribe.** Al parsear, una línea vacía a media frase desaparece y el cursor salta al final en cada tecla. El `textarea` tiene estado propio y sólo se sincroniza al abrir o al regenerar.
- **El botón flotante de modo lectura se plantaba encima del guía.** El modo inmersivo esconde el cromo para *leer la Biblia*; sobre un formulario de preparación no significa nada. Fuera del módulo entero.
- **Los plurales rumanos.** «1 predici» y «1 puncte». El proyecto no tiene motor de plurales: el par singular/plural se elige en el punto de llamada, como en `app.topics.verse_count`.

### Fase 5.F — Descubrimiento del contenido público y tipos de predicación ✅ COMPLETADA (2026-09-08)

- [x] **Enlaces públicos en el pie**, tanto en la aplicación como en la landing: `/landing`, `/predici` y `/teme`. La lista es un array de tres líneas en `Footer.svelte`; añadir una sección más es una línea
- [x] **Índice de temas publicados** (`/teme`), con buscador
- [x] **El tipo de predicación deja de ser decorativo**: avisos propios para textual y temática en los tres pasos donde de verdad cambian, y el tipo visible en la cabecera de la preparación
- [x] Las pistas del selector de tipo describen ahora la decisión, no el formato

**Lo que había realmente:**
- **`GET /api/public/topics` existía desde el principio y ninguna pantalla lo pedía.** Un tema publicado sólo existía para quien recibía el enlace — no había forma de saber que los había, ni siquiera para quien los publicaba. Sólo faltaba la pantalla y el `fetchPublicTopics` del cliente.
- **El tipo de predicación no hacía absolutamente nada.** Se guardaba, se validaba en el worker y se pintaba en la lista; ni la preparación, ni la guía, ni el PDF lo miraban. El selector de tres opciones del diálogo de creación era decorativo.

**Decisiones que conviene no deshacer:**
- **`/teme` va con `noindex, follow`, igual que `/tema/<slug>`.** Un tema es una lista de versículos que ya tienen su propia página: indexarlo sería contenido duplicado y fino. `follow` sí, para que el rastreador llegue por ahí a los capítulos. Por eso tampoco está en el sitemap. Si algún día se decide indexarlos, hay que cambiarlo en los tres sitios: las dos vistas y `topic-meta.mjs`.
- **Los avisos por tipo sólo salen para `textual` y `thematic`.** La guía entera está escrita para la expositiva, que es de lo que trata el curso; repetirlo en un recuadro sería ruido. El aviso aparece cuando lo que escribes NO es lo que la guía asume.
- **Los tres pasos con aviso son `text`, `idea` y `structure`**, que son los tres momentos en los que se acaba predicando otra cosa sin darse cuenta: de dónde sale el material, qué pasaje manda cuando hay varios, y de dónde salen las divisiones.
- **Los enlaces del pie van en el pie y no en el menú lateral.** El menú es la navegación de lo tuyo —favoritos, notas, tus predicaciones—; esto es lo público, lo que existe aunque no tengas cuenta.

### Fase 5.G — Regenerar la schiță sin perder lo escrito a mano ✅ COMPLETADA (2026-09-08)

- [x] **Fusión a tres bandas** (`mergeOutline`): respeta lo que ha reescrito el predicador, refresca lo que no tocó y trae los puntos nuevos de la estructura
- [x] **Resumen de lo que ha hecho** («modificările tale păstrate: 2 · puncte noi: 1») y botón **Anulează**, que devuelve la schiță anterior entera
- [x] `tests/sermon-merge.test.js`: 9 casos, incluida la estabilidad (regenerar dos veces seguidas sin tocar nada no cambia nada)

**El problema:** «Regenerează din structură» rehacía la schiță entera. La generada es un punto de partida y se reescribe a mano casi siempre, así que el botón —que está al lado de «Tipărește schița»— costaba el trabajo de una tarde si se pulsaba sin querer.

**Por qué fusión y no versiones:** el caso real no es «quiero volver atrás», es «he añadido un punto en la estructura y quiero que la schiță lo recoja SIN perder mis formulaciones». Con un historial de versiones habría que reescribirlas igualmente. Además, un navegador de versiones es una pantalla nueva que aprender justo la noche antes de predicar.

**Cómo funciona:** el mismo modelo que git al hacer merge. La schiță guarda `base`, una instantánea de la última generación. Al regenerar se comparan tres estados —`base`, `actual` y lo que se generaría hoy— campo a campo: si `actual` sigue igual que `base` nadie lo tocó y se refresca; si difiere, lo escribió él y se respeta. Los puntos se emparejan por `id`, que viene de `content.structure` y es estable aunque se reordenen.

**Decisiones que conviene no deshacer:**
- **Sin `base` no se pisa nada.** Las schițe guardadas antes de esto no la traen; sin ella no hay forma de saber qué es suyo, así que sólo se rellenan los huecos vacíos.
- **El orden lo manda la estructura.** Si movió un punto en STRUCTURĂ es que quiere predicarlo en ese orden.
- **Un punto borrado de la estructura sale de la schiță**, aunque tuviera texto suyo: ha dejado de formar parte de la predicación, y una schiță con puntos que no se van a predicar es peor en el púlpito que una a la que le falte algo. Se cuenta en el resumen y «Anulează» lo devuelve.
- **`base` se actualiza siempre a lo recién generado**, se haya aplicado o no: es lo que la aplicación propuso esta vez, y contra eso hay que comparar la próxima.
- **El botón Anulează no caduca con el aviso.** El aviso dura tres segundos; darse cuenta de que la fusión no era lo que uno quería lleva más.

**Un segundo fallo del mismo tipo, encontrado al verificar:** `crearSchita` releía `sermon.outline`, y `sermon` se carga una vez en `onMount` y no se refresca — era la schiță del momento de abrir la pantalla. Entrar a la schiță, editarla, volver a la predicación y pulsar «Creează schița» otra vez tiraba en silencio todo lo escrito en esa sesión. Ahora mira `outline`, que es el estado vivo del componente.

### Fase 5.H — Recapitulación y temas como etiquetas ✅ COMPLETADA (2026-09-08)

- [x] **Bloque «Ce am răspuns până acum»** (`Recapitulare.svelte`) en STRUCTURĂ, DEZVOLTARE y FINALIZARE: lo respondido en los pasos anteriores, plegable como el guía
- [x] **El tema se elige de una lista de etiquetas** (`SeriesPicker.svelte`) en vez de escribirse a mano
- [x] `GET /api/public/sermon-series`: las series ya usadas en predicaciones publicadas, con su recuento

**Por qué la recapitulación:** en STRUCTURĂ hay que hacerle preguntas analíticas a la idea omiletică, y la idea se escribió en el paso anterior. Había que retroceder a IDEE, leerla y volver — una vez por cada división que se formulaba. Lo mismo en FINALIZARE, donde la frase de inicio sale también de la idea.

**Por qué las etiquetas:** el campo de tema era texto libre, así que «Predica de pe munte», «predica de pe munte» y «Pe munte» acababan siendo tres series para lo mismo y el filtro del blog repartido entre las tres. Enseñando las que ya existen, reutilizar pasa a ser lo cómodo y crear lo deliberado.

**Decisiones que conviene no deshacer:**
- **La idea omiletică y la pregunta analítica van destacadas** dentro de la recapitulación, y el resto plano: de esas dos cuelga todo lo que se hace a partir de ahí.
- **Sólo se listan campos con algo escrito.** Un recordatorio con quince apartados vacíos no es un recordatorio.
- **Guía y recapitulación tienen preferencia de plegado separada.** Enseñar y recordar son dos cosas distintas: quien ya sabe homilética cierra la primera y deja abierta la segunda.
- **Las series propias salen del store local**, no de la red: así el selector funciona desde la primera predicación, aunque no se haya publicado nada.
- **El endpoint público sólo devuelve series de predicaciones publicadas.** Es una lista pública y no puede filtrar los borradores de nadie.
- **Crear no alterna.** Tocar una etiqueta activa la quita, pero escribir un nombre y darle a añadir la selecciona siempre; cuando compartían función, teclear el nombre de la serie ya puesta la desactivaba.

**Un fallo propio encontrado al verificar:** el botón flotante de modo lectura de `Main.svelte` era un `{#if …}{:else}`, así que al excluir el módulo de predicación esas pantallas cayeron en el `else` y enseñaban el botón de **salir** del modo inmersivo sin estar en él. La rama de salida comprueba ahora `isImmersive` explícitamente.

### Fase 9 — Revisión visual completa y descubrimiento público ✅ COMPLETADA (2026-09-08/09)

Repaso de la aplicación entera en escritorio y móvil, con las correcciones que salieron.

- [x] **Selector de capítulos unificado** (`ChapterPicker.svelte`) para lectura y comparación
- [x] **Troceo de líneas para el chino** en la imagen para compartir, con kinsoku básico
- [x] **Tres fondos nuevos** con dibujo propio (`aurora`, `rays`, `arcs`), no sólo cambios de paleta
- [x] **Regeneración de la schiță por fusión a tres bandas** (`mergeOutline`) con deshacer
- [x] Modales de nota y de categorías, icono de filtro en el sidebar, corrección gramatical desactivada
- [x] **Se pueden borrar los temas del índice por defecto** (se retiró `cannot_delete_default` del worker)
- [x] **`/predici` rehecha** con portada, agrupación por etiquetas, paginación y el método en JSON-LD (`HowTo`), servida además por `netlify/functions/sermons-index-meta.mjs`
- [x] **`/teme`** y enlaces del pie: el contenido público ya se puede encontrar sin tener el enlace
- [x] **`/profil`** con el versículo del día alcanzable, continuar leyendo y contadores
- [x] **Objetivos táctiles a 24 px** (WCAG 2.5.8) en pie, landing y migas

**Los Salmos en un móvil eran el caso que lo destapó:** la lectura sacaba los 150 capítulos en una tira horizontal de 6903 px con el capítulo activo fuera de pantalla, y la comparación metía ~25 filas en una ventana de 72 px. Eran dos selectores distintos, cada uno roto a su manera.

**Método, porque condiciona lo que vale la revisión:** se midió en el DOM —estilos calculados, `scrollWidth`, `getBoundingClientRect`— y no sobre capturas. Una captura de página completa coloca mal los elementos `position: fixed` y produjo un solapamiento que no existía, retirado explícitamente. Por el mismo motivo se descartó un barrido de contraste propio que daba fallos en las cinco paletas: el analizador leía `color(srgb … / 0.14)` como opaco.

### Fase 10 — Colecciones curadas, memorización y aviso diario ✅ COMPLETADA (2026-09-09, schema 11)

- [x] **Colecciones curadas** en `/versete/<slug>`: 10 temas, 79 versículos, presentación en los cuatro idiomas, generadas por `scripts/build-curated-topics.mjs` y **prerenderizadas** con el texto real
- [x] **Memorización de versículos** en `/memorare`: método de la primera letra con niveles anidados y repetición espaciada (1 → 180 días), tabla `memorizations`, sincronizada
- [x] **Aviso diario por notificación push**: VAPID, tabla `push_subscriptions`, cron horario en el worker y manejadores `push` / `notificationclick` en el service worker
- [x] Cuatro iconos nuevos de Phosphor (`minus`, `plus`, `eye`, `brain`) por el generador, no a mano

**El prefijo `/versete/` ya tenía dueño.** Cuatro slugs —`dragoste`, `speranta`, `credinta`, `casatorie`— existían como páginas estáticas dentro de `TOPICS`, con `staticOnly` y sin la aplicación detrás: entrando por URL funcionaban, pero al llegar navegando dentro de la aplicación daban «colección no encontrada». Se han mudado al JSON **con la misma URL y los mismos versículos**, porque ya estaban indexadas. Las cuatro españolas de `/versiculos/` se quedan donde estaban.

**El push va sin contenido, a propósito.** Mandar datos dentro obliga a cifrar el cuerpo con aes128gcm (RFC 8291) en el worker. No hace falta: el versículo del día es determinista por fecha y su lista está precacheada, así que el push sólo dice «despierta» y el service worker arma la notificación. Cuesta que `public/sw.js` tenga **copiada** la aritmética de `daily-verse.service.js`; `tests/sw-daily-verse.test.js` compara las dos día a día durante 400 días para que no se separen.

**Decisiones que conviene no deshacer:**
- **La hora del aviso se guarda ya convertida a UTC**, calculada en el cliente y reenviada en cada arranque: el cron es una consulta indexada y el horario de verano se corrige solo.
- **El calendario de repasos vive en el cliente.** En la base sólo se guarda el peldaño, así que afinar los intervalos no obliga a migrar filas.
- **Volver a añadir un versículo ya memorizado no reinicia su avance** (`DO NOTHING`, no upsert).
- **Un 404 de ruta no desplegada se distingue del de negocio** (`not_found` frente a `memorization_not_found`): sin eso, el frontend no caía a `localStorage` durante la ventana en que Netlify va por delante de Cloudflare.

**Verificado:** firma VAPID comprobada contra su propia clave pública; rutas nuevas ejercitadas contra el worker de producción con una cuenta de prueba, luego borrada; censo de D1 antes y después de la migración, idéntico. **Sin verificar:** la entrega real de un push a un dispositivo — necesita un móvil suscrito y esperar a la hora.

### Fuera de alcance

IA, chatbot, red social, marketplace, comentarios, seguidores, colaboración,
editor tipo Word, ni roles más allá de Utilizator/Predicator.

> **Las predicaciones públicas salieron de esta lista el 8 sep 2026.** Estaban
> descartadas en el plan original y el propietario pidió lo contrario: poder
> compartir una predicación en sólo lectura y que se encuentre en los buscadores.
> Lo que sigue fuera es todo lo *social* —comentarios, seguidores, «me gusta»—:
> se publica un texto, no se abre un foro.

---

## Stack técnico

> Mapa completo y comentado en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Aquí solo el índice.

### Backend
- `workers/robible-api/src/index.js` — Hono router + CORS
- `workers/robible-api/src/auth.js` — register, login, recover, me, logout, change-password
- `workers/robible-api/src/data.js` — topics, verse_refs, favorites, notes, highlights, searches, memorizations, push_subscriptions, export, health
- `workers/robible-api/src/utils.js` — hashing, tokens (HMAC), validators, rate limit
- `workers/robible-api/src/sermons.js` — predicaciones (lista, detalle, creación, edición, borrado)
- `workers/robible-api/src/push.js` — firma VAPID y envío del aviso diario (sin payload)
- `workers/robible-api/schema.sql` — D1 schema (versión 11)
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
- `src/layouts/main/PublicTopics.svelte` — `/teme`: colecciones curadas + temas de la gente
- `src/layouts/main/CuratedTopic.svelte` — `/versete/<slug>`: colección curada, **indexada**
- `src/layouts/main/PublicSermons.svelte` — `/predici`: el blog público
- `src/layouts/main/PublicSermon.svelte` — `/predica/<slug>`: una predicación
- `src/layouts/main/Profile.svelte` — `/profil`: versículo del día, continuar leyendo, actividad
- `src/layouts/main/Memorize.svelte` — `/memorare`: práctica y repasos
- `src/layouts/main/{Sermons,SermonPrep,SermonPulpit}.svelte` — cuaderno privado, preparación y Modo Amvon
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
- `src/store/{auth,favorites,notes,highlights,topics,searches,tts,sermons,memorize,appMenu,authMenu}Store.js`
- `src/services/{auth,topics,favorites,notes,highlights,searches,sermons,memorize}.service.js` — API-first con fallback
- `src/services/{curated-topics,daily-verse,reading-progress}.service.js` — datos locales o de JSON estático
- `src/services/push.service.js` — permiso, suscripción y hora del aviso diario
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
- Cache version: **`robible-v31`** (a bumpar a mano en `public/sw.js` con cada release)
- `public/sw.js` es la **única** fuente de verdad de la versión de cache (la constante duplicada de `config.js` se eliminó el 2026-09-04)
- Pre-cachea: ambas Biblias, todos los assets, lang files
- Network-first para navegación · cache-first para assets y data · stale-while-revalidate para `/lang/`

---

## Historial de cambios recientes

**2026-09-11 (tarde) — Predicación: citas visibles en el púlpito, versículos con barra y una traducción mixta**

Segundo lote del día, sobre lo que dejó a medias el anterior: las citas
insertadas se generaban pero no llegaban al púlpito, y el PDF y la página
pública no las distinguían del resto del texto. Verificado con Playwright de
punta a punta: preparación → schiță → Modo Amvon → PDF → publicación.

- **Las citas ya se ven en el púlpito.** `generateOutline` no las recogía en ningún sitio; ahora `citasDe()` las añade como palabra clave propia (`*Referencia* primeras 5 palabras…`) en el desarrollo, la introducción y la conclusión (trampa 69)
- **El comienzo de la frase y lo marcado ya no se excluyen.** Antes, en cuanto había algo marcado con asteriscos en un punto, la schiță enseñaba SÓLO eso y perdía el arranque de la frase; ahora van juntos en la misma línea, y una marca que cae justo en el corte de palabras se respeta entera en vez de partirse (`extenderHastaCerrarMarca`)
- **Versículos con barra a la izquierda** en el PDF de la predicación (tabla de una celda con borde izquierdo, el truco de pdfmake — trampa 71) y, vía `TextoFormateado`, en el documento final y la página pública
- **Idea central centrada y cuerpo del PDF alineado a la izquierda**, no justificado — justificar abría ríos de espacio en blanco con esta tipografía
- **La página pública ya no «perdía frases».** Era `white-space: normal` por defecto en `.predica__texto`: los saltos de línea que el predicador escribe entre frases del mismo campo se colapsaban en un párrafo corrido. Ahora `pre-wrap`, igual que ya llevaba `SermonPrep` (trampa 73)
- **Una traducción mixta corregida**: `es.json` tenía la palabra rumana «schiță» colada en tres frases en español (`mark_help`, `print_outline`, `guide.cta_text`) — ahora dicen «esquema» en los tres sitios
- 331 tests (9 nuevos), 5 trampas nuevas en `CLAUDE.md`

**2026-09-11 — Predicación: sincronización, PDF completo, orden de pasos y citas en línea**

Lote de nueve peticiones sobre el módulo, todas verificadas con tests nuevos y
Playwright contra el backend local (`dev-server.js`) simulando dos dispositivos
reales con `fetch` directo. Sin bump de service worker: no se tocó `sw.js`.

- **Sincronización entre dispositivos, arreglada.** `syncFromServer` conservaba el contenido local para siempre; ahora sólo lo hace si es igual o más nuevo que el remoto (`contenidoSigueValido`, trampa 62). Además, `onMount` sincroniza contra el servidor antes de cargar el sermón, y hay un botón **Actualizează** para refrescar sin perder lo que aún no se haya guardado (trampa 63)
- **PDF completo.** Los puntos que desaparecían era un heurístico de «no partir esta página» que contaba bloques en vez de medir alto: si un desarrollo largo no cabía en lo que quedaba de página, pdfmake lo omitía entero en lugar de partirlo (trampa 64)
- **Introducción antes del desarrollo.** STEPS pasa de 7 a 8 pasos; `intro` es paso propio antes de `development`, y `final` se queda sólo con la conclusión (trampa 65). Es una excepción deliberada a lo que enseña el curso de homilética, documentada como tal
- **Citas bíblicas en línea** (`{{Referencia|texto}}`), insertadas en el punto exacto del cursor y pintadas en cursiva junto al `*marcado*` en negrita que ya existía (trampa 67). Un solo componente (`TextoFormateado.svelte`) las renderiza igual en la vista de edición, el «documento final» y la página pública, para que PDF y HTML no puedan desincronizarse
- **Subpuntos reordenados** antes de explicación/ilustración/aplicación, siguiendo la convención de que un subpunto es una subdivisión de la idea y no algo posterior a desarrollarla (trampa 66). Cambiado a la vez en la edición, el PDF y la página pública
- **Autor y fecha al publicar.** `paraElPublico` añade el nickname vía `JOIN users`, única excepción a que la respuesta pública no lleva datos de usuario (trampa 68); firma visible en `PublicSermon.svelte`, tarjetas de `PublicSermons.svelte` y el HTML para crawlers de `sermon-meta.mjs`
- **Manual de predicación expositiva en `/ghid-predicare`**, indexado, con timeline vertical de los ocho pasos y comparación de los tres tipos. Reutiliza las claves de `homiletics.js` y `sermons.service.js` — no hay texto nuevo que se pueda desincronizar del que ya usa la app. Se avisó de que no había documentos adjuntos accesibles en la sesión: el orden y las reglas obligatorias/opcionales de los subpuntos se resolvieron con el conocimiento de homilética ya incorporado al proyecto, no con material nuevo del usuario
- 322 tests (22 nuevos: `sermons-sync.test.js` completo más ampliaciones en `sermon-content` y `sermon-pdf`), 7 trampas nuevas en `CLAUDE.md`
- **Dos fallos propios cazados al verificar, ninguno reportado por el usuario**: el botón Actualizează, sin guardia, subía la copia local vieja y pisaba una edición más reciente de otro dispositivo (de ahí `guardadoEnElAire`); y el texto nuevo de `/ghid-predicare` decía «siete pasos» en los cuatro idiomas por quedarse desactualizado tras añadir `intro` a STEPS

**2026-09-10 — Predicación: subpuntos con desarrollo, cuaderno de notas y frase de transición** · service worker `robible-v31`

Cuatro entregas seguidas sobre el módulo de predicación, todas verificadas en el
navegador con Playwright antes de subirlas. Sin cambios de schema: `notes` y
`transition` viven dentro de `content_json`, que no se consulta por dentro desde SQL.

- **Subpuntos con desarrollo propio.** En STRUCTURĂ se escribían y en DEZVOLTARE no había dónde desarrollarlos. Ahora cada subpunto tiene su texto y sus referencias, guardados en el mismo mapa `development` bajo su id (`s_…`). En el PDF se imprimen como el punto que los contiene —titular `1.1` y cuerpo normal—, no como la línea gris con guion que eran antes
- **Cuaderno de notas** (`content.notes`): una hoja de 65 dvh en el paso TEXT para lo que se apunta antes de saber qué predicación va a salir, y un plegable de sólo lectura en los seis pasos siguientes. **No se predica**: fuera del recuento, del documento, de los dos PDF y de la página pública, con test de centinela
- **Guion propio para textual y temática en los siete pasos**, no en tres. Verificado contra fuentes de homilética: el parecido con la expositiva es correcto — la clasificación de Broadus separa por el origen de las divisiones, y textual y expositiva comparten ese principio
- **Propoziția de tranziție** (`content.transition`): campo en STRUCTURĂ con una bombilla que explica la fórmula —número + palabra clave en plural + pregunta analítica— y tres moldes pulsables que nunca pisan lo escrito. Sale en el documento, en los dos PDF, en la schiță y en el Modo Amvon
- **Título obligatorio y editable en línea**: se pulsa el `<h1>` y se convierte en campo. Enter y blur guardan, Escape cancela. Sólo se valida en el cliente, a propósito (ver trampa 61)
- 295 tests (17 nuevos), 6 trampas nuevas en `CLAUDE.md` y dos actualizadas
- **Tres fallos propios cazados al verificar**, ninguno visible sin abrir el navegador: la clase `.subpunto` reutilizada dentro del mismo componente, que ponía el bloque en horizontal; Escape guardando en vez de cancelar porque quitar el `<input>` del DOM dispara su `blur`; y la transición ausente del Modo Amvon, que es justo donde esa frase se dice

**2026-09-09 — v1.2.0** · service worker `robible-v30` · schema D1 **11**

Primera versión etiquetada. Antes de ésta el número llevaba en `1.1.0` desde agosto,
así que no distinguía nada: el pie de la aplicación enseña `versión · caché del SW`,
y con eso más la etiqueta se puede saber exactamente qué código tiene un usuario que
reporta un fallo. Reúne todo lo de las fases 9 y 10.

- Colecciones curadas (`/versete/<slug>`), memorización (`/memorare`) y aviso diario por push
- Revisión visual completa: selector de capítulos unificado, troceo del chino, `/predici`, `/teme`, `/profil`
- Recuperación manual de cuenta por correo al propietario; el campo email ya no promete lo que no hace

**2026-09-09 — Colecciones curadas, memorización y aviso diario (schema 11)**
- `/versete/<slug>`: 10 colecciones curadas, 79 versículos, presentación en 4 idiomas, prerenderizadas y en el sitemap. Los 4 slugs rumanos que ya existían como páginas estáticas se absorbieron **sin cambiar URL ni versículos**
- `/memorare`: método de la primera letra con niveles anidados y repetición espaciada. Tabla `memorizations`, sincronizada
- Aviso diario por push: VAPID, tabla `push_subscriptions`, cron horario, manejadores en el service worker. **Sin payload**: el versículo lo calcula el propio service worker
- 4 iconos nuevos de Phosphor por el generador; SW a `robible-v30`; 278 tests (41 nuevos)
- D1 migrada en producción con censo antes y después: sin pérdida de datos
- **Dos bugs propios cazados al verificar**: `Number(null)` y `Number('')` valen 0, así que el aviso se ofrecía a medianoche; y navegar entre colecciones no remontaba el componente, con lo que los chips parecían enlaces muertos

**2026-09-08 — Revisión visual completa y descubrimiento del contenido público**
- Selector de capítulos unificado, troceo de líneas para el chino, 3 fondos nuevos, fusión a tres bandas de la schiță
- `/predici` rehecha con portada, etiquetas, paginación y `HowTo` en JSON-LD; `/teme` y enlaces del pie; `/profil`
- Objetivos táctiles a 24 px; modales de nota y categorías arreglados; se pueden borrar los temas por defecto

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
