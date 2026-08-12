# Story 11.2: Subscription Detection (Subscription Graveyard)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a budget-conscious user,
I want the system to detect my recurring charges and flag potentially unused subscriptions,
so that I can identify and cancel subscriptions I'm paying for but not using.

## Acceptance Criteria

1. **Given** a user has 3+ months of transaction history, **When** the system analyzes transactions for recurring patterns, **Then** subscriptions are detected and listed with name (merchant), amount, frequency (weekly/monthly/annual), and last charge date.

2. **Given** detected subscriptions exist, **When** the system identifies subscriptions with gaps in expected charges (missed expected payment window), **Then** those subscriptions are flagged as "potentially unused" with status `unused`.

3. **Given** detected subscriptions are displayed to the user, **When** the user views the Subscription Graveyard list, **Then** they can see all detected subscriptions grouped by status (active, unused) with amount, frequency, and last seen date.

4. **Given** a user is viewing a detected subscription, **When** they choose to dismiss it or mark it as "keep", **Then** the action is recorded, the subscription status updates accordingly, and the UI reflects the change immediately.

5. **Given** the subscription detection cron job runs, **When** it processes all eligible users (3+ months of data), **Then** it completes within Vercel's 10-second function timeout by processing users in batches, and logs metrics (users processed, subscriptions detected, errors).

6. **Given** the Subscription Graveyard feature, **When** a user has fewer than 3 months of transaction data, **Then** the feature is hidden via progressive disclosure and the user sees no empty state for subscriptions.

## Tasks / Subtasks

