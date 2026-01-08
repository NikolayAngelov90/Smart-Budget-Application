# Epic Technical Specification: Technical Foundation & Quality Infrastructure

Date: 2026-01-06
Author: Niki (via Bob - Scrum Master)
Epic ID: 9
Status: Draft

---

## Overview

Epic 9 is a **strategic infrastructure epic** created to address critical technical debt, quality gaps, and process improvements identified in the Epic 6 and Epic 8 retrospectives. This epic consolidates 18 outstanding action items across 10 stories, prioritizing CRITICAL production blockers (Redis migration, test utilities), HIGH priority features (analytics instrumentation, device sessions), and select MEDIUM priority improvements (pagination UI, deployment checklist, TypeScript modernization).

**Why This Epic Matters:**
- Addresses production blocker: in-memory rate limiting incompatible with multi-instance deployments
- Unblocks integration/E2E test adoption through shared test utilities library
- Closes feature gaps from Epics 6 and 8 (pagination UI, device sessions, analytics)
- Establishes retrospective action item tracking process to prevent repeated failures
- Formalizes 20% infrastructure time allocation to prevent future technical debt accumulation

**Retrospective Source:**
- Epic 6 Retrospective: 8 outstanding action items (Redis, analytics, pagination, deployment)
- Epic 8 Retrospective: 10 identified gaps (test utilities, integration tests, TypeScript types, process tracking)

## Objectives and Scope

**In Scope:**

**CRITICAL (Production Blockers & Test Blockers):**
- ✅ Migrate rate limiting from in-memory Map to Redis/Upstash (multi-instance deployment readiness)
- ✅ Create comprehensive test utilities library with Supabase/Auth/SWR mocking patterns
- ✅ Implement retrospective action item tracker workflow and YAML tracking file

**HIGH (Feature Completeness & Strategic Gaps):**
- ✅ Add insight engagement analytics (view, dismiss, category breakdown)
- ✅ Add export and PWA analytics (CSV downloads, PDF generations, PWA installs, offline usage)
- ✅ Complete device session management (AC-8.4.5 from Story 8-4)
- ✅ Formalize 20% infrastructure time rule as process policy

**MEDIUM (Quality & Process Improvements):**
- ✅ Complete Story 6-3 pagination UI (page size selector, jump-to-page)
- ✅ Create deployment checklist with environment validation
- ✅ Modernize tsconfig.json (strict mode, import paths, modern ES target)

**Out of Scope (Deferred to Future Epics):**
- ❌ Full dependency injection system (3-5 story effort, long-term architecture)
- ❌ Comprehensive E2E test suite (requires test utilities library first - Story 9-2)
- ❌ Chart library replacement (recharts → lightweight alternative)
- ❌ Analytics dashboard UI (instrumentation first, then visualization)
- ❌ PWA Phase 2 features (offline editing, background sync)
- ❌ Custom profile picture upload to Supabase Storage
- ❌ SWR localStorage cache size monitoring
- ❌ Error tracking service integration (Sentry, LogRocket)

## System Architecture Alignment

Epic 9 strengthens the existing Next.js + Supabase + Chakra UI architecture with infrastructure improvements:

**New Infrastructure Dependencies:**
- **@upstash/redis** (or **ioredis** + Redis Cloud) - Distributed rate limiting
- **@upstash/ratelimit** - Redis-backed rate limiting client
- **posthog-js** (or **@vercel/analytics**) - Event tracking and analytics

**Test Infrastructure:**
- **@testing-library/react** enhancements - Custom render with all providers
- **msw** (Mock Service Worker) - API mocking for integration tests
- **Shared test utilities** - `testUtils.tsx`, `mockSupabase.ts`, `mockAuth.ts`, `mockSWR.ts`

**Process Artifacts:**
- **docs/sprint-artifacts/retrospective-action-items.yaml** - Centralized action item tracking
- **docs/deployment-checklist.md** - Pre-deployment validation steps
- **tsconfig.json** modernization - Strict type checking, path aliases

