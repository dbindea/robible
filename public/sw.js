const CACHE_NAME = 'robible-v23';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/global.css',
  '/icon.css',
  '/site.webmanifest',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/maskable-icon-192x192.png',
  '/maskable-icon-512x512.png',
  '/assets/img/logo.png',
  '/assets/font/open-sans-v28-latin-300.woff2',
  '/assets/font/open-sans-v28-latin-500.woff2',
  '/assets/font/open-sans-v28-latin-500italic.woff2',
  '/assets/font/open-sans-v28-latin-600.woff2',
  '/assets/font/open-sans-v28-latin-600italic.woff2',
  '/assets/font/open-sans-v28-latin-regular.woff2',
  '/assets/font/open-sans-v28-latin-700.woff2',
  '/assets/font/open-sans-v28-latin-700italic.woff2',
  '/assets/font/open-sans-v28-latin-italic.woff2',
  '/assets/icon/fonts/icomoon.eot?bx6h1k',
  '/assets/icon/fonts/icomoon.svg?bx6h1k',
  '/assets/icon/fonts/icomoon.ttf?bx6h1k',
  '/assets/icon/fonts/icomoon.woff?bx6h1k',
  '/lang/ro.json',
  '/lang/es.json',
  // Solo se precachean las dos Biblias originales (~8,5 MB). Las de en_kjv y
  // zh_cuv NO van aquí a propósito: sumarlas dejaría la instalación en ~17 MB
  // para descargar cuatro Biblias de las que el usuario leerá una. Se cachean
  // igualmente la primera vez que se abren, por la regla cache-first de
  // /data/ más abajo — la diferencia es que no están disponibles sin conexión
  // hasta esa primera lectura.
  '/data/vdc/bible.map.json',
  '/data/vdc/bible.json',
  '/data/rvl/bible.map.json',
  '/data/rvl/bible.json',
];

const canCache = (request) => request.method === 'GET' && new URL(request.url).origin === self.location.origin;

const putInCache = async (request, response) => {
  if (!response || !response.ok) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
};

const cacheAppBuildAssets = async (cache) => {
  const response = await fetch('/', { cache: 'reload' });

  if (!response.ok) {
    return;
  }

  await cache.put('/', response.clone());

  const html = await response.text();
  const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);

  await Promise.allSettled(
    [...new Set(assetPaths)].map(async (assetPath) => {
      const assetResponse = await fetch(assetPath, { cache: 'reload' });

      if (assetResponse.ok) {
        await cache.put(assetPath, assetResponse);
      }
    }),
  );
};

const cacheFirst = async (request) => {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  await putInCache(request, response);
  return response;
};

// Stale-while-revalidate: sirve cache inmediatamente, en paralelo descarga
// la versión nueva del servidor y actualiza la cache para la próxima vez.
// Usado para archivos de traducción y otros assets que se actualizan con deploy.
const staleWhileRevalidate = async (request) => {
  const cachedResponse = await caches.match(request);

  // Lanzamos la petición de red en paralelo (sin await del set)
  const networkUpdate = fetch(request)
    .then((response) => putInCache(request, response))
    .catch(() => {
      // Red caída: nos quedamos con la cache
    });

  if (cachedResponse) {
    return cachedResponse;
  }

  // No hay cache, esperamos a la red
  await networkUpdate;
  return (await caches.match(request)) || new Response('', { status: 504 });
};

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    await putInCache(request, response);
    return response;
  } catch {
    return (await caches.match(request)) || caches.match('/');
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        CORE_ASSETS.map(async (asset) => {
          const response = await fetch(asset, { cache: 'reload' });

          if (response.ok) {
            await cache.put(asset, response);
          }
        }),
      );
      await cacheAppBuildAssets(cache).catch(() => {});
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!canCache(request)) {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.pathname.startsWith('/lang/')
  ) {
    // Traducciones: stale-while-revalidate para que siempre estén al día
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/data/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
