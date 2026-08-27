# RoBible — Estado del proyecto

> Documento vivo. Actualizado en cada milestone.
> Última actualización: 27 ago 2026

---

## 📋 Resumen ejecutivo

RoBible es una app web (PWA) bilingüe de la Biblia (rumano + español) con soporte offline. Construida con Svelte 5 + Vite, SCSS, datos JSON estáticos, i18n por JSON, service worker.

**Stack:**
- Frontend: Svelte 5 + Vite 8
- Styling: SCSS con variables CSS themeable (light/dark)
- Data: JSON estáticos en `/public/data/{vdc,rvl}/bible.{map,json}`
- i18n: JSON en `/public/lang/{ro,es}.json`
- PWA: manifest + service worker (cache-first, versiones)
- Rutas: path-based custom (sin router framework), parsea `window.location.pathname`

**Versiones bíblicas soportadas:**
- `vdc` — Biblia Română (rumano) — *primaria por defecto*
- `rvl` — Biblia Español (español)

---

## ✅ Fases completadas

### Phase 0 — Logo + infraestructura base
- [x] Logo redesign: círculo teal (#2E7D9B) + libro blanco + cruz dorada (#D4A853)
- [x] Logo se adapta a dark/light mode (SVG inline con CSS)
- [x] Todos los favicons regenerados (ICO, PNG, SVG)
- [x] Pipeline de iconos con Jimp ESM (`scripts/resize-logo.js`)
- [x] Manifest PWA con colores de marca (`#2E7D9B`)
- [x] `index.html` con meta theme-color
- [x] `browserconfig.xml` actualizado
- [x] Service worker con cache de ambas Biblias

### Phase 1 — Navegación y UX móvil
- [x] **Swipe gestures** en `Result.svelte` (touchstart/move/end)
  - Swipe izquierda → capítulo siguiente
  - Swipe derecha → capítulo anterior
  - Indicadores visuales de dirección
  - Toast de confirmación
  - Traducciones añadidas (ro/es)
- [x] **Modo inmersivo** (full-screen reading)
  - Store `immersiveMode` con persistencia en localStorage (`robible:immersive`)
  - `toggleImmersiveMode()` + clase `immersive-mode` en body
  - Oculta Navbar, Footer, Sidebar
  - Botón flotante de entrada (top-right) y salida (bottom-left, color teal sólido)
  - Atajo de teclado: `Esc` para salir
  - Doble-tap como activador móvil
- [x] **Navegación flotante desktop**
  - Botones pill (← Anterior / Siguiente →) aparecen tras 120px de scroll
  - Hidden en mobile (swipe only)
  - Animación fade-in

### Phase 2.1 — Comparar versiones (`/compara`)
- [x] Nueva ruta `/compara/:libro/:capitulo` (y `/comparar` para ES)
- [x] `BIBLE_VERSIONS` soporta N versiones (placeholders en_kjv, zh_cuv con `available: false`)
- [x] Store `compareWithVersion` con persistencia en `robible:compareWith` localStorage
- [x] Helpers `getAvailableBibleVersions()` y `getDefaultCompareWith(primary)`
- [x] App.svelte: cache dinámico por versión, carga `compareWithVersion` reactivamente
- [x] `Main.svelte` detecta modo compara con `isCompareMode`
- [x] Clase CSS `main--compare` (single-column grid) en compare mode
- [x] Botón "Compară traduceri" / "Compara traducciones" en Navbar
- [x] `Compare.svelte` con dos columnas (rumano | español)
- [x] Selector de libro (BookDrawer) + botones de capítulo
- [x] **Selector de versión a comparar** (dropdown con N opciones) en header de Compare
- [x] **Botón "Ieși din comparare / Salir"** en header de Compare, navega a vista normal
- [x] **Botón "Comparar con..."** en cada versículo de Result.svelte (dropdown)
- [x] Versículos alineados por número
- [x] Botón copiar versículo por columna
- [x] Header sticky con selector
- [x] Swipe gestures en mobile
- [x] Botones flotantes desktop (después de scroll)
- [x] Dark mode completo
- [x] Traducciones añadidas (ro/es) — clave `app.compare.*`
- [x] **Mobile split horizontal** (top/bottom) con scroll sincronizado por ratio
- [x] **Navbar mobile**: ocultar texto "Biblia" en < 32rem (solo logo)
- [x] Desktop mantiene layout side-by-side (no se rompe)

---

## 🚧 En curso

### Phase 2.2 — Índice temático
- [ ] Ruta `/indice` o `/temas`
- [ ] 7 categorías: Amor, Fe, Promesas, Milagros, Sanaciones, Apocalípticos, Profecías de Isaías
- [ ] Lista de versículos por categoría
- [ ] Click en versículo → navega a ese versículo
- [ ] Mobile-first (cards o lista colapsable)

### Phase 2.3 — Lectura continua
- [ ] Auto-advance al siguiente capítulo después de N segundos
- [ ] Velocidad configurable (slider: 30s, 60s, 90s, 2min, 5min)
- [ ] Botón play/pause
- [ ] Indicador de progreso
- [ ] Persistir velocidad en localStorage

---

## 📅 Pendientes por fase

### Phase 2.2 — Índice temático
- [ ] Ruta `/indice` o `/temas`
- [ ] 7 categorías: Amor, Fe, Promesas, Milagros, Sanaciones, Apocalípticos, Profecías de Isaías
- [ ] Lista de versículos por categoría
- [ ] Click en versículo → navega a ese versículo
- [ ] Mobile-first (cards o lista colapsable)

### Phase 2.3 — Lectura continua
- [ ] Auto-advance al siguiente capítulo después de N segundos
- [ ] Velocidad configurable (slider: 30s, 60s, 90s, 2min, 5min)
- [ ] Botón play/pause
- [ ] Indicador de progreso
- [ ] Persistir velocidad en localStorage

### Phase 3 — Personalización
- [ ] Favoritos (★ por versículo, lista de favoritos)
- [ ] Notas por versículo
- [ ] Historial de lectura
- [ ] Planes de lectura (1 año, 6 meses, etc.)
- [ ] Highlight en versículos

### Phase 4 — Cloud sync (opcional)
- [ ] Sincronizar favoritos/notas entre dispositivos
- [ ] Backend simple (Supabase, Firebase, o custom)
- [ ] Auth básica (email o anon)

### Phase 5 — Widgets
- [ ] Widget home screen (Android/iOS) con versículo del día
- [ ] Versículo diario configurable
- [ ] "Compartido a RoBible" deep-link

---

## 🐛 Issues conocidos (a verificar tras cambios)

### Mobile (390px y menor)
- ✅ **Navbar**: "Biblia" se envuelve verticalmente → ocultar texto en < 32rem (RESUELTO)
- ✅ **Comparar**: dos columnas muy estrechas → cambiar a split horizontal con scroll sync (RESUELTO)
- [ ] **Swipe gestures**: verificar que no interfieran con scroll horizontal
- [ ] **BookDrawer**: verificar que se abra/cierre correctamente en mobile
- [ ] **Comparar mobile**: confirmar en device real que el scroll sync se siente natural

### Desktop
- ✅ Versión actual: todo OK (verificado con Playwright)
- [ ] Verificar que las animaciones de swipe/chapter-nav se vean fluidas

---

## 🔧 Stack técnico

### Archivos clave
- `src/App.svelte` — carga Biblia, layout raíz
- `src/layouts/main/Main.svelte` — grid principal, detecta compare mode
- `src/layouts/main/Result.svelte` — vista lectura (con swipe, nav flotante)
- `src/layouts/main/Compare.svelte` — vista comparar
- `src/layouts/main/Sidebar.svelte` — filtros y búsqueda
- `src/layouts/header/Navbar.svelte` — logo, compară, version picker
- `src/store/stores.js` — stores globales (filter, selectedBibleVersion, themeMode, immersiveMode)
- `src/services/i18n.service.js` — i18n con setupI18n()
- `src/services/filter.service.js` — búsqueda
- `src/services/bible-route.service.js` — build/parse BiblePath
- `src/config/bible-versions.js` — config de vdc/rvl

### Comandos
- `npm run dev` — Vite dev server (puerto 5173)
- `npm run build` — build a `dist/`
- `node scripts/generate-seo.mjs` — genera SEO pages tras build
- `node scripts/resize-logo.js` — regenera todos los favicons

### Service Worker
- Cache version: `robible-v9`
- Pre-cachea: ambas Biblias, todos los assets, lang files
- Network-first para navegación
- Cache-first para assets/data/lang

---

## 📝 Decisiones de arquitectura

- **Sin router framework**: la app parsea `window.location.pathname` directamente. Rutas: `/`, `/biblia/:version/:libro/:cap`, `/verse/:version/:libro/:cap/:ver`, `/compara/:libro/:cap`, `/compara`.
- **Carga única de Bible**: App.svelte carga UNA versión basada en `$selectedBibleVersion`. Para comparar, se cargan AMBAS en paralelo.
- **localStorage keys**: `selectedBibleVersion`, `robible:theme`, `robible:immersive`, `lang`, `filter`.
- **Dark mode**: clase `html[data-theme="dark"]` con CSS variables.
- **i18n**: carga `ro.json` o `es.json` según versión bíblica seleccionada. No se mezcla entre idiomas.

---

## 🎯 Próximos pasos inmediatos

1. ✅ **Comparar mobile split horizontal** (PENDIENTE — trabajando ahora)
2. ✅ **Navbar mobile sin texto "Biblia"** (PENDIENTE — trabajando ahora)
3. ⏳ Documento ROADMAP.md creado (PENDIENTE — trabajando ahora)
4. ⏳ Phase 2.2 — Índice temático
5. ⏳ Phase 2.3 — Lectura continua
6. ⏳ Deploy a producción

---

## 📦 Deploy

Pendiente. Opciones:
- **Netlify** (probable, ya tiene `netlify.toml`)
- **Vercel**
- **Cloudflare Pages**

Una vez aprobado el estado actual, hacer deploy.
