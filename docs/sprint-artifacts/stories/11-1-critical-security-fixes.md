# Story 11.1: Critical Security Fixes

Status: ready-for-dev

**Type:** Infrastructure
**Category:** Security
**Priority:** CRITICAL

## Story

As a platform engineer,
I want to fix critical authentication and authorization vulnerabilities identified in the adversarial review,
So that the application cannot be bypassed by attackers and user accounts are properly secured.

## Acceptance Criteria

**AC-11.1.1:** Remove BENCHMARK_MODE Auth Bypass
- Remove or guard the `BENCHMARK_MODE` environment variable check in `src/middleware.ts` that completely skips authentication
- If kept for CI, ensure it cannot be activated in production (e.g., check `NODE_ENV !== 'production'`)

**AC-11.1.2:** Replace getSession() with getUser() in Middleware
- Replace `supabase.auth.getSession()` with `supabase.auth.getUser()` in `src/middleware.ts` for JWT validation
- Per Supabase docs, `getSession()` reads from cookies without validating the JWT; `getUser()` makes a server call to verify

**AC-11.1.3:** Fix getSession() in Auth Server Utilities
- Update `src/lib/auth/server.ts` to use `getUser()` instead of `getSession()` in the `getSession()` and `requireAuth()` functions
- Ensure all callers of `requireAuth()` get properly validated sessions

**AC-11.1.4:** Fix Account Deletion to Use Service Role Client
- Update `src/lib/services/settingsService.ts` `deleteUserAccount()` to use `createServiceRoleClient()` instead of `createClient()` for the `admin.deleteUser()` call
- The anon key client cannot perform admin operations

**AC-11.1.5:** Stop Storing/Returning Raw JWT in Sessions API
- In `src/app/api/user/sessions/route.ts`, hash the session token before storing in DB using `crypto.createHash('sha256')`
- Remove `current_session_token` from the API response body
- Use the hash for session matching instead of raw JWT comparison

**AC-11.1.6:** Update Stale Middleware TODO
- Change the authenticated user redirect from `/` to `/dashboard` (middleware.ts line 88-90)
- Epic 5 (dashboard) has been completed; this TODO is stale

## Tasks / Subtasks

- [ ] Fix BENCHMARK_MODE bypass (AC: 11.1.1)
  - [ ] Add `NODE_ENV !== 'production'` guard around BENCHMARK_MODE check
- [ ] Replace getSession with getUser in middleware (AC: 11.1.2)
  - [ ] Update middleware.ts to call `supabase.auth.getUser()` instead of `supabase.auth.getSession()`
  - [ ] Adjust destructuring to match getUser() response shape
- [ ] Fix auth/server.ts utilities (AC: 11.1.3)
  - [ ] Update `getSession()` function to use getUser() internally
  - [ ] Update `requireAuth()` accordingly
- [ ] Fix account deletion service (AC: 11.1.4)
  - [ ] Import `createServiceRoleClient` in settingsService.ts
  - [ ] Use service role client for `admin.deleteUser()` call
  - [ ] Update tests to verify service role client is used
- [ ] Secure session token handling (AC: 11.1.5)
  - [ ] Hash tokens with SHA-256 before DB storage
  - [ ] Compare hashed tokens for session matching
  - [ ] Remove `current_session_token` from GET response
  - [ ] Update session lookup logic to use hashed comparison
- [ ] Fix stale TODO redirect (AC: 11.1.6)
  - [ ] Change redirect from `/` to `/dashboard` for authenticated users on auth pages
  - [ ] Remove TODO comment
- [ ] Verify all existing tests pass after changes
