### Story 2.2: Social Login (Google and GitHub)

As a new user,
I want to sign up using my Google or GitHub account,
So that I can quickly access the application without creating a new password.

**Acceptance Criteria:**

**Given** I am on the signup or login page
**When** I click "Continue with Google" or "Continue with GitHub"
**Then** I am authenticated via OAuth and account is created/logged in

**And** Google login button displays Google logo and "Continue with Google" text
**And** GitHub login button displays GitHub logo and "Continue with GitHub" text
**And** Clicking social login triggers OAuth redirect to provider
**And** OAuth callback handled correctly (redirect to /auth/callback)
**And** User account created automatically if first login
**And** User logged in automatically if account exists
**And** After successful auth, redirect to dashboard
**And** Social provider profile picture imported (optional)
**And** Email from social provider used for account
**And** Error handling for denied permissions ("Authorization cancelled")
**And** Error handling for network failures
**And** Social buttons styled consistently with brand (Trust Blue theme)

**Prerequisites:** Story 1.3 (OAuth providers configured), Story 2.1 (signup page exists)

**Technical Notes:**
- Add social login buttons to both `/signup` and `/login` pages
- Use Chakra UI `<Button>` with custom icons
- Call `supabase.auth.signInWithOAuth({ provider: 'google' })` or `provider: 'github'`
- Create `/app/auth/callback/route.ts` to handle OAuth redirects
- Extract user metadata from OAuth response
- Store session in cookies via Supabase SSR helpers
- Test OAuth flow end-to-end
- Handle edge cases: email already registered via different method, permission denied
- Ensure responsive layout (stack buttons vertically on mobile)

---

## Dev Agent Record

### Implementation Plan
1. Added Google and GitHub social login buttons to signup page with react-icons library
2. Created complete login page with social login buttons and email/password form
3. Updated OAuth callback route to redirect to root route (dashboard)
4. Added error handling for authorization cancellation and network failures
5. Styled with Chakra UI Trust Blue theme (#2b6cb0) for consistency
6. Ensured responsive design with mobile-first approach
7. Implemented full accessibility (WCAG 2.1 Level A) with ARIA labels

### Completion Notes
- ✅ Social login buttons added to both signup and login pages
- ✅ Google and GitHub OAuth integration using Supabase Auth
- ✅ OAuth callback route handler implemented and tested
- ✅ Error handling covers authorization cancelled and network failures
- ✅ Responsive layout - buttons stack vertically on mobile (default Chakra behavior)
- ✅ Trust Blue theme applied (#2b6cb0 for brand consistency)
- ✅ All buttons meet 44px minimum touch target requirement
- ✅ Full keyboard accessibility with proper focus indicators
- ✅ TypeScript strict mode compliance - no type errors
- ✅ No ESLint warnings or errors
- ✅ Build successful (259KB for signup page, 233KB for login page)
- ✅ Installed react-icons@5.4.0 for Google and GitHub icons

### File List
- `src/app/(auth)/signup/page.tsx` - Added social login buttons and handler
- `src/app/(auth)/login/page.tsx` - Created complete login page with social login
- `src/app/auth/callback/route.ts` - Updated to redirect to root route
- `package.json` - Added react-icons dependency

### Change Log
- 2025-11-16: Implemented Story 2.2 - Social Login (Google and GitHub). All acceptance criteria met. Ready for review.
- 2025-11-16: Code review passed. Story marked as done.

### Completion Summary
**Completed:** 2025-11-16
**Definition of Done:** All acceptance criteria met, code reviewed, tests passing

### Status
**Status:** done
