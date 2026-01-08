# Story 9.4: Add Insight Engagement Analytics

Status: drafted

## Story

As a product manager,
I want to track insight engagement metrics (views, dismissals, category breakdown),
So that I can measure which insights are most valuable and improve low-engagement insights.

## Acceptance Criteria

**AC-9.4.1:** Analytics Events Table
✅ Create `analytics_events` table in Supabase with RLS policies (user can only read own events)

**AC-9.4.2:** Analytics Service
✅ Create `analyticsService.trackEvent()` function for client-side event tracking

**AC-9.4.3:** Insights Page View Tracking
✅ Track `insights_page_viewed` event when user navigates to `/insights` page

**AC-9.4.4:** Individual Insight View Tracking
✅ Track `insight_viewed` event with `insight_id` and `insight_type` when user expands/views insight details

**AC-9.4.5:** Insight Dismissal Tracking
✅ Track `insight_dismissed` event with `insight_id` and `insight_type` when user dismisses insight

**AC-9.4.6:** Analytics API Endpoint
✅ Add `POST /api/analytics/track` endpoint for storing events

**AC-9.4.7:** Privacy Compliance
✅ Only track event metadata (no PII like transaction amounts, category names beyond IDs)

**AC-9.4.8:** Unit Tests
✅ Comprehensive unit tests for analyticsService and API endpoint

**AC-9.4.9:** Event Properties Schema
✅ Validate event properties match expected schema for each event type

**AC-9.4.10:** Data Retention
✅ Document 90-day retention policy for analytics events (manual cleanup or automated)

## Tasks / Subtasks

- [ ] Create Supabase migration (AC: 9.4.1)
  - [ ] Create migration file: `supabase/migrations/006_analytics_events_table.sql`
  - [ ] Define `analytics_events` table schema:
    - `id` UUID PRIMARY KEY
    - `user_id` UUID REFERENCES auth.users(id) ON DELETE CASCADE
    - `event_name` TEXT NOT NULL
    - `event_properties` JSONB (insight_id, insight_type, filter, etc.)
    - `timestamp` TIMESTAMPTZ DEFAULT NOW()
    - `session_id` UUID (optional, for session analysis)
    - `device_type` TEXT (mobile, tablet, desktop)
  - [ ] Enable RLS on analytics_events table
  - [ ] Create RLS policies:
    - Users can INSERT own events
    - Users can SELECT own events
    - Admin role can SELECT all events (future)
  - [ ] Create index on `user_id` and `timestamp` for query performance
  - [ ] Run migration in development environment

- [ ] Create TypeScript types (AC: 9.4.9)
  - [ ] Create `src/types/analytics.types.ts`
  - [ ] Define `AnalyticsEvent` interface
  - [ ] Define `InsightEvent` union type:
    ```typescript
    type InsightEvent =
      | { event_name: 'insights_page_viewed'; properties: { filter?: string } }
      | { event_name: 'insight_viewed'; properties: { insight_id: string; insight_type: string } }
      | { event_name: 'insight_dismissed'; properties: { insight_id: string; insight_type: string } };
    ```
  - [ ] Define `TrackEventPayload` and `TrackEventResponse` interfaces

- [ ] Create analyticsService (AC: 9.4.2, 9.4.7)
  - [ ] Create `src/lib/services/analyticsService.ts`
  - [ ] Implement `trackEvent(event_name: string, event_properties?: object)` function
  - [ ] Detect device type (mobile/tablet/desktop) using user agent
  - [ ] Generate session_id from localStorage or create new UUID
  - [ ] Call `POST /api/analytics/track` with event payload
  - [ ] Handle errors gracefully (analytics failures should not break app)
  - [ ] Add privacy safeguards: never include PII in event_properties

- [ ] Create analytics API endpoint (AC: 9.4.6)
  - [ ] Create `src/app/api/analytics/track/route.ts`
  - [ ] Implement POST handler
  - [ ] Validate authenticated user (Supabase Auth middleware)
  - [ ] Validate event_name and event_properties schema
  - [ ] Insert event into `analytics_events` table
  - [ ] Return success response: `{ success: true, event_id: string }`
  - [ ] Handle errors: authentication failure, validation errors, database errors

