---
baseline_commit: 03494cf2c19294fe23597fcd399c322b30bbdb7c
---

# Story 15.2: Budget Score

Status: done

## Story

As a user tracking financial health,
I want to view a Budget Score (0-100) reflecting my financial health with levels and progression,
So that I have a single metric showing how well I'm managing money.

## Acceptance Criteria

1. **Given** a user has budget categories and transaction history, **When** they view their Budget Score, **Then** a score from 0-100 is displayed based on: budget adherence, logging consistency, and goal progress.
2. **And** the score includes a level/tier (Beginner / Building / Steady / Strong / Master).
3. **And** the user can see which factors are helping or hurting their score (per-factor breakdown with helping/hurting/neutral/unscored status).
4. **And** the score updates after each transaction (SWR revalidation of the score key in the tx-save onSuccess path — same mechanism as every other dashboard card; no cron, no write-path recalc).
5. Budget adherence MUST be resolved through `resolveBudget` (ADR-025) — never an inline explicit-vs-average choice (Epic-14 retro action, recorded in MEMORY: "15-2 Budget Score 'budget adherence' must read budgetResolver (ADR-025), NOT an average proxy").
6. Progressive disclosure: users with no transaction history at all see nothing (`hasData: false` → component renders null — ValuesSpendingCard/AnnualizedProjections precedent).

## Tasks / Subtasks

- [x] Task 1: Types (AC: 1, 2, 3)
  - [x] Add to `src/types/database.types.ts` (GAMIFICATION section from 15-1): `ScoreFactorKey = 'adherence' | 'consistency' | 'goals'`, `ScoreFactorStatus = 'helping' | 'hurting' | 'neutral' | 'unscored'`, `ScoreFactor { key, earned, max, status }`, `BudgetScoreLevel = 'beginner' | 'building' | 'steady' | 'strong' | 'master'`, `BudgetScore { score, level, factors }`, `BudgetScoreResponse { hasData: boolean; budgetScore: BudgetScore | null }`.
- [x] Task 2: Pure engine `src/lib/ai/budgetScoreEngine.ts` (AC: 1, 2, 3, 5)
  - [x] `computeBudgetScore(input)` implementing EXACTLY the deterministic model in Dev Notes (weights 50/30/20, renormalization over scored factors, level bands, factor statuses).
  - [x] Client-import-safe: no DB, no node APIs, no currency formatting (Epic-12/whatIfEngine/streakEngine precedent). Reuses `resolveBudget` from `@/lib/ai/budgetResolver` (pure module — safe import).
- [x] Task 3: API route `src/app/api/gamification/score/route.ts` — GET only (AC: 1, 4, 5, 6)
  - [x] Auth via `supabase.auth.getUser()`, 401 on missing; `export const dynamic = 'force-dynamic'; export const revalidate = 0;`.
  - [x] Parallel queries (mirror `/api/dashboard/budget-forecast` shapes EXACTLY — see Dev Notes "Data scope"): current-month own expense txns, prior-3-months own expense txns, own categories, own monthly personal `category_budgets`, own goals (unexpired: `deadline IS NULL OR deadline > todayKey` — 14-3 lesson: filter server-side), streak row via `getStreak(user.id)` from streakService.
  - [x] Degradation per docs/api-conventions.md#degradation-policy: core inputs (transactions, categories) error → 500; `category_budgets` error → warn + treat as no explicit budgets (forecast-route precedent, migration 032 may be unapplied); `streaks` error → warn + null (034 may be unapplied); `goals` error → warn + empty. Empty results ≠ errors.
  - [x] `hasData: false` short-circuit when the user has zero transactions in the 4-month window AND no streak row AND no goals.
- [x] Task 4: `src/lib/hooks/useBudgetScore.ts` (AC: 4)
  - [x] `export const SCORE_KEY = '/api/gamification/score'`; useSWR with `keepPreviousData: true`, `dedupingInterval: 5000` (useStreak shape). localStorage SWR provider gives instant repaint.
