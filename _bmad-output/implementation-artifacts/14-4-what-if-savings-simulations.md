---
baseline_commit: a9e6569a573ec3539e2ef42a8302f09d89d4c833
---

# Story 14.4: "What If" Savings Simulations

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user exploring financial changes,
I want to run simulations toggling spending habits to see projected annual savings impact,
so that I can understand the long-term effect of small changes.

## Acceptance Criteria

1. **Given** a user with spending history, **When** they open the "What If" simulator, **Then** they can adjust per-category spending reductions with **sliders (0–100%)** over each category's 3-month average monthly spend (UX spec: "Slider adjustments, 0-100% per category, Live calculation, no save").
2. **And** they can toggle **"cancel subscription"** for each active detected subscription (11-2), its recurring charge normalized to a monthly amount (weekly ×52/12, monthly ×1, quarterly ÷3, annual ÷12).
3. **And** the simulator shows **projected monthly and annual savings** from the combined changes, updating **live on every adjustment** (client-side pure engine — no server round-trip per slider move).
4. **And** the **impact on the nearest active savings goal** is shown (e.g., "You'd reach your Vacation goal ~2 months earlier"), using the deadline-required-pace model: extra monthly savings raise the daily pace, shrinking days-to-target; omitted when no unmet future-deadline goal exists or savings are 0.
5. **And** simulations are **exploratory only** — the story performs **zero writes** (no POST/PATCH anywhere; no budgets, transactions, or subscriptions modified), and the UI says so.
6. **Given** a user with no expense history, **When** the simulator loads, **Then** it renders a friendly empty state (no sliders, no fabricated averages); subscriptions/goal enrichments degrade independently (14-3 honesty lesson — never confidently wrong numbers).

## Tasks / Subtasks

