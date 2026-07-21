/**
 * featureStateService tests — Story 15.7
 * Auth-scoped (owner-only RLS is the prod gate). Chain mocks assert
 * user-scoping (.eq('user_id', …)) so it can't silently vanish (14-4 lesson).
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import {
  getFeatureState,
  recordFeatureActivity,
  acknowledgeFeature,
} from '@/lib/services/featureStateService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

/**
 * Builds a mock Supabase client. `selectResult` feeds the select().eq().maybeSingle()
 * read; captures the insert/update payloads + the eq filter args.
 */
function makeClient(
  selectResult: { data: unknown; error: unknown },
  rpcResult: { error: unknown } = { error: null }
) {
  const captured: { insert?: unknown; update?: unknown; eqArgs: unknown[][]; rpc?: [string, unknown] } = { eqArgs: [] };

  const selectChain: Record<string, jest.Mock> = {
    maybeSingle: jest.fn().mockResolvedValue(selectResult),
  };
  selectChain.select = jest.fn(() => selectChain);
  selectChain.eq = jest.fn((...args: unknown[]) => {
    captured.eqArgs.push(args);
    return selectChain;
  });

  const from = jest.fn(() => ({
    select: selectChain.select,
    eq: selectChain.eq,
    maybeSingle: selectChain.maybeSingle,
    insert: jest.fn((payload: unknown) => {
      captured.insert = payload;
      return Promise.resolve({ error: null });
    }),
    update: jest.fn((payload: unknown) => {
      captured.update = payload;
      return {
        eq: jest.fn((...args: unknown[]) => {
          captured.eqArgs.push(args);
          return Promise.resolve({ error: null });
        }),
      };
    }),
  }));

  const rpc = jest.fn((name: string, params: unknown) => {
    captured.rpc = [name, params];
    return Promise.resolve(rpcResult);
  });

  return { client: { from, rpc }, captured };
}

beforeEach(() => jest.clearAllMocks());

describe('getFeatureState', () => {
  it('returns the row when it exists, user-scoped', async () => {
    const row = {
      transactions_count: 12,
      days_active: 3,
      features_unlocked: ['heatmap'],
      last_active_date: '2026-07-20',
    };
    const { client, captured } = makeClient({ data: row, error: null });
    mockCreateClient.mockResolvedValue(client as never);

    await expect(getFeatureState('u-1')).resolves.toEqual(row);
    expect(captured.eqArgs).toContainEqual(['user_id', 'u-1']);
  });

  it('creates the default row on first read (missing row)', async () => {
    const { client, captured } = makeClient({ data: null, error: null });
    mockCreateClient.mockResolvedValue(client as never);

    const state = await getFeatureState('u-1');
    expect(state).toEqual({
      transactions_count: 0,
      days_active: 0,
      features_unlocked: [],
      last_active_date: null,
    });
    expect(captured.insert).toEqual({ user_id: 'u-1' });
  });

  it('throws a friendly error on a read failure (degradation policy — never empty-as-error)', async () => {
    const { client } = makeClient({ data: null, error: { message: 'boom' } });
    mockCreateClient.mockResolvedValue(client as never);
    await expect(getFeatureState('u-1')).rejects.toThrow('Failed to load feature state');
  });
});

describe('recordFeatureActivity', () => {
  // 15-7 review: the increment/day/date logic now lives in the atomic
  // record_feature_activity RPC (migration 040) — race-free + forward-only
  // date. The service just forwards the day key; the arithmetic is DB-tested.
  it('delegates to the atomic RPC with the day key (no read-modify-write)', async () => {
    const { client, captured } = makeClient({ data: null, error: null });
    mockCreateClient.mockResolvedValue(client as never);

    await recordFeatureActivity('u-1', '2026-07-21');
    expect(captured.rpc).toEqual(['record_feature_activity', { p_today: '2026-07-21' }]);
    // must NOT do the old non-atomic read-then-update
    expect(captured.update).toBeUndefined();
  });

  it('throws a friendly error when the RPC fails (enrichment caller catches)', async () => {
    const { client } = makeClient({ data: null, error: null }, { error: { message: 'rpc boom' } });
    mockCreateClient.mockResolvedValue(client as never);
    await expect(recordFeatureActivity('u-1', '2026-07-21')).rejects.toThrow(
      'Failed to record feature activity'
    );
  });
});

describe('acknowledgeFeature', () => {
  it('appends a valid key when absent', async () => {
    const { client, captured } = makeClient({
      data: { transactions_count: 40, days_active: 5, features_unlocked: [], last_active_date: '2026-07-21' },
      error: null,
    });
    mockCreateClient.mockResolvedValue(client as never);

    await expect(acknowledgeFeature('u-1', 'heatmap')).resolves.toEqual(['heatmap']);
    expect(captured.update).toEqual({ features_unlocked: ['heatmap'] });
  });

  it('is idempotent — no write when already acknowledged', async () => {
    const { client, captured } = makeClient({
      data: { transactions_count: 40, days_active: 5, features_unlocked: ['heatmap'], last_active_date: '2026-07-21' },
      error: null,
    });
    mockCreateClient.mockResolvedValue(client as never);

    await expect(acknowledgeFeature('u-1', 'heatmap')).resolves.toEqual(['heatmap']);
    expect(captured.update).toBeUndefined(); // no write
  });

  it('rejects an unknown feature key (REST trust boundary, 15-3 lesson)', async () => {
    await expect(acknowledgeFeature('u-1', 'not_a_feature' as never)).rejects.toThrow('Unknown feature key');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
