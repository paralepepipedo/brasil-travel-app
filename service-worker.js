// =====================================================
// service-worker.js - PWA básico para Brasil Travel App
// =====================================================

// Nombre del cache
const CACHE_NAME = 'brasil-travel-v1.1';
const urlsToCache = [
  '/',
  '/index.html',
  '/itinerario.html',
  '/supabase-sync.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Instalación: cachear archivos estáticos
self.addEventListener('install', event => {
  console.log('🔨 Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Cacheando archivos');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activación: limpiar cachés viejos
self.addEventListener('activate', event => {
  console.log('⚙️ Service Worker: Activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptar requests: Cache-First para archivos estáticos
self.addEventListener('fetch', event => {
  // Ignorar requests no-HTTP/HTTPS
  if (event.request.url.startsWith('http') === false) {
    return;
  }

  // Cache-first para archivos estáticos
  event.respond
