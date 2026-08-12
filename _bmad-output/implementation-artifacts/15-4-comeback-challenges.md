---
baseline_commit: b05d1a963221e6f897e77e9a390fc769496f1353
---

# Story 15.4: Comeback Challenges

Status: done

## Story

As a returning user after a period of inactivity,
I want to be presented with a comeback challenge instead of punishment,
So that I'm encouraged to re-engage rather than feeling guilty about my absence.

## Acceptance Criteria

1. **Given** a user returns after 7+ days of logging inactivity, **When** they open the app, **Then** a friendly comeback challenge is presented ("Log 3 transactions this week to reignite your streak") as an INLINE DASHBOARD CARD — persistent until completed/dismissed, manual dismiss (UX feedback table line 903; NOT a toast/overlay).
2. **And** completing the challenge restores a portion of the previous streak (exact math in Dev Notes) **and awards the Phoenix badge** (UX Journey 4 line 688: "partial streak restore + Phoenix badge" — a NEW `comeback` achievement).
3. **And** the challenge is optional and dismissible (dismiss persists — never re-nags for the same absence).
4. **And** no negative messaging about the absence — copy celebrates return, never mentions missed days/broken streaks as failure (UX: "Welcome back overlay, not guilt message" ethos).
5. One challenge per absence: a dismissed/expired/completed challenge does not re-fire until a NEW 7+ day gap occurs.
6. Challenge progress and completion survive sessions/devices (persisted server-side; derived progress, no client-trusted counters).

## Tasks / Subtasks

