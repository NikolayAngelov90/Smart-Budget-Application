# Story 11.3: Code Quality & Type Safety

Status: ready-for-dev

**Type:** Infrastructure
**Category:** Quality | Code Health
**Priority:** MEDIUM

## Story

As a developer maintaining the Smart Budget Application,
I want to fix type safety issues, stale closures, race conditions, and code quality problems,
So that the codebase is robust, maintainable, and free of subtle runtime bugs.

## Acceptance Criteria

**AC-11.3.1:** Eliminate `any` Types from Source Files
- Remove or properly type all `any` occurrences in non-test source files
- Focus on: SpendingTrendsChart.tsx, localStorageProvider.ts, and other production files

**AC-11.3.2:** Fix Stale Closures in useInactivityLogout
- Audit and fix dependency arrays in all `useCallback` hooks in `src/lib/hooks/useInactivityLogout.ts`
- Ensure `logout`, `startCountdown`, `clearTimers`, and `handleActivity` have complete dependency arrays

**AC-11.3.3:** Fix Subscription Churn in useRealtimeSubscription
- Memoize the subscription setup or use a ref for the callback in `src/lib/hooks/useRealtimeSubscription.ts`
- Prevent subscription teardown/recreation on every parent render

**AC-11.3.4:** Fix Exchange Rate Race Condition
- In `src/components/transactions/TransactionEntryModal.tsx`, use an AbortController or request ID pattern to cancel stale exchange rate fetches when currency changes rapidly

**AC-11.3.5:** Surface Exchange Rate Errors to Users
- Replace silent `catch {}` with a toast warning when exchange rate fetch fails
- Show user that rate is unavailable rather than silently proceeding

**AC-11.3.6:** Extract Hardcoded Currency List to Shared Constant
- Move `['EUR', 'USD', 'GBP']` from `src/app/api/transactions/route.ts` to a shared constant in `src/lib/utils/constants.ts`
- Use the same constant across all currency validation points

**AC-11.3.7:** Replace Hardcoded Hex Colors with Theme Tokens
- Replace `#2b6cb0`, `#2c5282` in InactivityWarningModal.tsx and TransactionEntryModal.tsx with Chakra UI theme tokens (e.g., `blue.600`, `blue.700`)

**AC-11.3.8:** Fix Type Hack in Category Deletion
- Replace `{ category_id: null as unknown as string }` in `src/app/api/categories/[id]/route.ts` with proper nullable type handling

**AC-11.3.9:** Fix Division by Zero in Analytics
- Add guard against `group.count === 0` in `src/app/api/insights/analytics/route.ts` before dividing

**AC-11.3.10:** Remove Stale TODO in insightService
- Address or document the TODO at `src/lib/services/insightService.ts:136` about budget table fetching

## Tasks / Subtasks

- [ ] Fix `any` types in source files (AC: 11.3.1)
- [ ] Fix useInactivityLogout dependency arrays (AC: 11.3.2)
- [ ] Fix useRealtimeSubscription churn (AC: 11.3.3)
- [ ] Fix exchange rate race condition with AbortController (AC: 11.3.4)
- [ ] Add toast for exchange rate errors (AC: 11.3.5)
- [ ] Extract currency constants (AC: 11.3.6)
- [ ] Replace hardcoded colors with theme tokens (AC: 11.3.7)
- [ ] Fix category deletion type hack (AC: 11.3.8)
- [ ] Add division by zero guard in analytics (AC: 11.3.9)
- [ ] Resolve stale TODO in insightService (AC: 11.3.10)
- [ ] Verify all existing tests pass
