'use client';

/**
 * ServiceWorkerRegistrar
 *
 * Explicitly registers the PWA service worker (`/sw.js`) on the client.
 *
 * next-pwa generates `public/sw.js` but its `register: true` auto-registration is injected
 * via the Pages-Router entry, which doesn't exist in this App-Router app — so without this,
 * the service worker is never registered, `navigator.serviceWorker.ready` never resolves,
 * and push-notification subscription hangs. Registration is idempotent and production-only
 * (next-pwa disables the SW in development).
 */

import { useEffect } from 'react';

/** Idempotently registers the PWA service worker at `/sw.js`. No-op if unsupported. */
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.error('[PWA] Service worker registration failed:', err);
  });
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // SW is generated only in production builds (next-pwa disables it in dev).
    if (process.env.NODE_ENV !== 'production') return;
    registerServiceWorker();
  }, []);

  return null;
}
