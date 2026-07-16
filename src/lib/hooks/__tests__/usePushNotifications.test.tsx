/**
 * usePushNotifications — Story 15.5 AC4 regression
 *
 * Users who decline permissions are NEVER re-prompted: subscribe() must not
 * call Notification.requestPermission when permission is already 'denied'.
 */

import { renderHook, act } from '@testing-library/react';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';

describe('usePushNotifications — AC4 never re-prompt', () => {
  const originalNotification = (global as Record<string, unknown>).Notification;
  const originalSW = Object.getOwnPropertyDescriptor(global.navigator, 'serviceWorker');

  afterEach(() => {
    (global as Record<string, unknown>).Notification = originalNotification;
    if (originalSW) Object.defineProperty(global.navigator, 'serviceWorker', originalSW);
    jest.restoreAllMocks();
  });

  function setupDenied() {
    const requestPermission = jest.fn().mockResolvedValue('denied');
    (global as Record<string, unknown>).Notification = {
      permission: 'denied',
      requestPermission,
    };
    Object.defineProperty(global.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({ pushManager: { getSubscription: async () => null } }),
        register: jest.fn(),
      },
    });
    Object.defineProperty(global, 'PushManager', { configurable: true, value: function () {} });
    return requestPermission;
  }

  it('subscribe() with permission=denied never calls requestPermission', async () => {
    const requestPermission = setupDenied();
    const { result } = renderHook(() => usePushNotifications());

    expect(result.current.permission).toBe('denied');

    await act(async () => {
      await result.current.subscribe();
    });

    expect(requestPermission).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Notification permission denied');
    expect(result.current.isSubscribed).toBe(false);
  });
});
