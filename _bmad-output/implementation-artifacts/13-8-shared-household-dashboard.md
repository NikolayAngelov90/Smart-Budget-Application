---
baseline_commit: f0e1277b83726412c429812ed4abd1baaae21e8b
---

# Story 13.8: Shared Household Dashboard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a household member,
I want to view a shared dashboard showing combined spending, contribution progress, and shared goal status,
so that everyone has visibility into the household's financial health.

## Acceptance Criteria

1. **Given** a household has active shared categories and members, **When** a member opens the household dashboard, **Then** it shows **combined spending by shared category** (the household pot, not personal spend).
2. **And** it shows **each member's contribution progress** (fair share vs contributed, from Story 13.7).
3. **And** it shows **shared goal status** (Story 13.9 not yet built → a forward-compatible section that renders an empty state now and will populate once shared goals exist).
4. **Given** transparency settings, **When** the dashboard renders, **Then** **only permitted data is shown** — private categories never appear, and `category_only` categories appear as totals only (never individual transactions). This is enforced at the data layer by the existing membership-gated RPCs.
5. **Given** another member makes a change, **When** the dashboard is open, **Then** it **updates in near-real-time (<500ms)** without a manual refresh.
6. **Given** a user with no household, **When** they navigate to the dashboard, **Then** they see a clear "join or create a household" empty state (no error, no leaked data).

## Tasks / Subtasks

