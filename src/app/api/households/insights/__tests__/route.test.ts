/**
 * /api/households/insights GET — Story 13.10
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/services/householdInsightService', () => ({ getHouseholdInsights: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { getHouseholdInsights } from '@/lib/services/householdInsightService';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockInsights = getHouseholdInsights as jest.MockedFunction<typeof getHouseholdInsights>;

function authClient(user: object | null) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no' } }) } };
}

beforeEach(() => jest.clearAllMocks());

it('401 when unauthenticated', async () => {
  mockCreateClient.mockResolvedValue(authClient(null) as never);
  expect((await GET()).status).toBe(401);
});

it('returns the insights list', async () => {
  mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
  mockInsights.mockResolvedValue([
    { type: 'household_spend_change', title: 'T', description: 'D', metadata: {} },
  ]);
  const res = await GET();
  expect(res.status).toBe(200);
  expect((await res.json()).data).toHaveLength(1);
  expect(mockInsights).toHaveBeenCalledWith('u');
});
