/**
 * Rate Limiting Service
 *
 * Provides distributed rate limiting using Upstash Redis.
 * Replaces in-memory Map implementation for production multi-instance support.
 *
 * Features:
 * - Serverless-compatible (Upstash Redis REST API)
 * - Works across multiple Vercel instances
 * - Automatic expiration of rate limit keys
 * - Fallback to in-memory Map if Redis is not configured
 */

import { redis, isRedisConfigured } from '@/lib/redis/client';

/**
 * Fallback in-memory cache for local development
 * Only used when Redis is not configured
 */
const fallbackCache = new Map<string, number>();

/**
 * Rate limit configuration
 */
export const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Check if a user has exceeded their rate limit
 *
 * @param userId - User ID to check
 * @param windowMs - Rate limit window in milliseconds (default: 5 minutes)
 * @returns Object with exceeded status and remaining seconds
 */
export async function checkRateLimit(
  userId: string,
  windowMs: number = RATE_LIMIT_WINDOW
): Promise<{ exceeded: boolean; remainingSeconds: number }> {
  const now = Date.now();

  // Use Redis if configured, otherwise fall back to in-memory Map
  if (isRedisConfigured()) {
    try {
      const key = `rate_limit:${userId}`;
      const lastRefreshTime = await redis.get<number>(key);

      if (lastRefreshTime) {
        const elapsed = now - lastRefreshTime;
        const remaining = windowMs - elapsed;

        if (remaining > 0) {
          return {
            exceeded: true,
            remainingSeconds: Math.ceil(remaining / 1000),
          };
        }
      }

      return { exceeded: false, remainingSeconds: 0 };
    } catch (error) {
      console.error('[Rate Limit] Redis error, falling back to in-memory:', error);
      // Fall through to in-memory fallback
    }
  }

  // Fallback: In-memory Map (for local development or Redis errors)
  const lastRefreshTime = fallbackCache.get(userId);

  if (lastRefreshTime) {
    const elapsed = now - lastRefreshTime;
    const remaining = windowMs - elapsed;

    if (remaining > 0) {
      console.warn('[Rate Limit] Using in-memory fallback - not production-ready');
      return {
        exceeded: true,
        remainingSeconds: Math.ceil(remaining / 1000),
      };
    }
  }

  return { exceeded: false, remainingSeconds: 0 };
}

/**
 * Record a rate-limited action for a user
 *
 * @param userId - User ID to record
 * @param windowMs - Rate limit window in milliseconds (default: 5 minutes)
 */
export async function recordRateLimitAction(
  userId: string,
  windowMs: number = RATE_LIMIT_WINDOW
): Promise<void> {
  const now = Date.now();

  // Use Redis if configured
  if (isRedisConfigured()) {
    try {
      const key = `rate_limit:${userId}`;
      const expirationSeconds = Math.ceil(windowMs / 1000);

      // Set with automatic expiration
      await redis.set(key, now, { ex: expirationSeconds });

      console.log(`[Rate Limit] Recorded action for user ${userId} in Redis`);
      return;
    } catch (error) {
      console.error('[Rate Limit] Redis error, falling back to in-memory:', error);
      // Fall through to in-memory fallback
    }
  }

  // Fallback: In-memory Map
  fallbackCache.set(userId, now);

  // Clean up old entries in fallback cache
  const entries = Array.from(fallbackCache.entries());
  for (const [cachedUserId, timestamp] of entries) {
    if (now - timestamp > windowMs) {
      fallbackCache.delete(cachedUserId);
    }
  }

  console.warn('[Rate Limit] Using in-memory fallback - not production-ready');
}

/**
 * Clear rate limit for a user (useful for testing or admin actions)
 *
 * @param userId - User ID to clear
 */
export async function clearRateLimit(userId: string): Promise<void> {
  if (isRedisConfigured()) {
    try {
      const key = `rate_limit:${userId}`;
      await redis.del(key);
      console.log(`[Rate Limit] Cleared rate limit for user ${userId} in Redis`);
      return;
    } catch (error) {
      console.error('[Rate Limit] Redis error:', error);
    }
  }

  // Fallback: In-memory Map
  fallbackCache.delete(userId);
  console.warn('[Rate Limit] Cleared rate limit in fallback cache');
}

/**
 * Get remaining time for a user's rate limit
 *
 * @param userId - User ID to check
 * @param windowMs - Rate limit window in milliseconds (default: 5 minutes)
 * @returns Remaining seconds (0 if no rate limit active)
 */
export async function getRemainingTime(
  userId: string,
  windowMs: number = RATE_LIMIT_WINDOW
): Promise<number> {
  const result = await checkRateLimit(userId, windowMs);
  return result.remainingSeconds;
}
