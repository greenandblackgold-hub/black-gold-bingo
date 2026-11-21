self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text?.() ?? '' };
  }
  const title = typeof data.title === 'string' ? data.title : 'BLACK GOLD BINGO';
  const options = {
    body: typeof data.body === 'string' ? data.body : 'አዲስ ማሳወቂያ ደርሷል።',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: typeof data.tag === 'string' ? data.tag : 'black-gold-bingo',
    data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/' },
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
