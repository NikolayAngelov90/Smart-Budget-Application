---
baseline_commit: ea31abbae9bec215b3f5afb225fb5de29e887465
---

# Story 15.6: Gamification Opt-In/Out

Status: done

## Story

As a user who may or may not want gamification,
I want to opt in or out of gamification features without affecting core budgeting,
So that I can use the app my way.

## Acceptance Criteria

1. **Given** a logged-in user **When** they toggle gamification in settings **Then** all gamification UI (streaks, scores, badges, challenges) is shown or hidden
2. **And** core budgeting features (transactions, budgets, goals, insights) work identically regardless of the toggle
3. **And** opting out preserves gamification data (can opt back in later)

## Tasks / Subtasks

- [x] Task 1: Preference plumbing (AC: 1, 3)
  - [x] `src/types/user.types.ts`: add `gamification_enabled?: boolean` to `UserPreferences` with doc comment: "Master gamification toggle (Story 15.6, default: true — opt-out model). UI-only gate: server-side accrual continues so opting back in restores everything."
  - [x] NEW `src/lib/hooks/useGamification.ts`: `useGamification(): { enabled: boolean; isLoading: boolean }` — thin wrapper over the existing `useUserPreferences` (SWR on `/api/user/profile`, localStorage-cached → instant on warm loads); `enabled = preferences?.gamification_enabled ?? true`. `??` is correct here (JSONB flag absent = default ON; explicit `false` respected). Do NOT create a new fetch path.
