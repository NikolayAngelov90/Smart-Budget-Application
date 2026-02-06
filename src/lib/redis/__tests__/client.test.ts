/**
 * Redis Client Unit Tests
 * Story 9.1: Migrate Rate Limiting to Redis/Upstash
 *
 * Tests multi-provider Redis support, feature flags, and health checks.
 * Coverage: AC-9.1.2, AC-9.1.7, AC-9.1.8
 */

import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';
import {
  getRedisClient,
  getRedisProvider,
  isRedisConfigured,
  pingRedis,
  __resetRedisForTesting,
} from '@/lib/redis/client';

// Mock dependencies
jest.mock('@upstash/redis');
jest.mock('ioredis');

describe('Redis Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.REDIS_URL;
    delete process.env.USE_REDIS_RATE_LIMIT;

    // Clear mocks
    jest.clearAllMocks();

    // Reset Redis state
    __resetRedisForTesting();

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;

    // Restore console
    jest.restoreAllMocks();
  });

  describe('Multi-Provider Support (AC-9.1.2)', () => {
    it('should use Upstash when configured', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const mockClient = { ping: jest.fn() };
      (UpstashRedis as unknown as jest.Mock).mockImplementation(() => mockClient);
      __resetRedisForTesting();

      const provider = getRedisProvider();
      expect(provider).toBe('upstash');
    });

    it('should use ioredis when REDIS_URL is configured (AC-9.1.7)', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      const mockClient = { ping: jest.fn() };
      (IORedis as unknown as jest.Mock).mockImplementation(() => mockClient);
      __resetRedisForTesting();

      const provider = getRedisProvider();
      expect(provider).toBe('ioredis');
    });

    it('should prioritize Upstash over ioredis', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const mockClient = { ping: jest.fn() };
      (UpstashRedis as unknown as jest.Mock).mockImplementation(() => mockClient);
      __resetRedisForTesting();

      const provider = getRedisProvider();
      expect(provider).toBe('upstash');
    });

    it('should return none when not configured', () => {
      const provider = getRedisProvider();
      expect(provider).toBe('none');
    });
  });

  describe('Feature Flag (AC-9.1.8)', () => {
    it('should disable Redis when USE_REDIS_RATE_LIMIT=false', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
      process.env.USE_REDIS_RATE_LIMIT = 'false';
      __resetRedisForTesting();

      const provider = getRedisProvider();
      expect(provider).toBe('none');
    });

    it('should enable Redis by default', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const mockClient = { ping: jest.fn() };
      (UpstashRedis as unknown as jest.Mock).mockImplementation(() => mockClient);
      __resetRedisForTesting();

      const provider = getRedisProvider();
      expect(provider).toBe('upstash');
    });
  });

  describe('getRedisClient', () => {
    it('should return null when not configured', () => {
      const client = getRedisClient();
      expect(client).toBeNull();
    });

    it('should return client when configured', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const mockClient = { ping: jest.fn() };
      (UpstashRedis as unknown as jest.Mock).mockImplementation(() => mockClient);
      __resetRedisForTesting();

      const client = getRedisClient();
      expect(client).toBeTruthy();
    });
  });

  describe('isRedisConfigured', () => {
    it('should return false when not configured', () => {
      expect(isRedisConfigured()).toBe(false);
    });

    it('should return true when Upstash is configured', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const mockClient = { ping: jest.fn() };
      (UpstashRedis as unknown as jest.Mock).mockImplementation(() => mockClient);
      __resetRedisForTesting();

      expect(isRedisConfigured()).toBe(true);
    });

    it('should return false when feature flag disabled', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
      process.env.USE_REDIS_RATE_LIMIT = 'false';
      __resetRedisForTesting();

      expect(isRedisConfigured()).toBe(false);
    });
  });

  describe('pingRedis', () => {
    it('should return null when not configured', async () => {
      const latency = await pingRedis();
      expect(latency).toBeNull();
    });

    it('should return latency when successful', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const mockPing = jest.fn().mockResolvedValue('PONG');
      const mockClient = { ping: mockPing };
      (UpstashRedis as unknown as jest.Mock).mockImplementation(() => mockClient);
      __resetRedisForTesting();

      const latency = await pingRedis();
      expect(latency).toBeGreaterThanOrEqual(0);
      expect(latency).toBeLessThan(1000);
    });

    it('should return null when ping fails', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const mockPing = jest.fn().mockRejectedValue(new Error('Connection failed'));
      const mockClient = { ping: mockPing };
      (UpstashRedis as unknown as jest.Mock).mockImplementation(() => mockClient);
      __resetRedisForTesting();

      const latency = await pingRedis();
      expect(latency).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
