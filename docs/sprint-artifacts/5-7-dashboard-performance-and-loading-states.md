# Story 5.7: Dashboard Performance and Loading States

Status: drafted

## Story

As a user,
I want the dashboard to load quickly with smooth loading states,
So that I don't wait for data and the app feels responsive.

## Acceptance Criteria

**Given** I navigate to the dashboard
**When** The page is loading
**Then** I see skeleton loaders matching the final layout

**And** Dashboard loads within 2 seconds (as per NFR FR25)
**And** Skeleton loaders shown for StatCards (3 rectangles)
**And** Skeleton loaders shown for charts (chart-shaped placeholders)
**And** Skeletons match final component dimensions
**And** Data fetched server-side where possible (SSR for initial load)
**And** SWR caches data client-side for instant subsequent loads
**And** Real-time updates via Supabase Realtime subscriptions
**And** Chart updates complete within 300ms (as per NFR)
**And** Optimistic updates: new transactions appear immediately
**And** Error state if data fetch fails: "Unable to load dashboard. Retry"
**And** Retry button refetches data

## Tasks / Subtasks

- [ ] Add skeleton loaders to StatCards (AC: 2, 3, 4)
  - [ ] Modify `src/components/dashboard/StatCard.tsx`
  - [ ] Add `isLoading` prop to component
  - [ ] Use Chakra UI `<Skeleton>` component when loading
  - [ ] Skeleton dimensions match final StatCard (height, width)
  - [ ] Show 3 skeleton rectangles in grid layout
- [ ] Add skeleton loaders to charts (AC: 2, 3, 4)
  - [ ] Modify `src/components/dashboard/SpendingByCategory.tsx`
  - [ ] Modify `src/components/dashboard/SpendingTrends.tsx`
  - [ ] Add loading state check before rendering chart
  - [ ] Use Chakra UI `<Skeleton>` for chart placeholder
  - [ ] Skeleton dimensions match final chart (250-400px height)
  - [ ] Show chart-shaped rectangle (rounded corners)
- [ ] Implement server-side data fetching (AC: 5)
  - [ ] Modify `src/app/(dashboard)/page.tsx` to use Server Component
  - [ ] Fetch initial dashboard data on server (SSR)
  - [ ] Pass initial data to client components via props
  - [ ] Client components hydrate with initial data, then use SWR for updates
- [ ] Configure SWR caching (AC: 6)
  - [ ] Verify SWR hooks use 5-second deduplication interval
  - [ ] Configure `revalidateOnFocus: true` for all dashboard hooks
  - [ ] Set `revalidateOnReconnect: true` for auto-refresh on network reconnect
  - [ ] Ensure SWR cache persists across navigation
- [ ] Add Supabase Realtime subscriptions (AC: 7, 8, 9)
  - [ ] Modify dashboard hooks to subscribe to `transactions` table changes
  - [ ] Use Supabase Realtime: `supabase.channel().on('postgres_changes', ...)`
  - [ ] Subscribe to INSERT, UPDATE, DELETE events
  - [ ] Trigger SWR revalidation on transaction changes
  - [ ] Ensure updates appear within 300ms
  - [ ] Test optimistic updates: transaction added → dashboard updates immediately
- [ ] Implement error handling (AC: 10, 11)
  - [ ] Add error state to all dashboard components
  - [ ] Show error message: "Unable to load dashboard. Retry"
  - [ ] Add "Retry" button that triggers SWR `mutate()` to refetch
  - [ ] Use Chakra UI `Alert` component for error display
  - [ ] Log errors to console for debugging
- [ ] Performance optimization (AC: 1, 8)
  - [ ] Run Lighthouse audit on dashboard page
  - [ ] Target: Performance score >90
  - [ ] Target: Total load time <2 seconds
  - [ ] Target: Chart update time <300ms
  - [ ] Optimize API queries: ensure indexes on `user_id`, `date`, `category_id`
  - [ ] Consider lazy loading charts (dynamic imports) if needed
  - [ ] Profile with Next.js performance tools

## Dev Notes

### Architecture Alignment

**Loading Strategy:**
- Server-Side Rendering (SSR) for initial data fetch
- Client-side hydration with SWR for caching and updates
- Skeleton loaders prevent layout shift during loading

**SWR Configuration:**
- Deduplication interval: 5 seconds (multiple components share cache)
- Revalidate on focus: refresh data when user returns to tab
- Revalidate on reconnect: refresh data when network reconnects

**Realtime Strategy:**
- Supabase Realtime subscriptions on `transactions` table
- Triggers SWR revalidation on INSERT/UPDATE/DELETE
- Optimistic updates: UI updates before server confirmation (optional)

**Performance Targets:**
- Dashboard load: <2 seconds (NFR FR25)
- Chart updates: <300ms (NFR FR26)
- Lighthouse performance: >90

### Source Tree Components to Touch

