# Epic Technical Specification: Category Management

Date: 2025-11-22
Author: Niki
Epic ID: 4
Status: Draft

---

## Overview

Epic 4 delivers the Category Management system, enabling users to organize transactions through both predefined and custom categories. Categories are fundamental to the application's value proposition - they enable intelligent spending analysis, visual dashboards, and AI-powered insights. This epic establishes the foundation for categorization by implementing default categories seeded on signup, full CRUD operations for custom categories, visual color-coding for quick identification, and smart recently-used category tracking for rapid transaction entry (supporting the <30 second entry goal from PRD).

The system builds upon the existing database schema (categories table with RLS policies already defined in Epic 1) and integrates with transaction management (Epic 3) to provide seamless category selection and management workflows.

## Objectives and Scope

**In Scope:**
- Seed 11 predefined categories (7 expense, 4 income) automatically on user signup via database trigger or onboarding API
- Create custom categories with user-defined names and hex color codes
- Edit custom category names and colors (predefined categories are immutable)
- Delete custom categories with validation (prevent deletion if transactions exist, or cascade/reassign based on UX decision)
- Display categories with visual color-coding throughout the application (badges, selectors, charts)
- Track and surface recently-used categories in transaction entry for quick selection (optimization for <30 second entry requirement)
- Category filtering by type (income vs. expense) in API and UI components
- RLS enforcement: users can only access and modify their own categories

**Out of Scope (Future Epics/Phase 2):**
- Category budgets and spending limits (Epic 6: AI Insights)
- Category-based notifications or alerts
- Category archiving (soft delete) - hard delete only for MVP
- Category icons or custom imagery
- Subcategories or hierarchical category structures
- Category import/export functionality
- Multi-language category names

## System Architecture Alignment

**Database Schema:**
- Utilizes existing `categories` table from Epic 1 schema (columns: id, user_id, name, color, type, is_predefined, created_at)
- Leverages RLS policies already defined: SELECT, INSERT, UPDATE (non-predefined only), DELETE (non-predefined only)
- Indexes in place: `idx_categories_user_id`, `idx_categories_type`

**Frontend Components:**
- **CategorySelector** (Custom Component #3 from Architecture): Quick picker with recently-used first
- **CategoryBadge**: Visual display component showing name + color dot
- **CategoryManager**: Full CRUD interface for categories page

**API Routes:**
- GET `/api/categories` - List categories with optional type filter
- POST `/api/categories` - Create custom category
- PUT `/api/categories/:id` - Update custom category
- DELETE `/api/categories/:id` - Delete custom category (with transaction validation)

**Technology Stack:**
- React Hook Form + Zod for category creation/edit forms
- Chakra UI ColorPicker for color selection
- SWR for client-side caching of categories list
- Supabase Realtime (optional) for multi-device category sync

**Dependencies:**
- **Epic 1 (Infrastructure)**: Database schema, RLS policies, Supabase client
- **Epic 3 (Transactions)**: Foreign key relationship `transactions.category_id → categories.id`

**Integration Points:**
- Transaction entry modal must fetch and display categories
- Dashboard charts must use category colors for visual consistency
- Category deletion must check for existing transactions (referential integrity)

## Detailed Design

### Services and Modules

| Module/Service | Responsibility | Inputs | Outputs | Owner |
|----------------|----------------|--------|---------|-------|
| **CategoryService** (`lib/services/categoryService.ts`) | Business logic for category CRUD, validation, recently-used tracking | Category data, user context | Category objects, validation results | Backend |
| **SeedCategoriesService** (`lib/services/seedCategoriesService.ts`) | Seeds default categories on user signup | user_id | Seeded categories array | Backend |
| **CategoryManager Component** (`components/categories/CategoryManager.tsx`) | Full category management UI | User actions | Category mutations | Frontend |
| **CategorySelector Component** (`components/categories/CategorySelector.tsx`) | Quick category picker with recently-used | Transaction type filter | Selected category_id | Frontend |
| **CategoryBadge Component** (`components/categories/CategoryBadge.tsx`) | Visual category display | Category object | Rendered badge | Frontend |
| **Categories API Routes** (`app/api/categories/`) | RESTful endpoints for category operations | HTTP requests | JSON responses | API Layer |

**Recently-Used Tracking Strategy:**
- Implement client-side tracking using localStorage: `recently_used_categories_${user_id}`
- Store array of category IDs with timestamps
- Fetch on mount, sort by most recent, display first in CategorySelector
- Alternative: Server-side tracking via analytics table (Phase 2)

### Data Models and Contracts

**Database Schema (Existing from Epic 1):**
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL, -- Hex color e.g., #f56565
  type transaction_type NOT NULL, -- ENUM ('income', 'expense')
  is_predefined BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name, type) -- Prevent duplicate category names per type
);
```

**TypeScript Interfaces:**
```typescript
// types/category.types.ts
export type TransactionType = 'income' | 'expense';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string; // Hex format: #RRGGBB
  type: TransactionType;
  is_predefined: boolean;
  created_at: string;
}

