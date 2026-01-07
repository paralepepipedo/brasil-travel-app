// =====================================================
// service-worker.js - Brasil Travel App
// =====================================================

const CACHE_NAME = 'brasil-travel-v1.2';
const urlsToCache = [
  '/',
  '/index.html',
  '/itinerario.html',
  '/supabase-sync.js',
  '/manifest.json'
];

// Instalación
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cacheando archivos');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('Error cacheando:', err))
  );
  self.skipWaiting();
});

// Activación
self.addEventListener('activate', event => {
  console.log('Service Worker: Activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch - Estrategia Network First (intenta red, sino cache)
self.addEventListener('fetch', event => {
  // Ignorar non-HTTP requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Ignorar requests a APIs externas (Supabase)
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si hay respuesta válida, cachear y devolver
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla (offline), buscar en cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si tampoco hay cache, devolver página offline básica
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
