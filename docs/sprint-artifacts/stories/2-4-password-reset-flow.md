### Story 2.4: Password Reset Flow

As a user who forgot their password,
I want to reset it via email verification,
So that I can regain access to my account.

**Acceptance Criteria:**

**Given** I forgot my password
**When** I request a password reset and verify via email
**Then** I can set a new password and log in

**And** "Forgot password?" link on login page goes to `/forgot-password`
**And** Forgot password page has email input field
**And** Email validation ensures valid format before submission
**And** Clicking "Send reset link" triggers Supabase password reset email
**And** Success message: "Password reset link sent to your email"
**And** Reset email contains link to `/reset-password?token=xxx`
**And** Reset password page validates token is valid and not expired
**And** New password field with same requirements as signup (8+ chars, complexity)
**And** Password confirmation field must match
**And** Submit "Reset password" updates password in Supabase
**And** Success message: "Password updated successfully! Please log in."
**And** Redirect to login page after successful reset
**And** Token expires after 1 hour (Supabase default)
**And** Error handling: expired token, invalid token, network errors

**Prerequisites:** Story 2.3 (login page exists)

**Technical Notes:**
- Create `/app/(auth)/forgot-password/page.tsx`
- Create `/app/(auth)/reset-password/page.tsx`
- Call `supabase.auth.resetPasswordForEmail({ email })`
- Token handled automatically by Supabase via magic link
- Call `supabase.auth.updateUser({ password: newPassword })` on reset page
- Customize email template in Supabase dashboard
- Same password validation as signup (React Hook Form + Zod)
- Handle edge cases: user not found (still show success for security), multiple reset requests
- Toast notification on success using Chakra UI `useToast`

---

## Tasks / Subtasks

- [x] Create forgot-password page with email input form
- [x] Add email validation (regex format check)
- [x] Implement "Send reset link" with Supabase `resetPasswordForEmail()`
- [x] Show success message after sending reset link
- [x] Create reset-password page with password input form
- [x] Implement password validation (8+ chars, uppercase, lowercase, number)
- [x] Add password confirmation field with match validation
- [x] Implement token validation on page load
- [x] Handle expired/invalid token errors with clear messaging
- [x] Implement "Reset password" with Supabase `updateUser({ password })`
- [x] Show success message and redirect to login after password reset
- [x] Fix login page "Forgot password?" link to point to correct path
- [x] Wrap useSearchParams in Suspense boundary for Next.js 15 compatibility
- [x] Run TypeScript type-check validation
- [x] Run ESLint validation
- [x] Run production build validation

## Dev Notes

**Implementation Summary:**

1. **Forgot Password Page** (`/app/(auth)/forgot-password/page.tsx`):
   - Email input with regex validation (`/\S+@\S+\.\S+/`)
   - Calls `supabase.auth.resetPasswordForEmail()` with redirectTo parameter
   - Shows success state with instructions after email sent
   - Security: Always shows success message (doesn't reveal if email exists)
   - Handles network errors gracefully

2. **Reset Password Page** (`/app/(auth)/reset-password/page.tsx`):
   - Token validation on component mount using `useSearchParams()`
   - New password + confirmation fields with show/hide toggle
   - Password validation: min 8 chars, uppercase, lowercase, number
   - Calls `supabase.auth.updateUser({ password })` to reset password
   - Shows error state for expired/invalid tokens
   - Redirects to login after successful reset
   - Wrapped in Suspense boundary for Next.js 15 static optimization

3. **Login Page Update**:
   - Fixed "Forgot password?" link from "/auth/forgot-password" to "/forgot-password"

**Security Considerations:**
- Email existence not revealed (always show success for forgot password)
- Token expiry handled by Supabase (1 hour default)
- Password strength validation enforced
- Clear error messaging for expired tokens

## Dev Agent Record

### Debug Log
- Implemented complete password reset flow per Story 2.4 requirements
- Created two new pages: forgot-password and reset-password
- Fixed login page link to use correct route (without /auth prefix)
- Resolved Next.js 15 build error by wrapping useSearchParams in Suspense boundary
- All validations passing (TypeScript, ESLint, production build)

### Completion Notes
✅ All 14 acceptance criteria satisfied
- Forgot password page with email validation and reset link sending
- Reset password page with token validation and password update
- Password validation matches signup requirements (8+ chars, complexity)
- Error handling for expired/invalid tokens
- Success messages and redirects implemented
- Security best practices followed (don't reveal email existence)

**Build Results:**
- TypeScript: ✅ No errors
- ESLint: ✅ No warnings or errors
- Build: ✅ Success (18.7s)
- Bundle sizes:
  - /forgot-password: 1.92 kB (229 kB First Load JS)
  - /reset-password: 4.46 kB (231 kB First Load JS)

## File List
- src/app/(auth)/forgot-password/page.tsx (new)
- src/app/(auth)/reset-password/page.tsx (new)
- src/app/(auth)/login/page.tsx (modified - fixed forgot password link)

## Change Log
- 2025-11-16: Implemented Story 2.4 - Complete password reset flow with forgot password page, reset password page, and email verification. All acceptance criteria met. Ready for review.

## Status
Ready for Review
