---
baseline_commit: fccfa0d354b6c3c6c84d71ff0613d3ef3675aaed
---

# Story 15.3: Achievement & Badge System

Status: done

## Story

As a user reaching financial milestones,
I want to unlock achievements and badges through milestones and consistent behavior,
So that I feel a sense of accomplishment and progression.

## Acceptance Criteria

1. **Given** a user performs trackable actions (first transaction, 7-day streak, first goal completed, etc.), **When** a milestone condition is met, **Then** the achievement is unlocked with a visual notification (Chakra toast + badge icon, ~5s auto-dismiss, `aria-live="polite"` — UX feedback-patterns table).
2. **And** badges are displayed on a dedicated achievements view (gallery grid in Settings — UX: "Profile/settings section", responsive 4/3/2 columns, "No new top-level nav items for gamification").
3. **And** each badge shows the unlock date and condition.
4. **And** animations respect `prefers-reduced-motion` (reduced → scale-in only / static badge).
5. Every achievement ties to real financial behavior — UX anti-pattern list forbids "badges without financial meaning".
6. Unlocks are persisted (unlock date is an AC) — exactly-once per user per achievement, idempotent under concurrent evaluation.

## Tasks / Subtasks

- [x] Task 1: Migration 036 `user_achievements` (AC: 3, 6)
  - [x] `supabase/migrations/036_user_achievements.sql`: table `user_achievements` (id uuid pk default uuid_generate_v4(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, achievement_key TEXT NOT NULL CHECK (char_length(achievement_key) BETWEEN 1 AND 50), unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id, achievement_key)).
  - [x] Owner-only flat RLS (SELECT/INSERT; no UPDATE/DELETE policies — unlocks are append-only) + explicit GRANTs (SELECT, INSERT only to authenticated). CRITICAL NEW BASELINE: policies MUST use `(select auth.uid())` — the 2026-07-13 perf pass (migration 035) rewrote all 70 policies to the initplan form; never write bare `auth.uid()` again.
  - [x] User applies manually in the SQL editor (034/035 both confirmed applied; note in completion report).
- [x] Task 2: Catalog + types (AC: 1, 3, 5)
  - [x] `src/types/database.types.ts` (GAMIFICATION section): `AchievementKey` union, `UserAchievement { achievement_key, unlocked_at }`, `AchievementsResponse { achievements: UserAchievement[] }`.
  - [x] `src/lib/ai/achievementCatalog.ts`: typed catalog array `ACHIEVEMENTS: { key: AchievementKey }[]` — exactly these 10 keys (names/conditions live in i18n, NOT here): `first_transaction`, `ten_transactions`, `hundred_transactions`, `week_streak` (7-day), `month_streak` (30-day), `first_budget`, `first_goal`, `goal_reached`, `score_steady` (Budget Score ≥ 50), `score_master` (≥ 90). Export `ACHIEVEMENT_KEYS` for validation.
- [x] Task 3: Pure engine `src/lib/ai/achievementEngine.ts` (AC: 1, 5, 6)
  - [x] `evaluateAchievements(input) → AchievementKey[]` (newly earned only). Input: `{ transactionCount?: number; streak?: StreakState | null; score?: number; hasBudget?: boolean; goals?: Goal[]; alreadyUnlocked: Set<string> }`. Every signal is OPTIONAL — an undefined signal skips its conditions (never treat missing data as 0; degradation policy). Conditions in Dev Notes. Client-import-safe, no DB (streakEngine/budgetScoreEngine precedent). Reuse `isStreakBroken`? NO — streak thresholds read `current_streak` as-is from the POST-advance state (fresh by construction).
- [x] Task 4: Service `src/lib/services/achievementService.ts` (AC: 6)
  - [x] `getUnlocked(userId): Promise<UserAchievement[]>` — AUTH-SCOPED client (owner-only RLS is the gate, exercised in prod — allowanceService/valuesService precedent).
  - [x] `unlockAchievements(userId, keys): Promise<UserAchievement[]>` — validates keys against `ACHIEVEMENT_KEYS` (throw on garbage), inserts auth-scoped with `.upsert(..., { onConflict: 'user_id,achievement_key', ignoreDuplicates: true })` so concurrent evaluation can't double-unlock or error (23505-safe by construction); returns only rows actually inserted (select after upsert or returned rows). Never report unpersisted unlocks (15-1 lesson).
