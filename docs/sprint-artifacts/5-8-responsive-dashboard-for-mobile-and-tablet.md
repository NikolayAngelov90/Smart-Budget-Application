# Story 5.8: Responsive Dashboard for Mobile and Tablet

Status: drafted

## Story

As a user,
I want the dashboard to work perfectly on my phone and tablet,
So that I can check my finances on the go.

## Acceptance Criteria

**Given** I view the dashboard on different devices
**When** The screen size changes
**Then** The layout adapts appropriately

**And** Mobile (<768px):
  - Single column layout
  - StatCards stacked vertically
  - Charts full width, stacked vertically
  - Bottom navigation or collapsible sidebar
  - Touch targets 44x44px minimum
**And** Tablet (768-1023px):
  - Two-column grid for StatCards
  - Charts side-by-side or stacked depending on space
  - Collapsible sidebar (icon-only)
**And** Desktop (≥1024px):
  - Full sidebar (250px)
  - Three-column StatCard grid
  - Charts side-by-side
  - Max-width 1200px container
**And** All breakpoints tested and functional
**And** Touch interactions work on mobile (swipe, tap, pinch-zoom disabled on charts)
**And** Fonts scale appropriately (H1: 2.5rem desktop, 2rem mobile)
**And** Charts render correctly at all sizes
**And** No horizontal scrolling on mobile

## Tasks / Subtasks

- [ ] Implement mobile layout (<768px) (AC: 1, 2)
  - [ ] Modify `src/app/(dashboard)/page.tsx` for single column layout
  - [ ] Use Chakra UI responsive props: `display={{ base: 'block', md: 'flex' }}`
  - [ ] Stack StatCards vertically (full width)
  - [ ] Stack charts vertically (full width)
  - [ ] Ensure touch targets 44x44px minimum (buttons, links)
  - [ ] Test on iPhone SE (320px), iPhone 12 (390px), Pixel 5 (393px)
- [ ] Implement tablet layout (768-1023px) (AC: 1, 3)
  - [ ] Modify `src/app/(dashboard)/page.tsx` for two-column grid
  - [ ] StatCards: 2-column grid (2 cards on top row, 1 below)
  - [ ] Charts: side-by-side if space allows, otherwise stacked
  - [ ] Use collapsible sidebar from Story 5.1 (icon-only mode)
  - [ ] Test on iPad (768px), iPad Pro (1024px)
- [ ] Implement desktop layout (≥1024px) (AC: 1, 4)
  - [ ] Modify `src/app/(dashboard)/page.tsx` for optimal desktop layout
  - [ ] StatCards: 3-column grid (all 3 cards in one row)
  - [ ] Charts: side-by-side (pie chart left, line chart right)
  - [ ] Full sidebar visible (250px, from Story 5.1)
  - [ ] Max-width 1200px container, centered
  - [ ] Test on standard desktop (1440px, 1920px) and ultrawide (2560px)
- [ ] Configure responsive breakpoints (AC: 5)
  - [ ] Use Chakra UI breakpoints: `base` (<768px), `md` (768px), `lg` (1024px), `xl` (1280px)
  - [ ] Apply responsive props to all components: `<Box width={{ base: '100%', md: '50%', lg: '33%' }}>`
  - [ ] Verify breakpoint transitions smooth (no flicker)
- [ ] Implement responsive typography (AC: 1, 7)
  - [ ] Use Chakra UI responsive font sizes
  - [ ] H1: `fontSize={{ base: '2rem', lg: '2.5rem' }}`
  - [ ] H2: `fontSize={{ base: '1.5rem', lg: '2rem' }}`
  - [ ] Body: `fontSize={{ base: '0.875rem', lg: '1rem' }}`
  - [ ] Ensure text remains readable on all devices
- [ ] Ensure charts responsive (AC: 8)
  - [ ] Verify Recharts `<ResponsiveContainer>` adapts to container width
  - [ ] Charts render correctly at all sizes (250px to 1200px wide)
  - [ ] Pie chart: legend below on mobile, side on desktop
  - [ ] Line chart: X-axis labels rotate or abbreviate on mobile if needed
  - [ ] Test chart interactivity on mobile (touch events)
- [ ] Implement touch interactions (AC: 6)
  - [ ] Ensure all buttons/links work with touch (tap)
  - [ ] Test chart tap interactions (drill-down from Story 5.6)
  - [ ] Disable pinch-zoom on charts (optional, for fixed layout)
  - [ ] Add touch-friendly padding around interactive elements
- [ ] Prevent horizontal scrolling (AC: 9)
  - [ ] Ensure all components fit within viewport width
  - [ ] Use `overflow-x: hidden` on body if needed
  - [ ] Test on narrow screens (320px iPhone SE)
  - [ ] Verify no elements exceed screen width
- [ ] Cross-device testing (AC: 5)
  - [ ] Test on physical devices: iPhone, Android phone, iPad, desktop
  - [ ] Test on browser DevTools device emulation
  - [ ] Verify breakpoints: 320px, 375px, 768px, 1024px, 1440px, 1920px
  - [ ] Test orientation changes (portrait ↔ landscape)

## Dev Notes

### Architecture Alignment

**Responsive Strategy:**
- Mobile-first approach: base styles for mobile, progressive enhancement for larger screens
- Chakra UI responsive props: `{ base, md, lg, xl }` for breakpoint-specific styles
- CSS Grid and Flexbox for flexible layouts

