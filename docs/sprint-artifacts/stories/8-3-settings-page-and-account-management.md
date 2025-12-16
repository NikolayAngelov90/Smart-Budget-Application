# Story 8.3: Settings Page and Account Management

Status: ready-for-dev

## Story

As a user,
I want a settings page to manage my account and preferences,
So that I can control my experience and data.

## Acceptance Criteria

**AC-8.3.1:** Settings Route
✅ Settings page accessible at `/settings` route

**AC-8.3.2:** Account Information Section
✅ Display name (editable)
✅ Email (read-only, from auth provider)
✅ Profile picture (from social login or uploadable)
✅ Account created date

**AC-8.3.3:** Data Export Section
✅ "Export Transactions (CSV)" button
✅ "Export Monthly Report (PDF)" button with month selector

**AC-8.3.4:** Privacy & Security Section
✅ Data storage location message: "Your data is securely stored in the cloud with bank-level encryption"
✅ "Delete my account" button with confirmation requirement

**AC-8.3.5:** Preferences Section
✅ Currency format selector (default: USD)
✅ Date format selector (default: MM/DD/YYYY)
✅ "Restart onboarding tutorial" button

**AC-8.3.6:** Optimistic UI Updates
✅ All profile changes save immediately with optimistic UI updates

**AC-8.3.7:** Success Feedback
✅ Success toasts displayed for each action (profile update, preference change)

**AC-8.3.8:** Account Deletion Confirmation
✅ Delete account requires confirmation modal + password re-entry
✅ Data automatically exported before deletion
✅ User logged out and redirected to login page after deletion

**AC-8.3.9:** Mobile Responsive
✅ Full-width sections, stacked layout on mobile devices

## Tasks / Subtasks

- [ ] Create database schema for user_profiles (AC: 8.3.2, 8.3.5)
  - [ ] Run Supabase migration to create `user_profiles` table
  - [ ] Add columns: id (UUID FK to auth.users), display_name, profile_picture_url, preferences (JSONB), created_at, updated_at
  - [ ] Enable RLS on user_profiles table
  - [ ] Create RLS policies: SELECT/UPDATE/INSERT for own profile only
  - [ ] Add trigger for updated_at timestamp

- [ ] Create TypeScript types (AC: 8.3.2, 8.3.5)
  - [ ] Define `UserProfile` interface in `src/types/user.types.ts`
  - [ ] Define `UserPreferences` interface with currency_format, date_format, onboarding_completed

- [ ] Create settingsService (AC: 8.3.2, 8.3.5)
  - [ ] Create `src/lib/services/settingsService.ts`
  - [ ] Implement `getUserProfile()` function
  - [ ] Implement `updateUserProfile()` function
  - [ ] Implement `updatePreferences()` function

- [ ] Create API routes (AC: 8.3.2, 8.3.5, 8.3.8)
  - [ ] Create `src/app/api/user/profile/route.ts`
  - [ ] Implement GET handler to fetch user profile
  - [ ] Implement PUT handler to update profile (display_name, profile_picture_url, preferences)
  - [ ] Validate authenticated user (Supabase Auth middleware)
  - [ ] Create `src/app/api/user/account/route.ts`
  - [ ] Implement DELETE handler for account deletion
  - [ ] Verify password using Supabase Auth
  - [ ] Generate CSV export before deletion
  - [ ] Delete user_profiles record
  - [ ] Delete auth.users record (cascades to transactions, categories, insights)

- [ ] Create Settings page component (AC: 8.3.1-8.3.9)
  - [ ] Create `src/app/(dashboard)/settings/page.tsx`
  - [ ] Add page metadata (title: "Settings")
  - [ ] Fetch user profile data on page load
  - [ ] Implement Account Information section with form fields
  - [ ] Implement Data Export section (integrate Story 8.1 and 8.2 buttons)
  - [ ] Implement Privacy & Security section with storage message
  - [ ] Implement Preferences section with selectors
  - [ ] Add "Delete my account" button

- [ ] Implement Account Information form (AC: 8.3.2, 8.3.6, 8.3.7)
  - [ ] Add display name Input (editable)
  - [ ] Add email Text (read-only)
  - [ ] Add profile picture Avatar/upload component
  - [ ] Add account created date (formatted, read-only)
  - [ ] Implement optimistic UI updates for display name changes
  - [ ] Show success toast on save

