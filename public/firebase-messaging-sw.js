// Service worker for push notifications (FCM web push). It only shows what the server sends;
// the app itself is not cached or served from here.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = {}; }
  // The server sends data-only messages ({data:{title,body,url}}); accept the `notification` shape too.
  const data = payload.data || {};
  const note = payload.notification || {};
  const title = data.title || note.title || 'אוהל בוס';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || note.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    dir: 'rtl',
    lang: 'he',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) return client.focus();
    }
    return self.clients.openWindow(target);
  })());
});
