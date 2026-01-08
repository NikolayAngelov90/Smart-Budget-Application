/**
 * Redis Health Check Endpoint Tests
 * Story 9.1: Migrate Rate Limiting to Redis/Upstash
 *
 * Tests health check endpoint for Redis connection monitoring.
 * Coverage: AC-9.1.4
 */

import { GET, POST } from '../route';

// Mock dependencies
jest.mock('@/lib/redis/client');

// Import mocked functions
import { getRedisProvider, isRedisConfigured, pingRedis } from '@/lib/redis/client';

describe('GET /api/health/redis', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.USE_REDIS_RATE_LIMIT;

    // Reset all mocks
    jest.clearAllMocks();

    // Mock console
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;

    // Restore console
    jest.restoreAllMocks();
  });

  describe('Healthy States', () => {
    it('should return healthy status with Upstash provider', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('upstash');
      (isRedisConfigured as jest.Mock).mockReturnValue(true);
      (pingRedis as jest.Mock).mockResolvedValue(15); // 15ms latency

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.provider).toBe('upstash');
      expect(data.latency_ms).toBe(15);
      expect(data.feature_flag).toBe(true);
      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should return healthy status with ioredis provider', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('ioredis');
      (isRedisConfigured as jest.Mock).mockReturnValue(true);
      (pingRedis as jest.Mock).mockResolvedValue(5); // 5ms latency

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.provider).toBe('ioredis');
      expect(data.latency_ms).toBe(5);
      expect(data.feature_flag).toBe(true);
      expect(data.timestamp).toBeDefined();
    });

    it('should respect USE_REDIS_RATE_LIMIT feature flag when enabled', async () => {
      // Setup
      process.env.USE_REDIS_RATE_LIMIT = 'true';
      (getRedisProvider as jest.Mock).mockReturnValue('upstash');
      (isRedisConfigured as jest.Mock).mockReturnValue(true);
      (pingRedis as jest.Mock).mockResolvedValue(12);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data.feature_flag).toBe(true);
    });
  });

  describe('Degraded States (AC-9.1.4)', () => {
    it('should return degraded status when Redis not configured', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(response.status).toBe(200); // Graceful degradation, still 200
      expect(data.status).toBe('degraded');
      expect(data.provider).toBe('none');
      expect(data.latency_ms).toBeNull();
      expect(data.feature_flag).toBe(true);
      expect(data.message).toBe('Redis not configured, using in-memory fallback');
      expect(data.timestamp).toBeDefined();
    });

    it('should return degraded status when feature flag disabled', async () => {
      // Setup
      process.env.USE_REDIS_RATE_LIMIT = 'false';
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(response.status).toBe(200);
      expect(data.status).toBe('degraded');
      expect(data.provider).toBe('none');
      expect(data.latency_ms).toBeNull();
      expect(data.feature_flag).toBe(false);
      expect(data.message).toBe('Redis disabled by feature flag (USE_REDIS_RATE_LIMIT=false)');
      expect(data.timestamp).toBeDefined();
    });

    it('should return degraded status when ping fails', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('upstash');
      (isRedisConfigured as jest.Mock).mockReturnValue(true);
      (pingRedis as jest.Mock).mockResolvedValue(null); // Ping failed

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(response.status).toBe(200); // Graceful degradation
      expect(data.status).toBe('degraded');
      expect(data.provider).toBe('upstash');
      expect(data.latency_ms).toBeNull();
      expect(data.feature_flag).toBe(true);
      expect(data.message).toBe('Redis ping failed, falling back to in-memory');
      expect(data.timestamp).toBeDefined();
    });

    it('should return degraded when provider is none but configured returns false', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(response.status).toBe(200);
      expect(data.status).toBe('degraded');
      expect(data.provider).toBe('none');
    });
  });

  describe('Error States', () => {
    it('should return error status when health check throws exception', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(response.status).toBe(500);
      expect(data.status).toBe('error');
      expect(data.provider).toBe('unknown');
      expect(data.latency_ms).toBeNull();
      expect(data.message).toBe('Health check failed');
      expect(data.error).toBe('Unexpected error');
      expect(data.timestamp).toBeDefined();
      expect(console.error).toHaveBeenCalledWith(
        '[Health Check] Redis health check error:',
        expect.any(Error)
      );
    });

    it('should handle non-Error exceptions gracefully', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockImplementation(() => {
        throw 'String error'; // Non-Error exception
      });

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(response.status).toBe(500);
      expect(data.status).toBe('error');
      expect(data.error).toBe('Unknown error');
    });
  });

  describe('Response Format (AC-9.1.4)', () => {
    it('should include all required fields in healthy response', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('upstash');
      (isRedisConfigured as jest.Mock).mockReturnValue(true);
      (pingRedis as jest.Mock).mockResolvedValue(10);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify all required fields
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('provider');
      expect(data).toHaveProperty('latency_ms');
      expect(data).toHaveProperty('feature_flag');
      expect(data).toHaveProperty('timestamp');
      expect(data).not.toHaveProperty('message'); // No message in healthy state
    });

    it('should include message field in degraded response', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('provider');
      expect(data).toHaveProperty('latency_ms');
      expect(data).toHaveProperty('feature_flag');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('timestamp');
    });

    it('should include error field in error response', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('provider');
      expect(data).toHaveProperty('latency_ms');
      expect(data).toHaveProperty('feature_flag');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('timestamp');
    });

    it('should return valid ISO 8601 timestamp', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('upstash');
      (isRedisConfigured as jest.Mock).mockReturnValue(true);
      (pingRedis as jest.Mock).mockResolvedValue(10);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify timestamp is valid ISO 8601
      const timestamp = new Date(data.timestamp);
      expect(timestamp.toISOString()).toBe(data.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
    });
  });

  describe('Feature Flag Handling', () => {
    it('should default to true when USE_REDIS_RATE_LIMIT not set', async () => {
      // Setup
      delete process.env.USE_REDIS_RATE_LIMIT;
      (getRedisProvider as jest.Mock).mockReturnValue('upstash');
      (isRedisConfigured as jest.Mock).mockReturnValue(true);
      (pingRedis as jest.Mock).mockResolvedValue(10);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data.feature_flag).toBe(true);
    });

    it('should be true when USE_REDIS_RATE_LIMIT=true', async () => {
      // Setup
      process.env.USE_REDIS_RATE_LIMIT = 'true';
      (getRedisProvider as jest.Mock).mockReturnValue('upstash');
      (isRedisConfigured as jest.Mock).mockReturnValue(true);
      (pingRedis as jest.Mock).mockResolvedValue(10);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data.feature_flag).toBe(true);
    });

    it('should be false when USE_REDIS_RATE_LIMIT=false', async () => {
      // Setup
      process.env.USE_REDIS_RATE_LIMIT = 'false';
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data.feature_flag).toBe(false);
    });

    it('should show correct message when feature flag disabled', async () => {
      // Setup
      process.env.USE_REDIS_RATE_LIMIT = 'false';
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data.message).toContain('USE_REDIS_RATE_LIMIT=false');
    });

    it('should show correct message when feature flag enabled but not configured', async () => {
      // Setup
      process.env.USE_REDIS_RATE_LIMIT = 'true';
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data.message).toBe('Redis not configured, using in-memory fallback');
    });
  });

  describe('Latency Reporting', () => {
    it('should report low latency for healthy Upstash connection', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('upstash');
      (isRedisConfigured as jest.Mock).mockReturnValue(true);
      (pingRedis as jest.Mock).mockResolvedValue(8);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data.latency_ms).toBe(8);
      expect(data.latency_ms).toBeLessThan(100); // Good latency
    });

    it('should report low latency for healthy ioredis connection', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('ioredis');
      (isRedisConfigured as jest.Mock).mockReturnValue(true);
      (pingRedis as jest.Mock).mockResolvedValue(3);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data.latency_ms).toBe(3);
      expect(data.latency_ms).toBeLessThan(10); // Very good latency for local Redis
    });

    it('should report null latency when ping fails', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('upstash');
      (isRedisConfigured as jest.Mock).mockReturnValue(true);
      (pingRedis as jest.Mock).mockResolvedValue(null);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data.latency_ms).toBeNull();
    });

    it('should report null latency when not configured', async () => {
      // Setup
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      // Execute
      const response = await GET();
      const data = await response.json();

      // Verify
      expect(data.latency_ms).toBeNull();
    });
  });
});

