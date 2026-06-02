/**
 * Custom Service Worker Extension — Story 12.3
 *
 * Handles Web Push API events for SmartNudge delivery.
 * This file is merged into public/sw.js by next-pwa via customWorkerDir.
 *
 * NOTE: The service worker is disabled in development (NODE_ENV=development).
 * To test push locally, use Chrome DevTools → Application → Service Workers
 * → Push (enter a test JSON payload).
 */

declare let self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: { type?: string; title?: string; body?: string; data?: { url?: string } };
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { title: 'Smart Budget', body: event.data.text() };
  }

  const title = payload.title ?? 'Smart Budget';
  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: payload.data ?? {},
    tag: `nudge-${Date.now()}`,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = ((event.notification.data as { url?: string }) ?? {}).url ?? '/dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});
