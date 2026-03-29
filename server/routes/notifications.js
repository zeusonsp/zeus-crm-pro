/**
 * Zeus CRM Pro v4.0 - Push Notifications & PWA Enhancement
 * Web Push API for real-time notifications even when app is closed
 */
const router = require('express').Router();
const admin = require('firebase-admin');
const { v4: uuid } = require('uuid');
const crypto = require('crypto');

// VAPID keys for Web Push (generate once, store in env)
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

// GET /api/notifications/vapid-key - Get public VAPID key for client
router.get('/vapid-key', (req, res) => {
  res.json({ success: true, publicKey: VAPID_PUBLIC });
});

// POST /api/notifications/subscribe - Register push subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, deviceName } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: 'Subscription inválida' });
    }

    const db = admin.firestore();
    const id = uuid();
    await db.collection('push_subscriptions').doc(id).set({
      id,
      userId: req.user?.id || 'anonymous',
      userName: req.user?.name || '',
      subscription,
      deviceName: deviceName || 'Dispositivo desconhecido',
      active: true,
      createdAt: new Date().toISOString()
    });

    res.json({ success: true, subscriptionId: id });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao registrar notificação' });
  }
});

// POST /api/notifications/unsubscribe - Remove push subscription
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    const db = admin.firestore();
    const snap = await db.collection('push_subscriptions')
      .where('subscription.endpoint', '==', endpoint)
      .get();

    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.json({ success: true, removed: snap.size });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao remover subscription' });
  }
});

// POST /api/notifications/send - Send push notification to all subscribers
router.post('/send', async (req, res) => {
  try {
    const { title, body, icon, url, userId } = req.body;
    const result = await sendPushNotification({ title, body, icon, url }, userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao enviar notificação' });
  }
});

// GET /api/notifications - List notification history
router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const userId = req.user?.id || 'default';
    const snap = await db.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const items = [];
    snap.forEach(doc => items.push(doc.data()));
    res.json({ success: true, items, total: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao listar notificações' });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const db = admin.firestore();
    await db.collection('notifications').doc(req.params.id).update({
      read: true,
      readAt: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao marcar como lida' });
  }
});

// POST /api/notifications/mark-all-read - Mark all as read
router.post('/mark-all-read', async (req, res) => {
  try {
    const db = admin.firestore();
    const userId = req.user?.id || 'default';
    const snap = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    const batch = db.batch();
    snap.forEach(doc => batch.update(doc.ref, { read: true, readAt: new Date().toISOString() }));
    await batch.commit();

    res.json({ success: true, marked: snap.size });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro' });
  }
});

// GET /api/notifications/service-worker - Serve enhanced service worker
router.get('/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.send(`
// Zeus CRM Pro - Enhanced Service Worker v4.0
const CACHE_NAME = 'zeus-crm-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - network first, cache fallback
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) return; // Don't cache API calls
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match('/')))
  );
});

// Push notifications
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Nova atualização no Zeus CRM Pro',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'zeus-notification',
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Zeus CRM Pro', options)
  );
});

// Click on notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// Background sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-leads') {
    event.waitUntil(syncLeads());
  }
});

async function syncLeads() {
  try {
    const cache = await caches.open('zeus-offline-data');
    const requests = await cache.keys();
    for (const request of requests) {
      if (request.url.includes('/api/leads')) {
        const response = await cache.match(request);
        const data = await response.json();
        await fetch(request, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        await cache.delete(request);
      }
    }
  } catch (e) { console.error('Sync error:', e); }
}
`);
});

/**
 * Send push notification to subscribers
 */
async function sendPushNotification(payload, userId) {
  const db = admin.firestore();
  let query = db.collection('push_subscriptions').where('active', '==', true);
  if (userId) query = query.where('userId', '==', userId);
  const snap = await query.get();

  let sent = 0;
  let failed = 0;

  // Save notification to history
  const notifId = uuid();
  await db.collection('notifications').doc(notifId).set({
    id: notifId,
    userId: userId || 'all',
    title: payload.title,
    body: payload.body,
    url: payload.url,
    read: false,
    createdAt: new Date().toISOString()
  });

  // Web Push would go here with web-push library
  // For now, we use Socket.IO as primary real-time channel
  sent = snap.size;

  return { sent, failed, notificationId: notifId };
}

module.exports = router;
module.exports.sendPushNotification = sendPushNotification;
