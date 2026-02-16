/**
 * App Badge Utility Tests
 * Story 10-7: Enhanced PWA for Mobile Production
 * AC-10.7.11: Unit tests for badge utility
 */

import { isBadgeSupported, setAppBadge, clearAppBadge } from '../appBadge';

describe('appBadge', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    // Reset navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('isBadgeSupported', () => {
    it('returns false when navigator is undefined', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(isBadgeSupported()).toBe(false);
    });

    it('returns false when setAppBadge is not available', () => {
      Object.defineProperty(global, 'navigator', {
        value: { clearAppBadge: jest.fn() },
        writable: true,
        configurable: true,
      });
      expect(isBadgeSupported()).toBe(false);
    });

    it('returns false when clearAppBadge is not available', () => {
      Object.defineProperty(global, 'navigator', {
        value: { setAppBadge: jest.fn() },
        writable: true,
        configurable: true,
      });
      expect(isBadgeSupported()).toBe(false);
    });

    it('returns true when both badge methods are available', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          setAppBadge: jest.fn(),
          clearAppBadge: jest.fn(),
        },
        writable: true,
        configurable: true,
      });
      expect(isBadgeSupported()).toBe(true);
    });
  });

  describe('setAppBadge', () => {
    it('returns false when badge API is not supported', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });
      const result = await setAppBadge(5);
      expect(result).toBe(false);
    });

    it('calls navigator.setAppBadge with count', async () => {
      const mockSetBadge = jest.fn().mockResolvedValue(undefined);
      const mockClearBadge = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(global, 'navigator', {
        value: {
          setAppBadge: mockSetBadge,
          clearAppBadge: mockClearBadge,
        },
        writable: true,
        configurable: true,
      });

      const result = await setAppBadge(5);
      expect(result).toBe(true);
      expect(mockSetBadge).toHaveBeenCalledWith(5);
    });

    it('calls clearAppBadge when count is 0', async () => {
      const mockSetBadge = jest.fn().mockResolvedValue(undefined);
      const mockClearBadge = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(global, 'navigator', {
        value: {
          setAppBadge: mockSetBadge,
          clearAppBadge: mockClearBadge,
        },
        writable: true,
        configurable: true,
      });

      const result = await setAppBadge(0);
      expect(result).toBe(true);
      expect(mockClearBadge).toHaveBeenCalled();
      expect(mockSetBadge).not.toHaveBeenCalled();
    });

    it('returns false on error', async () => {
      const mockSetBadge = jest.fn().mockRejectedValue(new Error('Badge failed'));
      Object.defineProperty(global, 'navigator', {
        value: {
          setAppBadge: mockSetBadge,
          clearAppBadge: jest.fn(),
        },
        writable: true,
        configurable: true,
      });

      const result = await setAppBadge(3);
      expect(result).toBe(false);
    });
  });

  describe('clearAppBadge', () => {
    it('returns false when badge API is not supported', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });
      const result = await clearAppBadge();
      expect(result).toBe(false);
    });

    it('calls navigator.clearAppBadge', async () => {
      const mockClearBadge = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(global, 'navigator', {
        value: {
          setAppBadge: jest.fn(),
          clearAppBadge: mockClearBadge,
        },
        writable: true,
        configurable: true,
      });

      const result = await clearAppBadge();
      expect(result).toBe(true);
      expect(mockClearBadge).toHaveBeenCalled();
    });

    it('returns false on error', async () => {
      const mockClearBadge = jest.fn().mockRejectedValue(new Error('Clear failed'));
      Object.defineProperty(global, 'navigator', {
        value: {
          setAppBadge: jest.fn(),
          clearAppBadge: mockClearBadge,
        },
        writable: true,
        configurable: true,
      });

      const result = await clearAppBadge();
      expect(result).toBe(false);
    });
  });
});
