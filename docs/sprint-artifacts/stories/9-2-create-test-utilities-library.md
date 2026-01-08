# Story 9.2: Create Test Utilities Library

Status: drafted

## Story

As a developer,
I want a centralized test utilities library with pre-configured provider mocks,
So that I can write integration tests without manually setting up 6 layers of mocking (Chakra, SWR, Supabase, Auth, Router, Toast).

## Acceptance Criteria

**AC-9.2.1:** Core Test Utility
✅ Create `src/lib/test-utils/testUtils.tsx` with `renderWithProviders()` function

**AC-9.2.2:** Complete Provider Mocking
✅ Mock all 6 provider layers: Chakra UI, SWR, Supabase Client, Supabase Auth, Next.js Router, react-hot-toast

**AC-9.2.3:** Reusable Mock Exports
✅ Export `mockSupabase`, `mockAuth`, `mockSWR`, `mockRouter`, `mockToast` helper utilities

**AC-9.2.4:** TypeScript Type Safety
✅ Full TypeScript types for all mock helpers and `renderWithProviders` options

**AC-9.2.5:** Documentation
✅ Create `docs/testing/test-utilities-guide.md` with usage examples and migration guide

**AC-9.2.6:** Proof of Concept
✅ Refactor 3 existing test files to use new utilities (Settings page, Transactions page, Insights page)

**AC-9.2.7:** Customizable Mocks
✅ Allow developers to override specific mocks via `renderWithProviders` options parameter

**AC-9.2.8:** Re-Export Testing Library
✅ Re-export all `@testing-library/react` functions for single import point

## Tasks / Subtasks

- [ ] Create test utilities directory structure (AC: 9.2.1)
  - [ ] Create `src/lib/test-utils/` directory
  - [ ] Create `testUtils.tsx` for main `renderWithProviders()` function
  - [ ] Create `index.ts` to re-export all utilities

- [ ] Create Supabase mock utilities (AC: 9.2.2, 9.2.3)
  - [ ] Create `src/lib/test-utils/mockSupabase.ts`
  - [ ] Mock `createClientComponentClient()` from @supabase/auth-helpers-nextjs
  - [ ] Mock Supabase query builder methods: `from()`, `select()`, `insert()`, `update()`, `delete()`, `eq()`, `order()`, `limit()`
  - [ ] Mock Supabase Auth methods: `getSession()`, `getUser()`, `signOut()`
  - [ ] Export `mockSupabaseClient` and `mockSupabaseAuth` objects

- [ ] Create SWR mock utilities (AC: 9.2.2, 9.2.3)
  - [ ] Create `src/lib/test-utils/mockSWR.ts`
  - [ ] Mock SWRConfig with cache provider
  - [ ] Mock `useSWR` hook with customizable return values
  - [ ] Export `mockSWRConfig` and `mockUseSWR` helpers

- [ ] Create Router mock utilities (AC: 9.2.2, 9.2.3)
  - [ ] Create `src/lib/test-utils/mockRouter.ts`
  - [ ] Mock `useRouter()`, `usePathname()`, `useSearchParams()` from next/navigation
  - [ ] Mock `push()`, `replace()`, `back()`, `refresh()` router methods
  - [ ] Export `mockRouter` and `mockRouterPush` helpers

- [ ] Create Chakra UI mock utilities (AC: 9.2.2)
  - [ ] Create `src/lib/test-utils/mockChakra.ts`
  - [ ] Wrap components in `ChakraProvider` with default theme
  - [ ] Export `ChakraTestProvider` component

- [ ] Create Toast mock utilities (AC: 9.2.2, 9.2.3)
  - [ ] Create `src/lib/test-utils/mockToast.ts`
  - [ ] Mock `toast.success()`, `toast.error()`, `toast.loading()` from react-hot-toast
  - [ ] Export `mockToast` object with spy functions

- [ ] Implement renderWithProviders() (AC: 9.2.1, 9.2.7)
  - [ ] Create `renderWithProviders(ui: ReactElement, options?: CustomRenderOptions)` function
  - [ ] Wrap component in all 6 provider layers (Chakra, SWR, Supabase, Auth, Router, Toast)
  - [ ] Support custom mock overrides via `options` parameter
  - [ ] Return extended render result with `mockSupabase`, `mockRouter`, `mockToast` attached

- [ ] Add TypeScript types (AC: 9.2.4)
  - [ ] Create `src/lib/test-utils/types.ts`
  - [ ] Define `CustomRenderOptions` interface extending `RenderOptions`
  - [ ] Define `RenderResult` type with attached mocks
  - [ ] Define `MockSupabaseClient`, `MockRouter`, `MockToast` interfaces

- [ ] Re-export Testing Library (AC: 9.2.8)
  - [ ] Update `src/lib/test-utils/index.ts`
  - [ ] Re-export `screen`, `waitFor`, `fireEvent`, `userEvent`, etc. from @testing-library/react
  - [ ] Export `renderWithProviders` as `render` (override default)
  - [ ] Export all mock utilities (`mockSupabase`, `mockRouter`, etc.)