**Existing Files to Modify:**
- `src/components/dashboard/StatCard.tsx` - Add skeleton loading state
- `src/components/dashboard/DashboardStats.tsx` - Pass loading state to StatCards
- `src/components/dashboard/SpendingByCategory.tsx` - Add skeleton + error handling
- `src/components/dashboard/SpendingTrends.tsx` - Add skeleton + error handling
- `src/components/dashboard/MonthOverMonth.tsx` - Add skeleton + error handling
- `src/app/(dashboard)/page.tsx` - Implement SSR data fetching
- `src/lib/hooks/useDashboardStats.ts` - Add Realtime subscription
- `src/lib/hooks/useSpendingByCategory.ts` - Add Realtime subscription
- `src/lib/hooks/useTrends.ts` - Add Realtime subscription
- `src/lib/hooks/useMonthOverMonth.ts` - Add Realtime subscription

**New Files to Create (Optional):**
- `src/components/dashboard/ChartSkeleton.tsx` - Reusable chart skeleton (optional)
- `src/components/dashboard/ErrorState.tsx` - Reusable error component (optional)

**Existing Files to Reference:**
- Chakra UI `Skeleton` component documentation
- SWR configuration options
- Supabase Realtime documentation

### Testing Standards Summary

**Manual Testing Checklist:**
1. **Initial Load:**
   - Navigate to dashboard → see skeleton loaders immediately
   - Skeletons appear for: 3 StatCards, pie chart, line chart, comparison section
   - Dashboard loads within 2 seconds (measure with DevTools Network tab)
2. **Skeleton Appearance:**
   - Skeletons match final component dimensions (no layout shift)
   - Smooth transition from skeleton to actual data
3. **Data Loading:**
   - Data fetches server-side on initial load (SSR)
   - Subsequent visits load instantly from SWR cache
4. **Realtime Updates:**
   - Add new transaction → dashboard updates within 300ms
   - Edit transaction → dashboard recalculates immediately
   - Delete transaction → dashboard updates
   - Test with multiple tabs open (should sync)
5. **Error Handling:**
   - Simulate API failure (block network) → error message appears
   - Error shows: "Unable to load dashboard. Retry"
   - Click "Retry" button → data refetches
   - Error clears when data loads successfully
6. **Performance:**
   - Run Lighthouse audit → Performance score >90
   - Measure load time → <2 seconds
   - Measure chart update time → <300ms (use DevTools Performance)
7. **SWR Caching:**
   - Navigate away from dashboard, return → data loads instantly
   - Switch tabs (blur), return (focus) → data revalidates
   - Disconnect/reconnect network → data revalidates

**Performance Testing:**
```bash
# Run Lighthouse audit
npx lighthouse http://localhost:3000/dashboard --view

# Measure chart update time
# Use browser DevTools → Performance tab → Record interaction
```

### Project Structure Notes

**Alignment with Unified Structure:**
- Uses Chakra UI Skeleton for loading states
- Follows Next.js SSR patterns for initial data
- SWR hooks centralized in `src/lib/hooks/`

**SSR Strategy:**
- Dashboard page as Server Component fetches initial data
- Client components receive initial data via props
- SWR hooks hydrate with initial data, then take over

**Realtime Implementation:**
- Single Realtime channel per dashboard page
- Subscribe to all transaction changes
- Revalidate all SWR hooks on change (efficient due to deduplication)

**Performance Optimizations:**
- Database indexes on `user_id`, `date`, `category_id` (should already exist from Epics 3 & 4)
- Server-side aggregation reduces payload size
- SWR deduplication prevents redundant API calls
- Lazy loading charts if initial bundle too large (optional)

**No Detected Conflicts:**
- SWR already used in other components (consistent pattern)
- Supabase Realtime available (architecture decision)
- Chakra UI Skeleton follows existing UI patterns

### References

- [Source: docs/PRD.md#FR25] - Dashboard loads within 2 seconds
- [Source: docs/PRD.md#FR26] - Chart updates complete within 300ms
- [Source: docs/PRD.md#FR43] - Skeleton loaders during data fetch
- [Source: docs/architecture.md#SWR-Configuration] - Caching strategy, revalidation
- [Source: docs/architecture.md#Supabase-Realtime] - Real-time subscriptions
- [Source: docs/ux-design-specification.md#Loading-States] - Skeleton loader design
- [Source: docs/sprint-artifacts/tech-spec-epic-5.md#Performance-Strategy] - SSR, caching, Realtime
- [Source: docs/sprint-artifacts/tech-spec-epic-5.md#Loading-States] - Skeleton implementation
- [Source: docs/epics.md#Story-5.7] - Full acceptance criteria and technical notes

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- Model name and version will be added during implementation -->

### Debug Log References

<!-- Debug logs will be added during implementation -->

### Completion Notes List

<!-- Implementation notes will be added during implementation -->

### File List

<!-- Modified files will be listed during implementation -->
