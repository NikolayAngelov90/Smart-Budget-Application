# Story 4.1: Seed Default Categories on User Signup

Status: ready-for-dev

## Story

As a new user,
I want 11 predefined categories automatically created when I sign up,
so that I can immediately start categorizing transactions without manual setup.

## Acceptance Criteria

**AC1: Default Categories Seeding (from Tech Spec AC1 - PRD FR11, FR12)**
- Given a new user completes signup
- When the user account is created
- Then 11 predefined categories are automatically seeded (7 expense, 4 income)
- And predefined categories have `is_predefined = true`
- And categories are available immediately on first transaction entry
- And each category has name, color (hex), and type assigned
- And seeding is idempotent (doesn't duplicate if run multiple times)

**AC2: Category Seeding Implementation**
- Given the category seeding service
- When invoked with a user_id
- Then it checks if categories already exist for that user
- And only seeds categories if none exist (prevent duplicates)
- And all 11 categories are inserted in a single transaction
- And seeding completes within 500ms

**AC3: Integration with Signup Flow**
- Given a user completes the signup process
- When the signup callback executes
- Then the category seeding service is called automatically
- And seeding occurs before user sees the dashboard
- And errors during seeding don't block signup completion (logged, retry later)

## Tasks / Subtasks

### Data Model & Seed Data
- [ ] Task 1: Define DEFAULT_CATEGORIES constant (AC: #1, #2)
  - [ ] 1.1: Create `lib/utils/constants.ts` if doesn't exist
  - [ ] 1.2: Define DEFAULT_CATEGORIES array with 11 categories:
    - 7 expense: Dining (#f56565), Transport (#4299e1), Entertainment (#9f7aea), Utilities (#48bb78), Shopping (#ed8936), Healthcare (#38b2ac), Rent (#e53e3e)
    - 4 income: Salary (#38a169), Freelance (#4299e1), Investment (#9f7aea), Gift (#f56565)
  - [ ] 1.3: Each category has: name (string), color (hex string), type ('income' | 'expense')
  - [ ] 1.4: Export DEFAULT_CATEGORIES for use in seeding service

### Seeding Service Implementation
- [ ] Task 2: Create SeedCategoriesService (AC: #1, #2)
  - [ ] 2.1: Create `lib/services/seedCategoriesService.ts`
  - [ ] 2.2: Implement `seedDefaultCategories(userId: string)` function
  - [ ] 2.3: Check if user already has categories (SELECT COUNT(*) WHERE user_id = ?)
  - [ ] 2.4: If count > 0, return early (idempotent behavior)
  - [ ] 2.5: If count = 0, bulk insert DEFAULT_CATEGORIES with:
    - user_id: provided userId
    - is_predefined: true
    - created_at: NOW()
  - [ ] 2.6: Use Supabase client transaction or single bulk INSERT for atomicity
  - [ ] 2.7: Return seeded categories array on success
  - [ ] 2.8: Handle errors gracefully (log and throw for retry)

- [ ] Task 3: Add TypeScript types for seeding (AC: #2)
  - [ ] 3.1: Create or update `types/category.types.ts`
  - [ ] 3.2: Define `SeedCategoryInput` type: `{ name: string; color: string; type: TransactionType }`
  - [ ] 3.3: Define `SeedResult` type: `{ success: boolean; count: number; categories?: Category[] }`
  - [ ] 3.4: Ensure types are exported and used in service

### Integration with Signup Flow
- [ ] Task 4: Create onboarding API endpoint (AC: #3)
  - [ ] 4.1: Create `src/app/api/auth/onboarding/route.ts`
  - [ ] 4.2: Implement POST handler for onboarding
  - [ ] 4.3: Extract user_id from Supabase Auth session
  - [ ] 4.4: Call `seedDefaultCategories(user_id)`
  - [ ] 4.5: Return 200 with seeded categories on success
  - [ ] 4.6: Return 400 if user_id missing (unauthorized)
  - [ ] 4.7: Return 500 on seeding failure (log error for investigation)

- [ ] Task 5: Integrate onboarding into signup workflow (AC: #3)
  - [ ] 5.1: Locate existing signup completion handler (likely in `src/app/(auth)/signup/page.tsx` or callback)
  - [ ] 5.2: After successful user creation, call POST `/api/auth/onboarding`
  - [ ] 5.3: Handle onboarding success: proceed to dashboard
  - [ ] 5.4: Handle onboarding failure: log error, allow user to proceed (show toast: "Finalizing setup...")
  - [ ] 5.5: Add retry mechanism: if seeding fails, retry once after 2 seconds
  - [ ] 5.6: If retry fails, log and allow user to proceed (categories will be empty, but can add custom)

### Error Handling & Edge Cases
- [ ] Task 6: Implement comprehensive error handling (AC: #2, #3)
  - [ ] 6.1: Handle Supabase connection errors (retry logic)
  - [ ] 6.2: Handle duplicate category errors (ignore if idempotent check missed due to race)
  - [ ] 6.3: Handle partial insert failures (use transaction to rollback)
  - [ ] 6.4: Log all errors with context (user_id, error message, stack trace)
  - [ ] 6.5: Add error boundary around onboarding call to prevent signup failure
  - [ ] 6.6: Display user-friendly error messages (avoid technical jargon)

### Testing & Validation
- [ ] Task 7: Test default category seeding (AC: #1, #2, #3)
  - [ ] 7.1: Test new user signup → verify 11 categories exist
  - [ ] 7.2: Test idempotency: call seeding twice → verify only 11 categories (no duplicates)
  - [ ] 7.3: Test all categories have correct properties (name, color, type, is_predefined=true)
  - [ ] 7.4: Test seeding performance: complete within 500ms
  - [ ] 7.5: Test error case: invalid user_id → service handles gracefully
  - [ ] 7.6: Test error case: database connection failure → service handles gracefully
  - [ ] 7.7: Test RLS policies: user can SELECT seeded categories
  - [ ] 7.8: Test categories appear in transaction entry modal immediately after signup
  - [ ] 7.9: Run TypeScript type-check (npx tsc --noEmit)
  - [ ] 7.10: Run ESLint (npx next lint)

## Dev Notes

### Architecture Alignment

**Database Schema** (already exists from Epic 1):
- `categories` table with columns: id, user_id, name, color, type, is_predefined, created_at
- RLS policies active: SELECT, INSERT, UPDATE (is_predefined=false), DELETE (is_predefined=false)
- Indexes in place: `idx_categories_user_id`, `idx_categories_type`
- UNIQUE constraint: (user_id, name, type)

**Technology Stack**:
- Supabase client for database operations
- Server-side API routes (Next.js App Router)
- Supabase Auth for user_id extraction
- TypeScript with strict mode

**Performance Targets**:
- Bulk seed operation: < 500ms (Tech Spec)
- Single atomic transaction for all 11 categories

**Security**:
- RLS policies enforce data isolation
- Only authenticated users can trigger onboarding
- Seeded categories have is_predefined=true (protected from user edits/deletes)

### Learnings from Previous Story (3-4)

**From Story 3-4 (Transaction Data Persistence and Sync):**

- **Supabase Client Pattern**: Established pattern for server-side operations using `@supabase/ssr`
- **RLS Verification**: All CRUD policies confirmed working with `auth.uid() = user_id`
- **Error Handling**: Network error handling pattern with retry logic established
- **Database Constraints**: Foreign key `ON DELETE RESTRICT` prevents orphaned records - categories will reference this
- **Index Strategy**: Composite indexes improve query performance (user_id + additional field)
- **Testing Checklist**: TypeScript type-check and ESLint validation required before completion

**Key Patterns to Reuse**:
- Server-side Supabase client initialization
- RLS policy reliance for security (no additional auth checks needed)
- Atomic operations using database transactions
- Graceful error handling with logging
- Performance monitoring for database operations

**Modified Files from Epic 3**:
- `src/app/transactions/page.tsx` - Uses SWR for caching (pattern to apply for categories)

**Technical Debt to Consider**:
- Phase 2: Offline changes feature noted but not blocking for this story

### Project Structure Notes

**New Files to Create**:
- `lib/utils/constants.ts` - DEFAULT_CATEGORIES definition
- `lib/services/seedCategoriesService.ts` - Seeding logic
- `src/app/api/auth/onboarding/route.ts` - Onboarding endpoint

**Existing Files to Modify**:
- `types/category.types.ts` - Add SeedCategoryInput and SeedResult types (may already exist)
- Signup completion handler - Add onboarding call (location TBD in Epic 2 files)

**Dependencies**:
- Epic 1: Database schema and RLS policies (✓ completed)
- Epic 2: User signup flow (✓ completed)
- Epic 3: Transaction management exists (categories will be referenced)

### Implementation Strategy

**Recommended Approach**:
1. **Start with constants**: Define DEFAULT_CATEGORIES as the source of truth
2. **Build service layer**: Implement idempotent seeding logic with comprehensive error handling
3. **Create API endpoint**: Expose onboarding endpoint for client consumption
4. **Integrate with signup**: Hook into existing signup flow (locate Epic 2 completion handler)
5. **Test thoroughly**: Verify idempotency, performance, RLS, and error cases

**Critical Decision Points**:
- **Seeding Trigger**: POST /api/auth/onboarding called from client after signup (not database trigger) - allows error handling and retry
- **Failure Handling**: Non-blocking - if seeding fails, user can proceed (add custom categories manually)
- **Idempotency Check**: Query count before insert to prevent duplicates on retry

### References

**Source Documents**:
- [Technical Specification: Epic 4](docs/sprint-artifacts/tech-spec-epic-4.md#acceptance-criteria) - AC1, Workflow 1
- [PRD](docs/PRD.md) - FR11 (expense categories), FR12 (income categories)
- [Architecture](docs/architecture.md) - Database schema lines 366-375, seed data lines 484-499

**Tech Spec Details**:
- Default categories list: [tech-spec-epic-4.md lines 151-167](docs/sprint-artifacts/tech-spec-epic-4.md#L151-L167)
- Workflow 1 (User Signup → Category Seeding): [tech-spec-epic-4.md lines 255-262](docs/sprint-artifacts/tech-spec-epic-4.md#L255-L262)
- Performance target: < 500ms [tech-spec-epic-4.md line 366](docs/sprint-artifacts/tech-spec-epic-4.md#L366)
- Security: RLS policies [tech-spec-epic-4.md lines 370-373](docs/sprint-artifacts/tech-spec-epic-4.md#L370-L373)

**Integration Points**:
- Transaction entry modal will fetch categories after seeding
- CategorySelector component will display seeded categories
- Epic 2 signup flow provides the integration point

---

## Dev Agent Record

### Context Reference

- [Story Context XML](4-1-seed-default-categories-on-user-signup.context.xml)

### Agent Model Used

Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

<!-- Will be populated during implementation -->

### Completion Notes List

<!-- Will be populated during implementation -->

### File List

<!-- Will be populated during implementation -->

---

## Change Log
- **2025-11-22**: Story drafted from Epic 4 tech spec AC1, PRD FR11-FR12, learnings from Story 3-4
