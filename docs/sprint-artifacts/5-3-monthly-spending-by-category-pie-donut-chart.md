# Story 5.3: Monthly Spending by Category (Pie/Donut Chart)

Status: drafted

## Story

As a user,
I want to see my spending broken down by category in a visual chart,
So that I can identify where most of my money goes.

## Acceptance Criteria

**Given** I view the dashboard
**When** I look at the spending breakdown section
**Then** I see a pie or donut chart showing category distribution

**And** Chart displays current month's expenses grouped by category
**And** Each category slice colored with its assigned category color
**And** Chart shows percentage of total spending per category
**And** Hovering over slice shows tooltip: "[Category]: $X (Y%)"
**And** Chart rendered using Recharts library (as per architecture)
**And** Chart responsive: adapts to container width (250-400px height)
**And** Legend below chart showing all categories with colors
**And** Clicking legend item toggles category visibility in chart
**And** Empty state if no expenses: "No expenses yet this month"
**And** Chart updates in real-time when transactions added (<300ms)
**And** Mobile: chart scales to fit screen, legend below
**And** Accessible data table alternative (hidden by default, screen reader accessible)

## Tasks / Subtasks

- [ ] Install and configure Recharts (AC: 5)
  - [ ] Run `npm install recharts`
  - [ ] Verify version 2.12+ installed
  - [ ] Import Recharts components in chart component
- [ ] Create SpendingByCategory component (AC: 1, 2, 3, 4, 5, 6, 7, 8, 10, 11)
  - [ ] Create `src/components/dashboard/SpendingByCategory.tsx`
  - [ ] Implement Recharts `<PieChart>` with `<ResponsiveContainer>`
  - [ ] Use `<Pie>` component with category data
  - [ ] Map category colors to `fill` prop for each slice
  - [ ] Configure `<Tooltip>` to show "[Category]: $X (Y%)"
  - [ ] Add `<Legend>` below chart with category names and colors
  - [ ] Implement legend click to toggle category visibility
  - [ ] Set responsive dimensions (250-400px height, 100% width)
  - [ ] Add empty state handling: "No expenses yet this month"
  - [ ] Use SWR hook to fetch spending data
- [ ] Create spending-by-category API endpoint (AC: 1, 2, 3)
  - [ ] Create `src/app/api/dashboard/spending-by-category/route.ts`
  - [ ] Implement GET handler with authentication
  - [ ] Query Supabase: aggregate expenses by category for current month
  - [ ] Join with categories table to get names and colors
  - [ ] Calculate percentage per category: (categoryTotal / totalSpending) * 100
  - [ ] Return JSON: `{ categories: [{ name, color, total, percentage }], month, totalSpending }`
- [ ] Create useSpendingByCategory custom hook (AC: 10)
  - [ ] Create `src/lib/hooks/useSpendingByCategory.ts`
  - [ ] Implement SWR hook wrapping `/api/dashboard/spending-by-category`
  - [ ] Add 5-second deduplication interval
  - [ ] Add Supabase Realtime subscription for transaction changes
  - [ ] Trigger revalidation on data changes
  - [ ] Return `{ data, error, isLoading, mutate }`
- [ ] Create custom tooltip component (AC: 4)
  - [ ] Create `src/components/dashboard/PieChartTooltip.tsx`
  - [ ] Implement Recharts CustomTooltip interface
  - [ ] Display format: "[Category]: $X (Y%)"
  - [ ] Use Chakra UI Box for styling
  - [ ] Show tooltip within 100ms of hover
- [ ] Add accessible data table (AC: 12)
  - [ ] Create hidden HTML table with same data
  - [ ] Use ARIA attributes: `aria-label="Spending by category"`
  - [ ] Visually hidden CSS class (screen reader accessible)
  - [ ] Table structure: headers (Category, Amount, Percentage), data rows
- [ ] Integrate chart into dashboard page (AC: 1)
  - [ ] Import SpendingByCategory into `src/app/(dashboard)/page.tsx`
  - [ ] Render below StatCards
  - [ ] Wrap in ChartContainer for loading/error handling
  - [ ] Add section heading: "Spending by Category"

## Dev Notes

### Architecture Alignment

**Charting Library:**
- Recharts 2.12+ for SVG-based visualizations
- Responsive design via `<ResponsiveContainer>`
- Declarative API: compose `<PieChart>`, `<Pie>`, `<Tooltip>`, `<Legend>`

**API Design:**
- `GET /api/dashboard/spending-by-category?month=YYYY-MM`
- Server-side aggregation with JOIN to categories table
- Returns pre-calculated percentages to reduce client-side computation

