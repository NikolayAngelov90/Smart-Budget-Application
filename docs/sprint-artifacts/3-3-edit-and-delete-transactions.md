### Story 3.3: Edit and Delete Transactions

As a user,
I want to edit or delete existing transactions,
So that I can correct mistakes or remove duplicates.

**Acceptance Criteria:**

**Given** I have existing transactions
**When** I click edit or delete on a transaction
**Then** The transaction is updated or removed successfully

**And** Each transaction card has edit (pencil icon) and delete (trash icon) buttons
**And** Edit button opens same modal as quick-entry, pre-filled with transaction data
**And** Modal title changes to "Edit Transaction"
**And** All fields editable: amount, type, category, date, notes
**And** "Save" button updates transaction via PUT request
**And** Optimistic update: changes appear immediately
**And** Success toast: "Transaction updated successfully"
**And** Delete button triggers confirmation modal: "Delete this transaction? This cannot be undone."
**And** Confirmation modal has "Cancel" and "Delete" buttons
**And** Delete button styled as danger (red)
**And** Clicking "Delete" removes transaction via DELETE request
**And** Optimistic removal: transaction disappears immediately from list
**And** Success toast: "Transaction deleted successfully"
**And** Undo option in toast (5-second window) to restore deleted transaction
**And** Both operations complete in < 200ms (perceived time with optimistic UI)
**And** Error handling: network failure shows retry option, validation errors shown inline

**Prerequisites:** Story 3.1 (transaction entry), Story 3.2 (transaction list)

**Technical Notes:**
- Reuse `<TransactionEntryModal>` component with edit mode prop
- Add edit/delete IconButtons to transaction cards
- API: `PUT /api/transactions/:id` with updated data
- API: `DELETE /api/transactions/:id`
- Optimistic update pattern with SWR mutate
- Confirmation modal using Chakra UI AlertDialog
- Undo functionality: store deleted transaction in state for 5 seconds, POST if undo clicked
- Toast with undo: `toast({ title: 'Transaction deleted', action: <Button>Undo</Button> })`
- Mobile: swipe-to-delete gesture optional (use Chakra UI or framer-motion)
- Error rollback: if API fails, revert optimistic update and show error toast