- [x] Task 5: `src/components/dashboard/BudgetScoreRing.tsx` (AC: 1, 2, 3, 6)
  - [x] Chakra `CircularProgress` (120px, `size="120px"`, thickness ~8px) + centered score `Text` (large, mono, 700) + level `Badge`. Ring color steps by level (green.400 → green.500 → teal.500 → blue.500 → blue.600 approximating the UX gradient; do NOT burn time on SVG gradient hacks).
  - [x] Renders null until `data?.budgetScore` exists or when `hasData === false` (no skeleton flash — BudgetHealthCard precedent).
  - [x] Breakdown on click/Enter/Space: Chakra `Popover` listing the three factors — name, earned/max, status tag (helping = green, hurting = red, neutral = gray, unscored = gray outline with an unlock hint like "Set a budget to score this").
  - [x] A11y (UX-mandated): trigger is a real button-like focusable, `aria-label` = i18n'd "Budget Score: {score} out of 100, level {level}"; `aria-live="polite"` region for score changes; level-up pulse animation ONLY when `usePrefersReducedMotion()` is false (Chakra hook).
- [x] Task 6: Dashboard integration (AC: 4, 6)
  - [x] Mount `BudgetScoreRing` on `src/app/dashboard/page.tsx` beside/near BudgetHealthCard. SINGLE mount point (15-6 opt-out will gate exactly this component — StreakBadge precedent).
  - [x] Add `SCORE_KEY` mutate to BOTH revalidation lists (pull-to-refresh AND tx-modal onSuccess). CRITICAL: the page already uses `useSWRConfig().mutate` — use that scoped `mutate`; NEVER `import { mutate } from 'swr'` (global mutate is INERT under the localStorage provider — proven in 15-1 review, HIGH).
- [x] Task 7: i18n `messages/en.json` + `messages/bg.json` — new `score` namespace (AC: 2, 3)
  - [x] Keys: `ariaLabel` ("Budget Score: {score} out of 100, level {level}"), `levels.beginner|building|steady|strong|master`, `factors.adherence|consistency|goals`, `status.helping|hurting|neutral|unscored`, unlock hints `hint.adherence|goals`, breakdown title. en/bg parity (CI-enforced). Numbers stay numbers — no engine-side text.
- [x] Task 8: Tests (all ACs)
  - [x] `src/lib/ai/__tests__/budgetScoreEngine.test.ts`: weight caps, renormalization (each factor-missing combination), month-progress floor, broken-streak zeroing, level band edges (0/24/25/49/50/74/75/89/90/100), factor status edges (40%/70%), projected-ratio clamp, no-inputs → null.
  - [x] `src/app/api/gamification/score/__tests__/route.test.ts`: `@jest-environment node` in the FIRST docblock (only place it works); chain mocks include EVERY chained method (`select/eq/is/gte/lte/lt/or/maybeSingle`) AND assert filter args (`.eq('user_id', …)` etc.) — arg-blind stubs let user-scoping vanish silently (14-4/15-1 lesson); degradation cases (budgets error → still 200, streaks error → still 200, transactions error → 500); hasData:false case.
  - [x] `src/components/dashboard/__tests__/BudgetScoreRing.test.tsx`: null gates (no data / hasData false), score + level render, aria-label, breakdown opens with factor statuses, unscored hint shown. Chakra renders hidden spans — query with `queryByText`/`getByLabelText`, never `container.firstChild` null-checks (15-1 lesson).
  - [x] Full verification: lint, type-check, `npx jest` (baseline 1808 passed / 54 skipped — additive only), build.

### Review Findings

Triple review 2026-07-13 (Blind Hunter / Edge Case Hunter / Acceptance Auditor): 15 raw -> 13 unique -> 1 decision-needed / 9 patch / 1 defer / 2 dismissed.

