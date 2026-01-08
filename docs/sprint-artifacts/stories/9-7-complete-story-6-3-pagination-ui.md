# Story 9.7: Complete Story 6-3 Pagination UI

Status: drafted

## Story

As a user,
I want advanced pagination controls (page size selector, jump-to-page input),
So that I can efficiently navigate large transaction lists and customize my viewing experience.

## Acceptance Criteria

**AC-9.7.1:** Page Size Selector
✅ Add "Items per page" dropdown with options: 10, 25, 50, 100

**AC-9.7.2:** Jump to Page Input
✅ Add "Jump to page" input field with validation (1 to max page number)

**AC-9.7.3:** Persistent Page Size Preference
✅ Store selected page size in localStorage and restore on page load

**AC-9.7.4:** Dynamic Total Page Count
✅ Automatically recalculate total page count when page size changes

**AC-9.7.5:** Mobile-Responsive Controls
✅ Pagination controls stack vertically on mobile, horizontal on desktop

**AC-9.7.6:** Validation and Error Handling
✅ Jump-to-page input rejects invalid values (non-numeric, out of range), shows error message

**AC-9.7.7:** Accessibility
✅ Pagination controls keyboard navigable (Tab, Enter) and screen reader compatible

**AC-9.7.8:** Unit Tests
✅ Comprehensive tests for pagination interactions (page size change, jump to page, persistence)

## Tasks / Subtasks

- [ ] Locate existing pagination component (AC: All)
  - [ ] Find pagination implementation (likely in `src/app/(dashboard)/transactions/page.tsx` or shared component)
  - [ ] Review current pagination state management (likely useState or URL params)
  - [ ] Identify Chakra UI pagination components in use

- [ ] Add page size selector (AC: 9.7.1, 9.7.3)
  - [ ] Create or update `PaginationControls` component
  - [ ] Add Chakra UI `<Select>` component for page size
  - [ ] Options: 10, 25, 50, 100 items per page
  - [ ] Default: 25 items per page (existing behavior)
  - [ ] On change:
    - [ ] Update page size state
    - [ ] Store in localStorage: `localStorage.setItem('transactions_page_size', pageSize)`
    - [ ] Reset to page 1 (avoid showing empty page if new size has fewer total pages)
  - [ ] On mount: restore from localStorage if exists

- [ ] Add jump to page input (AC: 9.7.2, 9.7.6)
  - [ ] Add Chakra UI `<NumberInput>` component for page number
  - [ ] Label: "Jump to page"
  - [ ] Placeholder: "1-{totalPages}"
  - [ ] Min: 1, Max: totalPages
  - [ ] On Enter key or blur:
    - [ ] Validate input (1 ≤ value ≤ totalPages)
    - [ ] If valid: navigate to page
    - [ ] If invalid: show error message, clear input
  - [ ] Use Chakra UI `<FormControl>` with `isInvalid` for error state

- [ ] Update total page count calculation (AC: 9.7.4)
  - [ ] Calculate: `totalPages = Math.ceil(totalTransactions / pageSize)`
  - [ ] Recalculate when:
    - [ ] Page size changes
    - [ ] Total transactions count changes (filter, new data)
  - [ ] Display total pages: "Page 1 of 10"

- [ ] Implement responsive layout (AC: 9.7.5)
  - [ ] Desktop (≥768px): Horizontal flex layout
    - [ ] [Previous] [1] [2] [3] ... [Next] | Items per page: [Select] | Jump to page: [Input]
  - [ ] Mobile (<768px): Stack vertically or wrap
    - [ ] [Previous] [1] [2] [3] [Next]
    - [ ] Items per page: [Select]
    - [ ] Jump to page: [Input]
  - [ ] Use Chakra UI responsive props: `flexDirection={{ base: 'column', md: 'row' }}`

