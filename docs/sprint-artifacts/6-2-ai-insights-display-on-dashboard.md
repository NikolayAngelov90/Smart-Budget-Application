# Story 6.2: AI Insights Display on Dashboard

Status: drafted

## Story

As a user,
I want to see personalized AI insights on my dashboard,
So that I receive proactive budget recommendations.

## Acceptance Criteria

**Given** The system has generated insights for me
**When** I view the dashboard
**Then** I see my top 3 AI insights displayed prominently

**AC1: Insights Section Display**
- Insights section titled "AI Budget Coach"
- Shows top 3 highest priority insights (priority 5 → 1)
- "View all insights" link navigates to `/insights` page

**AC2: AIInsightCard Component**
- Each insight displayed as AIInsightCard component
- Card shows: icon/emoji, title, description, priority indicator, dismiss button
- Insight title in bold, description in regular weight

**AC3: Card Color Coding by Type**
- Spending increase: Orange/warning border
- Budget recommendation: Blue/info border
- Unusual expense: Red/error border
- Positive reinforcement: Green/success border

**AC4: Empty State**
- When no insights available: "Keep tracking! We'll have insights after a few weeks of data."

**AC5: Insights Update**
- Insights update when new ones are generated (SWR cache invalidation)

**AC6: Responsive Layout**
- Mobile: insights stack vertically
- Desktop: grid layout (2-3 columns)

**AC7: Coaching Tone**
- All text uses friendly, non-judgmental coaching tone

## Tasks / Subtasks