- [x] Task 2: Hook-level fetch gating (AC: 1, 2)
  - [x] `useStreak`, `useBudgetScore`, `useComeback`, `useAchievements`: each calls `useGamification()` internally and passes `enabled ? KEY : null` as the SWR key (conditional-key idiom — no fetch, no cache write when disabled). Preserve exported KEY constants and result shapes — `mutate` on a null-key hook is inert, and the dashboard/AppLayout onSuccess scoped mutates of `STREAK_KEY`/`SCORE_KEY` become harmless no-ops when disabled (verify, don't remove them).
  - [x] Rationale (document in hook comments): gating INSIDE the hooks covers every consumer at one point; the score GET is also a server-side achievement-evaluation point, so an opted-out user's browser stops triggering unlock evaluations + their pushes.
- [x] Task 3: Component null-gates (AC: 1)
  - [x] `StreakBadge`, `BudgetScoreRing`, `ComebackChallengeCard`, `AchievementsSection`: early-return `null` when `!enabled` (call `useGamification` AFTER existing hooks — rules of hooks; the early return goes with the existing progressive-disclosure null-gates). Mount points in `src/app/dashboard/page.tsx` (159, 185, 189) and `settings/page.tsx` (558) stay UNTOUCHED — the components own their gate (comments in all four already promise "15-6 gates here").
  - [x] `BudgetScoreRing`: its ref-guarded `newlyUnlocked` toast effect must not fire when disabled (the early return alone does not stop effects — guard the effect body or rely on the toast hook gate from Task 4; either way add a test).
- [x] Task 4: Toast + push suppression (AC: 1)
  - [x] `useAchievementToast`: no-op when gamification disabled (call `useGamification` inside; return early in the callback; add `enabled` to the useCallback deps). Single point covers BOTH call sites (TransactionEntryModal + BudgetScoreRing).
  - [x] `dispatchCategorizedPush` (pushService): after the prefs read, suppress `payload.type === 'achievement'` when `prefs.gamification_enabled === false` → return `'suppressed'`. One line, zero extra queries (prefs already loaded). Rationale: an "Achievement unlocked!" push to a user who hid all gamification UI is incoherent; other 'milestones'-category pushes (shared-goal milestones) are NOT gamification and stay governed only by `push_milestones_enabled`. Document in the gate comment.
- [x] Task 5: Settings master toggle (AC: 1)
  - [x] `settings/page.tsx` Preferences section, directly after the Weekly Digest FormControl (same Switch+FormHelperText pattern, lines ~767-785): "Gamification" toggle; state `gamificationEnabled` initialized in the profile useEffect (`?? true`); extend the `handleUpdatePreferences` union with `'gamification_enabled'`. `handleUpdatePreferences` already scope-mutates `PROFILE_KEY` (= `/api/user/profile`, the SAME key `useUserPreferences` reads) with server truth — the dashboard gate updates on next visit with no extra wiring (verify in test).
  - [x] i18n: `settings.gamificationToggle` + `settings.gamificationToggleDescription` in `messages/en.json` AND `messages/bg.json` (CI enforces parity). Description: opting out hides streaks/score/badges/challenges but keeps the data — you can turn it back on anytime.
- [x] Task 6: Tests (each subtask names its file; 15-5 review lesson: checked boxes REQUIRE the tests to exist)
  - [x] NEW `src/lib/hooks/__tests__/useGamification.test.ts`: default true when flag absent/profile unloaded; false when explicitly false.
  - [x] Hook conditional keys: in existing/new hook tests assert `useSWR` receives `null` when disabled and the KEY when enabled (mock `useGamification` or `useUserPreferences`).
  - [x] Component gates: for each of the 4 components, "renders null when gamification disabled" + existing rendering tests still pass with the gate mocked ENABLED. UPDATE EXISTING SUITES' mocks explicitly — an unmocked `useGamification` inside components would silently hit real SWR (15-5 stale-mock lesson: arg-blind/absent mocks let behavior vanish).
  - [x] `useAchievementToast`: disabled → callback no-ops (no toast call); enabled → existing behavior.
  - [x] pushService: achievement-type push suppressed when `gamification_enabled: false` (returns 'suppressed'); still 'sent' when flag absent; non-achievement 'milestones' push (type 'milestone') UNAFFECTED by the flag.
  - [x] Settings: toggle renders in Preferences; flipping it PUTs `{ preferences: { gamification_enabled: false } }` (follow the weekly-digest toggle test pattern in `settings/__tests__/page.test.tsx`).
  - [x] Core-unaffected (AC 2): dashboard test — with gamification disabled, DashboardStats/charts render normally (no layout crash from the null'd components).
- [x] Task 7: Verification — `npx tsc --noEmit`, `npx next lint`, full `npx jest` (baseline 1978 passed / 54 skipped — zero regressions), `npx next build`.

### Review Findings

Triple review 2026-07-21. NOTE: Edge Case Hunter + Acceptance Auditor subagents terminated early (usage-credit exhaustion); their intended checks were completed inline by the reviewer against the diff + project (profile-PUT merge race, score/comeback GET triggers, SWR-provider imperative revalidations, all dispatchCategorizedPush payload types, gamification-surface completeness sweep). Blind Hunter completed fully. 8 unique findings -> 6 patch (1 MED, 5 LOW) / 1 dismiss / 1 defer.

- [x] [Review][Patch][MED] Gate fails OPEN while preferences are unknown (Blind Hunter HIGH, downgraded — no AC violation but real UX flash): useGamification returns `enabled: prefs?.gamification_enabled ?? true` and `isLoading` is exported but consumed by NOBODY. On a cold cache (new device / cleared storage / in-flight profile fetch) enabled=true, so the four hooks mount with REAL keys and the four components attempt to render — an opted-out user can flash gamification UI and their browser fires the score GET (server achievement eval) + comeback create-on-read once before prefs resolve. Warm loads (localStorage-cached prefs) are unaffected. Fix: fold isLoading into the gate — `enabled = isLoading ? false : (prefs?.gamification_enabled ?? true)` (hold/hide until prefs known; update the useGamification unit test whose current expectation asserts the old fail-open). [src/lib/hooks/useGamification.ts]
- [x] [Review][Patch][LOW] Fetch-gating "bonus" is defeated by imperative revalidations — the hook comments ("an opted-out browser stops triggering unlock evaluations + their pushes") are FALSE: AppLayout quick-add and dashboard pull-to-refresh both `mutate(STREAK_KEY/SCORE_KEY/COMEBACK_KEY, undefined, {revalidate:true})` via useSWRConfig on every transaction/refresh, firing the score/comeback GETs for opted-out users regardless of the null-key hooks. Gate those 3+3 revalidations on the gamification pref (dashboard already reads useUserPreferences; AppLayout needs the read) so the comments become true. [src/app/dashboard/page.tsx; src/components/layout/AppLayout.tsx]
- [x] [Review][Patch][LOW] Residual gamification push type unslated — dispatchCategorizedPush suppression covers only `type === 'achievement'`, but the reengagement cron sends `type: 'comeback'` ("Your streak is waiting") which is streak/gamification-flavored. A user who opted OUT of gamification but opted IN to reengagement pushes (opt-in, default false) still gets it. Extend the suppression to `type === 'comeback'` ('comeback' is exclusively the reengagement streak push). [src/lib/services/pushService.ts]
- [x] [Review][Patch][LOW] BudgetScoreRing false comment + effect runs while disabled — the comment "useBudgetScore returns no data on a null key (so the effects below no-op)" is FALSE under `keepPreviousData: true` (SWR serves the previous key's payload after the key flips to null); the newlyUnlocked effect keeps running with stale data, and its scrub `mutate(..., {revalidate:false})` is a no-op on a null key, so a one-shot newlyUnlocked can survive in the persisted cache and (narrow window) replay a toast on opt-back-in. Fix the comment; add `if (!enabled) return;` at the top of the effect (belt-and-suspenders; toast hook already gated). Residual reenable-replay micro-window (toggle-off within one render tick of an unlock, then back on before revalidation) accepted + documented. [src/components/dashboard/BudgetScoreRing.tsx]
- [x] [Review][Patch][LOW] Correct the two overclaiming hook comments (useBudgetScore/useComeback) to the honest best-effort framing already in Dev Notes ("fetch gating is a bonus, not the mechanism") — made true by the imperative-revalidation patch above. [src/lib/hooks/useBudgetScore.ts; src/lib/hooks/useComeback.ts]
- [x] [Review][Patch][LOW] Tests: add a pushService test asserting comeback-type suppressed when gamification_enabled false (still sent when flag absent); harden gamification-optout.test.tsx to mock the four data hooks (currently runs REAL useSWR/fetch in the enabled case — flakiness/cache-bleed per Blind Hunter) + assert gamification UI absent when opted out. [src/lib/services/__tests__/pushService.test.ts; src/app/dashboard/__tests__/gamification-optout.test.tsx]
- [x] [Review][Defer] Profile PUT JSONB read-modify-write race across adjacent Settings toggles — rapid double-flip can resurrect an adjacent toggle's old value (last-writer-wins merge). PRE-EXISTING 8.3 design, already tracked from 15-5; this story adds one more adjacent toggle (gamification). Deferred — pre-existing.
- Dismissed (1): Settings toggle "no visible rollback on PUT failure" (Blind Hunter LOW, PLAUSIBLE) — VERIFIED not a defect: handleUpdatePreferences catch reverts profile via setProfile + mutate(PROFILE_KEY) + refreshProfile, and the profile→useEffect resync snaps gamificationEnabled back to the persisted value (identical to the proven weekly-digest toggle pattern).

## Dev Notes

### Architecture & decisions

- **Opt-OUT model, default `true`**: FR33 says opt-in/out; every existing user currently sees gamification, so default-on preserves behavior. JSONB flag on `user_profiles.preferences` — NO migration (15-5 precedent).
- **UI-only gate; server accrual continues** (AC 3): tx POST enrichment (streak recording → comeback lifecycle → achievement unlocks) keeps running for opted-out users. Stopping streak recording would BREAK the streak during opt-out — opting back in would show destroyed data, violating "preserves gamification data". Hidden ≠ stopped.
- **Fetch gating is a bonus, not the mechanism**: conditional SWR keys stop client-triggered score GETs (which evaluate+unlock achievements server-side and can push). The authoritative UI gate is the component null-return; the authoritative push gate is the pushService line.
- **Push nuance**: only `type === 'achievement'` pushes are gamification-gated. Household shared-goal milestone pushes ride the same 'milestones' category but are collaboration features, not gamification.
- **The comeback GET is create-on-read** (15-4): gating `useComeback`'s key means opted-out users' browsers stop creating challenges. The tx POST create-on-log path still creates them (data continuity; card hidden anyway). Acceptable asymmetry — document, don't "fix".
- **Degradation policy** (docs/api-conventions.md#Error-Handling): no new API surface in this story; conditional-null SWR keys produce NO error states and never write the cache — nothing to degrade.

### Existing code being modified (read before writing)

- `useUserPreferences` (src/lib/hooks/useUserPreferences.ts): SWR on `/api/user/profile`, returns DEFAULT_PREFERENCES fallback. Cold-load flash window (prefs not yet loaded → enabled=true default) is acceptable: the four components ALSO null-gate on their own data, and the localStorage provider makes warm loads instant.
- `handleUpdatePreferences` (settings/page.tsx:243): optimistic setProfile + `mutate(PROFILE_KEY, ...)` + PUT `{preferences:{[field]:value}}` + server-truth mutate. Profile PUT route merges partial preferences server-side (8.3 JSONB merge). Extend the union type only.
- The four components each have progressive-disclosure null-gates already (StreakBadge: no streak/broken streak; BudgetScoreRing: no scoreable data; ComebackChallengeCard: no active challenge; AchievementsSection: renders always with empty-state gallery). Add the gamification gate as the FIRST return after hooks.
- `useAchievementToast` returns a `useCallback` — deps currently `[toast, t]`; adding `enabled` to deps is required or the closure goes stale on toggle flip.
- `dispatchCategorizedPush` (15-5, just hardened): returns `'sent' | 'suppressed' | 'failed'`; prefs already read into `prefs` — add the achievement check AFTER the category-flag check, BEFORE quiet hours (suppression precedence irrelevant, but keep telemetry consistent: it's a 'suppressed').
- Existing suites that render the four components mock their data hooks (useStreak etc.) — they must now ALSO mock `useGamification` (or the components will run real SWR under jest). Grep each component's test file and update mocks; assert both enabled and disabled branches.

### What must NOT change

- Mount points and layout in dashboard/settings pages (components own their gates).
- Server enrichment chain in tx POST (no gating there).
- 15-5 push category toggles semantics (gamification gate is ADDITIVE for achievement-type only).
- Exported KEY constants (`STREAK_KEY`, `SCORE_KEY`, `COMEBACK_KEY`) — AppLayout/dashboard scoped mutates reference them.
- `@jest-environment node` only in FIRST docblock; `keyframes` from '@emotion/react'; chain mocks with filter-arg assertions (standing gotchas).

### Previous story intelligence (15-5 + review)

- Never-throwing gates return outcomes — the new suppression returns `'suppressed'`, keeping cron/telemetry truthful.
- Task checkboxes are claims: every test named in Task 6 must exist (15-5 review found 3 overclaimed checkboxes).
- Per-ACCOUNT prefs never gate on per-DEVICE state — this toggle is account-wide by construction (JSONB prefs), correct.
- jest baseline 1978/54 after 15-5 review patches (commit 0feb76d).

## Dev Agent Record

### Context Reference

- Ultimate context engine analysis completed - comprehensive developer guide created

### Agent Model Used

claude-fable-5

### Debug Log References

### Completion Notes List

- All 7 tasks implemented. gamification_enabled (JSONB pref, default true = opt-OUT model, NO migration). useGamification is THE client gate (wraps useUserPreferences — no new fetch path; ?? true so only explicit false opts out).
- Hook-level fetch gating: useStreak/useBudgetScore/useComeback/useAchievements pass null SWR keys when disabled (no fetch, no cache writes; score-GET unlock evaluations stop firing from opted-out browsers). KEY constants + result shapes preserved; existing scoped mutates become inert no-ops.
- Component gates: all four (StreakBadge, BudgetScoreRing, ComebackChallengeCard, AchievementsSection) early-return null when disabled — mount points untouched as specced. BudgetScoreRing toast effect covered by the gated useAchievementToast (asserted in test: newlyUnlocked present + disabled -> no toast).
- useAchievementToast no-ops when disabled (single point covers TransactionEntryModal + BudgetScoreRing); `enabled` added to useCallback deps.
- pushService: achievement-TYPE pushes suppressed when gamification_enabled === false (uses already-loaded prefs, returns 'suppressed'); non-achievement 'milestones' pushes (shared-goal) unaffected — tested both ways.
- Settings: Gamification toggle in Preferences after Weekly Digest (same pattern); handleUpdatePreferences union extended; PROFILE_KEY scope-mutate already propagates to the dashboard gate. i18n en+bg (settings.gamificationToggle + Description).
- TEST-ROT FIXES (pre-existing, surfaced today 2026-07-21): 15-4 fixtures hardcoded expires_at 2026-07-20 — ComebackChallengeCard.test + comebackService.test went red when the calendar passed them; both fixtures now clock-relative (15-1 lesson applied).
- Verification: tsc clean, eslint clean, jest 2005 passed / 54 skipped (baseline 1978 + 27 net new: 4 useGamification, 8 fetch-gating, 3 useAchievementToast, 2 dashboard AC2 smoke, 4 component disabled-gates, 3 pushService, 3 settings toggle), build green.
- AC3 (data preserved): by design — server enrichment (streak recording, achievement unlocks, comeback lifecycle) is deliberately NOT gated; opting back in restores everything intact.

### File List

**New**
- `src/lib/hooks/useGamification.ts`
- `src/lib/hooks/__tests__/useGamification.test.ts`
- `src/lib/hooks/__tests__/gamification-fetch-gating.test.tsx`
- `src/lib/hooks/__tests__/useAchievementToast.test.tsx`
- `src/app/dashboard/__tests__/gamification-optout.test.tsx`

**Updated**
- `src/types/user.types.ts` (+gamification_enabled)
- `src/lib/hooks/useStreak.ts`, `useBudgetScore.ts`, `useComeback.ts`, `useAchievements.ts` (conditional SWR keys)
- `src/components/dashboard/StreakBadge.tsx`, `BudgetScoreRing.tsx`, `ComebackChallengeCard.tsx`, `src/components/settings/AchievementsSection.tsx` (null gates)
- `src/lib/hooks/useAchievementToast.tsx` (gated callback)
- `src/lib/services/pushService.ts` (achievement-type suppression in the gate)
- `src/app/(dashboard)/settings/page.tsx` (toggle + state + union)
- `messages/en.json`, `messages/bg.json` (+2 settings keys each)
- `src/components/dashboard/__tests__/StreakBadge.test.tsx`, `BudgetScoreRing.test.tsx`, `ComebackChallengeCard.test.tsx`, `src/components/settings/__tests__/AchievementsSection.test.tsx` (gate mocks + disabled tests; card fixture clock-relative)
- `src/lib/services/__tests__/pushService.test.ts` (+3 gamification tests)
- `src/lib/services/__tests__/comebackService.test.ts` (clock-relative fixture fix)
- `src/app/(dashboard)/settings/__tests__/page.test.tsx` (+3 toggle tests)
- `src/components/layout/AppLayout.tsx` (review patch: gate quick-add gamification revalidations)
- `src/app/dashboard/page.tsx` (review patch: gate pull-to-refresh gamification revalidations) [also in Updated above]

## Change Log

- 2026-07-21: Code review (triple; Edge Case Hunter + Acceptance Auditor died on usage-credit exhaustion mid-run — their intended checks completed inline by the reviewer). 8 unique -> 6 patch (1 MED, 5 LOW) / 1 dismiss / 1 defer; ALL 6 applied: (1) useGamification now HOLDS (enabled=false) while prefs load instead of failing open — closes the cold-cache flash + the opted-out score/comeback GETs before prefs resolve (warm/localStorage loads unaffected; errored profile still fails open to default-ON); (2) the imperative gamification revalidations in AppLayout quick-add + dashboard pull-to-refresh are now gated on the pref so opted-out browsers genuinely stop triggering the score (server achievement eval) + comeback (create-on-read) GETs — the hook comments now hold; (3) dispatchCategorizedPush suppression extended to type 'comeback' (the reengagement "Your streak is waiting" push — streak-flavored); (4) BudgetScoreRing false "no data on null key" comment corrected (keepPreviousData keeps the stale payload) + `if (!enabled) return` guard added to the newlyUnlocked effect (+enabled in deps); (5) the two overclaiming hook comments rewritten to the honest best-effort framing; (6) tests: pushService comeback-suppression (+absent-flag sent), useGamification loading-holds + error-fails-open, dashboard opt-out test hardened (data hooks mocked — no real SWR — + gamification-absence assertion). Dismissed: settings toggle rollback (VERIFIED working via profile->useEffect resync, weekly-digest pattern). Deferred: profile-PUT JSONB adjacent-toggle merge race (pre-existing 8.3, tracked). Verification: tsc clean, lint clean, jest 2009 passed / 54 skipped (+4), build green. Status -> done.
- 2026-07-21: Story 15.6 implemented — master gamification opt-in/out (FR33): gamification_enabled JSONB pref (default true, no migration); useGamification client gate; conditional SWR keys in all four data hooks; null-gates in all four components; gated achievement toasts; achievement-type push suppression in dispatchCategorizedPush; Settings toggle + en/bg i18n. Fixed two pre-existing clock-rotted 15-4 test fixtures (hardcoded expiry passed on 2026-07-21). 27 net new tests; tsc/lint clean; jest 2005/54; build green. Status -> review.
- 2026-07-21: Story created (create-story) — full mount-point + hook + push analysis; ready-for-dev.
