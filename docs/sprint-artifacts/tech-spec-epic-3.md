# Epic 3: Transaction Management - Technical Context

**Author:** Niki
**Date:** 2025-11-16
**Epic:** [Transaction Management](./epics.md#epic-3-transaction-management)
**Architecture:** [Technical Architecture](./architecture.md)

---

## 1. Overview

This document provides the technical context and implementation plan for **Epic 3: Transaction Management**. This epic is the core of the application, enabling users to perform Create, Read, Update, and Delete (CRUD) operations on their financial transactions. The primary goal is to deliver a highly optimized and efficient user experience, particularly for transaction entry, which is a high-frequency user action.

Implementation will build upon the existing foundation of Next.js, Supabase, and Chakra UI, and will heavily rely on the database schema and API contracts defined in the architecture.

## 2. Core Technology & File Dependencies

This epic will utilize the established technical stack. No new major dependencies are anticipated.

- **Database:** **Supabase (PostgreSQL)** will be used to store all transaction data.
- **API Layer:** **Next.js API Routes** will serve as the backend to handle all transaction-related requests.
- **Data Fetching:** **SWR** will be used for client-side data fetching, caching, and state management, enabling features like optimistic UI updates and real-time synchronization.
- **Forms:** **React Hook Form** and **Zod** will be used for the transaction entry and edit forms, ensuring performance and type-safe validation.
- **UI Components:** **Chakra UI** will be used for all UI elements, including modals, forms, lists, and buttons.

### Key Files & Modules for This Epic:

| File/Module | Purpose | Relevance to Epic 3 |
| :--- | :--- | :--- |
| `supabase/migrations/001_initial_schema.sql` | **Database Schema:** Defines the `transactions` table structure, indexes, and RLS policies. | This is the blueprint for the data model. All CRUD operations must adhere to this schema. |
| `docs/architecture.md` | **API Contracts & Component Design:** Outlines the expected API endpoints for `/api/transactions` and lists the custom components to be built. | Provides the high-level plan for the API and frontend component structure. |
| `src/lib/supabase/client.ts` & `server.ts` | **Supabase Clients:** Provide the interface for all database interactions. | Will be used in API routes to execute queries against the `transactions` table. |
| `src/app/(dashboard)/transactions/` | **Transactions Page:** The main UI for listing, filtering, and managing transactions. | This directory will house the primary page component for Story 3.2. |
| `src/components/transactions/` | **Transaction Components:** Directory for reusable components like `TransactionCard`, `TransactionEntryModal`, etc. | This is where the core frontend components for this epic will be built. |
| `src/lib/hooks/useTransactions.ts` | **SWR Hook (to be created):** A custom hook to abstract SWR-based data fetching for transactions. | This will encapsulate the logic for fetching, creating, updating, and deleting transactions, including optimistic updates. |

## 3. Data Model

The `transactions` table is the central entity for this epic. Its design is critical for performance and functionality.

**Schema from `001_initial_schema.sql`:**
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  type transaction_type NOT NULL, -- ENUM ('income', 'expense')
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Considerations:**
- **`user_id`**: Enforces data ownership and is used by RLS policies.
- **`category_id`**: A `RESTRICT` constraint on deletion means a category cannot be deleted if it is associated with any transactions. The application logic in Epic 4 must handle this.
- **`amount`**: A `CHECK` constraint ensures the amount is always positive. The `type` field determines if it's a credit or debit.
- **Indexes**: Indexes on `user_id`, `date`, and `category_id` are crucial for fast filtering and sorting, as required by Story 3.2.

## 4. API Design

The API for transactions will be implemented as Next.js API Routes under `src/app/api/transactions/`. All endpoints will use the server-side Supabase client to interact with the database and will be protected by the authentication middleware.

- **`POST /api/transactions`** (Story 3.1)
  - **Action:** Creates a new transaction.
  - **Body:** `{ amount, type, category_id, date, notes }`
  - **Logic:** Inserts a new row into the `transactions` table for the authenticated user (`auth.uid()`).

- **`GET /api/transactions`** (Story 3.2)
  - **Action:** Retrieves a list of transactions.
  - **Query Params:** `?startDate=...`, `endDate=...`, `category=...`, `type=...`, `search=...`
  - **Logic:** Constructs a Supabase query that filters based on the provided parameters. Implements pagination (`.range()`) to handle large datasets. The search functionality will query the `notes` and `categories.name` fields.

- **`PUT /api/transactions/[id]`** (Story 3.3)
  - **Action:** Updates an existing transaction.
  - **Body:** Partial transaction object: `{ amount?, category_id?, date?, notes? }`
  - **Logic:** Updates the specified transaction, ensuring the `user_id` matches the authenticated user.

- **`DELETE /api/transactions/[id]`** (Story 3.3)
  - **Action:** Deletes a transaction.
  - **Logic:** Deletes the specified transaction, ensuring the `user_id` matches the authenticated user.

## 5. Frontend Implementation Plan

### Story 3.1: Quick Transaction Entry Modal

- **Component:** `src/components/transactions/TransactionEntryModal.tsx`
- **Trigger:** A Floating Action Button (`<FloatingActionButton>`) fixed on the screen.
- **Form:** Use `react-hook-form` with a `zod` schema for validation (amount > 0, category required).
- **Data Flow:**
    1. On form submission, call a function from the `useTransactions` SWR hook (e.g., `createTransaction`).
    2. This function will perform an optimistic update using `swr/mutation` to immediately add the new transaction to the local cache.
    3. It will then call the `POST /api/transactions` endpoint.
    4. On success, the local cache is revalidated. On failure, the optimistic update is rolled back and an error is shown.

### Story 3.2: Transaction List View

- **Page:** `src/app/(dashboard)/transactions/page.tsx`
- **Component:** `src/components/transactions/TransactionList.tsx`
- **Data Fetching:** The `useTransactions` hook will fetch data from `GET /api/transactions`. Filter states (date range, category) will be managed in the page component and passed to the hook, which will append them as query parameters.
- **UI:**
    - A `TransactionCard` component will display each transaction.
    - Filter controls (date picker, category selector) will be placed above the list.
    - A skeleton loader (using Chakra UI's `<Skeleton>`) will be shown during initial load.
    - Virtual scrolling (e.g., `tanstack-virtual`) should be considered for performance with large datasets.

### Story 3.3: Edit and Delete Transactions

- **Components:** `TransactionCard.tsx`, `TransactionEntryModal.tsx`
- **Edit Logic:**
    1. The "Edit" button on a `TransactionCard` will open the `TransactionEntryModal`, pre-filled with the transaction's data.
    2. The modal will be in an "edit mode", and on submit, it will call an `updateTransaction` function from the SWR hook, which in turn calls `PUT /api/transactions/[id]`.
    3. Optimistic UI updates will be used to show the change immediately.
- **Delete Logic:**
    1. The "Delete" button will trigger a confirmation dialog (Chakra UI's `<AlertDialog>`).
    2. On confirmation, a `deleteTransaction` function from the SWR hook will be called, which optimistically removes the item from the local cache and then calls `DELETE /api/transactions/[id]`.
    3. A toast notification with an "Undo" option will be implemented to recover from accidental deletions.

### Story 3.4: Transaction Data Persistence and Sync

- **Technology:** **Supabase Realtime**
- **Implementation:**
    1. The `useTransactions` hook will subscribe to changes on the `transactions` table using `supabase.channel(...).on('postgres_changes', ...)`
    2. When a change event (INSERT, UPDATE, DELETE) is received from another client, the hook will trigger a revalidation of the SWR cache (`mutate()`).
    3. This will ensure that the UI across all of the user's devices updates automatically within seconds, fulfilling the real-time sync requirement.

## 6. Security Considerations

- **RLS Policies:** All API routes must rely on the pre-defined RLS policies for the `transactions` table. No queries should ever manually filter by `user_id` in the `WHERE` clause; this should be left to the database to enforce.
- **Ownership Checks:** While RLS provides the database-level protection, the API logic for `PUT` and `DELETE` should still verify that the data returned from the database operation belongs to the user, as a defense-in-depth measure.
- **Data Validation:** All input from the client must be rigorously validated on the server-side (or via the Zod schema in the API route) to prevent invalid data from being inserted into the database.

## 7. Testing Strategy

- **Unit/Integration Tests:**
    - Test the validation schema for the transaction form.
    - Test the API endpoints by mocking the Supabase client to ensure they correctly handle valid requests, invalid input, and unauthorized access.
    - Test the SWR hook's logic for optimistic updates and rollbacks.
- **E2E Tests:**
    - A full CRUD flow: Create a transaction, verify it appears in the list, edit it, verify the change, and finally delete it.
    - Test filtering and searching on the transaction list.
    - Open two browser windows to test the real-time synchronization via Supabase Realtime.
