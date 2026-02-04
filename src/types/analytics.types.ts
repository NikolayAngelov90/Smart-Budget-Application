/**
 * Analytics Event Types
 * Story 9-4: Add Insight Engagement Analytics
 *
 * Type definitions for analytics tracking system.
 * Privacy-first: No PII in event properties, only IDs and metadata.
 */

// Device types detected from user agent
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

// Base analytics event structure (matches database schema)
export interface AnalyticsEvent {
  id: string;
  user_id: string;
  event_name: string;
  event_properties: Record<string, unknown>;
  timestamp: string;
  session_id: string | null;
  device_type: DeviceType | null;
}

// Insight event types (Story 9-4)
export type InsightEventName =
  | 'insights_page_viewed'
  | 'insight_viewed'
  | 'insight_dismissed';

// Insight event properties by event type
export interface InsightsPageViewedProperties {
  filter?: string;
  page?: number;
}

export interface InsightViewedProperties {
  insight_id: string;
  insight_type: string;
}

export interface InsightDismissedProperties {
  insight_id: string;
  insight_type: string;
}

// Union type for type-safe insight events
export type InsightEvent =
  | { event_name: 'insights_page_viewed'; properties: InsightsPageViewedProperties }
  | { event_name: 'insight_viewed'; properties: InsightViewedProperties }
  | { event_name: 'insight_dismissed'; properties: InsightDismissedProperties };

// Export event types (Story 9-5)
export type ExportEventName =
  | 'csv_exported'
  | 'pdf_exported';

// PWA event types (Story 9-5)
export type PWAEventName =
  | 'pwa_installed'
  | 'offline_mode_active';

// Export event properties
export interface CSVExportedProperties {
  transaction_count: number;
}

export interface PDFExportedProperties {
  month: string;
  page_count: number;
}

// Union type for type-safe export events
export type ExportEvent =
  | { event_name: 'csv_exported'; properties: CSVExportedProperties }
  | { event_name: 'pdf_exported'; properties: PDFExportedProperties };

// PWA event properties
export type PWAPlatform = 'iOS' | 'Android' | 'Desktop';

export interface PWAInstalledProperties {
  platform: PWAPlatform;
}

export interface OfflineModeActiveProperties {
  cached_data_size: number;
}

// Union type for type-safe PWA events
export type PWAEvent =
  | { event_name: 'pwa_installed'; properties: PWAInstalledProperties }
  | { event_name: 'offline_mode_active'; properties: OfflineModeActiveProperties };

// Buffered event for offline storage
export interface BufferedEvent {
  event_name: string;
  event_properties: Record<string, unknown>;
  timestamp: string;
  session_id: string;
  device_type: DeviceType;
}

// API request/response types
export interface TrackEventPayload {
  event_name: string;
  event_properties?: Record<string, unknown>;
  session_id?: string;
  device_type?: DeviceType;
}

export interface TrackEventResponse {
  success: boolean;
  event_id?: string;
  error?: string;
}

// Analytics service configuration
export interface AnalyticsConfig {
  enabled: boolean;
  endpoint: string;
  sessionStorageKey: string;
}

// Default configuration
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  enabled: true,
  endpoint: '/api/analytics/track',
  sessionStorageKey: 'analytics_session_id',
};