- [ ] Add tracking to Insights page (AC: 9.4.3)
  - [ ] Update `src/app/(dashboard)/insights/page.tsx`
  - [ ] Track `insights_page_viewed` on page mount (useEffect)
  - [ ] Include filter parameter if active (e.g., `filter: 'spending'`)
  - [ ] Debounce page view events (don't track on every re-render)

- [ ] Add tracking to individual insights (AC: 9.4.4, 9.4.5)
  - [ ] Update insights rendering logic (likely in InsightCard component)
  - [ ] Track `insight_viewed` when user expands insight or clicks for details
  - [ ] Track `insight_dismissed` when user clicks dismiss button
  - [ ] Include `insight_id` (UUID from database) and `insight_type` (e.g., 'high_spending_category')

- [ ] Write unit tests (AC: 9.4.8)
  - [ ] Test analyticsService.trackEvent() with valid event
  - [ ] Test device type detection (mobile, tablet, desktop)
  - [ ] Test session_id generation and persistence
  - [ ] Test error handling (network failure, API error)
  - [ ] Test API endpoint POST handler
  - [ ] Test authentication requirement (401 if not authenticated)
  - [ ] Test event validation (reject invalid event_name or properties)
  - [ ] Test database insertion and RLS enforcement

- [ ] Write integration tests (AC: 9.4.3, 9.4.4, 9.4.5)
  - [ ] Test end-to-end insights page view tracking (page load → API call → database)
  - [ ] Test insight viewed event (expand insight → API call → database)
  - [ ] Test insight dismissed event (dismiss button → API call → database)
  - [ ] Test event properties match schema
  - [ ] Test RLS policies (user can only read own events)

- [ ] Add data retention documentation (AC: 9.4.10)
  - [ ] Document 90-day retention policy in `docs/analytics/data-retention.md`
  - [ ] Create manual cleanup SQL script: `DELETE FROM analytics_events WHERE timestamp < NOW() - INTERVAL '90 days'`
  - [ ] (Optional) Create scheduled job for automated cleanup (Supabase Edge Function or cron)

## Dev Notes

- **Privacy-First:** No PII tracked. Event properties contain IDs only (insight_id, insight_type), not sensitive financial data (amounts, descriptions).
- **GDPR Compliance:** Analytics events cascade delete when user deletes account (ON DELETE CASCADE in schema).
- **Non-Blocking:** Analytics tracking failures should not break user experience. All analytics calls wrapped in try-catch.
- **Session Tracking:** Generate UUID session_id in localStorage to group events by user session (useful for funnel analysis).
- **Device Detection:** Use `navigator.userAgent` to detect mobile/tablet/desktop. Simple heuristic acceptable for MVP.

### Project Structure Notes

**New Files:**
- `supabase/migrations/006_analytics_events_table.sql` - Analytics events table with RLS
- `src/lib/services/analyticsService.ts` - Event tracking service
- `src/types/analytics.types.ts` - TypeScript interfaces for events
- `src/app/api/analytics/track/route.ts` - Analytics API endpoint
- `docs/analytics/data-retention.md` - Data retention policy documentation

**Modified Files:**
- `src/app/(dashboard)/insights/page.tsx` - Add insights_page_viewed tracking
- `src/components/insights/InsightCard.tsx` (or similar) - Add insight_viewed and insight_dismissed tracking
- `src/types/database.types.ts` - Add analytics_events table type

**Example Usage:**
```typescript
// In Insights page
import { analyticsService } from '@/lib/services/analyticsService';

useEffect(() => {
  analyticsService.trackEvent('insights_page_viewed', { filter: activeFilter });
}, []);

// In InsightCard component
const handleDismiss = (insightId: string, insightType: string) => {
  analyticsService.trackEvent('insight_dismissed', { insight_id: insightId, insight_type: insightType });
  // ... dismiss logic
};
```

**Alignment with Architecture:**
- Supabase database for analytics storage (consistent with existing data layer)
- RLS policies for data access control (security best practice)
- Next.js API routes for event ingestion
- TypeScript types for event schema validation

### References

- [Tech Spec: Epic 9 - Story 9-4 Acceptance Criteria](../tech-spec-epic-9.md#story-9-4-add-insight-engagement-analytics)
- [Epic 6 Retrospective: Add Insight Engagement Analytics - HIGH Priority](../epic-6-retrospective.md#recommended-actions-for-future-epics)
- [Architecture: Analytics and Observability](../../architecture.md#analytics)
- [GDPR Compliance: Data Retention](https://gdpr.eu/data-retention/)

## Dev Agent Record

### Context Reference

- [Story 9-4 Context](9-4-add-insight-engagement-analytics.context.xml) - To be created during dev workflow

### Agent Model Used

TBD (Claude Sonnet 4.5)

### Debug Log References

TBD

### Completion Notes List

TBD - To be filled during implementation

### File List

TBD - To be filled during implementation
