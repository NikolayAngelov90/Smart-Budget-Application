---
baseline_commit: 230a2e5adf624040f948abcfaab849e05d9f79b2
---

# Story 15.7: Progressive Feature Disclosure

Status: done

## Story

As a new user,
I want advanced features to appear gradually as my usage warrants,
So that I'm not overwhelmed on day one.

## Acceptance Criteria

1. **Given** a user's activity state is tracked (transaction count, days active, features used) **When** usage thresholds are met **Then** new features are surfaced with a brief introduction (e.g., "You've logged 30 transactions — check out your Spending Heatmap")
2. **And** users can access all features early via settings if they choose
3. **And** disclosure state is persisted per user

## Tasks / Subtasks

- [x] Task 1: Make the dormant feature-state table live (AC: 1, 3) — migration + service
  - [x] Migration `supabase/migrations/039_feature_disclosure.sql`: `ALTER TABLE public.user_feature_state ADD COLUMN IF NOT EXISTS last_active_date DATE;` (needed to detect a NEW active day for days_active without coupling to streaks). RLS already correct (035 initplan baseline); table already has owner SELECT/INSERT/UPDATE (011). Idempotent + guarded for the user's manual-rerun habit (038 lesson). Apply to prod via MCP + verify.
  - [x] `src/lib/services/featureStateService.ts` (NEW, AUTH-SCOPED — owner-only RLS is the gate, exercised in prod; user_feature_state IS in the typed Database schema so no generic cast):
    - `getFeatureState(supabase, userId)`: SELECT the row; if missing, INSERT the default (create-on-read — some users predate the signup insert or it failed). Returns `{ transactions_count, days_active, features_unlocked, last_active_date }`.
    - `recordFeatureActivity(supabase, userId, todayKey)`: getOrCreate, then UPDATE `transactions_count = +1`, `days_active = + (last_active_date == null || last_active_date < todayKey ? 1 : 0)`, `last_active_date = todayKey`. Non-fatal by contract (callers wrap). todayKey is a `yyyy-MM-dd` string (DATE-col compare rule — never new Date()/toISOString).
    - `acknowledgeFeature(supabase, userId, featureKey)`: append featureKey to features_unlocked if absent (idempotent; validate featureKey against the catalog keys — REST-exposed writes need a code guard, 15-3 lesson).
- [x] Task 2: Pure disclosure engine + threshold catalog (AC: 1, 2) — ADR-022 "thresholds in a constants file"
  - [x] `src/lib/ai/disclosureCatalog.ts` (NEW, client-safe, pure): `FeatureKey = 'heatmap' | 'projections' | 'subscriptions'`; `FEATURE_DISCLOSURE: Record<FeatureKey, { requirement: { metric: 'transactions_count' | 'days_active'; value: number }; introKey: string; url: string }>` — heatmap: transactions_count>=30 (matches the AC example verbatim); projections: days_active>=14; subscriptions: transactions_count>=50. `FEATURE_KEYS: Set<FeatureKey>` for validation.
  - [x] `src/lib/ai/disclosureEngine.ts` (NEW, pure, Epic-12 style — no DB, no I/O): `computeDisclosure(state: {transactions_count, days_active, features_unlocked}, showAll: boolean) -> { unlocked: FeatureKey[]; pending: FeatureKey[] }`. unlocked = features whose requirement metric >= value (OR everything when showAll). pending = unlocked && NOT in features_unlocked (the not-yet-introduced set) AND NOT showAll (the escape hatch reveals without nagging — AC2). Deterministic; undefined/absent metric treated as 0 (unknowable≠met).
- [x] Task 3: Activity tracking wired into tx POST (AC: 1, 3)
  - [x] `src/app/api/transactions/route.ts`: after the transaction is created, add non-fatal enrichment `void recordFeatureActivity(supabase, user.id, resolveLogDay(...)).catch(warn)` — reuse the SAME day key the streak hook already computes (localDayKey/clamped), do NOT recompute. AUTH-SCOPED client (already in hand). Placement: alongside the existing streak/achievement/comeback enrichment; must never fail the POST (degradation policy). Does NOT ride the response envelope (state is read via the GET below — one-shot events never ride cacheable POST/GET payloads, 15-3 HIGH).