**Supabase Schema Additions:**
- **analytics_events** table - Event tracking (insight views, exports, PWA installs)
- **user_sessions** table extension - Device name, last active timestamp (AC-8.4.5)

## Detailed Design

### Services and Modules

| Service/Module | Responsibility | Inputs | Outputs | Owner |
|----------------|----------------|---------|---------|-------|
| **rateLimitService.ts** (refactored) | Redis-backed distributed rate limiting | User IP, endpoint | Allow/deny, retry-after | Story 9-1 |
| **testUtils.tsx** | Shared test rendering with all providers | Component, custom options | Rendered component with mocks | Story 9-2 |
| **analyticsService.ts** | Event tracking and instrumentation | Event name, properties | Analytics event logged | Story 9-4, 9-5 |
| **sessionService.ts** (enhanced) | Device session management with metadata | Session ID, device name | Active sessions with device info | Story 9-6 |
| **retrospectiveTracker.ts** | Action item tracking workflow | Epic number, findings | Updated YAML file | Story 9-3 |

### Data Models and Contracts

**Redis Rate Limit Structure:**
```typescript
// lib/services/rateLimitService.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitConfig {
  identifier: string; // user ID or IP
  limit: number; // max requests
  window: string; // time window (e.g., '60s', '1h')
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // timestamp
}

// Replace in-memory Map with Redis-backed rate limiter
export const rateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '60s'), // 10 requests per 60 seconds
  analytics: true,
});
```

**Analytics Event Schema:**
```typescript
// types/analytics.types.ts
export interface AnalyticsEvent {
  id: string; // UUID
  user_id: string; // FK to auth.users
  event_name: string; // 'insight_viewed', 'csv_exported', 'pwa_installed'
  event_properties: Record<string, any>; // JSONB
  timestamp: string;
  session_id: string | null;
  device_type: 'mobile' | 'tablet' | 'desktop' | null;
}

// Insight engagement events (Story 9-4)
export type InsightEvent =
  | { event_name: 'insight_viewed'; properties: { insight_id: string; insight_type: string } }
  | { event_name: 'insight_dismissed'; properties: { insight_id: string; insight_type: string } }
  | { event_name: 'insights_page_viewed'; properties: { filter?: string } };

// Export and PWA events (Story 9-5)
export type ExportEvent =
  | { event_name: 'csv_exported'; properties: { transaction_count: number } }
  | { event_name: 'pdf_exported'; properties: { month: string; page_count: number } }
  | { event_name: 'pwa_installed'; properties: { platform: string } }
  | { event_name: 'offline_mode_active'; properties: { cached_data_size: number } };
```

**Device Session Extension (AC-8.4.5):**
```typescript
// types/session.types.ts
export interface DeviceSession {
  id: string;
  user_id: string;
  session_token: string;
  device_name: string; // NEW: User-editable device name
  device_type: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  ip_address: string;
  last_active: string; // NEW: Timestamp of last activity
  created_at: string;
}
```

**Retrospective Action Item Tracker:**
```yaml
# docs/sprint-artifacts/retrospective-action-items.yaml
# Generated: 2026-01-06
# Tracking system for retrospective action items across epics

epic-6:
  retrospective_date: 2025-12-10
  action_items:
    - id: epic6-high-1
      priority: HIGH
      description: Migrate rate limiting to Redis for multi-instance support
      status: in-progress # Story 9-1
      epic_assigned: 9
      story_id: 9-1
    - id: epic6-high-2
      priority: HIGH
      description: Add insight engagement analytics
      status: in-progress # Story 9-4
      epic_assigned: 9
      story_id: 9-4
    # ... (all 8 Epic 6 items)

epic-8:
  retrospective_date: 2025-12-15
  action_items:
    - id: epic8-critical-1
      priority: CRITICAL
      description: Create test utilities library
      status: in-progress # Story 9-2
      epic_assigned: 9
      story_id: 9-2
    # ... (all 10 Epic 8 items)
```

