# Story 5.5: Month-over-Month Comparison Highlights

Status: drafted

## Story

As a user,
I want to see month-over-month comparisons highlighting spending changes,
So that I can quickly spot increases or decreases in spending.

## Acceptance Criteria

**Given** I view the dashboard
**When** I look at the comparison section
**Then** I see highlights showing significant spending changes

**And** Section titled "This Month vs Last Month"
**And** Shows categories with >20% increase in spending (red/warning)
**And** Shows categories with >20% decrease in spending (green/success)
**And** Format: "[Category]: ↑ 40% ($480 vs $340)"
**And** Up to 5 most significant changes shown
**And** Empty state: "No significant changes this month"
**And** Updates immediately when transactions added
**And** Click on category to see detailed breakdown (drills down to category filter)
**And** Mobile: list format, desktop: grid or list

## Tasks / Subtasks

- [ ] Create MonthOverMonth component (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9)
  - [ ] Create `src/components/dashboard/MonthOverMonth.tsx`
  - [ ] Implement section with title "This Month vs Last Month"
  - [ ] Render list of significant changes (>20%)
  - [ ] Format each item: "[Category]: ↑/↓ X% ($current vs $previous)"
  - [ ] Use up arrow (↑) for increases (red/warning color)
  - [ ] Use down arrow (↓) for decreases (green/success color)
  - [ ] Limit display to top 5 most significant changes
  - [ ] Add empty state: "No significant changes this month"
  - [ ] Use SWR hook to fetch comparison data
  - [ ] Make each item clickable (navigate to filtered transactions)
  - [ ] Implement responsive layout (list on mobile, grid/list on desktop)
- [ ] Create month-over-month API endpoint (AC: 2, 3, 4, 5)
  - [ ] Create `src/app/api/dashboard/month-over-month/route.ts`
  - [ ] Implement GET handler with authentication
  - [ ] Query current month spending by category
  - [ ] Query previous month spending by category
  - [ ] Calculate percent change: ((current - previous) / previous) * 100
  - [ ] Filter to significant changes: ABS(percentChange) > 20
  - [ ] Sort by absolute percent change (descending)
  - [ ] Limit to top 5 results
  - [ ] Return JSON: `{ changes: [{ categoryId, categoryName, categoryColor, currentAmount, previousAmount, percentChange, absoluteChange, direction }], currentMonth, previousMonth }`
- [ ] Create useMonthOverMonth custom hook (AC: 7)
  - [ ] Create `src/lib/hooks/useMonthOverMonth.ts`
  - [ ] Implement SWR hook wrapping `/api/dashboard/month-over-month`
  - [ ] Add 5-second deduplication interval
  - [ ] Add Supabase Realtime subscription for transaction changes
  - [ ] Trigger revalidation on data changes
  - [ ] Return `{ data, error, isLoading, mutate }`
- [ ] Implement click-to-drill-down (AC: 8)
  - [ ] Add onClick handler to each comparison item
  - [ ] Navigate to `/transactions?category=[categoryId]&month=[currentMonth]`
  - [ ] Use Next.js `useRouter()` for navigation
  - [ ] Ensure cursor changes to pointer on hover
- [ ] Integrate component into dashboard page (AC: 1)
  - [ ] Import MonthOverMonth into `src/app/(dashboard)/page.tsx`
  - [ ] Render below SpendingTrends chart
  - [ ] Wrap in appropriate container for spacing
  - [ ] Add section heading styling

## Dev Notes

### Architecture Alignment

**Component Design:**
- Simple list/grid component displaying change highlights
- Uses Chakra UI `List`, `ListItem`, `Badge` for styling
- Color scheme: red for increases, green for decreases

**API Design:**
- `GET /api/dashboard/month-over-month?month=YYYY-MM`
- Server-side calculation of percent changes with filtering
- Uses SQL CTEs to compare current vs previous month

**Data Flow:**
1. MonthOverMonth component calls `useMonthOverMonth()` hook
2. Hook fetches from `/api/dashboard/month-over-month` via SWR
3. API queries Supabase twice: current month and previous month aggregations
4. Server calculates percent changes and filters to >20%
5. Data cached client-side, updates via Realtime subscription
6. Component renders formatted list with arrows and percentages

