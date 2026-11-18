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

import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { getActivePlanWithProgress, generatePlan, updatePlanStatus } from '../recoveryPlanService';
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
 * MIGRATED to `@/test-utils/supabaseChain`.
 *
 * The hand-rolled builder routed by table AND by TERMINAL: `recovery_plans`
 * answered `.maybeSingle()` with the active plan, `.single()` with the inserted
 * row, and an awaited update with null - all from one builder, whatever order
 * the calls came in. The shared factory routes by from() ORDER instead (one
 * queued result per call), so this queue mirrors each entry point's sequence:
 *
 *   getActivePlanWithProgress   maybeSingle (active plan) -> [completion update]
 *   generatePlan                abandon update            -> insert...single
 *   updatePlanStatus            update
 *
 * That is a real trade-off, stated rather than hidden: if the service reorders
 * its recovery_plans queries, this queue must follow. In exchange every call is
 * recorded with its arguments, which the router did not do.
 *
 * `transactions` takes ONE value, and a dry queue repeats its last entry - so
 * every transactions read gets `progressTx`, exactly as the router answered.
 *
 * CONTROL-ARM FILE: recoveryPlanService rethrows every error, so a missing chain
 * method would fail a test rather than be absorbed.
 */
function makeSupabase(opts: {
  activePlanRow?: object | null;
  insertedRow?: object;
  progressTx?: object[];
}) {
  const { activePlanRow = null, insertedRow, progressTx = [] } = opts;
  const recoveryPlans =
    insertedRow !== undefined
      ? [
          { data: null, error: null }, // generatePlan: abandon the existing plan
          { data: insertedRow, error: null }, // then insert...single
        ]
      : [
          { data: activePlanRow, error: null }, // maybeSingle, or updatePlanStatus's update
          { data: null, error: null }, // the AC5 completion update
        ];
  return createSupabaseMock({
    tables: {
      recovery_plans: recoveryPlans as never,
      transactions: { data: progressTx, error: null },
      categories: { data: [], error: null },
    },
  });
}

/** Whether ANY recovery_plans update set this status - across every chain. */
const updatedTo = (db: ReturnType<typeof makeSupabase>, status: string) =>
  db
    .allCallsTo('recovery_plans', 'update')
    .some(([payload]) => (payload as { status?: string }).status === status);

describe('recoveryPlanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildTargets.mockReturnValue([]);
  });

  describe('getActivePlanWithProgress', () => {
    it('returns null plan + canGenerate=false when no active plan and no overspend', async () => {
      mockBuildTargets.mockReturnValue([]);
      const supabase = makeSupabase({ activePlanRow: null });
      const result = await getActivePlanWithProgress(supabase.client, 'u1', TODAY);
      expect(result.plan).toBeNull();
      expect(result.canGenerate).toBe(false);
    });

    it('returns canGenerate=true when overspent categories exist', async () => {
      mockBuildTargets.mockReturnValue([SAMPLE_TARGET]);
      const supabase = makeSupabase({ activePlanRow: null });
      const result = await getActivePlanWithProgress(supabase.client, 'u1', TODAY);
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
      const result = await getActivePlanWithProgress(supabase.client, 'u1', TODAY);
      expect(result.plan).toBeNull();
      expect(updatedTo(supabase, 'completed')).toBe(true);
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
      const result = await getActivePlanWithProgress(supabase.client, 'u1', TODAY);

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
      await expect(generatePlan(supabase.client, 'u1', TODAY)).rejects.toThrow(
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
      const result = await generatePlan(supabase.client, 'u1', TODAY);
      expect(result.id).toBe('plan-2');
      // abandon update issued on recovery_plans
      expect(updatedTo(supabase, 'abandoned')).toBe(true);
    });
  });

  describe('updatePlanStatus', () => {
    it("issues an update setting the plan's status to 'abandoned'", async () => {
      // updatePlanStatus also filters .eq('id', planId).eq('user_id', userId);
      // nothing here asserts either filter, so the scoping is UNCHECKED.
      const supabase = makeSupabase({});
      await updatePlanStatus(supabase.client, 'u1', 'plan-1', 'abandoned');
      expect(updatedTo(supabase, 'abandoned')).toBe(true);
    });
  });
});
