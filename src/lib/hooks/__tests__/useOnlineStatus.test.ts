/**
 * Story 8.4: Data Sync Status and Multi-Device Information
 * Unit Tests for useOnlineStatus hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useOnlineStatus, updateLastSync } from '../useOnlineStatus';
import { createClient } from '@/lib/supabase/client';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('useOnlineStatus', () => {
  let mockSupabase: {
    channel: jest.Mock;
    removeChannel: jest.Mock;
  };
  let mockChannel: {
    on: jest.Mock;
    subscribe: jest.Mock;
    unsubscribe: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock localStorage
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();

    // Mock Supabase channel
    mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      }),
    };

    mockSupabase = {
      channel: jest.fn(() => mockChannel),
      removeChannel: jest.fn(),
    };

    mockCreateClient.mockReturnValue(mockSupabase);

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AC-8.4.1: Online/Offline Status Detection', () => {
    test('initializes with online status from navigator.onLine', () => {
      Object.defineProperty(navigator, 'onLine', { value: true });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current.isOnline).toBe(true);
      expect(result.current.syncStatus).toBe('synced');
    });

    test('initializes with offline status when navigator is offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current.isOnline).toBe(false);
      expect(result.current.syncStatus).toBe('offline');
    });

    test('updates status when online event fires', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current.isOnline).toBe(false);

      // Simulate going online
      Object.defineProperty(navigator, 'onLine', { value: true });
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
        expect(result.current.syncStatus).toBe('synced');
      });
    });

    test('updates status when offline event fires', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current.isOnline).toBe(true);

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
        expect(result.current.syncStatus).toBe('offline');
      });
    });
  });

  describe('AC-8.4.2: Last Sync Timestamp Tracking', () => {
    test('initializes lastSync from localStorage if available', () => {
      const mockDate = new Date('2025-01-01T12:00:00Z');
      (localStorage.getItem as jest.Mock).mockReturnValue(mockDate.toISOString());

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current.lastSync).toBeTruthy();
    });

    test('sets lastSync to current time if not in localStorage', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current.lastSync).toBeInstanceOf(Date);
    });

    test('saves lastSync to localStorage on initialization', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      renderHook(() => useOnlineStatus());

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'smart-budget-last-sync',
        expect.any(String)
      );
    });

    test('updates lastSync when updateLastSync is called', async () => {
      const { result } = renderHook(() => useOnlineStatus());

      const initialLastSync = result.current.lastSync;

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      act(() => {
        updateLastSync();
      });

      await waitFor(() => {
        expect(result.current.lastSync).not.toEqual(initialLastSync);
      });
    });
  });

  describe('AC-8.4.3 & AC-8.4.4: Supabase Realtime Integration', () => {
    test('subscribes to transactions table changes when online', () => {
      Object.defineProperty(navigator, 'onLine', { value: true });

      renderHook(() => useOnlineStatus());

      expect(mockSupabase.channel).toHaveBeenCalledWith('sync-status-monitor');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    test('does not subscribe to Realtime when offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false });

      renderHook(() => useOnlineStatus());

      expect(mockSupabase.channel).not.toHaveBeenCalled();
    });

    test('updates lastSync and syncStatus when transaction change occurs', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true });

      let transactionCallback: (() => void) | undefined;
      mockChannel.on.mockImplementation((event: string, config: Record<string, unknown>, callback: () => void) => {
        if (event === 'postgres_changes') {
          transactionCallback = callback;
        }
        return mockChannel;
      });

      const { result } = renderHook(() => useOnlineStatus());

      const initialLastSync = result.current.lastSync;

      // Simulate transaction change
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        transactionCallback();
      });

      await waitFor(() => {
        expect(result.current.lastSync).not.toEqual(initialLastSync);
        expect(result.current.syncStatus).toBe('synced');
      });
    });

    test('sets syncStatus to synced when Realtime connects', async () => {
      let subscribeCallback: ((status: string) => void) | undefined;
      mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
        subscribeCallback = callback;
        return mockChannel;
      });

      const { result } = renderHook(() => useOnlineStatus());

      act(() => {
        subscribeCallback('SUBSCRIBED');
      });

      await waitFor(() => {
        expect(result.current.syncStatus).toBe('synced');
      });
    });

    test('sets syncStatus to offline when Realtime has error', async () => {
      let subscribeCallback: ((status: string) => void) | undefined;
      mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
        subscribeCallback = callback;
        return mockChannel;
      });

      const { result } = renderHook(() => useOnlineStatus());

      act(() => {
        subscribeCallback('CHANNEL_ERROR');
      });

      await waitFor(() => {
        expect(result.current.syncStatus).toBe('offline');
      });
    });

    test('removes Realtime channel on unmount', () => {
      const { unmount } = renderHook(() => useOnlineStatus());

      unmount();

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe('Edge Cases', () => {
    test('handles localStorage errors gracefully', () => {
      (localStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current.lastSync).toBeInstanceOf(Date);
    });

    test('handles invalid date in localStorage', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('invalid-date');

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current.lastSync).toBeInstanceOf(Date);
    });
  });
});
