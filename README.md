# RoBible — Biblia Română & Español Online

[![Netlify Status](https://api.netlify.com/api/v1/badges/6b686e6f-af60-40b2-ad0d-9226c5ba76e9/deploy-status)](https://app.netlify.com/sites/robible/deploys)

**RoBible** es una aplicacion web para leer la Biblia con audio TTS, comparacion de versiones, indice tematico, favoritos, notas y soporte offline completo. Dos Biblias disponibles (rumano y espanol) e interfaz traducida a cuatro idiomas.

🌐 **Produccion**: [robible.com](https://robible.com)

📖 Documentacion tecnica: [CLAUDE.md](CLAUDE.md) · [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) · [docs/OPERACIONES.md](docs/OPERACIONES.md) · [ROADMAP.md](ROADMAP.md)

---

## Caracteristicas

### Lectura y navegacion
- **Dos versiones biblicas con datos**: Biblia Română (VDC) y Biblia Español (RVL). `en_kjv` y `zh_cuv` estan declaradas en el catalogo pero aun sin datos (`available: false`)
- **Landing publica** en cuatro idiomas (`/landing?lang=ro|es|en|zh`) con micro-demo de busqueda
- **Busqueda por texto y por referencia**: acepta tanto palabras como referencias tipo `Ioan 3:16` o `jn 3 16`, con tolerancia a erratas
- **Busquedas recientes** sincronizadas entre dispositivos (ultimas 25)
- **Comparar versiones**: selecciona cualquier versiculo y muestralo en ambas traducciones lado a lado
- **Indice tematico**: categorias como Salvacion, Misericordia, Sanacion (RO) / Amor, Esperanza, Fe (ES) con versiculos guardados
- **Favoritos**: marca versiculos para acceso rapido
- **Notas personales**: anota reflexiones en cada versiculo (multi-device, sincronizadas)
- **Navegacion swipe**: desliza izquierda/derecha para cambiar de capitulo
- **Modo inmersivo**: oculta controles para lectura limpia

### Audio TTS — Lectura en voz alta con karaoke
- **Highlighting palabra por palabra**: la palabra actual se resalta automaticamente mientras se lee
- **Voces nativas**: usa la voz del sistema en el idioma correspondiente (ro-RO / es-ES)
- **Velocidad configurable**: 0.75x, 1x, 1.5x, 2x
- **Musica de fondo opcional**: drone armónico procedural generado con Web Audio API (gratis, sin dependencias)
- **Volumenes independientes**: voz y musica por separado
- **Barra mini-player**: tipo Spotify en la parte inferior de la pantalla, se expande al tocar o deslizar

### Multiidioma y PWA
- **Interfaz en 4 idiomas**: rumano, espanol, ingles y chino (`public/lang/`)
- **Idioma automatico**: en la app se infiere de la version biblica activa; en la landing manda `?lang=`
- **100% offline**: datos biblicos en JSON cacheados por el service worker
- **Instalable**: funciona como app en Android, iOS, desktop
- **SEO completo**: Schema.org, Open Graph, Twitter Cards, OG images dinamicos por versiculo, sitemap troceado con hreflang

### Multi-device
- **Auth con Cloudflare Workers + D1**: registro, login, recuperacion por pregunta de seguridad
- **Sincronizacion en la nube**: favoritos, notas y busquedas recientes se comparten entre dispositivos
- **Rate limiting**: 30 peticiones/minuto por IP

---

## Stack tecnico

| Capa | Tecnologia |
|------|-----------|
| Frontend | Svelte 5 (sintaxis legacy, no runes), Vite 8, SCSS |
| Routing | Propio, sobre `window.location.pathname` (sin router) |
| Datos | JSON estaticos en `/public/data/{vdc,rvl}/` (4,2 MB por Biblia) |
| i18n | Propio, sin libreria. JSON en `/public/lang/{ro,es,en,zh}.json` |
| PWA | Service Worker con cache-first + precache |
| Backend | Cloudflare Workers + D1 (SQLite en el edge), router Hono |
| Auth | PBKDF2-SHA256 (100k iter) + tokens HMAC revocables |
| Produccion | Frontend en Netlify, Backend en Cloudflare Workers |

---

## Empezar

```bash
# Instalar dependencias
npm install

# Desarrollo (frontend + backend)
npm run dev          # Vite en localhost:5173
# En otra terminal:
node workers/robible-api/dev-server.js  # API en localhost:8787

# Build de produccion
npm run build        # Compila + genera paginas SEO en dist/

# Preview del build
npm run preview
```

El servidor de desarrollo usa `--host 0.0.0.0` para poder probar desde otros dispositivos en la misma red.

---

## Arquitectura

```
robible/
├── public/
│   ├── data/
│   │   ├── vdc/           # Biblia Română (bible.json + bible.map.json)
│   │   └── rvl/           # Biblia Español (bible.json + bible.map.json)
│   ├── lang/              # ro.json, es.json, en.json, zh.json
│   ├── sw.js              # Service Worker (cache versioning)
│   └── sitemap.xml        # instantanea; el build regenera la real en dist/
├── src/
│   ├── App.svelte              # Carga de Biblia + locale, layout raiz
│   ├── main.js                 # Arranque, redirect a /landing, registro del SW
│   ├── config.js               # API_BASE_URL, USE_BACKEND
│   ├── config/
│   │   ├── bible-versions.js   # Catalogo de versiones: paths, locales, SEO
│   │   └── seo.js              # Constantes de SEO
│   ├── layouts/
│   │   ├── landing/Landing.svelte  # Landing publica multiidioma
│   │   ├── main/
│   │   │   ├── Result.svelte       # Vista principal de lectura
│   │   │   ├── Compare.svelte      # Comparar versiones
│   │   │   ├── Index.svelte        # Indice tematico
│   │   │   ├── Favorites.svelte    # Favoritos
│   │   │   ├── Notes.svelte        # Notas personales
│   │   │   ├── BookDrawer.svelte   # Selector de libro
│   │   │   └── Sidebar.svelte      # Filtros y busqueda
│   │   ├── header/             # Navbar.svelte, AppMenu.svelte
│   │   ├── auth/AuthModal.svelte
│   │   ├── footer/Footer.svelte
│   │   └── pwa/PwaManager.svelte
│   ├── components/
│   │   ├── TtsPlayer.svelte    # Mini-player TTS karaoke
│   │   ├── IconPicker.svelte   # Selector de icono de categoria
│   │   └── ActionButton.svelte
│   ├── services/
│   │   ├── apiClient.js               # Cliente API + politica de fallback
│   │   ├── auth.service.js            # Auth (API + mock localStorage)
│   │   ├── favorites|notes|topics|searches.service.js   # Datos, API-first
│   │   ├── referenceSearch.service.js # Busqueda por referencia (fuzzy)
│   │   ├── filter.service.js          # Busqueda por texto
│   │   ├── bible-route.service.js     # Construir/parsear rutas
│   │   ├── i18n.service.js            # Traductor propio
│   │   ├── seo.service.js             # Metadatos en runtime
│   │   ├── tts.service.js             # SpeechSynthesis wrapper
│   │   └── music.service.js           # Web Audio API drone
│   └── store/                  # stores.js, authStore, ttsStore, y los de datos
├── workers/robible-api/        # Cloudflare Workers + D1
│   ├── src/index.js            # Router Hono + endpoints
│   ├── schema.sql              # Schema D1
│   └── dev-server.js           # Emulador local sobre node:sqlite
├── netlify/functions/          # og-image.mjs, verse-meta.mjs
├── scripts/generate-seo.mjs    # Paginas SEO estaticas + sitemaps (post-build)
└── docs/                       # ARQUITECTURA, OPERACIONES, AUDITORIA
```

### Service Worker
El SW cachea las dos Biblias (~8,5 MB en total, 4,2 MB cada una) en la instalacion. Cada release exige **bumpear `CACHE_NAME`** a mano en `public/sw.js` (hoy `robible-v19`); sin bump, las PWA instaladas no reciben la actualizacion. La segunda Biblia solo se descarga en runtime cuando el usuario entra en modo comparacion (lazy loading), lo que ahorra 4,2 MB en la visita inicial.

---

## Backend API

Desplegado en: `https://robible-api.robible.workers.dev`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout (revoca sesion) |
| GET | `/api/auth/me` | Perfil del usuario |
| POST | `/api/auth/recover/question` | Pregunta de seguridad |
| POST | `/api/auth/recover/verify` | Verificar respuesta |
| POST | `/api/auth/recover/reset` | Cambiar password |
| GET | `/api/favorites` | Lista de favoritos |
| POST | `/api/favorites` | Anadir favorito |
| DELETE | `/api/favorites` | Quitar favorito |
| GET | `/api/topics` | Lista de categorias |
| POST | `/api/topics` | Crear categoria |
| PATCH | `/api/topics/:id` | Actualizar categoria |
| DELETE | `/api/topics/:id` | Borrar categoria |
| POST | `/api/topics/:id/verses` | Anadir versiculo a categoria |
| DELETE | `/api/topics/:id/verses` | Quitar versiculo |
| GET | `/api/notes` | Lista de notas |
| POST | `/api/notes` | Crear/actualizar nota |
| DELETE | `/api/notes` | Borrar nota |
| GET | `/api/searches` | Busquedas recientes |
| POST | `/api/searches` | Guardar busqueda |
| DELETE | `/api/searches` | Borrar busqueda |
| POST | `/api/auth/change-password` | Cambiar password (autenticado) |
| GET | `/api/data/export` | Exportar todos los datos |
| GET | `/api/health` | Estado del API |

Detalle completo (auth, schema, rate limits, deploy): [workers/robible-api/README.md](workers/robible-api/README.md).

### Desarrollo local
```bash
node workers/robible-api/dev-server.js
# CORS: localhost:5173, 5174, 4173, y sus equivalentes 127.0.0.1
# Base de datos: workers/robible-api/.dev-data/robible.db (se crea sola)
```

---

## Workflow git

- Rama de trabajo: **`develop`**. Produccion: **`master`**, que solo recibe merges hechos por el usuario.
- **Frontend** (commits, PRs, merges): lo gestiona el usuario
- **Backend** (deploys a Cloudflare, queries D1, scripts): lo gestiona el agente

El agente **no debe** hacer `git commit` / `push` / `PR` / `merge` de archivos frontend. Deja los cambios en el working tree para que el usuario los revise. Ver [CLAUDE.md](CLAUDE.md).

---

## PWA e instalacion

1. **Android Chrome**: abre robible.com, espera a que cargue, usa el menu o el prompt de instalacion
2. **iOS Safari**: abre robible.com,Compartir > Anadir a pantalla de inicio
3. **Offline**: visita la web una vez, activa modo avion, reabriala — los datos biblicos seguiran disponibles
4. **SEO social**: comparte una URL de versiculo como `https://robible.com/biblia/vdc/romani/1/1`. El OG image se genera dinamicamente con el texto del versiculo

---

## Historial de releases

- **sin taggear** (sep 2026): landing publica en 4 idiomas con micro-demo, busqueda por referencia con fuzzy matching, i18n ampliado a `en` y `zh`, sitemaps troceados, SW `robible-v19`. Sigue versionado como `1.1.0` en `package.json`
- **v1.1.0** (ago 2026): TTS karaoke con highlighting palabra por palabra, drone musical procedural, barra mini-player, lazy loading de la segunda Biblia, SEO con sitemap automatico y hreflang
- **v1.0** (may 2026): launch con Biblia Romana + Espanol, comparacion de versiones, indice tematico, auth multi-device

---

*Construido con Svelte 5, Cloudflare Workers y Netlify. La Biblia es la Palabra de Dios — que esta aplicacion ayude a acercarla a todos.*
