/**
 * householdInsightService tests — Story 13.10
 * Mocked Supabase + real engine. RLS/RPC behavior covered by household-insights.rls.test.ts.
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { createClient } from '@/lib/supabase/server';
import { getHouseholdInsights } from '@/lib/services/householdInsightService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

/*
 * MIGRATED to `@/test-utils/supabaseChain`. The hand-rolled `membershipChain`
 * was overloaded: passing `null` returned a `{ preferences }` row, so the same
 * helper served household_members ("no household") and user_profiles
 * (currency) depending on which table asked. The factory configures each table
 * by name instead.
 *
 * CONTROL-ARM FILE: householdInsightService has no swallowing catch.
 */
beforeEach(() => jest.clearAllMocks());

it('returns [] when the caller has no household', async () => {
  // FIXTURE PRESERVED EXACTLY, and worth a note. "No household" is modelled as
  // a household_members ROW that has no household_id - not as a missing row.
  // Both reach the service's `return []`, but the realistic case, a null row, is
  // the one this test never exercises. Left for the assertion pass rather than
  // changed mid-migration, so this file's before/after is a pure mock swap.
  const db = createSupabaseMock({
    tables: {
      household_members: { data: { preferences: { currency_format: 'EUR' } }, error: null },
    },
  });
  mockCreateClient.mockResolvedValue(db.client as never);
  expect(await getHouseholdInsights('u')).toEqual([]);
});

it('generates household insights from current vs previous month totals', async () => {
  const db = createSupabaseMock({
    tables: {
      household_members: { data: { household_id: 'h-1' }, error: null },
      user_profiles: { data: { preferences: { currency_format: 'EUR' } }, error: null },
    },
  });
  // The factory's client carries `rpc` precisely so it can be overridden per
  // test; a fresh mock per test means these ...Once values cannot leak.
  const rpc = db.client.rpc as jest.Mock;
  rpc
    .mockResolvedValueOnce({
      data: [{ category_id: 'c1', category_name: 'Groceries', total: 200 }],
      error: null,
    }) // current
    .mockResolvedValueOnce({
      data: [{ category_id: 'c1', category_name: 'Groceries', total: 100 }],
      error: null,
    }); // previous

  mockCreateClient.mockResolvedValue(db.client as never);

  const insights = await getHouseholdInsights('u', new Date('2026-06-15T12:00:00'));
  expect(insights.length).toBeGreaterThan(0);
  expect(insights.some((i) => i.title.includes('100% more on Groceries'))).toBe(true);
  // Equal-length windows: current MTD (June 1–15) vs previous same span (May 1–15).
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls[0]![1]).toMatchObject({ p_start: '2026-06-01', p_end: '2026-06-16' });
  expect(rpc.mock.calls[1]![1]).toMatchObject({ p_start: '2026-05-01', p_end: '2026-05-16' });
});
