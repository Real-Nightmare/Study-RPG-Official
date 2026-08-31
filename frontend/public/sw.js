/* Study RPG — Web Push service worker (VAPID, Phase 9). */
self.addEventListener('push', (event) => {
  let data = { title: 'Study RPG', body: '', url: '/dashboard' };
  try {
    const parsed = event.data ? JSON.parse(event.data.text()) : {};
    data = { ...data, ...parsed };
  } catch {
    /* ignore malformed payloads */
  }

  const options = {
    body: data.body,
    icon: '/logos/studyrpg-logo.png',
    badge: '/logos/studyrpg-logo.png',
    data: { url: data.url },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
