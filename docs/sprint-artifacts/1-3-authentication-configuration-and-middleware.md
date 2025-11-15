# Story 1.3: Authentication Configuration and Middleware

Status: drafted
Created: 2025-11-15
Epic: 1 - Foundation & Infrastructure

## Story

As a developer,
I want authentication providers configured and route protection middleware implemented,
So that users can securely sign up, log in, and access protected routes with proper session management.

## Acceptance Criteria

**AC-3.1:** Email/password authentication enabled and functional (test signup/login works)

**AC-3.2:** Google OAuth configured and functional (test login via Google works)

**AC-3.3:** GitHub OAuth configured and functional (test login via GitHub works)

**AC-3.4:** Next.js middleware redirects unauthenticated requests from protected routes

**AC-3.5:** Session persists across page refreshes (token stored in httpOnly cookie)

**AC-3.6:** Session timeout configured (30 days with "remember me", 24 hours otherwise)

## Tasks / Subtasks

- [ ] Task 1: Enable and configure email/password authentication in Supabase (AC: #3.1)
  - [ ] Enable email/password provider in Supabase dashboard (Authentication → Providers)
  - [ ] Configure email templates (verification, password reset) if needed
  - [ ] Test signup flow with email/password via Supabase dashboard
  - [ ] Test login flow with valid credentials
  - [ ] Test login with invalid credentials (verify error handling)

- [ ] Task 2: Configure Google OAuth provider (AC: #3.2)
  - [ ] Create OAuth 2.0 Client ID in Google Cloud Console (https://console.cloud.google.com)
  - [ ] Add authorized redirect URIs: `<supabase-url>/auth/v1/callback` and `http://localhost:3000/auth/callback`
  - [ ] Copy Client ID and Client Secret to Supabase dashboard (Authentication → Providers → Google)
  - [ ] Enable Google provider in Supabase
  - [ ] Test Google OAuth flow in development environment

- [ ] Task 3: Configure GitHub OAuth provider (AC: #3.3)
  - [ ] Create OAuth App in GitHub Developer Settings (https://github.com/settings/developers)
  - [ ] Set Authorization callback URL: `<supabase-url>/auth/v1/callback`
  - [ ] Copy Client ID and Client Secret to Supabase dashboard (Authentication → Providers → GitHub)
  - [ ] Enable GitHub provider in Supabase
  - [ ] Test GitHub OAuth flow in development environment

- [ ] Task 4: Create Next.js middleware for route protection (AC: #3.4)
  - [ ] Create `src/middleware.ts` file
  - [ ] Import Supabase server client (`createServerClient` from `@supabase/ssr`)
  - [ ] Implement session validation logic:
    ```typescript
    - Check for session using supabase.auth.getSession()
    - If no session AND route is protected → redirect to /login
    - If session exists → allow request to continue
    - If session exists AND route is /login → redirect to /dashboard
    ```
  - [ ] Define protected route matcher config:
    ```typescript
    export const config = {
      matcher: ['/dashboard/:path*', '/api/:path*']
    }
    ```
  - [ ] Handle cookie refresh for session renewal
  - [ ] Test: Access /dashboard without auth → redirects to /login
  - [ ] Test: Access /dashboard with auth → loads successfully

- [ ] Task 5: Set up auth route groups and callback handler (AC: #3.2, #3.3)
  - [ ] Create `/auth/callback/route.ts` API route for OAuth callback handling
  - [ ] Implement code exchange logic:
    ```typescript
    - Extract 'code' from query params
    - Call supabase.auth.exchangeCodeForSession(code)
    - Redirect to /dashboard on success
    - Redirect to /login?error=auth_failed on failure
    ```
  - [ ] Create auth pages in `(auth)` route group:
    - `/login` page (will be implemented in Epic 2)
    - `/signup` page (will be implemented in Epic 2)
    - Placeholder pages acceptable for this story
  - [ ] Test OAuth callback flow end-to-end

- [ ] Task 6: Configure session management and persistence (AC: #3.5, #3.6)
  - [ ] Verify Supabase session storage uses httpOnly cookies (default behavior)
  - [ ] Configure session timeout settings in Supabase dashboard:
    - JWT expiry: 3600 seconds (1 hour)
    - Refresh token expiry: 2592000 seconds (30 days) for "remember me"
    - Refresh token expiry: 86400 seconds (24 hours) for standard login
  - [ ] Test session persistence: Login → Refresh page → Verify still authenticated
  - [ ] Test session expiry: Wait for timeout period → Verify redirect to login

- [ ] Task 7: Create authentication utility functions (AC: #3.1, #3.2, #3.3)
  - [ ] Create `src/lib/auth/` directory for auth utilities
  - [ ] Create `src/lib/auth/server.ts`:
    ```typescript
    - getSession(): Promise<Session | null>
    - requireAuth(): Promise<Session> // throws if not authenticated
    - getUser(): Promise<User | null>
    ```
  - [ ] Create `src/lib/auth/client.ts`:
    ```typescript
    - signIn(email, password): Promise<AuthResponse>
    - signUp(email, password): Promise<AuthResponse>
    - signInWithOAuth(provider): Promise<void>
    - signOut(): Promise<void>
    ```
  - [ ] Export utilities from `src/lib/auth/index.ts`

- [ ] Task 8: Test all authentication flows (AC: #3.1, #3.2, #3.3, #3.4, #3.5, #3.6)
  - [ ] Manual test: Email/password signup → Verify email sent (check Supabase inbox)
  - [ ] Manual test: Email/password login → Verify session created
  - [ ] Manual test: Google OAuth login → Verify redirect and session creation
  - [ ] Manual test: GitHub OAuth login → Verify redirect and session creation
  - [ ] Manual test: Logout → Verify session cleared and redirect to login
  - [ ] Manual test: Access protected route while logged out → Verify redirect
  - [ ] Manual test: Session persistence → Login, refresh page, verify still logged in
  - [ ] Manual test: Session timeout → Wait for expiry, verify redirect to login
  - [ ] Document test results in Dev Agent Record

- [ ] Task 9: Run quality checks and validation (AC: all)
  - [ ] Run `npm run type-check` → Verify no TypeScript errors
  - [ ] Run `npm run lint` → Verify no linting errors
  - [ ] Run `npm run build` → Verify production build succeeds
  - [ ] Verify all acceptance criteria are met (review checklist above)

## Dev Notes

### Architecture Context

This story implements authentication infrastructure as defined in [Epic 1 Tech Spec](tech-spec-epic-1.md) lines 236-263, following architectural decisions:

- **ADR-003:** Supabase Auth for authentication (email/password + OAuth)
- **Security Pattern:** Session-based auth with JWT tokens stored in httpOnly cookies
- **Route Protection:** Next.js middleware pattern for auth validation before page render

**Key Architecture Decisions:**
- Supabase Auth provides built-in email verification, password reset, OAuth integration
- JWT tokens automatically refreshed by Supabase client (transparent to app)
- Middleware runs on Edge Runtime for fast auth checks
- Session state synchronized between client and server via cookies

**Critical Constraints:**
- MUST use Supabase Auth (not custom auth implementation)
- MUST store session in httpOnly cookies (security requirement)
- MUST protect all /dashboard/* and /api/* routes via middleware
- OAuth redirect URIs must match Supabase project URL exactly

### Dependencies on Previous Stories

**Requires Story 1.2 (Supabase Setup)** to be complete:
- Supabase project must exist with database configured
- Supabase client libraries (`@supabase/supabase-js`, `@supabase/ssr`) must be installed
- Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) must be set
- Supabase clients (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`) must be created

**⚠️ Blocker:** Story 1.2 is currently status "ready-for-dev" (not yet implemented). This story (1.3) cannot begin until Story 1.2 is completed.

### Project Structure Notes

**Expected File Structure After Completion:**
```
src/
├── lib/
│   ├── auth/                    # NEW - Auth utilities
│   │   ├── index.ts             # Exports
│   │   ├── client.ts            # Client-side auth functions
│   │   └── server.ts            # Server-side auth functions
│   └── supabase/                # From Story 1.2
│       ├── client.ts
│       └── server.ts
├── middleware.ts                # NEW - Route protection
├── app/
│   ├── (auth)/                  # From Story 1.1 (currently empty)
│   │   ├── login/               # NEW (placeholder for Epic 2)
│   │   │   └── page.tsx
│   │   └── signup/              # NEW (placeholder for Epic 2)
│   │       └── page.tsx
│   ├── (dashboard)/             # From Story 1.1
│   │   └── layout.tsx
│   └── auth/                    # NEW - OAuth callback
│       └── callback/
│           └── route.ts
```

**Files to Create:**
- `src/middleware.ts` - Route protection logic
- `src/lib/auth/index.ts` - Auth utilities barrel export
- `src/lib/auth/client.ts` - Client-side auth functions
- `src/lib/auth/server.ts` - Server-side auth functions
- `src/app/auth/callback/route.ts` - OAuth callback handler
- `src/app/(auth)/login/page.tsx` - Login page placeholder
- `src/app/(auth)/signup/page.tsx` - Signup page placeholder

**Files to Modify:**
- None (this story only creates new files)

### Testing Strategy

**For This Story:**
- Manual testing of all authentication flows (email, Google, GitHub)
- Manual verification of route protection (access protected routes while logged out)
- Manual verification of session persistence (refresh page, verify still authenticated)
- Manual verification of session timeout (wait for expiry, verify redirect)
- Quality checks: TypeScript type-check, ESLint, production build

**No automated tests required** for this infrastructure story per tech spec (lines 472-475, 479-480). Integration tests for auth middleware will be added in Epic 2 when implementing actual login/signup pages.

**Test Data Requirements:**
- Valid email address for email/password testing
- Google account for OAuth testing
- GitHub account for OAuth testing
- Supabase project with auth configured (from Story 1.2)

### References

- [Epic 1 Technical Specification](tech-spec-epic-1.md) - AC-3.1 through AC-3.6 (lines 380-391)
- [Architecture Document](../architecture.md) - ADR-003 Authentication (Supabase Auth)
- [Epic 1 Details](../epics.md#Story-13-Authentication-Configuration-and-Middleware) - Story 1.3 breakdown (lines 181-215)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Supabase SSR Documentation](https://supabase.com/docs/guides/auth/server-side-rendering)

### Learnings from Previous Story

**No previous story implementation** - Story 1.2 is drafted but not yet implemented.

This story requires Story 1.2 completion first. Proceed with Story 1.2 before attempting this story.

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- To be filled by dev agent -->

### Debug Log References

<!-- To be filled by dev agent during implementation -->

### Completion Notes List

<!-- To be filled by dev agent after story completion -->

### File List

<!-- To be filled by dev agent with created/modified files -->

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-15 | Niki | Initial story draft created via create-story workflow |