**Test Utilities Library Structure:**
```typescript
// src/lib/test-utils/testUtils.tsx
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { SWRConfig } from 'swr';
import { mockSupabaseClient } from './mockSupabase';
import { mockRouter } from './mockRouter';

interface CustomRenderOptions extends RenderOptions {
  supabaseMock?: Partial<typeof mockSupabaseClient>;
  swrConfig?: any;
  routerMock?: any;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  // Wraps component with all 6 provider layers (Chakra, SWR, Auth, Router, etc.)
  // Returns render result + helper methods (mockSupabase, mockAuth, etc.)
}

export * from '@testing-library/react';
export { renderWithProviders as render };
```

### APIs and Interfaces

**Rate Limiting API (Story 9-1):**
- **Migration:** Replace in-memory Map in `src/lib/services/rateLimitService.ts` with Redis client
- **Environment Variables:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **Endpoints Affected:** All API routes using rate limiting (insights, transactions, user profile)

**Analytics API (Story 9-4, 9-5):**
- **POST /api/analytics/track** - Generic event tracking endpoint
  - Body: `{ event_name: string, event_properties: object }`
  - Response: `{ success: boolean, event_id: string }`
- **GET /api/analytics/summary** - Fetch aggregated analytics (future admin dashboard)
- **Client-side tracking:** `analyticsService.trackEvent()` for user interactions

**Device Sessions API (Story 9-6):**
- **PUT /api/user/sessions/:id** - Update device name
  - Body: `{ device_name: string }`
  - Response: `{ updated_session: DeviceSession }`
- **DELETE /api/user/sessions/:id** - Revoke device session (remote logout)

## User Flows

### User Flow 1: Scrum Master Runs Retrospective Action Tracker (Story 9-3)

**Preconditions:**
- Epic retrospective completed (e.g., Epic 9 retrospective)
- Retrospective markdown file exists with "Recommended Actions" section

**Steps:**
1. SM runs `/bmad workflow retrospective epic-9` (existing workflow)
2. Retrospective workflow generates `epic-9-retrospective.md` with findings
3. **NEW:** Workflow automatically extracts action items from "Recommended Actions" section
4. **NEW:** Workflow updates `retrospective-action-items.yaml` with new entries
5. **NEW:** Workflow cross-references previous epic action items to check if addressed
6. **NEW:** Workflow warns if HIGH priority items from 2+ epics ago remain unaddressed
7. SM reviews `retrospective-action-items.yaml` during next epic planning
8. SM assigns outstanding action items to upcoming epic stories

**Postconditions:**
- All retrospective action items tracked in centralized YAML file
- Previous epic findings don't get lost between retrospectives

### User Flow 2: Developer Uses Test Utilities Library (Story 9-2)

**Preconditions:**
- Test utilities library created in `src/lib/test-utils/`
- Developer writing new integration test for Settings page

**Steps:**
1. Developer imports `renderWithProviders` from `@/lib/test-utils`
2. Developer writes test:
   ```typescript
   import { render, screen } from '@/lib/test-utils';
   import SettingsPage from '../page';

   test('updates display name optimistically', async () => {
     render(<SettingsPage />);
     // All 6 provider layers automatically mocked
     // No manual Supabase/Auth/SWR setup required
   });
   ```
3. Test runs without manual provider wrapping or complex mocking
4. Developer can override specific mocks if needed via `renderWithProviders` options

**Postconditions:**
- Integration test adoption increases (lower barrier to entry)
- Test consistency improves across codebase

### User Flow 3: Analytics - Track Insight Engagement (Story 9-4)

**Preconditions:**
- User authenticated and viewing Insights page

**Steps:**
1. User navigates to `/insights` page
2. Frontend calls `analyticsService.trackEvent('insights_page_viewed')`
3. User clicks on specific insight to expand details
4. Frontend calls `analyticsService.trackEvent('insight_viewed', { insight_id, insight_type })`
5. User clicks "Dismiss" on insight
6. Frontend calls `analyticsService.trackEvent('insight_dismissed', { insight_id, insight_type })`
7. Events stored in `analytics_events` table with timestamp, user_id, properties
8. (Future) Admin dashboard shows insight engagement metrics (views, dismissals by type)

**Postconditions:**
- Product team can measure which insights are most valuable
- Engineering can identify low-engagement insights for improvement

