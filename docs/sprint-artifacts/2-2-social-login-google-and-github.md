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
