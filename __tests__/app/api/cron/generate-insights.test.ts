/**
 * Tests for Cron Job Endpoint - Generate Insights
 *
 * Story 6.5: Insight Generation Scheduling and Manual Refresh
 * AC2: Scheduled Job - Daily at midnight UTC, checks for new month
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/generate-insights/route';

// Tests for POST /api/cron/generate-insights
describe('POST /api/cron/generate-insights', () => {
  const MOCK_CRON_SECRET = 'test-cron-secret';

  beforeEach(() => {
    // Set environment variable
    process.env.CRON_SECRET = MOCK_CRON_SECRET;
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  describe('Authentication', () => {
    it('should return 401 if no authorization header provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 if incorrect secret provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: 'Bearer wrong-secret',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should accept valid cron secret', async () => {
      // Mock date to NOT be 1st of month to skip processing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15'));

      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: `Bearer ${MOCK_CRON_SECRET}`,
        },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);

      jest.useRealTimers();
    });
  });

  describe('New Month Detection', () => {
    it('should skip processing if NOT 1st of month', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15')); // 15th of month

      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: `Bearer ${MOCK_CRON_SECRET}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.skipped).toBe(true);
      expect(data.reason).toContain('Not start of month');
      expect(data.usersProcessed).toBe(0);

      jest.useRealTimers();
    });

    it('should process users if 1st of month', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-01')); // 1st of month

      // Mock Supabase and service will be needed here
      // This is a more complex integration test

      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: `Bearer ${MOCK_CRON_SECRET}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.skipped).toBe(false);
      // Additional assertions would verify user processing

      jest.useRealTimers();
    });
  });

  describe('Batch Processing', () => {
    it('should handle empty user list gracefully', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-01'));

      // Mock returning no users
      const { createClient } = require('@/lib/supabase/server');
      const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockSelect = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      createClient.mockResolvedValue({
        from: mockFrom,
      });

      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: `Bearer ${MOCK_CRON_SECRET}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.usersProcessed).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-01'));

      // Mock database error
      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue({
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database connection failed'),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: `Bearer ${MOCK_CRON_SECRET}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);

      jest.useRealTimers();
    });
  });
});
