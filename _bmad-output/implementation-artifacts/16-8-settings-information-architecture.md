---
baseline_commit: 2214a16
---

# Story 16.8: Settings Information Architecture (index + sub-pages)

Status: done

<!-- Epic 16 follow-on, requested by the user after 16-5 shipped. -->

## Story

As a person managing my account,
I want Settings to be a short index whose groups open their own pages,
so that I can find a setting quickly instead of scrolling one 1200-line page.

## Problem

`/settings` is a single 1214-line page of ~12 stacked cards. Concretely:

- **Feature content outranks the user's own account**: the Values plan and
  Achievements cards sit ABOVE Account information.
- **Related settings are split**: Appearance is separated from Preferences, and
  push notifications live in a different card from the weekly-digest toggle even
  though both are notifications.
- **Duplicate navigation**: the "Manage" card links to Categories and Goals,
  which PR #12 already surfaces in the mobile More sheet and the desktop sidebar.
- The result is a long mobile scroll with no way to jump to a group.

## Acceptance Criteria

1. **Given** `/settings` **When** it renders **Then** it is a short INDEX of tappable rows (icon + label + chevron), one per group, in this order: **Account, Appearance, Preferences, Notifications, Personalization, Data & export, Security, About** — with **Delete account** as a separate destructive row at the end.
2. **And** each row opens its own route (`/settings/account`, `/settings/appearance`, `/settings/preferences`, `/settings/notifications`, `/settings/personalization`, `/settings/data`, `/settings/security`, `/settings/about`), deep-linkable and back-navigable.
3. **And** each sub-page uses one shared shell: a back affordance to `/settings`, the group title, and the group's content.
4. **Given** the Manage card **When** the redesign lands **Then** it is REMOVED — Categories/Goals are reachable from the sidebar (desktop) and the More sheet (mobile).
5. **Given** notifications **When** shown **Then** the weekly-digest toggle and the push-notification controls appear together under **Notifications**.
6. **Given** ALL existing behavior **When** exercised **Then** it is preserved with the same handlers: profile name + picture, currency/date/language, weekly digest, push (subscribe/unsubscribe/test/quiet hours), gamification toggle, show-all-features, restart onboarding, values plan, achievements, CSV/PDF export, sync status, active devices + revoke, financial disclaimer, and GDPR account deletion.
7. **Given** verification **Then** `tsc`, `npm run lint`, full `jest` (baseline 2118 pass — zero regressions) and `next build` pass; any new strings exist in BOTH `messages/en.json` and `messages/bg.json`.
8. **Given** mobile + desktop **When** viewed **Then** rows are ≥44px, no 320px overflow, visible focus, AA contrast in BOTH colour modes.

## Tasks / Subtasks

- [x] **Task 1: Extract shared state (AC: 6)**
  - [x] `useSettingsProfile` hook owning profile load + `updatePreference`, so sub-pages share one implementation instead of duplicating ~250 lines.

- [x] **Task 2: Section components (AC: 5, 6)**
  - [x] Split the page body into `components/settings/sections/*`: Account, Appearance, Preferences, Notifications (digest + push MERGED), Personalization (gamification, show-all, restart onboarding, values, achievements), Data (export + sync), Security (devices + privacy), About (disclaimer), DangerZone (delete).
  - [x] Move each block verbatim; colours/handlers unchanged.

- [x] **Task 3: Shell + routes + index (AC: 1, 2, 3, 4)**
  - [x] `SettingsSubPage` shell (back link + title).
  - [x] Eight routes under `src/app/(dashboard)/settings/`.
  - [x] `/settings` becomes the index; DELETE the Manage card.

- [x] **Task 4: Verify (AC: 7, 8)**
  - [x] Gate + live QA in both modes at 390 and 1440; every group reachable, back works, deep links work.

## Dev Notes

- Source: `src/app/(dashboard)/settings/page.tsx` (1214 lines). Shared state: profile via `PROFILE_KEY`/`refreshProfile`, `handleUpdatePreferences` (a single PUT used by every toggle), export handlers, `handleDeleteAccount`.
- Existing child components to reuse as-is: `ProfilePictureUpload`, `LanguageSwitcher`, `AchievementsSection`, `ActiveDevicesSection`, `AppearanceSection`, `ValuesPlanSection`, `SyncStatusIndicator`, `FinancialDisclaimer`, `ConfirmDeleteModal`, and the in-file push-notifications card.
- Keep the existing settings-page test green (`src/app/(dashboard)/settings/__tests__/page.test.tsx`) or move its assertions to the sub-page that now owns them.