export interface CreateCategoryInput {
  name: string;
  color: string;
  type: TransactionType;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
}

export interface CategoryWithUsageCount extends Category {
  transaction_count?: number; // For validation before deletion
}
```

**Validation Rules (Zod Schema):**
```typescript
const createCategorySchema = z.object({
  name: z.string()
    .min(1, 'Category name is required')
    .max(100, 'Category name too long')
    .trim(),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  type: z.enum(['income', 'expense'])
});
```

**Default Categories (Seed Data):**
```typescript
const DEFAULT_CATEGORIES = [
  // Expense categories (7)
  { name: 'Dining', color: '#f56565', type: 'expense' },
  { name: 'Transport', color: '#4299e1', type: 'expense' },
  { name: 'Entertainment', color: '#9f7aea', type: 'expense' },
  { name: 'Utilities', color: '#48bb78', type: 'expense' },
  { name: 'Shopping', color: '#ed8936', type: 'expense' },
  { name: 'Healthcare', color: '#38b2ac', type: 'expense' },
  { name: 'Rent', color: '#e53e3e', type: 'expense' },

  // Income categories (4)
  { name: 'Salary', color: '#38a169', type: 'income' },
  { name: 'Freelance', color: '#4299e1', type: 'income' },
  { name: 'Investment', color: '#9f7aea', type: 'income' },
  { name: 'Gift', color: '#f56565', type: 'income' }
];
```

### APIs and Interfaces

**GET /api/categories**
```typescript
Query Parameters:
  ?type=income|expense (optional filter)

Response 200:
{
  data: Category[];
  count: number;
}

Response 401: { error: 'Unauthorized' }
Response 500: { error: 'Internal server error' }
```

**POST /api/categories**
```typescript
Request Body:
{
  name: string; // 1-100 chars
  color: string; // Hex format #RRGGBB
  type: 'income' | 'expense';
}

Response 201:
{
  data: Category;
}

Response 400: { error: 'Validation error', details: {...} }
Response 401: { error: 'Unauthorized' }
Response 409: { error: 'Category name already exists for this type' }
Response 500: { error: 'Internal server error' }
```

**PUT /api/categories/:id**
```typescript
Request Body (partial update):
{
  name?: string;
  color?: string;
}

Response 200:
{
  data: Category;
}

Response 400: { error: 'Validation error' }
Response 401: { error: 'Unauthorized' }
Response 403: { error: 'Cannot modify predefined categories' }
Response 404: { error: 'Category not found' }
Response 409: { error: 'Category name already exists' }
Response 500: { error: 'Internal server error' }
```

**DELETE /api/categories/:id**
```typescript
Response 200:
{
  success: true;
  message: 'Category deleted successfully';
}

Response 400: { error: 'Category has existing transactions. Reassign or delete transactions first.' }
Response 401: { error: 'Unauthorized' }
Response 403: { error: 'Cannot delete predefined categories' }
Response 404: { error: 'Category not found' }
Response 500: { error: 'Internal server error' }
```

**POST /api/auth/callback (Extended for Category Seeding)**
```typescript
// After successful user signup, seed default categories
// Triggered in signup flow or first-time onboarding

