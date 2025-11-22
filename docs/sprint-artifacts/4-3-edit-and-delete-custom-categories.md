### Story 4.3: Edit and Delete Custom Categories

As a user,
I want to edit or delete my custom categories,
So that I can reorganize my spending classification as needed.

**Acceptance Criteria:**

**Given** I have custom categories
**When** I edit or delete a category
**Then** Changes are reflected across all transactions

**And** Each custom category card has edit (pencil icon) and delete (trash icon) buttons on hover
**And** Predefined categories show "Default" badge instead of action buttons and are grayed out
**And** Clicking edit opens category modal pre-filled with current values (name, color, type)
**And** Name and color editable, type read-only (cannot change expense ↔ income)
**And** "Save" updates category via `PUT /api/categories/:id`
**And** Update reflected immediately across all transactions using that category
**And** Delete button triggers confirmation modal: "Delete 'Dining' category? 47 transactions use this category and will become uncategorized."
**And** Confirmation modal has "Cancel" and "Delete Anyway" buttons (red styling on destructive)
**And** If transactions exist, warn: "Transactions become uncategorized and can be re-categorized later"
**And** Clicking "Delete Anyway" removes category via `DELETE /api/categories/:id`
**And** Transactions with deleted category become "Uncategorized" (null category_id)
**And** Cannot delete predefined categories (buttons hidden/disabled)
**And** Success toasts: "Category updated successfully" or "Category deleted successfully"
**And** Mobile: long-press menu on cards, full-screen modals

**Prerequisites:** Story 4.2 (custom categories created), Story 3.1 (transactions use categories)

**Technical Notes:**
- Reuse `<CategoryModal>` in edit mode with `editMode=true` prop
- API: `PUT /api/categories/:id`, `DELETE /api/categories/:id`
- Query transaction count before delete: `SELECT COUNT(*) FROM transactions WHERE category_id = :id`
- Handle orphaned transactions: show "Uncategorized" in UI, null category_id in database (transactions remain)
- Database constraint: `ON DELETE RESTRICT` prevents deletion if transactions exist - UI handles this
- Optimistic updates with rollback on error (if API fails, revert UI changes)
- Predefined categories: `is_predefined = true` flag, disable edit/delete with `isDisabled` prop
- Mobile: implement touch interactions, larger targets (44x44px minimum)

---

## Tasks / Subtasks

- [ ] Add edit and delete buttons to category cards
- [ ] Implement edit mode for CategoryModal (reuse component)
- [ ] Create PUT /api/categories/:id endpoint for updates
- [ ] Create DELETE /api/categories/:id endpoint for deletion
- [ ] Protect predefined categories from edit/delete (UI/RBAC)
- [ ] Implement confirmation modal for delete operations
- [ ] Query transaction count before deletion
- [ ] Show warning about transaction impacts on delete
- [ ] Handle orphaned transactions (mark as uncategorized)
- [ ] Implement optimistic UI updates for edit/delete
- [ ] Add success/error toast notifications
- [ ] Test mobile responsive design (long-press menus)
- [ ] Implement keyboard accessibility for all interactions
- [ ] Test edge cases: delete categories with/without transactions

## Dev Notes

**Implementation planned for Epic 4 implementation when Story 4.3 is reached in sprint.**

**Dependencies:**
- Depends on Story 4.2 (category management page and modal exist)
- Affects transactions via category deletion (orphaning)

## Status
Ready for Implementation
