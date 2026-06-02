/**
 * Re-engagement Analysis Tests — Story 12.6 / FR8
 * Pure unit tests — no mocks.
 */

import { buildReengagementSummary } from '../reengagementAnalysis';
import type { DetectedSubscription, Goal, Transaction } from '@/types/database.types';

const TODAY = new Date('2026-06-15T12:00:00');

let seq = 0;
function tx(amount: number, date: string, type: 'expense' | 'income' = 'expense'): Transaction {
  seq += 1;
  return {
    id: `t${seq}`, user_id: 'u1', category_id: 'c1', amount, date, type,
    notes: null, currency: 'USD', exchange_rate: null,
    created_at: `${date}T00:00:00Z`, updated_at: `${date}T00:00:00Z`,
  };
}

function sub(estimated_amount: number, frequency: DetectedSubscription['frequency']): DetectedSubscription {
  seq += 1;
  return {
    id: `s${seq}`, user_id: 'u1', merchant_pattern: 'Acme', estimated_amount,
    currency: 'USD', frequency, last_seen_at: '2026-05-01', status: 'active',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  };
}

function goal(name: string, current: number, target: number): Goal {
  seq += 1;
  return {
    id: `g${seq}`, user_id: 'u1', name, target_amount: target, current_amount: current,
    deadline: null, milestones_celebrated: [], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('buildReengagementSummary', () => {
  it('computes lapsed_days from last activity to today', () => {
    const result = buildReengagementSummary({
      lastActivityDate: new Date('2026-05-16T00:00:00'),
      today: TODAY,
      historicalTransactions: [],
      subscriptions: [],
      goals: [],
    });
    expect(result.lapsed_days).toBe(30); // May 16 → Jun 15
  });

  it('computes typical_monthly_spend as mean of monthly expense totals, ignoring income', () => {
    const result = buildReengagementSummary({
      lastActivityDate: new Date('2026-05-01T00:00:00'),
      today: TODAY,
      historicalTransactions: [
        tx(200, '2026-03-10'),
        tx(400, '2026-04-10'),
        tx(99999, '2026-04-12', 'income'), // ignored
      ],
      subscriptions: [],
      goals: [],
    });
    // mean(200, 400) = 300
    expect(result.typical_monthly_spend).toBe(300);
  });

  it('normalizes subscription frequencies to a monthly total', () => {
    const result = buildReengagementSummary({
      lastActivityDate: new Date('2026-05-01T00:00:00'),
      today: TODAY,
      historicalTransactions: [],
      subscriptions: [
        sub(10, 'monthly'),   // 10
        sub(12, 'annual'),    // 1
        sub(30, 'quarterly'), // 10
      ],
      goals: [],
    });
    expect(result.active_subscription_count).toBe(3);
    expect(result.active_subscription_monthly_total).toBe(21); // 10 + 1 + 10
  });

  it('maps goals to pct, sorts desc, caps at 3, guards target>0', () => {
    const result = buildReengagementSummary({
      lastActivityDate: new Date('2026-05-01T00:00:00'),
      today: TODAY,
      historicalTransactions: [],
      subscriptions: [],
      goals: [
        goal('A', 50, 100),   // 50%
        goal('B', 90, 100),   // 90%
        goal('C', 10, 100),   // 10%
        goal('D', 80, 100),   // 80%
        goal('Z', 5, 0),      // guarded → 0%
      ],
    });
    expect(result.goals).toHaveLength(3);
    expect(result.goals.map((g) => g.name)).toEqual(['B', 'D', 'A']);
    expect(result.goals[0]!.pct).toBe(90);
  });

  describe('recommended_action precedence', () => {
    it('prioritizes subscriptions when present', () => {
      const result = buildReengagementSummary({
        lastActivityDate: new Date('2026-05-01T00:00:00'), today: TODAY,
        historicalTransactions: [], subscriptions: [sub(10, 'monthly')], goals: [goal('A', 50, 100)],
      });
      expect(result.recommended_action).toMatch(/subscription/i);
    });

    it('falls back to goals when no subscriptions', () => {
      const result = buildReengagementSummary({
        lastActivityDate: new Date('2026-05-01T00:00:00'), today: TODAY,
        historicalTransactions: [], subscriptions: [], goals: [goal('Vacation', 50, 100)],
      });
      expect(result.recommended_action).toMatch(/Vacation/);
    });

    it('defaults to logging prompt when nothing else', () => {
      const result = buildReengagementSummary({
        lastActivityDate: new Date('2026-05-01T00:00:00'), today: TODAY,
        historicalTransactions: [], subscriptions: [], goals: [],
      });
      expect(result.recommended_action).toMatch(/log your latest expenses/i);
    });
  });
});
