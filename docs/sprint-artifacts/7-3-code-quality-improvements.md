# Story 7.3: Code Quality Improvements

**Status:** ready

---

## User Story

As a **developer**,
I want **centralized Realtime subscription management and clear drill-down filter UI**,
So that **Supabase connection overhead is reduced and users understand when filters are active**.

---

## Acceptance Criteria

**Given** 5 separate Realtime subscriptions exist in dashboard hooks
**When** this story is completed
**Then** a single centralized subscription manager handles all transaction changes

**And** Centralized Realtime Manager:
- `src/lib/realtime/subscriptionManager.ts` created
- Single subscription to `transactions` table changes (INSERT, UPDATE, DELETE)
- Event emitter pattern for broadcasting changes to multiple listeners
- Hooks: `useRealtimeSubscription(callback)` for components to subscribe
- Automatic cleanup: Unsubscribe on component unmount
- Connection pooling: Reuse single Supabase Realtime channel
- Performance: 5 subscriptions reduced to 1 (80% reduction in overhead)

**And** Dashboard hooks refactored:
- `src/lib/hooks/useDashboardStats.ts` - Remove direct Realtime subscription, use manager
- `src/lib/hooks/useSpendingByCategory.ts` - Remove direct Realtime subscription, use manager
- `src/lib/hooks/useTrends.ts` - Remove direct Realtime subscription, use manager
- `src/lib/hooks/useMonthOverMonth.ts` - Remove direct Realtime subscription, use manager
- `src/components/dashboard/CategorySpendingChart.tsx` - Remove direct Realtime subscription, use manager
- All hooks listen to manager events instead of creating individual subscriptions
- SWR mutate() called on transaction change events (trigger revalidation)
- Real-time updates still work within 300ms (no performance degradation)

**And** Filter Breadcrumbs UI:
- `src/components/transactions/FilterBreadcrumbs.tsx` component created
- Reads `category` and `month` from URL query parameters (useSearchParams)
- Displays active filters: "Filtering: Dining (November 2024)"
- Shows category name (not ID) - looks up category from categories list
- Shows formatted month (e.g., "November 2024" not "2024-11")
- Clear button (X icon) removes filters and navigates to `/transactions`
- Styled with Chakra UI (Badge component for category, IconButton for X)
- Integrated into `src/app/transactions/page.tsx` (appears above transaction list)
- Works with drill-down from: Pie chart, Line chart, Month-over-month highlights

**And** Testing:
- Tests written for subscriptionManager (subscription/unsubscription, event emission)
- Tests written for FilterBreadcrumbs component (rendering, clear button)
- Integration tests verify dashboard hooks work with centralized manager
- Real-time latency still <300ms (benchmark from Story 7.2 validates)

---

## Implementation Details

### Tasks / Subtasks

#### Task 1: Create Centralized Realtime Subscription Manager
- [x] 1.1: Create `src/lib/realtime/subscriptionManager.ts`
  - Import Supabase client (createBrowserClient)
  - Create singleton instance (only one manager per app)
  - Initialize Supabase Realtime channel: `supabase.channel('transactions-changes')`
- [x] 1.2: Implement event emitter pattern
  - Use EventEmitter from Node.js events module (or mitt library for browser)
  - Events: 'transaction-inserted', 'transaction-updated', 'transaction-deleted'
  - Emit event payload: {eventType, new: newRecord, old: oldRecord}
- [x] 1.3: Set up Realtime subscription
  - Subscribe to `transactions` table: `.on('postgres_changes', {event: '*', schema: 'public', table: 'transactions'}, callback)`
  - On INSERT: Emit 'transaction-inserted' with new transaction data
  - On UPDATE: Emit 'transaction-updated' with old and new transaction data
  - On DELETE: Emit 'transaction-deleted' with old transaction data
  - Subscribe to channel: `channel.subscribe()`
- [x] 1.4: Implement `useRealtimeSubscription` hook
  - Accept callback function: `(event: RealtimeEvent) => void`
  - Subscribe to manager events on mount: `manager.on('transaction-*', callback)`
  - Unsubscribe on unmount: `manager.off('transaction-*', callback)`
  - Return: null (hook manages subscription lifecycle only)
