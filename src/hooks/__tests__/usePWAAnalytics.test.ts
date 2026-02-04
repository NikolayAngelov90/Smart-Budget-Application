/**
 * PWA Analytics Hook Unit Tests
 * Story 9-5: Add Export and PWA Analytics (AC-9.5.7)
 */

import { renderHook, act } from '@testing-library/react';
import { usePWAAnalytics } from '../usePWAAnalytics';

// Mock analytics service
jest.mock('@/lib/services/analyticsService', () => ({
  trackPWAInstalled: jest.fn().mockResolvedValue({ success: true }),
  trackOfflineModeActive: jest.fn().mockResolvedValue({ success: true }),
  flushBufferedEvents: jest.fn().mockResolvedValue(undefined),
  isOnline: jest.fn().mockReturnValue(true),
}));

// Get mocked functions
import {
  trackPWAInstalled,
  trackOfflineModeActive,
  flushBufferedEvents,
  isOnline,
} from '@/lib/services/analyticsService';

const mockTrackPWAInstalled = trackPWAInstalled as jest.Mock;
const mockTrackOfflineModeActive = trackOfflineModeActive as jest.Mock;
const mockFlushBufferedEvents = flushBufferedEvents as jest.Mock;
const mockIsOnline = isOnline as jest.Mock;

// Mock caches API
const mockCaches = {
  keys: jest.fn().mockResolvedValue([]),
  open: jest.fn().mockResolvedValue({
    keys: jest.fn().mockResolvedValue([]),
    match: jest.fn(),
  }),
};
Object.defineProperty(global, 'caches', { value: mockCaches });

describe('usePWAAnalytics', () => {
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;
  const eventListeners: Record<string, EventListener[]> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    eventListeners.appinstalled = [];
    eventListeners.offline = [];
    eventListeners.online = [];

    addEventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (!eventListeners[type]) {
          eventListeners[type] = [];
        }
        eventListeners[type].push(listener as EventListener);
      }
    );

    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (eventListeners[type]) {
          eventListeners[type] = eventListeners[type].filter(l => l !== listener);
        }
      }
    );

    mockIsOnline.mockReturnValue(true);
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('sets up event listeners on mount', () => {
    renderHook(() => usePWAAnalytics());

    expect(addEventListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
  });

  it('removes event listeners on unmount', () => {
    const { unmount } = renderHook(() => usePWAAnalytics());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
  });

  it('flushes buffered events on mount when online', () => {
    mockIsOnline.mockReturnValue(true);
    renderHook(() => usePWAAnalytics());

    expect(mockFlushBufferedEvents).toHaveBeenCalled();
  });

  it('does not flush buffered events on mount when offline', () => {
    mockIsOnline.mockReturnValue(false);
    renderHook(() => usePWAAnalytics());

    expect(mockFlushBufferedEvents).not.toHaveBeenCalled();
  });

  it('tracks PWA installation when appinstalled event fires (AC-9.5.3)', async () => {
    renderHook(() => usePWAAnalytics());

    await act(async () => {
      eventListeners.appinstalled.forEach(listener => listener(new Event('appinstalled')));
    });

    expect(mockTrackPWAInstalled).toHaveBeenCalled();
  });

  it('tracks offline mode when offline event fires (AC-9.5.4)', async () => {
    renderHook(() => usePWAAnalytics());

    await act(async () => {
      eventListeners.offline.forEach(listener => listener(new Event('offline')));
    });

    expect(mockTrackOfflineModeActive).toHaveBeenCalledWith(0); // Empty cache
  });

  it('flushes events when online event fires (AC-9.5.9)', async () => {
    renderHook(() => usePWAAnalytics());
    mockFlushBufferedEvents.mockClear();

    await act(async () => {
      eventListeners.online.forEach(listener => listener(new Event('online')));
    });

    expect(mockFlushBufferedEvents).toHaveBeenCalled();
  });

  it('prevents duplicate offline tracking in same session', async () => {
    renderHook(() => usePWAAnalytics());

    // Trigger offline twice
    await act(async () => {
      eventListeners.offline.forEach(listener => listener(new Event('offline')));
    });
    await act(async () => {
      eventListeners.offline.forEach(listener => listener(new Event('offline')));
    });

    // Should only track once
    expect(mockTrackOfflineModeActive).toHaveBeenCalledTimes(1);
  });

  it('resets offline tracking flag when back online', async () => {
    renderHook(() => usePWAAnalytics());

    // Go offline
    await act(async () => {
      eventListeners.offline.forEach(listener => listener(new Event('offline')));
    });

    // Go online
    await act(async () => {
      eventListeners.online.forEach(listener => listener(new Event('online')));
    });

    // Go offline again
    await act(async () => {
      eventListeners.offline.forEach(listener => listener(new Event('offline')));
    });

    // Should track twice (once per offline session)
    expect(mockTrackOfflineModeActive).toHaveBeenCalledTimes(2);
  });
});
