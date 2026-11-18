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
import { createSupabaseMock } from '@/test-utils/supabaseChain';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

/*
 * MIGRATED to `@/test-utils/supabaseChain`. The hand-rolled client copied
 * insert/update payloads and eq args into a side-channel object; the factory
 * records every call, read back with allCallsTo. Its insert and update ALWAYS
 * succeeded whatever the read returned, so user_feature_state's queue is the
 * read, then a plain success for whichever write follows.
 *
 * CONTROL-ARM FILE: featureStateService has no catch at all. Missed by the
 * original census (`const from = jest.fn(`, not `from: jest.fn(`).
 */
type Result = { data: unknown; error: unknown };

function makeClient(selectResult: Result, rpcResult: { error: unknown } = { error: null }) {
  const db = createSupabaseMock({
    tables: { user_feature_state: [selectResult, { data: null, error: null }] },
  });
  (db.client.rpc as jest.Mock).mockResolvedValue({ data: null, ...rpcResult });
  return db;
}

const calls = (db: ReturnType<typeof makeClient>, method: string) =>
  db.allCallsTo('user_feature_state', method);

beforeEach(() => jest.clearAllMocks());

describe('getFeatureState', () => {
  it('returns the row when it exists, user-scoped', async () => {
    const row = {
      transactions_count: 12,
      days_active: 3,
      features_unlocked: ['heatmap'],
      last_active_date: '2026-07-20',
    };
    const db = makeClient({ data: row, error: null });
    mockCreateClient.mockResolvedValue(db.client as never);

    await expect(getFeatureState('u-1')).resolves.toEqual(row);
    expect(calls(db, 'eq')).toContainEqual(['user_id', 'u-1']);
  });

  it('creates the default row on first read (missing row)', async () => {
    const db = makeClient({ data: null, error: null });
    mockCreateClient.mockResolvedValue(db.client as never);

    const state = await getFeatureState('u-1');
    expect(state).toEqual({
      transactions_count: 0,
      days_active: 0,
      features_unlocked: [],
      last_active_date: null,
    });
    expect(calls(db, 'insert')).toEqual([[{ user_id: 'u-1' }]]);
  });

  it('throws a friendly error on a read failure (degradation policy — never empty-as-error)', async () => {
    const db = makeClient({ data: null, error: { message: 'boom' } });
    mockCreateClient.mockResolvedValue(db.client as never);
    await expect(getFeatureState('u-1')).rejects.toThrow('Failed to load feature state');
  });
});

describe('recordFeatureActivity', () => {
  // 15-7 review: the increment/day/date logic now lives in the atomic
  // record_feature_activity RPC (migration 040) — race-free + forward-only
  // date. The service just forwards the day key; the arithmetic is DB-tested.
  it('delegates to the atomic RPC with the day key (no read-modify-write)', async () => {
    const db = makeClient({ data: null, error: null });
    mockCreateClient.mockResolvedValue(db.client as never);

    await recordFeatureActivity('u-1', '2026-07-21');
    expect(db.client.rpc).toHaveBeenLastCalledWith('record_feature_activity', {
      p_today: '2026-07-21',
    });
    // must NOT do the old non-atomic read-then-update
    expect(calls(db, 'update')).toEqual([]);
  });

  it('throws a friendly error when the RPC fails (enrichment caller catches)', async () => {
    const db = makeClient({ data: null, error: null }, { error: { message: 'rpc boom' } });
    mockCreateClient.mockResolvedValue(db.client as never);
    await expect(recordFeatureActivity('u-1', '2026-07-21')).rejects.toThrow(
      'Failed to record feature activity'
    );
  });
});

describe('acknowledgeFeature', () => {
  it('appends a valid key when absent', async () => {
    const db = makeClient({
      data: {
        transactions_count: 40,
        days_active: 5,
        features_unlocked: [],
        last_active_date: '2026-07-21',
      },
      error: null,
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    await expect(acknowledgeFeature('u-1', 'heatmap')).resolves.toEqual(['heatmap']);
    expect(calls(db, 'update')).toEqual([[{ features_unlocked: ['heatmap'] }]]);
  });

  it('is idempotent — no write when already acknowledged', async () => {
    const db = makeClient({
      data: {
        transactions_count: 40,
        days_active: 5,
        features_unlocked: ['heatmap'],
        last_active_date: '2026-07-21',
      },
      error: null,
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    await expect(acknowledgeFeature('u-1', 'heatmap')).resolves.toEqual(['heatmap']);
    expect(calls(db, 'update')).toEqual([]); // no write
  });

  it('rejects an unknown feature key (REST trust boundary, 15-3 lesson)', async () => {
    await expect(acknowledgeFeature('u-1', 'not_a_feature' as never)).rejects.toThrow(
      'Unknown feature key'
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
