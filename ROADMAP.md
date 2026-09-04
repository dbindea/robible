# RoBible — Roadmap

> Documento vivo. Actualizado en cada milestone.
> Última actualización: **4 sep 2026** (revisión de traspaso: estado real verificado contra el código)

> Documentación de referencia: [CLAUDE.md](CLAUDE.md) · [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) · [docs/OPERACIONES.md](docs/OPERACIONES.md)
> Deuda técnica detectada: [docs/AUDITORIA-2026-09-04.md](docs/AUDITORIA-2026-09-04.md)

---

## Resumen ejecutivo

RoBible es una app web (PWA) de la Biblia con soporte offline, auth multi-device, índice temático, favoritos sincronizados y lectura con audio TTS. Dos Biblias con datos (rumano `vdc` y español `rvl`) e interfaz traducida a cuatro idiomas. Construida con Svelte 5 + Vite, SCSS, datos JSON estáticos, backend en Cloudflare Workers + D1.

**Stack:**
- Frontend: Svelte 5 (sintaxis legacy, no runes) + Vite 8, SCSS themeable (light/dark)
- Data: JSON estáticos en `/public/data/{vdc,rvl}/bible.{map,json}` — 4,2 MB por Biblia
- i18n: propio, sin librería. JSON en `/public/lang/{ro,es,en,zh}.json`
- PWA: manifest + service worker (cache-first, versiones) — hoy `robible-v19`
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

### Phase 4.1 — Audio TTS con highlighting (Frontend — **punto fuerte innovative**) 🟡 PARCIAL (2026-08-31)

> Reemplaza el auto-advance timer. Lee el capítulo en voz alta, resaltando palabra por palabra.
>
> **Estado revisado el 2026-09-04 contra el código.** Estaba marcada como completada con todas las casillas sin marcar; lo entregado cubre el núcleo, pero tres puntos del plan original no se implementaron.

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

**Pendiente además**: los textos del mini-player están hardcodeados en `LABELS` dentro de `TtsPlayer.svelte` en lugar de usar `$_()`. Es la única excepción a la regla de i18n del proyecto.

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
- [x] Único script de verificación del repo: `scripts/test-reference-search.mjs`

### Phase 5.4 — Sitemaps troceados ✅ COMPLETADA (2026-09-01/02)

- [x] `generate-seo.mjs` genera `dist/sitemaps/{static,books,chapters,topics,verses-N}.xml` con 45.000 URLs por archivo
- [x] `dist/sitemap.xml` pasa a ser el **índice** de sitemaps
- [x] hreflang de los 4 idiomas en las entradas de la landing
- [x] Cloudflare delante del dominio (commit `97a1a98`)
- Cinco rutas del sitemap (`/temas`, `/favoritos`, `/favoriti`, `/notas`, `/notite`) no existían en la app y devolvían soft-404. Retiradas el 2026-09-04 (hallazgo 5).

---

## Deuda técnica

Levantada en la revisión de traspaso del **4 sep 2026**. Detalle, evidencia y verificación en **[docs/AUDITORIA-2026-09-04.md](docs/AUDITORIA-2026-09-04.md)**.

15 hallazgos, **12 arreglados** el mismo día. Lo que queda:

| # | Hallazgo | Prioridad | Estado |
|---|---|---|---|
| 13 | La "lectura con música" no lee: el play llama a `playMusicOnly()` y la ruta de TTS real está desconectada | Alta | ⏸️ Rediseño de la reproducción |
| 8 | 16 MB de PNG/SVG del pipeline de logo versionados en `robible/` | Info | ⚠️ Falta `git rm -r --cached robible/` |
| 9 | Tabla `user_profiles` sin endpoints, y guarda PII que el proyecto dice no querer | Info | ⏸️ Decisión de producto |
| 10 | 2 versiones bíblicas anunciadas (`en_kjv`, `zh_cuv`) sin datos | Info | ⏸️ Decisión de producto |
| 11 | Sin tests automatizados | Info | ⏸️ Pendiente |

Arreglados: idioma del TTS, `USE_BACKEND` en producción, idioma de las categorías por defecto, `SW_CACHE_VERSION` muerto, rutas fantasma del sitemap, configuración de ESLint (99 errores → 0), claves de traducción que faltaban en `es` y `zh`, rama muerta de `Landing`, adaptador D1 del dev-server, y el JSON-LD de FAQ que repetía la misma pregunta cinco veces.

Sigue pendiente **fuera del repo**: verificar `VITE_API_BASE_URL` en el panel de Netlify (hallazgo 2 — el código ya avisa por consola si falta, pero la variable hay que confirmarla).

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