- [x] Task 5: Server evaluation — exactly TWO integration points (AC: 1)
  - [x] `POST /api/transactions` enrichment (non-fatal, concurrent with nudge — 15-1 shape): after the streak promise resolves, count the user's transactions (`select('*', { count: 'exact', head: true }).eq('user_id', user.id)` — cheap, index-only) and run engine with `{ transactionCount, streak: streakResult?.state, alreadyUnlocked }` (fetch unlocked keys first). Response envelope gains `achievements: AchievementKey[]` (ADDITIVE — existing tests assert specific fields, safe). Failures → `logger.warn`, `achievements: []`.
  - [x] `GET /api/gamification/score` enrichment (best-effort): it ALREADY computes score + fetches goals + explicitBudgets — after computing `budgetScore`, run engine with `{ score: budgetScore?.score, hasBudget: explicitBudgets.size > 0, goals, alreadyUnlocked }`; response gains `newlyUnlocked: AchievementKey[]`. Failure → warn + `[]`; NEVER let it break the score (core response unchanged). This covers `first_budget`/`first_goal`/`goal_reached`/`score_*` on the next dashboard load — acceptable per AC (unlock-on-observe; write paths for goals/budgets stay untouched, zero blast radius).
- [x] Task 6: `GET /api/achievements` + hook (AC: 2, 3)
  - [x] Route: auth 401, force-dynamic, returns `{ achievements }` via `getUnlocked`. Missing table (036 unapplied) → warn + `{ achievements: [] }` (degrade like streaks route).
  - [x] `src/lib/hooks/useAchievements.ts`: `ACHIEVEMENTS_KEY = '/api/achievements'`, useStreak SWR shape (keepPreviousData, dedupe 5000).
- [x] Task 7: Toast + gallery UI (AC: 1, 2, 3, 4)
  - [x] `src/lib/hooks/useAchievementToast.ts`: returns `(keys) => void`; Chakra `useToast` — one toast per key, `duration: 5000`, custom render: gold badge (`#D69E2E` = UX `gamification.achievement` token), 🏅 icon, i18n'd name (title) + condition (description); Chakra toasts are `aria-live="polite"` via `role="status"` by default — verify, don't fight it. Respect `usePrefersReducedMotion` — Chakra's built-in toast motion is acceptable under reduced motion? If not controllable, keep default (Chakra handles reduced motion internally since v2 — verify; do NOT hand-roll animation).
  - [x] Wire: dashboard page onSuccess + AppLayout handleSuccess toast `response.achievements` (both already parse the POST response? VERIFY — TransactionEntryModal owns the fetch; check how nudge/streak payloads reach onSuccess. If onSuccess receives no payload, pass the parsed response through TransactionEntryModal's onSuccess callback signature — smallest change wins; 15-1's optimistic-bump pattern shows onSuccess is `() => void`, so extend to `(result?: { achievements?: AchievementKey[] }) => void` with both callers updated). BudgetScoreRing: `useEffect` on `data?.newlyUnlocked` → toast (guard against re-toasting the same payload via a ref).
  - [x] `src/components/settings/AchievementsSection.tsx`: heading + `SimpleGrid columns={{ base: 2, md: 3, lg: 4 }}`; ALL 10 catalog entries always visible — unlocked: gold Badge + 🏅 + i18n name + condition + unlock date (format like other settings dates); locked: grayscale/outline variant + name + condition (motivating, not hidden). `aria-label` per tile ("<name>, unlocked <date>" / "<name>, locked"). Mount in Settings page (ValuesPlanSection precedent). Renders even when empty (locked gallery IS the motivation surface — no progressive-disclosure null gate here, deliberate difference from StreakBadge/Ring).