- [ ] **Task 1: Create AIInsightCard Component** (AC: #2, #3)
  - [ ] Create `src/components/insights/AIInsightCard.tsx` file
  - [ ] Accept props: `insight` (Insight object), `onDismiss` callback
  - [ ] Render Chakra UI Card with responsive padding
  - [ ] Display insight icon based on type (warning, info, error, check icons from Chakra)
  - [ ] Display title in bold (fontWeight="bold")
  - [ ] Display description in regular weight
  - [ ] Display priority indicator (Badge component: Priority 5, Priority 4, etc.)
  - [ ] Add dismiss button (X icon) in top-right corner with IconButton
  - [ ] Apply border color based on insight type: `borderLeft="4px" borderColor={colorScheme}`
  - [ ] Color scheme mapping: spending_increase → orange, budget_recommendation → blue, unusual_expense → red, positive_reinforcement → green
  - [ ] Add hover state for interactivity
  - [ ] Ensure minH="44px" for touch targets (accessibility)
  - [ ] Write component tests (render, dismiss button click, color coding)

- [ ] **Task 2: Create AI Budget Coach Dashboard Section** (AC: #1, #4, #6)
  - [ ] Create `src/components/dashboard/AIBudgetCoach.tsx` component
  - [ ] Fetch top 3 insights using SWR: `useSWR('/api/insights?limit=3&dismissed=false&orderBy=priority DESC')`
  - [ ] Display section heading: "AI Budget Coach" (H2, responsive font size)
  - [ ] Render loading skeleton while fetching (Chakra UI Skeleton components)
  - [ ] If insights exist: render 3 AIInsightCard components in responsive grid
  - [ ] Use SimpleGrid or Grid: `columns={{ base: 1, md: 2, lg: 3 }}` for responsive layout
  - [ ] Add "View all insights" link at bottom: `<Link href="/insights">See all {count} insights →</Link>`
  - [ ] Empty state: Display friendly message when no insights available
  - [ ] Empty state component: Card with icon, "Keep tracking!" heading, subtitle with explanation
  - [ ] Handle dismiss action: call `onDismiss` → mutate SWR cache to remove insight from list
  - [ ] Write component tests (loading state, empty state, insights display, dismiss action)

- [ ] **Task 3: Create GET /api/insights API Endpoint** (AC: #1)
  - [ ] Create `src/app/api/insights/route.ts` file
  - [ ] Implement GET handler for fetching insights
  - [ ] Validate user authentication (require valid session)
  - [ ] Parse query parameters: `limit`, `dismissed`, `orderBy`, `type`, `search`
  - [ ] Query Supabase insights table with filters:
    - Filter by user_id (authenticated user)
    - Filter by dismissed status if provided
    - Filter by type if provided
    - Search in title/description if search query provided
    - Order by priority DESC, created_at DESC (or as specified)
    - Limit results (default: 20, max: 100)
  - [ ] Return JSON array of insights
  - [ ] Handle errors gracefully (500 for server errors, 401 for unauthorized)
  - [ ] Add API route tests with authenticated requests

- [ ] **Task 4: Create PUT /api/insights/:id/dismiss API Endpoint** (AC: #2)
  - [ ] Create `src/app/api/insights/[id]/dismiss/route.ts` file
  - [ ] Implement PUT handler for dismissing insight
  - [ ] Validate user authentication
  - [ ] Validate insight ID parameter (UUID format)
  - [ ] Update Supabase: `UPDATE insights SET is_dismissed = true WHERE id = :id AND user_id = :user_id`
  - [ ] Verify RLS policy: user can only dismiss their own insights
  - [ ] Return success response with updated insight
  - [ ] Handle errors (404 if insight not found, 401 if unauthorized, 403 if not owner)
  - [ ] Add API route tests

- [ ] **Task 5: Integrate AI Budget Coach into Dashboard** (AC: #5)
  - [ ] Open `src/app/dashboard/page.tsx`
  - [ ] Import AIBudgetCoach component
  - [ ] Add AIBudgetCoach section below DashboardStats and above charts
  - [ ] Position: after StatCards, before CategorySpendingChart
  - [ ] Add responsive margin/padding: `mb={{ base: 6, md: 8 }}`
  - [ ] Ensure section fits within dashboard max-width container (1200px from Story 5.8)
  - [ ] Test SWR cache updates when insights are generated/dismissed

- [ ] **Task 6: Handle Insights Update and Cache Invalidation** (AC: #5)
  - [ ] In AIBudgetCoach component, use SWR `mutate` function for cache invalidation
  - [ ] On dismiss action: call `mutate('/api/insights?...')` to refresh data
  - [ ] Set SWR `refreshInterval` option for auto-refresh (e.g., 5 minutes)
  - [ ] Add manual refresh capability (optional "Refresh" button for testing)
  - [ ] Test: Generate new insight via API → verify dashboard updates automatically

- [ ] **Task 7: Styling and Responsive Design Validation** (AC: #6, #7)
  - [ ] Test on mobile viewport (320px, 375px, 428px widths)
  - [ ] Verify insights stack vertically on mobile (single column)
  - [ ] Test on tablet viewport (768px, 1024px widths)
  - [ ] Verify 2-column grid on medium screens
  - [ ] Test on desktop viewport (1280px, 1920px widths)
  - [ ] Verify 3-column grid on large screens
  - [ ] Validate coaching tone in all displayed text
  - [ ] Verify color contrast for accessibility (WCAG AA)
  - [ ] Test dismiss button usability on touch devices

- [ ] **Task 8: Integration Testing** (AC: All)
  - [ ] Create end-to-end test: Navigate to dashboard → verify AI Budget Coach section visible
  - [ ] Test with 0 insights: verify empty state message
  - [ ] Test with 1-2 insights: verify correct display count
  - [ ] Test with 3+ insights: verify only top 3 shown, "View all" link present
  - [ ] Test dismiss functionality: click dismiss → verify insight removed from view
  - [ ] Test "View all insights" link: click → navigate to /insights page
  - [ ] Test color coding: verify each insight type has correct border color
  - [ ] Test SWR caching: reload page → verify insights load from cache quickly (<100ms)

## Dev Notes

### Project Structure Notes

**New Files to Create:**
- `src/components/insights/AIInsightCard.tsx` - Individual insight card component
- `src/components/dashboard/AIBudgetCoach.tsx` - Dashboard section for insights
- `src/app/api/insights/route.ts` - GET endpoint for fetching insights
- `src/app/api/insights/[id]/dismiss/route.ts` - PUT endpoint for dismissing insights

**Existing Files to Modify:**
- `src/app/dashboard/page.tsx` - Add AIBudgetCoach component

**Testing Files:**
- `__tests__/components/insights/AIInsightCard.test.tsx` - Component tests
- `__tests__/components/dashboard/AIBudgetCoach.test.tsx` - Component tests
- `__tests__/app/api/insights/route.test.ts` - API endpoint tests

### Learnings from Previous Story

**From Story 6-1-ai-insights-rules-engine-implementation (Status: drafted)**

**Prerequisites Completed:**
- Insight generation engine available via Story 6.1
- `insightService.generateInsights()` function available for testing
- Database schema and RLS policies established
- Insight TypeScript interfaces defined

**Services to Reuse:**
- Use `src/lib/supabase/client.ts` for database queries
- Use insight types from `src/types/insights.types.ts` or `src/lib/ai/insightRules.ts`
- API endpoint `/api/insights/generate` available for manual insight generation during testing

**From Story 5-8-responsive-dashboard-for-mobile-and-tablet (Status: done)**

**Responsive Design Patterns:**
- Use Chakra UI responsive props: `{{ base: ..., md: ..., lg: ... }}`
- SimpleGrid for responsive column layouts: `columns={{ base: 1, md: 2, lg: 3 }}`
- Responsive typography: `fontSize={{ base: "1.25rem", md: "1.5rem" }}`
- Responsive spacing: `mb={{ base: 6, md: 8 }}`
- Touch target compliance: `minH="44px"` for interactive elements

**Dashboard Structure:**
- Max-width container: 1200px (already established in dashboard/page.tsx)
- Follow existing dashboard section spacing patterns
- Use consistent heading hierarchy (H2 for section titles)

[Source: docs/sprint-artifacts/6-1-ai-insights-rules-engine-implementation.md#Prerequisites]
[Source: docs/sprint-artifacts/5-8-responsive-dashboard-for-mobile-and-tablet.md#Dev-Agent-Record]

### Architecture and Technical Constraints

**From Epic 6 Tech Spec:**

**Component Architecture:**
- AIInsightCard: Presentational component (props-based, no data fetching)
- AIBudgetCoach: Smart component (data fetching with SWR, cache management)

**API Design:**
```
GET /api/insights?limit=3&dismissed=false&orderBy=priority DESC
Response: { insights: Insight[], total: number }

PUT /api/insights/:id/dismiss
Request: { is_dismissed: true }
Response: { insight: Insight, success: boolean }
```

**SWR Configuration:**
```typescript
const { data, error, mutate } = useSWR(
  '/api/insights?limit=3&dismissed=false&orderBy=priority DESC',
  fetcher,
  {
    refreshInterval: 300000, // 5 minutes
    revalidateOnFocus: true,
    dedupingInterval: 60000, // 1 minute
  }
);
```

**Color Scheme Mapping:**
- `spending_increase` → `orange` (Chakra colorScheme)
- `budget_recommendation` → `blue`
- `unusual_expense` → `red`
- `positive_reinforcement` → `green`

**Icon Mapping:**
- `spending_increase` → `WarningIcon` or `TrendingUpIcon`
- `budget_recommendation` → `InfoIcon`
- `unusual_expense` → `WarningTwoIcon`
- `positive_reinforcement` → `CheckCircleIcon`

**Priority Badge Display:**
- Priority 5 (Critical): Red badge
- Priority 4 (High): Orange badge
- Priority 3 (Medium): Yellow badge
- Priority 2 (Low): Green badge
- Priority 1 (Info): Gray badge

**Performance:**
- Dashboard must load insights in <500ms (SWR cache helps)
- Use Skeleton loaders to improve perceived performance
- Optimize database query with appropriate indexes (from Story 1.2)

### Prerequisites

- ✅ Story 6.1: Insight generation engine implemented
- ✅ Story 5.2: Dashboard structure established
- ✅ Story 5.8: Responsive design patterns established

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-6.md#Services-and-Modules]
- [Source: docs/sprint-artifacts/tech-spec-epic-6.md#APIs-and-Interfaces]
- [Source: docs/sprint-artifacts/tech-spec-epic-6.md#Acceptance-Criteria]
- [Source: docs/epics.md#Story-6.2]
- [Source: docs/ux-design-specification.md#Components] (if available)

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