- [x] [Review][Decision] Adherence pace projection punishes on-budget lumpy spending — rent paid on the 1st scores 0 adherence for ~2/3 of the month (projected = spent/monthProgress overshoots any front-loaded category); model choice needed: score actual MTD spend vs budget, floor the pace sub-score while actual <= budget, or keep spec'd projection [src/lib/ai/budgetScoreEngine.ts adherenceEarned] — RESOLVED: score actual MTD spend vs budget (user decision 2026-07-13)
- [x] [Review][Patch][HIGH] Streaks-table-unavailable zero-fills consistency as scored 0/30 "Hurting" — infra failure punishes the score and shows a false "hurting" tag; degradation policy says unknowable -> unscored; route must distinguish getStreak error (streakUnavailable) from no-row; route test enshrines the wrong behavior [src/app/api/gamification/score/route.ts:92; src/lib/ai/budgetScoreEngine.ts consistencyEarned]
- [x] [Review][Patch][MED] Zero-MTD-spend budgeted categories earn automatic perfect 1.0 sub-scores — dormant/seasonal categories inflate adherence (9 dormant + 1 blown 3x over = 45/50 "Helping"); forecastEngine precedent skips spentSoFar === 0 [src/lib/ai/budgetScoreEngine.ts adherenceEarned]
- [x] [Review][Patch][MED] AppLayout mobile quick-add onSuccess never revalidates SCORE_KEY (nor STREAK_KEY, 15-1 gap) — AC4 "updates after each transaction" fails on the primary mobile entry point; modal close fires no focus event [src/components/layout/AppLayout.tsx handleSuccess]
- [x] [Review][Patch][LOW] Score sums display-rounded factor earned values and status derives from raw while earned displays rounded — up to ~0.5-pt drift can flip a level band edge; popover can show 35/50 with a non-helping tag at the 70% threshold [src/lib/ai/budgetScoreEngine.ts computeBudgetScore]
- [x] [Review][Patch][LOW] hasAnyActivity gate contradicts the docstring "returns null when NO factor is scored" — explicit budget set + zero txns computes a scored adherence yet returns null [src/lib/ai/budgetScoreEngine.ts computeBudgetScore]
- [x] [Review][Patch][LOW] Level-drop within 1.2s of a level-up leaves justLeveledUp stuck true — the next genuine level-up pulse never plays (animation string never changes) [src/components/dashboard/BudgetScoreRing.tsx level-up effect]
- [x] [Review][Patch][LOW] Route tests never assert the date-window args (gte/lte/lt) — swapping/deleting month bounds passes every test; the header claims args are recorded so filters can't vanish [src/app/api/gamification/score/__tests__/route.test.ts]
- [x] [Review][Patch][LOW] Route-test STREAK fixture mixes a real-clock last_log_date with impossible frozen last_log_week '2026-W99' — internally inconsistent state the system can never produce [src/app/api/gamification/score/__tests__/route.test.ts]
- [x] [Review][Patch][LOW] Renormalization test coverage misses the {adherence unscored, consistency+goals scored} score assertion [src/lib/ai/__tests__/budgetScoreEngine.test.ts]
- [x] [Review][Defer] Server-clock day/month boundaries (month windows, goal deadline .gt cutoff, isStreakBroken server-day vs client-day badge split-brain for far-tz users) — pre-existing server-clock class shared by every dashboard month-window route; 15-1 explicitly ruled "do NOT invent a tz parameter"; revisit app-wide — deferred, pre-existing
- Dismissed (2): current_streak<=0 guard in consistencyEarned (defensive hardening of an unreachable state, no behavior change); maybeSingle absent from route-test chain stub (route never chains it — getStreak is service-mocked).

## Dev Notes

### Score model (deterministic — the engine implements exactly this)

