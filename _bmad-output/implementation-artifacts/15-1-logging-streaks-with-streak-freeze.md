---
baseline_commit: 592d4bcdc8d8ef2aeb2ed5e4815feb2a410e603c
---

# Story 15.1: Logging Streaks with Streak Freeze

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user building financial habits,
I want to build and maintain daily/weekly logging streaks with streak freeze capability,
so that I'm motivated to log consistently without being punished for occasional misses.

## Acceptance Criteria

1. **Given** a user logs at least one transaction, **When** the streak system evaluates activity, **Then** consecutive days of logging increment the daily streak counter, and logging in consecutive ISO weeks increments a weekly streak counter (same-day repeat logs are idempotent — no double-increment).
2. **And** a **streak freeze (1 per ISO week)** preserves the daily streak across exactly one missed day. **Resolution of a planning conflict:** the epic says "the user can activate" a freeze, but the UX spec mandates "streak freezes automatic" and "no explicit check-in action" (ux-design-specification.md lines 83, 163 — no-guilt principle). The freeze therefore AUTO-APPLIES server-side when activity resumes after a 1-day gap with a freeze available, and the UI visibly reports it ("Streak freeze used — your streak is safe"). A gap of >1 day, or a 1-day gap with no freeze available, resets the daily streak to 1 on the next log (comeback flows are Story 15.4's job — no punishment copy here).
3. **And** streak state **updates locally in <100ms with background sync**: the streak UI renders instantly from the localStorage-persisted SWR cache, and a successful transaction save optimistically advances the cached streak via the CLIENT-side engine (no network round-trip for the visual bump), then revalidates against server truth.
4. **And** the streak display appears on the dashboard (single mount point so 15-6 opt-out is one gate later); it renders null until the user has any streak data (progressive disclosure) and never blocks or delays transaction entry — server-side streak recording is non-fatal enrichment per the degradation policy (docs/api-conventions.md#degradation-policy).
5. **And** core budgeting is untouched: no changes to core financial tables (ADR-012 — separate `streaks` table), and a streak-recording failure never fails the transaction POST.

## Tasks / Subtasks

- [x] Task 1: Migration `supabase/migrations/034_streaks.sql` (AC: #1, #2, #5) — `streaks`: id, user_id UNIQUE NOT NULL (FK auth.users CASCADE), current_streak INT ≥0 DEFAULT 0, longest_streak INT ≥0 DEFAULT 0, weekly_streak INT ≥0 DEFAULT 0, last_log_date DATE NULL, last_log_week TEXT NULL (ISO 'YYYY-Www'), freeze_used_on DATE NULL, timestamps + updated_at trigger. House RLS recipe (031/032/033): owner-only flat policies, INSERT/UPDATE `WITH CHECK (auth.uid() = user_id)`, explicit GRANTs to authenticated + service_role.
- [x] Task 2: Types (AC: #1–#3) — `Database.Tables.streaks` entry + `StreakState`, `StreakAdvanceResult` (state + `event: 'started' | 'extended' | 'same_day' | 'frozen' | 'reset'`), `StreakResponse` in `src/types/database.types.ts` (new GAMIFICATION section).
- [x] Task 3: Pure engine `src/lib/ai/streakEngine.ts` (AC: #1, #2) — `advanceStreak(state, logDayKey, weekKey?)` per the Streak state machine below; client-safe (14-4 precedent), split-parts date parsing with round-trip rejection, `Math.round` day diffs (DST), no DB/i18n. Also export `isFreezeAvailable(state, weekKey)` and `localDayKey(date)` / `isoWeekKey(date)` helpers.
- [x] Task 4: Service `src/lib/services/streakService.ts` (AC: #1, #2, #5) — AUTH-SCOPED client (valuesService pattern): `getStreak(userId)` (null when no row), `recordLogActivity(userId, dayKey)` — read row, run engine, upsert (single row per user via UNIQUE user_id; on 23505 race re-read+retry once, budgetService lesson). No service-role.
- [x] Task 5: API + hook (AC: #3, #4) — `GET /api/streaks` (force-dynamic, 401; `{ streak: StreakState | null }`); wire `recordLogActivity` into POST `/api/transactions` beside the nudge hook, non-fatal `.catch(log)` and NOT gated on `type === 'expense'` (income logs count as logging activity); return `streak` in the POST response like `nudge`. `src/lib/hooks/useStreak.ts` — SWR key `/api/streaks`, fetcher throws on !ok, keepPreviousData (localStorage provider gives instant first paint); export `advanceStreakCache(mutate, state)` helper or accept optimistic data param.
- [x] Task 6: UI (AC: #2, #3, #4) — `src/components/dashboard/StreakBadge.tsx`: compact flame icon + current daily streak, subtle weekly count + longest, "freeze used" note when last advance event was `frozen`, freeze-available indicator; renders null with no data; aria-labels + non-color status cues (15-8 groundwork); mount ONCE near the dashboard header; TransactionEntryModal onSuccess path (dashboard page) optimistically advances the cached streak via the client engine THEN revalidates (AC #3 <100ms).
- [x] Task 7: i18n — new `streaks` namespace en+bg (title, dayStreak plural, weekStreak plural, longest, freezeUsed, freezeAvailable); parity CI-enforced.
- [x] Task 8: Tests — engine (every state-machine row below + same-day idempotence + week rollover + freeze-per-week boundary + DST/rollover dates); service (chainable mock WITH filter-arg assertions — 14-4 lesson; 23505 retry); route (first-docblock `@jest-environment node`, 401/shape/null); transactions-POST hook (non-fatal on failure, income counts); StreakBadge states.
- [x] Task 9: Verification — lint, type-check, full test suite, build; Dev Agent Record + File List + Change Log; status → review; sprint-status 15-1 → review. Deploy note: migration 034 manual SQL-editor apply.

### Review Findings

- [x] [Review][Patch][HIGH] Server-UTC vs client-local log day split-brain — consecutive local days can merge (same_day) or gap (burning freezes) for the primary bg locale; client sends its local `log_day` in the POST body, server zod-validates + clamps to ±1 day of the server day, falls back to server day [transactions route; TransactionEntryModal; dashboard optimistic bump]
- [x] [Review][Patch][HIGH] Dead streaks display as alive forever — badge never compares last_log_date to today; derive brokenness client-side (gap no longer bridgeable → render null) [streakEngine helper; StreakBadge]
- [x] [Review][Patch][HIGH] Global `mutate` from 'swr' never reaches the localStorage-provider cache (empirically proven) — the optimistic bump AND every dashboard revalidation key are inert; switch the dashboard page to `useSWRConfig().mutate` (fixes all its keys) [dashboard/page.tsx]
- [x] [Review][Patch][MED] Freeze charged to the resume-day's week, not the missed day's — W-boundary misses double-dip or early-burn; attribute the freeze to the missed day (last_log + 1) [streakEngine + tests]
- [x] [Review][Patch][MED] UPDATE path is an unguarded read-modify-write — CAS on last_log_date, 0 rows → re-read + retry once [streakService]
- [x] [Review][Patch][MED] Inactivity auto-logout never clears the offline cache → next user paints the previous user's streak (verified) — call clearOfflineCache() in useInactivityLogout [useInactivityLogout]
- [x] [Review][Patch][MED] Optimistic bump fabricates from an empty cache ("1-day streak" flash for a 30-day user) — advance only when a cached streak exists, else revalidate only [dashboard/page.tsx]
- [x] [Review][Patch][MED] Freeze availability + longest streak are tooltip-only (hover) — focusable badge, freeze status in the aria summary, longest in the tooltip, 44px base target [StreakBadge]
- [x] [Review][Patch][MED] Spec-mandated DST-crossing day-diff test missing — add EU spring-forward/fall-back cases [streakEngine.test]
- [x] [Review][Patch][LOW] recordLogActivity accepts garbage day keys (zero-row insert path) — validate the key, throw on invalid [streakService]
- [x] [Review][Patch][LOW] 23505 retry with a null re-read returns never-persisted state — retry the insert once, else throw [streakService]
- [x] [Review][Patch][LOW] Streak hook runs serially after nudge eval (2 extra awaited round-trips) — run both enrichments concurrently [transactions route]
- [x] [Review][Patch][LOW] Enrichment failures logged at error; the degradation policy says warn [transactions route]
- [x] [Review][Patch][LOW] Double screen-reader announcement (aria-label + VisuallyHidden duplicate) [StreakBadge]
- [x] [Review][Patch][LOW] Migration: add CHECK (longest_streak >= current_streak) — unapplied, safe to edit [034_streaks.sql]
- [x] [Review][Defer] App-wide: global `mutate` is inert under the provider on OTHER pages too (pre-existing pattern; 15-1 fixes the dashboard) — sweep remaining callers — deferred, pre-existing
- [x] [Review][Defer] POST response `streak` unused by the client — seed the scoped cache from it (needs onSuccess signature change) — deferred, polish
- [x] [Review][Dismissed] Farmable streaks via add/delete (by design — streaks measure the act of logging); dark-mode palette (light-only house style); nullable timestamp typing (house style, 3rd occurrence); 'rejected' vs same_day event (input now validated upstream); arg-blind hook mock (service boundary mocked directly)


## Dev Notes

### Streak state machine (deterministic — the engine implements exactly this)

Inputs: `state = { current_streak, longest_streak, weekly_streak, last_log_date, last_log_week, freeze_used_on } | null`, `logDayKey` (YYYY-MM-DD), derived `weekKey` (ISO 'YYYY-Www').

- **No prior state / null last_log_date** → `{ current: 1, weekly: 1, event: 'started' }`.
- **logDay == last_log_date** → unchanged, `event: 'same_day'` (idempotent; no freeze consumed).
- **dayDiff == 1** → current+1, `event: 'extended'`.
- **dayDiff == 2 AND freeze available** (freeze_used_on null OR its ISO week < the MISSED day's week) → current+1, `freeze_used_on = missed day (last_log + 1)`, `event: 'frozen'` (the single missed day is bridged; UX: automatic, no-guilt). [Attribution to the missed day per review — resume-day attribution double-dips/early-burns at ISO week boundaries.]
- **dayDiff == 2 without freeze, or dayDiff > 2** → current = 1, `event: 'reset'` (no punishment copy — 15.4 owns comebacks).
- **logDay < last_log_date** (backdated clock skew) → unchanged, `event: 'same_day'` (never regress).
- Weekly: same weekKey → unchanged; consecutive ISO week → weekly+1; gap → weekly = 1. `longest_streak = max(longest, current)` always.
- Day diffs via local-midnight `Math.round`; date parsing round-trip-rejects rollover garbage (14-4 lessons). ISO week via date-fns (`getISOWeek`/`getISOWeekYear` — already a dependency).

### Architecture & data-model decisions

- **ADR-012:** gamification lives in separate tables — `streaks` only in this story (budget_scores/achievements are 15-2/15-3). Core financial tables untouched; 15-6 opt-out becomes a UI gate, schema-free. [Source: architecture.md ADR-012]
- **"Local-first <100ms" = SWR cache + client engine, not new infra.** The localStorage SWR provider already persists cache across page loads (instant first paint); the optimistic bump on tx-save runs the pure engine client-side (proven pattern: whatIfEngine in 14-4). Server remains truth; background revalidation reconciles. ADR-012's "daily cron" suggestion is NOT needed — streaks advance on write (tx POST) + read-time display; no cron job. [Source: src/lib/swr/localStorageProvider.ts; 14-4 story]
- **Day-boundary caveat (documented, not solved):** server truth uses the server-UTC day of the POST; the client optimistic bump uses the local day. A user logging near midnight UTC±offset may see the optimistic value corrected by sync. Same server-clock class as the deferred month/tz items — do NOT invent a tz parameter here; note it in the code comment and move on. [Source: deferred-work.md tz items]
- **Degradation policy applies (CITE IT):** streak recording in the tx POST is enrichment — failure logs a warn and never fails the POST (like nudges); GET /api/streaks errors → the badge keeps stale cache (keepPreviousData) or renders null; never fabricate a streak number. [Source: docs/api-conventions.md#degradation-policy]
- **Freeze semantics:** "1 free per week" = one freeze per ISO week, tracked by `freeze_used_on` date (its ISO week vs current). Auto-applied per the UX no-guilt principle; the AC-2 note records the epic-vs-UX conflict resolution — reviewers should audit against THIS story's ACs.
- **POST response carries `streak`** so the modal's onSuccess can reconcile optimistic state without an extra fetch (same envelope pattern as `nudge`). [Source: src/app/api/transactions/route.ts POST response]

### Files to touch

- NEW `supabase/migrations/034_streaks.sql`
- UPDATE `src/types/database.types.ts` (streaks table + GAMIFICATION types)
- NEW `src/lib/ai/streakEngine.ts`
- NEW `src/lib/services/streakService.ts`
- NEW `src/app/api/streaks/route.ts` (GET only)
- UPDATE `src/app/api/transactions/route.ts` (hook recordLogActivity beside nudge eval; include `streak` in POST response; NOT expense-gated)
- NEW `src/lib/hooks/useStreak.ts`
- NEW `src/components/dashboard/StreakBadge.tsx`
- UPDATE `src/app/dashboard/page.tsx` (mount StreakBadge; optimistic advance + revalidate in the tx-modal onSuccess; add `/api/streaks` to pull-to-refresh list)
- UPDATE `messages/en.json`, `messages/bg.json` (new `streaks` namespace)
- NEW tests: `src/lib/ai/__tests__/streakEngine.test.ts`, `src/lib/services/__tests__/streakService.test.ts`, `src/app/api/streaks/__tests__/route.test.ts`, `src/components/dashboard/__tests__/StreakBadge.test.tsx` (+ transactions route hook coverage)

### Project Structure Notes

- Transactions POST already orchestrates non-fatal enrichments (insight trigger, nudge eval + push) — add streak recording in the same style; it must run for BOTH income and expense (nudges are expense-only; streaks are not). [Source: src/app/api/transactions/route.ts:397-425]
- Route tests: `@jest-environment node` in the FIRST docblock; chainable mocks must include every chained method AND record args for filter assertions (14-4 lesson). [Source: src/app/api/what-if/__tests__/route.test.ts]
- Engines are client-import-safe when pure — no node APIs, no DB (14-4 whatIfEngine precedent).
- date-fns v4 is the installed date lib (`getISOWeek`, `getISOWeekYear` available) — don't hand-roll ISO week math.
- The dashboard page owns the TransactionEntryModal onSuccess revalidation list — that's where the optimistic streak advance goes (client engine + mutate), keeping TransactionEntryModal itself untouched.
- 44px touch targets, sr-only/aria patterns per 15-8 groundwork (StatArrow/BudgetHealth precedents).

### Previous epic intelligence (Epic 14 + retro, commits d8283cd…90ff586)

- House RLS recipe for personal tables is settled: flat owner-only policies + WITH CHECK + explicit GRANTs (CLI ≥2.106 unpin readiness) — copy 033's shape.
- Honest degradation is now POLICY (api-conventions decision table) — specs cite it; reviewers audit against it.
- Timezone/date lessons are encoded: split-parts parse with round-trip rejection, `Math.round` for midnight-to-midnight diffs, YYYY-MM(-DD) string keys for bucketing.
- Review pattern: triple review will hunt fabricated-state, date boundaries, and arg-blind mocks — pre-apply all of it.
- jest 1747 passed / 54 skipped at baseline (90ff586); this story only adds — no existing test may need behavioral changes EXCEPT transactions route tests if the POST response shape assertion is strict (it isn't — tests assert specific fields, additive `streak` key is safe; verify).

### Testing standards summary

- Engine: every state-machine row, same-day idempotence, freeze available/consumed/unavailable-same-week, week rollover incl. year boundary (2026-W01 after 2025-W52), longest-streak high-water, rollover-date rejection, DST-crossing day diff.
- Service: get null vs row; recordLogActivity upsert paths + 23505 retry; filter-arg assertions (`eq('user_id', …)`).
- Route: 401, shape, null streak; transactions POST: streak failure non-fatal, income transaction records activity, `streak` in response.
- Component: null render, streak display, frozen note, aria labels.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 15.1 (lines 730-744); FR28 (prd.md:383)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md lines 83, 92, 101, 160-163 — automatic streak maintenance, automatic freezes, no-guilt principle]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-012 — separate gamification tables]
- [Source: docs/api-conventions.md#Degradation-Policy — enrichment vs core rules (MUST cite in impl comments)]
- [Source: _bmad-output/implementation-artifacts/epic-14-retro-2026-07-02.md — local-first flag, review-lesson compounding]
- [Source: src/lib/swr/localStorageProvider.ts — persisted SWR cache (the <100ms substrate)]
- [Source: src/app/api/transactions/route.ts — nudge hook shape + POST response envelope]
- [Source: supabase/migrations/033_wishlist_items.sql — RLS recipe to copy]

## Dev Agent Record

### Agent Model Used

claude-fable-5

### Debug Log References

- None — tsc/eslint clean first pass; all 41 new tests green first run (engine 19, service 8, route 4, tx-hook 3, component 7); full suite green.

### Completion Notes List

- **Migration 034 `streaks`**: one row per user (UNIQUE user_id), owner-only flat RLS with WITH CHECK + explicit GRANTs (house recipe, CLI >=2.106 ready). Gamification stays in its own table (ADR-012) — zero changes to core financial tables (AC #5).
- **Pure `streakEngine`** (client-safe, 14-4 precedent): deterministic state machine — started/extended/same_day/frozen/reset; weekly streak over consecutive ISO weeks (date-fns getISOWeek/getISOWeekYear, year-boundary tested 2025-W52→2026-W01); freeze auto-applies on a 1-day gap when available (AC #2 conflict resolution: UX spec's automatic no-guilt freezes win over the epic's "user can activate"; the UI reports it visibly); same-day logs idempotent; backdated/garbage input never regresses or fabricates state; all date lessons applied (round-trip parse rejection, Math.round day diffs).
- **`streakService`** (auth-scoped): read→engine→write with same-day write-skip and 23505 first-log race recovery (re-read + retry once).
- **Wiring**: `recordLogActivity` runs in POST /api/transactions for ALL types (income counts as logging) as non-fatal enrichment per the degradation policy (cited in code); the POST response carries `streak` like `nudge`. `GET /api/streaks` is read-only truth.
- **<100ms local-first (AC #3)**: `useStreak` (SWR + the existing localStorage provider → instant first paint) + optimistic cache advance running the SAME engine client-side in the dashboard modal's onSuccess, then background revalidation reconciles. No new infra, no cron.
- **`StreakBadge`**: single mount point in the dashboard header (15-6 opt-out gates exactly here); renders null before the first log / zero streak; flame + day count, weekly context when >1, "freeze used" note when the last advance was frozen; tooltip reports freeze availability; aria summary + VisuallyHidden text, status never conveyed by color alone (15-8 groundwork). Day-boundary caveat (server UTC vs client local day) documented in code — same deferred class as the other server-clock items.
- **Verification**: lint (--max-warnings=0) clean, tsc clean, jest 1790 passed / 54 skipped, build compiles /api/streaks. Existing transaction tests unaffected by the additive `streak` response field.
- **Deploy note**: apply `supabase/migrations/034_streaks.sql` manually in the Supabase SQL editor — streak recording degrades non-fatally until applied (POST unaffected), GET 500s per the core-input policy.

### File List

**New**
- `supabase/migrations/034_streaks.sql`
- `src/lib/ai/streakEngine.ts`
- `src/lib/services/streakService.ts`
- `src/app/api/streaks/route.ts`
- `src/lib/hooks/useStreak.ts`
- `src/components/dashboard/StreakBadge.tsx`
- `src/lib/ai/__tests__/streakEngine.test.ts`
- `src/lib/services/__tests__/streakService.test.ts`
- `src/app/api/streaks/__tests__/route.test.ts`
- `src/app/api/transactions/__tests__/streak-hook.test.ts`
- `src/components/dashboard/__tests__/StreakBadge.test.tsx`

**Updated**
- `src/types/database.types.ts` (streaks table typing + GAMIFICATION types)
- `src/app/api/transactions/route.ts` (streak hook, all types, non-fatal; `streak` in POST response)
- `src/app/dashboard/page.tsx` (StreakBadge mount, optimistic advance, pull-to-refresh key)
- `messages/en.json`, `messages/bg.json` (new `streaks` namespace)

### Change Log

- 2026-07-02: Story 15.1 implemented — daily/weekly logging streaks with automatic weekly streak freeze (migration 034 owner-only RLS, pure client-safe streakEngine state machine, auth-scoped streakService w/ 23505 race recovery, GET /api/streaks, non-fatal tx-POST hook for all transaction types, StreakBadge with <100ms optimistic local-first updates via the localStorage SWR cache + client engine, en/bg i18n, 41 new tests). Epic-vs-UX freeze conflict resolved as automatic freezes per the UX no-guilt principle (recorded in AC #2). lint/tsc clean; jest 1790 passed / 54 skipped; build green. Status → review.
- 2026-07-10: Triple code review (blind hunter / edge case hunter / acceptance auditor): 20 findings → 15 patched (3 HIGH), 2 deferred (deferred-work.md), 5 dismissed. All 15 patches applied: client `log_day` contract with server ±1-day clamp (tz split-brain); `isStreakBroken` gate so dead streaks render null; dashboard switched to `useSWRConfig().mutate` (global mutate is INERT under the localStorage provider — empirically proven); freeze attributed to the MISSED day's ISO week (no boundary double-dip/early-burn); CAS update with re-read+single-retry; `clearOfflineCache()` on inactivity logout (cross-user leak); guarded optimistic bump (no fabricated "1-day streak" flash); focusable badge with freeze status + longest in aria/tooltip, 44px base target, VisuallyHidden duplicate removed; DST day-diff tests (EU spring/fall); day-key validation throw; 23505 insert-retry (never report unpersisted state); concurrent enrichments; warn-level enrichment logging; migration 034 CHECK (longest >= current). New helpers: `isValidDayKey`, `wasJustFrozen`, `addDays`. lint/tsc clean; jest 1808 passed / 54 skipped; build green. Status → done.
