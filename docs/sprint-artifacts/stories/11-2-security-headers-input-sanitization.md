# Story 11.2: Security Headers & Input Sanitization

Status: ready-for-dev

**Type:** Infrastructure
**Category:** Security
**Priority:** HIGH

## Story

As a platform engineer,
I want to add HTTP security headers and fix input sanitization vulnerabilities,
So that the application is protected against XSS, clickjacking, MIME sniffing, and query injection attacks.

## Acceptance Criteria

**AC-11.2.1:** Add Security Headers in next.config.ts
- Add `headers()` configuration with:
  - `Content-Security-Policy` (appropriate for Next.js + Chakra UI)
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (disable unused browser features)

**AC-11.2.2:** Fix Search Query Injection in Transactions API
- Sanitize `searchQuery` in `src/app/api/transactions/route.ts` before interpolating into `.or()` filter
- Escape special characters that could manipulate the Supabase filter clause (%, commas, dots)
- Add max length validation (e.g., 100 chars) for search input

**AC-11.2.3:** Fix Search Query Injection in Insights API
- Apply same sanitization to `searchQuery` in `src/app/api/insights/route.ts` line 93

**AC-11.2.4:** Add Column Whitelist for Insights orderBy
- In `src/app/api/insights/route.ts`, validate the `orderBy` column against an allowlist: `['priority', 'created_at', 'title', 'type']`
- Reject invalid column names with a 400 response

**AC-11.2.5:** Use Timing-Safe Comparison for Cron Secret
- In `src/app/api/cron/generate-insights/route.ts`, replace `!==` with `crypto.timingSafeEqual()` for cron secret validation

**AC-11.2.6:** Add Image Domain Restrictions
- Configure `images.remotePatterns` in next.config.ts to restrict allowed image sources to the Supabase storage domain

## Tasks / Subtasks

- [ ] Add security headers to next.config.ts (AC: 11.2.1)
  - [ ] Define CSP header allowing Chakra UI inline styles and Supabase API
  - [ ] Add X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy
  - [ ] Add Permissions-Policy disabling camera, microphone, geolocation
- [ ] Create search sanitization utility (AC: 11.2.2, 11.2.3)
  - [ ] Create `src/lib/utils/sanitize.ts` with `sanitizeSearchQuery()` function
  - [ ] Escape `.`, `,`, `%`, and other Supabase filter metacharacters
  - [ ] Enforce max length of 100 characters
  - [ ] Apply to transactions route search
  - [ ] Apply to insights route search
- [ ] Add orderBy whitelist (AC: 11.2.4)
  - [ ] Define `ALLOWED_ORDER_COLUMNS` constant
  - [ ] Validate column before passing to `.order()`
  - [ ] Return 400 for invalid columns
- [ ] Use timing-safe comparison (AC: 11.2.5)
  - [ ] Import `timingSafeEqual` from `crypto`
  - [ ] Replace direct `!==` with buffer comparison
- [ ] Add image domain restrictions (AC: 11.2.6)
  - [ ] Extract Supabase domain from env var pattern
  - [ ] Configure `images.remotePatterns` in next.config.ts
- [ ] Verify all existing tests pass
