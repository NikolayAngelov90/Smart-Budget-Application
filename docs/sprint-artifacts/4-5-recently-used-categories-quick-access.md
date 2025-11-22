### Story 4.5: Recently-Used Categories Quick Access

As a user,
I want my recently-used categories shown first in the transaction entry dropdown,
So that I can select common categories faster.

**Acceptance Criteria:**

**Given** I open the transaction entry modal
**When** I view the category dropdown
**Then** My 5 most recently-used categories are shown at the top

**And** "Recent" section appears first in dropdown, separated by gray divider line
**And** Shows last 5 categories used in transactions (most recent first, based on transaction created_at)
**And** Each recent category shows color dot (8px) + name (regular font weight)
**And** "All Categories" section below shows all categories alphabetically
**And** Predefined and custom categories both included in "All" section
**And** If fewer than 5 categories used, show all recent ones (no minimum)
**And** New users with no transactions see only "All Categories" section (no recent section)
**And** Recent categories updated immediately after saving a transaction
**And** Recent list computed from transaction history (not stored separately for sync across devices)
**And** Selecting recent category same behavior as selecting from full list
**And** Hover/click behavior consistent between recent and all sections
**And** Mobile: recent categories large enough to tap easily (44x44px touch target on list items)
**And** Keyboard navigation: Tab moves between sections, arrow keys navigate within sections

**Prerequisites:** Story 3.1 (transaction entry modal), Story 4.1 (categories exist), Story 3.4 (transaction history)

**Technical Notes:**
- Implement in `/api/categories` endpoint with recent usage parameter
- Query recent categories: `SELECT DISTINCT category_id FROM transactions WHERE user_id = :id ORDER BY created_at DESC LIMIT 5`
- Join with categories table to get names and colors: Use Supabase join or separate queries
- Store in component state or pass from API call on modal open
- Update after transaction creation: invalidate SWR cache for categories or re-query on modal close
- Chakra UI Select with `<optgroup label="Recent">` and `<optgroup label="All Categories">` groups
- Alternative: custom dropdown component with sections (if Chakra Select limitations)
- Search/filter: filter across both Recent and All categories lists (300ms debounce)
- Performance: query optimizations to avoid expensive transaction history scans for every modal open

---

## Tasks / Subtasks

- [ ] Update GET /api/categories to support recent usage queries
- [ ] Implement recent categories query in SQL (with JOIN to categories table)
- [ ] Update transaction entry modal category dropdown to show recent section
- [ ] Add divider line between recent and all categories sections
- [ ] Implement color dots in both recent and all category sections
- [ ] Add recent category limit (5 most recent)
- [ ] Test edge cases: few/no transactions, only recent categories available
- [ ] Implement cache invalidation after transaction creation
- [ ] Test mobile responsiveness and touch targets
- [ ] Ensure keyboard accessibility (Tab/arrow navigation)
- [ ] Performance test: avoid expensive queries in modal opening path

## Dev Notes

**Implementation planned for Epic 4 implementation when Story 4.5 is reached in sprint.**

**Dependencies:**
- Depends on Story 3.1 (transaction entry modal exists)
- Depends on Story 3.4 (transaction creation and history)
- Depends on Story 4.1 (categories seeded and available)

## Status
Ready for Implementation
