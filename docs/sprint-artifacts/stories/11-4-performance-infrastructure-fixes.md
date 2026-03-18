# Story 11.4: Performance & Infrastructure Fixes

Status: ready-for-dev

**Type:** Infrastructure
**Category:** Performance | Infrastructure
**Priority:** HIGH

## Story

As a platform engineer,
I want to fix performance bottlenecks and infrastructure issues identified in the adversarial review,
So that the application scales properly and doesn't waste resources on inefficient operations.

## Acceptance Criteria

**AC-11.4.1:** Fix Cron Job User Query Efficiency
- In `src/app/api/cron/generate-insights/route.ts`, replace the pattern of fetching 10,000 transaction rows to extract unique user IDs
- Use `SELECT DISTINCT user_id FROM transactions` or query a users/profiles table directly
- Remove the arbitrary 1,000 user cap or document it as a known limit

**AC-11.4.2:** Document In-Memory Rate Limit Limitation
- Add clear documentation in `src/lib/services/rateLimitService.ts` that the in-memory fallback provides NO effective rate limiting in serverless (Vercel) environments
- Log a structured warning at startup when fallback is active in production

**AC-11.4.3:** Fix Double Rate-Limit Counting
- In `src/app/api/insights/generate/route.ts`, remove the separate `recordRateLimitAction()` call when using Upstash (since `checkRateLimit()` already consumes a token via `ratelimiter.limit()`)
- Keep `recordRateLimitAction()` only for the in-memory fallback path

**AC-11.4.4:** Move Trends Aggregation to SQL
- In `src/app/api/dashboard/trends/route.ts`, replace JavaScript-based monthly aggregation with Supabase RPC or a more efficient query pattern
- Avoid fetching all raw transactions and looping in JS

**AC-11.4.5:** Fix PWA Cache Conflict with Realtime
- In `next.config.ts`, reduce API cache duration or add `Cache-Control` headers to API routes that serve realtime-sensitive data (transactions, insights, dashboard stats)
- Consider excluding mutation-sensitive API paths from service worker caching

## Tasks / Subtasks

- [ ] Optimize cron job user query (AC: 11.4.1)
  - [ ] Query `user_profiles` table for user IDs, or use distinct query on transactions
  - [ ] Remove JS-side Set deduplication and 1000-user cap
- [ ] Document rate limit fallback limitation (AC: 11.4.2)
  - [ ] Add JSDoc warning about serverless limitations
  - [ ] Log structured warning when fallback is active and NODE_ENV === 'production'
- [ ] Fix double counting in rate limiter (AC: 11.4.3)
  - [ ] Refactor to only call recordRateLimitAction for in-memory path
  - [ ] Add comment explaining why check already records for Upstash
- [ ] Optimize trends aggregation (AC: 11.4.4)
  - [ ] Replace JS loop with more efficient Supabase query
  - [ ] Use date grouping at the database level where possible
- [ ] Fix PWA cache for realtime data (AC: 11.4.5)
  - [ ] Exclude or reduce cache TTL for transaction/insight/dashboard API paths
  - [ ] Add appropriate Cache-Control headers to API responses
- [ ] Verify all existing tests pass
