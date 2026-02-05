/**
 * Session Service Unit Tests
 * Story 9-6: Complete Device Session Management (AC-9.6.9)
 */

import {
  detectDeviceType,
  detectBrowser,
  generateDeviceName,
  getCurrentSessionToken,
} from '../sessionService';

// Mock localStorage
let localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => localStorageStore[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: jest.fn(() => {
    localStorageStore = {};
  }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('sessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageStore = {};
    mockFetch.mockReset();
  });

  describe('detectDeviceType', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('returns "mobile" for iPhone user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' },
        writable: true,
      });
      expect(detectDeviceType()).toBe('mobile');
    });

    it('returns "mobile" for Android mobile user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 10; Mobile)' },
        writable: true,
      });
      expect(detectDeviceType()).toBe('mobile');
    });

    it('returns "tablet" for iPad user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)' },
        writable: true,
      });
      expect(detectDeviceType()).toBe('tablet');
    });

    it('returns "tablet" for Android tablet user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 10)' },
        writable: true,
      });
      expect(detectDeviceType()).toBe('tablet');
    });

    it('returns "desktop" for desktop user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        writable: true,
      });
      expect(detectDeviceType()).toBe('desktop');
    });

    it('returns "desktop" when navigator is undefined', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
      });
      expect(detectDeviceType()).toBe('desktop');
    });
  });

  describe('detectBrowser', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('returns "Chrome" for Chrome user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/90.0.4430.93' },
        writable: true,
      });
      expect(detectBrowser()).toBe('Chrome');
    });

    it('returns "Firefox" for Firefox user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/88.0' },
        writable: true,
      });
      expect(detectBrowser()).toBe('Firefox');
    });

    it('returns "Safari" for Safari user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15' },
        writable: true,
      });
      expect(detectBrowser()).toBe('Safari');
    });

    it('returns "Edge" for Edge user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Edge/90.0.818.51' },
        writable: true,
      });
      expect(detectBrowser()).toBe('Edge');
    });

    it('returns "Unknown" when navigator is undefined', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
      });
      expect(detectBrowser()).toBe('Unknown');
    });
  });

  describe('generateDeviceName', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('generates "Chrome on Windows" for Windows Chrome', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/90.0' },
        writable: true,
      });
      expect(generateDeviceName()).toBe('Chrome on Windows');
    });

    it('generates "Safari on iPhone" for iPhone Safari', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15' },
        writable: true,
      });
      expect(generateDeviceName()).toBe('Safari on iPhone');
    });

    it('generates "Chrome on Mac" for Mac Chrome', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/90.0' },
        writable: true,
      });
      expect(generateDeviceName()).toBe('Chrome on Mac');
    });

    it('generates "Chrome on Android Phone" for Android mobile Chrome', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/90.0' },
        writable: true,
      });
      expect(generateDeviceName()).toBe('Chrome on Android Phone');
    });
  });

  describe('getCurrentSessionToken', () => {
    it('returns null when localStorage is empty', () => {
      expect(getCurrentSessionToken()).toBeNull();
    });

    it('returns session token from localStorage', () => {
      localStorageStore['analytics_session_id'] = 'test-session-123';
      expect(getCurrentSessionToken()).toBe('test-session-123');
    });
  });
});
