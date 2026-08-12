# Story 11.8: GDPR Account Deletion

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user who wants to leave the platform,
I want to delete my account with full cascade deletion of all personal data,
So that my privacy is protected and the app complies with GDPR.

## Acceptance Criteria

1. **Given** a logged-in user, **When** they initiate account deletion from settings, **Then** they must confirm the action with a secondary confirmation step (password re-entry modal).

2. **Given** a user confirms account deletion, **When** deletion completes, **Then** all personal data (transactions, categories, goals, insights, preferences, detected subscriptions, weekly digests, sessions, analytics events, feature state) is cascade deleted.

3. **Given** deletion is triggered, **When** the process completes, **Then** it completes within 30 days (in practice: immediately upon confirmation).

4. **Given** deletion succeeds, **When** the user is redirected, **Then** they are logged out, cannot sign back in with the same credentials, and are taken to the `/login` route.

5. **Given** a user navigates to Settings, **When** they see the Preferences section, **Then** a "Weekly Digest" toggle is visible allowing opt-in/out (default: enabled), and toggling it immediately saves the `weekly_digest_enabled` preference.

6. **Given** a user opens the deletion confirmation modal, **When** they read the data warning, **Then** the warning text explicitly lists all Phase 2 data types — goals, subscriptions, and weekly digests — in addition to the existing list.

## Tasks / Subtasks

