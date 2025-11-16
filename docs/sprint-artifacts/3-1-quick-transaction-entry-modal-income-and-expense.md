### Story 3.1: Quick Transaction Entry Modal (Income and Expense)

As a user,
I want to add a transaction quickly via a floating action button,
So that I can log expenses and income in under 30 seconds.

**Acceptance Criteria:**

**Given** I want to log a transaction
**When** I click the FAB and fill out the quick-entry form
**Then** My transaction is saved in under 30 seconds

**And** Floating Action Button (FAB) fixed in bottom-right corner (60x60px, Trust Blue)
**And** FAB shows "+" icon, always visible on all pages
**And** Clicking FAB opens transaction entry modal
**And** Modal auto-focuses on amount input field
**And** Amount field accepts numeric input only (mobile numeric keyboard)
**And** Amount formatted to 2 decimal places automatically
**And** Transaction type toggle: "Expense" (default) vs "Income" (segmented control)
**And** Category dropdown shows recently-used categories first (last 5)
**And** Then shows all predefined categories alphabetically
**And** Category dropdown searchable/filterable
**And** Date picker defaults to today's date
**And** Quick date options: Today, Yesterday, 2 days ago
**And** Optional notes field (100 character limit, single line)
**And** "Save" button disabled until amount and category selected
**And** Optimistic UI: transaction appears immediately in list before server confirmation
**And** Success toast: "Transaction added successfully"
**And** Modal closes automatically on successful save
**And** All fields cleared for next entry
**And** Entire flow completable with keyboard only
**And** Touch targets 44x44px minimum on mobile

**Prerequisites:** Story 1.2 (database), Story 2.3 (user logged in), Story 4.1 (categories seeded)

**Technical Notes:**
- Create `<FloatingActionButton>` component (Chakra UI IconButton)
- Create `<TransactionEntryModal>` component with React Hook Form + Zod
- Use Chakra UI Modal, Input, Select, Button components
- API: `POST /api/transactions` with body `{ amount, type, category_id, date, notes }`
- Optimistic update pattern with SWR: `mutate([...transactions, newTransaction], false)`
- Category dropdown: fetch from `/api/categories` sorted by recent usage
- Date picker: Chakra UI or react-datepicker with quick-select buttons
- Numeric input: pattern="[0-9]*" inputMode="decimal" for mobile
- Auto-format amount: `parseFloat(value).toFixed(2)` on blur
- Validation: amount > 0, category required, date not in future
- Error handling: network failure (retry button), validation errors (inline messages)
- Mobile: full-screen modal, desktop: 600px centered modal