describe('POST /api/health/redis', () => {
  it('should return 405 Method Not Allowed', async () => {
    // Execute
    const response = await POST();
    const data = await response.json();

    // Verify
    expect(response.status).toBe(405);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Method not allowed. Use GET to check Redis health.');
  });
});

describe('Integration Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle transition from degraded to healthy', async () => {
    // Setup - start degraded
    (getRedisProvider as jest.Mock).mockReturnValue('none');
    (isRedisConfigured as jest.Mock).mockReturnValue(false);

    // Execute first check
    let response = await GET();
    let data = await response.json();

    // Verify degraded
    expect(data.status).toBe('degraded');

    // Simulate Redis becoming available
    (getRedisProvider as jest.Mock).mockReturnValue('upstash');
    (isRedisConfigured as jest.Mock).mockReturnValue(true);
    (pingRedis as jest.Mock).mockResolvedValue(15);

    // Execute second check
    response = await GET();
    data = await response.json();

    // Verify healthy
    expect(data.status).toBe('healthy');
    expect(data.provider).toBe('upstash');
    expect(data.latency_ms).toBe(15);
  });

  it('should handle transition from healthy to degraded (ping failure)', async () => {
    // Setup - start healthy
    (getRedisProvider as jest.Mock).mockReturnValue('upstash');
    (isRedisConfigured as jest.Mock).mockReturnValue(true);
    (pingRedis as jest.Mock).mockResolvedValue(10);

    // Execute first check
    let response = await GET();
    let data = await response.json();

    // Verify healthy
    expect(data.status).toBe('healthy');

    // Simulate ping failure
    (pingRedis as jest.Mock).mockResolvedValue(null);

    // Execute second check
    response = await GET();
    data = await response.json();

    // Verify degraded
    expect(data.status).toBe('degraded');
    expect(data.message).toBe('Redis ping failed, falling back to in-memory');
  });
});
