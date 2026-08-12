---
baseline_commit: 5d6106392f87cedd7342cb950c70183fe7698c28
---

# Story 15.5: Push Notifications

Status: done

## Story

As a user who wants timely financial nudges,
I want to receive push notifications for smart nudges, milestones, re-engagement, and household events,
So that I stay engaged without needing to open the app.

## Acceptance Criteria

1. **Given** a user has granted notification permissions, **When** a notifiable event occurs (nudge, milestone/achievement, comeback/re-engagement, household invite), **Then** a push notification is delivered via the Web Push API (existing `sendPushToUser` — all devices, stale-endpoint cleanup).
2. **And** the user can configure per-category notification toggles: **nudges, achievements, household, digest** (epic list) — implemented as preference flags `push_nudges_enabled` (exists), `push_milestones_enabled`, `push_household_enabled`, `push_digest_enabled`, `push_reengagement_enabled` (ADR-018 names re-engagement as its own toggleable category; surfacing all 5 in Settings satisfies both sources).
3. **And** notifications link to the relevant in-app view (worker `notificationclick` already focuses/opens `data.url`): nudges → `/dashboard`, achievements → `/settings` (gallery), household → `/household`, digest → `/insights`, re-engagement → `/dashboard`.
4. **And** users who decline permissions are never re-prompted (existing `usePushNotifications` `permission === 'denied'` → Settings shows "Blocked" and the subscribe path is unreachable — VERIFY + regression-test, don't rebuild).
5. Every dispatch goes through ONE central gate that enforces the category toggle + quiet hours — no dispatch site may re-implement preference checks (the current nudge path does; refactor it through the gate).
6. All pushes remain best-effort/non-fatal (established degradation posture) and quiet hours apply to every category.

## Tasks / Subtasks

- [x] Task 1: Central dispatch gate in pushService (AC: 2, 5, 6)
  - [x] `PushCategory = 'nudges' | 'milestones' | 'household' | 'digest' | 'reengagement'`; extend `PushPayload['type']` additively with `'achievement' | 'digest' | 'comeback'` (worker displays any type — verify, it only reads title/body/data).
  - [x] `export async function dispatchCategorizedPush(userId, category, payload)`: reads `user_profiles.preferences` ONCE (service-role client — dispatch runs in server contexts incl. crons where no user session exists); checks the category flag (nudges + reengagement default FALSE/opt-in like push_nudges_enabled; milestones/household/digest default TRUE when the user is subscribed — they explicitly enabled push; document each default); checks `isWithinQuietHours` (defaults 22–8); then `sendPushToUser`. Non-fatal: never throws (catch + warn inside).
  - [x] Refactor `dispatchNudgePush` (tx POST) to call the gate (delete its inline pref reads); wire the three household sites (`invitationService` ×2, `householdMemberService`) through the gate with category `'household'` (READ each first — they push unconditionally today; recipients get control, AC2).
- [x] Task 2: Preference flags + Settings toggles (AC: 2, 4)
  - [x] `UserPreferences` (src/types/user.types.ts): add the 4 new optional booleans with doc comments stating defaults. NO migration (preferences are JSONB).
  - [x] Settings push section: when `isSubscribed`, render the 5 category switches (reuse `handleUpdatePreferences` — extend its field union); keep the existing quiet-hours controls; keep the Blocked state untouched. i18n `settings`/push namespace keys en+bg for the 4 new labels (find the existing push toggle strings and co-locate).
  - [x] Regression-verify AC4: with `permission === 'denied'`, no code path calls `subscribe()`/`Notification.requestPermission()` (read usePushNotifications; add a test asserting Settings renders Blocked without a subscribe button).
- [x] Task 3: Achievement/milestone pushes (AC: 1, 3)
  - [x] Push on achievement unlock from the server unlock sites — tx POST (after `achievements` resolves, non-blocking `.catch`) and score GET + comeback GET (after their unlock calls): ONE push per batch (title "Achievement unlocked!", body = first name + "and N more" when batched — i18n-independent server strings follow the nudge precedent of English server copy? NO — check how nudge title/body are built (nudgeEngine, English in-engine per house rule) → server push copy in English like nudges), `type: 'achievement'`, category `'milestones'`, url `/settings`.
  - [x] Shared-goal milestone push to OTHER household members (UX Journey 5: "Maya gets push notification"): in `householdGoalService.contribute`, after a 25/50/75/100% milestone is crossed (compute from before/after totals), push each member EXCEPT the contributor (`household_members` roster) — category `'household'`, `type: 'milestone'`, url `/household`. READ the service first; milestone thresholds must match the existing client celebration thresholds (goals `milestones_celebrated` precedent).
- [x] Task 4: Re-engagement (comeback) push — new cron (AC: 1, 3)
  - [x] `GET /api/cron/reengagement-push` (CRON_SECRET Bearer guard — copy generate-insights shape EXACTLY): service-role query `streaks WHERE last_log_date = <exactly 7 days ago>` (one stateless push per absence — day 7 only, no dedup table needed); for each user, `dispatchCategorizedPush(userId, 'reengagement', { type: 'comeback', title/body: warm no-guilt copy ("Your streak is waiting — we saved your progress"), url: '/dashboard' })`. Quiet hours still apply via the gate; cap the scan with `.limit(500)` + log count.
  - [x] `vercel.json` crons += `{ "path": "/api/cron/reengagement-push", "schedule": "0 10 * * *" }` (10:00 UTC — awake hours; ADR-019 pattern).
- [x] Task 5: Digest push (AC: 1, 3)
  - [x] In the weekly-digest cron (READ it first), after a digest is generated for a user: `dispatchCategorizedPush(userId, 'digest', { type: 'digest', title "Your weekly digest is ready", body one-liner, url: '/insights' })`. Non-fatal per user.
- [x] Task 6: Tests (all ACs)
  - [x] pushService: `dispatchCategorizedPush` — category flag off → no send; quiet hours → no send; defaults per category (nudges/reengagement opt-in false, others true); prefs read failure → no send + warn (never throw); payload/url pass-through. Existing `sendPushToUser`/quiet-hour tests untouched.
  - [x] tx POST: nudge dispatch still fires through the gate (update existing mocks — the route no longer reads prefs inline); achievement push fires once per batch, non-fatal.
  - [x] invitationService/householdMemberService tests: pushes now respect the household toggle (mock the gate instead of sendPushToUser where simpler).
  - [x] cron route tests (`@jest-environment node` FIRST docblock): 401 without secret; pushes only day-7 users; per-user failures don't abort the batch.
  - [x] Settings: 5 toggles render when subscribed; Blocked state has no subscribe path (AC4).
  - [x] Full verification: lint, tsc, `npx jest` (baseline 1952 passed / 54 skipped — additive only), build.

### Review Findings

Triple review 2026-07-15 (Blind Hunter / Edge Case Hunter / Acceptance Auditor): 22 raw -> 17 unique -> 13 patch (0 HIGH, 5 MED, 8 LOW) / 2 defer / 2 dismissed. AC verdict: 5 MET, AC3 PARTIAL (removal-push deep link).

- [x] [Review][Patch][MED] Cron telemetry lies — the gate never throws, so `errors` is structurally always 0 and `dispatched` counts gate-suppressed users as sent; the per-user-failure test exercises a rejection the real gate cannot produce — gate returns an outcome ('sent'|'suppressed'|'failed'), cron counts truthfully, test asserts real semantics [src/lib/services/pushService.ts; src/app/api/cron/reengagement-push/route.ts + test]
- [x] [Review][Patch][MED] Achievement push is fire-and-forget in a serverless runtime — the response can be sent (and the function frozen) while the gate still has reads + the web-push round trip outstanding; intermittently dropped — await it (the milestone push already is) [src/lib/services/achievementService.ts]
- [x] [Review][Patch][MED] Per-category toggles unreachable from a non-subscribed device — the 4 new switches gate on THIS device's isSubscribed while the flags are per-ACCOUNT (phone pushes, desktop can't turn them off; nudges toggle is inconsistently always-shown) — render all 5 when isSupported [src/app/(dashboard)/settings/page.tsx]
- [x] [Review][Patch][MED] Re-engagement scan .limit(500) silently truncates — users 501+ are permanently skipped (equality scan never retries them) with no warning — paginate in chunks w/ a hard cap + warn on truncation [src/app/api/cron/reengagement-push/route.ts]
- [x] [Review][Patch][MED] Quiet hours permanently swallow one-shot cron pushes (an opted-in user whose quiet window covers the cron hour gets ZERO re-engagement/digest pushes, ever) — suppression is ACCEPTED for now but must be a documented decision in the route + gate comments; deferral mechanism deferred [src/app/api/cron/reengagement-push/route.ts; weekly-digest; pushService]
- [x] [Review][Patch][LOW] Milestone FP re-fire guard + concurrency note — float subtraction can re-derive 24.999... and re-fire an already-passed milestone; concurrent contributions can double-push (accepted, cosmetic, ms-window — document) — epsilon the crossing check + document [src/lib/services/householdGoalService.ts]
- [x] [Review][Patch][LOW] Milestone roster query error silently discarded — error never destructured, supabase returns errors as values so the catch never fires; zero pushes with no log — destructure + log [src/lib/services/householdGoalService.ts]
- [x] [Review][Patch][LOW] Day-key frame mixing honesty — last_log_date is user-local (±1 clamp), the cron target is server-UTC: perceived absence is 6-8 days across timezones and "10:00 UTC awake hours" is false at UTC±12+ — document as the accepted server-clock class; fix the test flake (expected key computed at assertion time straddling midnight) [src/app/api/cron/reengagement-push/route.ts + test]
- [x] [Review][Patch][LOW] Hook test leaks global.PushManager (no afterEach counterpart — later tests inherit phantom support); quiet-hours gate test covers only the milestones category despite its name [usePushNotifications.test.tsx; pushService.test.ts]
- [x] [Review][Patch][LOW] Task-6 overclaim: tx-route push mocks are STALE (still mock sendPushToUser/isWithinQuietHours; the route imports dispatchCategorizedPush = undefined — nudge dispatch silently degrades in tests) and no test asserts the nudge reaches the gate with category 'nudges' — update both tx test mocks + add the gate assertion [streak-hook.test.ts; allowance-tagging.test.ts]
- [x] [Review][Patch][LOW] Task-6 overclaim: achievement batch push entirely untested and silently no-ops in the suite (achievementService.test mocks supabase/server without createServiceRoleClient — the real gate throws and swallows) — mock the gate + add batch tests (one per batch, singular/plural body, none on empty, awaited) [achievementService.test.ts]
- [x] [Review][Patch][LOW] Task-2/6 overclaim: promised Settings render tests missing (5 toggles when supported; Blocked state) — deliver them [settings page test]
- [x] [Review][Patch][LOW] AC3 letter: member-removal push deep-links /settings not /household — KEEP (an evicted member has no household access; /household would 404-state) and record as the deliberate per-site exception [householdMemberService.ts + story note]
- [x] [Review][Defer] Quiet-hours deferral/retry for one-shot fixed-time cron pushes + missed-cron-day cohort loss (equality scan skips a day's cohort if the cron doesn't run) — needs a sent-marker/window design — deferred, design gap
- [x] [Review][Defer] Preferences read-modify-write race across adjacent Settings switches (last writer resurrects the other's old value) — pre-existing 8.3 JSONB merge design, this story just added more adjacent toggles — deferred, pre-existing
- Dismissed (2): /api/push/test calls sendPushToUser directly — BY DESIGN (user-initiated pipeline diagnostic to own devices; re-implements no preference logic; spec keeps 'test' type); JSON null flag value reads as default-ON via ?? (contrived — the UI sends booleans; profile PUT zod validation is pre-existing scope).

## Dev Notes

### Reuse map — this story is 80% wiring, do NOT reinvent

| Exists | Where | State |
|---|---|---|
| `sendPushToUser` (multi-device, 410/404 cleanup) | src/lib/services/pushService.ts | keep as-is; gate calls it |
| `isWithinQuietHours` + quiet-hour prefs | pushService + user.types | reuse in the gate |
| Worker push display + `notificationclick` deep link | worker/index.ts (merged into sw.js via customWorkerDir) | reuse — only reads title/body/data.url, any `type` works; `tag: nudge-${Date.now()}` is generic enough |
| `usePushNotifications` (isSupported/isSubscribed/permission/subscribe) + Settings On/Off/Blocked UI + iOS A2HS hint | src/lib/hooks + settings page (~line 900-1040) | extend the section, don't rebuild; AC4 already holds — verify + test |
| `push_nudges_enabled`, `quiet_hours_*`, `weekly_digest_enabled` prefs + `handleUpdatePreferences` | user.types + settings page | extend the union |
| Nudge dispatch (prefs + quiet inline) | tx POST `dispatchNudgePush` | REFACTOR through the gate |
| Household pushes (invite, accepted, removal) | invitationService:181,392; householdMemberService:127 | wire through the gate (currently unconditional) |
| Crons + CRON_SECRET guard | /api/cron/generate-insights etc. + vercel.json | copy the shape |
| PWA/VAPID deploy gotchas | MEMORY: VAPID public key must be NON-sensitive in Vercel; SW re-install needed after worker changes | worker/index.ts is UNTOUCHED this story → no SW cache concerns |

### Key decisions

- **NO migration**: all toggles live in the `user_profiles.preferences` JSONB (established pattern).
- **Defaults**: `nudges` + `reengagement` are opt-IN (false — interruptive marketing-ish); `milestones`/`household`/`digest` default ON for subscribed users (they opted into push; these are direct responses to their own/household activity). Each documented in user.types.
- **Server push copy is English** (nudge precedent — nudgeEngine builds English strings server-side; i18n'ing push payloads requires knowing the user's locale server-side — out of scope, matches house rule "insight text English in-engine").
- **One stateless re-engagement push per absence**: `last_log_date = today − 7` exactly — the cron fires daily so each absence crosses day-7 once. No dedup state, no spam. Users who return reset last_log_date. (Do NOT scan for ≥7 — that pushes daily forever.)
- **Achievement push batching**: one push per unlock batch (the 15-3 toast-cap lesson applies to the notification tray too).
- **Milestone thresholds**: reuse whatever the goal milestone celebration uses (25/50/75/100, `milestones_celebrated` column) — do not invent new thresholds; only cross-member shared-goal pushes are new (the contributor sees the in-app overlay already).

### What NOT to do (scope guards)

- Do NOT touch worker/index.ts (SW changes force PWA re-install — known deploy pain).
- Do NOT i18n push payloads; do NOT build a notification center/history; no read-receipts.
- Do NOT re-prompt logic changes — AC4 is verify + test only.
- Do NOT push for events 15-6..15-8 own (opt-out gating comes in 15-6 and will gate the CLIENT surfaces; pushes are gated by their own toggles here).
- comeback challenge CREATION stays create-on-read/log (15-4) — the cron only PUSHES, never creates challenges.
- Per-device granularity, notification grouping, action buttons: out of scope.

### Previous story intelligence (15-1..15-4 + reviews)

- Enrichment promises: `.catch` at creation; all pushes non-blocking (`.catch(() => {})` — the existing dispatchNudgePush call shape).
- Service-role for server-context reads of OTHER users' prefs (cron) and cross-member pushes; the gate uses service-role internally (crons have no user session).
- Chain mocks: every chained method + arg assertions; `@jest-environment node` FIRST docblock only.
- Migrations 034–037 all applied+verified in prod; grants gotcha: REVOKE unwanted defaults (no new tables this story, N/A).
- jest baseline: **1952 passed / 54 skipped** (5d61063). Additive only.
- Env: VAPID keys already configured in prod (battle-tested 2026-06-07); CRON_SECRET already set (3 existing crons).

### Project Structure Notes

- Gate lives IN pushService (it's the push domain home); cron at `src/app/api/cron/reengagement-push/route.ts`; no new hooks/components beyond the Settings toggles.
- i18n: extend the existing settings push-section namespace (locate the current "push" strings in messages/en.json — likely `settings.*`), en+bg parity.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-15.5 (FR32/FR33)]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-018 (categories + per-category toggles), #ADR-019 (cron pattern)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Journey 4 line 676 (re-engagement push), Journey 5 line 707 (shared-goal milestone push to partner)]
- [Source: src/lib/services/pushService.ts, worker/index.ts, src/app/api/transactions/route.ts#dispatchNudgePush, src/lib/services/invitationService.ts, src/lib/services/householdMemberService.ts, src/app/api/cron/*]
- [Source: docs/api-conventions.md#degradation-policy]

## Dev Agent Record

### Agent Model Used

claude-fable-5

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- All 6 tasks implemented. dispatchCategorizedPush is THE single gate (AC5): service-role prefs read, per-category flag (nudges/reengagement opt-IN false; milestones/household/digest default ON), quiet hours, never throws. All four pre-existing dispatch sites refactored through it (nudge in tx POST lost its inline pref reads; the three household sites were pushing UNCONDITIONALLY - recipients now have control).
- IMPLEMENTATION SIMPLIFICATION vs Task 3a: the achievement push lives INSIDE unlockAchievements (one point covers tx POST + score GET + comeback GET unlock sites; only truly-inserted batches push - idempotence means no push for lost races). One push per batch (15-3 toast-cap lesson applied to the tray).
- Shared-goal milestone push (UX Journey 5): contributeToHouseholdGoal computes before/after % from the authoritative SUM, thresholds 25/50/75/100 (client celebration parity), pushes every member EXCEPT the contributor via the gate; best-effort.
- Re-engagement cron: /api/cron/reengagement-push daily 10:00 UTC (vercel.json), CRON_SECRET timing-safe guard (generate-insights shape); scans streaks WHERE last_log_date = exactly 7 days ago (stateless one-push-per-absence; >= would spam daily), limit 500, allSettled per-user isolation. Gate enforces the opt-in toggle + quiet hours.
- Digest push: weekly-digest cron dispatches a heads-up after each generated digest (type digest, /insights), non-fatal per user.
- AC4 hardened beyond verify: subscribe() now guards permission === 'denied' BEFORE Notification.requestPermission (browsers already no-op + button already disabled; now no future code path can re-prompt either) + regression test; useCallback deps fixed ([isSupported, permission]).
- Settings: 5 category switches when subscribed (Blocked state untouched); UserPreferences +4 documented flags; notifications i18n en+bg extended (4 labels + 4 descriptions).
- worker/index.ts UNTOUCHED (no SW cache/PWA-reinstall risk). No migration (JSONB prefs).
- Verification: tsc clean, eslint clean, jest 1964 passed / 54 skipped (baseline 1952 + 12 net new: 6 gate, 4 cron, 1 digest-push, 1 AC4), build green (/api/cron/reengagement-push in manifest).

### File List

**New**
- `src/app/api/cron/reengagement-push/route.ts`
- `src/app/api/cron/reengagement-push/__tests__/route.test.ts`
- `src/lib/hooks/__tests__/usePushNotifications.test.tsx`

**Updated**
- `src/lib/services/pushService.ts` (PushCategory + dispatchCategorizedPush gate + PushPayload types)
- `src/app/api/transactions/route.ts` (dispatchNudgePush through the gate; inline pref reads deleted)
- `src/lib/services/invitationService.ts` (2 sites through the gate; urls -> /household)
- `src/lib/services/householdMemberService.ts` (removal push through the gate)
- `src/lib/services/achievementService.ts` (batch unlock push inside unlockAchievements)
- `src/lib/services/householdGoalService.ts` (shared-goal milestone push to other members)
- `src/app/api/cron/weekly-digest/route.ts` (digest-ready push)
- `src/lib/hooks/usePushNotifications.ts` (AC4 denied guard + deps)
- `src/types/user.types.ts` (+4 preference flags)
- `src/app/(dashboard)/settings/page.tsx` (5 category toggles + prop/union plumbing)
- `vercel.json` (reengagement-push cron)
- `messages/en.json`, `messages/bg.json` (notifications namespace +8 keys)
- `src/lib/services/__tests__/pushService.test.ts` (+6 gate tests)
- `src/lib/services/__tests__/invitationService.test.ts`, `__tests__/householdMemberService.test.ts` (gate signature)
- `src/app/api/cron/weekly-digest/__tests__/weekly-digest.test.ts` (gate mock + digest push test)
- `src/app/(dashboard)/settings/__tests__/notifications-toggles.test.tsx` (NEW, review patch: toggle render + Blocked)
- `src/lib/services/__tests__/achievementService.test.ts` (review patch: gate mock + batch push tests)
- `src/app/api/transactions/__tests__/streak-hook.test.ts`, `__tests__/allowance-tagging.test.ts` (review patch: unstaled push mocks + nudge gate assertion)

### Change Log

- 2026-07-15: Code review (triple: Blind Hunter / Edge Case Hunter / Acceptance Auditor) - 22 raw -> 17 unique -> 13 patch (0 HIGH, 5 MED, 8 LOW) / 2 defer / 2 dismissed; ALL 13 patches applied: dispatchCategorizedPush returns 'sent'|'suppressed'|'failed' (gate never throws - outcomes ARE the telemetry; cron counts truthfully); achievement batch push AWAITED (serverless freeze-after-response drops fire-and-forget); 4 category toggles no longer gated on per-device isSubscribed (per-account flags reachable from any supported device); reengagement scan paginates 500-chunks to a 5000 cap + truncation warn; quiet-hours-suppress-one-shot-cron decision documented in gate + both crons (deferral design -> deferred-work); milestone crossing epsilon (FP re-fire) + concurrency double-push documented accepted + roster query error now logged; day-key TZ honesty comment + cron test midnight-flake fix (expected key computed once, before GET); hook test restores global.PushManager; quiet-hours gate test covers ALL 5 categories; tx-route push mocks unstaled + nudge-through-gate assertion (streak-hook); achievement batch push tests (1/batch, singular/plural, none-on-empty, non-fatal); NEW notifications-toggles.test.tsx (5 toggles render unsubscribed+subscribed, Blocked badge + disabled button); member-removal push kept at /settings (evicted member has no household access) recorded as the deliberate AC3 per-site exception. Deferred: one-shot cron quiet-hours deferral/sent-marker + missed-cron-day cohort; prefs JSONB RMW race (pre-existing 8.3). Dismissed: /api/push/test gate bypass (by-design diagnostic); JSON null flag (contrived). Verification: tsc clean, lint clean, jest 1974 passed / 54 skipped (+10), build green. Status -> done.
- 2026-07-14: Story 15.5 implemented - push notifications (FR32/FR33, ADR-018/019): central dispatchCategorizedPush gate (per-category toggles + quiet hours, service-role, never throws) with ALL dispatch sites refactored through it; 5 Settings category toggles (nudges/reengagement opt-in, milestones/household/digest default-on) + UserPreferences flags (JSONB, no migration); achievement batch push inside unlockAchievements (covers all three unlock sites); shared-goal milestone push to other household members (25/50/75/100 parity); daily reengagement-push cron (day-7 exact match, stateless dedup, CRON_SECRET); digest-ready push in the weekly cron; AC4 hardened (denied guard before requestPermission + regression test); deep links per category via the existing worker notificationclick. worker/index.ts untouched. 12 net new tests. lint/tsc clean; jest 1964 passed / 54 skipped; build green. Status -> review.
