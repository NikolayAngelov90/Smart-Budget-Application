# Story 8.4: Data Sync Status and Multi-Device Information

Status: drafted

## Story

As a user,
I want to see that my data is syncing across devices,
So that I trust my data is backed up and accessible everywhere.

## Acceptance Criteria

**AC-8.4.1:** Sync Status Indicator
✅ "✓ All data synced" (green) when connected
✅ "Syncing..." (yellow) when pending
✅ "Offline" (red) when navigator.onLine === false

**AC-8.4.2:** Last Sync Timestamp
✅ Displays "Last synced: X minutes ago" in Settings or Dashboard header

**AC-8.4.3:** Real-Time Sync Indicator
✅ Status updates when transaction added on another device (Supabase Realtime)

**AC-8.4.4:** Automatic Sync
✅ All data automatically synced via Supabase Realtime (no manual sync button needed)

**AC-8.4.5:** Optional Device List (if implemented)
✅ Settings shows list of active devices/sessions
✅ Device name (e.g., "Chrome on Windows")
✅ Last active timestamp
✅ Current device highlighted
✅ Option to revoke session (logout from device)

**AC-8.4.6:** Mobile Display
✅ Sync status visible in header or settings on mobile

## Tasks / Subtasks

- [ ] Create useOnlineStatus custom hook (AC: 8.4.1, 8.4.2)
  - [ ] Create `src/lib/hooks/useOnlineStatus.ts`
  - [ ] Use Navigator.onLine API for online/offline detection
  - [ ] Listen to `online` and `offline` window events
  - [ ] Track last sync timestamp in localStorage or state
  - [ ] Return: isOnline (boolean), lastSync (timestamp), syncStatus ('synced' | 'syncing' | 'offline')

- [ ] Create sessionService (AC: 8.4.5 - optional)
  - [ ] Create `src/lib/services/sessionService.ts`
  - [ ] Implement `getActiveSessions()` function
  - [ ] Implement `revokeSession(sessionId)` function
  - [ ] Parse user agent for device name (e.g., "Chrome on Windows")

- [ ] Create API route for sessions (AC: 8.4.5 - optional)
  - [ ] Create `src/app/api/user/sessions/route.ts`
  - [ ] Implement GET handler to list user sessions using Supabase Auth admin API
  - [ ] Implement DELETE handler to revoke session
  - [ ] Ensure service role key used server-side only

- [ ] Create SyncStatusIndicator component (AC: 8.4.1, 8.4.2)
  - [ ] Create `src/components/shared/SyncStatusIndicator.tsx`
  - [ ] Use useOnlineStatus hook
  - [ ] Display status badge with icon and text
  - [ ] Green "✓ All data synced" when online and synced
  - [ ] Yellow "Syncing..." when pending operations
  - [ ] Red "Offline" when navigator.onLine === false
  - [ ] Display "Last synced: X minutes ago" tooltip or subtitle
  - [ ] Use Chakra UI Badge component

- [ ] Integrate Supabase Realtime for sync status (AC: 8.4.3, 8.4.4)
  - [ ] Subscribe to Supabase Realtime connection state changes
  - [ ] Update syncStatus state when Realtime broadcasts updates
  - [ ] Update lastSync timestamp when data changes detected
  - [ ] Use existing Supabase Realtime subscriptions from Story 3.4

- [ ] Add SyncStatusIndicator to Dashboard header (AC: 8.4.6)
  - [ ] Import SyncStatusIndicator in Dashboard layout
  - [ ] Position in header (top-right or near user avatar)
  - [ ] Ensure visible on mobile

- [ ] Add sync status to Settings page (AC: 8.4.2)
  - [ ] Add sync status section in Settings
  - [ ] Display last sync timestamp
  - [ ] Display current connection status

- [ ] Optional: Add device list to Settings (AC: 8.4.5)
  - [ ] Create DeviceList component
  - [ ] Fetch active sessions using sessionService
  - [ ] Display device name, last active time, current device indicator
  - [ ] Add "Revoke" button for each session (except current)
  - [ ] Confirm before revoking session
  - [ ] Refresh list after revocation

- [ ] Add responsive styling (AC: 8.4.6)
  - [ ] Mobile: compact sync indicator in header
  - [ ] Desktop: expanded sync status with timestamp
  - [ ] Test on mobile, tablet, desktop

- [ ] Write unit tests
  - [ ] Test useOnlineStatus hook (online/offline events, lastSync tracking)
  - [ ] Test SyncStatusIndicator component (all 3 states)
  - [ ] Test sessionService functions (if implemented)

- [ ] Write integration tests
  - [ ] Test sync status updates on Realtime events
  - [ ] Test sync status updates on online/offline events
  - [ ] Test device list display and revocation (if implemented)

## Dev Notes

- **Sync status derives from two sources:** (1) Navigator.onLine for network connectivity, (2) Supabase Realtime connection state for database sync.
- **No manual sync button:** Supabase Realtime automatically syncs all data. Status indicator is informational only.
- **Last sync timestamp:** Track timestamp of last successful Realtime message or database write. Store in localStorage to persist across page refreshes.
- **Device list (optional):** Requires Supabase Auth admin API (service role key). Must be called server-side only for security.
- **Real-time updates:** Use existing Supabase Realtime subscriptions from Transaction Management (Story 3.4). Listen to connection state changes and broadcast events.

### Project Structure Notes

**New Files:**
- `src/lib/hooks/useOnlineStatus.ts` - Custom hook for online/offline status
- `src/components/shared/SyncStatusIndicator.tsx` - Sync status badge component
- `src/lib/services/sessionService.ts` - Session management service (optional)
- `src/app/api/user/sessions/route.ts` - Sessions API route (optional)
- `src/components/settings/DeviceList.tsx` - Device list component (optional)

**Modified Files:**
- `src/app/(dashboard)/layout.tsx` - Add SyncStatusIndicator to header
- `src/app/(dashboard)/settings/page.tsx` - Add sync status and device list sections

**Alignment with Architecture:**
- Uses Navigator.onLine API (browser standard)
- Uses Supabase Realtime for connection state monitoring
- Uses Supabase Auth admin API for session management (server-side only)
- Uses Chakra UI Badge, Text components
- Uses date-fns for relative time formatting ("2 minutes ago")

### References

- [Tech Spec: Epic 8 - Story 8.4 Acceptance Criteria](../tech-spec-epic-8.md#story-84-data-sync-status-and-multi-device-information)
- [Tech Spec: User Flow 5 - Sync Status](../tech-spec-epic-8.md#user-flow-5-view-sync-status-story-84)
- [Tech Spec: Session/Device Tracking Data Models](../tech-spec-epic-8.md#data-models-and-contracts)
- [PRD: FR42 - Data persists and syncs across devices](../../PRD.md#functional-requirements)
- [PRD: FR43 - Automatic sync across logged-in devices](../../PRD.md#functional-requirements)
- [Architecture: Supabase Realtime](../../architecture.md#supabase-realtime)
- [Epics: Story 7.4 Technical Notes](../../epics.md#story-74-data-sync-status-and-multi-device-information)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

### File List