### User Flow 4: Analytics - Track Export and PWA Usage (Story 9-5)

**Preconditions:**
- User on Settings or Transactions page

**Steps:**
1. User clicks "Export Transactions (CSV)"
2. CSV export completes with 150 transactions
3. Frontend calls `analyticsService.trackEvent('csv_exported', { transaction_count: 150 })`
4. User selects month and clicks "Export Monthly Report (PDF)"
5. PDF generated with 3 pages
6. Frontend calls `analyticsService.trackEvent('pdf_exported', { month: '2025-12', page_count: 3 })`
7. User installs PWA from browser prompt
8. Service Worker calls `analyticsService.trackEvent('pwa_installed', { platform: 'Android' })`
9. User goes offline, app shows "Offline Mode" indicator
10. Frontend calls `analyticsService.trackEvent('offline_mode_active', { cached_data_size: 5000 })`

**Postconditions:**
- Product team knows export feature adoption rates
- Engineering can prioritize PWA enhancements based on actual offline usage

### User Flow 5: Device Session Management (Story 9-6)

**Preconditions:**
- User logged in on multiple devices (laptop, phone, tablet)
- User on Settings page viewing "Active Devices" section (AC-8.4.5)

**Steps:**
1. User sees list of active sessions with default device names ("Chrome on Windows", "Safari on iPhone")
2. User clicks "Edit" next to laptop session
3. Input field appears with current device name
4. User types "Work Laptop" and clicks "Save"
5. Frontend calls `PUT /api/user/sessions/:id` with `{ device_name: "Work Laptop" }`
6. Device list updates optimistically to show "Work Laptop"
7. User sees "Last active: 2 minutes ago" next to each device
8. User clicks "Revoke Access" next to old session from tablet they no longer own
9. Confirmation modal appears: "This will log out this device. Continue?"
10. User confirms, frontend calls `DELETE /api/user/sessions/:id`
11. Session removed from list, device logged out remotely

**Postconditions:**
- User can identify and manage devices with custom names
- User can see when each device last accessed the app
- User can revoke access to lost/stolen devices

## Story Breakdown

### Story 9-1: Migrate Rate Limiting to Redis/Upstash
**Priority:** CRITICAL (Production Blocker)
**Effort:** 3-5 days
**Acceptance Criteria:**
- AC-9.1.1: Replace in-memory Map rate limiting with Redis-backed implementation
- AC-9.1.2: Support both Upstash Redis (serverless) and self-hosted Redis
- AC-9.1.3: Maintain existing rate limits (10 req/min per user for insights)
- AC-9.1.4: Add Redis connection health check endpoint
- AC-9.1.5: Zero downtime migration (fallback to in-memory if Redis unavailable)
- AC-9.1.6: Update deployment documentation with Redis setup instructions

### Story 9-2: Create Test Utilities Library
**Priority:** CRITICAL (Blocking Integration Tests)
**Effort:** 1-2 days
**Acceptance Criteria:**
- AC-9.2.1: Create `src/lib/test-utils/testUtils.tsx` with `renderWithProviders()`
- AC-9.2.2: Mock all 6 provider layers (Chakra, SWR, Supabase, Auth, Router, Toast)
- AC-9.2.3: Export `mockSupabase`, `mockAuth`, `mockSWR`, `mockRouter` utilities
- AC-9.2.4: Add TypeScript types for all mock helpers
- AC-9.2.5: Write documentation with usage examples
- AC-9.2.6: Refactor 3 existing test files to use new utilities (proof of concept)

### Story 9-3: Implement Retrospective Action Item Tracker
**Priority:** CRITICAL (Process Failure)
**Effort:** 4-8 hours
**Acceptance Criteria:**
- AC-9.3.1: Create `retrospective-action-items.yaml` schema in docs/sprint-artifacts
- AC-9.3.2: Extend retrospective workflow to auto-extract action items from retrospective markdown
- AC-9.3.3: Workflow updates YAML file with new action items (priority, description, status)
- AC-9.3.4: Workflow warns if HIGH priority items unaddressed for 2+ epics
- AC-9.3.5: Backfill Epic 6 and Epic 8 action items into initial YAML file

