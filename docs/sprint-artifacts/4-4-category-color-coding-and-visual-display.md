### Story 4.4: Category Color-Coding and Visual Display

As a user,
I want categories displayed with color-coding throughout the app,
So that I can quickly identify transaction types visually.

**Acceptance Criteria:**

**Given** I view transactions, dashboard, or category list
**When** Categories are displayed
**Then** Each category shows its assigned color for quick visual recognition

**And** Transaction list: each transaction shows category color dot (12px circle) next to name
**And** Transaction entry modal: category dropdown shows color dot before each category name
**And** Category dropdown lists: recent categories first, then alphabetical with color indicators
**And** Dashboard charts: categories displayed with their assigned colors in pie/donut and line charts
**And** Category management page: categories displayed as colored badges (color background/white text)
**And** Category color used consistently across entire application (transaction cards, filters, etc.)
**And** Color contrast meets WCAG AA standards (3:1 minimum for UI components)
**And** Color-blind friendly: categories distinguished by both color and pattern (striped overlays optional)
**And** Category badges show color as left border (4px) or background with proper contrast
**And** Mobile and desktop: color-coding equally visible on all screen sizes (minimum 8px indicators)
**And** Color picker shows previews with same visual treatment as actual usage

**Prerequisites:** Story 4.1 (categories have colors), Story 3.2 (transaction list), Story 4.2 (custom categories), Story 5.3 (charts)

**Technical Notes:**
- Create `<CategoryBadge>` component: `<Badge leftIcon={<CircleIcon color={category.color} />} variant="solid" bg={category.color}>`
- Use Chakra UI Badge, Tag, Avatar or custom styled component with color props
- Color stored as hex in database, applied via style prop or Chakra UI `colorScheme`
- Charts: pass category colors to Recharts pie slices and line colors via data mapping
- Ensure color palette contrast: test with Color Oracle for color-blind accessibility (avoid red-green combinations)
- Alternative visual indicators: icons for major categories (fork/knife for dining, car for transport, etc.) beyond color-only
- Consider color-blind mode in Settings: high-contrast borders, icons, or patterns (Phase 2)

---

## Tasks / Subtasks

- [ ] Create `CategoryBadge` component for consistent category display
- [ ] Implement color dots in transaction cards (list and entry modal)
- [ ] Add color coding to transaction entry category dropdown
- [ ] Integrate category colors with dashboard chart components
- [ ] Update category management page to show colored badges
- [ ] Ensure color system consistency across all components
- [ ] Test color contrast for WCAG AA compliance (3:1 minimum)
- [ ] Test with color-blinders: ensure adequate visual distinction
- [ ] Verify mobile responsiveness and minimum sizes
- [ ] Test color picker previews match actual usage

## Dev Notes

**Implementation planned for Epic 4 implementation when Story 4.4 is reached in sprint.**

**Dependencies:**
- Depends on Story 4.1-4.3 (categories exist with colors)
- Integration with Story 5.3-5.4 (dashboard charts) - DEFERRED to Epic 5
- Visual consistency across entire application

**Scope Adjustment:**
- Dashboard chart integration (AC mentioning charts) deferred to Epic 5 (Stories 5.3-5.4 don't exist yet)
- Focus on: CategoryBadge component, transaction list colors, dropdown color indicators, WCAG AA compliance

## Dev Agent Record

### Context Reference
- [Story Context XML](4-4-category-color-coding-and-visual-display.context.xml)

## Status
ready-for-dev