- [x] Task 1: Types (AC: #1–#4) — `WhatIfCategory`, `WhatIfSubscription`, `WhatIfContextResponse`, engine input/output types in `src/types/database.types.ts` near the 14.x types. NO new tables (read-only story — no migration).
- [x] Task 2: Pure engine `src/lib/ai/whatIfEngine.ts` (AC: #3, #4) — `computeWhatIfProjection(input)` per the Simulation math spec below; no DB/currency/i18n; guards for met-target/past-deadline/zero-savings; split-parts local date parse + −0 normalization (14-3 lessons); importable from a client component (pure module).
- [x] Task 3: API `GET /api/what-if` (AC: #1, #2, #4, #6) — force-dynamic, auth 401; ONE parallel batch: (a) prior-3-months expense transactions (stored `exchange_rate` conversion, month-bucketed 3-month average per category — same math as `evaluateNudgeForTransaction`/forecast route), (b) own expense `categories` (names/colors), (c) `detected_subscriptions` with `status = 'active'` normalized to monthly, (d) nearest unmet future-deadline goal — copy the 14-3 goals query verbatim (`.not('deadline','is',null).gt('deadline', todayKey).order('deadline').limit(10)` + client-side unmet pick; goals need the generic `SupabaseClient` cast). Subscriptions + goal degrade independently to empty/null with warn logs; `hasData: false` short-circuit when no category has a positive average.
- [x] Task 4: Hook `src/lib/hooks/useWhatIf.ts` (SWR, key `/api/what-if`, fetcher throws on !ok, keepPreviousData).
- [x] Task 5: UI `src/components/goals/WhatIfSimulator.tsx` (AC: #1–#6) mounted on `/goals` below `WishlistSection` (architecture tree places it in components/goals): per-category rows (name + color dot + Chakra `Slider` 0–100% with `aria-label`, current avg → reduced amount live), subscription `Checkbox` rows ("Cancel {name} — {amount}/mo"), results panel (monthly + annual savings, goal line), Reset button, exploratory disclaimer text, empty state (AC #6), error state only when no cached data (stale-through-error, 14-3 lesson), 44px mobile touch targets. Local `useState` only — NO persistence of slider state.
- [x] Task 6: i18n — new `whatIf` namespace in `messages/en.json` + `messages/bg.json` (parity CI-enforced; check bg decimal/gender phrasing carefully — 14-3 review caught a bg mistranslation).
- [x] Task 7: Tests — engine units (every branch of the math spec incl. combined sliders+cancellations, goal guards, −0, 100% and 0% slider bounds); route tests (`@jest-environment node` in the FIRST docblock — 14-3 review lesson; 401, average math over month buckets, frequency normalization incl. weekly/quarterly/annual, degradation paths, `hasData:false`, currency conversion); component test (live recompute on slider/checkbox, reset, empty state, no fetch on adjustment — assert no POST/PATCH ever).
- [x] Task 8: Verification — `npm run lint`, `npm run type-check`, full `npm test`, `npm run build`; Dev Agent Record + File List + Change Log; status → review; sprint-status 14-4 → review.

### Review Findings

- [x] [Review][Patch] History/categories query ERROR returns 200 `hasData:false` — tells a long-time user they have "no spending history" and poisons the SWR cache; return 500 so the loadFailed alert (with stale-through-error) applies [src/app/api/what-if/route.ts]
- [x] [Review][Patch] Categories query is own-only (`.eq('user_id')`) — spend logged into a co-member's shared household category silently vanishes from the simulator; use the RLS-visible dual-path (drop the user filter, keep `type='expense'`) [src/app/api/what-if/route.ts]
- [x] [Review][Patch] `hasData` keyed on categories only — a user with active subscriptions but no recent categorized spend gets the empty state and can never simulate a cancellation; include subscriptions [src/app/api/what-if/route.ts; WhatIfSimulator.tsx]
- [x] [Review][Patch] Subscription cancel + its category slider double-count the same charge — add an honest hint under the subscriptions heading (en+bg) [WhatIfSimulator.tsx; messages]
- [x] [Review][Patch] Met goals can fill the 10-row future-deadline window and hide an unmet 11th — raise the fetch limit [src/app/api/what-if/route.ts]
- [x] [Review][Patch] Stale `reductions`/`cancelled` entries for revalidation-dropped items keep `hasAdjustments` true (green €0.00 + enabled Reset) — compute against current ids only [WhatIfSimulator.tsx]
- [x] [Review][Patch] `goalEarlierMonths` lacks ICU plural → "about 1 months earlier" / "1 месеца" [messages/en.json; messages/bg.json]
- [x] [Review][Patch] `parseLocalDate` accepts rollover dates (2026-13-40 → Feb 2027) → confident nonsense projection; round-trip-validate parts (also in wishlistImpactEngine — same helper) [whatIfEngine.ts; wishlistImpactEngine.ts]
- [x] [Review][Patch] `Math.ceil` day-diff between local midnights overcounts by 1 across a DST fall-back — use `Math.round` (both engines) [whatIfEngine.ts; wishlistImpactEngine.ts]
- [x] [Review][Patch] `DAYS_PER_MONTH` comment claims 365.25/12 = 30.44 (actually 30.4375) — fix the comment so nobody "corrects" the constant [whatIfEngine.ts]
- [x] [Review][Patch] Touch targets: 20px slider thumb + default checkboxes on mobile (Task 5 says 44px) — enlarge thumb/checkbox hit areas on base [WhatIfSimulator.tsx]
- [x] [Review][Patch] Route test stub records no filter args — deleting `.eq('user_id')` or the `.lt` date bound still passes; capture chains + assert the transactions query filters [route.test.ts]
- [x] [Review][Patch] Component test double-renders without unmount and never asserts the error alert is absent with stale data [WhatIfSimulator.test.tsx]
- [x] [Review][Defer] "3-month average" = mean over months PRESENT (spec-mandated parity with nudge/forecast engines) — a one-month spike inflates the projection; switching to a fixed ÷3 is a product decision affecting all engines uniformly — deferred
- [x] [Review][Defer] Goal-earlier model assumes on-pace saving + 100% of savings redirected to the nearest goal; copy doesn't say so — product copy nuance — deferred
- [x] [Review][Defer] Currency: stored-rate-only conversion (no live-rate fallback) + averages keep the write-time base while the label shows the current preference — same class as the budgets/wishlist deferred items — deferred, pre-existing pattern
- [x] [Review][Defer] Server-clock month window + `todayKey` (UTC on Vercel) vs client timezone — same class as budgets/forecast/wishlist deferred items — deferred, pre-existing pattern

## Dev Notes

### Simulation math spec (deterministic — the engine implements exactly this)

Input: `{ adjustments: [{ avgMonthly, reductionPct }], cancelledMonthlyAmounts: number[], goal: { name, targetAmount, currentAmount, deadline (YYYY-MM-DD) } | null, today: Date }`

- `monthlySavings = round2( Σ avgMonthly × reductionPct/100 + Σ cancelledMonthlyAmounts )`; `annualSavings = round2(monthlySavings × 12)`. Normalize −0 → 0 (14-3 lesson).
- Goal impact (null when `goal` null, `monthlySavings ≤ 0`, target met, or deadline not strictly future): `remaining = targetAmount − currentAmount`; `daysToDeadline = ceil((deadline_local − today_local)/86400000)` (split-parts date construction — NEVER `new Date('YYYY-MM-DD')`); `dailyRequired = remaining / daysToDeadline`; `newDaily = dailyRequired + monthlySavings / 30.44`; `newDays = ceil(remaining / newDaily)`; `days_earlier = daysToDeadline − newDays`; `months_earlier = round1(days_earlier / 30.44)`. Output `{ goal_name, days_earlier, months_earlier }`.
- Frequency→monthly normalization happens in the ROUTE (data assembly), not the engine: weekly `×52/12`, monthly `×1`, quarterly `÷3`, annual `÷12`, round2.

### Architecture & data-model decisions

- **No migration, zero writes.** Pure read/aggregation like 14-2. The simulator must not create endpoints with side effects — AC #5 is a hard constraint ("no changes are applied to actual budgets"). [Source: epics.md Story 14.4; prd FR16]
- **Live calculation = client-side engine.** The UX spec mandates "Live calculation, no save" — a server round-trip per slider tick is wrong. The pure engine runs in the client component on each change; `/api/what-if` supplies static context (averages, subscriptions, goal) once. This is the first Epic-12-style engine invoked client-side: it's already pure (no DB/no node APIs), so importing it into a `'use client'` component is safe. [Source: ux-design-specification.md line 933]
- **3-month category averages**: reuse the established month-bucket mean — group prior-3-months expenses by category × YYYY-MM month key (string slice, timezone-safe), `calculateMean` over the month totals per category. Same semantics as the nudge helper and forecastEngine; do NOT invent a different average. Categories with average ≤ 0 are excluded from the simulator. [Source: src/app/api/transactions/route.ts evaluateNudgeForTransaction; src/lib/ai/forecastEngine.ts]
- **Subscriptions**: `detected_subscriptions` is in the typed schema (`DetectedSubscription`). Only `status = 'active'` rows are offered for cancellation simulation; display name = `merchant_pattern`; amount = `estimated_amount` normalized per the math spec. [Source: supabase/migrations/012_detected_subscriptions.sql; src/types/database.types.ts:998]
- **Goal query**: copy 14-3's reviewed shape exactly (future-deadline filter SERVER-side — the review found expired goals starving the window; generic client cast — goals aren't in the typed schema). [Source: src/app/api/wishlist/route.ts goals query + 14-3 Review Findings]
- **Honest degradation (14-3 review lessons)**: subscriptions error → empty list + warn (simulator still works with sliders); goal error → null (results omit the goal line); expense-history error → `hasData:false` (empty state) rather than fabricated zeros. Never render a confidently wrong number.
- **Currency**: route converts via stored `exchange_rate` (`rate ? amount×rate : amount`) like `budgets`/`wishlist`; engine and API stay currency-agnostic; the component formats with `formatCurrency(..., preferences?.currency_format || 'EUR')`. Live-rate fallback remains deferred (deferred-work.md).
- **Placement**: `/goals` page hosts goals → wishlist → what-if, completing the "Goal Management & Savings" pillar; `WhatIfSimulator.tsx` is explicitly in the architecture component tree under components/goals. [Source: architecture.md lines 576-581]

### Files to touch

- UPDATE `src/types/database.types.ts` (WhatIf types near the 14.x block)
- NEW `src/lib/ai/whatIfEngine.ts`
- NEW `src/app/api/what-if/route.ts` (GET only)
- NEW `src/lib/hooks/useWhatIf.ts`
- NEW `src/components/goals/WhatIfSimulator.tsx`
- UPDATE `src/app/goals/page.tsx` (mount below WishlistSection)
- UPDATE `messages/en.json`, `messages/bg.json` (new `whatIf` namespace)
- NEW tests: `src/lib/ai/__tests__/whatIfEngine.test.ts`, `src/app/api/what-if/__tests__/route.test.ts`, `src/components/goals/__tests__/WhatIfSimulator.test.tsx`

### Project Structure Notes

- Route tests: `@jest-environment node` in the FIRST docblock (Jest ignores later docblocks — bit us in 14-3 review); mock `next/server` before imports; chainable Supabase mock must include EVERY method the queries chain (`gt`, `gte`, `lte`, `in`, `is`, `not`, `order`, `limit` — two 14-3 failures came from missing `lte`/`gt`); table-keyed result queues for multi-query routes. [Source: src/app/api/wishlist/__tests__/route.test.ts]
- Component tests: mock the hook module + `next-intl` + `useUserPreferences`; restore `global.fetch` in `afterAll` (14-3 review lesson); Chakra Slider interaction — prefer asserting on rendered output after `fireEvent` keyboard events (`keyDown` ArrowRight) or call the slider's `onChange` via `aria` role `slider` with `fireEvent.keyDown`; simpler: extract per-row `onChange` into props-driven subcomponents so tests drive state directly.
- SWR fetcher throws on `!res.ok`; `keepPreviousData: true`; error UI only when nothing cached. [Source: src/lib/hooks/useWishlist.ts]
- en/bg parity enforced by `translations.test.ts`; engine emits numbers/flags only — ALL copy i18n'd in the component.
- The goals page now ends with `<WishlistSection />` — mount `<WhatIfSimulator />` after it. [Source: src/app/goals/page.tsx]

### Previous story intelligence (14-3 + its code review)

- **Honesty over availability**: reviewers rejected degradations that fabricate numbers (spent:0, −price balances). Same bar applies here: no history → empty state, not zero-averages.
- Decimal validation, comma-input handling, per-field aria-associated errors, 44px targets — reuse the reviewed WishlistSection/BudgetEditor patterns for any numeric input (sliders avoid most of this; the disclaimer + labels still need i18n).
- Engines stay pure and client-safe; `round2` must normalize −0; goal-date parsing via split parts.
- No optimistic-mutate needs here (zero writes) — don't cargo-cult SWR mutation machinery into a read-only feature.
- jest 1705 passed / 54 skipped as of a9e6569 — this story only adds; no existing test may need behavioral changes.

### Testing standards summary

- Engine: pure units — single slider, multiple sliders, sliders+cancellations combined, 0%/100% bounds, zero savings → null goal impact, met target, past deadline, no goal, −0, months_earlier rounding (e.g. ~2 months case from the epic).
- Route: 401; bucket-mean average math (two months of data → mean over months present); frequency normalization all four enums; degradation per source; `hasData:false`; exchange-rate conversion.
- Component: slider/checkbox drive live results; reset restores zeros; empty state; assert `global.fetch` never called with POST/PATCH (AC #5).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 14.4 (lines 713-726)]
- [Source: _bmad-output/planning-artifacts/prd.md#FR16]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md line 933 — "Slider adjustments | 0-100% per category | Live calculation, no save"]
- [Source: _bmad-output/planning-artifacts/architecture.md lines 576-581 — WhatIfSimulator.tsx in components/goals]
- [Source: _bmad-output/implementation-artifacts/14-3-wishlist-with-budget-impact-analysis.md — engine/route/test patterns + Review Findings (all lessons cited above)]
- [Source: supabase/migrations/012_detected_subscriptions.sql — status/frequency enums, estimated_amount]
- [Source: src/app/api/wishlist/route.ts — goals query (reviewed), degradation pattern, currency conversion]

## Dev Agent Record

### Agent Model Used

claude-fable-5

### Debug Log References

- One eslint pass flagged react-hooks/exhaustive-deps on the projection memo's derived arrays — fixed by memoizing `categories`/`subscriptions`. Everything else clean first pass; all 30 new tests green first run.

### Completion Notes List

- **Zero writes, no migration** — GET-only `/api/what-if`; the component performs no fetch on adjustments (asserted by test). AC #5 is structural.
- **Client-side live math**: `computeWhatIfProjection` (pure, client-safe) runs in a `useMemo` on every slider/checkbox change — no server round-trips per the UX spec's "Live calculation, no save". First Epic-12-style engine imported into a client component.
- **Data assembly**: 3-month per-category averages via the established month-key bucket + `calculateMean` (timezone-safe string slice, stored-rate currency conversion); active `detected_subscriptions` normalized weekly ×52/12 / quarterly ÷3 / annual ÷12; nearest unmet future-deadline goal via the 14-3 reviewed query shape (`.gt('deadline', todayKey)` server-side, generic client cast).
- **Goal impact model**: extra monthly savings raise the deadline-required daily pace → `days_earlier = daysToDeadline − ceil(remaining/newDaily)`, `months_earlier = round1(days/30.44)` — mirrors 14-3's delay math in the opposite direction; guards for met target / past or malformed deadline / zero savings; −0 normalized.
- **Honest degradation (14-3 lessons)**: subscriptions/goal fail independently (warn + empty/null); history or categories failure → `hasData:false` empty state — never fabricated zero-averages; UI renders stale data through transient errors and shows the alert only with nothing cached.
- **UI**: sliders (0–100%, step 5, aria-labeled) with live "−X% → €Y/mo" copy, cancel-subscription checkboxes, results panel (monthly/annual savings + "reach your goal ~N months earlier" badge), Reset, exploratory disclaimer; 44px mobile touch targets; en+bg i18n (bg phrasing double-checked per the 14-3 review lesson).
- **Verification**: lint (`--max-warnings=0`) clean, `tsc --noEmit` clean, full jest **1735 passed / 54 skipped**, production build compiles `/api/what-if`.

### File List

**New**
- `src/lib/ai/whatIfEngine.ts`
- `src/app/api/what-if/route.ts`
- `src/lib/hooks/useWhatIf.ts`
- `src/components/goals/WhatIfSimulator.tsx`
- `src/lib/ai/__tests__/whatIfEngine.test.ts`
- `src/app/api/what-if/__tests__/route.test.ts`
- `src/components/goals/__tests__/WhatIfSimulator.test.tsx`

**Updated**
- `src/types/database.types.ts` (WhatIfCategory/WhatIfSubscription/WhatIfContextResponse/WhatIfProjection)
- `src/app/goals/page.tsx` (mount WhatIfSimulator below WishlistSection)
- `messages/en.json`, `messages/bg.json` (new `whatIf` namespace)

### Change Log

- 2026-07-02: Story 14.4 implemented — exploratory "What If" savings simulator (client-side pure whatIfEngine, GET-only /api/what-if context, sliders + cancel-subscription toggles + live results + goal-earlier badge on /goals, en/bg i18n, 30 new tests). Zero writes, no migration. lint/tsc clean; jest 1735 passed / 54 skipped; build green. Status → review.
- 2026-07-02: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor): all 6 ACs verified met, 0 HIGH/MED unresolved; 13 patch findings ALL applied in-session — honesty: core-input query errors now 500 (never a fake "no history" empty state), subscriptions-only users get the simulator (hasData includes subscriptions), overlap hint under cancel toggles (a subscription's charge usually sits inside a category average); correctness: RLS-visible categories query (shared household categories keep their sliders), goal window 10→50 (met goals can't starve the pick), stale local adjustments ignored after revalidation, ICU plural for "1 month", rollover-date rejection + DST-safe day rounding in BOTH engines (wishlistImpactEngine same-class), DAYS_PER_MONTH comment fixed; UX: bigger mobile slider thumb + checkbox hit areas; tests: filter-arg assertions on the history query, split stale-error test with absence assertion, subscriptions-only cases (+7 tests). 4 deferred to deferred-work.md; 2 dismissed (unreachable per DB enum / schema-guarded). Status → done; Epic 14 complete.

## Senior Developer Review (AI)

**Outcome:** Approve — all 6 ACs met, 0 HIGH; all 13 patch-class findings resolved in-session (see Review Findings checklist above; deferrals recorded in deferred-work.md).