Implementation:
1. Check if user already has categories
2. If no categories exist, insert DEFAULT_CATEGORIES with user_id
3. Set is_predefined = true for seeded categories
```

### Workflows and Sequencing

**Workflow 1: User Signup → Category Seeding**
```
1. User completes signup (Epic 2)
2. Supabase creates auth.users record
3. Onboarding API checks for existing categories
4. If none exist: Bulk insert DEFAULT_CATEGORIES with user_id
5. User navigates to transactions → categories available
```

**Workflow 2: Create Custom Category**
```
User → CategoryManager UI
  ├─ Click "Add Category" button
  ├─ Fill form (name, color picker, type radio)
  └─ Submit

Frontend → Validation
  ├─ React Hook Form + Zod validation
  ├─ Check: name not empty, color valid hex, type selected
  └─ If valid: POST /api/categories

API → Business Logic
  ├─ Authenticate user (Supabase Auth)
  ├─ Validate input schema
  ├─ Check UNIQUE constraint (user_id, name, type)
  ├─ INSERT INTO categories (user_id, name, color, type, is_predefined=false)
  └─ Return created category

Frontend → Update UI
  ├─ SWR mutate to add new category to cache
  ├─ Display success toast
  └─ Close modal
```

**Workflow 3: Edit Custom Category**
```
User → CategoryManager → Edit button
  ├─ Modal pre-filled with current values
  └─ Modify name or color

Frontend → Validation
  └─ Submit: PUT /api/categories/:id

API → Business Logic
  ├─ Authenticate user
  ├─ Verify category exists and user owns it
  ├─ Check is_predefined = false (403 if true)
  ├─ UPDATE categories SET name=?, color=? WHERE id=? AND user_id=?
  └─ Return updated category

Frontend → Update UI
  └─ SWR mutate, success toast
```

**Workflow 4: Delete Custom Category**
```
User → CategoryManager → Delete button
  └─ Confirmation dialog: "Delete category? Transactions using this category will need reassignment."

API → DELETE /api/categories/:id
  ├─ Authenticate user
  ├─ Verify category exists and user owns it
  ├─ Check is_predefined = false (403 if true)
  ├─ Check for existing transactions:
  │   SELECT COUNT(*) FROM transactions WHERE category_id = ?
  │   If count > 0: Return 400 error
  └─ DELETE FROM categories WHERE id=? AND user_id=?

Frontend → Handle Response
  ├─ If 400: Show error + guide user to reassign transactions first
  ├─ If 200: SWR mutate, success toast
  └─ Alternative: Implement reassignment flow in same dialog (future)
```

**Workflow 5: Recently-Used Category Tracking**
```
Transaction Entry → CategorySelector
  ├─ On mount: Load recently_used_categories from localStorage
  ├─ Fetch all categories via useSWR('/api/categories')
  ├─ Merge & sort: recently-used first, then alphabetical
  └─ Render dropdown

User → Select Category
  ├─ Save selection to localStorage with timestamp
  │   {category_id: '...', timestamp: Date.now()}
  └─ Keep max 5 most recent

Next Transaction Entry
  └─ Recently-used categories appear at top of list
```

## Non-Functional Requirements

### Performance

**Targets (from Architecture):**
- Category list fetch: < 100ms (cached by SWR after first load)
- Category creation: < 200ms perceived time (optimistic UI update)
- Category update/delete: < 300ms
- CategorySelector render: < 50ms (max 50 categories expected)
- Color picker interaction: < 16ms (60fps for smooth UX)

**Optimization Strategies:**
- SWR caching with `dedupingInterval: 10000` (10 seconds) to minimize redundant API calls
- Prefetch categories on dashboard load to avoid delay in transaction entry
- Index usage: `idx_categories_user_id` and `idx_categories_type` for fast queries
- Lightweight CategoryBadge component (< 2KB)

**Performance Validation:**
- Test with 50 custom categories + 11 predefined (61 total)
- CategorySelector dropdown should render < 100ms
- Bulk seed operation (11 categories) should complete < 500ms

### Security

**Authentication & Authorization:**
- All API routes require authenticated user via Supabase Auth middleware
- RLS policies enforce data isolation: `auth.uid() = user_id` on all operations
- Predefined categories protected: `is_predefined = false` check on UPDATE/DELETE

**Input Validation:**
- Server-side Zod schema validation on all POST/PUT requests
- Hex color validation prevents injection: `/^#[0-9A-Fa-f]{6}$/`
- Name sanitization: trim whitespace, max 100 characters
- UNIQUE constraint on (user_id, name, type) prevents duplicates