### Story 9-4: Add Insight Engagement Analytics
**Priority:** HIGH
**Effort:** 3-5 days
**Acceptance Criteria:**
- AC-9.4.1: Create `analytics_events` table in Supabase with RLS
- AC-9.4.2: Create `analyticsService.trackEvent()` function
- AC-9.4.3: Track `insights_page_viewed` event on page load
- AC-9.4.4: Track `insight_viewed` event with insight_id and insight_type
- AC-9.4.5: Track `insight_dismissed` event when user dismisses insight
- AC-9.4.6: Add `POST /api/analytics/track` endpoint
- AC-9.4.7: Add unit tests for analyticsService
- AC-9.4.8: Privacy: Only track event metadata, no PII

### Story 9-5: Add Export and PWA Analytics
**Priority:** HIGH
**Effort:** 1-2 days
**Acceptance Criteria:**
- AC-9.5.1: Track `csv_exported` event with transaction_count
- AC-9.5.2: Track `pdf_exported` event with month and page_count
- AC-9.5.3: Track `pwa_installed` event with platform (iOS/Android/Desktop)
- AC-9.5.4: Track `offline_mode_active` event with cached_data_size
- AC-9.5.5: Add analytics calls to exportService (CSV/PDF)
- AC-9.5.6: Add analytics calls to Service Worker (PWA install, offline mode)
- AC-9.5.7: Unit tests for all export/PWA analytics events

### Story 9-6: Complete Device Session Management (AC-8.4.5)
**Priority:** HIGH
**Effort:** 3-5 days
**Acceptance Criteria:**
- AC-9.6.1: Extend `user_sessions` table with `device_name` and `last_active` columns
- AC-9.6.2: Settings page displays active device sessions with names
- AC-9.6.3: User can edit device name inline (optimistic UI)
- AC-9.6.4: Display "Last active: X minutes/hours ago" for each device
- AC-9.6.5: User can revoke device session (remote logout)
- AC-9.6.6: Confirmation modal required before revoking session
- AC-9.6.7: Unit and integration tests for session management

### Story 9-7: Complete Story 6-3 Pagination UI
**Priority:** MEDIUM
**Effort:** 1-2 days
**Acceptance Criteria:**
- AC-9.7.1: Add "Items per page" dropdown (10, 25, 50, 100)
- AC-9.7.2: Add "Jump to page" input field with validation
- AC-9.7.3: Persist page size preference in localStorage
- AC-9.7.4: Update total page count when page size changes
- AC-9.7.5: Mobile-responsive pagination controls
- AC-9.7.6: Unit tests for pagination interactions

### Story 9-8: Create Deployment Checklist
**Priority:** MEDIUM
**Effort:** 4-8 hours
**Acceptance Criteria:**
- AC-9.8.1: Create `docs/deployment-checklist.md` with pre-deployment validation steps
- AC-9.8.2: Include environment variable validation (Supabase, Redis, Analytics)
- AC-9.8.3: Include database migration verification steps
- AC-9.8.4: Include build and type check validation
- AC-9.8.5: Include test suite execution (unit + integration)
- AC-9.8.6: Include performance benchmarks (Lighthouse CI)
- AC-9.8.7: Create automated pre-deployment script (bash or Node.js)

### Story 9-9: Modernize tsconfig.json
**Priority:** MEDIUM
**Effort:** 4-8 hours
**Acceptance Criteria:**
- AC-9.9.1: Enable `strict: true` for full type safety
- AC-9.9.2: Add path aliases (`@/lib`, `@/components`, `@/types`)
- AC-9.9.3: Update `target` to ES2022 (modern JavaScript features)
- AC-9.9.4: Enable `moduleResolution: "bundler"` (Next.js 13+ recommended)
- AC-9.9.5: Add `skipLibCheck: false` to catch third-party type errors
- AC-9.9.6: Fix all new TypeScript errors introduced by strict mode
- AC-9.9.7: Update all imports to use new path aliases