- [x] Task 1: Add `weekly_digest_enabled` toggle to Settings page (AC: #5)
  - [x] 1.1 In `src/app/(dashboard)/settings/page.tsx`, add a `Switch` toggle to the Preferences section:
    - Import `Switch` and `FormHelperText` from `@chakra-ui/react`
    - Bind to `profile.preferences.weekly_digest_enabled ?? true` (default true)
    - Call `handleUpdatePreferences('weekly_digest_enabled', newValue)` on change
    - Local state: `const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true)`
    - Initialize in the `useEffect` that reads profile: `setWeeklyDigestEnabled(profile.preferences.weekly_digest_enabled ?? true)`
    - Place after the `dateFormat` Select, before the `LanguageSwitcher`
    - Chakra `Switch` uses `isChecked` (not `checked`) and `onChange={(e) => { setWeeklyDigestEnabled(e.target.checked); handleUpdatePreferences('weekly_digest_enabled', e.target.checked); }}`
  - [x] 1.2 `handleUpdatePreferences` already accepts `Partial<UserPreferences>` values — extend the `field` union type to include `'weekly_digest_enabled'`:
    ```typescript
    const handleUpdatePreferences = async (
      field: 'currency_format' | 'date_format' | 'weekly_digest_enabled',
      value: string | boolean
    ) => { ... }
    ```
    Note: The existing API route `PUT /api/user/profile` already handles arbitrary preference keys via `{ preferences: { [key]: value } }` — no route changes needed.

- [x] Task 2: Update i18n strings (AC: #5, #6)
  - [x] 2.1 In `messages/en.json`, update `settings.allDataDeleted`:
    ```json
    "allDataDeleted": "All your data including transactions, categories, goals, detected subscriptions, weekly digests, insights, and preferences will be permanently deleted.",
    ```
  - [x] 2.2 Add to `messages/en.json` under `settings` namespace:
    ```json
    "weeklyDigest": "Weekly Digest",
    "weeklyDigestDescription": "Receive a weekly summary of your spending every Monday",
    ```
  - [x] 2.3 Add Bulgarian equivalents to `messages/bg.json`:
    ```json
    "allDataDeleted": "Всички ваши данни, включително транзакции, категории, цели, открити абонаменти, седмични обобщения, прозрения и предпочитания, ще бъдат изтрити за постоянно.",
    "weeklyDigest": "Седмичен дайджест",
    "weeklyDigestDescription": "Получавайте седмично обобщение на разходите си всеки понеделник",
    ```

- [x] Task 3: Extend `handleUpdatePreferences` type signature (AC: #5)
  - [x] 3.1 In `src/app/(dashboard)/settings/page.tsx`, update the field union type:
    - Change `field: 'currency_format' | 'date_format'` to `field: 'currency_format' | 'date_format' | 'weekly_digest_enabled'`
    - Change `value: string` to `value: string | boolean`
    - The `body: JSON.stringify({ preferences: { [field]: value } })` call already handles booleans correctly
  - [x] 3.2 Add local state and `useEffect` initialization:
    ```typescript
    const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true);
    // Inside the profile useEffect:
    setWeeklyDigestEnabled(profile.preferences.weekly_digest_enabled ?? true);
    ```

- [x] Task 4: Tests (AC: all)
  - [x] 4.1 Update `src/app/(dashboard)/settings/page.tsx` tests (or create if none exist at `src/app/(dashboard)/settings/__tests__/`):
    - Verify the weekly digest toggle renders with default `checked=true`
    - Verify toggling it calls `handleUpdatePreferences('weekly_digest_enabled', false)`
    - Verify the preference is updated via `PUT /api/user/profile`
  - [x] 4.2 Add test to `src/components/settings/__tests__/ConfirmDeleteModal.test.tsx`:
    - **"deletion warning includes Phase 2 data types"**: verify modal body contains "goals", "subscriptions", "weekly digests", and "preferences" (string-contains assertion on `textContent`)
  - [x] 4.3 Update `src/components/settings/ConfirmDeleteModal.test.tsx` (or create) to verify the updated `allDataDeleted` text is rendered:
    - Mock `useTranslations('settings')` to return the updated string
    - Assert "goals" and "subscriptions" appear in the modal body

> **Note:** No new API routes, no new database migrations, no new service functions are needed. The cascade deletion was fully implemented in Story 8.3 and all Phase 2 tables (migrations 012–015) already have `REFERENCES auth.users(id) ON DELETE CASCADE`.

## Dev Notes

### What Already Exists (Do NOT Re-Implement)

- **`ConfirmDeleteModal.tsx`** (`src/components/settings/ConfirmDeleteModal.tsx`) — Complete password-confirmation modal from Story 8.3. Do NOT change the modal's structure or behavior — only update the `allDataDeleted` i18n string it uses.

- **`DELETE /api/user/account`** (`src/app/api/user/account/route.ts`) — Already handles authentication, password verification, transaction export check, and calls `deleteUserAccount`. Do NOT change this route.

- **`deleteUserAccount`** (`src/lib/services/settingsService.ts:213`) — Already deletes `user_profiles` then calls `adminClient.auth.admin.deleteUser(userId)`. Both are required; the DB CASCADE handles all child tables. Do NOT change this function.

- **Settings page "Danger Zone"** — The button + modal integration already exists in `src/app/(dashboard)/settings/page.tsx`. The `handleDeleteAccount` handler, `useDisclosure`, and `ConfirmDeleteModal` binding are already wired.

- **`handleUpdatePreferences`** — Already exists in the settings page for `currency_format` and `date_format`. It uses `PUT /api/user/profile` with `{ preferences: { [field]: value } }`. The API route already supports arbitrary preference keys.

- **`weekly_digest_enabled` type and default** — Already declared in:
  - `src/types/user.types.ts:28` — `weekly_digest_enabled?: boolean`
  - `src/lib/hooks/useUserPreferences.ts:23` — `weekly_digest_enabled: true` in `DEFAULT_PREFERENCES`

### Full Cascade DELETE Coverage (All Tables)

All 12 tables with user data have `REFERENCES auth.users(id) ON DELETE CASCADE` — verified in migrations:

| Table | Migration | CASCADE |
|-------|-----------|---------|
| `categories` | 001 | ✅ `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `transactions` | 001 | ✅ |
| `insights` | 001 | ✅ |
| `user_profiles` | 004 | ✅ |
| `analytics_events` | 005 | ✅ |
| `user_sessions` | 006 | ✅ |
| `user_feature_states` | 011 | ✅ |
| `detected_subscriptions` | 012 | ✅ |
| `goals` | 013 | ✅ |
| `goal_contributions` | 013 | ✅ |
| `weekly_digests` | 015 | ✅ |

`goal_milestones` (migration 014) is a column-only migration (adds `milestones_celebrated INTEGER[]` to `goals`) — no new table, no new cascade needed.

**Deletion order in `deleteUserAccount`:**
1. `supabase.from('user_profiles').delete().eq('id', userId)` — user-scoped client
2. `adminClient.auth.admin.deleteUser(userId)` — service-role client

This is correct. Step 1 is belt-and-suspenders; Step 2 (deleting auth user) triggers the DB-level CASCADE for all 11 child tables simultaneously.

### Architecture Compliance

1. **No new API routes** — `PUT /api/user/profile` already handles arbitrary preference updates.
2. **No new migrations** — All Phase 2 tables already have correct CASCADE DELETE.
3. **`handleUpdatePreferences` pattern** — extend the existing function, do NOT create a new one.
4. **Chakra `Switch` component** — already used in the codebase (see `src/components/ai/WeeklyDigestCard.tsx` does NOT use it, but Chakra Switch is documented). Import from `@chakra-ui/react`.
5. **i18n pattern** — same namespace `settings`, same `useTranslations('settings')` hook call already in settings page.
6. **`UserPreferences` type** — `weekly_digest_enabled?: boolean` is already declared. No type changes needed.

### File Structure Requirements

```
src/
├── app/
│   └── (dashboard)/
│       └── settings/
│           ├── page.tsx                     # MODIFY — add weekly digest toggle
│           └── __tests__/                   # CREATE or MODIFY
│               └── SettingsPreferences.test.tsx  # NEW test for toggle
├── components/
│   └── settings/
│       └── __tests__/
│           └── ConfirmDeleteModal.test.tsx  # CREATE — verify updated i18n text
messages/
├── en.json                                  # MODIFY — allDataDeleted, weeklyDigest keys
└── bg.json                                  # MODIFY — same keys in Bulgarian
```

Files NOT changed (already complete):
- `src/components/settings/ConfirmDeleteModal.tsx`
- `src/app/api/user/account/route.ts`
- `src/lib/services/settingsService.ts`
- `src/types/user.types.ts`
- All database migration files

### Testing Requirements

- **Settings page toggle test**: Mock `fetch` for `PUT /api/user/profile`; render settings page with a mock profile (include `preferences: { weekly_digest_enabled: true }`); find the toggle by label "Weekly Digest"; simulate toggle → assert fetch called with `{ preferences: { weekly_digest_enabled: false } }`
- **ConfirmDeleteModal test**: Wrap with `ChakraProvider`; mock `useTranslations` or pass i18n keys; verify modal body contains "goals" and "subscriptions" and "weekly digests"
- **Do NOT create integration tests** for the cascade itself — the cascade is at the database layer and is already verified by the migrations + existing service tests

### Previous Story Intelligence (Story 11.7)

- **`weekly_digest_enabled` was added** to `UserPreferences` and `DEFAULT_PREFERENCES` in Story 11.7, but deliberately **no settings UI was added** — that was deferred to Story 11.8
- **`handleUpdatePreferences` pattern** in settings page: look at how `currency_format` and `date_format` are handled — the `weekly_digest_enabled` toggle follows the exact same pattern but with a boolean value instead of a string value
- **`PUT /api/user/profile`** route: already handles `preferences` as a partial object merge — passing `{ weekly_digest_enabled: false }` will work without route changes

### Git Intelligence (Recent Commits)

- `278acaa` — ci: removed cron from coverage.yml (non-feature, skip)
- `1544c61` — Story 11.7: Added `WeeklyDigestCard`, cron route, `digestService`, `useWeeklyDigest`. Established `weekly_digest_enabled` as a preference field with `DEFAULT_PREFERENCES: true`.
- `55bc645` — Story 11.6 code review corrections (goalService patterns, service-role usage)
- `305b40b` — Story 11.5: `goalService.ts` established the service-function-accepts-client pattern

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.8 — Line 335] Acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR38 — Line 399] "full cascade deletion of all personal data and GDPR compliance"
- [Source: _bmad-output/planning-artifacts/prd.md#Compliance — Line 282] "Right to export (CSV/PDF — already exists), right to deletion (cascade all data), right to portability"
- [Source: src/components/settings/ConfirmDeleteModal.tsx] Existing deletion modal — do NOT restructure
- [Source: src/app/api/user/account/route.ts] Existing DELETE route — do NOT change
- [Source: src/lib/services/settingsService.ts:213] `deleteUserAccount` — do NOT change
- [Source: src/app/(dashboard)/settings/page.tsx] Settings page — location for new toggle; `handleUpdatePreferences` at line 230 to extend
- [Source: messages/en.json:292] `allDataDeleted` key to update
- [Source: src/types/user.types.ts:28] `weekly_digest_enabled?: boolean` — already declared
- [Source: src/lib/hooks/useUserPreferences.ts:23] `DEFAULT_PREFERENCES.weekly_digest_enabled = true` — already set
- [Source: supabase/migrations/012–015] All Phase 2 tables have CASCADE — no migration needed
- [Source: src/app/api/user/account/__tests__/route.test.ts] Existing account deletion tests for reference

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 4 tasks implemented; 5 new tests added across 2 suites — all 1172 tests green.
- `weekly_digest_enabled` toggle added to Settings Preferences section using Chakra `Switch` with `isChecked`, `onChange`; layout uses `HStack` (label + switch) with `FormHelperText` below for mobile responsiveness.
- `handleUpdatePreferences` signature extended to `string | boolean` — no route changes needed.
- `allDataDeleted` i18n updated in both `en.json` and `bg.json` to list Phase 2 data types (goals, subscriptions, weekly digests, preferences).
- `ConfirmDeleteModal.test.tsx` updated: existing regex updated to match new string; 1 new AC-11.8.6 test added.
- `page.test.tsx` updated: 4 new toggle tests (default enabled, explicitly disabled, toggle-off calls PUT, helper text rendered).
- Code review fix (M1): Restructured `FormControl` — `FormHelperText` moved below the label+switch row to prevent overflow on narrow screens.
- Code review fix (M2): Corrected task 4.2 documentation — test was added to `ConfirmDeleteModal.test.tsx`, not `route.test.ts`.
- TypeScript: clean. ESLint: clean. No regressions.

### File List

- src/app/(dashboard)/settings/page.tsx — MODIFIED (Switch + FormHelperText imports; weeklyDigestEnabled state; useEffect init; handleUpdatePreferences type; toggle JSX restructured with HStack + FormHelperText below)
- src/app/(dashboard)/settings/__tests__/page.test.tsx — MODIFIED (4 new weekly digest toggle tests)
- src/components/settings/__tests__/ConfirmDeleteModal.test.tsx — MODIFIED (regex updated for new allDataDeleted string + 1 new AC-11.8.6 Phase 2 data types test)
- messages/en.json — MODIFIED (allDataDeleted updated; weeklyDigest + weeklyDigestDescription added)
- messages/bg.json — MODIFIED (same 3 keys in Bulgarian)
