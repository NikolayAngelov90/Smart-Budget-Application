/**
 * Rate Limiting Service
 *
 * Provides distributed rate limiting using Upstash Redis with @upstash/ratelimit library.
 * Replaces custom Redis implementation for production multi-instance support.
 *
 * Features:
 * - Serverless-compatible (Upstash Redis REST API or ioredis)
 * - Works across multiple Vercel instances with distributed state
 * - Sliding window algorithm: 10 requests per 60 seconds
 * - Automatic fallback to in-memory Map if Redis is not configured
 * - Feature flag support: USE_REDIS_RATE_LIMIT
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis as UpstashRedis } from '@upstash/redis';
import { getRedisClient, getRedisProvider, isRedisConfigured } from '@/lib/redis/client';

/**
 * Fallback in-memory cache for local development
 * Only used when Redis is not configured
 */
const fallbackCache = new Map<
  string,
  {
    count: number;
    resetTime: number;
  }
>();

/**
 * Counter tracking how many times the in-memory fallback has been activated.
 * Useful for monitoring Redis reliability in production.
 */
let fallbackActivationCount = 0;

/**
 * Rate limit configuration
 * Story 9-1 AC-9.1.3: Exactly 10 requests per 60 seconds
 */
export const RATE_LIMIT = 10; // requests
export const RATE_LIMIT_WINDOW = 60; // seconds (changed from 5 minutes to 1 minute)

/**
 * Upstash Ratelimit instance (lazy-initialized)
 */
let ratelimiter: Ratelimit | null = null;

/**
 * Initialize Upstash Ratelimit instance
 */
function getRateLimiter(): Ratelimit | null {
  if (ratelimiter) return ratelimiter;

  if (!isRedisConfigured()) {
    return null;
  }

  const provider = getRedisProvider();
  const client = getRedisClient();

  if (!client || provider !== 'upstash') {
    // @upstash/ratelimit only works with Upstash Redis
    // For ioredis, we'll use custom implementation below
    return null;
  }

  try {
    ratelimiter = new Ratelimit({
      redis: client as UpstashRedis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT, `${RATE_LIMIT_WINDOW}s`),
      analytics: true,
      prefix: 'rate_limit',
    });

    console.log(`[Rate Limit] Initialized @upstash/ratelimit (${RATE_LIMIT} req/${RATE_LIMIT_WINDOW}s)`);
    return ratelimiter;
  } catch (error) {
    console.error('[Rate Limit] Failed to initialize @upstash/ratelimit:', error);
    return null;
  }
}

/**
 * Check if a user has exceeded their rate limit
 *
 * @param userId - User ID to check
 * @param windowMs - Rate limit window in milliseconds (optional, defaults to RATE_LIMIT_WINDOW * 1000) - DEPRECATED: This parameter is kept for backwards compatibility but is no longer used
 * @returns Object with exceeded status and remaining seconds
 */
export async function checkRateLimit(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _windowMs: number = RATE_LIMIT_WINDOW * 1000 // Legacy parameter for backwards compatibility
): Promise<{ exceeded: boolean; remainingSeconds: number }> {
  const rateLimiter = getRateLimiter();

  // Use Upstash Ratelimit library if available (AC-9.1.1)
  if (rateLimiter) {
    try {
      const result = await rateLimiter.limit(userId);

      if (!result.success) {
        // Rate limit exceeded
        const remainingSeconds = Math.ceil((result.reset - Date.now()) / 1000);
        console.log(
          `[Rate Limit] User ${userId} exceeded limit (${result.remaining}/${result.limit} remaining, reset in ${remainingSeconds}s)`
        );

        return {
          exceeded: true,
          remainingSeconds: Math.max(remainingSeconds, 0),
        };
      }

      // Within rate limit
      console.log(`[Rate Limit] User ${userId} within limit (${result.remaining}/${result.limit} remaining)`);
      return { exceeded: false, remainingSeconds: 0 };
    } catch (error) {
      fallbackActivationCount++;
      console.warn(JSON.stringify({
        level: 'warn',
        service: 'rateLimitService',
        event: 'redis_fallback_activated',
        userId,
        fallbackActivationCount,
        error: error instanceof Error ? error.message : String(error),
      }));
      // Fall through to in-memory fallback
    }
  }

  // Fallback: In-memory Map (for local development, ioredis, or Redis errors)
  const now = Date.now();
  const userLimit = fallbackCache.get(userId);

  if (userLimit) {
    // Check if we're still within the rate limit window
    if (now < userLimit.resetTime) {
      // User has hit the limit
      if (userLimit.count >= RATE_LIMIT) {
        const remainingMs = userLimit.resetTime - now;
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        console.warn(
          `[Rate Limit] Using in-memory fallback - User ${userId} exceeded (${userLimit.count}/${RATE_LIMIT}, reset in ${remainingSeconds}s)`
        );

        return {
          exceeded: true,
          remainingSeconds,
        };
      }
    } else {
      // Window has expired, reset the count
      fallbackCache.delete(userId);
    }
  }

  return { exceeded: false, remainingSeconds: 0 };
}