### Story 9-10: Formalize 20% Infrastructure Time Rule
**Priority:** MEDIUM (Process Change)
**Effort:** 4 hours (documentation + workflow update)
**Acceptance Criteria:**
- AC-9.10.1: Document 20% infrastructure time rule in `docs/process/infrastructure-policy.md`
- AC-9.10.2: Update epic planning workflow to reserve 1 of 5 story slots for infrastructure
- AC-9.10.3: Define criteria for infrastructure work (tech debt, quality, process)
- AC-9.10.4: Create infrastructure story template
- AC-9.10.5: Add infrastructure time tracking to sprint status YAML
- AC-9.10.6: Retrospective workflow checks infrastructure % and warns if <15%

## Technical Dependencies

**New NPM Dependencies:**
```json
{
  "dependencies": {
    "@upstash/redis": "^1.34.0",
    "@upstash/ratelimit": "^1.2.1",
    "posthog-js": "^1.96.1"
  },
  "devDependencies": {
    "msw": "^2.0.0"
  }
}
```

**Environment Variables:**
```bash
# Redis Rate Limiting (Story 9-1)
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Analytics (Story 9-4, 9-5)
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

**Supabase Migrations:**
- `005_user_sessions_extension.sql` - Add device_name, last_active to user_sessions table (Story 9-6)
- `006_analytics_events_table.sql` - Create analytics_events table with RLS (Story 9-4)

## Testing Strategy

**Story-Level Testing:**
- **Story 9-1 (Redis):** Unit tests for rateLimitService, integration tests with Redis mock, load testing
- **Story 9-2 (Test Utils):** Refactor 3 existing tests as proof-of-concept, documentation with examples
- **Story 9-3 (Tracker):** Workflow execution test, YAML validation test
- **Story 9-4 (Insight Analytics):** Unit tests for analyticsService, API route tests, E2E event tracking
- **Story 9-5 (Export Analytics):** Unit tests for export events, Service Worker event tests
- **Story 9-6 (Device Sessions):** Unit tests for session management, integration tests for remote logout
- **Story 9-7 (Pagination UI):** Component tests for pagination controls, localStorage persistence test
- **Story 9-8 (Deployment Checklist):** Manual execution of checklist, script testing
- **Story 9-9 (tsconfig):** Build validation, type check passes, import path resolution tests
- **Story 9-10 (20% Rule):** Process documentation review, workflow update validation

**Epic-Level Integration Testing:**
- Redis rate limiting works in production-like environment (multi-instance)
- Test utilities library reduces test code complexity by 50%+
- Analytics events successfully tracked end-to-end (frontend → API → database)
- Retrospective action item tracker properly extracts and warns on aged items

## Performance and Scalability Considerations

**Redis Rate Limiting (Story 9-1):**
- **Latency:** Redis adds ~5-10ms per rate limit check (acceptable overhead)
- **Scalability:** Supports unlimited API instances, no shared memory constraints
- **Fallback:** If Redis unavailable, fall back to in-memory (single-instance mode)

**Analytics Events (Story 9-4, 9-5):**
- **Write Volume:** Expect 1,000-5,000 events/day per active user
- **Database Impact:** Analytics writes asynchronous, non-blocking for user actions
- **Data Retention:** Implement 90-day retention policy to prevent unbounded growth

**Test Utilities Library (Story 9-2):**
- **Test Execution Speed:** Shared mocks may add 50-100ms per test (acceptable)
- **Maintainability:** Centralized mocking reduces tech debt significantly

## Security and Privacy Considerations

**Analytics Privacy (Story 9-4, 9-5):**
- No PII tracked in event properties (user_id as FK only)
- GDPR compliance: Analytics events deleted when user deletes account (CASCADE)
- Optional: Allow users to opt-out of analytics in Settings (future enhancement)

**Redis Security (Story 9-1):**
- Use Upstash Redis with TLS encryption in transit
- Store Redis credentials in environment variables, never in code
- Implement Redis ACLs to limit command access (read/write only to rate limit keys)

**Device Session Management (Story 9-6):**
- Remote logout requires current session authentication (can't revoke own session)
- Show last 4 characters of IP address only (privacy)
- Audit log for session revocations (security)

## Rollout and Deployment Plan

**Story 9-1 (Redis Migration):**
1. Deploy Redis instance (Upstash or Redis Cloud)
2. Deploy code with feature flag `USE_REDIS_RATE_LIMIT=true` (default: false)
3. Monitor Redis health and rate limit accuracy for 48 hours
4. Enable feature flag in production
5. Remove in-memory fallback code after 1 week stable operation

**Story 9-2 (Test Utilities):**
- No production deployment, developer tooling only
- Announce in team documentation and provide migration guide

**Story 9-3 (Retrospective Tracker):**
- Workflow update deployed to `.bmad/` directory
- Backfill Epic 6 and Epic 8 action items manually
- Test workflow with mock Epic 9 retrospective before Epic 10

**Stories 9-4, 9-5 (Analytics):**
1. Deploy `analytics_events` table migration to production
2. Deploy analytics tracking code with `ANALYTICS_ENABLED=false` (default)
3. Test event tracking in staging environment
4. Enable analytics in production, monitor for 1 week
5. Build admin dashboard for analytics visualization (future epic)

**Story 9-6 (Device Sessions):**
1. Deploy database migration (device_name, last_active columns)
2. Deploy Settings page UI updates
3. Test remote logout functionality in staging
4. Production rollout with monitoring for session stability

**Low-Risk Stories (9-7, 9-8, 9-9, 9-10):**
- Standard deployment, no special rollout required
- Story 9-9 (tsconfig) requires full type check pass before merge

## Success Criteria

**Epic 9 Completion Criteria:**
- ✅ All 10 stories marked "done" in sprint-status.yaml
- ✅ Redis rate limiting deployed to production, in-memory fallback removed
- ✅ Test utilities library used in 5+ test files across codebase
- ✅ Retrospective action item tracker validated with Epic 9 retrospective
- ✅ Analytics tracking 1,000+ events/week in production (insight + export events)
- ✅ Device session management fully functional (edit names, revoke access)
- ✅ Pagination UI completed (Story 6-3 gap closed)
- ✅ Deployment checklist executed successfully for Epic 9 deployment
- ✅ tsconfig.json strict mode enabled, zero TypeScript errors
- ✅ 20% infrastructure time rule documented and integrated into workflow

**Metrics to Track:**
- Redis rate limiting uptime: >99.5% (compared to 100% with in-memory, acceptable tradeoff)
- Test utilities adoption: 50%+ of new tests use `renderWithProviders()`
- Retrospective action item closure rate: >80% of HIGH priority items addressed within 2 epics
- Analytics event volume: 1,000-5,000 events/day (validates instrumentation working)
- TypeScript strict mode violations: 0 (clean migration)

## References

**Retrospective Documents:**
- [Epic 6 Retrospective](epic-6-retrospective.md) - 8 outstanding action items
- [Epic 8 Retrospective](epic-8-retrospective.md) - 10 identified gaps

**Architecture Documents:**
- [Architecture: Rate Limiting](../../architecture.md#rate-limiting)
- [Architecture: Testing Strategy](../../architecture.md#testing-strategy)
- [Architecture: Analytics and Observability](../../architecture.md#analytics)

**PRD References:**
- [PRD: Non-Functional Requirements](../../PRD.md#non-functional-requirements) - Performance, scalability, security
- [PRD: Technical Requirements](../../PRD.md#technical-requirements) - Infrastructure, testing, deployment

**External Documentation:**
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Upstash Rate Limiting Library](https://github.com/upstash/ratelimit)
- [PostHog Analytics Documentation](https://posthog.com/docs)
- [Testing Library Best Practices](https://testing-library.com/docs/react-testing-library/setup)

---

**Status:** Draft - Awaiting Dev Agent Assignment for Story 9-1
**Next Steps:**
1. Review tech spec with team
2. Create 10 story markdown files in `docs/sprint-artifacts/stories/`
3. Update `sprint-status.yaml` with Epic 9 entries
4. Execute Story 9-1 (Redis migration) as highest priority