- [x] Task 4: Disclosure API (AC: 1, 2, 3)
  - [x] `src/app/api/feature-disclosure/route.ts` GET (NEW): auth (401 if no user); reads featureState + the `disclosure_show_all` pref; returns `{ transactionsCount, daysActive, unlocked: FeatureKey[], pending: FeatureKey[] }`. This is STATE (re-derivable, idempotent — pending persists until acknowledged, it is NOT a vanishing one-shot), so it is safely cacheable. Core-input read error → 500 (degradation policy: error-as-empty poisons the SWR localStorage cache); missing row → create-on-read default (not an error).
  - [x] `src/app/api/feature-disclosure/acknowledge/route.ts` POST (NEW): auth; body `{ feature: FeatureKey }` (zod, reject unknown keys 400); calls acknowledgeFeature; returns the updated `{ unlocked, pending }` so the client can mutate without a round-trip. force-dynamic.
- [x] Task 5: Client — disclosure hook + intro card + feature gates (AC: 1, 2)
  - [x] `src/lib/hooks/useFeatureDisclosure.ts` (NEW): SWR on `/api/feature-disclosure` (localStorage-cached, keepPreviousData); `DISCLOSURE_KEY` export; returns `{ unlocked, pending, isUnlocked(key), acknowledge(key), isLoading }`. `acknowledge` POSTs then scoped-mutates DISCLOSURE_KEY with the response (revalidate:false) — NOT the inert global mutate (use the hook's own mutate or useSWRConfig().mutate). `isUnlocked` fails OPEN (returns true) while loading/on error — a data-gated feature must not be hidden from an established user by a transient disclosure fetch failure (opposite of 15-6's gamification gate, which hid UI; here hiding a feature the user already earned is the harm).
  - [x] `src/components/dashboard/FeatureIntroCard.tsx` (NEW): renders the SINGLE highest-priority pending intro (cap at ONE at a time — 15-3 toast-cap lesson applied to the card; pick the pending feature with the highest requirement value, deterministic tiebreak by catalog order). Dismissible ("Got it") → `acknowledge(feature)` (optimistic hide). Copy from i18n `disclosure.intro.<key>` + a deep link to `url`. Renders null when no pending intro. Focusable/aria per 15-8 groundwork (announce via the card's heading, not color).
  - [x] Mount FeatureIntroCard in `src/app/dashboard/page.tsx` near the top (after ReengagementSummary / FirstTransactionPrompt, before the stats) — single mount point.
  - [x] Feature gates (NON-REGRESSIVE): add `&& isUnlocked('<key>')` to the existing data-gates of the three intro-target components so they compose as `hasData && (thresholdMet || showAll)`. Established users (usage already past threshold) are unaffected; new users see the feature appear at the milestone. `isUnlocked` fail-open covers the loading window so nothing flashes hidden.
    - SpendingHeatmap → `isUnlocked('heatmap')`; AnnualizedProjections → `isUnlocked('projections')`; SubscriptionGraveyard → `isUnlocked('subscriptions')`. Read each component's CURRENT gate first; add the guard as an additional AND, never replacing the data-gate.
- [x] Task 6: Settings escape hatch (AC: 2)
  - [x] `src/types/user.types.ts`: `disclosure_show_all?: boolean` (default false) with doc comment.
  - [x] `src/app/(dashboard)/settings/page.tsx`: "Show all features" toggle in Preferences (same Switch+FormHelperText pattern as the gamification toggle); state `showAllFeatures` initialized in the profile useEffect (`?? false`); extend the handleUpdatePreferences union with `'disclosure_show_all'`. The GET route reads this pref for `unlocked`/`pending`; flipping it PROFILE_KEY scope-mutates (dashboard/hook see it) — but the disclosure GET must ALSO be revalidated on flip (the show_all input lives server-side): after the pref PUT succeeds, mutate DISCLOSURE_KEY. Wire that.
  - [x] i18n `settings.showAllFeatures` + `settings.showAllFeaturesDescription` (en + bg).
- [x] Task 7: i18n — `disclosure` namespace (en + bg, CI parity): `intro.heatmap` ("You've logged 30 transactions — check out your Spending Heatmap."), `intro.projections`, `intro.subscriptions`, `introDismiss` ("Got it"), card heading. All server/engine copy stays English-in-engine? NO — these are CLIENT UI strings, so they ARE i18n'd (unlike AI-engine text). en + bg parity.
- [x] Task 8: Tests (each names its file; checked boxes REQUIRE the tests to exist — 15-5/15-6 lesson)
  - [x] `src/lib/ai/__tests__/disclosureEngine.test.ts`: below/at/above each threshold; showAll unlocks all + pending empty; pending excludes already-acknowledged; undefined metrics → 0.
  - [x] `src/lib/services/__tests__/featureStateService.test.ts`: create-on-read default; recordFeatureActivity increments tx always + days_active only on a new day (last_active_date < today) + same-day no double-count; acknowledgeFeature idempotent + rejects unknown key. Chain mocks assert `.eq('user_id', …)` (arg-blind stubs let scoping vanish — 3x lesson).
  - [x] `src/app/api/feature-disclosure/__tests__/route.test.ts`: 401 unauth; returns unlocked/pending; show_all pref respected; core-read error → 500 (not error-as-empty). `@jest-environment node` in the FIRST docblock only.
  - [x] `src/app/api/feature-disclosure/acknowledge/__tests__/route.test.ts`: 401; unknown feature → 400; valid ack returns updated pending.
  - [x] tx-route test: recordFeatureActivity called with the day key, non-fatal (a throw doesn't fail the 201). Update the tx test mocks (featureStateService added — stale mocks silently degrade, 15-5 lesson).
  - [x] `src/components/dashboard/__tests__/FeatureIntroCard.test.tsx`: renders the single highest-priority pending intro; renders null when none; dismiss calls acknowledge + optimistically hides; caps at one.
  - [x] Feature-gate tests: for each of the 3 components, "hidden when locked, shown when unlocked (with data)" — mock useFeatureDisclosure; existing suites updated to mock it unlocked (fail-open default) so they keep passing.
  - [x] Settings: "Show all features" toggle renders + flipping PUTs `disclosure_show_all` + revalidates DISCLOSURE_KEY.
- [x] Task 9: Verification — `npx tsc --noEmit`, `npx next lint`, full `npx jest` (baseline 2009 passed / 54 skipped — zero regressions), `npx next build`. Apply migration 039 to prod via MCP + verify column present.

### Review Findings

Triple review 2026-07-21 (all three reviewers completed). 8 unique -> 6 patch (1 HIGH, 3 MED, 2 LOW) / 0 defer / accepted-notes. AC verdict (Acceptance Auditor): all 3 MET; no overclaimed checkboxes. The HIGH was found ONLY by the Edge Case Hunter and is CONFIRMED LIVE in prod (verified via MCP: main account has 136 tx / 65 active days but its user_feature_state counter is 0, so heatmap/projections/subscriptions are hidden right now).

- [x] [Review][Patch][HIGH] Dormant counters never backfilled -> established users LOSE heatmap/projections/subscriptions (regression, LIVE). user_feature_state has been zeroed since Epic 11 (signup insert, never incremented); migration 039 only adds a column. Making the counter authoritative without a backfill hides features every established user already earned (flash-then-hide on cold load via the fail-open->locked transition; locked state then cached by the localStorage SWR provider). Directly falsifies the catalog's "established users already pass" claim. FIX: migration 040 backfills user_feature_state from real transaction history (transactions_count=count(*), days_active=count(DISTINCT date), last_active_date=max(date)) AND pre-populates features_unlocked with already-earned keys so established users get NO intro spam (pending=[]); INSERT..ON CONFLICT so users lacking a row are seeded too; re-run-safe features_unlocked merge. Apply to prod via MCP. [supabase/migrations/040; prod]
- [x] [Review][Patch][MED] last_active_date written unconditionally (moves BACKWARD) -> days_active double-counts / is farmable, and skips. resolveLogDay's ±1 clamp admits yesterday AND tomorrow; alternating today/yesterday logs re-trigger isNewDay on the same real day, inflating days_active toward the projections(14) threshold; a tomorrow-dated log skips the real next day. FIX (bundled with the race below): atomic record_feature_activity RPC using GREATEST(last_active_date, p_today) (forward-only) + conditional days_active. [featureStateService.ts; migration 040]
- [x] [Review][Patch][MED] recordFeatureActivity is a non-atomic read-modify-write -> concurrent tx POSTs lose increments (streakService solved exactly this with CAS; this ignored the pattern). FIX: replace the read+update with an atomic Postgres UPSERT-increment RPC record_feature_activity(p_today date) (INSERT ..(auth.uid(),1,1,p_today) ON CONFLICT DO UPDATE SET count=count+1, days=days+CASE.., last=GREATEST(..)); SECURITY INVOKER + pinned search_path (038); revoke anon/public, grant authenticated+service_role. Also removes the double-createClient LOW. [featureStateService.ts; migration 040]
- [x] [Review][Patch][MED] GET + acknowledge routes SWALLOW the user_profiles prefs-read error -> contradicts the comment promising a 500, can cache an all-locked state for a show-all user. Both destructure only `data`, dropping `error`; a transient prefs error -> showAll=false -> unlocked:[] returned as HTTP 200 and cached. FIX: capture the prefs error and 500 (or treat unknown as the safe default WITHOUT caching-as-truth); align with the degradation-policy comment. [feature-disclosure/route.ts; acknowledge/route.ts]
- [x] [Review][Patch][LOW] pickIntro ranks pending intros by raw requirement.value across INCOMPATIBLE metrics (14 days vs 30/50 tx) -> projections is always lowest-priority purely because 14<30, not for any semantic reason. FIX: rank by explicit catalog/onboarding order, not the numeric threshold. [FeatureIntroCard.tsx]
- [x] [Review][Patch][LOW] Settings test under-asserts its Task-8 claim: verifies the PUT but NOT the DISCLOSURE_KEY revalidation the checkbox claims (the revalidation IS correctly wired at settings/page.tsx). FIX: add the revalidation assertion (mock useSWRConfig().mutate, assert called with DISCLOSURE_KEY). [settings/__tests__/page.test.tsx]
- Accepted / documented (no code change): (a) after the H1 backfill, a genuinely NEW user who crosses two thresholds without visiting the dashboard sees intros sequentially (dismiss -> next), one-at-a-time (15-3 cap holds), no stack — acceptable. (b) recordFeatureActivity is on the tx-POST critical path (awaited per the 15-5 Vercel-freeze lesson); the RPC refactor makes it ONE round-trip (faster than the prior 2-3). (c) days_active backfilled from transaction DATE (user-entered) vs going-forward resolveLogDay (client-local) — both approximate; accepted.
- Verified clean by reviewers: threshold boundary (>=, 29 vs 30), NaN/undefined->0 guard, fail-open composes with data-gates (nothing unearned flashes; only earned features protected from transient-error hiding), acknowledge double trust boundary (zod + isFeatureKey), persist-first ack, i18n en+bg parity, File List 1:1, intro copy verbatim to the AC, rules-of-hooks respected, 15-6 gate untouched, no overclaimed checkboxes.

## Dev Notes

### Architecture & decisions

- **The table already exists but is DORMANT** (migration 011, ADR-022): created at signup (`src/app/page.tsx:172` inserts a zeroed row) with `transactions_count`, `days_active`, `features_unlocked TEXT[]` — but NOTHING updates or reads it today. This story makes it live. It IS in the typed Database schema (unlike goals/gamification) → no generic client cast.
- **Deliverable = the introduction/announcement layer + non-regressive feature gating**, not a rewrite of every feature's appearance. Most Phase-2 features already self-gate on their own data (render null until data exists). 15.7 adds: (a) live usage tracking, (b) a usage-threshold gate composed ON TOP of the data-gate for the three intro-target features, (c) the "brief introduction" card, (d) the settings escape hatch, (e) persistence.
- **NON-REGRESSIVE gating** is the critical constraint: the gate is `hasData && (thresholdMet || showAll)`. Thresholds are set so ESTABLISHED users already pass (a user with 30+ transactions passes the heatmap gate) — so existing users see no change; only genuinely new/low-usage users get the staged reveal. `isUnlocked` FAILS OPEN (true) while the disclosure fetch is loading/errored, so no feature ever flashes hidden for someone who earned it. This is the OPPOSITE fail direction from 15-6's gamification gate (which fails closed/hidden) — because the harms are opposite: hiding gamification-you-opted-out-of is correct, but hiding a data feature you already earned is a regression.
- **One-shot discipline** (15-3 HIGH / 15-4): the "brief introduction" is persisted, not a vanishing event. The GET returns `pending` (unlocked && not-acknowledged) which is RE-DERIVABLE and idempotent — safe to cache. Acknowledgment is persist-FIRST (POST adds to features_unlocked) then the client stops showing it; if the ack fails, the intro re-shows next load (acceptable — never lost, at worst shown twice). No one-shot event rides the cacheable POST/GET envelope.
- **days_active is a logging-days proxy**: incremented in tx POST when last_active_date < today. It does NOT count app-opens without logging — an accepted approximation (a user who never logs has no meaningful "active day" for feature disclosure), and it avoids GET-side-effect writes on a cacheable read. Document this in the service.
- **Degradation policy** (docs/api-conventions.md#Error-Handling): the disclosure GET's core read error → 500 (error-as-empty would poison the SWR localStorage cache AND wrongly hide/lock features); recordFeatureActivity in tx POST → warn+continue (enrichment, never fails the POST).
- **DATE column rule**: last_active_date is a DATE — compare yyyy-MM-dd strings, never new Date()/toISOString (tz misbucket, standing gotcha).
- **NO interaction with 15-6 gamification gate**: the intro targets (heatmap/projections/subscriptions) are AI/data features, not gamification. Independent.

### Existing code being modified (read before writing)

- `src/app/api/transactions/route.ts` POST enrichment (lines ~440-532): runs streak → comeback → achievement enrichment, all non-fatal, on the AUTH-SCOPED `supabase` client, using a computed day key (localDayKey, clamped ±1 to server day). Add recordFeatureActivity alongside, reusing that day key. Envelope is `{ data, nudge, streak, achievements, comeback }` — do NOT add disclosure to it.
- `src/components/ai/SpendingHeatmap.tsx`, `src/components/ai/AnnualizedProjections.tsx`, `src/components/subscriptions/SubscriptionGraveyard.tsx`: each null-gates on its own data today. Read the exact current gate; add `&& isUnlocked('<key>')` as an ADDITIONAL AND (never replace). SubscriptionGraveyard lives in the Insights page, not the dashboard.
- `src/app/(dashboard)/settings/page.tsx`: `handleUpdatePreferences` union + optimistic PROFILE_KEY mutate + PUT + server-truth mutate (8.3 pattern). The gamification toggle (15-6) is the exact template. For show_all, ALSO mutate DISCLOSURE_KEY after the PUT (the disclosure GET reads this pref server-side).
- `src/app/dashboard/page.tsx`: mount FeatureIntroCard near the top (single mount, like ReengagementSummary). The page already reads useUserPreferences.
- `useUserPreferences` DEFAULT_PREFERENCES: add nothing required, but disclosure_show_all defaults false via `?? false` at read sites.

### What must NOT change

- Existing feature data-gates (only ADD the isUnlocked AND).
- tx POST response envelope shape.
- The signup feature-state insert (`app/page.tsx`) — leave it; getFeatureState create-on-read is the backstop for rows that predate/failed it.
- RLS on user_feature_state (035 initplan baseline; owner-only). Migration 039 only adds a column.
- 15-6 gamification gate semantics (orthogonal).
- Standing gotchas: `@jest-environment node` FIRST docblock only; `keyframes` from '@emotion/react'; chain mocks with filter-arg assertions; DATE cols compare yyyy-MM-dd strings.

### Previous story intelligence (15-6 + review)

- A client gate that reads an async pref must pick its fail direction deliberately: 15-6's gamification gate FAILS CLOSED (hide while loading) to avoid flashing opted-out UI; 15.7's disclosure gate FAILS OPEN (show while loading) to avoid hiding earned features. Opposite harms → opposite defaults. Document the choice at the gate.
- Conditional fetch-gating is defeated by imperative useSWRConfig().mutate(KEY,{revalidate:true}) call sites — not relevant here (no new imperative revalidations), but keep DISCLOSURE_KEY out of the AppLayout/pull-to-refresh lists unless intended.
- Task checkboxes are claims — every test named in Task 8 must exist and assert what it claims (15-5 found 3 overclaimed; 15-6 was clean — keep it clean).
- Settings toggle rollback works via profile→useEffect resync (verified 15-6) — reuse the pattern; add the DISCLOSURE_KEY revalidation on top for show_all.
- jest baseline 2009 passed / 54 skipped after 15-6 review (commit 230a2e5).

## Dev Agent Record

### Context Reference

- Ultimate context engine analysis completed - comprehensive developer guide created

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- All 9 tasks implemented. The dormant user_feature_state table (011) is now LIVE: tx POST increments transactions_count (+1/tx) and days_active (+1 per new logging day via last_active_date), non-fatal, reusing the streak's resolved day key. Migration 039 (last_active_date column) applied to prod via MCP + verified.
- Pure disclosureCatalog (heatmap tx>=30 — AC example verbatim; projections days>=14; subscriptions tx>=50) + disclosureEngine.computeDisclosure(state, showAll) -> {unlocked, pending}. pending = unlocked && not-acknowledged && !showAll.
- API: GET /api/feature-disclosure (state, re-derivable/cacheable; core read err -> 500) + POST /acknowledge (zod-guarded FeatureKey, persist-first, returns recomputed disclosure). featureStateService AUTH-SCOPED (owner RLS; table IS typed so no generic cast), create-on-read backstop.
- Client: useFeatureDisclosure (SWR, FAILS OPEN — isUnlocked true while loading/error so an earned feature never flashes hidden; opposite fail-direction from 15-6 by design); FeatureIntroCard (ONE highest-priority pending intro at a time, 15-3 cap; dismiss = optimistic hide + persist-ack; carries own mb, no phantom gap); mounted once on dashboard.
- NON-REGRESSIVE gating: SpendingHeatmap/AnnualizedProjections/SubscriptionGraveyard now compose hasData && (thresholdMet || showAll) via an added `&& isUnlocked(key)` AND — established users (already past threshold) unaffected; new users get the staged reveal.
- Settings: "Show all features" toggle (disclosure_show_all, default false); flip revalidates DISCLOSURE_KEY (pref read server-side by the GET). i18n disclosure namespace + 2 settings keys, en+bg parity (CI-checked).
- Verification: tsc clean (fixed 3 test-only self-referential mock type errors), eslint clean, jest 2044 passed / 54 skipped (baseline 2009 + 35 net new: 8 engine, 11 service, 4+4 routes, 2 tx, 3 card, 3 gate, 2 settings — approx), build green (both /api/feature-disclosure routes in manifest).
- Dev-time refinement vs the spec's (supabase, userId) signature: featureStateService follows the streakService self-contained-client pattern (userId only) — the tx route already composes with that convention.

### File List

**New**
- `supabase/migrations/039_feature_disclosure.sql`
- `supabase/migrations/040_feature_disclosure_backfill.sql` (review: HIGH backfill + atomic RPC)
- `src/lib/ai/disclosureCatalog.ts`, `src/lib/ai/disclosureEngine.ts`
- `src/lib/services/featureStateService.ts`
- `src/app/api/feature-disclosure/route.ts`, `src/app/api/feature-disclosure/acknowledge/route.ts`
- `src/lib/hooks/useFeatureDisclosure.ts`
- `src/components/dashboard/FeatureIntroCard.tsx`
- `src/lib/ai/__tests__/disclosureEngine.test.ts`
- `src/lib/services/__tests__/featureStateService.test.ts`
- `src/app/api/feature-disclosure/__tests__/route.test.ts`
- `src/app/api/feature-disclosure/acknowledge/__tests__/route.test.ts`
- `src/components/dashboard/__tests__/FeatureIntroCard.test.tsx`

**Updated**
- `src/types/database.types.ts` (user_feature_state.last_active_date + DisclosureResponse)
- `src/types/user.types.ts` (+disclosure_show_all)
- `src/app/api/transactions/route.ts` (recordFeatureActivity enrichment, hoisted logDay)
- `src/components/ai/SpendingHeatmap.tsx`, `src/components/ai/AnnualizedProjections.tsx`, `src/components/subscriptions/SubscriptionGraveyard.tsx` (isUnlocked gate)
- `src/app/dashboard/page.tsx` (mount FeatureIntroCard)
- `src/app/(dashboard)/settings/page.tsx` (show-all toggle + DISCLOSURE_KEY revalidate + union)
- `messages/en.json`, `messages/bg.json` (disclosure namespace + 2 settings keys)
- `src/app/api/transactions/__tests__/streak-hook.test.ts` (featureStateService mock + 2 tests)
- `src/components/ai/__tests__/SpendingHeatmap.test.tsx`, `AnnualizedProjections.test.tsx`, `src/components/subscriptions/__tests__/SubscriptionGraveyard.test.tsx` (disclosure mock + locked test)
- `src/app/(dashboard)/settings/__tests__/page.test.tsx` (+show-all toggle tests)

## Change Log

- 2026-07-21: Code review (triple, all completed). 8 unique -> 6 patch (1 HIGH, 3 MED, 2 LOW); ALL applied. HIGH (Edge Case Hunter, CONFIRMED LIVE): the dormant user_feature_state counters were never backfilled, so making them authoritative hid heatmap/projections/subscriptions from every established user -> migration 040 backfills counts + days_active + last_active_date + already-earned features_unlocked from real transaction history (INSERT..ON CONFLICT, re-run-safe merge), APPLIED to prod via MCP + verified (main account 136tx/65d now unlocked+pending=[] so no intro spam; low-usage user correctly still staged). MED: (1)+(2) recordFeatureActivity's non-atomic read-modify-write (lost increments) + unconditional last_active_date write (backward move -> days_active farmable via the +-1 clamp) replaced by an ATOMIC record_feature_activity RPC (UPSERT-increment, GREATEST forward-only date, SECURITY INVOKER + pinned search_path, anon-revoked) in migration 040 (prod-applied+verified); service now forwards the day key, no read. (3) GET + acknowledge routes swallowed the user_profiles prefs-read error (contradicting the degradation-policy 500 comment; could cache an all-locked 200 for a show-all user) -> both now capture the error and 500. LOW: pickIntro ranked by raw requirement.value across incompatible metrics (14 days vs 30/50 tx) -> now ranks by catalog/onboarding order; settings test now asserts the DISCLOSURE_KEY revalidation (delegating swr mock preserving useSWR). Accepted: sequential intro surfacing for a genuinely-new multi-cross user (one-at-a-time, no stack); awaited enrichment now ONE RPC round-trip (faster than the prior 2-3). Verification: tsc clean, lint clean, jest 2044 passed / 54 skipped, build green. Status -> done.
- 2026-07-21: Story 15.7 implemented — progressive feature disclosure (FR37, ADR-022): made the dormant user_feature_state table live (migration 039 + tx-POST activity tracking); pure disclosure catalog/engine; GET+acknowledge API; useFeatureDisclosure (fail-open) + FeatureIntroCard; non-regressive isUnlocked gates on heatmap/projections/subscriptions; settings show-all escape hatch; en/bg i18n. 35 net new tests; tsc/lint clean; jest 2044/54; build green. Status -> review.
- 2026-07-21: Story created (create-story) — dormant feature-state table analysis, ADR-022 thresholds, non-regressive fail-open gating design, one-shot-safe intro persistence; ready-for-dev.
