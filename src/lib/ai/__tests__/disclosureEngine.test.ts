/**
 * disclosureEngine tests — Story 15.7
 * Thresholds (catalog): heatmap tx>=30, projections days>=14, subscriptions tx>=50.
 */

import { computeDisclosure } from '@/lib/ai/disclosureEngine';

const state = (over: Partial<{ transactions_count: number; days_active: number; features_unlocked: string[] }> = {}) => ({
  transactions_count: 0,
  days_active: 0,
  features_unlocked: [],
  ...over,
});

describe('computeDisclosure', () => {
  it('unlocks nothing for a brand-new user', () => {
    const r = computeDisclosure(state(), false);
    expect(r.unlocked).toEqual([]);
    expect(r.pending).toEqual([]);
  });

  it('unlocks heatmap exactly AT the 30-transaction threshold (with a pending intro)', () => {
    const r = computeDisclosure(state({ transactions_count: 30 }), false);
    expect(r.unlocked).toContain('heatmap');
    expect(r.pending).toContain('heatmap');
    // 30 < 50 → subscriptions still locked
    expect(r.unlocked).not.toContain('subscriptions');
  });

  it('does NOT unlock heatmap one below the threshold', () => {
    const r = computeDisclosure(state({ transactions_count: 29 }), false);
    expect(r.unlocked).not.toContain('heatmap');
  });

  it('unlocks projections at 14 days active', () => {
    const r = computeDisclosure(state({ days_active: 14 }), false);
    expect(r.unlocked).toEqual(['projections']);
    expect(r.pending).toEqual(['projections']);
  });

  it('unlocks subscriptions (and heatmap) at 50 transactions', () => {
    const r = computeDisclosure(state({ transactions_count: 50 }), false);
    expect(r.unlocked).toEqual(expect.arrayContaining(['heatmap', 'subscriptions']));
  });

  it('already-acknowledged features are unlocked but NOT pending', () => {
    const r = computeDisclosure(
      state({ transactions_count: 50, features_unlocked: ['heatmap'] }),
      false
    );
    expect(r.unlocked).toEqual(expect.arrayContaining(['heatmap', 'subscriptions']));
    expect(r.pending).not.toContain('heatmap'); // acknowledged
    expect(r.pending).toContain('subscriptions'); // still new
  });

  it('showAll unlocks everything but forces NO intros (escape hatch reveals, does not nag)', () => {
    const r = computeDisclosure(state(), true);
    expect(r.unlocked).toEqual(expect.arrayContaining(['heatmap', 'projections', 'subscriptions']));
    expect(r.pending).toEqual([]);
  });

  it('treats non-finite/absent metrics as 0 (never over-unlocks)', () => {
    const r = computeDisclosure(
      state({ transactions_count: NaN as unknown as number, days_active: undefined as unknown as number }),
      false
    );
    expect(r.unlocked).toEqual([]);
  });
});
