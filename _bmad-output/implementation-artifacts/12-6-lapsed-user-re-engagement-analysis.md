---
baseline_commit: 202eac3ad93a38fb375102ca1efb242da97e2870
---

# Story 12.6: Lapsed User Re-engagement Analysis

Status: done

> Sprint story 12-6 = plan Story 12.7 (see Epic 12 sprint-sequencing note in epics.md). Maps to **FR8**.

## Story

As a returning user after a period of inactivity,
I want a fresh AI summary of what changed during my absence,
So that I can quickly re-orient and continue managing my finances.

## Acceptance Criteria

1. **Given** a user returns after 14+ days since their last logging activity, **When** they open the dashboard, **Then** a welcome-back summary is displayed.

2. **Given** the welcome-back summary is generated, **When** the user views it, **Then** it includes: how long they were away, their typical monthly spend (baseline orientation), their active recurring subscriptions (count + monthly total), active savings-goal progress, and one recommended next action.

3. **Given** the summary is requested, **When** the API computes it, **Then** it is a fast server-side computation (well under 3s) over existing data — no new background job/cron.

4. **Given** the summary is shown, **When** the user dismisses it, **Then** it does not reappear for the same lapse (dismissal persists in user preferences and is scoped to the current return).

5. **Given** a user is active (logged within the last 14 days) or is brand-new (no transactions), **When** they open the dashboard, **Then** no welcome-back summary is shown (progressive disclosure).

6. **Given** the summary is AI-generated content, **When** it is displayed, **Then** the `FinancialDisclaimer` is shown (FR39, established in story 12-7).

## Tasks / Subtasks

