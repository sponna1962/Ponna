// Custom service worker addition (Sept 2026, Push Notifications —
// Priority 1, Accessibility & Reach). next-pwa automatically merges this
// file into the auto-generated sw.js (default `customWorkerDir: 'worker'`
// — see next.config.js, unchanged) alongside the normal Workbox
// precaching/offline-shell logic already set up for the PWA. This file
// ONLY adds push notification handling — it does not touch caching.

self.__WB_DISABLE_DEV_LOGS = true;

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'PONNA', body: event.data.text() };
  }

  const title = data.title || 'PONNA';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
