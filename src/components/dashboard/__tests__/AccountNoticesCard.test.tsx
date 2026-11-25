/**
 * spec-account-deletion-notifications: the dashboard card. The translator here
 * RECORDS the key and values asked for (the global next-intl mock cannot render
 * plurals); the real ICU text in both languages is proven in noticeTexts.icu.test.ts.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { SWRConfig } from 'swr';
import { AccountNoticesCard } from '@/components/dashboard/AccountNoticesCard';
import type { AccountNotice } from '@/lib/accountNotices/noticeMessage';

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    `${namespace}.${key}${values ? ' ' + JSON.stringify(values) : ''}`,
}));

const n = (
  id: string,
  kind: AccountNotice['kind'],
  params: Record<string, unknown>,
  created_at = '2026-11-25T10:00:00Z'
): AccountNotice => ({ id, kind, cause: 'account_deleted', household_id: 'h', params, created_at });

function serve(notices: AccountNotice[], dismissStatus = 200) {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      return { ok: dismissStatus < 300, status: dismissStatus, json: async () => ({}) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ data: notices }) } as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function renderCard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ChakraProvider>
        <AccountNoticesCard />
      </ChakraProvider>
    </SWRConfig>
  );
}

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe('AccountNoticesCard', () => {
  test('renders nothing when there is nothing to tell', async () => {
    const fetchMock = serve([]);
    const { container } = renderCard();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/notices'));
    expect(container.querySelector('section')).toBeNull();
  });

  test('shows at most 3, the biggest change first, and counts the rest', async () => {
    serve([
      n('r1', 'category_renamed', { from: 'A', to: 'A 2' }),
      n('r2', 'category_renamed', { from: 'B', to: 'B 2' }),
      n('p', 'shared_plans_received', { household: 'Home', goals: 1, budgets: 0 }),
      n('t', 'household_transferred', { household: 'Home' }),
    ]);
    renderCard();

    const headings = await screen.findAllByRole('heading');
    expect(headings.map((h) => h.textContent)).toEqual([
      'accountNotices.householdTransferredTitle {"household":"Home"}',
      'accountNotices.sharedPlansReceivedTitle {"household":"Home"}',
      'accountNotices.categoryRenamedTitle {"from":"A","to":"A 2"}',
    ]);
    expect(screen.getByText('accountNotices.more {"count":1}')).toBeInTheDocument();
    // A landmark with a heading per notice; NOT a live region (15-8 review).
    const section = screen.getByRole('region', { name: 'accountNotices.cardLabel' });
    expect(section.closest('[aria-live]')).toBeNull();
  });

  test('a notice whose params cannot fill the text is neither shown nor counted', async () => {
    serve([
      n('bad', 'household_transferred', {}),
      n('ok', 'categories_copied', { categories: ['Food', 'Rent'] }),
    ]);
    renderCard();

    const headings = await screen.findAllByRole('heading');
    expect(headings).toHaveLength(1);
    expect(
      screen.getByText('accountNotices.categoriesCopiedBody {"categories":"Food and Rent"}')
    ).toBeInTheDocument();
    expect(screen.queryByText(/accountNotices\.more/)).toBeNull();
  });

  test('dismissing hides it and POSTs to its own dismiss endpoint', async () => {
    const fetchMock = serve([
      n('t', 'household_transferred', { household: 'Home' }),
      n('c', 'categories_copied', { categories: ['Food'] }),
    ]);
    renderCard();

    await screen.findAllByRole('heading');
    fireEvent.click(screen.getAllByRole('button', { name: 'accountNotices.dismiss' })[0]!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/notices/t/dismiss', { method: 'POST' })
    );
    await waitFor(() => expect(screen.getAllByRole('heading')).toHaveLength(1));
    expect(screen.getByRole('heading').textContent).toContain('categoriesCopiedTitle');
  });

  test('a refused dismissal brings the notice back (never silently lost)', async () => {
    serve([n('t', 'household_transferred', { household: 'Home' })], 500);
    renderCard();

    await screen.findByRole('heading');
    fireEvent.click(screen.getByRole('button', { name: 'accountNotices.dismiss' }));

    await waitFor(() =>
      expect(screen.getByRole('heading').textContent).toContain('householdTransferredTitle')
    );
  });
});
