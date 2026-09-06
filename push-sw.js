/* SisVentas - worker exclusivo de Firebase Cloud Messaging.
   Usa un alcance separado para no competir con el service worker offline. */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCw8Q4-fUA69iWFkDuy8qEkEcOGHOjFsto',
  authDomain: 'nixa-sisventas.firebaseapp.com',
  databaseURL: 'https://nixa-sisventas-default-rtdb.firebaseio.com',
  projectId: 'nixa-sisventas',
  storageBucket: 'nixa-sisventas.firebasestorage.app',
  messagingSenderId: '171899432710',
  appId: '1:171899432710:web:47d7d4da42c07166983887',
});

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var notification = payload.notification || {};
  var data = payload.data || {};
  self.registration.showNotification(notification.title || data.title || 'SisVentas', {
    body: notification.body || data.body || 'Tenés una nueva notificación.',
    icon: './nixa-icon-192.png',
    badge: './nixa-icon-192.png',
    tag: data.notificationId || data.type || 'sisventas-push',
    renotify: true,
    data: data,
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var data = event.notification.data || {};
  event.waitUntil((async function () {
    var target = new URL('./index.html', self.location.origin);
    if (data.type) target.searchParams.set('pushType', data.type);
    if (data.notificationId) target.searchParams.set('pushId', data.notificationId);
    var windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    var existing = windows.find(function (client) { return new URL(client.url).origin === self.location.origin; });
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: 'SISVENTAS_PUSH_OPEN', data: data });
      return existing;
    }
    return self.clients.openWindow(target.href);
  })());
});