Weights: **adherence 50, consistency 30, goals 20**. Each factor is either *scored* (earned 0..max) or *unscored* (its inputs don't exist yet). Final score = `Math.round((Σ earned of scored) / (Σ max of scored) × 100)`, clamped 0-100. If NO factor is scored → `budgetScore: null` (route pairs it with `hasData: false`). Renormalization means a goalless user with perfect adherence + consistency can still reach 100 — having no goals must not punish (no-guilt UX principle).

- **Budget adherence (max 50, unscored when no ACTIVE category has a resolvable budget):**
  For each own expense category, resolve budget via `resolveBudget({ explicitLimit, threeMonthAverage })` (ADR-025). `threeMonthAverage` = `fixedWindowMonthlyAverage` from `@/lib/ai/spendingAnalysis` over the prior-3-months txns (÷3 fixed window — Epic-14 retro; consumers already: nudges, forecasts, what-if, recovery). Skip categories where resolved amount ≤ 0 (0 = "no baseline" to every consumer — ADR-025) AND categories with zero MTD spend (forecastEngine precedent — review patch: dormant categories must not hand out free perfect sub-scores).
  Per active category: `ratio = spentMTD / budget`; sub-score = 1 while ratio ≤ 1, 0 at ≥ 1.5, linear between. [REVISED in review 2026-07-13 — was a pace projection (spent ÷ monthProgress), which scored on-budget lumpy spending (rent on the 1st) as 0/"Hurting" for most of the month; decision: score ACTUAL spend, early warning stays the job of nudges + BudgetForecast.]
  Factor earned = mean(sub-scores) × 50. Zero active budgeted categories → unscored.
- **Consistency (max 30, scored whenever streak state was READABLE and the user has logged before — absence of logging is knowable; an unreadable streaks table is UNKNOWABLE → unscored, review patch HIGH):**
  From the streaks row (15-1). If row is null OR `isStreakBroken(state, localDayKey(new Date()))` → earned 0 (a dead streak MUST NOT score — same invariant as the badge hiding dead streaks; import both helpers from `@/lib/ai/streakEngine`).
  Else earned = `min(current_streak, 30) / 30 × 20 + min(weekly_streak, 8) / 8 × 10`.
- **Goal progress (max 20, unscored when the user has no active goals):**
  Active = `deadline IS NULL OR deadline > todayKey` (14-3 lesson: expired goals filtered SERVER-side in the query, never client-side). Per goal: `min(current_amount / target_amount, 1)` (target_amount > 0 is DB-enforced; still guard ÷0 → skip). Factor earned = mean × 20.

**Levels (bands inclusive):** 0-24 `beginner`, 25-49 `building`, 50-74 `steady`, 75-89 `strong`, 90-100 `master`. Anchors from PRD: "Level 1: Budget Beginner" at start, score 34 after 3 weeks (→ building), UX aria example "72 … level Steady" (→ steady band 50-74). ✓

**Factor status:** scored factors — `helping` when earned ≥ 70% of max, `hurting` when < 40%, else `neutral`; unscored factors → `unscored`. These thresholds are engine constants, exported for tests.

**Engine input (assembled by the route, engine stays pure):**
```ts
interface BudgetScoreInput {
  currentMonthTransactions: Transaction[]; // own, expense, MTD
  historicalTransactions: Transaction[];   // own, expense, prior 3 months
  categories: Category[];                  // own
  explicitBudgets: Map<string, number>;    // category_id -> limit_amount (may be empty)
  goals: Goal[];                           // own, unexpired
  streak: StreakState | null;
  today: Date;
}
```

### Persistence decision (documented deviation, like 15-1's no-cron)

ADR-012 prescribes a `budget_scores` table with recalc-on-transaction-change. This story ships **NO migration and no persisted score**: the score is a pure read-time computation (Epic-12 engine pattern), and "updates after each transaction" (AC #4) is delivered by SWR revalidation of `SCORE_KEY` in the existing tx-save onSuccess path — identical freshness to every other dashboard card, zero write-path coupling. 15-1 set this precedent by dropping ADR-012's daily cron. Persisted score history becomes a migration only when a story actually needs trends (15-3 achievements evaluate live values at unlock time). Reviewers: audit against THIS story's ACs.

### Data scope (deliberate, pre-empting the 14-4 "RLS-visible" gotcha)

Mirror `/api/dashboard/budget-forecast` EXACTLY: own transactions (`.eq('user_id', user.id)`, `type='expense'`), own categories (`.eq('user_id')`), own personal monthly budgets (`.eq('user_id').eq('period','monthly').is('household_id', null)`). The what-if route deliberately widened to RLS-visible categories (shared-category spend), but the score's adherence factor MUST agree with BudgetHealthCard + BudgetForecast, which are own-scoped — if the score used a wider scope, the breakdown would call a category "hurting" that the Budget Health card shows as fine. Personal score = personal scope. Goals: own goals `.eq('user_id', user.id)` (personal + own-created shared) — household members' shared-goal progress is /household's concern (13-9), not the personal score.

### Date handling (house rules — reviewers WILL hunt these)

- Month window keys via `toLocalISODate` (`@/lib/utils/date`) exactly as budget-forecast route lines 42-47 (currentMonthStart/currentMonthEnd/threeMonthsAgo with `AVERAGE_WINDOW_MONTHS`).
- DATE columns compare as `YYYY-MM-DD` strings — never `toISOString()` (UTC shifts the 1st in non-UTC tz), never `new Date('YYYY-MM-DD')` parsing (UTC midnight misbucket).
- `todayKey` for goal-deadline + streak-broken checks = `localDayKey(new Date())` from streakEngine.
- `daysInMonth` = `new Date(y, m + 1, 0).getDate()` (local, no UTC).

### Reuse map — do NOT reinvent (all of these exist)

| Need | Use | From |
|---|---|---|
| explicit-vs-average budget | `resolveBudget` | `@/lib/ai/budgetResolver` (ADR-025, the ONLY chooser) |
| 3-month category averages | `fixedWindowMonthlyAverage`, `AVERAGE_WINDOW_MONTHS` | `@/lib/ai/spendingAnalysis` |
| streak state + validity | `getStreak` (service), `isStreakBroken`, `localDayKey` | `@/lib/services/streakService`, `@/lib/ai/streakEngine` |
| query shapes | budget-forecast route | `src/app/api/dashboard/budget-forecast/route.ts:50-79` |
| SWR hook shape | `useStreak` | `src/lib/hooks/useStreak.ts` |
| null-until-ready card | BudgetHealthCard / ValuesSpendingCard | `src/components/dashboard/` |
| degradation rules | decision table | `docs/api-conventions.md#degradation-policy` (CITE in code comments) |

### Files to touch

- UPDATE `src/types/database.types.ts` (GAMIFICATION section — append score types)
- NEW `src/lib/ai/budgetScoreEngine.ts`
- NEW `src/app/api/gamification/score/route.ts`
- NEW `src/lib/hooks/useBudgetScore.ts`
- NEW `src/components/dashboard/BudgetScoreRing.tsx`
- UPDATE `src/app/dashboard/page.tsx` (mount + 2 revalidation lists, scoped mutate ONLY)
- UPDATE `messages/en.json`, `messages/bg.json` (`score` namespace)
- NEW tests: engine, route, component (paths in Task 8)

### What NOT to do (scope guards)

- NO migration, NO `budget_scores` table (see Persistence decision).
- NO header/mini ring variants (UX lists them; consuming stories add them — this story ships the 120px dashboard variant only).
- NO push notification on level-up (15-5's job), NO achievement hooks (15-3), NO opt-out gate (15-6 gates the mount point later).
- NO score text generated in the engine — the engine returns numbers/enums; ALL user-facing text is i18n keys in the component (14-2 values pattern; unlike insight engines, nothing here is free-form prose).
- Do NOT modify streakService, budgetResolver, or spendingAnalysis — read-only consumers.

### Previous story intelligence (15-1 + its review, commits 9971239 + 03494cf)

- **Global SWR `mutate` is INERT under the app's localStorage cache provider** (proven empirically in 15-1 review). Dashboard page already holds `const { mutate } = useSWRConfig()` — add SCORE_KEY lines to the two existing lists; touch nothing else.
- Chain mocks must include every chained method AND record args; missing `.is`/`.lte`/`.gt`/`.or` caused false 500s three times in Epics 14-15. The score route uses `.or()` for the goal deadline filter — the stub MUST chain `.or`.
- `@jest-environment node` works ONLY in the FIRST docblock of the file.
- Degradation policy is settled law: enrichment failure → warn + null, never fabricate, never zero-fill partial data; core failure → 500. The score route's ONLY core inputs are transactions + categories.
- Engines: pure, deterministic, client-import-safe; exported threshold constants make tests non-magic.
- Chakra test gotcha: ChakraProvider renders hidden spans — never assert `container.firstChild` is null; use `queryByText`.
- jest baseline at 15-1 close: **1808 passed / 54 skipped** (commit 03494cf). This story only adds.
- Migration 034 (streaks) may not be applied in prod yet — the score route must survive a missing streaks table (getStreak throws → warn + streak:null → consistency earns 0). This is REAL, not theoretical.

### Project Structure Notes

- First file under `src/app/api/gamification/` — architecture maps FR28-33 to a `gamification/` area; 15-3/15-4 endpoints will join it. `/api/streaks` (15-1) predates this and stays where it is.
- Component in `src/components/dashboard/` beside StreakBadge/BudgetHealthCard (single-mount gamification components).
- `score` i18n namespace top-level like `streaks`, `values`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-15.2] (story + ACs, FR29)
- [Source: _bmad-output/planning-artifacts/prd.md#FR29 + level anchors lines 226-228]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-012 (deviation documented above), #ADR-025]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#BudgetScoreRing lines 777-784, score gradient line 408, aria line 476, keyboard line 1043]
- [Source: docs/api-conventions.md#degradation-policy]
- [Source: src/lib/ai/budgetResolver.ts (resolveBudget, budgetStatusFor)]
- [Source: src/app/api/dashboard/budget-forecast/route.ts (query shapes + budgets degradation)]
- [Source: _bmad-output/implementation-artifacts/15-1-logging-streaks-with-streak-freeze.md (review findings + lessons)]

## Dev Agent Record

### Agent Model Used

claude-fable-5

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- All 8 tasks implemented per spec. Pure budgetScoreEngine with exported threshold constants (ADHERENCE_MAX/CONSISTENCY_MAX/GOALS_MAX, HELPING/HURTING thresholds, MONTH_PROGRESS_FLOOR, streak caps); adherence resolves every category through resolveBudget (ADR-025) with fixedWindowMonthlyAverage ÷3 history; consistency reuses isStreakBroken/localDayKey from streakEngine (dead streaks earn 0 — same invariant as the badge); renormalization over scored weights verified (consistency-only user reaches 100).
- Route mirrors budget-forecast query shapes; goals query uses the generic SupabaseClient cast (13-9 gotcha: goals not in typed schema) and filters expired goals server-side via .or(deadline.is.null,deadline.gt.todayKey). Degradation implemented + tested: budgets/streaks/goals failures → warn + degrade, transactions/categories → 500.
- Component: CircularProgress ring, level Badge, Popover breakdown w/ status Tags + unscored unlock hints, aria-label + aria-live polite, level-up pulse guarded by usePrefersReducedMotion. GOTCHA found: `keyframes` must be imported from '@emotion/react' — the '@chakra-ui/react' re-export is not a function under jest.
- Dashboard: single mount above BudgetHealthCard (own mb, no phantom gap); SCORE_KEY added to BOTH revalidation lists via the scoped useSWRConfig mutate.
- Verification: tsc clean, eslint clean, jest 1852 passed / 54 skipped (baseline 1808 + 44 new: 31 engine, 7 route, 6 component), production build green (/api/gamification/score in manifest).

### File List

**New**
- `src/lib/ai/budgetScoreEngine.ts`
- `src/lib/ai/__tests__/budgetScoreEngine.test.ts`
- `src/app/api/gamification/score/route.ts`
- `src/app/api/gamification/score/__tests__/route.test.ts`
- `src/lib/hooks/useBudgetScore.ts`
- `src/components/dashboard/BudgetScoreRing.tsx`
- `src/components/dashboard/__tests__/BudgetScoreRing.test.tsx`

**Updated**
- `src/types/database.types.ts` (score types in the GAMIFICATION section)
- `src/app/dashboard/page.tsx` (BudgetScoreRing mount + SCORE_KEY in both revalidation lists)
- `messages/en.json`, `messages/bg.json` (new `score` namespace)

### Change Log

- 2026-07-12: Story 15.2 implemented — Budget Score 0-100 (FR29) via pure read-time budgetScoreEngine (adherence 50 through resolveBudget/ADR-025 + fixed ÷3 averages, consistency 30 from 15-1 streaks with broken-streak zeroing, goals 20 from unexpired own goals; renormalization over scored factors, levels beginner→master), GET /api/gamification/score (own-scoped budget-forecast query shapes, degradation-policy compliant), useBudgetScore hook, BudgetScoreRing (120px CircularProgress + Popover factor breakdown + aria-live + reduced-motion-guarded pulse), dashboard mount + SCORE_KEY in both scoped-mutate revalidation lists, en/bg `score` namespace, 44 new tests. NO migration (documented ADR-012 deviation — read-time computation, 15-1 no-cron precedent). lint/tsc clean; jest 1852 passed / 54 skipped; build green. Status → review.
- 2026-07-13: Triple code review (blind hunter / edge case hunter / acceptance auditor): 15 raw → 13 unique → 1 decision / 9 patch (1 HIGH, 2 MED, 6 LOW) / 1 defer / 2 dismissed. DECISION (user): adherence scores ACTUAL MTD spend vs budget (dropped pace projection — it scored on-budget lumpy spending 0/"Hurting"; monthProgress/MONTH_PROGRESS_FLOOR removed). Patches: HIGH — streaks-table-unavailable now marks consistency UNSCORED via streakUnavailable flag (infra failure renormalizes away instead of a false "hurting" 0/30; degradation policy); zero-MTD-spend budgeted categories skipped (no free perfect sub-scores diluting real overspend); AppLayout quick-add converted to scoped useSWRConfig().mutate (its ENTIRE revalidation list was inert global-mutate — the 15-1 latent bug) + STREAK_KEY/SCORE_KEY added (AC4 on the primary mobile entry); score now sums RAW factor values (display rounding can't flip a band edge) and status derives from the displayed rounded value (no 35/50-with-wrong-tag contradictions); computeBudgetScore returns null exactly when no factor is scored (docstring contract; consistency unscored for never-logged users); level-up pulse resets on down-transitions (no stuck justLeveledUp swallowing future pulses); route tests assert date-window args (gte/lte/lt); STREAK fixture internally consistent + clock-relative (localDayKey/isoWeekKey); renormalization combo test {adherence unscored} added; hint.consistency i18n key added en/bg, unscored hints shown for all factors. Deferred: server-clock day/month boundaries in read paths (app-wide class, deferred-work.md). jest 1857 passed / 54 skipped; lint/tsc/build green. Status → done.