- [x] Task 1: Migration 037 (AC: 2, 5, 6)
  - [x] `supabase/migrations/037_comeback_challenges.sql`: table `comeback_challenges` (id uuid pk default uuid_generate_v4(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL, target_count INT NOT NULL CHECK (target_count > 0), previous_streak INT NOT NULL CHECK (previous_streak >= 1), status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','dismissed','expired')), completed_at TIMESTAMPTZ). Partial unique index: `CREATE UNIQUE INDEX idx_comeback_one_active ON comeback_challenges (user_id) WHERE status = 'active';` (idempotent creation under concurrent GETs — 23505 = lost race, re-read).
  - [x] Owner-only RLS in the `(select auth.uid())` initplan form (035 baseline): SELECT + INSERT + UPDATE (USING + WITH CHECK — status transitions are user-driven); explicit GRANTs SELECT/INSERT/UPDATE to authenticated, ALL to service_role.
  - [x] SWAP the achievements catalog CHECK (the 15-3 "one-line constraint swap" path): DROP CONSTRAINT user_achievements_key_in_catalog + re-ADD including `'comeback'` (11 keys).
  - [x] Apply to prod via MCP when connected (like 036) or note for manual apply.
- [x] Task 2: Catalog + types (AC: 2)
  - [x] `AchievementKey` union += `'comeback'`; `ACHIEVEMENTS` catalog += `{ key: 'comeback' }` (LAST — display order). i18n names/conditions for it (Task 7).
  - [x] Types in `src/types/database.types.ts` (GAMIFICATION section): `ComebackChallenge { id, started_at, expires_at, target_count, previous_streak, status, completed_at }`, `ComebackStatus` union, `ComebackResponse { challenge: ComebackChallenge | null; loggedCount: number }`.
  - [x] `achievementEngine`: new optional signal `comebackCompleted?: boolean`; condition `comeback` = `comebackCompleted === true` (undefined skips — established semantics).
- [x] Task 3: Pure engine `src/lib/ai/comebackEngine.ts` (AC: 1, 2, 5)
  - [x] Constants: `INACTIVITY_DAYS = 7`, `TARGET_LOGS = 3`, `WINDOW_DAYS = 7`, `RESTORE_FRACTION = 0.5`.
  - [x] `isEligibleForChallenge(streak: StreakState | null, latestChallenge: { started_at: string } | null, todayKey: string): boolean` — eligible iff streak row exists AND `dayDiff(last_log_date, todayKey) >= 7` AND stale `current_streak >= 1` AND (no challenge OR the latest challenge's `started_at` day-key is <= `last_log_date`, i.e. it belongs to a PREVIOUS absence — one challenge per gap, AC5). Reuse streakEngine's date helpers via exports (`localDayKey`; add/export a public `dayDiffKeys` if the private one isn't exported — check first; if adding an export to streakEngine keep it additive-only).
  - [x] `restoredStreak(previousStreak: number, currentStreak: number): number` = `min(previousStreak, floor(previousStreak * RESTORE_FRACTION) + currentStreak)`, min 1. NOTE: restored ≤ previousStreak ≤ longest_streak (high-water invariant) so the 034 CHECK (longest >= current) cannot trip — still clamp defensively to longest at the service layer.
  - [x] Pure, client-import-safe, no DB (house engine standard).
- [x] Task 4: Service `src/lib/services/comebackService.ts` + streak restore (AC: 2, 5, 6)
  - [x] AUTH-SCOPED client (owner-only RLS exercised — allowance/values/achievements precedent). `comeback_challenges` is NOT in the typed Database schema → generic `SupabaseClient` cast (13-9/15-3 gotcha).
  - [x] `getLatestChallenge(userId)` (newest by started_at, any status); `createChallenge(userId, previousStreak)` (INSERT active, target TARGET_LOGS, expires_at = now + WINDOW_DAYS days; on 23505 from the partial unique index → re-read the active row, never fabricate); `markStatus(userId, id, status)` (UPDATE own row; completed also sets completed_at); `countLogsSince(supabase, userId, startedAtIso)` — `transactions` count head:true `.eq('user_id').gte('created_at', startedAtIso)` (created_at = logging ACTIVITY time, deliberately NOT the user-editable `date` field — no backdating exploit, AC6).
  - [x] `restoreStreak` lives in `src/lib/services/streakService.ts` (ADDITIVE function — the CAS home): CAS-update `current_streak = min(longest_streak, restored)` guarded on last_log_date (reuse the existing casUpdate helper; on CAS miss re-read + recompute once — 15-1 pattern). NEVER lower current_streak (restore takes `max(restored, current)` at write time).
- [x] Task 5: Routes (AC: 1, 3, 5, 6)
  - [x] `GET /api/comeback`: auth 401, force-dynamic. Load streak (getStreak, catch → null) + latest challenge. Lazy-expire: an `active` challenge past expires_at → markStatus 'expired' (best-effort). If an active unexpired challenge exists → return it + loggedCount (countLogsSince). Else if `isEligibleForChallenge` → CREATE and return it (create-on-read; 23505-safe). Else `{ challenge: null, loggedCount: 0 }`. Challenge state is this endpoint's CORE → read failures 500 (15-3 lesson: error-as-empty poisons the SWR cache); a missing streaks/comeback table degrades to `{ challenge: null }` ONLY for the specific missing-relation case if distinguishable — otherwise 500 is honest.
  - [x] `PATCH /api/comeback` body `{ action: 'dismiss' }` (zod-validated): marks the active challenge dismissed, 404 when none. Dismiss is the ONLY client-driven transition (completion is server-derived — never trust the client, AC6).
- [x] Task 6: Completion in the tx POST enrichment chain (AC: 2, 6)
  - [x] In `POST /api/transactions` (non-fatal, after streakResult like achievements): if an active unexpired challenge exists AND countLogsSince >= target_count → `markStatus completed` + `restoreStreak(userId, restoredStreak(previous_streak, streakResult.current_streak))` + award `'comeback'` via `unlockAchievements` (idempotent) + envelope gains `comeback: { completed: true, restoredStreak: number } | null`. The `'comeback'` key ALSO rides the existing `achievements` array → the Phoenix toast fires through the EXISTING modal wiring (zero new toast plumbing). Fetch of the active challenge joins the CONCURRENT prereq phase (15-3 lesson: no serial hops; attach .catch at creation — no unhandled-rejection window).
  - [x] Do NOT double-count: completion check uses the post-insert count (the just-saved tx counts toward the 3 — it IS logging activity).
- [x] Task 7: UI + i18n (AC: 1, 3, 4)
  - [x] `src/components/dashboard/ComebackChallengeCard.tsx`: inline dashboard card (mount ABOVE BudgetScoreRing — returning users see it first; single mount point, 15-6 gates later). Renders null unless `data?.challenge?.status === 'active'` (no skeleton flash). Shows: warm heading ("Welcome back! 🔥"), challenge line ("Log {target} transactions this week to reignite your streak"), progress ("{count} of {target}" + Chakra Progress bar), restore promise ("Finish to bring back {restored} days of your streak" — computed client-side via comebackEngine.restoredStreak with loggedCount-informed current? NO — show the guaranteed floor: floor(previous_streak/2), keep copy simple), dismiss button (PATCH + revalidate; optimistic hide). aria-label on the card region; progress bar has aria-valuenow via Chakra Progress + visible text (never color-only).
  - [x] `useComeback` hook: `COMEBACK_KEY = '/api/comeback'`, useStreak SWR shape. Add COMEBACK_KEY to BOTH dashboard revalidation lists AND AppLayout quick-add list (scoped `useSWRConfig().mutate` ONLY — global mutate is inert).
  - [x] i18n namespace `comeback` en+bg: heading, body ("Log {target} transactions this week to reignite your streak"), progress ("{count} of {target} logged"), restorePromise ("Finish to restore {days} streak days"), dismiss, completedToast? (completion celebration = Phoenix achievement toast via existing wiring — add `names.comeback` ("Phoenix") + `conditions.comeback` ("Complete a comeback challenge") to the achievements namespace en+bg). NO negative words (checked against AC4: never "you lost/missed/broke").
- [x] Task 8: Tests (all ACs)
  - [x] `comebackEngine.test.ts`: eligibility edges (gap 6 vs 7 days; no streak row; stale current 0 vs 1; latest challenge before vs after last_log_date — one-per-absence), restore math edges (prev 1 → 1; prev 20 + current 3 → 13; cap at prev; RESTORE_FRACTION floor).
  - [x] `comebackService.test.ts`: chain mocks w/ every method + arg assertions (user scoping, created_at gte for the count — NOT date); 23505 create race → re-read; markStatus transitions.
  - [x] streakService test additions: restoreStreak CAS (never lowers, clamps to longest, CAS-miss retry).
  - [x] `GET/PATCH /api/comeback` route tests (`@jest-environment node` FIRST docblock): 401, create-on-read when eligible, existing active returned w/ count, lazy expiry, dismiss, none → 404 on PATCH, core failure → 500.
  - [x] tx POST test additions: completion path (count reaches target → comeback in envelope + 'comeback' in achievements + restoreStreak called with engine math); non-fatal failure → 201.
  - [x] `ComebackChallengeCard.test.tsx`: null gate (no challenge / dismissed), progress render, dismiss calls PATCH, aria. (Chakra hidden spans — queryByText; 15-1 lesson.)
  - [x] Full verification: lint, tsc, `npx jest` (baseline 1900 passed / 54 skipped — additive only), build.

### Review Findings

Triple review 2026-07-14 (Blind Hunter / Edge Case Hunter / Acceptance Auditor): 24 raw -> 15 unique -> 11 patch (1 HIGH, 5 MED, 5 LOW) / 4 dismissed. AC verdict: all 6 MET on the happy path; the patches close the failure/abuse edges.

- [x] [Review][Patch][HIGH] Challenge rows are forgeable via PostgREST — INSERT/UPDATE grants + owner-only RLS let any user forge {status:'active', previous_streak:9999, backdated started_at, far-future expires_at, target_count:1} or un-dismiss/re-activate rows, farming restores (capped at longest, still self-cheat) + fake Phoenix; "server-derived completion" is not true at the trust boundary — move comeback writes to the SERVICE-ROLE client (Epic-13 house pattern: writes service-role, RLS SELECT-only), revoke INSERT/UPDATE from authenticated in 037 + prod ALTER [supabase/migrations/037; src/lib/services/comebackService.ts]
- [x] [Review][Patch][MED] Completion is non-atomic, reward-after-commit — markStatus('completed') runs BEFORE restoreStreak; a restore failure consumes the challenge with zero reward, unrecoverable (status no longer active, one-per-absence blocks retry) — restore FIRST, mark after; a mark failure then self-heals on the next POST (idempotent max-restore) [src/app/api/transactions/route.ts evaluateComebackCompletion]
- [x] [Review][Patch][MED] Phoenix is the only achievement whose signal is one-shot and never re-derived — if the prereq fetch or unlock fails on the completing POST, the badge is permanently lost — fetch the LATEST challenge (any status) in the concurrent phase and derive comebackCompleted from latest.status === 'completed' too (alreadyUnlocked filters re-reports; Phoenix self-heals like every other badge) [src/app/api/transactions/route.ts]
- [x] [Review][Patch][MED] Offer silently forfeited when the returning user's FIRST action is a log (FAB quick-add on any page) — recordLogActivity resets the stale row before any dashboard GET can snapshot it; the feature no-ops for exactly its target user — recordLogActivity additively returns the PRE-advance state; the tx POST creates the challenge from it when eligible (started_at = the tx's created_at so the triggering log counts toward the 3) [src/lib/services/streakService.ts; src/app/api/transactions/route.ts]
- [x] [Review][Patch][MED] Full progress bar can strand: countLogsSince counts non-POST transactions (savings-contribution auto-logs insert rows directly) and a transiently-failed completing POST never retries — GET shows "3 of 3" on a forever-active challenge — GET self-heals: active challenge at/over target → run the same restore-first completion (state change only; the one-shot toast still rides POST envelopes via the latest-completed repair signal) [src/app/api/comeback/route.ts; shared completion helper]
- [x] [Review][Patch][MED] markStatus has no status precondition — lazy expiry can overwrite a just-written 'completed' with 'expired', dismiss can clobber completion, dual completions both "win"; the route comment overclaims — guard the UPDATE with .eq('status','active') [src/lib/services/comebackService.ts]
- [x] [Review][Patch][MED] handleDismiss: unhandled rejection offline, no response.ok check (500 treated as dismissed), dismissing boolean never resets (a future challenge B stays hidden in a long-lived tab) — catch + ok-check + un-hide on failure; key the optimistic hide to challenge.id [src/components/dashboard/ComebackChallengeCard.tsx]
- [x] [Review][Patch][LOW] Failed lazy expiry + eligible-again → createChallenge 23505 → re-read returns the EXPIRED-but-active row as the challenge — skip creation this request when the expiry write failed [src/app/api/comeback/route.ts]
- [x] [Review][Patch][LOW] Card renders an already-expired challenge with an inviting progress bar (dashboard left open across expiry) — null-gate on expires_at at render [src/components/dashboard/ComebackChallengeCard.tsx]
- [x] [Review][Patch][LOW] PATCH body not zod-validated as specced — align with the house route convention [src/app/api/comeback/route.ts]
- [x] [Review][Patch][LOW] Missing test assertions the story claims: eligibility-positive at stale current_streak = 1; card aria labels [comebackEngine.test.ts; ComebackChallengeCard.test.tsx]
- Dismissed (4): restoredStreak give-up value on double-CAS-miss reports freshest truth and no UI consumes it (latent, truthful); deploy-window 500 storm moot — migration 037 + catalog swap were applied to prod BEFORE the code push (verified via MCP: table + constraint present); countLogsSince signature nit (behavior matches spec exactly); "confirm 037 in prod" — confirmed this session.

## Dev Notes

### The "previous streak" insight (why no snapshot table is needed at break time)

When a streak dies, NOTHING rewrites the streaks row until the next log: it still holds `current_streak = <the old streak>` with a stale `last_log_date`. `isStreakBroken` (15-1) detects death read-time. So on return after 7+ days, the stale row IS the previous-streak snapshot — `createChallenge` captures it into `previous_streak` at creation, BEFORE the user's first new log resets the row to 1. This is why challenge creation happens on the FIRST app-open (GET /api/comeback via dashboard) rather than on the first log.

### Restore math (deterministic)

`restored = min(previous_streak, floor(previous_streak × 0.5) + current_at_completion)`, min 1; write as `current_streak = min(longest_streak, max(restored, current))`. Example: 20-day streak lost, user logs 3 during the challenge → restored = min(20, 10+3) = 13. Never exceeds the old streak (no farming: dismiss/complete cycles can't inflate), never lowers what they've rebuilt, never violates 034's `longest >= current` CHECK (restored ≤ prev ≤ longest by the high-water invariant).

### One challenge per absence (AC5 mechanics)

Eligibility requires the latest challenge (ANY status) to have `started_at` ≤ `last_log_date` — i.e. it was created before the current gap's last activity, so it belongs to a previous absence. During the same gap: a dismissed challenge has `started_at` > `last_log_date` → not eligible → silent. After they log again, `last_log_date` advances past it; the NEXT 7-day gap re-qualifies. No cron, no extra columns.

### Progress is derived, never stored (AC6)

`loggedCount = COUNT(transactions WHERE user_id = X AND created_at >= challenge.started_at)` — `created_at` is server-set (logging ACTIVITY time); the user-editable `date` field would allow backdating exploits and miscount catch-up entries of old expenses (which SHOULD count — they're logging activity). No counter column to drift, no client-trusted numbers, idempotent under retries.

### Relationship to 12.6 re-engagement (do NOT duplicate)

Story 12.6's ReengagementSummary = welcome-back OVERLAY at 14+ days, summary-focused, dismissal in user preferences. This card = separate 7+ day inline challenge; both can appear (UX Journey 4 shows exactly that sequence: overlay → dashboard → challenge). Do NOT touch reengagementService/route; do NOT store dismissal in preferences (challenge rows carry their own status).

### Reuse map — do NOT reinvent

| Need | Use | From |
|---|---|---|
| streak state + brokenness + day math | `getStreak`, `isStreakBroken`, `localDayKey` (+ export dayDiff if needed, additive) | streakService / streakEngine |
| CAS streak write | existing `casUpdate` helper (restoreStreak goes IN streakService) | `src/lib/services/streakService.ts` |
| idempotent unlock + toast | `unlockAchievements` + the existing modal `achievements` wiring | 15-3 |
| enrichment orchestration + concurrent prereqs + catch-at-creation | tx POST 15-3 shape | `src/app/api/transactions/route.ts` |
| create-on-read + 23505 re-read | insight/streak service patterns | 15-1 |
| SWR hook + scoped revalidation | useStreak shape; dashboard + AppLayout lists | 15-1/15-2/15-3 |
| card chrome + null gate | BudgetHealthCard / ComebackCard aria patterns | `src/components/dashboard/` |

### What NOT to do (scope guards)

- NO push notification for the challenge (15-5 owns push; ADR-018 "re-engagement" category comes later).
- NO cron (lazy expiry on read — house no-cron precedent 15-1/15-2).
- NO opt-out gate (15-6 gates the mount), NO changes to ReengagementSummary/reengagementService, NO nav items.
- NO client-driven completion (PATCH accepts ONLY dismiss); NO stored progress counters.
- streakService change is ADDITIVE ONLY (`restoreStreak`); streakEngine change additive only (export day-diff helper if needed); achievementEngine change additive only (new optional signal).
- Copy review against AC4 before done: zero guilt words in en AND bg.

### Previous story intelligence (15-1..15-3 + reviews; commits 9971239..b05d1a9)

- **One-shot events must NOT ride cacheable GET payloads unscrubbed** (15-3 HIGH): the comeback card's GET returns STATE (challenge + count), not events — safe. The completion event rides the tx POST envelope (consumed once, never cached) — the Phoenix toast comes through the existing achievements array. Keep it that way; do NOT add a completion flag to GET /api/comeback.
- **Error-as-empty poisons the SWR cache** (15-3): challenge state is core → 500 on read failure.
- **`(select auth.uid())`** initplan form for ALL new policies (035 baseline).
- Tables not in the typed schema (goals/user_achievements/comeback_challenges) → generic SupabaseClient cast.
- Chain mocks: every chained method + arg assertions; `@jest-environment node` FIRST docblock; clock-relative fixtures with valid ISO weeks; tz-safe date expectations computed through the same format path.
- Enrichment promises: attach `.catch` at creation (unhandled-rejection window); start independent fetches concurrently.
- date-fns needs explicit bg locale for any user-facing dates (card shows none — progress numbers only).
- jest baseline: **1900 passed / 54 skipped** (b05d1a9). Additive only.
- Migrations 034/035/036(+CHECK swap path) all APPLIED in prod via MCP; 037 to be applied the same way.

### Project Structure Notes

- Engine in `src/lib/ai/`, service in `src/lib/services/`, route `src/app/api/comeback/route.ts`, hook `src/lib/hooks/useComeback.ts`, card in `src/components/dashboard/` — all house homes.
- i18n namespace `comeback` top-level; `achievements.names/conditions.comeback` extends the existing namespace.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-15.4 (FR31)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Journey 4 lines 670-695 (flow, Phoenix badge, no-guilt), feedback table line 903 (inline card, persistent, manual dismiss)]
- [Source: docs/api-conventions.md#degradation-policy]
- [Source: _bmad-output/implementation-artifacts/15-3-achievement-badge-system.md (review lessons: cache-safe events, error-as-empty, catalog CHECK swap, concurrent prereqs)]
- [Source: src/lib/services/streakService.ts (casUpdate), src/lib/ai/streakEngine.ts (isStreakBroken/dayDiff), src/app/api/reengagement/route.ts (12.6 boundary)]

## Dev Agent Record

### Agent Model Used

claude-fable-5

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- All 8 tasks implemented per spec. Pure comebackEngine (eligibility: 7+ day gap via the stale streaks row + one-challenge-per-absence rule; restore = min(prev, floor(prev/2) + rebuilt), min 1); comebackService auth-scoped (generic client cast - table not in typed schema) with 23505-safe create-on-read via the one-active partial unique index; restoreStreak added ADDITIVELY to streakService (CAS-guarded, never lowers, clamps to longest so the 034 CHECK cannot trip); dayDiff exported additively from streakEngine.
- GET /api/comeback: streak read is a SIGNAL (degrades to no-offer), challenge state is CORE (500 on failure - error-as-empty lesson); lazy expiry, create-on-read. PATCH accepts ONLY dismiss (completion is server-derived).
- tx POST: comeback completion evaluated after streakResult (fetch concurrent, catch attached at creation); the one-shot completion payload rides the UNCACHED 201 envelope; the Phoenix 'comeback' key rides the existing achievements array so the toast goes through existing wiring - zero new plumbing.
- ComebackChallengeCard: inline dashboard card above BudgetScoreRing, active-only null gate, progress bar + text (never color-only), optimistic dismiss; COMEBACK_KEY in all three scoped-mutate revalidation lists. Copy audited for AC4 (no guilt words, en+bg).
- Catalog grew to 11 keys ('comeback'/Phoenix); migration 037 (table + RLS + catalog CHECK swap) APPLIED TO PROD via MCP and verified.
- Verification: tsc clean, eslint clean, jest 1939 passed / 54 skipped (baseline 1900 + 39 net new), production build green (/api/comeback in manifest).

### File List

**New**
- `supabase/migrations/037_comeback_challenges.sql`
- `src/lib/ai/comebackEngine.ts`
- `src/lib/ai/__tests__/comebackEngine.test.ts`
- `src/lib/services/comebackService.ts`
- `src/lib/services/__tests__/comebackService.test.ts`
- `src/app/api/comeback/route.ts`
- `src/app/api/comeback/__tests__/route.test.ts`
- `src/lib/hooks/useComeback.ts`
- `src/components/dashboard/ComebackChallengeCard.tsx`
- `src/components/dashboard/__tests__/ComebackChallengeCard.test.tsx`

**Updated**
- `src/types/database.types.ts` (comeback types + 'comeback' AchievementKey)
- `src/lib/ai/achievementCatalog.ts` ('comeback' entry)
- `src/lib/ai/achievementEngine.ts` (comebackCompleted signal)
- `src/lib/ai/streakEngine.ts` (dayDiff exported additively)
- `src/lib/services/streakService.ts` (restoreStreak, additive)
- `src/app/api/transactions/route.ts` (completion enrichment + comeback envelope)
- `src/app/dashboard/page.tsx` (card mount + COMEBACK_KEY in both lists)
- `src/components/layout/AppLayout.tsx` (COMEBACK_KEY in quick-add list)
- `messages/en.json`, `messages/bg.json` (comeback namespace + Phoenix strings)
- `src/lib/services/__tests__/streakService.test.ts` (restoreStreak cases)
- `src/app/api/transactions/__tests__/streak-hook.test.ts` (completion cases)

### Change Log

- 2026-07-13: Story 15.4 implemented - comeback challenges (FR31): migration 037 comeback_challenges (one-active partial unique index, owner-only initplan RLS, applied to prod via MCP) + Phoenix ('comeback') joins the achievement catalog via the CHECK-swap path; pure comebackEngine (7-day absence eligibility off the stale streaks row - the row IS the previous-streak snapshot; one challenge per absence; restore = min(prev, floor(prev/2)+rebuilt)); create-on-read GET /api/comeback with lazy expiry + dismiss-only PATCH; server-derived completion in the tx POST enrichment chain (restoreStreak CAS + Phoenix through existing achievement wiring + one-shot comeback payload on the uncached envelope); inline no-guilt dashboard card with derived progress; en/bg i18n; 39 net new tests. lint/tsc clean; jest 1939 passed / 54 skipped; build green. Status -> review.
- 2026-07-14: Triple code review (blind hunter / edge case hunter / acceptance auditor): 24 raw -> 15 unique -> 11 patch (1 HIGH, 5 MED, 5 LOW) / 4 dismissed; user chose apply-all. Patches: HIGH - comeback writes moved to the SERVICE-ROLE client and INSERT/UPDATE revoked from authenticated in 037 + prod (users could forge instant-win challenges via PostgREST, farming restores + fake Phoenix; Epic-13 pattern: writes service-role, RLS SELECT-only; verified in prod: SELECT-only policy, auth cannot INSERT/UPDATE). Completion made failure-proof: restore-FIRST then mark (a restore failure leaves the challenge active and retryable - never consumed-with-no-reward), shared completeChallengeIfEarned helper in comebackService; Phoenix self-heals - the tx POST fetches the LATEST challenge (any status) and derives the signal from status=completed too (alreadyUnlocked filters re-reports); create-on-log - recordLogActivity additively returns the PRE-advance state so a returning user whose first action is a quick-add still gets the challenge (window anchored at the tx created_at so the trigger log counts); GET self-heals target-reached challenges (savings auto-logs / failed POSTs can fill the count outside the POST path) with idempotent Phoenix unlock, state-change only (no cacheable one-shot events); markStatus status-guarded (.eq status=active, returns win/lose - no terminal-state clobbering); failed lazy expiry skips creation (no expired-but-active resurrection via the 23505 re-read); card dismiss hardened (ok-check, rollback on failure, optimistic hide keyed to challenge.id) + expired-challenge render gate; PATCH zod-validated; missing test assertions added (eligibility at streak=1, card aria). jest 1952 passed / 54 skipped; lint/tsc/build green. Migration 037 write-hardening APPLIED to prod via MCP + verified. Status -> done.