### References

- [Source: user request 2026-07-27] — rearrange top-to-bottom, submenus, drop the Categories/Goals links.

## Dev Agent Record

### Implementation

`/settings` went from 1214 lines to a 148-line index of 8 rows plus the danger
zone. Each group owns a route under `src/app/(dashboard)/settings/` and renders
through `SettingsSubPage`. Shared profile state lives in `useSettingsProfile`.
The Manage card is gone; Categories/Goals stay reachable from the sidebar and
the More sheet.

### Review findings and resolutions

Three independent reviewers (blind bug hunter, edge case hunter, acceptance
auditor) converged on the same top three regressions. All are fixed.

1. **Profile-load failure rendered a dead UI (HIGH).** The pre-split page had an
   error + retry branch; the split kept only the spinner. Because the fetch
   clears its loading flag on the error path too, the gate opened onto a NULL
   profile: sections showed hardcoded defaults as if they were the user's saved
   settings, and every write silently no-opped (both save actions early-return
   when profile is null) — no error, no toast, nothing in the console.
   *Fix:* the hook exposes `status: 'loading' | 'failed' | 'ready'`, and
   `SettingsSectionGate` renders the error + in-place retry for `failed`.
   Covered by `__tests__/profile-load-failure.test.tsx`.

2. **Profile picture appeared to revert on upload (HIGH).** The move dropped a
   `setProfile(json.data)` from the upload callback, leaving only the SWR write.
   The header updated; this card kept the stale URL, so the new picture vanished
   the moment the success toast fired, and Remove stayed unavailable.
   *Fix:* the hook exposes `reload()`, and the callback uses it.

3. **Exports could use the wrong currency (HIGH).** `DataSection` was the one
   profile-dependent section with no gate, so the export buttons were live while
   `currencyFormat` was still the hardcoded `'EUR'`.
   *Fix:* gated like every other section — **and** the underlying cause was
   deeper: currency/date/digest/gamification/show-all were `useState` mirrors
   synced by an effect, so they lagged the profile by one render (the render the
   gate opens on) and were never rolled back when a PUT failed. They are derived
   from `profile` now, which closes both. Covered by
   `__tests__/preference-save.test.tsx`.

Also fixed: the achievement push deep-linked to `/settings`, which is now a bare
menu (→ `/settings/personalization`; test push → `/settings/notifications`);
`notifications.pushHeading` was added but never wired, so "Notifications"
rendered twice; the data-sync copy and the disclaimer heading were dropped in
the move; `<h2>`s had been demoted to styled `<Text>`; the back link had no
focus ring; and the dead `manageHeading`/`manageGoals` keys were removed.

Live QA then found three WCAG AA failures — raw Chakra colours that had survived
the redesign: the push enable button (`blue.500`, 4.03:1), the CSV export button
(`green.500`, 3.25:1) and the "Locked" achievement badge (`gray.500`, 3.39:1).
All three are on-palette now.

Deferred (pre-existing, already tracked in `deferred-work.md`): the preferences
read-modify-write race in `settingsService`. The split does not make it worse —
the client PUTs a single key, never a whole snapshot, and only one hook instance
mounts per route.

### Verification

- `tsc --noEmit`, `npm run lint`: clean.
- `jest`: 2152 passed / 54 skipped (baseline 2118 — zero regressions, +34 new).
- `next build`: all 9 settings routes emitted.
- Live QA: 36 page-views (9 routes x light/dark x 390/1440) — 0 horizontal
  overflow, 0 AA contrast failures, 0 raw i18n keys, 0 console errors.
- `messages/en.json` / `messages/bg.json`: 913 keys each, full parity.

### File List

- Added: `src/lib/hooks/useSettingsProfile.ts`,
  `src/components/settings/SettingsSubPage.tsx`,
  `src/components/settings/SettingsSectionGate.tsx`,
  `src/components/settings/sections/*` (9 components),
  8 routes under `src/app/(dashboard)/settings/`,
  4 test files under `src/app/(dashboard)/settings/__tests__/`.
- Modified: `src/app/(dashboard)/settings/page.tsx`,
  `src/components/settings/AchievementsSection.tsx`,
  `src/lib/services/achievementService.ts`, `src/app/api/push/test/route.ts`,
  `messages/en.json`, `messages/bg.json`, `.gitignore`.
