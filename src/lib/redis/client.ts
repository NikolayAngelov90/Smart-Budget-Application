/**
 * Upstash Redis Client Configuration
 *
 * Provides a serverless-compatible Redis client for rate limiting,
 * caching, and other stateful operations across Vercel instances.
 *
 * Environment Variables Required:
 * - UPSTASH_REDIS_REST_URL: Redis REST API URL from Upstash dashboard
 * - UPSTASH_REDIS_REST_TOKEN: Redis REST API token from Upstash dashboard
 */

import { Redis } from '@upstash/redis';

/**
 * Upstash Redis client instance
 * Uses REST API for serverless compatibility
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Check if Redis is properly configured
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