- [ ] Write documentation (AC: 9.2.5)
  - [ ] Create `docs/testing/test-utilities-guide.md`
  - [ ] Document `renderWithProviders()` usage with code examples
  - [ ] Document mock customization patterns
  - [ ] Provide migration guide from manual provider wrapping to test utilities
  - [ ] Add troubleshooting section for common issues

- [ ] Refactor existing tests (AC: 9.2.6)
  - [ ] Refactor `src/app/(dashboard)/settings/__tests__/page.test.tsx`
    - [ ] Replace manual ChakraProvider + SWR wrapping with `renderWithProviders`
    - [ ] Use `mockSupabase` instead of inline mocks
    - [ ] Validate test still passes
  - [ ] Refactor `src/app/(dashboard)/transactions/__tests__/page.test.tsx`
    - [ ] Replace manual provider setup with `renderWithProviders`
    - [ ] Use `mockRouter` for navigation testing
    - [ ] Validate test still passes
  - [ ] Refactor `src/app/(dashboard)/insights/__tests__/page.test.tsx`
    - [ ] Replace manual provider setup with `renderWithProviders`
    - [ ] Use `mockToast` for toast notification testing
    - [ ] Validate test still passes

- [ ] Write unit tests for test utilities (AC: All)
  - [ ] Test `renderWithProviders` renders component correctly
  - [ ] Test all 6 providers are applied
  - [ ] Test custom mock overrides work
  - [ ] Test mock helpers (`mockSupabase`, `mockRouter`, etc.) are functional
  - [ ] Test TypeScript types are correct (type-level tests)

- [ ] Add usage examples (AC: 9.2.5)
  - [ ] Add example test file: `src/lib/test-utils/__examples__/ExampleComponent.test.tsx`
  - [ ] Show basic usage of `renderWithProviders`
  - [ ] Show custom mock override examples
  - [ ] Show async data fetching test with SWR mock

## Dev Notes

- **Problem Solved:** Current tests require 50-100 lines of boilerplate to set up 6 provider layers (Chakra, SWR, Supabase, Auth, Router, Toast). This library reduces setup to 1 line: `render(<Component />)`
- **Integration Test Adoption:** Lowering the barrier to entry for integration tests should increase test coverage significantly (currently 0 integration tests in Epics 6, 7, 8)
- **Maintenance:** Centralized mocking means provider changes only need updating in one place, not every test file
- **Customization:** Developers can still override specific mocks when needed via `options` parameter

### Project Structure Notes

**New Files:**
- `src/lib/test-utils/testUtils.tsx` - Main `renderWithProviders()` function
- `src/lib/test-utils/mockSupabase.ts` - Supabase client and auth mocks
- `src/lib/test-utils/mockSWR.ts` - SWR config and hook mocks
- `src/lib/test-utils/mockRouter.ts` - Next.js router mocks
- `src/lib/test-utils/mockChakra.ts` - Chakra UI provider wrapper
- `src/lib/test-utils/mockToast.ts` - Toast notification mocks
- `src/lib/test-utils/types.ts` - TypeScript type definitions
- `src/lib/test-utils/index.ts` - Re-export all utilities
- `src/lib/test-utils/__examples__/ExampleComponent.test.tsx` - Usage examples
- `docs/testing/test-utilities-guide.md` - Documentation and migration guide

**Modified Files:**
- `src/app/(dashboard)/settings/__tests__/page.test.tsx` - Refactored to use test utilities
- `src/app/(dashboard)/transactions/__tests__/page.test.tsx` - Refactored to use test utilities
- `src/app/(dashboard)/insights/__tests__/page.test.tsx` - Refactored to use test utilities

**Imports After Migration:**
```typescript
// Before (manual setup - 50+ lines)
import { render } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { SWRConfig } from 'swr';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
// ... more imports and manual wrapping ...

// After (test utilities - 1 line)
import { render, screen, mockSupabase } from '@/lib/test-utils';
```

**Alignment with Architecture:**
- Testing Library patterns (Kent C. Dodds best practices)
- No changes to production code, developer tooling only
- TypeScript strict mode compatible

### References

- [Tech Spec: Epic 9 - Story 9-2 Acceptance Criteria](../tech-spec-epic-9.md#story-9-2-create-test-utilities-library)
- [Epic 8 Retrospective: Test Mocking Complexity Barrier](../epic-8-retrospective.md#what-could-improve-)
- [Testing Library Setup Documentation](https://testing-library.com/docs/react-testing-library/setup)
- [Kent C. Dodds: Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Dev Agent Record

### Context Reference

- [Story 9-2 Context](9-2-create-test-utilities-library.context.xml) - To be created during dev workflow

### Agent Model Used

TBD (Claude Sonnet 4.5)

### Debug Log References

TBD

### Completion Notes List

TBD - To be filled during implementation

### File List

TBD - To be filled during implementation