- [x] Task 8: i18n `achievements` namespace en+bg (AC: 1, 3)
  - [x] Keys: `heading`, `unlockedOn` ("Unlocked {date}"), `locked`, `toastTitle` ("Achievement unlocked!"), per-key `names.<key>` + `conditions.<key>` (10 each). Bulgarian translations complete (CI-enforced parity). Every condition text names the concrete behavior ("Log your first transaction", "Keep a 7-day logging streak"...).
- [x] Task 9: Tests (all ACs)
  - [x] `src/lib/ai/__tests__/achievementEngine.test.ts`: each condition true/false at threshold edges (1/10/100 txns; 7/30 streak; score 50/90 exact), missing signals skip (undefined ≠ 0 — a user with score undefined must NOT lose score achievements they'd earn, nor unlock at 0), alreadyUnlocked filtering, garbage-free output.
  - [x] `src/lib/services/__tests__/achievementService.test.ts`: chain mocks w/ EVERY chained method + arg assertions (`.eq('user_id', …)`, upsert onConflict args); invalid key throws; ignoreDuplicates path returns only new rows.
  - [x] `src/app/api/achievements/__tests__/route.test.ts`: `@jest-environment node` FIRST docblock; 401; rows; degrade on service error → 200 `[]`.
  - [x] UPDATE `src/app/api/transactions/__tests__/streak-hook.test.ts` (or sibling): achievements in 201 envelope; evaluation failure → 201 with `[]`.
  - [x] UPDATE `src/app/api/gamification/score/__tests__/route.test.ts`: `newlyUnlocked` present; enrichment failure leaves score intact.
  - [x] `src/components/settings/__tests__/AchievementsSection.test.tsx`: all 10 tiles, locked vs unlocked states, unlock date shown, aria labels. (Chakra hidden spans — queryByText, never container.firstChild; 15-1 lesson.)
  - [x] Full verification: lint, tsc, `npx jest` (baseline 1857 passed / 54 skipped — additive only), build.

### Review Findings

Triple review 2026-07-13 (Blind Hunter / Edge Case Hunter / Acceptance Auditor): 18 raw -> 13 unique -> 10 patch (1 HIGH, 3 MED, 6 LOW) / 2 defer / 1 dismissed. AC verdict: 5 MET, AC4 PARTIAL (toast slide ignores reduced motion — within the task's pre-authorized fallback, but the recorded verification claim was false).

- [x] [Review][Patch][HIGH] Stale `newlyUnlocked` in the persisted SWR cache re-fires unlock toasts — deterministic duplicate on same-session back-nav (within dedupe window), on next page load (localStorage hydration), and on EVERY offline PWA launch; the object-identity ref guard dies with the component while the cached payload survives — after toasting, rewrite the cached score payload without newlyUnlocked (scoped mutate, revalidate:false) [src/components/dashboard/BudgetScoreRing.tsx; src/lib/hooks/useBudgetScore.ts]
- [x] [Review][Patch][MED] GET /api/achievements converts every read failure into a SUCCESSFUL empty list — a DB blip renders all badges "Locked" and SWR caches the empty list as authoritative (error-as-empty violates the degradation policy; unlocked list IS this endpoint's core) — let it 500 so keepPreviousData holds stale truth [src/app/api/achievements/route.ts + route test]
- [x] [Review][Patch][MED] Retroactive unlock storm — established users get up to 10 stacked toasts on deploy day (5 from first tx POST + 5 from the score revalidation); cap per batch: <=3 individual toasts, else one summary toast with count [src/lib/hooks/useAchievementToast.tsx + i18n toastBatch]
- [x] [Review][Patch][MED] first_goal/goal_reached permanently lost for expired goals (incl. reached ON the deadline day — strict .gt) — unlocks are once-ever but only evaluated against unexpired goals; fetch all own goals once, filter expired IN CODE for the score engine, pass unfiltered to achievement evaluation [src/app/api/gamification/score/route.ts]
- [x] [Review][Patch][MED] Score-route achievement tests assert nothing real — `Array.isArray(newlyUnlocked)` cannot fail (route catch guarantees an array), and the checked-off "enrichment failure leaves score intact" test does not exist; add failure-path + upsert-arg + inserted-row tests [src/app/api/gamification/score/__tests__/route.test.ts]
- [x] [Review][Patch][LOW] English dates inside Bulgarian UI — date-fns format without locale yields "Отключено на Jul 1, 2026" (existing house debt, but new surface) [src/components/settings/AchievementsSection.tsx]
- [x] [Review][Patch][LOW] Any authenticated user can forge achievement rows via PostgREST (INSERT policy + GRANT expose the table; catalog validation lives only in the service; unbounded junk keys possible) — add CHECK (achievement_key IN (catalog)) to 036 + ALTER prod [supabase/migrations/036_user_achievements.sql]
- [x] [Review][Patch][LOW] False reduced-motion verification claim recorded as fact — Chakra's toast has NO reduced-motion branch (package source verified); correct the hook comment + Completion Notes (behavior itself stays within the task's explicit fallback) [src/lib/hooks/useAchievementToast.tsx; Dev Agent Record]
- [x] [Review][Patch][LOW] Duplicate nested role="status" — Chakra's toast wrapper already renders role=status/aria-atomic around custom renders; drop the inner one (double-announce risk) [src/lib/hooks/useAchievementToast.tsx]
- [x] [Review][Patch][LOW] Timezone-dependent gallery test fixture ('...T10:00:00Z' asserted as literal "Jul 1, 2026" breaks at UTC+14/-11) — compute the expectation through the same format() call [src/components/settings/__tests__/AchievementsSection.test.tsx]
- [x] [Review][Patch][LOW] tx-POST evaluation needlessly serial + no all-unlocked short-circuit — start getUnlocked+count concurrent with the streak promise; skip evaluation when all 10 keys are already unlocked [src/app/api/transactions/route.ts]
- [x] [Review][Defer] Score-side celebration swallowed when SCORE_KEY revalidates with no mounted ring (rare focus-revalidation edge; largely self-healing — unmounted keys aren't fetched, next dashboard mount delivers; redelivery story belongs with 15-5/notification surface) — deferred, design gap
- [x] [Review][Defer] Shared-goal contributors never earn first_goal/goal_reached (own-goals scope; only the creator unlocks) — cross-member achievement semantics need a product decision — deferred, product question
- Dismissed (1): savings auto-logged transactions bypass POST so count unlocks arrive on the next manual save (delayed, not lost); delete-undo path drops the envelope (no celebration on undo — acceptable).

## Dev Notes

### Catalog conditions (the engine implements exactly this; all thresholds inclusive)

| key | condition (signal) | notes |
|---|---|---|
| first_transaction | transactionCount ≥ 1 | |
| ten_transactions | transactionCount ≥ 10 | |
| hundred_transactions | transactionCount ≥ 100 | |
| week_streak | streak.current_streak ≥ 7 | streak null → skip |
| month_streak | streak.current_streak ≥ 30 | |
| first_budget | hasBudget === true | explicit budgets only (ADR-025 source) |
| first_goal | goals.length ≥ 1 | goals = own unexpired (score route's query) |
| goal_reached | any goal with target_amount > 0 AND current_amount ≥ target_amount | ÷0 guard like budgetScoreEngine |
| score_steady | score ≥ 50 | score undefined → skip (NOT 0) |
| score_master | score ≥ 90 | |

Engine returns keys where condition true AND key ∉ alreadyUnlocked, in catalog order. `undefined` signal ⇒ its rows are skipped entirely (unknowable ≠ false — the 15-2 HIGH lesson applied at engine level).

### Data-model decision (documented ADR-012 deviation — the 15-1/15-2 precedent)

ADR-012 prescribes an `achievements` definitions table ("add achievements without code changes"). This story keeps definitions in a typed CODE catalog and persists ONLY unlocks (`user_achievements`), because: (1) unlock CONDITIONS are code regardless — a DB row can't evaluate "7-day streak", so a definitions table adds a join without removing a deploy; (2) names/conditions must ship en+bg via the CI-enforced i18n pipeline — DB definitions would bypass it; (3) pure-engine testability is the house standard (Epic-12 → 15-2). Reviewers: audit against THIS story.

### Delivery decision — two server evaluation points, zero new write paths

- **tx POST** already orchestrates non-fatal enrichments (insight → nudge → streak, 15-1). Achievements slot in AFTER `streakResult` resolves (needs the advanced streak). The response envelope (`{ data, nudge, streak }` at src/app/api/transactions/route.ts:447) gains `achievements` — additive.
- **score GET** already has score + goals + explicitBudgets in hand — evaluating there costs one `getUnlocked` read + optional upsert, and covers every non-transaction achievement on the next dashboard visit. Do NOT touch goals/budgets write routes (blast-radius control; "unlock on next observation" satisfies AC #1's toast because the dashboard loads the score immediately after those actions anyway via revalidation).
- Unlock persistence is idempotent (`upsert ignoreDuplicates` on the UNIQUE constraint) — concurrent tx POST + score GET can both evaluate safely; only one wins each key and only the winner reports it as new.

### RLS recipe (changed since 15-1 — do not copy 034 verbatim!)

Migration 035 (perf pass 2026-07-13) established the initplan baseline. Policies for 036:
```sql
CREATE POLICY "Users can view their own achievements" ON user_achievements
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert their own achievements" ON user_achievements
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
```
No UPDATE/DELETE policies (append-only unlocks). Explicit `GRANT SELECT, INSERT ON user_achievements TO authenticated;` + `GRANT ALL ... TO service_role;` (CLI ≥2.106 lesson).

### Reuse map — do NOT reinvent

| Need | Use | From |
|---|---|---|
| enrichment orchestration shape | streak hook in tx POST | `src/app/api/transactions/route.ts:397-449` |
| auth-scoped owner-only service | allowanceService / valuesService | `src/lib/services/` |
| SWR hook shape | useStreak / useBudgetScore | `src/lib/hooks/` |
| settings section mount | ValuesPlanSection | `src/components/values/`, settings page |
| score-route inputs (goals/budgets/score) | existing fetches | `src/app/api/gamification/score/route.ts` |
| toast styling token | gold `#D69E2E` | UX spec line 285/407 |

### What NOT to do (scope guards)

- NO push notification on unlock (15-5 owns push; ADR-018 category "milestone" comes later).
- NO comeback/Phoenix badge (15-4), NO opt-out gate (15-6 gates the mount points later), NO achievements nav item (UX forbids).
- NO definitions table, NO cron (deviations documented above).
- NO evaluation inside goals/budgets write routes (covered via score GET; keep blast radius at two files).
- Engine emits keys only — ALL text via i18n in components.
- Do NOT modify streakEngine/budgetScoreEngine/streakService — read-only consumers.

### Previous story intelligence (15-1, 15-2 + reviews; perf pass fccfa0d)

- Envelope additions to tx POST are proven additive-safe (15-1 added `streak`).
- **Global SWR `mutate` is INERT** under the localStorage provider — any new revalidation goes through `useSWRConfig().mutate` (dashboard + AppLayout both already converted). The gallery lives in Settings and reads on mount — no revalidation wiring needed beyond the SWR hook itself; ACHIEVEMENTS_KEY does NOT need to join the dashboard lists (toasts carry the immediate feedback; the gallery revalidates on focus).
- Chain mocks: EVERY chained method + arg assertions (`upsert` args included); `@jest-environment node` FIRST docblock only.
- `keyframes` from `@emotion/react`, never `@chakra-ui/react` (jest re-export gotcha) — relevant only if hand-animating (don't).
- Unknowable ≠ zero (15-2 HIGH): missing engine signals skip conditions.
- Degradation policy (docs/api-conventions.md#degradation-policy): achievements are ENRICHMENT everywhere — warn + empty, never 500 the host route, never fabricate.
- Server-clock read-path boundaries are a KNOWN deferred class — achievement thresholds are count/threshold-based (no date math), keep it that way.
- jest baseline: **1857 passed / 54 skipped** (commit fccfa0d). Additive only.
- Migrations 034 + 035 confirmed applied in prod; 036 will need manual SQL-editor apply (or MCP execute_sql when connected) — routes must degrade until then (Task 6).

### Project Structure Notes

- Engine + catalog in `src/lib/ai/` beside streakEngine/budgetScoreEngine (established gamification-engine home; architecture's `gamification/` area maps to `/api/gamification/` server-side — but `/api/achievements` matches the existing flat REST style like `/api/streaks`; keep `/api/achievements`).
- Component in `src/components/settings/` (new dir OK if settings sections live elsewhere — VERIFY where ValuesPlanSection sits and co-locate).
- i18n namespace `achievements` top-level like `streaks`/`score`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-15.3 (FR30)]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-012 (deviation documented), #ADR-020 (hooks/reduced-motion), #ADR-018 (push is 15-5)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — feedback table line 899 (toast+badge, 5s), a11y line 480 (aria-live polite, scale-in), gallery line 454 (4/3/2 grid), placement line 517 (settings section), nav line 462 (no new nav), gold token lines 285/407, anti-pattern line 222 (financial meaning)]
- [Source: docs/api-conventions.md#degradation-policy]
- [Source: _bmad-output/implementation-artifacts/15-2-budget-score.md (review lessons), 15-1-logging-streaks-with-streak-freeze.md (enrichment shape)]

## Dev Agent Record

### Agent Model Used

claude-fable-5

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- All 9 tasks implemented. Pure achievementEngine (10-key catalog, exported thresholds, undefined signals SKIP conditions — unknowable ≠ 0); achievementService auth-scoped w/ idempotent `upsert(onConflict user_id,achievement_key, ignoreDuplicates)` returning only actually-inserted rows; user_achievements NOT in typed schema → generic SupabaseClient cast (13-9 gotcha, hit again at tsc time).
- Two server evaluation points as designed: tx POST (count via head:true + post-advance streak; `achievements` in the 201 envelope) and score GET (score/hasBudget/goals; `newlyUnlocked` in the response; errored inputs passed as undefined so achievements are never judged from degraded data). Both non-fatal per degradation policy.
- IMPLEMENTATION SIMPLIFICATION vs Task 7's suggested onSuccess extension: TransactionEntryModal already owns the parsed POST response (it surfaces nudges) — the achievement toast fires from INSIDE the modal, covering BOTH mount points (dashboard modal + AppLayout quick-add) with zero onSuccess signature changes.
- useAchievementToast is a .tsx file (renders JSX in toast render prop) — gold #D69E2E chrome, 5s; Chakra's toast wrapper provides the polite live region. CORRECTED IN REVIEW: Chakra v2's toast has NO reduced-motion branch (package source verified) — the slide-in ignores prefers-reduced-motion; kept per the task's explicit fallback authorization, claim corrected. BudgetScoreRing toasts score-side unlocks and SCRUBS newlyUnlocked from the cached payload after toasting (review HIGH — the persisted SWR cache replayed celebrations on back-nav/next-launch/offline launches; a ref alone only survives one mount).
- AchievementsSection uses date-fns format (NOT next-intl useFormatter — the settings page suite's global next-intl mock lacks it and house style is date-fns; caught by the settings page tests, 14 failures fixed by switching).
- Verification: tsc clean, eslint clean, jest 1896 passed / 54 skipped (baseline 1857 + 39 new: 24 engine, 7 service, 3 achievements route, 3 tx-envelope, 2 component), production build green (/api/achievements in manifest).
- ⚠️ Migration 036_user_achievements.sql needs manual apply (SQL editor or MCP) — until then unlocks fail non-fatally and the gallery shows everything locked.

### File List

**New**
- `supabase/migrations/036_user_achievements.sql`
- `src/lib/ai/achievementCatalog.ts`
- `src/lib/ai/achievementEngine.ts`
- `src/lib/ai/__tests__/achievementEngine.test.ts`
- `src/lib/services/achievementService.ts`
- `src/lib/services/__tests__/achievementService.test.ts`
- `src/app/api/achievements/route.ts`
- `src/app/api/achievements/__tests__/route.test.ts`
- `src/lib/hooks/useAchievements.ts`
- `src/lib/hooks/useAchievementToast.tsx`
- `src/components/settings/AchievementsSection.tsx`
- `src/components/settings/__tests__/AchievementsSection.test.tsx`

**Updated**
- `src/types/database.types.ts` (AchievementKey/UserAchievement/AchievementsResponse + newlyUnlocked on BudgetScoreResponse)
- `src/app/api/transactions/route.ts` (achievement enrichment + `achievements` in 201 envelope)
- `src/app/api/gamification/score/route.ts` (score-side evaluation + `newlyUnlocked`)
- `src/components/transactions/TransactionEntryModal.tsx` (achievement toasts from the parsed response)
- `src/components/dashboard/BudgetScoreRing.tsx` (newlyUnlocked toast effect w/ ref guard)
- `src/app/(dashboard)/settings/page.tsx` (AchievementsSection mount)
- `messages/en.json`, `messages/bg.json` (`achievements` namespace)
- `src/app/api/transactions/__tests__/streak-hook.test.ts` (achievement envelope + non-fatal cases)
- `src/app/api/gamification/score/__tests__/route.test.ts` (newlyUnlocked + chain stub upsert/order)

### Change Log

- 2026-07-13: Story 15.3 implemented — achievement & badge system (FR30): migration 036 user_achievements (append-only owner-only RLS in the (select auth.uid()) initplan form, UNIQUE(user_id,key)); 10-key code catalog + pure achievementEngine (documented ADR-012 deviation — definitions in code for i18n + testability); idempotent unlock upserts; two server evaluation points (tx POST envelope `achievements`, score GET `newlyUnlocked`); gold toast celebrations (5s, role=status) fired from TransactionEntryModal (single wiring point for both mount points) + BudgetScoreRing; AchievementsSection gallery in Settings (2/3/4-col grid, locked tiles show conditions as motivation, unlock dates on unlocked); en/bg `achievements` namespace; 39 new tests. lint/tsc clean; jest 1896 passed / 54 skipped; build green. Status → review.
- 2026-07-13: Triple code review (blind hunter / edge case hunter / acceptance auditor): 18 raw → 13 unique → 10 patch (1 HIGH, 3 MED, 6 LOW) / 2 defer / 1 dismissed; user chose apply-all. Patches: HIGH — newlyUnlocked scrubbed from the cached score payload after toasting (persisted SWR cache replayed unlock toasts on back-nav, next launch, and every offline launch; object-identity ref guard dies with the mount); GET /api/achievements now 500s on read failure instead of returning an authoritative empty gallery that SWR caches (error-as-empty violated degradation policy; empty-vs-error split-tested); toast batch cap — >3 keys collapse into one summary toast (deploy-day backfill storm: up to 10 stacked toasts for established users; toastBatch i18n en/bg); score route fetches ALL own goals and filters actives IN CODE for the score factor while achievements see expired goals too (goals reached on/after their deadline day permanently forfeited first_goal/goal_reached — unlocks are once-ever); real score-route enrichment tests added (upsert args, inserted-row reflection, expired-goal discrimination, failure-leaves-score-intact — the checked-off test that did not exist); locale-aware unlock dates (date-fns bg locale — "Отключено на Jul 1, 2026" was mixed-language); catalog CHECK constraint added to 036 + ALTERed onto prod via MCP (REST-exposed INSERT let users self-award badges/insert junk keys); false "Chakra handles reduced motion" verification claim corrected in hook comment + Completion Notes (AC4 stays within the task's authorized fallback); duplicate inner role="status" dropped (Chakra wrapper already provides the live region); tz-safe gallery test expectation (computed through the same format path); tx-POST prereq fetches start concurrent with the streak promise + all-unlocked short-circuit (was a needless serial hop, catch attached at creation to avoid unhandled-rejection window). Deferred: unmounted-ring celebration redelivery (self-healing, 15-5 territory); shared-goal contributor achievements (product decision). Migrations 036 + catalog CHECK CONFIRMED APPLIED to prod via MCP. jest 1900 passed / 54 skipped; lint/tsc/build green. Status → done.