- [x] Task 1: Data hook for combined spending (AC: #1, #4)
  - [x] `useHouseholdCategoryTotals` hook → `GET /api/households/category-totals` (the 13.4 endpoint; membership-gated RPC `household_category_totals` returns shared + category_only totals, private excluded). Returns `{ totals: HouseholdCategoryTotal[]; isLoading; error; mutate }`.
  - [x] Reuse the existing `useContributions` hook (13.7) for contribution progress — no change.
- [x] Task 2: Dashboard page (AC: #1, #2, #3, #6)
  - [x] `src/app/household/page.tsx` (client) wrapped in `AppLayout` (match settings). Gated by `useHousehold`:
    - no household → empty state (CTA to Settings to create/join);
    - member → render the three cards.
  - [x] `CombinedSpendingCard` — per shared category: name, total (`formatAmount`), a relative bar; `category_only` rows get a subtle "total only" tag. Empty state when no shared categories.
  - [x] `ContributionProgressCard` — read-only view of `useContributions`: per member email/"You", percentage, fair share, contributed, progress bar (reuses the 13.7 summary; do NOT include the percentage editor — that lives in Settings).
  - [x] `SharedGoalsCard` — forward-compatible empty state ("Shared goals arrive in a later update" / "No shared goals yet"); structured so Story 13.9 can drop in the goal list. Documented as the 13.9 seam.
- [x] Task 3: Real-time updates (AC: #5)
  - [x] In the page, `useRealtimeSubscription((event) => …)` (existing centralized manager, already subscribes to `transactions` postgres_changes). On any event, revalidate the two keys: `globalMutate('/api/households/category-totals')` and `globalMutate('/api/households/contributions')`.
  - [x] Throttle/guard so a burst of events doesn't spam refetches (e.g., trailing revalidate). Keep it simple — SWR dedupes; a small guard is enough.
  - [x] Note RLS caveat in code: a member only receives realtime row events for transactions they can SELECT (shared categories). `category_only`/`private` changes by others won't push an event to them — acceptable for MVP; the totals refresh on the next shared-category event or manual refresh.
- [x] Task 4: Navigation entry (AC: #1)
  - [x] Add a "View household dashboard" link/button in `HouseholdSection` (member-gated) pointing to `/household`. (Do not add a bottom-nav tab — keep the nav unchanged; the entry is from Settings → Household.)
- [x] Task 5: i18n (AC: all)
  - [x] `messages/en.json` + `bg.json`: `householdDashboard` namespace (title, subtitle, combinedSpending, contributionProgress, sharedGoals, totalOnly, noSharedCategories, noSharedGoals, noHousehold, noHouseholdCta, viewDashboard). en/bg key parity (translations.test.ts).
- [x] Task 6: Tests (AC: #1, #2, #3, #5, #6)
  - [x] Component test for the page (mock `useHousehold`, `useHouseholdCategoryTotals`, `useContributions`, `useRealtimeSubscription`): renders the three sections for a member; shows the no-household empty state when `household` is null; shows per-category totals + the `category_only` "total only" tag.
  - [x] Real-time test: the `useRealtimeSubscription` callback triggers `mutate` for both dashboard keys.
  - [x] `useHouseholdCategoryTotals` hook unit test (mock fetch) — optional if the component test covers it.
- [x] Task 7: Verification
  - [x] `npx tsc --noEmit`, `npx eslint`, full `npx jest` green. Finalize Dev Agent Record + File List + Change Log; status → review.

## Dev Notes

### Architecture & data-model decisions

- **All the data already exists — this story is composition + real-time, not new SQL.** Combined spending = `household_category_totals` (migration 023, exposed at `GET /api/households/category-totals`, built in 13.4). Contribution progress = `household_contributions` (migration 025, `GET /api/households/contributions`, built in 13.7). **No migration is needed for 13.8.** [Source: supabase/migrations/023_transparency.sql:45-65; supabase/migrations/025_contribution_splits.sql]
- **Transparency (AC#4) is already enforced server-side.** Both RPCs are `SECURITY DEFINER` + membership-gated and return **aggregates only**: private categories are excluded entirely, `category_only` exposes the total but never rows. The dashboard renders exactly what the RPCs return, so it cannot leak — do not add any client-side transaction fetching to the dashboard. [Source: supabase/migrations/023_transparency.sql:56-63]
- **Shared goals (AC#3) depend on Story 13.9, which isn't built.** Personal goals (migration 013) are NOT household-shared, so do not surface them here. Implement `SharedGoalsCard` as a forward-compatible empty state and leave a clear `// Story 13.9` seam. This keeps 13.8 shippable; 13.9 fills the card. (Same "ship the available slice" approach used elsewhere in Epic 13.)
- **Real-time uses the existing centralized manager — do not create a new channel.** `realtimeManager` already maintains a single `transactions` postgres_changes subscription; `useRealtimeSubscription(cb)` wraps add/remove listener with lifecycle handling. The dashboard just calls it and revalidates the two SWR keys on each event. The browser realtime client respects RLS, so members receive events for shared-category transactions (the case that matters for "another member makes a change"). [Source: src/lib/realtime/subscriptionManager.ts; src/lib/hooks/useRealtimeSubscription.ts]
- **<500ms (AC#5):** revalidating two membership-gated RPC endpoints on a warm SWR cache is well under 500ms; SWR dedupes concurrent revalidations. Add a tiny trailing guard so a burst of inserts triggers a single refresh.

### Files to touch

- NEW `src/app/household/page.tsx`
- NEW `src/lib/hooks/useHouseholdCategoryTotals.ts`
- NEW `src/components/household/CombinedSpendingCard.tsx`
- NEW `src/components/household/ContributionProgressCard.tsx` (read-only; or reuse the 13.7 summary shape)
- NEW `src/components/household/SharedGoalsCard.tsx` (empty state; 13.9 seam)
- UPDATE `src/components/household/HouseholdSection.tsx` (add "View household dashboard" link for members)
- UPDATE `messages/en.json`, `messages/bg.json`
- NEW `src/app/household/__tests__/page.test.tsx` (+ optional hook test)

### Project Structure Notes

- **No migration for this story.** (Migrations remain 020→026; ensure those are applied — esp. 023 + 025 which power the two RPCs — or the dashboard endpoints return errors.) [Source: memory ops note `supabase-migrations-manual-apply.md`]
- Page lives at `src/app/household/page.tsx` (mirrors `src/app/dashboard/page.tsx`), wrapped in `AppLayout` like the settings page so it gets the nav shell + safe-area handling.
- Currency: always `formatAmount(amount, currency)` with the user's `currency_format` (from `useUserPreferences`); never hard-code symbols/ISO codes (ESLint `no-restricted-syntax`).
- Reuse `useContributions` (13.7) verbatim — its `ContributionSummary` already has `fairShare`/`contributed`/`progress`/`isSelf`/`email`.

### Testing standards summary

- Component tests use the project test harness (`src/lib/test-utils/testUtils.tsx`) which provides ChakraProvider + next-intl. Mock the data hooks and `useRealtimeSubscription`.
- en/bg parity enforced by `translations.test.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 13.8 (lines 608-620)]
- [Source: src/app/api/households/category-totals/route.ts] — combined spending endpoint (13.4)
- [Source: src/app/api/households/contributions/route.ts + src/lib/hooks/useContributions.ts] — contribution progress (13.7)
- [Source: src/lib/realtime/subscriptionManager.ts + src/lib/hooks/useRealtimeSubscription.ts] — real-time
- [Source: src/app/dashboard/page.tsx] — page/SWR-revalidation patterns
- [Source: src/components/household/HouseholdSection.tsx] — where the dashboard link mounts

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- next-intl is globally mocked in jest.setup.js (loads real en.json), so the page test asserts the actual English strings.

### Completion Notes List

- All 7 tasks implemented. **tsc 0, ESLint 0, full suite green: 1467 passed / 38 skipped** (7 env-gated RLS suites). No regressions. **No migration needed** — this story is pure composition over the 13.4 + 13.7 RPCs.
- **Combined spending** via `useHouseholdCategoryTotals` → `GET /api/households/category-totals` (13.4 RPC; private excluded, category_only shown as "total only").
- **Contribution progress** via the existing `useContributions` (13.7) rendered read-only (the percentage editor stays in Settings).
- **Shared goals** = forward-compatible empty state with a documented `// Story 13.9` seam.
- **Transparency (AC#4)** is enforced server-side by the membership-gated aggregate RPCs; the dashboard never fetches raw transactions, so it cannot leak.
- **Real-time (AC#5)** reuses the existing `useRealtimeSubscription` centralized manager; on a transaction change it revalidates both dashboard SWR keys, with a 150ms trailing-guard so a burst of inserts collapses to one refresh. RLS caveat documented in code (members only receive realtime events for transactions they can SELECT — i.e. shared categories — which is the case that matters).
- **Entry point:** "View household dashboard" button in `HouseholdSection` (member-gated) → `/household`. No bottom-nav change.
- **No household (AC#6):** clear empty state with a CTA to Settings; dashboard cards are not rendered.

### File List

- src/app/household/layout.tsx — CREATED (AppLayout shell)
- src/app/household/page.tsx — CREATED (membership-gated dashboard + realtime revalidation)
- src/lib/hooks/useHouseholdCategoryTotals.ts — CREATED
- src/components/household/CombinedSpendingCard.tsx — CREATED
- src/components/household/ContributionProgressCard.tsx — CREATED
- src/components/household/SharedGoalsCard.tsx — CREATED (13.9 seam)
- src/components/household/HouseholdSection.tsx — MODIFIED (View dashboard link)
- messages/en.json, messages/bg.json — MODIFIED (householdDashboard namespace + household.viewDashboard)
- src/app/household/__tests__/page.test.tsx — CREATED (member render, no-household empty state, realtime revalidation)

## Change Log

- 2026-06-05: Implemented Story 13.8 — shared household dashboard (combined spending + contribution progress + shared-goals seam; membership-gated; real-time revalidation via the existing subscription manager; entry link from Settings). No migration. Status → review.
- 2026-06-05: Code review (three-lens) — Approve. One LOW applied (B2: clear the queued realtime-revalidation timer on unmount). Verified transparency can't be bypassed (aggregate-only RPCs), all ACs met. Status → done.

## Senior Developer Review (AI)

Reviewer: claude-opus-4-8 · 2026-06-05 · Outcome: **Approve (1 LOW fixed)**

**Acceptance audit**
- AC1/AC2 combined spending + contribution progress: ✅ via the 13.4/13.7 aggregate RPCs.
- AC3 shared goals: ✅ forward-compatible empty state (documented 13.9 seam) — personal goals deliberately not surfaced.
- AC4 transparency: ✅ the page fetches only membership-gated aggregates (private excluded, category_only = totals only); no raw transaction fetch exists, so it cannot leak.
- AC5 real-time: ✅ `useRealtimeSubscription` → debounced revalidation of both keys.
- AC6 no household: ✅ empty state + CTA.

**Findings**
- B2 (LOW, FIXED): a queued 150ms revalidation timer could fire `globalMutate` after unmount → added a cleanup effect to clear it.
- E1 (LOW, accept): RLS means a viewer doesn't receive realtime events for a co-member's `category_only`/`private` changes (can't subscribe to rows you can't see); the shared-category case — the one that matters — works. Documented in code.

**Verification:** tsc 0, ESLint 0, full suite green (1467 pass / 38 skipped). No migration. Ensure migrations 023 + 025 are applied (they power the two RPCs).
