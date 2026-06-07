/**
 * usePushNotifications — Story 12.3
 *
 * Manages browser-side Web Push subscription lifecycle.
 * Handles permission requests, subscription creation, and server sync.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

/** Converts a base64 URL-encoded VAPID public key to a Uint8Array for the PushManager API. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** Browser notification permission, or 'unsupported' when the API is unavailable. */
export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface UsePushNotificationsResult {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  /** Current OS/browser permission — 'denied' means the user must re-enable in settings. */
  permission: NotificationPermissionState;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  error: string | null;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const isSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window,
    []
  );

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermissionState>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  // Check current subscription status on mount.
  // Use a 3-second timeout so isLoading always clears even in dev mode
  // where the service worker is disabled and .ready never resolves.
  useEffect(() => {
    if (!isSupported) {
      setIsLoading(false);
      return;
    }
    const timeout = setTimeout(() => setIsLoading(false), 3000);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(sub !== null))
      .catch(() => setIsSubscribed(false))
      .finally(() => {
        clearTimeout(timeout);
        setIsLoading(false);
      });
    return () => clearTimeout(timeout);
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported) return;
    setError(null);
    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);
      if (result !== 'granted') {
        setError('Notification permission denied');
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setError('Push notifications are not configured');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast required: TypeScript types Uint8Array.buffer as ArrayBufferLike,
        // but PushManager expects ArrayBuffer specifically.
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      });

      const { endpoint, keys } = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, keys }),
      });

      if (!res.ok) {
        throw new Error('Failed to save push subscription');
      }

      setIsSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setError(null);
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (!subscription) return;

      const { endpoint } = subscription;
      await subscription.unsubscribe();

      await fetch('/api/push/unsubscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });

      setIsSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe, error };
}