**OWASP Top 10 Mitigations:**
- **A01 Broken Access Control**: RLS policies + user ownership verification
- **A03 Injection**: Parameterized queries via Supabase client (no raw SQL)
- **A04 Insecure Design**: Validation at API layer prevents bad data
- **A07 ID & Auth Failures**: Supabase Auth JWT validation on every request

**Data Privacy:**
- Categories are user-scoped (never visible to other users)
- No PII stored in categories table
- Category names user-controlled (no external data sources)

### Reliability/Availability

**Error Handling:**
- API returns structured error responses with actionable messages
- Frontend gracefully handles API failures with user-friendly toasts
- SWR automatic retry (3 attempts) for transient network failures
- Fallback: If category fetch fails, transaction entry modal shows empty state with retry button

**Data Integrity:**
- UNIQUE constraint prevents duplicate category names per type
- Foreign key `ON DELETE RESTRICT` prevents orphaning transactions
- Transaction validation on category deletion (400 error if in use)
- Atomic operations: category CRUD wrapped in database transactions

**Degradation Strategy:**
- If categories API fails, transaction entry can proceed with manual category ID input (admin/debug mode)
- Recently-used localStorage is non-critical (graceful failure if unavailable)
- Color picker fallback to text input if UI library fails

### Observability

**Logging:**
- API request logging: `[POST /api/categories] user_id, category_name, response_time`
- Error logging: Include stack trace, user_id, request payload (sanitized)
- Validation failures logged with specific field errors

**Metrics:**
- Track category creation rate (categories/user/month)
- Monitor custom vs. predefined category usage ratio
- Track recently-used feature adoption (% users with localStorage data)
- Monitor API response times: p50, p95, p99

**Alerts:**
- Category API error rate > 5% → alert
- Category creation latency p99 > 1s → investigate
- Unique constraint violations spike → possible UX issue

**Tracing:**
- Supabase Dashboard for database query performance
- Vercel Analytics for API route response times
- Frontend error boundary catches React errors in CategoryManager

## Dependencies and Integrations

**Internal Dependencies:**
| Dependency | Version | Usage | Critical Path |
|------------|---------|-------|---------------|
| `@supabase/supabase-js` | 2.81.1 | Database client for category CRUD | Yes |
| `@supabase/ssr` | 0.7.0 | Server-side auth middleware | Yes |
| `react-hook-form` | 7.66.0 | Category form management | Yes |
| `zod` | 4.1.12 | Schema validation | Yes |
| `@chakra-ui/react` | 2.8.0 | UI components (forms, modals, badges) | Yes |
| `swr` | 2.3.6 | Client-side caching | Yes |
| `date-fns` | 4.1.0 | Date formatting (created_at) | No |

**External Integrations:**
- **Supabase PostgreSQL**: Category data persistence, RLS enforcement
- **Supabase Auth**: User authentication for API access
- **Vercel Deployment**: Hosting and serverless functions

**Epic Dependencies:**
- **Epic 1 (Infrastructure)**: Database schema, RLS policies, Supabase client setup
- **Epic 2 (User Authentication)**: User signup flow for category seeding
- **Epic 3 (Transactions)**: Foreign key relationship, category selection in transaction entry

**Integration Points:**
- **Transaction Entry Modal**: Must fetch categories and pass selected category_id
- **Dashboard Charts**: Must use category colors for visual consistency
- **AI Insights (Epic 6)**: Will analyze spending by category

**Dependency Management:**
- All dependencies listed in `package.json` with pinned versions
- No new dependencies required (existing stack covers all needs)
- Color picker: Use Chakra UI's built-in `Input type="color"` (no external library needed)

## Acceptance Criteria (Authoritative)

**Source:** PRD FR11-FR17 (Category Management)

**AC1: Default Categories Seeding (FR11, FR12)**
- Given a new user completes signup
- When the user account is created
- Then 11 predefined categories are automatically seeded (7 expense, 4 income)
- And predefined categories have `is_predefined = true`
- And categories are available immediately on first transaction entry