## Próximos pasos inmediatos (orden sugerido)

Reordenado el 2026-09-04. Lo completado se ha movido al historial de más abajo.

1. **Verificar `VITE_API_BASE_URL` en el panel de Netlify** — 30 segundos, y de ello depende toda la sincronización multi-dispositivo. Es lo único de la auditoría que no se puede cerrar desde el repo
2. **Frontend — rediseñar la reproducción de audio** (deuda 13): hoy el botón de play no lee, solo pone música y finge el karaoke con timers. Hay que decidir el modelo (voz / voz+música / solo música) y reconectar `playChapter()`
3. **Frontend — decidir si se traducen los paths por idioma** (`indexPath`/`favoritesPath`/`notesPath` son hoy iguales en ro y es). Si se hace, añadir las variantes al sitemap
4. **Revisar los 14 avisos de lint que quedan** (`require-each-key`, `infinite-reactive-loop`, `no-reactive-reassign`): son señales reales que se dejaron como warning para no bloquear
5. **Backend — Phase 3.5 Nickname hints + sugerencias** (única fase funcional pendiente del plan original)
6. **Frontend — Phase 4.4 Mobile play overlap** — ya existe el FAB del TTS, así que ahora sí se puede coordinar z-index con `.scroll-top-button`
7. **Frontend — completar Phase 4.1**: play desde un versículo concreto y lectura de resultados de búsqueda
8. **Decisión de producto**: qué hacer con `en_kjv` / `zh_cuv` (conseguir datos o recortar el selector) y con `user_profiles` (implementar o retirar del schema)

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

> Mapa completo y comentado en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Aquí solo el índice.

### Backend
- `workers/robible-api/src/index.js` — Hono router + CORS
- `workers/robible-api/src/auth.js` — register, login, recover, me, logout, change-password
- `workers/robible-api/src/data.js` — topics, verse_refs, favorites, notes, searches, export, health
- `workers/robible-api/src/utils.js` — hashing, tokens (HMAC), validators, rate limit
- `workers/robible-api/schema.sql` — D1 schema (versión 4)
- `workers/robible-api/wrangler.toml` — bindings + env vars
- `workers/robible-api/dev-server.js` — emulador local con `node:sqlite`

### Frontend
- `src/main.js` — arranque, redirect a `/landing`, registro del SW
- `src/App.svelte` — carga Biblia + locale, layout raíz
- `src/layouts/main/Main.svelte` — grid principal + detección de ruta
- `src/layouts/main/Result.svelte` — vista lectura (swipe, nav, favs, notas, topics, TTS, SEO) — 2880 líneas
- `src/layouts/main/Compare.svelte` — comparar versiones
- `src/layouts/main/Index.svelte` — índice temático
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
- `src/store/{auth,favorites,notes,topics,searches,tts,appMenu,authMenu}Store.js`
- `src/services/{auth,topics,favorites,notes,searches}.service.js` — API-first con fallback
- `src/services/apiClient.js` — cliente API + política de fallback (`withFallback`)
- `src/services/referenceSearch.service.js` — búsqueda por referencia con fuzzy matching
- `src/services/filter.service.js` — búsqueda por texto
- `src/services/bible-route.service.js` — construir/parsear rutas
- `src/services/seo.service.js` — metadatos en runtime
- `src/services/tts.service.js` — SpeechSynthesis wrapper con highlighting palabra por palabra
- `src/services/music.service.js` — drone armónico procedural con Web Audio API
- `src/services/i18n.service.js` — traductor propio
- `src/config.js` + `src/config/{bible-versions,seo}.js` — configuración
- `netlify/functions/{og-image,verse-meta}.mjs` — OG dinámico y metadatos de ruta legacy
- `src/components/AutoRead.svelte` — ~~eliminado~~ (reemplazado por TTS karaoke en Phase 4.1)

### Comandos
- `npm run dev` — Vite dev server (puerto 5173, host 0.0.0.0)
- `npm run build` — build a `dist/` + `generate-seo.mjs`
- `npm run lint` — ESLint (**debe salir en 0 errores**; quedan 14 avisos deliberados)
- `node scripts/generate-seo.mjs` — genera SEO pages y sitemaps tras build
- `node scripts/build-logo.js` — regenera todos los favicons
- `node scripts/test-reference-search.mjs` — verifica la búsqueda por referencia
- `node workers/robible-api/dev-server.js` — emulador backend

### Service Worker
- Cache version: **`robible-v19`** (a bumpar a mano en `public/sw.js` con cada release)
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
