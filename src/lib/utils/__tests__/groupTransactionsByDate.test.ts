import { groupTransactionsByDate } from '../groupTransactionsByDate';

// Fixed "now" so Today/Yesterday are deterministic. 2026-07-23 is a Thursday;
// 2026-07-20 is a Monday.
const now = new Date('2026-07-23T10:00:00');
const mk = (id: string, date: string) => ({ id, date });

describe('groupTransactionsByDate', () => {
  it('labels the current and previous day as Today / Yesterday', () => {
    const groups = groupTransactionsByDate(
      [mk('a', '2026-07-23'), mk('b', '2026-07-22')],
      { todayLabel: 'Today', yesterdayLabel: 'Yesterday', now }
    );
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday']);
  });

  it('buckets same-day transactions together, preserving input order', () => {
    const groups = groupTransactionsByDate(
      [mk('a', '2026-07-23'), mk('b', '2026-07-23'), mk('c', '2026-07-22')],
      { todayLabel: 'Today', yesterdayLabel: 'Yesterday', now }
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]!.items.map((t) => t.id)).toEqual(['a', 'b']);
    expect(groups[1]!.items.map((t) => t.id)).toEqual(['c']);
  });

  it('formats older days with a weekday + date label', () => {
    const groups = groupTransactionsByDate([mk('a', '2026-07-20')], {
      todayLabel: 'Today',
      yesterdayLabel: 'Yesterday',
      now,
    });
    expect(groups[0]!.label).toBe('Monday, 20 Jul');
  });

  it('keeps groups in newest-first order matching the input', () => {
    const groups = groupTransactionsByDate(
      [mk('a', '2026-07-23'), mk('b', '2026-07-20'), mk('c', '2026-07-19')],
      { todayLabel: 'Today', yesterdayLabel: 'Yesterday', now }
    );
    expect(groups.map((g) => g.key)).toEqual(['2026-07-23', '2026-07-20', '2026-07-19']);
  });

  it('returns an empty array when there are no transactions', () => {
    expect(
      groupTransactionsByDate([], { todayLabel: 'Today', yesterdayLabel: 'Yesterday', now })
    ).toEqual([]);
  });
});
