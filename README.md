# RoBible — Biblia Română & Español Online

[![Netlify Status](https://api.netlify.com/api/v1/badges/6b686e6f-af60-40b2-ad0d-9226c5ba76e9/deploy-status)](https://app.netlify.com/sites/robible/deploys)

**RoBible** es una aplicacion web bilingue (rumano + espanol) para leer la Biblia con audio TTS, comparacion de versiones, indice tematico, favoritos, notas y soporte offline completo.

🌐 **Produccion**: [robible.com](https://robible.com)

---

## Caracteristicas

### Lectura y navegacion
- **Dos versiones biblicas**: Biblia Romana (VDC) y Biblia en Espanol (RVLC)
- **Comparar versiones**: selecciona cualquier versiculo y muestralo en ambas traducciones lado a lado
- **Indice tematico**: categorias como Salvacion, Misericordia, Sanacion (RO) / Amor, Esperanza, Fe (ES) con versiculos guardados
- **Favoritos**: marca versiculos para acceso rapido
- **Notas personales**: anota reflexiones en cada versiculo (multi-device, sincronizadas)
- **Navegacion swipe**: desliza izquierda/derecha para cambiar de capitulo
- **Modo inmersivo**: oculta controles para lectura limpia

### Audio TTS — Lectura en voz alta con karaoke
- **Highlighting palabra por palabra**: la palabra actual se resalta automaticamente mientras se lee
- **Voces nativas**: usa la voz del sistema en el idioma correspondiente (ro-RO / es-ES)
- **Velocidad configurable**: 0.75x, 1x, 1.25x, 1.5x
- **Musica de fondo opcional**: drone armónico procedural generado con Web Audio API (gratis, sin dependencias)
- **Volumenes independientes**: voz y musica por separado
- **Barra mini-player**: tipo Spotify en la parte inferior de la pantalla, se expande al tocar o deslizar

### Multiidioma y PWA
- **Bilingual automatico**: el idioma se infiere de la version biblica activa
- **100% offline**: datos biblicos en JSON cacheados por el service worker
- **Instalable**: funciona como app en Android, iOS, desktop
- **SEO completo**: Schema.org, Open Graph, Twitter Cards, OG images dinamicos por versiculo, sitemap con hreflang

### Multi-device
- **Auth con Cloudflare Workers + D1**: registro, login, recuperacion por pregunta de seguridad
- **Sincronizacion en la nube**: favoritos, notas y busquedas recientes se comparten entre dispositivos
- **Rate limiting**: 30 peticiones/minuto por IP

---

## Stack tecnico

| Capa | Tecnologia |
|------|-----------|
| Frontend | Svelte 5, Vite 8, SCSS |
| Datos | JSON estaticos en `/public/data/{vdc,rvl}/` |
| i18n | JSON en `/public/lang/{ro,es}.json` |
| PWA | Service Worker con cache-first + precache |
| Backend | Cloudflare Workers + D1 (SQLite en el edge) |
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
│   │   ├── vdc/          # Biblia Română (bible.json + bible.map.json)
│   │   └── rvl/           # Biblia en Español (bible.json + bible.map.json)
│   ├── lang/
│   │   ├── ro.json        # Traducciones rumano
│   │   └── es.json        # Traducciones espanol
│   ├── sw.js              # Service Worker (cache versioning)
│   └── sitemap.xml
├── src/
│   ├── layouts/main/
│   │   ├── Result.svelte     # Vista principal de lectura
│   │   ├── Compare.svelte    # Comparar versiones
│   │   ├── Index.svelte      # Indice tematico
│   │   ├── Favorites.svelte  # Favoritos
│   │   ├── Notes.svelte      # Notas personales
│   │   └── Sidebar.svelte    # Filtros y busqueda
│   ├── components/
│   │   └── TtsPlayer.svelte  # Mini-player TTS karaoke
│   ├── services/
│   │   ├── tts.service.js       # SpeechSynthesis wrapper
│   │   ├── music.service.js      # Web Audio API drone
│   │   ├── topics.service.js     # Indice tematico
│   │   ├── favorites.service.js  # Favoritos
│   │   └── apiClient.js         # Cliente API + localStorage fallback
│   └── store/
│       └── ttsStore.js          # Estado TTS (velocidad, volumen, etc.)
├── workers/robible-api/         # Cloudflare Workers
│   └── src/index.js            # Router Hono + endpoints
└── scripts/
    └── generate-seo.mjs        # Genera paginas SEO estaticas post-build
```

### Service Worker
El SW cachea la Biblia completa (~8MB) en la primera visita. Las actualizaciones de codigo bumpean la version del cache automaticamente. La segunda Biblia (para comparacion) se descarga solo cuando el usuario entra en modo comparacion (lazy loading).

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
| GET | `/api/data/export` | Exportar todos los datos |
| GET | `/api/health` | Estado del API |

### Desarrollo local
```bash
node workers/robible-api/dev-server.js
# CORS: localhost:5173, 5174, 127.0.0.1:5173
# Base de datos: workers/robible-api/.dev-data/robible.db
```

---

## Workflow git

- **Frontend** (commits, PRs, merges): lo gestiona el usuario
- **Backend** (deploys a Cloudflare, queries D1, scripts): lo gestiona el agente

El agente **no debe** hacer `git commit` / `push` / `PR` / `merge` de archivos frontend.

---

## PWA e instalacion

1. **Android Chrome**: abre robible.com, espera a que cargue, usa el menu o el prompt de instalacion
2. **iOS Safari**: abre robible.com,Compartir > Anadir a pantalla de inicio
3. **Offline**: visita la web una vez, activa modo avion, reabriala — los datos biblicos seguiran disponibles
4. **SEO social**: comparte una URL de versiculo como `https://robible.com/biblia/vdc/romani/1/1`. El OG image se genera dinamicamente con el texto del versiculo

---

## Historial de releases

- **v1.1.0** (ago 2026): TTS karaoke con highlighting palabra por palabra, drone musical procedural, barra mini-player, lazy loading de la segunda Biblia, SEO con sitemap automatico y hreflang
- **v1.0** (may 2026): launch con Biblia Romina + Espanol, comparacion de versiones, indice tematico, auth multi-device

---

*Construido con Svelte 5, Cloudflare Workers y Netlify. La Biblia es la Palabra de Dios — que esta aplicacion ayude a acercarla a todos.*
