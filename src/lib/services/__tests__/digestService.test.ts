/**
 * Digest Service Tests
 * Story 11.7: Weekly Financial Digest
 *
 * - generateDigestForUser: correct week range, top-3 sorted, spending_change_pct, upsert called
 * - getLatestDigest: returns digest, returns null on PGRST116
 * - buildHighlight: each rule branch
 */

import { generateDigestForUser, getLatestDigest, buildHighlight } from '../digestService';
import type { DigestTopCategory } from '@/types/database.types';

// ============================================================================
// MOCKS
// ============================================================================

const mockUpsert = jest.fn();
const mockMaybeSingle = jest.fn();

const supabaseMock = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  upsert: mockUpsert,
  maybeSingle: mockMaybeSingle,
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(() => supabaseMock),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

// ============================================================================
// HELPERS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeTransactionRows(rows: { amount: number; category_id: string; name: string; color: string }[]) {
  return rows.map(r => ({
    amount: r.amount,
    category_id: r.category_id,
    categories: { name: r.name, color: r.color },
  }));
}

// ============================================================================
// buildHighlight
// ============================================================================

describe('buildHighlight', () => {
  const cats: DigestTopCategory[] = [
    { category_id: '1', name: 'Groceries', color: '#green', total: 120 },
    { category_id: '2', name: 'Transport', color: '#blue', total: 80 },
  ];

  it('returns increase message when changePct > 15', () => {
    const result = buildHighlight(200, 100, cats, 'EUR');
    expect(result).toMatch(/increased by 100%/);
    expect(result).toMatch(/Groceries/);
  });

  it('returns decrease message when changePct < -15', () => {
    const result = buildHighlight(60, -40, cats, 'EUR');
    expect(result).toMatch(/dropped 40%/);
  });

  it('returns increase message when changePct is 100 (prevTotal was 0)', () => {
    // This mirrors the case where prevTotal=0 and total>0:
    // generateDigestForUser sets spendingChangePct=100, which is passed directly.
    const result = buildHighlight(100, 100, cats, 'EUR');
    expect(result).toMatch(/increased by 100%/);
  });

  it('returns dominant category message when top cat > 50% of total', () => {
    const dominantCats: DigestTopCategory[] = [
      { category_id: '1', name: 'Rent', color: '#red', total: 80 },
      { category_id: '2', name: 'Other', color: '#blue', total: 10 },
    ];
    // pct change = 0 (no change), but total=90, Rent=80 → 88% > 50%
    const result = buildHighlight(90, 0, dominantCats, 'EUR');
    expect(result).toMatch(/Rent made up over 50%/);
  });

  it('returns generic message when change is neutral and no dominant category', () => {
    // 50/100 = 50% — not strictly > 50%, so falls to generic
    const evenCats: DigestTopCategory[] = [
      { category_id: '1', name: 'Groceries', color: '#green', total: 50 },
      { category_id: '2', name: 'Transport', color: '#blue', total: 50 },
    ];
    const result = buildHighlight(100, 0, evenCats, 'EUR');
    expect(result).toMatch(/2 categories/);
  });
});

// ============================================================================
// generateDigestForUser
// ============================================================================