- [x] 1.5: Implement cleanup and connection management
  - Track listener count (increment on .on(), decrement on .off())
  - If listener count reaches 0, close Realtime channel (no active subscribers)
  - Reopen channel when new listener added (lazy initialization)
  - Export singleton: `export const realtimeManager = new RealtimeSubscriptionManager()`

#### Task 2: Refactor Dashboard Hooks to Use Manager
- [x] 2.1: Refactor `src/lib/hooks/useDashboardStats.ts`
  - Remove existing Realtime subscription code (lines with `supabase.channel()`)
  - Import: `import { useRealtimeSubscription } from '@/lib/realtime/subscriptionManager'`
  - Add: `useRealtimeSubscription((event) => { mutate() })` in useEffect
  - Effect: On any transaction change, trigger SWR revalidation
  - Test: Dashboard stats update within 300ms after transaction insert
- [x] 2.2: Refactor `src/lib/hooks/useSpendingByCategory.ts`
  - Remove existing Realtime subscription code
  - Add: `useRealtimeSubscription((event) => { mutate() })`
  - Test: Pie chart data updates within 300ms after transaction insert
- [x] 2.3: Refactor `src/lib/hooks/useTrends.ts`
  - Remove existing Realtime subscription code
  - Add: `useRealtimeSubscription((event) => { mutate() })`
  - Test: Line chart data updates within 300ms after transaction insert
- [x] 2.4: Refactor `src/lib/hooks/useMonthOverMonth.ts`
  - Remove existing Realtime subscription code
  - Add: `useRealtimeSubscription((event) => { mutate() })`
  - Test: Month-over-month highlights update within 300ms after transaction insert
- [x] 2.5: Refactor `src/components/dashboard/CategorySpendingChart.tsx`
  - If component has direct Realtime subscription, remove it
  - Hook already uses `useSpendingByCategory` which now uses manager
  - No changes needed if subscription is in hook (verify)
- [x] 2.6: Verify all dashboard components work
  - Open dashboard in browser
  - Open devtools Network tab
  - Verify only 1 Realtime WebSocket connection (not 5)
  - Create a transaction
  - Verify all dashboard components update within 300ms

