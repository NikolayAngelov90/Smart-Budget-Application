/**
 * contributionService tests — Story 13.7
 * Mocked Supabase. Real RLS + RPC behavior is covered by contributions.rls.test.ts.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { setContribution, getContributionSummary } from '@/lib/services/contributionService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockServiceClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;

function membershipClient(householdId: string | null) {
  return {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: householdId ? { household_id: householdId } : null,
        error: null,
      }),
    })),
    rpc: jest.fn(),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('setContribution', () => {
  it('rejects an out-of-range percentage without touching the DB', async () => {
    await expect(setContribution('u', 150)).rejects.toThrow(/between 0 and 100/);
    await expect(setContribution('u', -1)).rejects.toThrow(/between 0 and 100/);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('throws NotHouseholdMemberError when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue(membershipClient(null) as never);
    await expect(setContribution('u', 50)).rejects.toBeInstanceOf(NotHouseholdMemberError);
  });

  it('writes the caller’s OWN row via service-role and returns the percentage', async () => {
    mockCreateClient.mockResolvedValue(membershipClient('h-1') as never);
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq }));
    mockServiceClient.mockReturnValue({ from: jest.fn(() => ({ update })) } as never);

    const result = await setContribution('user-1', 60);
    expect(result).toBe(60);
    expect(update).toHaveBeenCalledWith({ contribution_percentage: 60 });
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1'); // own row only
  });
});

describe('getContributionSummary', () => {
  function summaryClient(rows: unknown[]) {
    return {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { household_id: 'h-1' }, error: null }),
      })),
      rpc: jest.fn().mockResolvedValue({ data: rows, error: null }),
    };
  }

  it('returns empty summary when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue(membershipClient(null) as never);
    expect(await getContributionSummary('u')).toEqual({ total: 0, splits: [] });
  });

  it('computes normalized fair shares + progress', async () => {
    mockCreateClient.mockResolvedValue(
      summaryClient([
        { user_id: 'user-1', email: 'a@x.test', contribution_percentage: 60, contributed: 100 },
        { user_id: 'user-2', email: 'b@x.test', contribution_percentage: 40, contributed: 50 },
      ]) as never
    );
    const summary = await getContributionSummary('user-1');
    expect(summary.total).toBe(150);
    const a = summary.splits.find((s) => s.user_id === 'user-1')!;
    const b = summary.splits.find((s) => s.user_id === 'user-2')!;
    expect(a.fairShare).toBeCloseTo(90); // 60/100 * 150
    expect(b.fairShare).toBeCloseTo(60); // 40/100 * 150
    expect(a.progress).toBeCloseTo(100 / 90);
    expect(a.isSelf).toBe(true);
    expect(b.isSelf).toBe(false);
  });

  it('falls back to an equal split when no percentages are set', async () => {
    mockCreateClient.mockResolvedValue(
      summaryClient([
        { user_id: 'user-1', email: 'a@x.test', contribution_percentage: null, contributed: 80 },
        { user_id: 'user-2', email: 'b@x.test', contribution_percentage: null, contributed: 0 },
      ]) as never
    );
    const summary = await getContributionSummary('user-1');
    expect(summary.total).toBe(80);
    expect(summary.splits[0]!.fairShare).toBe(40); // 80 / 2
    expect(summary.splits[1]!.fairShare).toBe(40);
  });
});