**Navigation Integration:**
- Clicking category navigates to Transactions page
- Pre-applies filters: category and month
- Leverages existing transaction filtering (Story 3.2)

### Source Tree Components to Touch

**New Files to Create:**
- `src/components/dashboard/MonthOverMonth.tsx` - Comparison highlights component
- `src/app/api/dashboard/month-over-month/route.ts` - API endpoint
- `src/lib/hooks/useMonthOverMonth.ts` - SWR hook

**Existing Files to Modify:**
- `src/app/(dashboard)/page.tsx` - Import and render MonthOverMonth

**Existing Files to Reference:**
- `src/app/(transactions)/page.tsx` - Transaction list page (drill-down target)
- `src/types/category.types.ts` - Category type definitions
- `src/lib/supabase/client.ts` - Supabase client
- `src/lib/utils/currency.ts` - Currency formatting

### Testing Standards Summary

**Manual Testing Checklist:**
1. **Section Display:**
   - Section titled "This Month vs Last Month" visible
   - Positioned below SpendingTrends chart
2. **Data Accuracy:**
   - Only categories with >20% change shown
   - Percent change calculated correctly: ((current - previous) / previous) * 100
   - Dollar amounts accurate for both months
3. **Formatting:**
   - Format: "[Category]: ↑/↓ X% ($current vs $previous)"
   - Up arrow (↑) for increases, down arrow (↓) for decreases
   - Increases show red/warning color
   - Decreases show green/success color
4. **Limiting:**
   - Maximum 5 items shown
   - Items sorted by most significant change (highest absolute %)
5. **Empty State:**
   - No significant changes → shows "No significant changes this month"
   - No categories displayed when empty
6. **Real-time Updates:**
   - Add transaction → comparison recalculates immediately
   - New significant changes appear if threshold exceeded
7. **Click Interaction:**
   - Click category → navigates to `/transactions?category=[id]&month=[month]`
   - Transaction page shows filtered list
   - "Back to Dashboard" link available
8. **Responsive:**
   - Desktop: grid or list format
   - Mobile: vertical list, full width

**SQL Query Testing:**
```sql
-- Current month aggregation
WITH current_month AS (
  SELECT category_id, SUM(amount) as total
  FROM transactions
  WHERE user_id = :id AND type = 'expense'
    AND date >= :current_start AND date < :current_end
  GROUP BY category_id
),
-- Previous month aggregation
last_month AS (
  SELECT category_id, SUM(amount) as total
  FROM transactions
  WHERE user_id = :id AND type = 'expense'
    AND date >= :previous_start AND date < :previous_end
  GROUP BY category_id
)
-- Join and calculate changes
SELECT
  c.name,
  curr.total as current_amount,
  last.total as previous_amount,
  ((curr.total - last.total) / last.total * 100) as percent_change
FROM current_month curr
JOIN last_month last ON curr.category_id = last.category_id
JOIN categories c ON curr.category_id = c.id
WHERE ABS((curr.total - last.total) / last.total * 100) > 20
ORDER BY ABS(percent_change) DESC
LIMIT 5
```

### Project Structure Notes

**Alignment with Unified Structure:**
- Component in `src/components/dashboard/`
- API route in `src/app/api/dashboard/`
- Hook in `src/lib/hooks/`
- Integrates with existing transaction filtering

**SQL Optimization:**
- Uses CTEs for readability
- Single query with JOINs for efficiency
- Server-side filtering to >20% reduces payload

**No Detected Conflicts:**
- Transaction filtering already supports query params (Story 3.2)
- Category data available from existing tables
- Aligns with navigation patterns

### References

- [Source: docs/PRD.md#FR27] - Month-over-month comparison highlights
- [Source: docs/PRD.md#FR28] - Clickable categories drill down to transactions
- [Source: docs/PRD.md#FR26] - Real-time updates (<300ms)
- [Source: docs/architecture.md#Dashboard-Components] - Component organization
- [Source: docs/ux-design-specification.md#Month-over-Month-Section] - Visual design (arrows, colors)
- [Source: docs/sprint-artifacts/tech-spec-epic-5.md#Month-over-Month-API] - API contract, SQL with CTEs
- [Source: docs/sprint-artifacts/tech-spec-epic-5.md#MonthOverMonth-Component] - Component design, drill-down
- [Source: docs/epics.md#Story-5.5] - Full acceptance criteria and technical notes

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
