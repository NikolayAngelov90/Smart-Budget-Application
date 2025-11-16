### Story 3.4: Transaction Data Persistence and Sync

As a user,
I want my transactions to persist securely and sync across all my devices,
So that I never lose data and can access it anywhere.

**Acceptance Criteria:**

**Given** I add, edit, or delete transactions
**When** I refresh the page or switch devices
**Then** All changes are persisted and synced

**And** Transactions saved immediately to Supabase on creation/update/delete
**And** No data loss on browser refresh or unexpected shutdown
**And** Changes visible on all logged-in devices within 5 seconds
**And** Real-time sync via Supabase Realtime subscriptions
**And** Offline changes queued and synced when connection restored (Phase 2)
**And** Conflict resolution: last-write-wins for concurrent edits
**And** Transaction history retained indefinitely unless user deletes
**And** Database Row Level Security ensures user can only access own transactions
**And** Transaction timestamps stored in UTC, displayed in user's local timezone
**And** Data integrity maintained: foreign key constraints prevent orphaned records

**Prerequisites:** Story 3.1 (transactions created), Story 1.2 (database with RLS)

**Technical Notes:**
- All CRUD operations use Supabase client with RLS policies
- Subscribe to real-time changes: `supabase.channel('transactions').on('postgres_changes', ...)`
- SWR revalidation on focus and reconnect
- Store timestamps in PostgreSQL as `TIMESTAMP WITH TIME ZONE`
- Display dates using date-fns with user's timezone
- Test multi-device sync: open app in 2 browser windows, verify changes appear
- RLS policies already defined in Story 1.2: `auth.uid() = user_id`
- Handle connection errors gracefully (retry logic, offline indicator)
- Index on user_id + date for fast queries
