/**
 * Recovery Plan Service Tests — Story 12.4 / FR4
 */

const mockBuildTargets = jest.fn();
jest.mock('@/lib/ai/recoveryPlanner', () => ({
  buildRecoveryPlanTargets: (...args: unknown[]) => mockBuildTargets(...args),
}));

jest.mock('@/lib/utils/date', () => ({
  toLocalISODate: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
}));

import {
  getActivePlanWithProgress,
  generatePlan,
  updatePlanStatus,
} from '../recoveryPlanService';
import type { RecoveryTarget } from '@/types/database.types';

const TODAY = new Date('2026-06-15T12:00:00');

const SAMPLE_TARGET: RecoveryTarget = {
  category_id: 'cat-d',
  category_name: 'Dining',
  category_color: '#abc',
  historical_avg: 300,
  historical_min: 200,
  monthly_target: 200,
  weekly_target: 47,
  daily_target: 7,
  current_spend: 0,
};

/**
 * Builds a chainable Supabase mock. Terminal results are routed by table +
 * terminal method so the service's varied query shapes all resolve correctly.
 */
function makeSupabase(opts: {
  activePlanRow?: object | null;
  insertedRow?: object;
  progressTx?: object[];
}) {
  const { activePlanRow = null, insertedRow, progressTx = [] } = opts;

  const updateCalls: Array<{ table: string; payload: object }> = [];

  function builderFor(table: string) {
    const builder: Record<string, jest.Mock> & { then?: unknown } = {};
    const chain = ['select', 'eq', 'gte', 'lte', 'lt', 'order', 'limit'];
    chain.forEach((m) => {
      builder[m] = jest.fn(() => builder);
    });
    builder.update = jest.fn((payload: object) => {
      updateCalls.push({ table, payload });
      return builder;
    });
    builder.insert = jest.fn(() => builder);
    builder.maybeSingle = jest.fn(() =>
      Promise.resolve({ data: activePlanRow, error: null })
    );
    builder.single = jest.fn(() =>
      Promise.resolve({ data: insertedRow, error: null })
    );
    // Thenable: awaited query chains (transactions/categories reads + update writes)
    (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) => {
      let data: unknown = [];
      if (table === 'transactions') data = progressTx;
      if (table === 'categories') data = [];
      if (table === 'recovery_plans') data = null; // update write
      return Promise.resolve(resolve({ data, error: null }));
    };
    return builder;
  }

  return {
    from: jest.fn((table: string) => builderFor(table)),
    _updateCalls: updateCalls,
  };
}

describe('recoveryPlanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildTargets.mockReturnValue([]);
  });

  describe('getActivePlanWithProgress', () => {
    it('returns null plan + canGenerate=false when no active plan and no overspend', async () => {
      mockBuildTargets.mockReturnValue([]);
      const supabase = makeSupabase({ activePlanRow: null });
      const result = await getActivePlanWithProgress(supabase as never, 'u1', TODAY);
      expect(result.plan).toBeNull();
      expect(result.canGenerate).toBe(false);
    });

    it('returns canGenerate=true when overspent categories exist', async () => {
      mockBuildTargets.mockReturnValue([SAMPLE_TARGET]);
      const supabase = makeSupabase({ activePlanRow: null });
      const result = await getActivePlanWithProgress(supabase as never, 'u1', TODAY);
      expect(result.canGenerate).toBe(true);
      expect(result.plan).toBeNull();
    });

    it('auto-completes and clears a plan whose end date has passed (AC5)', async () => {
      const expiredPlan = {
        id: 'plan-old',
        user_id: 'u1',
        start_date: '2026-04-01',
        end_date: '2026-05-01', // before today 2026-06-15
        status: 'active',
        targets: [SAMPLE_TARGET],
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
      };
      mockBuildTargets.mockReturnValue([]);
      const supabase = makeSupabase({ activePlanRow: expiredPlan });
      const result = await getActivePlanWithProgress(supabase as never, 'u1', TODAY);
      expect(result.plan).toBeNull();
      expect(
        supabase._updateCalls.some(
          (c) => c.table === 'recovery_plans' && (c.payload as { status?: string }).status === 'completed'
        )
      ).toBe(true);
    });

    it('computes progress for an active plan', async () => {
      const activePlanRow = {
        id: 'plan-1',
        user_id: 'u1',
        start_date: '2026-06-05',
        end_date: '2026-07-05',
        status: 'active',
        targets: [SAMPLE_TARGET],
        created_at: '2026-06-05T00:00:00Z',
        updated_at: '2026-06-05T00:00:00Z',
      };
      // 150 spent since start in cat-d
      const progressTx = [
        { category_id: 'cat-d', amount: 150, type: 'expense', date: '2026-06-10' },
      ];
      mockBuildTargets.mockReturnValue([]);
      const supabase = makeSupabase({ activePlanRow, progressTx });
      const result = await getActivePlanWithProgress(supabase as never, 'u1', TODAY);

      expect(result.plan).not.toBeNull();
      expect(result.plan!.days_elapsed).toBe(10); // Jun 5 → Jun 15
      expect(result.plan!.days_remaining).toBe(20);
      const cat = result.plan!.categories[0]!;
      expect(cat.current_spend).toBe(150);
      // prorated target = 200 * (10/30) = 66.7; 150 > 66.7 → not on track
      expect(cat.on_track).toBe(false);
      expect(cat.pct_of_target).toBe(75); // 150/200
    });
  });

  describe('generatePlan', () => {
    it('throws when there are no overspent categories', async () => {
      mockBuildTargets.mockReturnValue([]);
      const supabase = makeSupabase({});
      await expect(generatePlan(supabase as never, 'u1', TODAY)).rejects.toThrow(
        /no recovery plan needed/i
      );
    });

    it('abandons existing active plan then inserts a new one', async () => {
      mockBuildTargets.mockReturnValue([SAMPLE_TARGET]);
      const insertedRow = {
        id: 'plan-2',
        user_id: 'u1',
        start_date: '2026-06-15',
        end_date: '2026-07-15',
        status: 'active',
        targets: [SAMPLE_TARGET],
        created_at: '2026-06-15T00:00:00Z',
        updated_at: '2026-06-15T00:00:00Z',
      };
      const supabase = makeSupabase({ insertedRow });
      const result = await generatePlan(supabase as never, 'u1', TODAY);
      expect(result.id).toBe('plan-2');
      // abandon update issued on recovery_plans
      expect(supabase._updateCalls.some((c) => c.table === 'recovery_plans' && (c.payload as { status?: string }).status === 'abandoned')).toBe(true);
    });
  });

  describe('updatePlanStatus', () => {
    it('issues a status update scoped to the plan', async () => {
      const supabase = makeSupabase({});
      await updatePlanStatus(supabase as never, 'u1', 'plan-1', 'abandoned');
      expect(supabase._updateCalls.some((c) => c.table === 'recovery_plans' && (c.payload as { status?: string }).status === 'abandoned')).toBe(true);
    });
  });
});