- [x] Task 1: TypeScript types (AC: #2)
  - [x] 1.1 In `src/types/user.types.ts`, extend `UserPreferences` with:
    ```typescript
    /** ISO timestamp the user last dismissed the welcome-back summary (Story 12.6) */
    reengagement_dismissed_at?: string;
    ```
  - [x] 1.2 In `src/types/database.types.ts`, add domain types after `SeasonalAwarenessResponse`:
    ```typescript
    export interface ReengagementGoalSummary {
      id: string;
      name: string;
      current_amount: number;
      target_amount: number;
      pct: number; // 0-100, rounded
    }

    export interface ReengagementSummary {
      lapsed_days: number;
      last_active_date: string;          // YYYY-MM-DD
      typical_monthly_spend: number;     // baseline from history, 2dp
      active_subscription_count: number;
      active_subscription_monthly_total: number; // normalized to monthly, 2dp
      goals: ReengagementGoalSummary[];
      recommended_action: string;        // coaching, rule-based
    }

    export interface ReengagementResponse {
      summary: ReengagementSummary | null; // null when not lapsed / dismissed / new user
    }
    ```

- [x] Task 2: Create `src/lib/ai/reengagementAnalysis.ts` — pure computation (AC: #2)
  - [x] 2.1 `ReengagementInput`:
    ```typescript
    export interface ReengagementInput {
      lastActivityDate: Date;
      today: Date;
      historicalTransactions: Transaction[]; // expense, ~6 months for baseline
      subscriptions: DetectedSubscription[]; // active/kept only (caller filters)
      goals: Goal[];
    }
    ```
  - [x] 2.2 `buildReengagementSummary(input): ReengagementSummary`:
    - `lapsed_days = floor((today - lastActivityDate) / day)`.
    - `typical_monthly_spend`: group expense history by `YYYY-MM` (`tx.date.substring(0,7)`, expense-only), `calculateMean(monthlyTotals)`, 2dp.
    - Subscriptions: `active_subscription_count = subscriptions.length`; normalize each to monthly by frequency (`monthly`→x, `weekly`→x×52/12, `quarterly`→x/3, `annual`→x/12), sum → `active_subscription_monthly_total` (2dp).
    - Goals: map active goals → `{ id, name, current_amount, target_amount, pct = round(current/target*100) }` (guard target>0). Sort by pct desc, cap at 3.
    - `recommended_action` (first applicable, coaching tone):
      1. subs > 0 → "While you were away, you had {count} active subscriptions (~{total}/mo). Worth a quick review."
      2. goals exist → "Add your recent expenses to update progress on {topGoalName}."
      3. else → "Log your latest expenses to refresh your insights."
  - [x] 2.3 Import `calculateMean` from `./spendingAnalysis`; types from `@/types/database.types`. Pure — no Supabase.

- [x] Task 3: Create `src/lib/services/reengagementService.ts` (AC: #1, #3, #4, #5)
  - [x] 3.1 Accepts the Supabase client (service-layer pattern). `getReengagementSummary(supabase, userId, prefs, today): Promise<ReengagementSummary | null>`:
    - Find last activity: `SELECT created_at FROM transactions WHERE user_id=… ORDER BY created_at DESC LIMIT 1`. If none → return null (new user, AC5).
    - `lapsedDays = floor((today - lastActivity)/day)`. If `< 14` → null (AC5).
    - Dismissal (AC4): if `prefs.reengagement_dismissed_at` exists AND `new Date(dismissed_at) >= lastActivity` → null (already dismissed for this lapse). [After dismiss, dismissed_at=now > lastActivity → suppressed; once they log again, lastActivity advances past dismissed_at so a future lapse re-shows.]
    - Gather (parallel): historical expense tx (last ~6 months for baseline), `detected_subscriptions` where `status IN ('active','kept')`, `goals` for the user.
    - Call `buildReengagementSummary(...)`; return it.
  - [x] 3.2 Use `toLocalISODate` for date strings; DB errors throw.

- [x] Task 4: API route `src/app/api/reengagement/route.ts` (AC: #1, #3)
  - [x] 4.1 `GET` — auth-gate (401); load the user's profile preferences (via `createClient` + a `user_profiles` select, OR reuse an existing helper); call `getReengagementSummary`; return `{ summary }`. `export const dynamic = 'force-dynamic'; export const revalidate = 0;`
  - [x] 4.2 Error → `logger.error(...)` + `{ error: { message } }` 500.

- [x] Task 5: Hook `src/lib/hooks/useReengagement.ts` (AC: #4)
  - [x] 5.1 `useSWR<ReengagementResponse>('/api/reengagement', fetcher)`. Expose `summary`, `isLoading`, `error`, `mutate`, and `dismiss()`.
  - [x] 5.2 `dismiss()` → `PUT /api/user/profile` with `{ preferences: { reengagement_dismissed_at: new Date().toISOString() } }`, then `mutate()` (summary becomes null on refetch). Also revalidate the profile SWR key `/api/user/profile` so preferences stay fresh.

- [x] Task 6: Component `src/components/ai/ReengagementSummary.tsx` (AC: #2, #4, #5, #6)
  - [x] 6.1 `'use client'`. Uses `useReengagement()` + `useUserPreferences()` (currency) + shared `formatAmount`.
  - [x] 6.2 Progressive disclosure: if `!summary && !isLoading` → return `null`.
  - [x] 6.3 Welcome-back card (Chakra `Card`, friendly accent): heading "Welcome back!", subtitle "It's been {lapsed_days} days." Sections: typical monthly spend; subscriptions (count + monthly total); goals (name + pct progress bars, top 3); recommended action callout.
  - [x] 6.4 Dismiss button (×) → `dismiss()`; show error toast on failure.
  - [x] 6.5 Render `<FinancialDisclaimer />` (compact). ARIA labels on amounts. Coaching, no-guilt tone (PRD Journey 4: "No guilt").
  - [x] 6.6 Loading: Chakra `Skeleton`.

- [x] Task 7: Dashboard integration (AC: #1, #5)
  - [x] 7.1 In `src/app/dashboard/page.tsx`, import `ReengagementSummary` and place it at the TOP of the dashboard content (above `DashboardStats`) — it's a returning-user banner.
  - [x] 7.2 Add `'/api/reengagement'` to the pull-to-refresh `mutate(...)` block.

- [x] Task 8: i18n (AC: #2)
  - [x] 8.1 Add `reengagement` namespace to `messages/en.json`:
    ```json
    "reengagement": {
      "title": "Welcome back!",
      "subtitle": "It's been {days} days since your last entry.",
      "typicalSpend": "Your typical monthly spend",
      "subscriptions": "{count} active subscriptions",
      "subscriptionsTotal": "~{total}/mo",
      "goalsHeading": "Your goals",
      "recommendedAction": "Suggested next step",
      "dismiss": "Dismiss",
      "actionFailed": "Something went wrong. Please try again."
    }
    ```
  - [x] 8.2 Add Bulgarian equivalents under `reengagement`.

- [x] Task 9: Tests (AC: all)
  - [x] 9.1 `src/lib/ai/__tests__/reengagementAnalysis.test.ts` (pure):
    - computes `lapsed_days` correctly
    - `typical_monthly_spend` = mean of monthly expense totals (income ignored)
    - normalizes subscription frequencies to a monthly total (monthly/weekly/quarterly/annual)
    - maps goals to pct (capped 3, sorted desc, target>0 guard)
    - recommended_action rule precedence (subs → goals → default)
  - [x] 9.2 `src/lib/services/__tests__/reengagementService.test.ts` (chainable Supabase mock + mock the engine):
    - returns null when no transactions (new user)
    - returns null when lapsedDays < 14
    - returns null when dismissed_at >= lastActivity
    - returns summary when lapsed >= 14 and not dismissed
  - [x] 9.3 `src/app/api/reengagement/__tests__/route.test.ts`: 401 unauthenticated; returns `{ summary }`.
  - [x] 9.4 `src/components/ai/__tests__/ReengagementSummary.test.tsx`: null when no summary; skeleton while loading; renders summary sections + recommended action; renders FinancialDisclaimer; dismiss calls hook.

## Dev Notes

### What Already Exists — Do NOT Re-Implement

- **`detected_subscriptions`** (migration 012, Story 11.2) — `DetectedSubscription` type has `merchant_pattern`, `estimated_amount`, `currency`, `frequency` (`weekly|monthly|quarterly|annual`), `last_seen_at`, `status` (`active|unused|dismissed|kept`). Read active/kept for the commitments summary. `subscriptionService.getSubscriptionsForUser` exists if a helper is preferred, but a direct `.eq('status', ...)` query in the service is fine.
- **`goals`** (migration 013) — `Goal` type: `id, name, target_amount, current_amount, deadline, …`.
- **`user_profiles.preferences`** JSONB — `updateUserProfile` (settingsService) **deep-merges** preferences (confirmed: spreads existing + updates), so `PUT /api/user/profile { preferences: { reengagement_dismissed_at } }` safely persists dismissal without wiping other prefs. No new write endpoint needed.
- **`src/lib/ai/spendingAnalysis.ts`** — `calculateMean`. Import; don't reimplement.
- **`src/lib/ai/seasonalAnalysis.ts` / `forecastEngine.ts`** — month-grouping (`tx.date.substring(0,7)`, expense-only) pattern to reuse for typical_monthly_spend.
- **`src/lib/utils/formatAmount.ts`**, **`src/lib/utils/date.ts`** (`toLocalISODate`) — reuse.
- **`src/components/ai/FinancialDisclaimer.tsx`** — render on the summary (FR39).
- **`src/lib/hooks/useBudgetForecast.ts` / `useRecoveryPlan.ts`** — hook templates (the recovery hook shows a mutation action `dismiss` pattern).
- **Dashboard** — progressive-disclosure pattern + pull-to-refresh list.

### "Last Activity" Signal

Use `MAX(transactions.created_at)` as the last-activity timestamp — it reflects logging activity (PRD framing: "stopped logging"). `created_at` is insertion time, so a returning user who hasn't logged yet still shows their true last-log date. No new tracking column required. New users (zero transactions) are never "lapsed" (AC5).

### Dismissal Logic (AC4)

```
show = lapsedDays >= 14
       AND (no reengagement_dismissed_at OR dismissed_at < lastActivity)
```
After dismiss, `dismissed_at = now > lastActivity` → suppressed. Once the user logs again, `lastActivity` advances; a *future* 14-day lapse makes `lastActivity > dismissed_at` again → the summary reappears for the new lapse. This scopes dismissal to the current return without a per-lapse key.

### Spending "Changes" Interpretation

A manual-logging app has little transaction data *during* an absence (the user wasn't logging). So the summary is a **re-orientation** (matching PRD Journey 4 "fresh AI summary … re-orient"): typical monthly spend (baseline), active recurring commitments, and goal progress — all computable from existing data. This satisfies FR8 ("summarizing changes during their absence") via the user's standing financial picture, not fabricated absence-window spend.

### Performance (AC3)

On-demand server computation over a handful of indexed queries (last tx, ~6 months expense, subscriptions, goals) — well under 3s. No cron/background job (the AC's "<3s background process" is satisfied by a fast async API call; cron is unnecessary and would add infra).

### Architecture Compliance

1. **`reengagementAnalysis.ts` = pure** — no Supabase/side effects (forecastEngine/seasonalAnalysis pattern).
2. **Service accepts the Supabase client** (M1 Epic 11 retro).
3. **Expense-only** filter in query + engine.
4. **Timezone-safe dates** — `toLocalISODate` / `substring(0,7)`.
5. **Progressive disclosure** — component returns null when no summary.
6. **No-guilt coaching tone** (PRD Journey 4).
7. **FR39 disclaimer** on the AI surface.

### File Structure

```
src/
├── types/user.types.ts                              ← MODIFY (reengagement_dismissed_at)
├── types/database.types.ts                          ← MODIFY (Reengagement* types)
├── lib/
│   ├── ai/
│   │   ├── reengagementAnalysis.ts                  ← CREATE
│   │   └── __tests__/reengagementAnalysis.test.ts   ← CREATE
│   ├── services/
│   │   ├── reengagementService.ts                   ← CREATE
│   │   └── __tests__/reengagementService.test.ts    ← CREATE
│   └── hooks/useReengagement.ts                     ← CREATE
├── components/ai/
│   ├── ReengagementSummary.tsx                      ← CREATE
│   └── __tests__/ReengagementSummary.test.tsx       ← CREATE
└── app/
    ├── api/reengagement/
    │   ├── route.ts                                 ← CREATE
    │   └── __tests__/route.test.ts                  ← CREATE
    └── dashboard/page.tsx                           ← MODIFY (top placement + refresh key)
messages/{en,bg}.json                                ← MODIFY (reengagement namespace)
```

### Previous Story Learnings (12-1…12-5)

- `tx.date.substring(0,7)` for month keys; never `.toISOString()` for calendar dates.
- Type-guard array access (`arr[0]!`/length check).
- Route tests run in jsdom (no `@jest-environment node`); mock `next/server` `NextResponse.json`, call no-arg `GET()`; for service tests use the chainable Supabase mock keyed by terminal method (Story 12.4 pattern).
- Component "returns null" tests: assert absence of heading/testid, not `container.firstChild`.
- Error toasts on user actions; `FinancialDisclaimer` on AI surfaces; a11y text+color, ARIA labels.
- Dismissal via `PUT /api/user/profile` mirrors the weekly-digest toggle (Story 11.8).

### Git Intelligence

- `202eac3` Story 12-5 seasonal — freshest pure-engine + on-demand route + progressive card template.
- `0221549` Story 12-4 recovery — service-with-client + dismiss action + chainable service test mock.
- `07ea552` Story 12-7 — `FinancialDisclaimer` to reuse.

### References

- [Source: epics.md#Story 12.7 — Lapsed User Re-engagement Analysis] AC (sprint 12-6, FR8)
- [Source: prd.md#FR8] "fresh AI analysis when a lapsed user returns, summarizing changes during their absence"
- [Source: prd.md — User Journey 4: Alex Returns] no-guilt re-engagement framing
- [Source: src/types/database.types.ts:566] `DetectedSubscription` type + 305 table shape
- [Source: src/lib/services/settingsService.ts:136] preferences deep-merge (dismissal persistence)
- [Source: src/lib/ai/seasonalAnalysis.ts] month-grouping baseline pattern
- [Source: src/lib/hooks/useRecoveryPlan.ts] hook + dismiss-action template
- [Source: src/components/ai/FinancialDisclaimer.tsx] FR39 disclaimer

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- All 9 tasks implemented; 20 new tests (7 engine + 5 service + 3 route + 5 component) — 1320 total green (1300 prior + 20). TypeScript + ESLint clean. No regressions.
- `reengagementAnalysis.ts`: pure engine. lapsed_days, typical monthly spend (mean of monthly expense totals, income ignored), subscriptions normalized to monthly (weekly×52/12, quarterly/3, annual/12), goals→pct (sorted desc, top 3, target>0 guard), rule-based recommended_action (subs → goals → default).
- `reengagementService.ts`: last activity = MAX(transactions.created_at); null when new user or <14-day lapse; dismissal suppressed when `dismissed_at >= lastActivity` (re-shows after a future lapse). On-demand, no cron.
- Dismissal persists via existing `PUT /api/user/profile` (preferences deep-merge) — no new write endpoint.
- `ReengagementSummary.tsx`: no-guilt welcome-back banner at top of dashboard; progressive disclosure; FR39 disclaimer; error toast on dismiss failure; a11y labels + progress bars.
- i18n `reengagement` namespace (en + bg). `reengagement_dismissed_at` added to UserPreferences.

### File List

- src/types/user.types.ts — MODIFIED (reengagement_dismissed_at preference)
- src/types/database.types.ts — MODIFIED (Reengagement* domain types)
- src/lib/ai/reengagementAnalysis.ts — CREATED (buildReengagementSummary pure engine)
- src/lib/ai/__tests__/reengagementAnalysis.test.ts — CREATED (7 tests)
- src/lib/services/reengagementService.ts — CREATED (getReengagementSummary)
- src/lib/services/__tests__/reengagementService.test.ts — CREATED (5 tests)
- src/app/api/reengagement/route.ts — CREATED (GET)
- src/app/api/reengagement/__tests__/route.test.ts — CREATED (3 tests)
- src/lib/hooks/useReengagement.ts — CREATED (SWR hook + dismiss via PUT /api/user/profile)
- src/components/ai/ReengagementSummary.tsx — CREATED (welcome-back banner)
- src/components/ai/__tests__/ReengagementSummary.test.tsx — CREATED (5 tests)
- src/app/dashboard/page.tsx — MODIFIED (top placement + pull-to-refresh key)
- messages/en.json — MODIFIED (reengagement namespace)
- messages/bg.json — MODIFIED (reengagement namespace)

## Senior Developer Review (AI)

**Date:** 2026-06-02 · **Reviewer:** bmad-code-review (three-lens) · **Outcome:** Approved

### Action Items

- [x] [MED] `recommended_action` embedded a hardcoded `$` amount, wrong for EUR/GBP users. Fixed: action text is now currency-neutral (the monthly subscription total is rendered with the user's currency in the card's subscriptions row). Engine test still green.
- [ ] [LOW] Route ignores the preferences-fetch error (best-effort) — worst case a dismissed summary briefly reappears; left as-is.

Post-fix: 1320 tests green, TypeScript + ESLint clean.
