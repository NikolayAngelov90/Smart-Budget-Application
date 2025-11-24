# Story 5.6: Chart Interactivity and Drill-Down

Status: drafted

## Story

As a user,
I want to interact with dashboard charts,
So that I can explore my data in more detail.

## Acceptance Criteria

**Given** I view dashboard charts
**When** I hover or click on chart elements
**Then** I see detailed information and can drill down

**And** Pie chart: clicking slice navigates to `/transactions?category=[id]&month=[month]`
**And** Line chart: clicking data point navigates to `/transactions?month=[month]`
**And** Hovering shows detailed tooltip with exact values
**And** Tooltips appear within 100ms of hover
**And** Cursor changes to pointer on clickable chart elements
**And** Drill-down loads filtered transaction list pre-filtered to category/month
**And** "Back to Dashboard" link on transaction page to return
**And** Mobile: tap instead of hover, tooltip appears on tap
**And** Keyboard accessible: Tab to focus chart, Enter to drill down
**And** Screen reader: announces chart data and drill-down options

## Tasks / Subtasks

- [ ] Add pie chart click navigation (AC: 1)
  - [ ] Modify `src/components/dashboard/SpendingByCategory.tsx`
  - [ ] Add onClick handler to `<Pie>` component
  - [ ] Extract categoryId and current month from clicked data
  - [ ] Navigate to `/transactions?category=[categoryId]&month=[month]`
  - [ ] Use Next.js `useRouter()` for navigation
  - [ ] Add `cursor: pointer` style to pie slices
- [ ] Add line chart click navigation (AC: 2)
  - [ ] Modify `src/components/dashboard/SpendingTrends.tsx`
  - [ ] Add onClick handler to `<Line>` components
  - [ ] Extract month from clicked data point
  - [ ] Navigate to `/transactions?month=[month]`
  - [ ] Use Next.js `useRouter()` for navigation
  - [ ] Add `cursor: pointer` style to data points
- [ ] Enhance tooltip performance (AC: 3, 4)
  - [ ] Verify tooltips appear within 100ms of hover
  - [ ] Ensure tooltips show exact values (already implemented in Stories 5.3, 5.4)
  - [ ] Test tooltip responsiveness across both charts
- [ ] Add visual cursor feedback (AC: 5)
  - [ ] Add CSS `cursor: pointer` to clickable chart elements
  - [ ] Ensure hover states clearly indicate interactivity
  - [ ] Test across different browsers
- [ ] Implement transaction page filters (AC: 6)
  - [ ] Modify `src/app/(transactions)/page.tsx` to read query params
  - [ ] Apply category filter from `category` query param
  - [ ] Apply month filter from `month` query param
  - [ ] Pre-filter transaction list on page load
  - [ ] Show active filters in UI
- [ ] Add "Back to Dashboard" link (AC: 7)
  - [ ] Add link/button at top of transaction page
  - [ ] Navigate to `/dashboard` on click
  - [ ] Style as breadcrumb or back button
  - [ ] Show only when navigated from dashboard (optional: check referrer)
- [ ] Implement mobile touch interactions (AC: 8)
  - [ ] Ensure tap works on mobile (onClick handlers compatible)
  - [ ] Show tooltip on tap (first tap shows tooltip, second tap navigates)
  - [ ] Test on iOS and Android devices
- [ ] Add keyboard accessibility (AC: 9)
  - [ ] Ensure charts focusable via Tab key
  - [ ] Add ARIA labels to chart containers
  - [ ] Support Enter key to trigger drill-down
  - [ ] Add keyboard navigation instructions (optional)
- [ ] Add screen reader support (AC: 10)
  - [ ] Add ARIA attributes to chart containers
  - [ ] Announce chart data via accessible data tables (already in 5.3, 5.4)
  - [ ] Announce drill-down availability: "Click to view transactions"
  - [ ] Test with screen reader (NVDA, JAWS, VoiceOver)

## Dev Notes

### Architecture Alignment

**Navigation Pattern:**
- Use Next.js App Router with query params for filtering
- Chart onClick handlers trigger client-side navigation via `useRouter()`
- Transaction page reads query params and applies filters

**Recharts Interactivity:**
- `<Pie onClick={(data) => handleClick(data)}>` for pie chart
- `<Line onClick={(data) => handleClick(data)}>` for line chart
- Data object contains clicked element's data (category, month, values)

