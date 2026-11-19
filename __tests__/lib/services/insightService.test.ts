/**
 * Integration tests for Insight Orchestration Service
 *
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`, and three things were
 * wrong here besides the hand-rolled chains:
 *
 * 1. A DETECTOR FINDING. The server mock had `createClient` only. Every forced
 *    generation then called `createServiceRoleClient()` -> `undefined()` inside
 *    markGenerated, a best-effort write whose catch logs and continues - so two
 *    passing tests emitted `createServiceRoleClient is not a function` on every
 *    run and nothing saw it. That is a FIFTH shape of the hand-rolled-mock
 *    class: a module mock narrower than the module. No chain selector can see
 *    it; the runtime detector did.
 *
 * 2. "should respect cache and return existing insights" asserted only that
 *    `generateInsights` is DEFINED. Its mock was built and never used. No test
 *    anywhere covered the cache path its name claimed, so it now tests it.
 *
 * 3. "should return true if 10+ transactions since last generation" was also
 *    vacuous (it said so itself). That behaviour IS tested, properly, in
 *    insightService.generationMarker.test.ts ("regenerates once the
 *    10-transaction threshold is crossed"), so this one is renamed to what it
 *    checks and points there.
 */

import { generateInsights, shouldTriggerGeneration } from '@/lib/services/insightService';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import {
  createSupabaseMock,
  type SupabaseMock,
  type SupabaseMockOptions,
} from '@/test-utils/supabaseChain';
import type { Insight } from '@/types/database.types';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockServiceClient = createServiceRoleClient as jest.MockedFunction<
  typeof createServiceRoleClient
>;

/** One factory client for both the user and the service-role path. */
function insightsDb(tables: SupabaseMockOptions['tables'] = {}): SupabaseMock {
  const db = createSupabaseMock({ tables });
  mockCreateClient.mockResolvedValue(db.client);
  mockServiceClient.mockReturnValue(db.client);
  return db;
}

describe('generateInsights', () => {
  const mockUserId = 'test-user-1';
  const mockCategoryId = 'test-category-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty array when no insights can be generated', async () => {
    // No transactions, no categories: every table answers empty.
    insightsDb();

    const result = await generateInsights(mockUserId, true);

    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array when called with force regenerate', async () => {
    insightsDb();

    const result = await generateInsights(mockUserId, true);

    expect(result).toEqual([]);
  });

  it('should respect cache and return existing insights', async () => {
    const mockInsights: Insight[] = [
      {
        id: 'insight-1',
        user_id: mockUserId,
        type: 'spending_increase',
        priority: 4,
        title: 'Dining spending increased 50%',
        description: 'Your Dining spending increased by 50% this month.',
        metadata: {
          category_id: mockCategoryId,
          category_name: 'Dining',
          percent_change: 50,
        },
        is_dismissed: false,
        created_at: new Date().toISOString(),
        view_count: 0,
        first_viewed_at: null,
        last_viewed_at: null,
        dismissed_at: null,
        metadata_expanded_count: 0,
        last_metadata_expanded_at: null,
      },
    ];
    // Generated ten minutes ago: inside the one-hour cache window.
    const db = insightsDb({
      user_profiles: {
        data: { insights_last_generated_at: new Date(Date.now() - 10 * 60_000).toISOString() },
        error: null,
      },
      insights: { data: mockInsights, error: null },
    });

    const result = await generateInsights(mockUserId, false);

    // The stored, non-dismissed insights, for THIS user...
    expect(result).toEqual(mockInsights);
    expect(db.callsTo('insights', 'eq')).toContainEqual(['user_id', mockUserId]);
    expect(db.callsTo('insights', 'eq')).toContainEqual(['is_dismissed', false]);
    // ...and NOTHING REGENERATED. The absence (no transactions read) is paired
    // with the presence above (the insights read), or it would also hold if
    // the function had returned before querying anything.
    expect(db.from).not.toHaveBeenCalledWith('transactions');
  });
});

describe('shouldTriggerGeneration', () => {
  const mockUserId = 'test-user-1';

  beforeEach(() => {
    jest.clearAllMocks();
    // No `jest.resetModules()` any more. It existed to clear the module-level
    // generation Map, and hp-8 removed that Map — the marker lives in the
    // database now. Worse, it was actively harmful here: re-requiring the
    // service after a reset hands it a FRESH mock of '@/lib/supabase/server',
    // so the mockResolvedValue configured on the imported reference no longer
    // applies and `createClient()` resolves undefined.
  });

  it('should return true when never generated before', async () => {
    // hp-8: "never generated" is no longer an empty in-memory Map — it is a NULL
    // `user_profiles.insights_last_generated_at`.
    insightsDb({ user_profiles: { data: { insights_last_generated_at: null }, error: null } });

    const result = await shouldTriggerGeneration(mockUserId);

    expect(result).toBe(true);
  });

  it('is exported (the 10-transaction threshold is tested in insightService.generationMarker.test.ts)', () => {
    // Renamed from "should return true if 10+ transactions since last
    // generation", which this never checked. The real test of that behaviour:
    // generationMarker.test.ts, "regenerates once the 10-transaction threshold
    // is crossed".
    expect(shouldTriggerGeneration).toBeDefined();
  });
});
