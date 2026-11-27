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
  test('household_transferred -> the new-owner texts; "longest-standing" ONLY when the database knew it', () => {
    expect(
      noticeMessage(notice('household_transferred', { household: 'Вкъщи', seniority: true }), 'bg')
    ).toEqual({
      titleKey: 'householdTransferredTitle',
      bodyKey: 'householdTransferredBody',
      values: { household: 'Вкъщи' },
    });
    for (const seniority of [false, undefined, 'yes']) {
      expect(
        noticeMessage(notice('household_transferred', { household: 'Вкъщи', seniority }), 'bg')
          ?.bodyKey
      ).toBe('householdTransferredBodyNoSeniority');
    }
  });

  test('household_now_yours (a REFUSED deletion) -> the neutral texts only: no "its creator deleted", no seniority', () => {
    for (const seniority of [true, false, undefined]) {
      expect(
        noticeMessage(
          notice(
            'household_now_yours',
            { household: 'Вкъщи', seniority },
            { cause: 'ownership_transferred' }
          ),
          'bg'
        )
      ).toEqual({
        titleKey: 'householdNowYoursTitle',
        bodyKey: 'householdNowYoursBody',
        values: { household: 'Вкъщи' },
      });
    }
    // ...and never shown with a hole in it.
    expect(
      noticeMessage(notice('household_now_yours', {}, { cause: 'ownership_transferred' }), 'en')
    ).toBeNull();
    // An UNKNOWN kind gets no message at all - the property that keeps an older
    // app from ever mis-rendering this notice (it is hidden, never falsified).
    expect(
      noticeMessage(notice('a_kind_from_the_future' as never, { household: 'Вкъщи' }), 'en')
    ).toBeNull();
  });

  test('categories_copied -> the names joined for the LOCALE; "a household member" ONLY when shared', () => {
    const n = notice('categories_copied', {
      categories: ['Храна', 'Транспорт', 'Сметки'],
      shared_household: true,
    });
    expect(noticeMessage(n, 'en')?.values.categories).toBe('Храна, Транспорт, and Сметки');
    expect(noticeMessage(n, 'bg')?.values.categories).toBe('Храна, Транспорт и Сметки');
    expect(noticeMessage(n, 'bg')).toMatchObject({
      titleKey: 'categoriesCopiedTitle',
      bodyKey: 'categoriesCopiedBody',
    });
    for (const shared_household of [false, undefined]) {
      expect(
        noticeMessage(
          notice('categories_copied', { categories: ['Храна'], shared_household }),
          'en'
        )?.bodyKey
      ).toBe('categoriesCopiedBodyOutside');
    }
    // Whitespace-only names are dropped, not listed as blanks.
    expect(
      noticeMessage(notice('categories_copied', { categories: ['Храна', '  '] }), 'en')?.values
    ).toEqual({ categories: 'Храна' });
  });

  test('without Intl.ListFormat (old browsers) the names are still listed, never a crash', () => {
    const intl = Intl as unknown as Record<string, unknown>;
    const original = intl.ListFormat;
    delete intl.ListFormat; // simulating a browser that lacks it
    try {
      expect(
        noticeMessage(notice('categories_copied', { categories: ['A', 'B'] }), 'en')?.values
      ).toEqual({ categories: 'A, B' });
    } finally {
      intl.ListFormat = original;
    }
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

  // spec-refused-deletion-neutral-variants: a REFUSED deletion's other changes,
  // told neutrally. Each maps to its OWN keys - never a deletion text, never the
  // cause-dependent bodies - and names no one.
  test('category_copies_made -> the neutral texts, the names listed for the locale; no subject, whatever shared_household or the cause says', () => {
    for (const [shared_household, cause] of [
      [true, 'copies_made'],
      [false, 'account_deleted'],
      [undefined, 'member_removed'],
    ] as const) {
      expect(
        noticeMessage(
          notice(
            'category_copies_made',
            { categories: ['Храна', 'Сметки'], shared_household },
            { cause, household_id: null }
          ),
          'bg'
        )
      ).toEqual({
        titleKey: 'categoryCopiesMadeTitle',
        bodyKey: 'categoryCopiesMadeBody',
        values: { categories: 'Храна и Сметки' },
      });
    }
    expect(
      noticeMessage(notice('category_copies_made', { categories: ['A', ' ', 'B'] }), 'en')?.values
    ).toEqual({ categories: 'A and B' });
  });

  test('shared_category_renamed -> from, to AND the household, for every cause; never the deletion-era keys', () => {
    for (const cause of ['ownership_transferred', 'account_deleted', 'member_removed'] as const) {
      expect(
        noticeMessage(
          notice(
            'shared_category_renamed',
            { household: 'Вкъщи', from: 'Храна', to: 'Храна 2' },
            { cause }
          ),
          'bg'
        )
      ).toEqual({
        titleKey: 'sharedCategoryRenamedTitle',
        bodyKey: 'sharedCategoryRenamedBody',
        values: { from: 'Храна', to: 'Храна 2', household: 'Вкъщи' },
      });
    }
  });

  // A deletion text claims a deletion (or a removal): shown ONLY with the cause
  // that backs it. A neutral cause on a deletion kind is never rendered as one -
  // the database refuses that pairing too (account_notices_kind_cause_check).
  test.each([
    ['household_transferred', 'ownership_transferred', { household: 'H', seniority: true }],
    ['household_transferred', 'member_removed', { household: 'H' }],
    ['categories_copied', 'copies_made', { categories: ['Храна'] }],
    ['categories_copied', 'member_removed', { categories: ['Храна'] }],
    ['shared_plans_received', 'ownership_transferred', { household: 'H' }],
    ['shared_plans_received', 'copies_made', { household: 'H' }],
  ] as const)('%s with cause %s -> null (fail closed)', (kind, cause, params) => {
    expect(noticeMessage(notice(kind, params, { cause }), 'en')).toBeNull();
  });

  test('shared_plans_now_yours -> the neutral texts for EVERY cause (no "deleted", no "removed")', () => {
    for (const cause of ['ownership_transferred', 'account_deleted', 'member_removed'] as const) {
      expect(
        noticeMessage(
          notice('shared_plans_now_yours', { household: 'Вкъщи', goals: 1, budgets: 2 }, { cause }),
          'en'
        )
      ).toEqual({
        titleKey: 'sharedPlansNowYoursTitle',
        bodyKey: 'sharedPlansNowYoursBody',
        values: { household: 'Вкъщи' },
      });
    }
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
    ['category_copies_made with no names', notice('category_copies_made', { categories: [] })],
    [
      'category_copies_made with names that are not a list',
      notice('category_copies_made', { categories: 'Храна' }),
    ],
    [
      'shared_category_renamed without "from"',
      notice('shared_category_renamed', { household: 'H', to: 'A 2' }),
    ],
    [
      'shared_category_renamed without "to"',
      notice('shared_category_renamed', { household: 'H', from: 'A' }),
    ],
    [
      'shared_category_renamed without a household',
      notice('shared_category_renamed', { from: 'A', to: 'A 2' }),
    ],
    [
      'shared_plans_now_yours with a blank household',
      notice('shared_plans_now_yours', { household: '  ' }),
    ],
    ['an unknown kind', notice('something_new' as AccountNoticeKind, { household: 'H' })],
  ])('%s -> null (never a text with a hole)', (_label, n) => {
    expect(noticeMessage(n, 'en')).toBeNull();
  });
});

describe('byPriority', () => {
  test('each neutral kind sits right after its deletion counterpart', () => {
    const list = [
      notice('shared_category_renamed', {}, { id: 'R' }),
      notice('category_renamed', {}, { id: 'r' }),
      notice('shared_plans_now_yours', {}, { id: 'P' }),
      notice('shared_plans_received', {}, { id: 'p' }),
      notice('category_copies_made', {}, { id: 'C' }),
      notice('categories_copied', {}, { id: 'c' }),
      notice('household_now_yours', {}, { id: 'T' }),
      notice('household_transferred', {}, { id: 't' }),
    ];
    expect([...list].sort(byPriority).map((n) => n.id)).toEqual([
      't',
      'T',
      'c',
      'C',
      'p',
      'P',
      'r',
      'R',
    ]);
  });

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