#### Task 3: Create Filter Breadcrumbs Component
- [x] 3.1: Create `src/components/transactions/FilterBreadcrumbs.tsx`
  - Import: Chakra UI (HStack, Badge, IconButton, Text), Next.js (useSearchParams, useRouter), React Icons (MdClose)
  - Read query params: `const searchParams = useSearchParams(); const category = searchParams.get('category'); const month = searchParams.get('month');`
  - If no filters active (both null), return null (don't render breadcrumbs)
- [x] 3.2: Look up category name from ID
  - Fetch categories using SWR: `const { data: categories } = useSWR('/api/categories')`
  - Find category: `const categoryObj = categories?.find(c => c.id === category)`
  - Display name: `categoryObj?.name || 'Unknown Category'`
  - Display color badge: Use CategoryBadge component (variant="badge")
- [x] 3.3: Format month display
  - Parse month string: `const [year, monthNum] = month.split('-')`
  - Format with date-fns: `format(new Date(year, monthNum - 1), 'MMMM yyyy')` → "November 2024"
  - Display in Text component
- [x] 3.4: Implement clear filters button
  - IconButton with MdClose icon
  - onClick: `router.push('/transactions')` (removes all query params)
  - aria-label: "Clear filters"
  - Size: "sm", variant: "ghost", colorScheme: "gray"
- [x] 3.5: Style breadcrumbs container
  - HStack with spacing={2}, padding={4}, bg="gray.50", borderRadius="md"
  - Text: "Filtering:" (fontWeight: "semibold")
  - Category badge + month text + clear button
  - Responsive: Full width on mobile, auto width on desktop

#### Task 4: Integrate Filter Breadcrumbs into Transaction Page
- [x] 4.1: Modify `src/app/transactions/page.tsx`
  - Import FilterBreadcrumbs component
  - Add above TransactionList component: `<FilterBreadcrumbs />`
  - Ensure component has access to useSearchParams (client component)
  - If page is server component, extract FilterBreadcrumbs to separate client component
- [x] 4.2: Test drill-down from pie chart
  - Click on "Dining" slice in CategorySpendingChart
  - Navigate to /transactions?category=dining-id&month=2024-11
  - Verify breadcrumbs show: "Filtering: Dining (November 2024)"
  - Click X button
  - Verify navigate to /transactions (filters cleared)
- [x] 4.3: Test drill-down from line chart
  - Click on November data point in SpendingTrendsChart
  - Navigate to /transactions?month=2024-11
  - Verify breadcrumbs show: "Filtering: November 2024" (no category)
  - Click X button
  - Verify filters cleared
- [x] 4.4: Test drill-down from month-over-month
  - Click on a category change in MonthOverMonth component
  - Navigate to /transactions?category=dining-id&month=2024-11
  - Verify breadcrumbs show correctly
  - Click X button
  - Verify filters cleared

#### Task 5: Write Tests
- [x] 5.1: Create `__tests__/lib/realtime/subscriptionManager.test.ts`
  - Test: Singleton instance (only one manager exists)
  - Test: Subscribe to events (listener receives transaction-inserted event)
  - Test: Unsubscribe from events (listener stops receiving events)
  - Test: Connection management (channel closes when no listeners, reopens when listener added)
  - Test: Event payload structure (correct data passed to listeners)
  - Mock Supabase Realtime channel for tests
- [x] 5.2: Create `__tests__/components/transactions/FilterBreadcrumbs.test.tsx`
  - Test: Renders nothing when no filters active
  - Test: Renders category filter (shows category name from ID)
  - Test: Renders month filter (formatted as "November 2024")
  - Test: Renders both filters (category + month)
  - Test: Clear button navigates to /transactions
  - Mock useSearchParams and useRouter from next/navigation
  - Mock SWR response for categories
- [x] 5.3: Integration test: Dashboard hooks with manager
  - Create `__tests__/integration/dashboard-realtime.test.tsx`
  - Render dashboard page
  - Emit 'transaction-inserted' event from manager
  - Assert all dashboard hooks trigger revalidation (mutate called)
  - Assert updates appear within 300ms
  - Verify only 1 Realtime subscription active (not 5)

#### Task 6: Performance Validation
- [x] 6.1: Run benchmark from Story 7.2
  - Ensure Story 7.2 benchmark script exists: `scripts/benchmark.ts`
  - Run: `npm run benchmark`
  - Verify real-time latency <300ms (same or better than before refactoring)
  - If latency increased, investigate and optimize
- [x] 6.2: Verify Supabase connection count
  - Open Supabase dashboard → Database → Connections
  - Check active Realtime connections
  - Verify: Only 1 connection per user session (not 5)
  - Calculate: 80% reduction in connection overhead
- [x] 6.3: Load test with multiple dashboard components
  - Open dashboard page with all components visible
  - Open Network tab in devtools
  - Filter: WS (WebSocket connections)
  - Verify: Only 1 WebSocket connection to Supabase Realtime
  - Create transaction via API
  - Verify: All components update simultaneously (within 300ms)

### Technical Summary

**Realtime Manager Architecture:**
- **Pattern:** Singleton + Event Emitter
- **Benefits:**
  - Reduces Supabase connection overhead (5 → 1 subscription)
  - Centralized subscription management
  - Easy to add new listeners (any component can subscribe)
  - Automatic cleanup (listeners removed on unmount)
- **Implementation:** EventEmitter pattern with useEffect hook
- **Connection Management:** Lazy initialization, close when no listeners

**Filter Breadcrumbs Architecture:**
- **Pattern:** Controlled component reading from URL state
- **Benefits:**
  - Clear visual feedback for active filters
  - Easy to clear filters (single button)
  - Deep linkable (URL contains filter state)
  - Works with browser back button
- **Implementation:** useSearchParams + useRouter from Next.js
- **Styling:** Chakra UI (HStack, Badge, IconButton)

**Testing Strategy:**
- Unit tests for subscriptionManager (event emitter logic)
- Component tests for FilterBreadcrumbs (rendering, interactions)
- Integration tests for dashboard hooks + manager (real-time updates)
- Performance validation from Story 7.2 benchmarks

### Project Structure Notes

**Files to create:**
- `src/lib/realtime/subscriptionManager.ts` - Centralized Realtime manager
- `src/components/transactions/FilterBreadcrumbs.tsx` - Filter breadcrumbs component
- `__tests__/lib/realtime/subscriptionManager.test.ts` - Manager unit tests
- `__tests__/components/transactions/FilterBreadcrumbs.test.tsx` - Breadcrumbs tests
- `__tests__/integration/dashboard-realtime.test.tsx` - Integration test

**Files to modify:**
- `src/lib/hooks/useDashboardStats.ts` - Remove Realtime, use manager
- `src/lib/hooks/useSpendingByCategory.ts` - Remove Realtime, use manager
- `src/lib/hooks/useTrends.ts` - Remove Realtime, use manager
- `src/lib/hooks/useMonthOverMonth.ts` - Remove Realtime, use manager
- `src/components/dashboard/CategorySpendingChart.tsx` - Verify uses hook (not direct subscription)
- `src/app/transactions/page.tsx` - Add FilterBreadcrumbs component

**Prerequisites:**
- Story 7.1 (tests validate refactoring doesn't break functionality)
- Story 7.2 (performance benchmarks validate no latency increase)

### Key Code References

**Existing code to refactor:**
- `src/lib/hooks/useDashboardStats.ts` - Has Realtime subscription (remove)
- `src/lib/hooks/useSpendingByCategory.ts` - Has Realtime subscription (remove)
- `src/lib/hooks/useTrends.ts` - Has Realtime subscription (remove)
- `src/lib/hooks/useMonthOverMonth.ts` - Has Realtime subscription (remove)
- `src/components/dashboard/CategorySpendingChart.tsx` - May have Realtime subscription (check and remove if exists)

**Existing patterns to follow:**
- `src/components/categories/CategoryBadge.tsx` - Reuse for category display in breadcrumbs
- `src/lib/supabase/client.ts` - Supabase client factory (use for Realtime)
- `src/app/transactions/page.tsx` - Transaction filtering logic (already reads URL params)

**Drill-down sources (integrate with breadcrumbs):**
- `src/components/dashboard/CategorySpendingChart.tsx` - Pie chart onClick → /transactions?category&month
- `src/components/dashboard/SpendingTrendsChart.tsx` - Line chart onClick → /transactions?month
- `src/components/dashboard/MonthOverMonth.tsx` - Change item onClick → /transactions?category&month

---

## Context References

**Tech-Spec:** [tech-spec-epic-7-testing-quality.md](tech-spec-epic-7-testing-quality.md) - Code quality improvements design

**Epic:** [epic-7-testing-quality.md](epic-7-testing-quality.md) - Epic overview

**Retrospective Context:**
- [epic-5-retrospective.md](epic-5-retrospective.md) - Identified multiple Realtime subscriptions inefficiency, missing filter breadcrumbs

---

## Dev Agent Record

### Implementation Priority

**Depends on Story 7.1** (needs test coverage to validate refactoring safety).

**Why this matters:**
- 5 Realtime subscriptions create unnecessary overhead (Supabase connection limits)
- Inefficient resource usage (each subscription has overhead)
- Users confused by drill-down filters (no visual feedback)
- Drill-down navigation works but UX needs polish

**Success Definition:**
✅ Single Realtime subscription (5 → 1, 80% reduction)
✅ All dashboard components update within 300ms
✅ Filter breadcrumbs show active drill-down filters
✅ Clear button removes filters and returns to full list

### Agent Model Used

<!-- Will be populated during dev-story execution -->

### Debug Log References

<!-- Will be populated during dev-story execution -->

### Completion Notes

<!-- Will be populated during dev-story execution -->

### Files Modified

<!-- Will be populated during dev-story execution -->

### Test Results

<!-- Will be populated during dev-story execution -->

---

## Review Notes

<!-- Will be populated during code review -->
