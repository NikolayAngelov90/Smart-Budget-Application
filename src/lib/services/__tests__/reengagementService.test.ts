/**
 * Re-engagement Service Tests — Story 12.6 / FR8
 */

const mockBuild = jest.fn();
jest.mock('@/lib/ai/reengagementAnalysis', () => ({
  buildReengagementSummary: (...args: unknown[]) => mockBuild(...args),
}));

jest.mock('@/lib/utils/date', () => ({
  toLocalISODate: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
}));

import { getReengagementSummary } from '../reengagementService';

const TODAY = new Date('2026-06-15T12:00:00');

const SUMMARY = {
  lapsed_days: 30,
  last_active_date: '2026-05-16',
  typical_monthly_spend: 300,
  active_subscription_count: 0,
  active_subscription_monthly_total: 0,
  goals: [],
  recommended_action: 'Log your latest expenses to refresh your insights.',
};

/** Chainable Supabase mock routed by table + terminal. */
function makeSupabase(opts: { lastTxRow?: object | null }) {
  const { lastTxRow = null } = opts;

  function builder(table: string) {
    const chain: Record<string, jest.Mock> & { then?: unknown } = {};
    ['select', 'eq', 'order', 'limit', 'gte', 'in'].forEach((m) => {
      chain[m] = jest.fn(() => chain);
    });
    chain.maybeSingle = jest.fn(() => Promise.resolve({ data: lastTxRow, error: null }));
    (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => {
      // awaited list queries resolve to empty data (engine is mocked)
      return Promise.resolve(resolve({ data: [], error: null }));
    };
    void table;
    return chain;
  }

  return { from: jest.fn((t: string) => builder(t)) };
}

describe('getReengagementSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuild.mockReturnValue(SUMMARY);
  });

  it('returns null for a brand-new user (no transactions)', async () => {
    const supabase = makeSupabase({ lastTxRow: null });
    const result = await getReengagementSummary(supabase as never, 'u1', null, TODAY);
    expect(result).toBeNull();
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it('returns null when the user logged within the last 14 days', async () => {
    const supabase = makeSupabase({ lastTxRow: { created_at: '2026-06-10T00:00:00Z' } }); // 5 days ago
    const result = await getReengagementSummary(supabase as never, 'u1', null, TODAY);
    expect(result).toBeNull();
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it('returns null when already dismissed for the current lapse', async () => {
    const supabase = makeSupabase({ lastTxRow: { created_at: '2026-05-01T00:00:00Z' } }); // 45 days ago
    const prefs = { reengagement_dismissed_at: '2026-06-01T00:00:00Z' }; // after last activity
    const result = await getReengagementSummary(supabase as never, 'u1', prefs, TODAY);
    expect(result).toBeNull();
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it('returns the summary when lapsed >= 14 days and not dismissed', async () => {
    const supabase = makeSupabase({ lastTxRow: { created_at: '2026-05-01T00:00:00Z' } });
    const result = await getReengagementSummary(supabase as never, 'u1', null, TODAY);
    expect(result).toEqual(SUMMARY);
    expect(mockBuild).toHaveBeenCalled();
  });

  it('shows again after a new lapse even if dismissed earlier (dismissed < lastActivity)', async () => {
    const supabase = makeSupabase({ lastTxRow: { created_at: '2026-05-20T00:00:00Z' } }); // 26 days ago
    const prefs = { reengagement_dismissed_at: '2026-04-01T00:00:00Z' }; // before last activity
    const result = await getReengagementSummary(supabase as never, 'u1', prefs, TODAY);
    expect(result).toEqual(SUMMARY);
  });
});
