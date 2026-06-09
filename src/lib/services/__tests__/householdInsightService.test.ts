/**
 * householdInsightService tests — Story 13.10
 * Mocked Supabase + real engine. RLS/RPC behavior covered by household-insights.rls.test.ts.
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { getHouseholdInsights } from '@/lib/services/householdInsightService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function membershipChain(householdId: string | null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: householdId ? { household_id: householdId } : { preferences: { currency_format: 'EUR' } },
      error: null,
    }),
  };
}

beforeEach(() => jest.clearAllMocks());

it('returns [] when the caller has no household', async () => {
  mockCreateClient.mockResolvedValue({
    from: jest.fn(() => membershipChain(null)),
    rpc: jest.fn(),
  } as never);
  expect(await getHouseholdInsights('u')).toEqual([]);
});

it('generates household insights from current vs previous month totals', async () => {
  const rpc = jest
    .fn()
    .mockResolvedValueOnce({ data: [{ category_id: 'c1', category_name: 'Groceries', total: 200 }], error: null }) // current
    .mockResolvedValueOnce({ data: [{ category_id: 'c1', category_name: 'Groceries', total: 100 }], error: null }); // previous

  mockCreateClient.mockResolvedValue({
    from: jest.fn((t: string) =>
      t === 'household_members' ? membershipChain('h-1') : membershipChain(null) // user_profiles → preferences
    ),
    rpc,
  } as never);

  const insights = await getHouseholdInsights('u', new Date('2026-06-15T12:00:00'));
  expect(insights.length).toBeGreaterThan(0);
  expect(insights.some((i) => i.title.includes('100% more on Groceries'))).toBe(true);
  // Equal-length windows: current MTD (June 1–15) vs previous same span (May 1–15).
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls[0]![1]).toMatchObject({ p_start: '2026-06-01', p_end: '2026-06-16' });
  expect(rpc.mock.calls[1]![1]).toMatchObject({ p_start: '2026-05-01', p_end: '2026-05-16' });
});
