### Story 2.3: Login with Email/Password

As a returning user,
I want to log in using my email and password,
So that I can access my financial data.

**Acceptance Criteria:**

**Given** I am a returning user on the login page
**When** I enter my credentials and submit
**Then** I am logged in successfully

**And** Email and password fields present
**And** Email field validates format (not empty, valid email)
**And** Password field masked with show/hide toggle
**And** "Remember me" checkbox optional (extends session to 30 days)
**And** Submit button disabled until both fields filled
**And** Login completes in < 1 second
**And** Successful login redirects to dashboard
**And** Session persisted across browser restarts if "remember me" checked
**And** Error message for incorrect credentials: "Invalid email or password"
**And** Error message for unverified email: "Please verify your email first"
**And** "Forgot password?" link visible and functional
**And** "Don't have an account? Sign up" link to signup page
**And** Form fully keyboard navigable (Tab, Enter to submit)
**And** Touch targets 44x44px minimum on mobile

**Prerequisites:** Story 2.1 (signup exists), Story 2.2 (social login implemented)

**Technical Notes:**
- Create `/app/(auth)/login/page.tsx`
- Use React Hook Form + Zod for validation
- Call `supabase.auth.signInWithPassword({ email, password })`
- Handle errors: invalid credentials, user not found, email not verified, network error
- Implement "Remember me" via session persistence settings
- Add show/hide password toggle (eye icon)
- Style with Chakra UI (matching signup page design)
- Responsive layout: centered card on desktop, full-width on mobile
- Password field type="password" with toggle to type="text"
- ARIA labels for accessibility
