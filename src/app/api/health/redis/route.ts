/**
 * Redis Health Check Endpoint
 *
 * GET /api/health/redis
 *
 * Returns Redis connection status, provider type, and latency.
 * Used for monitoring and deployment readiness checks.
 *
 * Story 9.1 AC-9.1.4: Health Check Endpoint
 */

import { NextResponse } from 'next/server';
import { getRedisProvider, isRedisConfigured, pingRedis } from '@/lib/redis/client';

/**
 * GET handler for Redis health check
 *
 * @example
 * GET /api/health/redis
 *
 * Response (healthy):
 * {
 *   "status": "healthy",
 *   "provider": "upstash",
 *   "latency_ms": 15,
 *   "feature_flag": true,
 *   "timestamp": "2026-01-07T10:30:00.000Z"
 * }
 *
 * Response (degraded):
 * {
 *   "status": "degraded",
 *   "provider": "none",
 *   "latency_ms": null,
 *   "feature_flag": true,
 *   "message": "Redis not configured, using in-memory fallback"
 * }
 */
export async function GET() {
  try {
    const provider = getRedisProvider();
    const configured = isRedisConfigured();
    const featureFlagEnabled = process.env.USE_REDIS_RATE_LIMIT !== 'false';

    // Check if Redis is configured
    if (!configured || provider === 'none') {
      return NextResponse.json(
        {
          status: 'degraded',
          provider: 'none',
          latency_ms: null,
          feature_flag: featureFlagEnabled,
          message: featureFlagEnabled
            ? 'Redis not configured, using in-memory fallback'
            : 'Redis disabled by feature flag (USE_REDIS_RATE_LIMIT=false)',
          timestamp: new Date().toISOString(),
        },
        { status: 200 } // Still return 200 for degraded state (graceful degradation)
      );
    }

    // Ping Redis to check health
    const latency = await pingRedis();

    if (latency === null) {
      // Redis configured but ping failed
      return NextResponse.json(
        {
          status: 'degraded',
          provider,
          latency_ms: null,
          feature_flag: featureFlagEnabled,
          message: 'Redis ping failed, falling back to in-memory',
          timestamp: new Date().toISOString(),
        },
        { status: 200 } // Graceful degradation, not a hard failure
      );
    }

    // Redis healthy
    return NextResponse.json(
      {
        status: 'healthy',
        provider,
        latency_ms: latency,
        feature_flag: featureFlagEnabled,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Health Check] Redis health check error:', error);

    return NextResponse.json(
      {
        status: 'error',
        provider: 'unknown',
        latency_ms: null,
        feature_flag: process.env.USE_REDIS_RATE_LIMIT !== 'false',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler - not allowed
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use GET to check Redis health.',
    },
    { status: 405 }
  );
}
