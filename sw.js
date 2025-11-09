const CACHE_NAME = 'badtracker-v2';

// Liste des ressources à mettre en cache
const RESOURCES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
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
  console.log('[Service Worker] Fetch:', event.request.url);
  
  // Stratégie "Cache First, puis réseau"
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retourne la ressource du cache si elle existe
        if (response) {
          console.log('[Service Worker] Ressource trouvée dans le cache');
          return response;
        }
        
        // Sinon, fait la requête réseau
        console.log('[Service Worker] Téléchargement de la ressource:', event.request.url);
        return fetch(event.request)
          .then((networkResponse) => {
            // Si la réponse est valide, on la met en cache
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              
              caches.open(CACHE_NAME)
                .then((cache) => {
                  console.log('[Service Worker] Mise en cache de la nouvelle ressource:', event.request.url);
                  cache.put(event.request, responseToCache);
                });
            }
            
            return networkResponse;
          })
          .catch(() => {
            // En cas d'échec (hors ligne), on peut retourner une page d'erreur personnalisée
            console.log('[Service Worker] Échec de la requête:', event.request.url);
          });
      })
  );
});
