/**
 * Analytics Service Unit Tests
 * Story 9-4: Add Insight Engagement Analytics (AC-9.4.8)
 * Story 9-5: Add Export and PWA Analytics (AC-9.5.7)
 */

import {
  detectDeviceType,
  getSessionId,
  clearSessionId,
  trackEvent,
  trackInsightsPageViewed,
  trackInsightViewed,
  trackInsightDismissed,
  // Story 9-5 exports
  isOnline,
  getBufferedEvents,
  bufferEvent,
  clearBufferedEvents,
  flushBufferedEvents,
  hasPWAInstallBeenTracked,
  markPWAInstallTracked,
  trackCSVExported,
  trackPDFExported,
  detectPWAPlatform,
  trackPWAInstalled,
  trackOfflineModeActive,
} from '../analyticsService';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto.randomUUID
const mockRandomUUID = jest.fn(() => 'mock-uuid-1234');
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: mockRandomUUID },
});

// Mock localStorage with accessible store
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

describe('analyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageStore = {}; // Clear the store directly
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
        value: {
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        },
        writable: true,
      });
      expect(detectDeviceType()).toBe('mobile');
    });

    it('returns "mobile" for Android mobile user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36',
        },
        writable: true,
      });
      expect(detectDeviceType()).toBe('mobile');
    });

    it('returns "tablet" for iPad user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        },
        writable: true,
      });
      expect(detectDeviceType()).toBe('tablet');
    });

    it('returns "tablet" for Android tablet user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
        },
        writable: true,
      });
      expect(detectDeviceType()).toBe('tablet');
    });

    it('returns "desktop" for desktop user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
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

  describe('getSessionId', () => {
    it('creates new session ID if none exists', () => {
      const sessionId = getSessionId();
      expect(sessionId).toBe('mock-uuid-1234');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'analytics_session_id',
        'mock-uuid-1234'
      );
    });

    it('returns existing session ID from localStorage', () => {
      localStorageMock.getItem.mockReturnValueOnce('existing-session-id');
      const sessionId = getSessionId();
      expect(sessionId).toBe('existing-session-id');
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('clearSessionId', () => {
    it('removes session ID from localStorage', () => {
      clearSessionId();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'analytics_session_id'
      );
    });
  });

  describe('trackEvent', () => {
    it('sends event to API endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, event_id: 'event-123' }),
      });

      const result = await trackEvent('insights_page_viewed', { filter: 'all' });

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('insights_page_viewed'),
      });
      expect(result).toEqual({ success: true, event_id: 'event-123' });
    });

    it('includes session_id and device_type in payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, event_id: 'event-123' }),
      });

      await trackEvent('insight_viewed', { insight_id: 'abc' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.session_id).toBeDefined();
      expect(callBody.device_type).toBeDefined();
    });

    it('returns error response on HTTP failure without throwing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await trackEvent('insights_page_viewed');

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('returns error response on network failure without throwing', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await trackEvent('insights_page_viewed');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('handles empty event_properties', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, event_id: 'event-123' }),
      });

      await trackEvent('insights_page_viewed');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event_properties).toEqual({});
    });
  });

  describe('trackInsightsPageViewed', () => {
    it('tracks page view with filter and page', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await trackInsightsPageViewed('spending', 2);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event_name).toBe('insights_page_viewed');
      expect(callBody.event_properties.filter).toBe('spending');
      expect(callBody.event_properties.page).toBe(2);
    });

    it('excludes filter if "all"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await trackInsightsPageViewed('all', 1);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event_properties.filter).toBeUndefined();
    });

    it('excludes page if 1', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await trackInsightsPageViewed('spending', 1);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event_properties.page).toBeUndefined();
    });
  });

  describe('trackInsightViewed', () => {
    it('tracks insight view with id and type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await trackInsightViewed('insight-123', 'spending_increase');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event_name).toBe('insight_viewed');
      expect(callBody.event_properties.insight_id).toBe('insight-123');
      expect(callBody.event_properties.insight_type).toBe('spending_increase');
    });
  });

  describe('trackInsightDismissed', () => {
    it('tracks insight dismissal with id and type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await trackInsightDismissed('insight-456', 'budget_recommendation');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event_name).toBe('insight_dismissed');
      expect(callBody.event_properties.insight_id).toBe('insight-456');
      expect(callBody.event_properties.insight_type).toBe('budget_recommendation');
    });
  });

  // Story 9-5 Tests

  describe('isOnline', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('returns true when navigator.onLine is true', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'test', onLine: true },
        writable: true,
      });
      expect(isOnline()).toBe(true);
    });

    it('returns false when navigator.onLine is false', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'test', onLine: false },
        writable: true,
      });
      expect(isOnline()).toBe(false);
    });

    it('returns true when navigator is undefined', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
      });
      expect(isOnline()).toBe(true);
    });
  });

  describe('offline event buffering (AC-9.5.9)', () => {
    it('bufferEvent stores event in localStorage', () => {
      const event = {
        event_name: 'test_event',
        event_properties: { test: true },
        timestamp: '2026-02-04T12:00:00.000Z',
        session_id: 'session-123',
        device_type: 'desktop' as const,
      };

      bufferEvent(event);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'analytics_event_buffer',
        expect.stringContaining('test_event')
      );
    });

    it('getBufferedEvents returns empty array when no events', () => {
      // Store is empty by default
      expect(getBufferedEvents()).toEqual([]);
    });

    it('getBufferedEvents returns parsed events from localStorage', () => {
      const events = [{ event_name: 'test', timestamp: '2026-02-04T12:00:00.000Z' }];
      localStorageStore['analytics_event_buffer'] = JSON.stringify(events);
      expect(getBufferedEvents()).toEqual(events);
    });

    it('clearBufferedEvents removes events from localStorage', () => {
      clearBufferedEvents();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('analytics_event_buffer');
    });

    it('trackEvent buffers event when offline', async () => {
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', onLine: false },
        writable: true,
      });

      const result = await trackEvent('csv_exported', { transaction_count: 100 });

      expect(result.success).toBe(true);
      expect(result.error).toBe('Event buffered for offline');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'analytics_event_buffer',
        expect.stringContaining('csv_exported')
      );
      expect(mockFetch).not.toHaveBeenCalled();

      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('flushBufferedEvents sends buffered events when online', async () => {
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', onLine: true },
        writable: true,
      });

      const events = [{
        event_name: 'test_event',
        event_properties: {},
        timestamp: '2026-02-04T12:00:00.000Z',
        session_id: 'session-123',
        device_type: 'desktop',
      }];
      localStorageStore['analytics_event_buffer'] = JSON.stringify(events);
      mockFetch.mockResolvedValueOnce({ ok: true });

      await flushBufferedEvents();

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/track', expect.any(Object));
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('analytics_event_buffer');

      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });
  });

  describe('PWA install tracking (AC-9.5.8)', () => {
    it('hasPWAInstallBeenTracked returns false when not tracked', () => {
      // Store is empty by default
      expect(hasPWAInstallBeenTracked()).toBe(false);
    });

    it('hasPWAInstallBeenTracked returns true when tracked', () => {
      localStorageStore['analytics_pwa_installed'] = 'true';
      expect(hasPWAInstallBeenTracked()).toBe(true);
    });

    it('markPWAInstallTracked sets flag in localStorage', () => {
      markPWAInstallTracked();
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'analytics_pwa_installed',
        'true'
      );
      expect(localStorageStore['analytics_pwa_installed']).toBe('true');
    });

    it('trackPWAInstalled returns early if already tracked', async () => {
      localStorageStore['analytics_pwa_installed'] = 'true';

      const result = await trackPWAInstalled();

      expect(result.success).toBe(true);
      expect(result.error).toBe('Already tracked');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('trackPWAInstalled tracks and marks as tracked', async () => {
      // Store is empty (not tracked yet)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await trackPWAInstalled('iOS');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'analytics_pwa_installed',
        'true'
      );
      expect(localStorageStore['analytics_pwa_installed']).toBe('true');
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event_name).toBe('pwa_installed');
      expect(callBody.event_properties.platform).toBe('iOS');
    });
  });

  describe('detectPWAPlatform', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('returns "iOS" for iPhone user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' },
        writable: true,
      });
      expect(detectPWAPlatform()).toBe('iOS');
    });

    it('returns "Android" for Android user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 10; Mobile)' },
        writable: true,
      });
      expect(detectPWAPlatform()).toBe('Android');
    });

    it('returns "Desktop" for desktop user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        writable: true,
      });
      expect(detectPWAPlatform()).toBe('Desktop');
    });
  });

  describe('trackCSVExported (AC-9.5.1)', () => {
    it('tracks CSV export with transaction count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await trackCSVExported(150);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event_name).toBe('csv_exported');
      expect(callBody.event_properties.transaction_count).toBe(150);
    });
  });

  describe('trackPDFExported (AC-9.5.2)', () => {
    it('tracks PDF export with month and page count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await trackPDFExported('2026-01', 3);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event_name).toBe('pdf_exported');
      expect(callBody.event_properties.month).toBe('2026-01');
      expect(callBody.event_properties.page_count).toBe(3);
    });
  });

  describe('trackOfflineModeActive (AC-9.5.4)', () => {
    it('tracks offline mode with cached data size', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await trackOfflineModeActive(1024000);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event_name).toBe('offline_mode_active');
      expect(callBody.event_properties.cached_data_size).toBe(1024000);
    });
  });
});
