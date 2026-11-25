/**
 * @jest-environment node
 *
 * spec-account-deletion-notifications: delivering account notices as pushes,
 * in the RECIPIENT's stored language, claim-then-send, never throwing.
 */

jest.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: jest.fn() }));
jest.mock('@/lib/services/pushService', () => ({ dispatchCategorizedPush: jest.fn() }));
jest.mock('@/lib/services/notificationDeliveryService', () => ({
  claimDelivery: jest.fn(),
  releaseDelivery: jest.fn(),
}));
// The real ICU engine is proven in noticeTexts.icu.test.ts; here the translator
// RECORDS which locale, namespace, key and values the service asked for.
jest.mock('next-intl', () => ({
  createTranslator:
    ({ locale, namespace }: { locale: string; namespace: string }) =>
    (key: string, values: Record<string, string>) =>
      `${locale}|${namespace}|${key}|${JSON.stringify(values)}`,
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createServiceRoleClient } from '@/lib/supabase/server';
import { dispatchCategorizedPush } from '@/lib/services/pushService';
import { claimDelivery, releaseDelivery } from '@/lib/services/notificationDeliveryService';
import { createSupabaseMock } from '@/test-utils/supabaseChain';
import {
  deliverAccountNoticePushes,
  renderAccountNotice,
  toSupportedLocale,
  PUSH_RETRY_DAYS,
} from '@/lib/services/accountNoticeService';

const mockDispatch = dispatchCategorizedPush as jest.Mock;
const mockClaim = claimDelivery as jest.Mock;
const mockRelease = releaseDelivery as jest.Mock;

const NOW = new Date('2026-11-25T12:00:00Z');

type Row = {
  id: string;
  recipient_id: string;
  kind: string;
  cause: string;
  household_id: string | null;
  params: Record<string, unknown>;
  created_at: string;
};
const row = (
  id: string,
  recipient: string,
  kind: string,
  params: Record<string, unknown>
): Row => ({
  id,
  recipient_id: recipient,
  kind,
  cause: 'account_deleted',
  household_id: 'h-1',
  params,
  created_at: '2026-11-25T11:00:00Z',
});

function setup({
  notices,
  delivered = [],
  profiles = [],
  noticesError = null,
  deliveredError = null,
  profilesError = null,
}: {
  notices: Row[];
  delivered?: string[];
  profiles?: Array<{ id: string; preferences: Record<string, unknown> | null }>;
  noticesError?: unknown;
  deliveredError?: unknown;
  profilesError?: unknown;
}) {
  const db = createSupabaseMock({
    tables: {
      account_notices: { data: noticesError ? null : notices, error: noticesError },
      notification_deliveries: {
        data: deliveredError ? null : delivered.map((period_key) => ({ period_key })),
        error: deliveredError,
      },
      user_profiles: { data: profilesError ? null : profiles, error: profilesError },
    },
  });
  (createServiceRoleClient as jest.Mock).mockReturnValue(db.client);
  return db;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClaim.mockResolvedValue(true);
  mockRelease.mockResolvedValue(undefined);
  mockDispatch.mockResolvedValue('sent');
});

describe('deliverAccountNoticePushes', () => {
  test("pushes each notice in its RECIPIENT's stored language, through the household gate", async () => {
    setup({
      notices: [
        row('n-bg', 'u-bg', 'household_transferred', { household: 'Вкъщи' }),
        row('n-en', 'u-en', 'household_transferred', { household: 'Home' }),
        row('n-none', 'u-none', 'household_transferred', { household: 'Casa' }),
      ],
      profiles: [
        { id: 'u-bg', preferences: { language: 'bg' } },
        { id: 'u-en', preferences: { language: 'en' } },
        { id: 'u-none', preferences: { language: 'fr' } }, // unsupported -> default
      ],
    });

    const result = await deliverAccountNoticePushes({ now: NOW });

    expect(result).toEqual({ considered: 3, sent: 3, deferred: 0, notDelivered: 0, skipped: 0 });
    expect(mockDispatch).toHaveBeenCalledWith('u-bg', 'household', {
      type: 'household_event',
      title: 'bg|accountNotices|householdTransferredTitle|{"household":"Вкъщи"}',
      body: 'bg|accountNotices|householdTransferredBody|{"household":"Вкъщи"}',
      data: { url: '/dashboard' },
    });
    expect(mockDispatch.mock.calls.find((c) => c[0] === 'u-en')![2].title).toMatch(/^en\|/);
    expect(mockDispatch.mock.calls.find((c) => c[0] === 'u-none')![2].title).toMatch(/^en\|/);
  });

  test('CLAIMS before sending, and keeps the claim only for a SENT push', async () => {
    setup({ notices: [row('n-1', 'u-1', 'household_transferred', { household: 'H' })] });

    await deliverAccountNoticePushes({ now: NOW });

    expect(mockClaim).toHaveBeenCalledWith(expect.anything(), 'account_notice', 'n-1', 'u-1');
    expect(mockClaim.mock.invocationCallOrder[0]!).toBeLessThan(
      mockDispatch.mock.invocationCallOrder[0]!
    );
    expect(mockRelease).not.toHaveBeenCalled();
  });

  test.each([
    ['deferred', { deferred: 1, notDelivered: 0 }],
    ['suppressed', { deferred: 0, notDelivered: 1 }],
    ['no_subscription', { deferred: 0, notDelivered: 1 }],
    ['failed', { deferred: 0, notDelivered: 1 }],
    ['not_configured', { deferred: 0, notDelivered: 1 }],
  ])('a %s push RELEASES its claim, so the next run retries it', async (outcome, counts) => {
    setup({ notices: [row('n-1', 'u-1', 'household_transferred', { household: 'H' })] });
    mockDispatch.mockResolvedValue(outcome);

    const result = await deliverAccountNoticePushes({ now: NOW });

    expect(mockRelease).toHaveBeenCalledWith(expect.anything(), 'account_notice', 'n-1', 'u-1');
    expect(result).toMatchObject({ sent: 0, ...counts });
  });

  test('a claim held by another run is skipped: no push', async () => {
    setup({ notices: [row('n-1', 'u-1', 'household_transferred', { household: 'H' })] });
    mockClaim.mockResolvedValue(false);

    const result = await deliverAccountNoticePushes({ now: NOW });

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: 1, sent: 0 });
  });

  test('a claim that fails closed is not sent, and counts as not delivered', async () => {
    setup({ notices: [row('n-1', 'u-1', 'household_transferred', { household: 'H' })] });
    mockClaim.mockRejectedValue(new Error('delivery claim failed'));

    const result = await deliverAccountNoticePushes({ now: NOW });

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ notDelivered: 1, sent: 0 });
  });

  test('an already-delivered notice is not claimed or sent again', async () => {
    setup({
      notices: [
        row('n-done', 'u-1', 'household_transferred', { household: 'H' }),
        row('n-owed', 'u-1', 'category_renamed', { household: 'H', from: 'A', to: 'A 2' }),
      ],
      delivered: ['n-done'],
    });

    await deliverAccountNoticePushes({ now: NOW });

    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockClaim).toHaveBeenCalledWith(expect.anything(), 'account_notice', 'n-owed', 'u-1');
  });

  test('at most 3 per recipient per run, the biggest change first', async () => {
    setup({
      notices: [
        row('r1', 'u-1', 'category_renamed', { from: 'A', to: 'A 2' }),
        row('r2', 'u-1', 'category_renamed', { from: 'B', to: 'B 2' }),
        row('p', 'u-1', 'shared_plans_received', { household: 'H', goals: 1, budgets: 0 }),
        row('c', 'u-1', 'categories_copied', { categories: ['X'] }),
        row('t', 'u-1', 'household_transferred', { household: 'H' }),
      ],
    });

    const result = await deliverAccountNoticePushes({ now: NOW });

    expect(mockClaim.mock.calls.map((c) => c[2])).toEqual(['t', 'c', 'p']);
    expect(result.considered).toBe(3);
  });

  test('a notice whose params cannot fill the text is skipped, never pushed with a hole', async () => {
    setup({ notices: [row('n-1', 'u-1', 'household_transferred', {})] });

    const result = await deliverAccountNoticePushes({ now: NOW });

    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: 1 });
  });

  test(`reads only UNDISMISSED notices created in the last ${PUSH_RETRY_DAYS} days, or since the given time if later`, async () => {
    const windowStart = new Date(NOW.getTime() - PUSH_RETRY_DAYS * 86_400_000).toISOString();

    let db = setup({ notices: [] });
    await deliverAccountNoticePushes({ now: NOW });
    expect(db.callsTo('account_notices', 'is')).toContainEqual(['dismissed_at', null]);
    expect(db.callsTo('account_notices', 'gte')).toContainEqual(['created_at', windowStart]);

    db = setup({ notices: [] });
    const since = new Date('2026-11-25T11:59:00Z');
    await deliverAccountNoticePushes({ now: NOW, since });
    expect(db.callsTo('account_notices', 'gte')).toContainEqual([
      'created_at',
      since.toISOString(),
    ]);

    // A `since` OLDER than the window cannot widen it.
    db = setup({ notices: [] });
    await deliverAccountNoticePushes({ now: NOW, since: new Date('2026-01-01T00:00:00Z') });
    expect(db.callsTo('account_notices', 'gte')).toContainEqual(['created_at', windowStart]);
  });

  test('the delivered lookup is scoped to this kind and these notices', async () => {
    const db = setup({ notices: [row('n-1', 'u-1', 'household_transferred', { household: 'H' })] });
    await deliverAccountNoticePushes({ now: NOW });
    expect(db.callsTo('notification_deliveries', 'eq')).toContainEqual(['kind', 'account_notice']);
    expect(db.callsTo('notification_deliveries', 'in')).toContainEqual(['period_key', ['n-1']]);
  });

  test('a failed notice lookup sends nothing', async () => {
    setup({ notices: [], noticesError: { message: 'boom' } });
    expect(await deliverAccountNoticePushes({ now: NOW })).toMatchObject({ considered: 0 });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test('a failed delivered lookup sends nothing (fail CLOSED: unsure what was sent)', async () => {
    setup({
      notices: [row('n-1', 'u-1', 'household_transferred', { household: 'H' })],
      deliveredError: { message: 'boom' },
    });
    await deliverAccountNoticePushes({ now: NOW });
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test('a failed language lookup still pushes, in the default language', async () => {
    setup({
      notices: [row('n-1', 'u-1', 'household_transferred', { household: 'H' })],
      profilesError: { message: 'boom' },
    });
    await deliverAccountNoticePushes({ now: NOW });
    expect(mockDispatch.mock.calls[0]![2].title).toMatch(/^en\|/);
  });

  test('never throws', async () => {
    (createServiceRoleClient as jest.Mock).mockImplementation(() => {
      throw new Error('no service key');
    });
    await expect(deliverAccountNoticePushes({ now: NOW })).resolves.toEqual({
      considered: 0,
      sent: 0,
      deferred: 0,
      notDelivered: 0,
      skipped: 0,
    });
  });
});

describe('renderAccountNotice / toSupportedLocale', () => {
  test('renders the shared_plans body for the cause, in the given locale', () => {
    const r = renderAccountNotice('bg', {
      id: 'n',
      kind: 'shared_plans_received',
      cause: 'member_removed',
      household_id: 'h',
      params: { household: 'Вкъщи', goals: 0, budgets: 1 },
      created_at: '2026-11-25T11:00:00Z',
    });
    expect(r).toEqual({
      title: 'bg|accountNotices|sharedPlansReceivedTitle|{"household":"Вкъщи"}',
      body: 'bg|accountNotices|sharedPlansReceivedBodyRemoved|{"household":"Вкъщи"}',
    });
  });

  test.each([
    ['bg', 'bg'],
    ['en', 'en'],
    ['fr', 'en'],
    [undefined, 'en'],
    [42, 'en'],
  ])('%s -> %s', (input, expected) => {
    expect(toSupportedLocale(input)).toBe(expected);
  });
});
