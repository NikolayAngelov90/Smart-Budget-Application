### Story 2.5: Session Management and Auto-Logout

As a logged-in user,
I want my session to be secure with automatic timeout after inactivity,
So that my financial data is protected on shared devices.

**Acceptance Criteria:**

**Given** I am logged in
**When** I am inactive for the configured period
**Then** My session expires and I am logged out automatically

**And** Session timeout set to 30 days for "remember me" users
**And** Session timeout set to 24 hours for non-"remember me" users
**And** Inactivity timer tracks user interactions (clicks, key presses, mouse movement)
**And** Warning modal appears 5 minutes before auto-logout: "You'll be logged out in 5 minutes due to inactivity"
**And** User can click "Stay logged in" to extend session
**And** Auto-logout redirects to login page with message: "You were logged out due to inactivity"
**And** Session refreshed automatically on page load if token still valid
**And** Logout button in header immediately ends session
**And** Clicking logout clears session cookies and redirects to login
**And** Multi-tab support: logging out in one tab logs out all tabs
**And** Session persists across page refreshes (token stored in httpOnly cookie)

**Prerequisites:** Story 2.3 (login implemented)

**Technical Notes:**
- Use Supabase session handling (automatic token refresh)
- Configure session expiry in Supabase dashboard settings
- Implement inactivity detection with setTimeout
- Use Chakra UI Modal for timeout warning
- Call `supabase.auth.signOut()` for logout
- Clear local state on logout
- Use broadcast channel API for multi-tab sync (or Supabase realtime)
- Test session expiry edge cases
- Store session in httpOnly cookies for security
