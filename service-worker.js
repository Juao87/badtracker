const CACHE_NAME = 'badtracker-v3';

// Liste des ressources à mettre en cache
const RESOURCES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css', // Ajout du fichier CSS
  './js/main.js',    // Ajout du fichier JS
  // Bibliothèques externes via CDN
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0/dist/chartjs-plugin-datalabels.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  // Icônes
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation');
  
  // Préchargement des ressources
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Mise en cache des ressources');
        return cache.addAll(RESOURCES_TO_CACHE);
      })
  );
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation');
  
  // Nettoyage des anciens caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Check if the request is for a CDN resource
  if (url.protocol === 'https:' && (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'cdnjs.cloudflare.com')) {
    // Stale-While-Revalidate for CDN resources
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(error => {
            console.warn('[Service Worker] Network fetch failed for CDN resource:', request.url, error);
            // Optionally, if cachedResponse was undefined and network failed,
            // you might want to return a generic fallback if you have one.
            // For now, just let it fail to reflect network unavailability if not in cache.
          });

          // Return cached response immediately if available, otherwise wait for network
          return cachedResponse || fetchPromise;
        });
      })
    );
  } else {
    // Cache First, then network for local assets
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          // console.log('[Service Worker] Local resource found in cache:', request.url);
          return response;
        }
        // console.log('[Service Worker] Local resource not in cache, fetching:', request.url);
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) { // Only cache valid responses for basic requests
            // For local assets, we usually only cache if they are 'basic' type (same origin)
            // However, the original SW cached CDN resources which are not 'basic'.
            // Let's stick to caching successful GET requests for local assets.
            if (request.method === 'GET') { // Ensure we only cache GET requests
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache);
                });
            }
          }
          return networkResponse;
        }).catch(() => {
          console.warn('[Service Worker] Network fetch failed for local resource:', request.url);
          // Optionally return a generic offline page/resource for local assets if desired
        });
      })
    );
  }
});
