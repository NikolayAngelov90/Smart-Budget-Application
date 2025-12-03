# Story 6.3: Full AI Insights Page with Filtering

Status: drafted

## Story

As a user,
I want to view all my AI insights and filter by type,
So that I can review all recommendations and learn from patterns.

## Acceptance Criteria

**Given** I navigate to the Insights page
**When** I view and filter insights
**Then** I see all generated insights with filtering options

**AC1: Insights Page Route**
- Insights page accessible at `/insights` route
- Page uses dashboard layout (includes sidebar navigation)

**AC2: Insights Display**
- All insights displayed in chronological order (newest first)
- Each insight card shows: type badge, title, description, date generated, dismiss button

**AC3: Type Filter**
- Filter dropdown with options: All Types, Spending Increases, Budget Recommendations, Unusual Expenses, Positive Reinforcement
- Selecting filter updates displayed insights immediately

**AC4: Dismissed Insights Toggle**
- Toggle switch: "Show dismissed insights" (off by default)
- When enabled, dismissed insights appear grayed out with "Dismissed" badge

**AC5: Dismiss and Undismiss**
- Click "Dismiss" marks insight as not relevant (updates `is_dismissed = true`)
- Dismissed insights show "Undismiss" option to toggle back
- Dismissed insights are hidden by default (unless toggle is on)

**AC6: Empty State**
- When no insights: "No insights yet. We'll generate insights after you track more transactions."
- When filters match nothing: "No insights match your filters. Try adjusting your search."

**AC7: Pagination or Infinite Scroll**
- Insights paginated (20 per page) or use infinite scroll
- Performance: smooth scrolling with no jank

**AC8: Search Box**
- Search box filters by keyword in title/description
- Search updates as user types (debounced 300ms)
- Search works in combination with type filter

**AC9: Mobile Responsive**
- Full-width cards on mobile
- Stacked layout for filters on mobile
- Touch-friendly dismiss buttons

## Tasks / Subtasks