**Chakra UI Breakpoints:**
- `base`: 0px (mobile)
- `sm`: 480px (small mobile)
- `md`: 768px (tablet)
- `lg`: 1024px (desktop)
- `xl`: 1280px (large desktop)
- `2xl`: 1536px (extra large)

**Recharts Responsiveness:**
- `<ResponsiveContainer>` automatically adapts to parent width
- Charts rerender on window resize
- Maintain aspect ratio for readability

**Touch Interactions:**
- All onClick handlers work with touch events (React handles this)
- Touch targets: minimum 44x44px (WCAG accessibility guideline)
- Optional: disable pinch-zoom with viewport meta tag

### Source Tree Components to Touch

**Existing Files to Modify:**
- `src/app/(dashboard)/page.tsx` - Add responsive layout with Chakra UI props
- `src/app/(dashboard)/layout.tsx` - Ensure sidebar responsive (from Story 5.1)
- `src/components/dashboard/DashboardStats.tsx` - Add responsive grid for StatCards
- `src/components/dashboard/SpendingByCategory.tsx` - Ensure chart responsive
- `src/components/dashboard/SpendingTrends.tsx` - Ensure chart responsive
- `src/components/dashboard/MonthOverMonth.tsx` - Add responsive list/grid layout
- `src/components/layout/Sidebar.tsx` - Ensure collapsible behavior (from Story 5.1)
- `src/components/layout/MobileNav.tsx` - Ensure mobile navigation works (from Story 5.1)

**Existing Files to Reference:**
- Chakra UI responsive utilities documentation
- Next.js viewport configuration (`app/layout.tsx`)

### Testing Standards Summary

**Manual Testing Checklist:**
1. **Mobile (<768px):**
   - Single column layout
   - StatCards stacked vertically (3 rows)
   - Pie chart full width, below StatCards
   - Line chart full width, below pie chart
   - Month-over-month section full width
   - Sidebar hidden, hamburger menu opens drawer
   - All touch targets 44x44px minimum
   - No horizontal scroll at 320px width
2. **Tablet (768-1023px):**
   - Two-column StatCard grid (2 cards top, 1 bottom)
   - Charts side-by-side or stacked (test both)
   - Sidebar collapsible to icon-only mode
   - Touch interactions work
3. **Desktop (≥1024px):**
   - Three-column StatCard grid (all 3 in one row)
   - Pie chart and line chart side-by-side
   - Full sidebar visible (250px)
   - Container max-width 1200px, centered
   - Hover interactions work
4. **Typography:**
   - H1: 2rem mobile, 2.5rem desktop
   - Text readable at all sizes
5. **Charts:**
   - Recharts ResponsiveContainer adapts to width
   - Charts render correctly from 320px to 2560px
   - Tooltips appear on hover (desktop) and tap (mobile)
   - Drill-down works on all devices
6. **Touch Interactions:**
   - Buttons respond to tap
   - Chart slices/points clickable on mobile
   - Swipe gestures work if implemented
7. **Breakpoint Transitions:**
   - Smooth transition when resizing window
   - No layout flickering or jumping
8. **Cross-Device Testing:**
   - Test on: iPhone SE (320px), iPhone 12 (390px), iPad (768px), Desktop (1440px)
   - Test portrait and landscape orientations
   - Test on Chrome, Safari, Firefox

**Device Testing Matrix:**
| Device | Width | Breakpoint | Layout |
|--------|-------|------------|--------|
| iPhone SE | 320px | base | Single column, stacked |
| iPhone 12 | 390px | base | Single column, stacked |
| iPad | 768px | md | Two-column StatCards |
| iPad Pro | 1024px | lg | Three-column StatCards |
| Desktop | 1440px | lg | Full desktop layout |
| Ultrawide | 2560px | xl | Max-width 1200px container |

### Project Structure Notes

**Alignment with Unified Structure:**
- Uses Chakra UI responsive props throughout
- Follows mobile-first CSS methodology
- Leverages existing sidebar/mobile nav from Story 5.1

**Mobile-First Approach:**
- Base styles optimized for mobile
- Media queries add complexity for larger screens
- Improves performance on mobile devices

**Responsive Grid Strategy:**
```jsx
// StatCards responsive grid
<Grid
  templateColumns={{
    base: '1fr',           // Mobile: 1 column
    md: 'repeat(2, 1fr)',  // Tablet: 2 columns
    lg: 'repeat(3, 1fr)',  // Desktop: 3 columns
  }}
  gap={4}
>
  <StatCard {...} />
  <StatCard {...} />
  <StatCard {...} />
</Grid>
```

**No Detected Conflicts:**
- Chakra UI responsive props already in use (consistent pattern)
- Sidebar responsive behavior from Story 5.1
- Recharts ResponsiveContainer handles chart sizing

### References

- [Source: docs/PRD.md#FR44] - Mobile responsive: 320px minimum width
- [Source: docs/PRD.md#FR45] - Tablet responsive: 768px breakpoint
- [Source: docs/PRD.md#FR46] - Touch targets 44x44px minimum
- [Source: docs/architecture.md#Responsive-Design] - Chakra UI breakpoints, mobile-first
- [Source: docs/ux-design-specification.md#Responsive-Layouts] - Breakpoint designs for all devices
- [Source: docs/sprint-artifacts/tech-spec-epic-5.md#Responsive-Strategy] - Layout grid, Recharts responsive
- [Source: docs/epics.md#Story-5.8] - Full acceptance criteria and technical notes
- [Source: docs/epics.md#Story-5.1] - Sidebar responsive behavior (prerequisite)

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