**Filter Persistence:**
- Query params in URL maintain filter state
- Transaction page reads `searchParams` in Server Component
- Filters applied server-side or client-side depending on implementation

**Accessibility:**
- ARIA labels on chart containers
- Keyboard event handlers for Enter key
- Focus management with `tabIndex` attribute
- Screen reader announces via accessible data tables

### Source Tree Components to Touch

**Existing Files to Modify:**
- `src/components/dashboard/SpendingByCategory.tsx` - Add onClick handler for drill-down
- `src/components/dashboard/SpendingTrends.tsx` - Add onClick handler for drill-down
- `src/app/(transactions)/page.tsx` - Read query params and apply filters
- `src/components/dashboard/PieChartTooltip.tsx` - Ensure 100ms performance
- `src/components/dashboard/LineChartTooltip.tsx` - Ensure 100ms performance

**New Files to Create (Optional):**
- `src/components/layout/BackButton.tsx` - Reusable back navigation button (optional)

**Existing Files to Reference:**
- `src/types/category.types.ts` - Category type definitions
- Next.js `useRouter` from `next/navigation`
- Recharts event handler documentation

### Testing Standards Summary

**Manual Testing Checklist:**
1. **Pie Chart Click:**
   - Click any pie slice → navigates to `/transactions?category=[id]&month=[month]`
   - Transaction page loads with filtered list (only that category, only that month)
   - Cursor changes to pointer on hover over slices
2. **Line Chart Click:**
   - Click any data point on Income line → navigates to `/transactions?month=[month]`
   - Click any data point on Expenses line → navigates to `/transactions?month=[month]`
   - Transaction page loads with filtered list (only that month)
   - Cursor changes to pointer on hover over data points
3. **Tooltips:**
   - Hover over chart elements → tooltip appears within 100ms
   - Tooltip shows exact values and labels
   - Tooltip disappears when hover ends
4. **Transaction Page Filters:**
   - URL query params correctly parsed
   - Filters applied to transaction list
   - Active filters shown in UI (e.g., "Filtered by: Dining, November 2025")
5. **Back to Dashboard:**
   - "Back to Dashboard" link visible on transaction page
   - Click link → returns to dashboard
6. **Mobile:**
   - Tap pie slice → shows tooltip (first tap)
   - Tap again → navigates (second tap) OR single tap navigates (test both UX patterns)
   - Tap line chart point → navigates
7. **Keyboard:**
   - Tab to focus on pie chart → Enter key triggers drill-down (or shows tooltip)
   - Tab to focus on line chart → Enter key triggers drill-down
8. **Screen Reader:**
   - Screen reader announces chart data from accessible tables
   - Announces drill-down capability: "Click to view detailed transactions"
   - Test with NVDA (Windows), VoiceOver (Mac/iOS)

### Project Structure Notes

**Alignment with Unified Structure:**
- Uses Next.js App Router query params for filter state
- Client-side navigation via `useRouter()` hook
- Transaction page already exists (Story 3.2), just needs query param handling

**UX Considerations:**
- Mobile: single tap vs double tap for drill-down (test both)
- Tooltip performance: ensure <100ms for smooth experience
- Back button: breadcrumb style vs back arrow button

**Recharts Event Handling:**
- onClick prop available on `<Pie>`, `<Line>` components
- Data object passed to handler contains clicked element details
- Example: `{ name: "Dining", value: 480, fill: "#FF6B6B" }`

**No Detected Conflicts:**
- Transaction filtering already implemented (Story 3.2)
- Query params standard in Next.js App Router
- Recharts supports onClick out of the box

### References

- [Source: docs/PRD.md#FR28] - Clickable charts drill down to filtered transactions
- [Source: docs/PRD.md#FR23] - Hover tooltips with exact values
- [Source: docs/PRD.md#FR26] - Chart updates and interactivity targets
- [Source: docs/PRD.md#FR46] - Touch targets 44x44px minimum on mobile
- [Source: docs/architecture.md#Navigation-Patterns] - Client-side navigation with query params
- [Source: docs/ux-design-specification.md#Chart-Interactivity] - Cursor feedback, drill-down UX
- [Source: docs/sprint-artifacts/tech-spec-epic-5.md#Chart-Interactivity] - Recharts onClick implementation
- [Source: docs/epics.md#Story-5.6] - Full acceptance criteria and technical notes
- [Source: docs/epics.md#Story-3.2] - Transaction list filtering (prerequisite)

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
