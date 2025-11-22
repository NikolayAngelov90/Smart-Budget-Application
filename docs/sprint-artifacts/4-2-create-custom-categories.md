### Story 4.2: Create Custom Categories

As a user,
I want to create my own custom categories with names and colors,
So that I can organize transactions according to my personal spending patterns.

**Acceptance Criteria:**

**Given** I need a category not in the predefined list
**When** I create a custom category
**Then** It's available for use in transactions

**And** "Manage Categories" page accessible from Settings or sidebar
**And** "Add Category" button opens category creation modal
**And** Modal has category name input field (max 100 characters)
**And** Category type selector: Expense or Income (segmented control)
**And** Color picker shows 12 predefined color options (from theme palette)
**And** Color preview shown next to name field
**And** "Save" button disabled until name and color selected
**And** Category name validated: not empty, unique per user per type, no special characters beyond spaces
**And** Category created via `POST /api/categories`
**And** New category appears immediately in category list (optimistic UI)
**And** New category available in transaction entry dropdown immediately
**And** Success toast: "Category '[name]' created successfully"
**And** Modal closes automatically on save
**And** Form fully keyboard accessible (Tab, Enter to submit)
**And** Mobile responsive: full-screen modal on small devices
**And** Error handling: duplicate name shows "Category name already exists"

**Prerequisites:** Story 4.1 (default categories exist), Story 3.1 (transaction entry uses categories), Story 7.3 (settings page exists)

**Technical Notes:**
- Create `/app/(dashboard)/categories/page.tsx`
- Create `<CategoryModal>` component with React Hook Form + Zod
- Color picker: Chakra UI or custom component with predefined palette (12 options from UX spec)
- Palette colors from theme: Trust Blue, coral red, purple, teal, orange, green, blue variants
- API: `POST /api/categories` with body `{ name, color, type, is_predefined: false }`
- Validation: check uniqueness in Supabase (unique constraint or query check)
- Optimistic update using SWR mutate
- Error handling: duplicate name, network error (inline red messages)
- Display categories in grid: IconButton for actions, Text for name, Box for color badge
- Test integration with transaction entry modal category dropdown

---

## Tasks / Subtasks

- [ ] Create `/app/(dashboard)/categories/page.tsx` - category management page
- [ ] Create `<CategoryModal>` component with React Hook Form + Zod validation
- [ ] Implement color picker with 12 predefined theme colors
- [ ] Add navigation link to categories page from sidebar/settings
- [ ] Implement form validation (required fields, uniqueness)
- [ ] Create POST /api/categories endpoint if not exists
- [ ] Integrate optimistic UI updates with SWR
- [ ] Add success toast notifications
- [ ] Implement error handling (duplicate names, network errors)
- [ ] Ensure mobile responsive design (full-screen modal)
- [ ] Test keyboard accessibility (Tab navigation, Enter to submit)
- [ ] Verify new categories appear in transaction dropdown
- [ ] Test integration with transaction entry modal

## Dev Notes

**Implementation planned for Epic 4 implementation when Story 4.2 is reached in sprint.**

**Dependencies:**
- Depends on Story 4.1 (categories table and seeded categories exist)
- Integration tested with Story 3.1 (transaction entry modal)

## Status
Ready for Implementation
