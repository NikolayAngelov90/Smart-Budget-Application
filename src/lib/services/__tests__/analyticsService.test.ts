/**
 * Analytics Service Unit Tests
 * Story 9-4: Add Insight Engagement Analytics (AC-9.4.8)
 */

import {
  detectDeviceType,
  getSessionId,
  clearSessionId,
  trackEvent,
  trackInsightsPageViewed,
  trackInsightViewed,
  trackInsightDismissed,
} from '../analyticsService';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto.randomUUID
const mockRandomUUID = jest.fn(() => 'mock-uuid-1234');
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: mockRandomUUID },
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('analyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
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
});