- [ ] Add accessibility features (AC: 9.7.7)
  - [ ] Ensure all controls keyboard navigable (Tab order)
  - [ ] Add ARIA labels:
    - [ ] `aria-label="Items per page"` on Select
    - [ ] `aria-label="Jump to page number"` on NumberInput
    - [ ] `aria-label="Go to page {n}"` on page number buttons
  - [ ] Announce page changes to screen readers: `aria-live="polite"`
  - [ ] Support Enter key for jump-to-page submission

- [ ] Write unit tests (AC: 9.7.8)
  - [ ] Test page size selector change (updates state, recalculates pages)
  - [ ] Test page size persistence (localStorage save and restore)
  - [ ] Test jump-to-page input (valid page, invalid page, boundary cases)
  - [ ] Test error messages (out of range, non-numeric input)
  - [ ] Test total page count recalculation (page size change)
  - [ ] Test responsive layout (mobile vs desktop)
  - [ ] Test keyboard navigation (Tab, Enter)

- [ ] Write component tests (AC: All)
  - [ ] Test PaginationControls component renders correctly
  - [ ] Test user interaction: change page size to 50, verify 50 items displayed
  - [ ] Test user interaction: jump to page 5, verify page 5 displayed
  - [ ] Test error handling: enter page 999 (out of range), verify error shown

- [ ] Update documentation (AC: All)
  - [ ] Update component documentation with new pagination features
  - [ ] Add usage examples for page size and jump-to-page

## Dev Notes

- **Completes Story 6-3:** Story 6-3 implemented basic pagination (prev/next, page numbers) but deferred page size selector and jump-to-page as "nice-to-have". This story closes that gap.
- **localStorage Key:** Use `transactions_page_size` for storing preference (not `pageSize` generic, to avoid conflicts with other paginated views).
- **UX:** When page size changes, reset to page 1 to avoid confusion (e.g., user on page 10 with 25 items/page, changes to 100 items/page → page 10 might not exist).
- **Validation:** Jump-to-page input should reject values like "0", "-1", "abc", "3.5", or page numbers > totalPages.

### Project Structure Notes

**Modified Files:**
- `src/app/(dashboard)/transactions/page.tsx` - Add page size selector and jump-to-page controls
- `src/components/pagination/PaginationControls.tsx` (if exists) - Extend with new controls

**New Files:**
- None (extends existing pagination implementation)

**Example UI:**
```
Desktop Layout:
┌────────────────────────────────────────────────────────────┐
│ [← Previous] [1] [2] [3] ... [10] [Next →]                │
│ Items per page: [25 ▼]  Jump to page: [___] [Go]          │
│ Showing 26-50 of 237 transactions                          │
└────────────────────────────────────────────────────────────┘

Mobile Layout:
┌─────────────────────────┐
│ [← Prev] [1] [2] [Next] │
│ Items per page: [25 ▼]  │
│ Jump to: [___] [Go]     │
│ 26-50 of 237            │
└─────────────────────────┘
```

**Alignment with Architecture:**
- Chakra UI components (Select, NumberInput, FormControl)
- localStorage for user preferences (consistent with theme, filters)
- Responsive design (mobile-first approach)

### References

- [Tech Spec: Epic 9 - Story 9-7 Acceptance Criteria](../tech-spec-epic-9.md#story-9-7-complete-story-6-3-pagination-ui)
- [Story 6-3: Transaction List with Filtering and Pagination](../stories/6-3-transaction-list-with-filtering-and-pagination.md)
- [Epic 6 Retrospective: Complete Story 6-3 Pagination UI](../epic-6-retrospective.md#recommended-actions-for-future-epics)
- [Chakra UI Select Component](https://chakra-ui.com/docs/components/select)
- [Chakra UI NumberInput Component](https://chakra-ui.com/docs/components/number-input)

## Dev Agent Record

### Context Reference

- [Story 9-7 Context](9-7-complete-story-6-3-pagination-ui.context.xml) - To be created during dev workflow

### Agent Model Used

TBD (Claude Sonnet 4.5)

### Debug Log References

TBD

### Completion Notes List

TBD - To be filled during implementation

### File List

TBD - To be filled during implementation