- [ ] **Task 1: Create Insights Page Route** (AC: #1)
  - [ ] Create `src/app/(dashboard)/insights/page.tsx` file
  - [ ] Use dashboard layout group (wrapped in (dashboard) folder)
  - [ ] Add page metadata: title "AI Insights", description
  - [ ] Verify page accessible at `/insights` URL
  - [ ] Test authentication requirement (redirect to login if not authenticated)

- [ ] **Task 2: Create Insights List Component** (AC: #2, #7)
  - [ ] Create `src/components/insights/InsightsList.tsx` component
  - [ ] Accept props: `insights` array, `onDismiss` callback, `onUndismiss` callback
  - [ ] Render list of AIInsightCard components (from Story 6.2)
  - [ ] Add type badge to each card: `<Badge colorScheme={colorScheme}>{insightTypeLabel}</Badge>`
  - [ ] Display date generated with relative time: "2 days ago" using date formatting
  - [ ] Implement infinite scroll using `react-infinite-scroll-component` package
  - [ ] Load next page when user scrolls to bottom
  - [ ] Show loading spinner at bottom while fetching more
  - [ ] Handle end of list: "You've reached the end" message
  - [ ] Alternative: Implement pagination with Next/Previous buttons if infinite scroll not preferred
  - [ ] Write component tests

- [ ] **Task 3: Create Filter Controls Component** (AC: #3, #4, #8)
  - [ ] Create `src/components/insights/InsightsFilters.tsx` component
  - [ ] Accept props: `filters` object, `onFilterChange` callback
  - [ ] Render type filter dropdown using Chakra UI Select component
  - [ ] Options: "All Types", "Spending Increases", "Budget Recommendations", "Unusual Expenses", "Positive Reinforcement"
  - [ ] Render dismissed toggle using Chakra UI Switch component
  - [ ] Label: "Show dismissed insights"
  - [ ] Render search input using Chakra UI Input component
  - [ ] Placeholder: "Search insights..."
  - [ ] Implement debounced search (300ms delay) using `useDebouncedCallback` or `lodash.debounce`
  - [ ] Use responsive Stack layout: vertical on mobile, horizontal on desktop
  - [ ] Write component tests (filter change, toggle, search debouncing)

- [ ] **Task 4: Implement Page State Management** (AC: #3, #4, #8)
  - [ ] In `page.tsx`, manage filter state with React useState or URL query params
  - [ ] State: `type` (string), `dismissed` (boolean), `search` (string), `page` (number)
  - [ ] Use Next.js useRouter and useSearchParams for URL-based filters (better for bookmarking/sharing)
  - [ ] Update URL when filters change: `/insights?type=spending_increase&dismissed=true&search=dining`
  - [ ] Initialize filters from URL params on page load
  - [ ] Sync filter state with InsightsFilters component

- [ ] **Task 5: Fetch Insights with Filtering** (AC: #2, #3, #4, #8)
  - [ ] Use SWR to fetch insights: `useSWR('/api/insights?...')`
  - [ ] Build query string from filter state: `type=${type}&dismissed=${dismissed}&search=${search}&limit=20&offset=${offset}`
  - [ ] Use SWR infinite or pagination strategy for loading more results
  - [ ] Handle loading state with Skeleton loaders
  - [ ] Handle error state with error message display
  - [ ] Revalidate on filter change (trigger new fetch)
  - [ ] Use SWR cache to improve performance

- [ ] **Task 6: Implement Dismiss and Undismiss Actions** (AC: #5)
  - [ ] Create `handleDismiss` function in page component
  - [ ] Call `PUT /api/insights/:id/dismiss` API endpoint (from Story 6.2)
  - [ ] On success: mutate SWR cache to update insight's `is_dismissed` status
  - [ ] Show optimistic UI update (gray out card immediately)
  - [ ] Show success toast: "Insight dismissed"
  - [ ] Create `handleUndismiss` function for reversing dismissal
  - [ ] Create `PUT /api/insights/:id/undismiss` API endpoint
  - [ ] Implementation: `UPDATE insights SET is_dismissed = false WHERE id = :id AND user_id = :user_id`
  - [ ] On undismiss success: mutate cache, show toast "Insight restored"

- [ ] **Task 7: Create PUT /api/insights/:id/undismiss Endpoint** (AC: #5)
  - [ ] Create `src/app/api/insights/[id]/undismiss/route.ts` file
  - [ ] Implement PUT handler for undismissing insight
  - [ ] Validate user authentication
  - [ ] Update Supabase: `UPDATE insights SET is_dismissed = false WHERE id = :id AND user_id = :user_id`
  - [ ] Verify RLS policy (user can only undismiss their own insights)
  - [ ] Return updated insight object
  - [ ] Handle errors (404, 401, 403)
  - [ ] Add API route tests

- [ ] **Task 8: Style Dismissed Insights** (AC: #4)
  - [ ] In AIInsightCard component, add prop: `isDismissed` (boolean)
  - [ ] When dismissed: apply gray background, reduced opacity (0.5), grayscale filter
  - [ ] Display "Dismissed" badge in top-right corner (gray Badge)
  - [ ] Change dismiss button to "Undismiss" button (with different icon/label)
  - [ ] Add visual indicator: strike-through title or dim colors

- [ ] **Task 9: Empty States** (AC: #6)
  - [ ] Create `src/components/insights/EmptyInsightsState.tsx` component
  - [ ] Accept prop: `message` (string)
  - [ ] Render centered Card with icon, heading, and message
  - [ ] Use appropriate icon: InfoIcon or SearchIcon
  - [ ] Display in InsightsList when `insights.length === 0`
  - [ ] Conditional message based on filters: "No insights yet" vs "No insights match filters"

- [ ] **Task 10: Responsive Design** (AC: #9)
  - [ ] Test on mobile viewport (320px, 375px, 428px)
  - [ ] Verify filters stack vertically on mobile
  - [ ] Verify cards are full-width on mobile
  - [ ] Verify dismiss buttons are touch-friendly (minH="44px")
  - [ ] Test on tablet and desktop
  - [ ] Verify horizontal filter layout on desktop
  - [ ] Add responsive padding/margins throughout

- [ ] **Task 11: Integration Testing** (AC: All)
  - [ ] Test navigation: Click "View all insights" from dashboard → lands on /insights page
  - [ ] Test with 0 insights: verify empty state
  - [ ] Test with 5+ insights: verify all display in correct order (newest first)
  - [ ] Test type filter: select "Spending Increases" → only spending_increase insights shown
  - [ ] Test dismissed toggle: enable → dismissed insights appear grayed out
  - [ ] Test dismiss action: click dismiss → insight grays out, badge added
  - [ ] Test undismiss action: click undismiss → insight restores to normal
  - [ ] Test search: type "dining" → only matching insights shown
  - [ ] Test combined filters: type filter + search + dismissed toggle
  - [ ] Test pagination/infinite scroll: scroll to bottom → load next page
  - [ ] Test URL sync: change filter → URL updates, refresh page → filters persist

## Dev Notes

### Project Structure Notes

**New Files to Create:**
- `src/app/(dashboard)/insights/page.tsx` - Main insights page
- `src/components/insights/InsightsList.tsx` - List component with pagination/infinite scroll
- `src/components/insights/InsightsFilters.tsx` - Filter controls (type, dismissed, search)
- `src/components/insights/EmptyInsightsState.tsx` - Empty state component
- `src/app/api/insights/[id]/undismiss/route.ts` - Undismiss API endpoint

**Existing Files to Reference:**
- `src/components/insights/AIInsightCard.tsx` - Reuse from Story 6.2
- `src/app/api/insights/route.ts` - GET endpoint from Story 6.2 (supports filtering)
- `src/app/api/insights/[id]/dismiss/route.ts` - Dismiss endpoint from Story 6.2

**Dependencies to Install:**
- `react-infinite-scroll-component` (if using infinite scroll) - check package.json first

**Testing Files:**
- `__tests__/app/(dashboard)/insights/page.test.tsx` - Page component tests
- `__tests__/components/insights/InsightsList.test.tsx` - List component tests
- `__tests__/components/insights/InsightsFilters.test.tsx` - Filters component tests
- `__tests__/app/api/insights/[id]/undismiss.test.ts` - API endpoint tests

### Learnings from Previous Stories

**From Story 6-2-ai-insights-display-on-dashboard (Status: drafted)**

**Components to Reuse:**
- `AIInsightCard` component at `src/components/insights/AIInsightCard.tsx`
- Already implements color coding, dismiss button, icon display
- Accepts `insight` prop and `onDismiss` callback
- Follow same styling patterns for consistency

**API Endpoints Available:**
- `GET /api/insights?limit=20&dismissed=false&orderBy=priority DESC&type={type}&search={query}`
- `PUT /api/insights/:id/dismiss` - Dismisses an insight

**SWR Patterns:**
- Use SWR for data fetching with caching
- Use `mutate()` function for cache invalidation after dismiss/undismiss
- Configure refresh intervals as needed

[Source: docs/sprint-artifacts/6-2-ai-insights-display-on-dashboard.md#Dev-Notes]

**From Story 5-8-responsive-dashboard-for-mobile-and-tablet (Status: done)**

**Responsive Patterns:**
- Use Chakra UI Stack for responsive filter layouts: `<Stack direction={{ base: "column", md: "row" }}>`
- Mobile-first approach with base, md, lg breakpoints
- Responsive spacing: `spacing={{ base: 4, md: 6 }}`
- Touch target compliance: `minH="44px"` for buttons

[Source: docs/sprint-artifacts/5-8-responsive-dashboard-for-mobile-and-tablet.md#Dev-Agent-Record]

### Architecture and Technical Constraints

**From Epic 6 Tech Spec:**

**Page Architecture:**
- Full-page route in dashboard layout
- Client-side filtering with URL sync for bookmarking
- Pagination or infinite scroll for performance (20 insights per page)

**Filter State Management:**
```typescript
// URL-based state
const searchParams = useSearchParams();
const router = useRouter();

const filters = {
  type: searchParams.get('type') || 'all',
  dismissed: searchParams.get('dismissed') === 'true',
  search: searchParams.get('search') || '',
  page: parseInt(searchParams.get('page') || '1'),
};

const updateFilters = (newFilters) => {
  const params = new URLSearchParams();
  if (newFilters.type !== 'all') params.set('type', newFilters.type);
  if (newFilters.dismissed) params.set('dismissed', 'true');
  if (newFilters.search) params.set('search', newFilters.search);
  if (newFilters.page > 1) params.set('page', newFilters.page.toString());
  router.push(`/insights?${params.toString()}`);
};
```

**API Query Construction:**
```typescript
const queryString = `/api/insights?${new URLSearchParams({
  limit: '20',
  offset: ((page - 1) * 20).toString(),
  dismissed: dismissed.toString(),
  ...(type !== 'all' && { type }),
  ...(search && { search }),
  orderBy: 'created_at DESC',
}).toString()}`;
```

**Infinite Scroll Implementation (if using):**
```typescript
import InfiniteScroll from 'react-infinite-scroll-component';

<InfiniteScroll
  dataLength={insights.length}
  next={loadMore}
  hasMore={hasMore}
  loader={<Spinner />}
  endMessage={<Text>You've reached the end</Text>}
>
  {insights.map(insight => <AIInsightCard key={insight.id} insight={insight} />)}
</InfiniteScroll>
```

**Debounced Search:**
```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedSearch = useDebouncedCallback((value) => {
  updateFilters({ ...filters, search: value, page: 1 });
}, 300);
```

**Type Filter Options:**
- All Types (default)
- Spending Increases (`spending_increase`)
- Budget Recommendations (`budget_recommendation`)
- Unusual Expenses (`unusual_expense`)
- Positive Reinforcement (`positive_reinforcement`)

**Badge Color Mapping:**
- `spending_increase` → orange Badge
- `budget_recommendation` → blue Badge
- `unusual_expense` → red Badge
- `positive_reinforcement` → green Badge

### Prerequisites

- ✅ Story 6.2: AIInsightCard component available, GET /api/insights and dismiss endpoints created
- ✅ Story 6.1: Insights generated and available in database

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-6.md#APIs-and-Interfaces]
- [Source: docs/sprint-artifacts/tech-spec-epic-6.md#Acceptance-Criteria]
- [Source: docs/epics.md#Story-6.3]
- [Source: Next.js docs: useRouter, useSearchParams]
- [Source: Chakra UI docs: Select, Switch, Input, Stack components]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- Agent model will be recorded during implementation -->

### Debug Log References

<!-- Debug logs will be added during implementation -->

### Completion Notes List

<!-- Completion notes will be added during implementation -->

### File List

<!-- File list will be added during implementation -->

---

**Change Log:**
- 2025-12-03: Story drafted by SM Agent (Niki)
