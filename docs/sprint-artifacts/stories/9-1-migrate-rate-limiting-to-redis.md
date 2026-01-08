# Story 9.1: Migrate Rate Limiting to Redis/Upstash

Status: ready-for-dev

## Story

As a platform engineer,
I want to migrate rate limiting from in-memory Map to Redis-backed storage,
So that the application can scale horizontally across multiple instances without rate limit inconsistencies.

## Acceptance Criteria

**AC-9.1.1:** Redis Integration
✅ Replace in-memory Map rate limiting with Redis-backed implementation using @upstash/ratelimit

**AC-9.1.2:** Multi-Provider Support
✅ Support both Upstash Redis (serverless) and self-hosted Redis (ioredis)

**AC-9.1.3:** Rate Limit Preservation
✅ Maintain existing rate limits: 10 requests/minute per user for insights generation

**AC-9.1.4:** Health Check Endpoint
✅ Add `GET /api/health/redis` endpoint returning Redis connection status

**AC-9.1.5:** Graceful Fallback
✅ If Redis unavailable, fall back to in-memory rate limiting with warning log

**AC-9.1.6:** Documentation
✅ Update deployment documentation with Redis setup instructions (Upstash and self-hosted)

**AC-9.1.7:** Environment Configuration
✅ Support environment variables: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, or `REDIS_URL`

**AC-9.1.8:** Zero Downtime Migration
✅ Deploy with feature flag `USE_REDIS_RATE_LIMIT` (default: true after testing)

## Tasks / Subtasks

- [ ] Install Redis dependencies (AC: 9.1.1, 9.1.2)
  - [ ] Install @upstash/redis: `npm install @upstash/redis`
  - [ ] Install @upstash/ratelimit: `npm install @upstash/ratelimit`
  - [ ] Optional: Install ioredis for self-hosted support: `npm install ioredis`
  - [ ] Install TypeScript types: `npm install --save-dev @types/ioredis`

- [ ] Refactor rateLimitService.ts (AC: 9.1.1, 9.1.3, 9.1.5)
  - [ ] Create new `src/lib/services/rateLimitService.ts` (or refactor existing)
  - [ ] Implement Redis-backed rate limiter using @upstash/ratelimit
  - [ ] Create RedisRateLimiter class with `limit()` method
  - [ ] Implement InMemoryRateLimiter as fallback class
  - [ ] Add feature flag check: `USE_REDIS_RATE_LIMIT` env variable
  - [ ] Maintain existing rate limit: 10 requests per 60 seconds
  - [ ] Add graceful fallback to in-memory if Redis connection fails
  - [ ] Log warnings when falling back to in-memory mode

- [ ] Add Redis connection module (AC: 9.1.2, 9.1.7)
  - [ ] Create `src/lib/redis/client.ts` for Redis connection
  - [ ] Support Upstash REST API client (default)
  - [ ] Support ioredis client for self-hosted Redis
  - [ ] Auto-detect provider based on environment variables
  - [ ] Implement connection pooling and retry logic
  - [ ] Export `getRedisClient()` function

- [ ] Create health check endpoint (AC: 9.1.4)
  - [ ] Create `src/app/api/health/redis/route.ts`
  - [ ] Implement GET handler to check Redis connection
  - [ ] Return JSON: `{ status: 'healthy' | 'degraded', provider: 'upstash' | 'ioredis', latency_ms: number }`
  - [ ] Add authentication requirement (admin-only endpoint)

- [ ] Update API routes to use new rate limiter (AC: 9.1.1, 9.1.3)
  - [ ] Update `src/app/api/insights/generate/route.ts` to use Redis rate limiter
  - [ ] Replace in-memory Map references with `rateLimitService.limit()`
  - [ ] Ensure user ID used as rate limit identifier (not IP)
  - [ ] Maintain 429 Too Many Requests response with Retry-After header

- [ ] Add unit tests (AC: All)
  - [ ] Test Redis rate limiter with mock Redis client
  - [ ] Test in-memory fallback when Redis unavailable
  - [ ] Test rate limit enforcement (10 requests, 11th blocked)
  - [ ] Test Retry-After header calculation
  - [ ] Test health check endpoint (healthy, degraded states)
  - [ ] Test multi-provider support (Upstash vs ioredis)

- [ ] Add integration tests (AC: 9.1.3, 9.1.5, 9.1.8)
  - [ ] Test rate limiting with real Upstash Redis (test environment)
  - [ ] Test concurrent requests across multiple API instances (simulate horizontal scaling)
  - [ ] Test fallback behavior when Redis down
  - [ ] Test feature flag toggle (USE_REDIS_RATE_LIMIT=true/false)
  - [ ] Load test: 100 requests/sec with Redis rate limiting

- [ ] Update documentation (AC: 9.1.6)
  - [ ] Add Redis setup guide to `docs/deployment.md`
  - [ ] Document Upstash account creation and configuration
  - [ ] Document self-hosted Redis setup (Docker, Redis Cloud)
  - [ ] Add environment variable reference
  - [ ] Add troubleshooting section (connection failures, latency issues)

## Dev Notes

- **Why Redis?** In-memory Map rate limiting only works for single-instance deployments. Production environments with multiple API instances (Vercel, AWS ECS, Kubernetes) require distributed rate limiting via Redis.
- **Upstash vs ioredis:** Upstash offers serverless Redis with REST API (no persistent connections), ideal for Vercel and serverless deployments. ioredis better for self-hosted Redis with connection pooling.
- **Fallback Strategy:** If Redis unavailable, fall back to in-memory to prevent service outage. Log warnings for monitoring/alerting.
- **Performance:** Redis adds ~5-10ms latency per rate limit check. Acceptable overhead for distributed rate limiting.
- **Rate Limit Key:** Use user ID as identifier (not IP) to prevent shared IP rate limit conflicts (corporate networks, VPNs).

### Project Structure Notes

**New Files:**
- `src/lib/redis/client.ts` - Redis connection manager
- `src/app/api/health/redis/route.ts` - Redis health check endpoint

**Modified Files:**
- `src/lib/services/rateLimitService.ts` - Refactor to use Redis
- `src/app/api/insights/generate/route.ts` - Use Redis rate limiter
- `docs/deployment.md` - Add Redis setup instructions

**Environment Variables:**
```bash
# Upstash Redis (Recommended for Vercel)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=AabBcC...

# OR Self-Hosted Redis
REDIS_URL=redis://localhost:6379

# Feature Flag (default: true after testing)
USE_REDIS_RATE_LIMIT=true
```

**Alignment with Architecture:**
- Distributed rate limiting enables multi-instance production deployments
- No changes to API contract (rate limiting transparent to clients)
- Maintains existing 429 error responses and Retry-After headers

### References

- [Tech Spec: Epic 9 - Story 9-1 Acceptance Criteria](../tech-spec-epic-9.md#story-9-1-migrate-rate-limiting-to-redisupstash)
- [Epic 6 Retrospective: Redis Migration (HIGH Priority)](../epic-6-retrospective.md#recommended-actions-for-future-epics)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Upstash Rate Limiting Library](https://github.com/upstash/ratelimit)
- [Architecture: Rate Limiting](../../architecture.md#rate-limiting)

## Dev Agent Record

### Context Reference

- [Story 9-1 Context](9-1-migrate-rate-limiting-to-redis.context.xml) - Generated 2026-01-07

### Agent Model Used

TBD (Claude Sonnet 4.5)

### Debug Log References

TBD

### Completion Notes List

TBD - To be filled during implementation

### File List

TBD - To be filled during implementation
