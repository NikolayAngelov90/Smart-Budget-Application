/**
 * Analytics Service
 * Story 9-4: Add Insight Engagement Analytics
 * Story 9-5: Add Export and PWA Analytics
 *
 * Client-side service for tracking user engagement events.
 * Privacy-first: No PII tracked, only event metadata.
 * Non-blocking: Failures don't break user experience.
 * Offline-capable: Events buffered when offline (AC-9.5.9).
 */

import type {
  DeviceType,
  TrackEventPayload,
  TrackEventResponse,
  BufferedEvent,
  PWAPlatform,
} from '@/types/analytics.types';

// Session ID storage key
const SESSION_STORAGE_KEY = 'analytics_session_id';

// Event buffer storage key (AC-9.5.9)
const EVENT_BUFFER_KEY = 'analytics_event_buffer';

// PWA install tracking key (AC-9.5.8)
const PWA_INSTALLED_KEY = 'analytics_pwa_installed';

// API endpoint
const ANALYTICS_ENDPOINT = '/api/analytics/track';

// Max retry attempts before dropping a buffered event
const MAX_RETRY_COUNT = 3;

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
 * Check if browser is online
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true; // Assume online in non-browser environments
  }
  return navigator.onLine;
}

/**
 * Get buffered events from localStorage (AC-9.5.9)
 */
export function getBufferedEvents(): BufferedEvent[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const buffer = localStorage.getItem(EVENT_BUFFER_KEY);
    return buffer ? JSON.parse(buffer) : [];
  } catch {
    return [];
  }
}

/**
 * Save event to buffer for later sending (AC-9.5.9)
 */
export function bufferEvent(event: BufferedEvent): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    const events = getBufferedEvents();
    events.push(event);
    localStorage.setItem(EVENT_BUFFER_KEY, JSON.stringify(events));
  } catch (error) {
    console.warn('[Analytics] Failed to buffer event:', error);
  }
}

/**
 * Clear buffered events after successful flush (AC-9.5.9)
 */
export function clearBufferedEvents(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(EVENT_BUFFER_KEY);
  }
}

/**
 * Flush buffered events when back online (AC-9.5.9)
 * Sends all buffered events and clears the buffer on success.
 */
export async function flushBufferedEvents(): Promise<void> {
  if (!isOnline()) {
    return;
  }

  const events = getBufferedEvents();
  if (events.length === 0) {
    return;
  }

  const failedEvents: BufferedEvent[] = [];

  for (const event of events) {
    const retryCount = event.retry_count ?? 0;

    // Drop events that have exceeded max retries
    if (retryCount >= MAX_RETRY_COUNT) {
      console.warn(`[Analytics] Dropping event '${event.event_name}' after ${retryCount} failed retries`);
      continue;
    }

    try {
      const response = await fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_name: event.event_name,
          event_properties: event.event_properties,
          session_id: event.session_id,
          device_type: event.device_type,
        }),
      });

      if (!response.ok) {
        failedEvents.push({ ...event, retry_count: retryCount + 1 });
      }
    } catch {
      failedEvents.push({ ...event, retry_count: retryCount + 1 });
    }
  }

  // Keep failed events in buffer, clear successful ones
  if (failedEvents.length > 0) {
    localStorage.setItem(EVENT_BUFFER_KEY, JSON.stringify(failedEvents));
  } else {
    clearBufferedEvents();
  }
}

/**
 * Check if PWA install has been tracked (AC-9.5.8)
 */
export function hasPWAInstallBeenTracked(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(PWA_INSTALLED_KEY) === 'true';
}

/**
 * Mark PWA install as tracked (AC-9.5.8)
 */
export function markPWAInstallTracked(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PWA_INSTALLED_KEY, 'true');
  }
}

/**
 * Track an analytics event
 *
 * Non-blocking: Errors are caught and logged, not thrown.
 * Fire-and-forget pattern acceptable for analytics.
 * Offline-capable: Buffers events when offline (AC-9.5.9).
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
    const sessionId = getSessionId();
    const deviceType = detectDeviceType();
    const payload: TrackEventPayload = {
      event_name: eventName,
      event_properties: eventProperties || {},
      session_id: sessionId,
      device_type: deviceType,
    };

    // AC-9.5.9: Buffer event if offline
    if (!isOnline()) {
      const bufferedEvent: BufferedEvent = {
        event_name: eventName,
        event_properties: eventProperties || {},
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        device_type: deviceType,
      };
      bufferEvent(bufferedEvent);
      return { success: true, error: 'Event buffered for offline' };
    }

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

// Convenience functions for export events (Story 9-5)

/**
 * Track CSV export (AC-9.5.1)
 */
export function trackCSVExported(
  transactionCount: number
): Promise<TrackEventResponse> {
  return trackEvent('csv_exported', {
    transaction_count: transactionCount,
  });
}

/**
 * Track PDF export (AC-9.5.2)
 */
export function trackPDFExported(
  month: string,
  pageCount: number
): Promise<TrackEventResponse> {
  return trackEvent('pdf_exported', {
    month,
    page_count: pageCount,
  });
}

// Convenience functions for PWA events (Story 9-5)

/**
 * Detect PWA platform from user agent
 */
export function detectPWAPlatform(): PWAPlatform {
  if (typeof navigator === 'undefined') {
    return 'Desktop';
  }

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    return 'iOS';
  }

  if (ua.includes('android')) {
    return 'Android';
  }

  return 'Desktop';
}

/**
 * Track PWA installation (AC-9.5.3, AC-9.5.8)
 * Only tracks once per device to prevent duplicates.
 */
export function trackPWAInstalled(
  platform?: PWAPlatform
): Promise<TrackEventResponse> {
  // AC-9.5.8: Prevent duplicate PWA install events
  if (hasPWAInstallBeenTracked()) {
    return Promise.resolve({ success: true, error: 'Already tracked' });
  }

  markPWAInstallTracked();
  return trackEvent('pwa_installed', {
    platform: platform || detectPWAPlatform(),
  });
}

/**
 * Track offline mode activation (AC-9.5.4)
 */
export function trackOfflineModeActive(
  cachedDataSize: number
): Promise<TrackEventResponse> {
  return trackEvent('offline_mode_active', {
    cached_data_size: cachedDataSize,
  });
}

// Export analytics service as default object for convenience
export const analyticsService = {
  // Core functions
  trackEvent,
  detectDeviceType,
  getSessionId,
  clearSessionId,
  // Insight tracking (Story 9-4)
  trackInsightsPageViewed,
  trackInsightViewed,
  trackInsightDismissed,
  // Export tracking (Story 9-5)
  trackCSVExported,
  trackPDFExported,
  // PWA tracking (Story 9-5)
  detectPWAPlatform,
  trackPWAInstalled,
  trackOfflineModeActive,
  hasPWAInstallBeenTracked,
  markPWAInstallTracked,
  // Offline buffering (Story 9-5)
  isOnline,
  getBufferedEvents,
  bufferEvent,
  clearBufferedEvents,
  flushBufferedEvents,
};

export default analyticsService;
