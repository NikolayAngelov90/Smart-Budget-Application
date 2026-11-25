/**
 * spec-account-deletion-notifications: the ONE mapping from a stored notice to
 * its message keys and values, shared by the dashboard card and the push.
 */

import {
  byPriority,
  noticeMessage,
  type AccountNotice,
  type AccountNoticeKind,
} from '@/lib/accountNotices/noticeMessage';

const notice = (
  kind: AccountNoticeKind,
  params: Record<string, unknown>,
  extra: Partial<AccountNotice> = {}
): AccountNotice => ({
  id: `${kind}-1`,
  kind,
  cause: 'account_deleted',
  household_id: 'h-1',
  params,
  created_at: '2026-11-25T10:00:00Z',
  ...extra,
});

describe('noticeMessage', () => {
  test('household_transferred -> the new-owner texts, with the household', () => {
    expect(noticeMessage(notice('household_transferred', { household: 'Вкъщи' }), 'bg')).toEqual({
      titleKey: 'householdTransferredTitle',
      bodyKey: 'householdTransferredBody',
      values: { household: 'Вкъщи' },
    });
  });

  test('categories_copied -> the copies texts, the names joined for the LOCALE', () => {
    const n = notice('categories_copied', { categories: ['Храна', 'Транспорт', 'Сметки'] });
    expect(noticeMessage(n, 'en')?.values.categories).toBe('Храна, Транспорт, and Сметки');
    expect(noticeMessage(n, 'bg')?.values.categories).toBe('Храна, Транспорт и Сметки');
    expect(noticeMessage(n, 'bg')).toMatchObject({
      titleKey: 'categoriesCopiedTitle',
      bodyKey: 'categoriesCopiedBody',
    });
    expect(
      noticeMessage(notice('categories_copied', { categories: ['Храна'] }), 'en')?.values
    ).toEqual({ categories: 'Храна' });
  });

  test('category_renamed -> from and to', () => {
    expect(
      noticeMessage(
        notice('category_renamed', { household: 'H', from: 'Храна', to: 'Храна 2' }),
        'bg'
      )
    ).toEqual({
      titleKey: 'categoryRenamedTitle',
      bodyKey: 'categoryRenamedBody',
      values: { from: 'Храна', to: 'Храна 2' },
    });
  });

  test('shared_plans_received -> the body for its CAUSE', () => {
    const params = { household: 'Вкъщи', goals: 1, budgets: 0 };
    expect(noticeMessage(notice('shared_plans_received', params), 'en')).toEqual({
      titleKey: 'sharedPlansReceivedTitle',
      bodyKey: 'sharedPlansReceivedBodyDeleted',
      values: { household: 'Вкъщи' },
    });
    expect(
      noticeMessage(notice('shared_plans_received', params, { cause: 'member_removed' }), 'en')
        ?.bodyKey
    ).toBe('sharedPlansReceivedBodyRemoved');
  });

  test.each([
    ['household_transferred without a household', notice('household_transferred', {})],
    [
      'household_transferred with a blank household',
      notice('household_transferred', { household: ' ' }),
    ],
    ['categories_copied with no names', notice('categories_copied', { categories: [] })],
    [
      'categories_copied with non-string names',
      notice('categories_copied', { categories: [1, null] }),
    ],
    ['category_renamed without "to"', notice('category_renamed', { from: 'A' })],
    ['shared_plans_received without a household', notice('shared_plans_received', { goals: 1 })],
    ['an unknown kind', notice('something_new' as AccountNoticeKind, { household: 'H' })],
  ])('%s -> null (never a text with a hole)', (_label, n) => {
    expect(noticeMessage(n, 'en')).toBeNull();
  });
});

describe('byPriority', () => {
  test('the biggest change first, then the oldest', () => {
    const list = [
      notice('category_renamed', {}, { id: 'r', created_at: '2026-11-25T10:00:00Z' }),
      notice('shared_plans_received', {}, { id: 'p' }),
      notice('categories_copied', {}, { id: 'c' }),
      notice('household_transferred', {}, { id: 't' }),
      notice('category_renamed', {}, { id: 'r0', created_at: '2026-11-25T09:00:00Z' }),
    ];
    expect([...list].sort(byPriority).map((n) => n.id)).toEqual(['t', 'c', 'p', 'r0', 'r']);
  });
});
