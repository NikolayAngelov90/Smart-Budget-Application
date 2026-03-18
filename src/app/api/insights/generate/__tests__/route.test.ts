/**
 * Insights Generate API Unit Tests
 * AC-11.5.4: Critical missing tests
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/insights/generate/route';

// Mock Supabase client
const mockGetUser = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

// Mock insight service
const mockGenerateInsights = jest.fn();
jest.mock('@/lib/services/insightService', () => ({
  generateInsights: (...args: unknown[]) => mockGenerateInsights(...args),
}));

// Mock rate limit service
const mockCheckRateLimit = jest.fn();
jest.mock('@/lib/services/rateLimitService', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

describe('POST /api/insights/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new NextRequest('http://localhost/api/insights/generate', {
      method: 'POST',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('generates insights without rate limit check when forceRegenerate is false', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockGenerateInsights.mockResolvedValueOnce([
      { id: '1', title: 'Insight 1' },
      { id: '2', title: 'Insight 2' },
    ]);

    const request = new NextRequest('http://localhost/api/insights/generate', {
      method: 'POST',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(2);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockGenerateInsights).toHaveBeenCalledWith('user-123', false);
  });

  it('checks rate limit when forceRegenerate is true', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockCheckRateLimit.mockResolvedValueOnce({ exceeded: false });
    mockGenerateInsights.mockResolvedValueOnce([{ id: '1', title: 'Insight 1' }]);

    const request = new NextRequest(
      'http://localhost/api/insights/generate?forceRegenerate=true',
      { method: 'POST' }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockCheckRateLimit).toHaveBeenCalledWith('user-123');
    expect(mockGenerateInsights).toHaveBeenCalledWith('user-123', true);
  });

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockCheckRateLimit.mockResolvedValueOnce({
      exceeded: true,
      remainingSeconds: 180,
    });

    const request = new NextRequest(
      'http://localhost/api/insights/generate?forceRegenerate=true',
      { method: 'POST' }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Rate limit exceeded');
    expect(data.remainingSeconds).toBe(180);
    expect(mockGenerateInsights).not.toHaveBeenCalled();
  });

  it('returns 500 when insight generation fails', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockGenerateInsights.mockRejectedValueOnce(new Error('Generation failed'));

    const request = new NextRequest('http://localhost/api/insights/generate', {
      method: 'POST',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to generate insights');
  });
});

describe('GET /api/insights/generate', () => {
  it('returns 405 Method Not Allowed', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(405);
    expect(data.error).toContain('Method not allowed');
  });
});