/**
 * Record a rate-limited action for a user
 *
 * @param userId - User ID to record
 * @param windowMs - Rate limit window in milliseconds (optional, defaults to RATE_LIMIT_WINDOW * 1000)
 */
export async function recordRateLimitAction(
  userId: string,
  windowMs: number = RATE_LIMIT_WINDOW * 1000
): Promise<void> {
  const rateLimiter = getRateLimiter();

  // Note: For @upstash/ratelimit, the limit() call in checkRateLimit already
  // records the action, so we don't need to do anything here when using Upstash.
  // This function is kept for backwards compatibility and in-memory fallback.

  if (rateLimiter) {
    // Already recorded by checkRateLimit -> ratelimiter.limit()
    console.log(`[Rate Limit] Action already recorded for user ${userId} by @upstash/ratelimit`);
    return;
  }

  // Fallback: In-memory Map
  const now = Date.now();
  const resetTime = now + windowMs;
  const userLimit = fallbackCache.get(userId);

  if (userLimit && now < userLimit.resetTime) {
    // Increment count within existing window
    userLimit.count += 1;
  } else {
    // Start new window
    fallbackCache.set(userId, {
      count: 1,
      resetTime,
    });
  }

  // Clean up expired entries in fallback cache
  const entries = Array.from(fallbackCache.entries());
  for (const [cachedUserId, limit] of entries) {
    if (now >= limit.resetTime) {
      fallbackCache.delete(cachedUserId);
    }
  }

  console.warn(`[Rate Limit] Using in-memory fallback - Recorded action for user ${userId}`);
}

/**
 * Clear rate limit for a user (useful for testing or admin actions)
 *
 * @param userId - User ID to clear
 */
export async function clearRateLimit(userId: string): Promise<void> {
  const rateLimiter = getRateLimiter();

  if (rateLimiter) {
    try {
      // @upstash/ratelimit doesn't have a clear method, so we reset manually
      const client = getRedisClient();
      if (client && getRedisProvider() === 'upstash') {
        await (client as UpstashRedis).del(`rate_limit:${userId}`);
        console.log(`[Rate Limit] Cleared rate limit for user ${userId} in Upstash Redis`);
        return;
      }
    } catch (error) {
      console.error('[Rate Limit] Redis error:', error);
    }
  }

  // Fallback: In-memory Map
  fallbackCache.delete(userId);
  console.warn(`[Rate Limit] Cleared rate limit in fallback cache for user ${userId}`);
}

/**
 * Get remaining time for a user's rate limit
 *
 * @param userId - User ID to check
 * @param windowMs - Rate limit window in milliseconds (optional, defaults to RATE_LIMIT_WINDOW * 1000)
 * @returns Remaining seconds (0 if no rate limit active)
 */
export async function getRemainingTime(
  userId: string,
  windowMs: number = RATE_LIMIT_WINDOW * 1000
): Promise<number> {
  const result = await checkRateLimit(userId, windowMs);
  return result.remainingSeconds;
}

/**
 * Reset rate limit state (for testing only)
 * @internal
 */
export function __resetRateLimitForTesting(): void {
  fallbackCache.clear();
  ratelimiter = null;
  fallbackActivationCount = 0;
}

/**
 * Get the number of times the in-memory fallback has been activated.
 * Useful for monitoring and alerting on Redis health.
 */
export function getFallbackActivationCount(): number {
  return fallbackActivationCount;
}
