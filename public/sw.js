// ========================================
// Zeus Tecnologia — Service Worker
// PWA CRM Admin Panel
// ========================================

const CACHE_NAME = 'zeus-crm-v5';
const OFFLINE_URL = '/admin.html';

const ASSETS_TO_CACHE = [
  '/',
  '/admin.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install — cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Zeus SW] Caching essential assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[Zeus SW] Removing old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Google Apps Script API calls (always need fresh data)
  if (event.request.url.includes('script.google.com')) return;

  // Skip ntfy.sh calls
  if (event.request.url.includes('ntfy.sh')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache the response
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If it's a navigation request, show the offline page
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

// Push notification handler (for future Web Push support)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Novo lead recebido!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'zeus-notification',
    data: {
      url: data.url || '/admin.html'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Zeus CRM', options)
  );
});

// Notification click — open the admin panel
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/admin.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If admin panel is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes('admin.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      return clients.openWindow(url);
    })
  );
});
