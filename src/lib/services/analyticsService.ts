/**
 * Analytics Service
 * Story 9-4: Add Insight Engagement Analytics
 *
 * Client-side service for tracking user engagement events.
 * Privacy-first: No PII tracked, only event metadata.
 * Non-blocking: Failures don't break user experience.
 */

import type {
  DeviceType,
  TrackEventPayload,
  TrackEventResponse,
} from '@/types/analytics.types';

// Session ID storage key
const SESSION_STORAGE_KEY = 'analytics_session_id';

// API endpoint
const ANALYTICS_ENDPOINT = '/api/analytics/track';

/**
 * Detect device type from user agent
 */
export function detectDeviceType(): DeviceType {
  if (typeof navigator === 'undefined') {
    return 'desktop';
  }

  const ua = navigator.userAgent.toLowerCase();

  // Check for tablets first (they often include 'mobile' in UA)
  if (ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) {
    return 'tablet';
  }

  // Check for mobile devices
  if (
    ua.includes('mobile') ||
    ua.includes('iphone') ||
    ua.includes('ipod') ||
    ua.includes('android')
  ) {
    return 'mobile';
  }

  return 'desktop';
}

/**
 * Get or create session ID from localStorage
 */
export function getSessionId(): string {
  if (typeof localStorage === 'undefined') {
    return crypto.randomUUID();
  }

  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Clear session ID (useful for testing or logout)
 */
export function clearSessionId(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

/**
 * Track an analytics event
 *
 * Non-blocking: Errors are caught and logged, not thrown.
 * Fire-and-forget pattern acceptable for analytics.
 *
 * @param eventName - Event type (e.g., 'insights_page_viewed')
 * @param eventProperties - Optional properties specific to event type
 * @returns Promise resolving to track response (or error response)
 */
export async function trackEvent(
  eventName: string,
  eventProperties?: Record<string, unknown>
): Promise<TrackEventResponse> {
  try {
    const payload: TrackEventPayload = {
      event_name: eventName,
      event_properties: eventProperties || {},
      session_id: getSessionId(),
      device_type: detectDeviceType(),
    };

    const response = await fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Log but don't throw - analytics failures shouldn't break app
      console.warn(`[Analytics] Failed to track event: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return data as TrackEventResponse;
  } catch (error) {
    // Log but don't throw - analytics failures shouldn't break app
    console.warn('[Analytics] Error tracking event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Convenience functions for insight events

/**
 * Track insights page view
 */
export function trackInsightsPageViewed(filter?: string, page?: number): Promise<TrackEventResponse> {
  const properties: Record<string, unknown> = {};
  if (filter && filter !== 'all') {
    properties.filter = filter;
  }
  if (page && page > 1) {
    properties.page = page;
  }
  return trackEvent('insights_page_viewed', properties);
}

/**
 * Track individual insight view
 */
export function trackInsightViewed(
  insightId: string,
  insightType: string
): Promise<TrackEventResponse> {
  return trackEvent('insight_viewed', {
    insight_id: insightId,
    insight_type: insightType,
  });
}

/**
 * Track insight dismissal
 */
export function trackInsightDismissed(
  insightId: string,
  insightType: string
): Promise<TrackEventResponse> {
  return trackEvent('insight_dismissed', {
    insight_id: insightId,
    insight_type: insightType,
  });
}

// Export analytics service as default object for convenience
export const analyticsService = {
  trackEvent,
  trackInsightsPageViewed,
  trackInsightViewed,
  trackInsightDismissed,
  detectDeviceType,
  getSessionId,
  clearSessionId,
};

export default analyticsService;
