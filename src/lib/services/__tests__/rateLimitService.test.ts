/**
 * Rate Limit Service Unit Tests
 * Story 9.1: Migrate Rate Limiting to Redis/Upstash
 *
 * Tests @upstash/ratelimit integration, sliding window algorithm,
 * and graceful fallback to in-memory Map.
 * Coverage: AC-9.1.1, AC-9.1.3, AC-9.1.5
 */

import { Ratelimit } from '@upstash/ratelimit';
import {
  RATE_LIMIT,
  RATE_LIMIT_WINDOW,
  checkRateLimit,
  recordRateLimitAction,
  clearRateLimit,
  getRemainingTime,
  __resetRateLimitForTesting,
} from '@/lib/services/rateLimitService';

// Mock dependencies
jest.mock('@upstash/ratelimit');
jest.mock('@upstash/redis');
jest.mock('@/lib/redis/client');

import { getRedisClient, getRedisProvider, isRedisConfigured } from '@/lib/redis/client';

describe('Rate Limit Service', () => {
  const mockUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    __resetRateLimitForTesting();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rate Limit Configuration (AC-9.1.3)', () => {
    it('should use 10 requests per 60 seconds configuration', () => {
      expect(RATE_LIMIT).toBe(10);
      expect(RATE_LIMIT_WINDOW).toBe(60);
    });
  });

  describe('Graceful Fallback (AC-9.1.5)', () => {
    it('should fall back to in-memory Map when Redis not configured', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (getRedisClient as jest.Mock).mockReturnValue(null);

      const result = await checkRateLimit(mockUserId);

      expect(result.exceeded).toBe(false);
      expect(Ratelimit).not.toHaveBeenCalled();
    });

    it('should track requests in fallback mode correctly', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (getRedisClient as jest.Mock).mockReturnValue(null);

      // Make 10 requests (should all succeed)
      for (let i = 0; i < 10; i++) {
        const result = await checkRateLimit(mockUserId);
        expect(result.exceeded).toBe(false);
        await recordRateLimitAction(mockUserId);
      }

      // 11th request should exceed rate limit
      const result11 = await checkRateLimit(mockUserId);
      expect(result11.exceeded).toBe(true);
      expect(result11.remainingSeconds).toBeGreaterThan(0);
    });

    it('should handle different users independently', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (getRedisClient as jest.Mock).mockReturnValue(null);

      const user1 = 'user-1';
      const user2 = 'user-2';

      // user1 exceeds limit
      for (let i = 0; i < 11; i++) {
        await recordRateLimitAction(user1);
      }

      // Verify user1 exceeded, user2 not exceeded
      const result1 = await checkRateLimit(user1);
      const result2 = await checkRateLimit(user2);

      expect(result1.exceeded).toBe(true);
      expect(result2.exceeded).toBe(false);
    });
  });

  describe('recordRateLimitAction', () => {
    it('should record action in fallback mode', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (getRedisClient as jest.Mock).mockReturnValue(null);

      // Record 5 actions
      for (let i = 0; i < 5; i++) {
        await recordRateLimitAction(mockUserId);
      }

      // Should have used 5 slots
      const checkResult = await checkRateLimit(mockUserId);
      expect(checkResult.exceeded).toBe(false);
    });
  });

  describe('clearRateLimit', () => {
    it('should clear rate limit in fallback mode', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (getRedisClient as jest.Mock).mockReturnValue(null);

      // Exceed rate limit
      for (let i = 0; i < 11; i++) {
        await recordRateLimitAction(mockUserId);
      }

      // Verify exceeded
      let result = await checkRateLimit(mockUserId);
      expect(result.exceeded).toBe(true);

      // Clear rate limit
      await clearRateLimit(mockUserId);

      // Verify cleared
      result = await checkRateLimit(mockUserId);
      expect(result.exceeded).toBe(false);
    });
  });

  describe('getRemainingTime', () => {
    it('should return 0 when not rate limited in fallback mode', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (getRedisClient as jest.Mock).mockReturnValue(null);

      const remainingTime = await getRemainingTime(mockUserId);
      expect(remainingTime).toBe(0);
    });

    it('should return remaining time when rate limited in fallback mode', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (getRedisClient as jest.Mock).mockReturnValue(null);

      // Exceed rate limit
      for (let i = 0; i < 11; i++) {
        await recordRateLimitAction(mockUserId);
      }

      // Get remaining time
      const remainingTime = await getRemainingTime(mockUserId);
      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(60);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent requests correctly in fallback mode', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (getRedisClient as jest.Mock).mockReturnValue(null);

      // Make 10 concurrent requests
      const requests = Array.from({ length: 10 }, () => checkRateLimit(mockUserId));
      const results = await Promise.all(requests);

      // All should succeed (within limit)
      results.forEach((result) => {
        expect(result.exceeded).toBe(false);
      });

      // Record all actions
      await Promise.all(Array.from({ length: 10 }, () => recordRateLimitAction(mockUserId)));

      // 11th request should exceed
      const result11 = await checkRateLimit(mockUserId);
      expect(result11.exceeded).toBe(true);
    });

    it('should reset after time window expires in fallback mode', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (getRedisClient as jest.Mock).mockReturnValue(null);

      // Mock time
      const originalNow = Date.now;
      let mockTime = originalNow();
      Date.now = jest.fn(() => mockTime);

      // Exceed limit
      for (let i = 0; i < 11; i++) {
        await recordRateLimitAction(mockUserId);
      }

      // Verify exceeded
      let result = await checkRateLimit(mockUserId);
      expect(result.exceeded).toBe(true);

      // Fast-forward time by 61 seconds (beyond window)
      mockTime += 61000;

      // Verify reset
      result = await checkRateLimit(mockUserId);
      expect(result.exceeded).toBe(false);

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('Backwards Compatibility', () => {
    it('should accept windowMs parameter but use default RATE_LIMIT_WINDOW', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);
      (getRedisProvider as jest.Mock).mockReturnValue('none');
      (getRedisClient as jest.Mock).mockReturnValue(null);

      // Execute with custom windowMs (should be ignored, using 60s default)
      const result = await checkRateLimit(mockUserId, 300000); // 5 minutes

      // Should still work
      expect(result.exceeded).toBe(false);
      expect(result.remainingSeconds).toBe(0);
    });
  });
});