**Data Flow:**
1. SpendingByCategory component calls `useSpendingByCategory()` hook
2. Hook fetches from `/api/dashboard/spending-by-category` via SWR
3. API queries Supabase: `SUM(amount) GROUP BY category_id` with category JOIN
4. Data cached client-side, updates via Realtime subscription
5. Recharts renders pie chart with mapped colors

**Performance Optimizations:**
- Database-level aggregation (single query)
- SWR caching reduces API calls
- ResponsiveContainer rerenders efficiently on resize
- Lazy loading: chart loaded only when visible (optional)

### Source Tree Components to Touch

**New Files to Create:**
- `src/components/dashboard/SpendingByCategory.tsx` - Pie chart component
- `src/components/dashboard/PieChartTooltip.tsx` - Custom tooltip
- `src/app/api/dashboard/spending-by-category/route.ts` - API endpoint
- `src/lib/hooks/useSpendingByCategory.ts` - SWR hook

**Existing Files to Modify:**
- `src/app/(dashboard)/page.tsx` - Import and render SpendingByCategory
- `package.json` - Add recharts dependency

**Existing Files to Reference:**
- `src/types/category.types.ts` - Category type definitions
- `src/lib/supabase/client.ts` - Supabase client
- `src/lib/utils/currency.ts` - Currency formatting for tooltip

### Testing Standards Summary

**Manual Testing Checklist:**
1. **Chart Rendering:**
   - Pie/donut chart visible on dashboard
   - Chart renders with correct proportions
   - Height 250-400px, width adapts to container
2. **Data Accuracy:**
   - Each category slice matches actual spending
   - Percentages add up to 100%
   - Category colors match those defined in categories table
3. **Interactivity:**
   - Hover over slice → tooltip appears within 100ms
   - Tooltip shows: "[Category]: $X (Y%)" format
   - Hover out → tooltip disappears
   - Click legend item → category toggles visibility
4. **Legend:**
   - Legend displays below chart
   - Shows all categories with correct colors
   - Legend items clickable (cursor: pointer)
5. **Empty State:**
   - No expenses → shows "No expenses yet this month"
   - No chart rendered when empty
6. **Real-time Updates:**
   - Add expense transaction → chart updates within 300ms
   - New category appears in chart
   - Edit/delete transaction → chart recalculates
7. **Responsive:**
   - Desktop: chart full width of container
   - Tablet: chart adapts to smaller space
   - Mobile: chart scales to screen width, legend below
8. **Accessibility:**
   - Screen reader can access data table
   - Table has proper headers
   - ARIA labels present

**SQL Query Testing:**
```sql
-- Verify category spending aggregation
SELECT
  c.name,
  c.color,
  SUM(t.amount) as total,
  COUNT(t.id) as transaction_count
FROM transactions t
JOIN categories c ON t.category_id = c.id
WHERE t.user_id = :id
  AND t.type = 'expense'
  AND t.date >= :start_of_month
  AND t.date < :end_of_month
GROUP BY c.id
ORDER BY total DESC
```

### Project Structure Notes

**Alignment with Unified Structure:**
- Chart components in `src/components/dashboard/`
- API routes in `src/app/api/dashboard/`
- Hooks in `src/lib/hooks/`
- Follows architecture: Recharts for visualizations, SWR for data fetching

**Recharts Integration:**
- First usage of Recharts in project
- Sets pattern for other charts (Stories 5.4, 5.6)
- ResponsiveContainer ensures charts adapt to any layout

**No Detected Conflicts:**
- Category colors already defined in database (Epic 4)
- Transaction data structure supports aggregation
- Aligns with performance targets (<300ms updates)

### References

- [Source: docs/PRD.md#FR21] - Pie chart showing spending by category
- [Source: docs/PRD.md#FR22] - Category colors match user-defined colors
- [Source: docs/PRD.md#FR23] - Hover tooltips show exact amounts
- [Source: docs/PRD.md#FR26] - Chart updates in real-time (<300ms)
- [Source: docs/architecture.md#Recharts-Integration] - Recharts 2.12+ for charts
- [Source: docs/ux-design-specification.md#Spending-Breakdown-Chart] - Pie/donut design, legend placement
- [Source: docs/sprint-artifacts/tech-spec-epic-5.md#Spending-by-Category-API] - API contract, SQL implementation
- [Source: docs/sprint-artifacts/tech-spec-epic-5.md#SpendingByCategory-Component] - Recharts usage, responsive design
- [Source: docs/epics.md#Story-5.3] - Full acceptance criteria and technical notes

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
