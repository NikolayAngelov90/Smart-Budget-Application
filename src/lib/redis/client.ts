/**
 * Redis Client Configuration
 *
 * Provides a unified Redis client interface supporting both:
 * - Upstash Redis (serverless, REST API) - Default for Vercel deployments
 * - ioredis (self-hosted Redis) - For traditional Redis instances
 *
 * Environment Variables:
 * - Upstash: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * - Self-hosted: REDIS_URL (e.g., redis://localhost:6379)
 * - Feature flag: USE_REDIS_RATE_LIMIT (default: true)
 */

import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';

export type RedisProvider = 'upstash' | 'ioredis' | 'none';

/**
 * Unified Redis client type that works with both Upstash and ioredis
 */
export type RedisClient = UpstashRedis | IORedis;

let redisClient: RedisClient | null = null;
let redisProvider: RedisProvider = 'none';

/**
 * Initialize Redis client based on environment configuration
 */
function initializeRedis(): void {
  if (redisClient) return; // Already initialized

  // Check feature flag (default: true)
  const featureFlagEnabled = process.env.USE_REDIS_RATE_LIMIT !== 'false';

  if (!featureFlagEnabled) {
    console.log('[Redis] Feature flag USE_REDIS_RATE_LIMIT=false, Redis disabled');
    redisProvider = 'none';
    return;
  }

  // Try Upstash first (preferred for serverless)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = new UpstashRedis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    redisProvider = 'upstash';
    console.log('[Redis] Initialized with Upstash provider');
    return;
  }

  // Fall back to ioredis for self-hosted Redis
  if (process.env.REDIS_URL) {
    redisClient = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 100, 2000); // Exponential backoff
      },
    });
    redisProvider = 'ioredis';
    console.log('[Redis] Initialized with ioredis provider');
    return;
  }

  // No Redis configuration found
  console.warn('[Redis] No Redis configuration found. Rate limiting will use in-memory fallback.');
  redisProvider = 'none';
}

/**
 * Get the initialized Redis client
 */
export function getRedisClient(): RedisClient | null {
  if (!redisClient) {
    initializeRedis();
  }
  return redisClient;
}

/**
 * Get the current Redis provider type
 */
export function getRedisProvider(): RedisProvider {
  if (!redisClient && redisProvider === 'none') {
    initializeRedis();
  }
  return redisProvider;
}

/**
 * Check if Redis is properly configured and available
 */
export function isRedisConfigured(): boolean {
  if (!redisClient) {
    initializeRedis();
  }
  return redisClient !== null && redisProvider !== 'none';
}

/**
 * Ping Redis to check connection health
 * @returns Latency in milliseconds, or null if unavailable
 */
export async function pingRedis(): Promise<number | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const start = Date.now();

    if (redisProvider === 'upstash') {
      await (client as UpstashRedis).ping();
    } else if (redisProvider === 'ioredis') {
      await (client as IORedis).ping();
    }

    return Date.now() - start;
  } catch (error) {
    console.error('[Redis] Ping failed:', error);
    return null;
  }
}

// Legacy export for backwards compatibility
export const redis = getRedisClient() as UpstashRedis; // Type assertion for existing code

/**
 * Reset Redis client state (for testing only)
 * @internal
 */
export function __resetRedisForTesting(): void {
  redisClient = null;
  redisProvider = 'none';
}
