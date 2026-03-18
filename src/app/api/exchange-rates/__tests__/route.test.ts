/**
 * Exchange Rates API Unit Tests
 * AC-11.5.4: Critical missing tests
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/exchange-rates/route';

// Mock Supabase client
const mockGetUser = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

// Mock exchange rate service
const mockGetExchangeRates = jest.fn();
jest.mock('@/lib/services/exchangeRateService', () => ({
  getExchangeRates: (...args: unknown[]) => mockGetExchangeRates(...args),
}));

describe('GET /api/exchange-rates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new NextRequest('http://localhost/api/exchange-rates?base=EUR');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns exchange rates for valid base currency', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockRates = {
      base: 'EUR',
      rates: { USD: 1.08, GBP: 0.86 },
      timestamp: '2026-03-18T00:00:00Z',
    };
    mockGetExchangeRates.mockResolvedValueOnce(mockRates);

    const request = new NextRequest('http://localhost/api/exchange-rates?base=EUR');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.base).toBe('EUR');
    expect(data.rates.USD).toBe(1.08);
    expect(mockGetExchangeRates).toHaveBeenCalledWith('EUR');
  });

  it('defaults to EUR when no base param provided', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockGetExchangeRates.mockResolvedValueOnce({ base: 'EUR', rates: {} });

    const request = new NextRequest('http://localhost/api/exchange-rates');
    await GET(request);

    expect(mockGetExchangeRates).toHaveBeenCalledWith('EUR');
  });

  it('returns 400 for invalid base currency', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/exchange-rates?base=XYZ');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid base currency');
  });

  it('converts base param to uppercase', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockGetExchangeRates.mockResolvedValueOnce({ base: 'USD', rates: {} });

    const request = new NextRequest('http://localhost/api/exchange-rates?base=usd');
    await GET(request);

    expect(mockGetExchangeRates).toHaveBeenCalledWith('USD');
  });

  it('returns 500 when service throws', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockGetExchangeRates.mockRejectedValueOnce(new Error('Service down'));

    const request = new NextRequest('http://localhost/api/exchange-rates?base=EUR');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch exchange rates');
  });
});