- [x] Task 1: Database migration for `detected_subscriptions` table (AC: #1, #2, #3, #4)
  - [x] 1.1 Create migration `012_detected_subscriptions.sql` with schema per ADR-014
  - [x] 1.2 Create `subscription_status` enum: `active`, `unused`, `dismissed`, `kept`
  - [x] 1.3 Create `subscription_frequency` enum: `weekly`, `monthly`, `quarterly`, `annual`
  - [x] 1.4 Add RLS policies: users can only CRUD their own records (`auth.uid() = user_id`)
  - [x] 1.5 Add indexes: `idx_detected_subscriptions_user_id`, `idx_detected_subscriptions_status`

- [x] Task 2: Subscription detection algorithm service (AC: #1, #2)
  - [x] 2.1 Create `src/lib/services/subscriptionService.ts` with detection logic
  - [x] 2.2 Implement `detectSubscriptions(userId)`: query 3+ months of transactions, group by merchant (notes field pattern matching + amount similarity), identify recurring patterns (same merchant, similar amount ±10%, regular frequency)
  - [x] 2.3 Implement frequency detection: analyze intervals between matching transactions to classify as weekly (~7d), monthly (~30d), quarterly (~90d), annual (~365d)
  - [x] 2.4 Implement `flagUnusedSubscriptions(userId)`: compare last_seen_at against expected next charge date, flag as `unused` if payment is overdue by >1.5x the frequency interval
  - [x] 2.5 Implement `getSubscriptionsForUser(userId)`: fetch all detected subscriptions sorted by status then amount
  - [x] 2.6 Implement `updateSubscriptionStatus(userId, subscriptionId, status)`: update to `dismissed` or `kept`

- [x] Task 3: Cron job for subscription detection (AC: #5)
  - [x] 3.1 Create `/api/cron/subscription-detect/route.ts` following existing cron pattern from `generate-insights`
  - [x] 3.2 Validate `CRON_SECRET` via Authorization Bearer header with timing-safe comparison
  - [x] 3.3 Query eligible users (those with 3+ months of transaction data) in batches of 20
  - [x] 3.4 Call `detectSubscriptions()` and `flagUnusedSubscriptions()` per user
  - [x] 3.5 Return metrics: `{ usersProcessed, subscriptionsDetected, subscriptionsFlagged, errors, elapsedMs }`
  - [x] 3.6 Add cron schedule to `vercel.json`: weekly run (e.g., Sunday 02:00 UTC)

- [x] Task 4: API routes for subscription management (AC: #3, #4)
  - [x] 4.1 Create `GET /api/subscriptions/route.ts` — list user's detected subscriptions (auth required)
  - [x] 4.2 Create `PATCH /api/subscriptions/[id]/route.ts` — update subscription status (dismiss/keep)
  - [x] 4.3 Use service layer pattern: routes call `subscriptionService`, not Supabase directly
  - [x] 4.4 Validate request body with Zod schema
  - [x] 4.5 Return standard response format: `{ data }` / `{ error: { message } }`

- [x] Task 5: TypeScript types and Zod schemas (AC: all)
  - [x] 5.1 Add `DetectedSubscription` type to `src/types/database.types.ts`
  - [x] 5.2 Add `SubscriptionStatus` and `SubscriptionFrequency` enums to types
  - [x] 5.3 Create Zod schemas for API validation: `updateSubscriptionSchema`

- [x] Task 6: Subscription Graveyard UI (AC: #3, #4, #6)
  - [x] 6.1 Create `src/components/subscriptions/SubscriptionGraveyard.tsx` — main list view using Chakra Accordion
  - [x] 6.2 Create `src/components/subscriptions/SubscriptionItem.tsx` — individual subscription card with merchant name, amount, frequency, status badge, and action buttons (dismiss/keep)
  - [x] 6.3 Create SWR hook `src/lib/hooks/useSubscriptions.ts` — fetches from `GET /api/subscriptions`
  - [x] 6.4 Integrate into AI Insights section (progressive disclosure: only show when user has 3+ months of data, check via `user_feature_state.transactions_count` or date-based query)
  - [x] 6.5 Empty state: "No recurring charges detected yet" (no CTA, per UX spec)
  - [x] 6.6 Add i18n keys for all subscription strings in `messages/en.json` and `messages/bg.json`
  - [x] 6.7 Responsive: Accordion layout works on mobile (single column), tablet, desktop
  - [x] 6.8 Accessibility: keyboard navigation through Accordion items, `aria-label` per item, status conveyed via text not color alone

- [x] Task 7: Tests (AC: all)
  - [x] 7.1 Unit tests for subscription detection algorithm (pattern matching, frequency detection, edge cases: single transaction, varying amounts, irregular intervals)
  - [x] 7.2 Unit tests for `flagUnusedSubscriptions` logic (gap detection, threshold calculation)
  - [x] 7.3 Integration test for cron endpoint (mock auth, verify batch processing, verify metrics response)
  - [x] 7.4 Integration tests for API routes (GET list, PATCH status update, auth required, 404 for wrong user)
  - [x] 7.5 Unit tests for SubscriptionGraveyard component (renders list, empty state, dismiss/keep actions)
  - [x] 7.6 Unit tests for SubscriptionItem component (status badge rendering, action button clicks)
  - [x] 7.7 Test progressive disclosure gating (hidden when <3 months data)

## Dev Notes

### Current State (What Exists)

**Transaction data model** (`src/types/database.types.ts`):
- `Transaction`: `{ id, user_id, category_id, amount (DECIMAL 12,2), type (income|expense), date (DATE), notes (TEXT), currency (VARCHAR 3), exchange_rate, created_at, updated_at }`
- Indexed on: `user_id`, `date DESC`, `category_id`, `type`, `currency`
- Notes field contains merchant names — this is the primary field for subscription pattern matching

**Existing spending analysis** (`src/lib/ai/spendingAnalysis.ts`):
- `calculateMean()`, `calculateStdDev()`, `isOutlier()` — reusable for amount similarity checks
- `compareMonthlySpending()` — may inform subscription cost trend analysis

**Existing cron pattern** (`src/app/api/cron/generate-insights/route.ts`):
- GET endpoint, `CRON_SECRET` via Authorization Bearer header with timing-safe comparison
- Batch processing (batch size 20), `Promise.all` for parallel per-user processing
- Returns metrics JSON, handles errors gracefully (collects, doesn't fail entire job)
- Respects Vercel 10-second function timeout
- **Follow this pattern exactly for the subscription-detect cron job**

**Insight service pattern** (`src/lib/services/insightService.ts`):
- Service owns domain, called by API routes and cron
- Queries transactions with date range filtering
- In-memory cache with TTL — consider similar caching for subscription detection results

**Existing API route structure**:
- Routes under `src/app/api/` with kebab-case naming
- Auth pattern: `createServerSupabaseClient()` → `supabase.auth.getUser()` → 401 if no user
- Response format: `{ data }` success, `{ error: { message } }` error

**Supabase migrations** (11 files, prefix 001-011):
- Latest: `011_add_user_feature_state.sql` (Story 11.1)
- Next migration should be numbered `012_*`
- Convention: header comments with story reference and date, `IF NOT EXISTS`, `COMMENT ON` statements

**Progressive disclosure** (`user_feature_state` table from Story 11.1):
- Tracks `transactions_count`, `days_active`, `features_unlocked`
- Subscription Graveyard should check if user has 3+ months of data before showing

### What Changes

1. **New table: `detected_subscriptions`** — Per ADR-014, stores detected recurring charge patterns with merchant, amount, frequency, status, last_seen_at
2. **New service: `subscriptionService.ts`** — Detection algorithm + CRUD operations for subscriptions
3. **New cron job: `/api/cron/subscription-detect`** — Weekly scan following existing cron pattern
4. **New API routes: `/api/subscriptions`** — GET (list) and PATCH (update status)
5. **New UI components: `SubscriptionGraveyard` + `SubscriptionItem`** — Accordion-based list in AI Insights section
6. **New SWR hook: `useSubscriptions`** — Client-side data fetching
7. **New types** — `DetectedSubscription`, `SubscriptionStatus`, `SubscriptionFrequency`

### Architecture Compliance

- **ADR-014 (Subscription Detection Storage):** `detected_subscriptions` table with `user_id`, `merchant_pattern`, `estimated_amount`, `frequency`, `last_seen_at`, `status`. Use `DECIMAL(12,2)` for amounts — NEVER float.
- **ADR-019 (Vercel Cron):** Cron route at `/api/cron/subscription-detect`, secured with `CRON_SECRET` header. Add to `vercel.json` cron config. Weekly schedule.
- **Service Layer Pattern:** `subscriptionService.ts` owns all subscription logic. API routes call service, never Supabase directly. Components use SWR hooks, not services.
- **RLS:** `auth.uid() = user_id` on all `detected_subscriptions` policies. User data is never shared.
- **Brownfield:** No breaking changes to existing tables. Additive schema only.
- **Date/Time:** `TIMESTAMP WITH TIME ZONE` in UTC for `last_seen_at`. `DATE` for transaction date comparisons.

### Library & Framework Requirements

- **Chakra UI v2.8+** — Use `Accordion`, `AccordionItem`, `AccordionButton`, `AccordionPanel`, `Badge`, `Card` components. Trust Blue theme: `#2b6cb0` primary, `#2c5282` hover.
- **SWR** — `useSWR` for subscription list fetching. Follow existing hook patterns from `useUserPreferences.ts`.
- **Zod** — Server-side validation of PATCH request body (status update).
- **date-fns** — For frequency interval calculations (`differenceInDays`, `addDays`, `subMonths`). Already in project, tree-shakeable.
- **next-intl** — All new strings need translation keys in `en.json` and `bg.json`.
- **Supabase client** — `@/lib/supabase/server` for API routes and cron, `@/lib/supabase/client` for client-side (via SWR hooks).
- **No new dependencies required** — everything needed is already in the project.

### File Structure Requirements

```
src/
├── lib/
│   ├── services/
│   │   └── subscriptionService.ts          # NEW — detection algorithm + CRUD
│   └── hooks/
│       └── useSubscriptions.ts             # NEW — SWR hook for subscriptions
├── components/
│   └── subscriptions/
│       ├── SubscriptionGraveyard.tsx        # NEW — main accordion list
│       ├── SubscriptionItem.tsx             # NEW — individual subscription row
│       └── __tests__/
│           ├── SubscriptionGraveyard.test.tsx  # NEW
│           └── SubscriptionItem.test.tsx       # NEW
├── app/
│   └── api/
│       ├── cron/
│       │   └── subscription-detect/
│       │       └── route.ts                # NEW — weekly cron job
│       └── subscriptions/
│           ├── route.ts                    # NEW — GET list
│           └── [id]/
│               └── route.ts               # NEW — PATCH status
├── types/
│   └── database.types.ts                   # MODIFY — add DetectedSubscription type
messages/
├── en.json                                 # MODIFY — add subscription i18n keys
└── bg.json                                 # MODIFY — add Bulgarian translations

supabase/migrations/
└── 012_detected_subscriptions.sql          # NEW — table + RLS + indexes
vercel.json                                 # MODIFY — add cron schedule
```

### Subscription Detection Algorithm Design

**Pattern matching strategy:**
1. Query all expense transactions for user in the last 3-6 months
2. Group transactions by normalized merchant name from `notes` field (lowercase, trim, strip common suffixes like "Inc", "LLC", numbers)
3. For each merchant group with 2+ transactions:
   a. Calculate intervals between consecutive charges (`differenceInDays`)
   b. Check if amounts are within ±10% tolerance (accounts for tax/price changes)
   c. Classify frequency based on median interval:
      - Weekly: 5-9 days
      - Monthly: 25-35 days
      - Quarterly: 80-100 days
      - Annual: 340-395 days
   d. If pattern is consistent (>60% of intervals match expected frequency), mark as detected subscription
4. For "unused" flagging: if `last_seen_at` + (frequency_interval × 1.5) < today, mark as `unused`

**Edge cases to handle:**
- Same merchant, different amounts (e.g., variable usage charges) — use median amount, wider tolerance
- Merchant name variations (e.g., "Netflix" vs "NETFLIX.COM") — normalize before grouping
- One-time purchases from subscription merchants — require 3+ matching transactions for detection
- Free trial → paid transition — amount change should not break detection if merchant matches
- Annual subscriptions — need 12+ months of data for confident detection, or 1 occurrence with exact 365-day pattern

### Testing Requirements

- **Unit tests:** Jest + React Testing Library (existing pattern)
- **Test pattern:** Use chainable mock pattern from `src/lib/test-utils/` for Supabase mocks
- **Integration tests:** `@jest-environment node` for API route and cron tests
- **Algorithm tests:** Test with synthetic transaction data covering all frequency types, edge cases (varying amounts, irregular intervals, merchant name variations)
- **Minimum test coverage:**
  - Detection algorithm: pattern matching, frequency classification, amount tolerance
  - Unused flagging: gap detection, threshold math
  - Cron endpoint: auth validation, batch processing, metrics response
  - API routes: list, update, auth enforcement, not-found handling
  - UI components: render states (loading, empty, populated), user actions (dismiss, keep)

### Previous Story Intelligence (from 11-1)

**Patterns to follow from Story 11.1:**
- OnboardingModal redesign established the pattern of modifying existing components vs creating new routes
- `user_feature_state` table created in migration `011` — use this for progressive disclosure checks
- i18n keys added under namespaced sections in `messages/en.json` and `messages/bg.json`
- Code review caught: non-null assertions (eliminate), hardcoded Zod enums (use const arrays), weak test assertions (use specific matchers)
- 23 new tests added (851 total) — maintain test count growth

**Files created/modified in 11.1 that are relevant:**
- `supabase/migrations/011_add_user_feature_state.sql` — progressive disclosure table (reference for migration conventions)
- `messages/en.json`, `messages/bg.json` — add subscription keys following same nesting pattern
- `src/app/page.tsx` — progressive disclosure init (reference for how feature gating works)

### Git Intelligence

**Recent commit patterns:**
- `cb6259e` fix: Remove NODE_ENV guard from BENCHMARK_MODE middleware bypass
- `27d620d` fix: Harden CI pipeline from run #77 log review
- `dccf8b2` feat: Implement Story 11.1 — Streamlined Onboarding Flow
- Commit messages follow conventional commits: `feat:`, `fix:`, prefixed
- Story implementation is a single `feat:` commit

### Project Structure Notes

- Subscription components go in `src/components/subscriptions/` (new directory, consistent with `src/components/dashboard/`, `src/components/transactions/`)
- API routes follow existing nested structure under `src/app/api/`
- Service file follows existing pattern: one service per domain in `src/lib/services/`
- SWR hook follows existing pattern in `src/lib/hooks/`
- Tests mirror source structure with `__tests__/` directories

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 11, Story 11.2]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-014 Subscription Detection Storage]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-019 Vercel Cron Background Jobs]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-024 Database Indexing Strategy]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Subscription Graveyard UI, Accordion, NudgeCard]
- [Source: _bmad-output/planning-artifacts/prd.md — FR5 Subscription Detection]
- [Source: src/app/api/cron/generate-insights/route.ts — Existing cron job pattern]
- [Source: src/lib/services/insightService.ts — Service layer pattern reference]
- [Source: src/lib/ai/spendingAnalysis.ts — Reusable spending analysis utilities]
- [Source: src/types/database.types.ts — Transaction type definition]
- [Source: supabase/migrations/011_add_user_feature_state.sql — Latest migration convention]
- [Source: _bmad-output/implementation-artifacts/11-1-streamlined-onboarding-flow.md — Previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 7 tasks implemented across database, service, API, UI, and test layers
- 920 tests passing across 70 suites (was 808 tests / 58 suites before this story)
- Fixed translation test regression: `subscriptions.perInterval` needed Bulgarian translation
- Supabase chainable mock patterns required custom helpers (`createChainMock`, `createDoubleOrderChainMock`) for double `.eq()` and `.order()` chains
- **Code review fixes (6 issues):**
  - H1: Added `currency` column to schema, types, service, and UI (was hardcoded EUR)
  - M1: User-facing service functions now accept Supabase client parameter (enforces RLS)
  - M2: Removed unused `perInterval` i18n key from en.json and bg.json
  - M3: Normalized cron response shape (added `totalUsers`/`errorCount` to empty-users path)
  - M4: `hasEnoughHistory` now throws on DB error instead of silently returning false
  - M5: ADR-014 status enum deviation noted (impl uses dismissed/kept vs ADR's cancelled)

### Change Log
- 2026-03-26: Story created by SM agent — comprehensive context for subscription detection
- 2026-03-26: All 7 tasks implemented by dev agent (Claude Opus 4.6)
- 2026-03-26: Adversarial code review — 1 HIGH, 5 MEDIUM fixed, 3 LOW noted (Claude Opus 4.6)

### File List

**New files:**
- `supabase/migrations/012_detected_subscriptions.sql` — Database migration (table, enums, RLS, indexes)
- `src/lib/services/subscriptionService.ts` — Detection algorithm + CRUD operations
- `src/app/api/cron/subscription-detect/route.ts` — Weekly cron job endpoint
- `src/app/api/subscriptions/route.ts` — GET list endpoint
- `src/app/api/subscriptions/[id]/route.ts` — PATCH status update endpoint
- `src/lib/hooks/useSubscriptions.ts` — SWR hook for subscriptions
- `src/components/subscriptions/SubscriptionGraveyard.tsx` — Main accordion list component
- `src/components/subscriptions/SubscriptionItem.tsx` — Individual subscription row component
- `src/lib/services/__tests__/subscriptionService.test.ts` — Algorithm + service tests (33 tests)
- `src/app/api/cron/subscription-detect/__tests__/subscription-detect.test.ts` — Cron integration tests
- `src/app/api/subscriptions/__tests__/subscriptions.test.ts` — GET route tests
- `src/app/api/subscriptions/[id]/__tests__/subscription-update.test.ts` — PATCH route tests
- `src/components/subscriptions/__tests__/SubscriptionGraveyard.test.tsx` — Component tests
- `src/components/subscriptions/__tests__/SubscriptionItem.test.tsx` — Component tests

**Modified files:**
- `src/types/database.types.ts` — Added DetectedSubscription types and enums
- `src/components/insights/InsightsPageContent.tsx` — Integrated SubscriptionGraveyard
- `messages/en.json` — Added subscription i18n keys
- `messages/bg.json` — Added Bulgarian subscription translations
- `vercel.json` — Added cron schedule for subscription-detect