- [ ] Implement Preferences form (AC: 8.3.5, 8.3.6, 8.3.7)
  - [ ] Add currency format Select (options: USD, EUR, GBP - MVP: USD only enabled)
  - [ ] Add date format Select (options: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
  - [ ] Add "Restart onboarding tutorial" button
  - [ ] Implement immediate save on preference change
  - [ ] Show success toast on save

- [ ] Implement account deletion flow (AC: 8.3.8)
  - [ ] Create ConfirmDeleteModal component
  - [ ] Show confirmation modal with warning message
  - [ ] Add password input field for verification
  - [ ] Add "Cancel" and "Confirm Deletion" buttons
  - [ ] Trigger CSV export before deletion
  - [ ] Call DELETE /api/user/account with password
  - [ ] Handle errors (wrong password, deletion failure)
  - [ ] Logout user and redirect to /login on success

- [ ] Add responsive styling (AC: 8.3.9)
  - [ ] Use Chakra UI Stack/VStack for section layout
  - [ ] Full-width sections on mobile
  - [ ] Stacked layout for form fields
  - [ ] Test on mobile, tablet, desktop

- [ ] Write unit tests
  - [ ] Test settingsService functions (getUserProfile, updateUserProfile, updatePreferences)
  - [ ] Test API routes (GET/PUT /api/user/profile, DELETE /api/user/account)
  - [ ] Test RLS policies (user can only access own profile)

- [ ] Write component tests
  - [ ] Test Settings page renders all sections
  - [ ] Test profile update with optimistic UI
  - [ ] Test preference changes save immediately
  - [ ] Test account deletion modal flow

- [ ] Write E2E tests
  - [ ] Test full settings page workflow
  - [ ] Test profile update end-to-end
  - [ ] Test account deletion with password verification
  - [ ] Test account deletion exports data before deletion

## Dev Notes

- **Database schema:** New `user_profiles` table extends auth.users. Use JSONB for preferences to allow future expansion without schema changes.
- **Optimistic UI:** Use SWR's optimisticData option for immediate profile updates before server confirmation.
- **Profile picture upload:** Phase 1 - display social login profile picture. Phase 2 - allow custom upload to Supabase Storage.
- **Account deletion:** Irreversible operation. Requires multi-step confirmation (modal + password) to prevent accidental deletion. Automatically exports all user data as CSV before deletion.
- **RLS enforcement:** All API routes must verify authenticated user and rely on RLS policies for data access control.

### Project Structure Notes

**New Files:**
- `src/app/(dashboard)/settings/page.tsx` - Settings page component
- `src/app/api/user/profile/route.ts` - Profile GET/PUT API route
- `src/app/api/user/account/route.ts` - Account DELETE API route
- `src/lib/services/settingsService.ts` - Settings data service
- `src/types/user.types.ts` - UserProfile and UserPreferences interfaces
- `src/components/settings/ConfirmDeleteModal.tsx` - Account deletion confirmation modal

**Database Migrations:**
- New migration: Create `user_profiles` table with RLS policies

**Alignment with Architecture:**
- Follows Next.js App Router patterns for page and API routes
- Uses Chakra UI Form components (Input, Select, Button, FormControl, FormLabel)
- Uses SWR for data fetching and optimistic updates
- Uses react-hook-form + zod for form validation
- Uses Supabase Auth for password verification

### References

- [Tech Spec: Epic 8 - Story 8.3 Acceptance Criteria](../tech-spec-epic-8.md#story-83-settings-page-and-account-management)
- [Tech Spec: User Profile Data Models](../tech-spec-epic-8.md#data-models-and-contracts)
- [Tech Spec: User Flows 3 and 4 - Settings and Account Deletion](../tech-spec-epic-8.md#user-flow-3-update-profile-settings-story-83)
- [PRD: FR41 - Indicate data storage and protection](../../PRD.md#functional-requirements)
- [Architecture: Database Schema](../../architecture.md#database-schema)
- [Architecture: Authentication](../../architecture.md#authentication)
- [Epics: Story 7.3 Technical Notes](../../epics.md#story-73-settings-page-and-account-management)

## Dev Agent Record

### Context Reference

- [Story 8.3 Context](8-3-settings-page-and-account-management.context.xml)

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

### File List