describe('generateDigestForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: select returns empty, upsert succeeds
    supabaseMock.select.mockReturnThis();
    supabaseMock.gte.mockReturnThis();
    supabaseMock.lte.mockResolvedValue({ data: [], error: null });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it('calls upsert with correct week_start and week_end for a Monday', async () => {
    // Monday 2026-03-23
    const weekStart = new Date('2026-03-23T00:00:00Z');
    await generateDigestForUser('user-1', weekStart);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const payload = mockUpsert.mock.calls[0][0];
    expect(payload.week_start).toBe('2026-03-23');
    expect(payload.week_end).toBe('2026-03-29');
    expect(payload.user_id).toBe('user-1');
  });

  it('computes total_spending and top_categories sorted desc', async () => {
    const rows = makeTransactionRows([
      { amount: 50, category_id: 'cat-a', name: 'Transport', color: '#blue' },
      { amount: 120, category_id: 'cat-b', name: 'Groceries', color: '#green' },
      { amount: 80, category_id: 'cat-a', name: 'Transport', color: '#blue' }, // same cat
    ]);

    // First call (current week), second call (prev week) → empty
    supabaseMock.lte
      .mockResolvedValueOnce({ data: rows, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await generateDigestForUser('user-1', new Date('2026-03-23T00:00:00Z'));

    const payload = mockUpsert.mock.calls[0][0];
    expect(payload.total_spending).toBe(250); // 50+120+80
    expect(payload.top_categories[0].category_id).toBe('cat-a'); // 130 > 120
    expect(payload.top_categories[0].total).toBe(130);
    expect(payload.top_categories[1].category_id).toBe('cat-b');
  });

  it('computes spending_change_pct correctly (positive)', async () => {
    const currentRows = makeTransactionRows([
      { amount: 150, category_id: 'c1', name: 'A', color: '#a' },
    ]);
    const prevRows = makeTransactionRows([
      { amount: 100, category_id: 'c1', name: 'A', color: '#a' },
    ]);
    supabaseMock.lte
      .mockResolvedValueOnce({ data: currentRows, error: null })
      .mockResolvedValueOnce({ data: prevRows, error: null });

    await generateDigestForUser('user-1', new Date('2026-03-23T00:00:00Z'));

    const payload = mockUpsert.mock.calls[0][0];
    expect(payload.spending_change_pct).toBeCloseTo(50, 1);
  });

  it('computes spending_change_pct correctly (negative)', async () => {
    const currentRows = makeTransactionRows([
      { amount: 80, category_id: 'c1', name: 'A', color: '#a' },
    ]);
    const prevRows = makeTransactionRows([
      { amount: 100, category_id: 'c1', name: 'A', color: '#a' },
    ]);
    supabaseMock.lte
      .mockResolvedValueOnce({ data: currentRows, error: null })
      .mockResolvedValueOnce({ data: prevRows, error: null });

    await generateDigestForUser('user-1', new Date('2026-03-23T00:00:00Z'));

    const payload = mockUpsert.mock.calls[0][0];
    expect(payload.spending_change_pct).toBeCloseTo(-20, 1);
  });

  it('sets spending_change_pct to 100 when previous week total is 0 and current > 0', async () => {
    const currentRows = makeTransactionRows([
      { amount: 100, category_id: 'c1', name: 'A', color: '#a' },
    ]);
    supabaseMock.lte
      .mockResolvedValueOnce({ data: currentRows, error: null })
      .mockResolvedValueOnce({ data: [], error: null }); // prev = 0

    await generateDigestForUser('user-1', new Date('2026-03-23T00:00:00Z'));

    const payload = mockUpsert.mock.calls[0][0];
    expect(payload.spending_change_pct).toBe(100);
  });

  it('limits top_categories to 3', async () => {
    const rows = makeTransactionRows([
      { amount: 100, category_id: 'c1', name: 'A', color: '#a' },
      { amount: 90, category_id: 'c2', name: 'B', color: '#b' },
      { amount: 80, category_id: 'c3', name: 'C', color: '#c' },
      { amount: 70, category_id: 'c4', name: 'D', color: '#d' },
    ]);
    supabaseMock.lte
      .mockResolvedValueOnce({ data: rows, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await generateDigestForUser('user-1', new Date('2026-03-23T00:00:00Z'));

    const payload = mockUpsert.mock.calls[0][0];
    expect(payload.top_categories).toHaveLength(3);
  });

  it('throws when upsert fails', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'upsert failed' } });

    await expect(
      generateDigestForUser('user-1', new Date('2026-03-23T00:00:00Z'))
    ).rejects.toMatchObject({ message: 'upsert failed' });
  });
});

// ============================================================================
// getLatestDigest
// ============================================================================

describe('getLatestDigest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseMock.from.mockReturnThis();
    supabaseMock.select.mockReturnThis();
    supabaseMock.eq.mockReturnThis();
    supabaseMock.order.mockReturnThis();
    supabaseMock.limit.mockReturnThis();
  });

  it('returns the digest when found', async () => {
    const digest = { id: 'd-1', user_id: 'user-1', week_start: '2026-03-23' };
    mockMaybeSingle.mockResolvedValue({ data: digest, error: null });

    const result = await getLatestDigest(supabaseMock as never, 'user-1');
    expect(result).toEqual(digest);
  });

  it('returns null when no digest found (PGRST116)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } });

    const result = await getLatestDigest(supabaseMock as never, 'user-1');
    expect(result).toBeNull();
  });

  it('returns null when data is null with no error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getLatestDigest(supabaseMock as never, 'user-1');
    expect(result).toBeNull();
  });

  it('throws on non-PGRST116 error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { code: '42703', message: 'DB error' } });

    await expect(getLatestDigest(supabaseMock as never, 'user-1')).rejects.toMatchObject({ message: 'DB error' });
  });
});