**AC2: Create Custom Category (FR13)**
- Given an authenticated user on the categories management page
- When the user creates a custom category with name, color, and type
- Then the category is saved to the database with `is_predefined = false`
- And the category appears in all category selectors
- And duplicate names for the same type are prevented (unique constraint error shown)
- And hex color validation ensures valid format (#RRGGBB)

**AC3: Edit Custom Category (FR14)**
- Given an authenticated user with existing custom categories
- When the user edits a custom category's name or color
- Then the changes are persisted to the database
- And all transactions using this category reflect the new name/color
- And the user cannot edit predefined categories (edit button disabled or 403 error)

**AC4: Delete Custom Category (FR15)**
- Given an authenticated user with custom categories
- When the user attempts to delete a custom category with existing transactions
- Then the system prevents deletion and shows error: "Category has existing transactions"
- And when the user deletes a custom category with no transactions
- Then the category is permanently removed from the database
- And the user cannot delete predefined categories (delete button disabled or 403 error)

**AC5: Visual Color-Coding (FR16)**
- Given categories are displayed throughout the application
- When categories appear in transaction list, forms, charts, or badges
- Then each category displays with its assigned hex color as a visual indicator
- And color is consistent across all views (transactions, dashboard, categories page)
- And color contrast ensures readability (WCAG AA minimum)

**AC6: Recently-Used Categories (FR17)**
- Given a user frequently enters transactions
- When the user opens the category selector in transaction entry
- Then the 5 most recently used categories appear at the top of the list
- And recently-used categories are sorted by most recent first
- And the feature persists across sessions (localStorage)
- And filtering by type (income/expense) still works with recently-used

**AC7: RLS Security**
- Given multiple users exist in the system
- When a user queries categories
- Then the user can only see and modify their own categories
- And API attempts to access other users' categories return 404 or 403
- And RLS policies are enforced at the database level

**AC8: Performance**
- Given a user has up to 50 custom categories (+ 11 predefined = 61 total)
- When the user loads the category selector
- Then categories render in < 100ms
- And category creation completes in < 200ms (perceived via optimistic update)

## Traceability Mapping

| AC# | PRD Requirement | Spec Section | Component/API | Test Type |
|-----|-----------------|--------------|---------------|-----------|
| AC1 | FR11, FR12 | Workflows §Workflow 1, Data Models §Default Categories | `SeedCategoriesService`, POST `/api/auth/callback` | Integration (signup flow) |
| AC2 | FR13 | APIs §POST /api/categories, Data Models §Validation Rules | `CategoryManager`, POST `/api/categories` | Unit + Integration |
| AC3 | FR14 | APIs §PUT /api/categories/:id, Workflows §Workflow 3 | `CategoryManager`, PUT `/api/categories/:id` | Integration |
| AC4 | FR15 | APIs §DELETE /api/categories/:id, Workflows §Workflow 4 | `CategoryManager`, DELETE `/api/categories/:id` | Integration |
| AC5 | FR16 | Services §CategoryBadge, Integration Points | `CategoryBadge`, `TransactionCard`, Dashboard charts | Visual regression |
| AC6 | FR17 | Workflows §Workflow 5, Services §Recently-Used Tracking | `CategorySelector`, localStorage logic | E2E + Unit |
| AC7 | Architecture RLS | Security §Authentication & Authorization, Database Schema §RLS | All category APIs, Supabase RLS policies | Security test |
| AC8 | Architecture Performance | NFR §Performance | All frontend components, API routes | Performance test |

**Requirements Coverage:**
- ✅ FR11: Predefined expense categories → AC1
- ✅ FR12: Predefined income categories → AC1
- ✅ FR13: Create custom categories → AC2
- ✅ FR14: Edit categories → AC3
- ✅ FR15: Delete categories → AC4
- ✅ FR16: Color-coding → AC5
- ✅ FR17: Recently-used → AC6

## Risks, Assumptions, Open Questions

**Risks:**

| Risk | Severity | Mitigation | Owner |
|------|----------|------------|-------|
| **R1:** Category deletion blocked by existing transactions frustrates users | Medium | Implement soft delete or reassignment flow in Story 4-3. Show helpful error message guiding user to reassign. | UX Designer |
| **R2:** Users create too many categories, making selectors cluttered | Low | Limit to 50 custom categories per type. Implement search/filter in selector if needed (Phase 2). | Product |
| **R3:** Recently-used localStorage fails or cleared, impacting UX | Low | Graceful degradation: show alphabetical if localStorage unavailable. Consider server-side tracking (Phase 2). | Dev Team |
| **R4:** Color picker UX confusing for non-technical users | Medium | Provide color palette presets alongside custom picker. User testing before launch. | UX Designer |
| **R5:** Predefined category colors clash with custom branding | Low | Allow users to customize predefined category colors (but not delete). Future enhancement. | Product |

**Assumptions:**

| Assumption | Validation | Impact if Wrong |
|------------|------------|----------------|
| **A1:** Users will create < 50 custom categories | Usage analytics after launch | May need pagination or virtualized selector |
| **A2:** localStorage is available and reliable | Browser compatibility testing | Fallback to in-memory (session-only) |
| **A3:** Hex color format is sufficient (no RGB/HSL needed) | User feedback | May need to add color format converters |
| **A4:** Category seeding on signup completes successfully | Integration tests | Need idempotent seeding logic (check exists first) |
| **A5:** Foreign key ON DELETE RESTRICT is acceptable UX | User testing | May need to implement cascade or reassignment |

**Open Questions:**

| Question | Decision Needed By | Impact | Recommendation |
|----------|-------------------|--------|----------------|
| **Q1:** Should predefined categories be editable (name/color)? | Story 4-2 | High - affects RLS policies and UX | **No** for MVP (keep simple), allow in Phase 2 |
| **Q2:** Category deletion: hard delete or soft delete (archive)? | Story 4-3 | Medium - affects data retention | **Hard delete** for MVP (simpler), soft delete Phase 2 |
| **Q3:** How to handle category deletion with transactions? | Story 4-3 | High - affects UX flow | **Block deletion** + show error for MVP, reassignment flow Phase 2 |
| **Q4:** Recently-used: localStorage or database tracking? | Story 4-5 | Low - affects multi-device sync | **localStorage** for MVP (faster), database Phase 2 for sync |
| **Q5:** Should color picker include preset palette or just custom? | Story 4-2 | Low - affects UX complexity | **Both**: Preset + custom picker for best UX |

## Test Strategy Summary

**Unit Tests:**
- `CategoryService`: CRUD operations, validation logic, error handling
- `SeedCategoriesService`: Default category seeding, idempotency
- Zod validation schemas: Invalid inputs, edge cases
- Recently-used localStorage logic: Save, retrieve, sort

**Integration Tests:**
- API routes (GET/POST/PUT/DELETE `/api/categories`): Auth, validation, RLS enforcement
- Category seeding on signup: End-to-end user registration flow
- Transaction creation with category reference: Foreign key integrity
- Category deletion with existing transactions: Error handling

**Component Tests:**
- `CategoryManager`: Create, edit, delete workflows with mocked API
- `CategorySelector`: Recently-used sorting, type filtering, rendering
- `CategoryBadge`: Color display, accessibility (WCAG contrast)

**End-to-End Tests:**
- **E2E1:** New user signup → default categories seeded → visible in transaction entry
- **E2E2:** Create custom category → appears in transaction entry selector
- **E2E3:** Edit category color → all transactions reflect new color
- **E2E4:** Delete unused category → succeeds; delete used category → blocked
- **E2E5:** Recently-used categories appear at top after 5 transaction entries

**Security Tests:**
- RLS policy validation: User A cannot access User B's categories
- Predefined category protection: Cannot edit/delete via API
- Input validation: SQL injection, XSS attempts via category names
- Authorization: Unauthenticated requests rejected (401)

**Performance Tests:**
- Load 61 categories (50 custom + 11 predefined) → selector renders < 100ms
- Category creation latency: p99 < 500ms
- Bulk seed operation: 11 categories < 500ms

**Accessibility Tests:**
- Color contrast: Category badge text vs. background ≥ 4.5:1 (WCAG AA)
- Keyboard navigation: Category selector, form inputs
- Screen reader: Announce category names and colors

**Test Coverage Target:**
- Unit: 80%+ coverage for services and validation
- Integration: All API routes covered
- E2E: All user stories (5 critical paths)

**Test Environment:**
- Unit/Component: Jest + React Testing Library
- Integration: Supabase local instance or test project
- E2E: Playwright or Cypress
- CI/CD: Run all tests on PR, block merge if failing
