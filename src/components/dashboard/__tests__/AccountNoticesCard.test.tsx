/**
 * spec-account-deletion-notifications: the dashboard card. The translator here
 * RECORDS the key and values asked for (the global next-intl mock cannot render
 * plurals); the real ICU text in both languages is proven in noticeTexts.icu.test.ts.
 * The fake server is STATEFUL: a successful dismissal removes the notice, as the
 * real one does, because the card revalidates after dismissing.
 */

import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
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

/** A fake /api/notices that forgets a notice once it is dismissed (unless refused). */
function serve(initial: AccountNotice[], dismissStatus = 200) {
  let list = [...initial];
  let releaseDismiss: (() => void) | null = null;
  const gate = dismissStatus >= 300 ? new Promise<void>((r) => (releaseDismiss = r)) : null;
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      if (gate) await gate; // hold a refusal until the test has seen the optimistic hide
      if (dismissStatus < 300) {
        const id = url.split('/')[3];
        list = list.filter((x) => x.id !== id);
      }
      return { ok: dismissStatus < 300, status: dismissStatus, json: async () => ({}) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ data: list }) } as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, release: () => releaseDismiss?.() };
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

const noticeHeadings = () => screen.queryAllByRole('heading', { level: 3 });

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe('AccountNoticesCard', () => {
  test('renders nothing when there is nothing to tell (after the answer arrived)', async () => {
    const { fetchMock } = serve([]);
    const { container } = renderCard();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/notices'));
    await act(async () => {
      await Promise.resolve(); // let SWR process the response
    });
    expect(container.querySelector('section')).toBeNull();
  });

  test('shows at most 3, the biggest change first, and counts the rest', async () => {
    serve([
      n('r1', 'category_renamed', { from: 'A', to: 'A 2' }),
      n('r2', 'category_renamed', { from: 'B', to: 'B 2' }),
      n('p', 'shared_plans_received', { household: 'Home', goals: 1, budgets: 0 }),
      n('t', 'household_transferred', { household: 'Home', seniority: true }),
    ]);
    renderCard();

    await waitFor(() => expect(noticeHeadings()).toHaveLength(3));
    expect(noticeHeadings().map((h) => h.textContent)).toEqual([
      'accountNotices.householdTransferredTitle {"household":"Home"}',
      'accountNotices.sharedPlansReceivedTitle {"household":"Home"}',
      'accountNotices.categoryRenamedTitle {"from":"A","to":"A 2"}',
    ]);
    expect(screen.getByText('accountNotices.more {"count":1}')).toBeInTheDocument();
    // A landmark named by its own heading; NOT a live region (15-8 review).
    const section = screen.getByRole('region', { name: 'accountNotices.cardLabel' });
    expect(section.closest('[aria-live]')).toBeNull();
    // Every "Got it" says WHICH notice it closes.
    expect(
      screen.getAllByRole('button', { name: 'accountNotices.dismiss' })[0]
    ).toHaveAccessibleDescription('accountNotices.householdTransferredTitle {"household":"Home"}');
  });

  test('a notice whose params cannot fill the text is neither shown nor counted', async () => {
    serve([
      n('bad', 'household_transferred', {}),
      n('ok', 'categories_copied', { categories: ['Food', 'Rent'], shared_household: true }),
    ]);
    renderCard();

    await waitFor(() => expect(noticeHeadings()).toHaveLength(1));
    expect(
      screen.getByText('accountNotices.categoriesCopiedBody {"categories":"Food and Rent"}')
    ).toBeInTheDocument();
    expect(screen.queryByText(/accountNotices\.more/)).toBeNull();
  });

  test('dismissing hides it, POSTs to its own endpoint, and moves focus to the next notice', async () => {
    const { fetchMock } = serve([
      n('t', 'household_transferred', { household: 'Home', seniority: true }),
      n('c', 'categories_copied', { categories: ['Food'], shared_household: true }),
    ]);
    renderCard();

    await waitFor(() => expect(noticeHeadings()).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('button', { name: 'accountNotices.dismiss' })[0]!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/notices/t/dismiss', { method: 'POST' })
    );
    await waitFor(() => expect(noticeHeadings()).toHaveLength(1));
    expect(noticeHeadings()[0]!.textContent).toContain('categoriesCopiedTitle');
    // The persisted cache is refreshed after the accepted dismissal, so the next
    // visit does not flash the dismissed notice from localStorage.
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([u, i]) => u === '/api/notices' && !i)).toHaveLength(2)
    );
    // Focus is not dropped on the page: it is on the remaining notice's button.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'accountNotices.dismiss' })
      )
    );
  });

  test('a refused dismissal hides it at once, then brings it back (never silently lost)', async () => {
    const { fetchMock, release } = serve(
      [n('t', 'household_transferred', { household: 'Home', seniority: true })],
      500
    );
    renderCard();

    await waitFor(() => expect(noticeHeadings()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'accountNotices.dismiss' }));

    // Optimistically hidden while the server is still answering...
    await waitFor(() => expect(noticeHeadings()).toHaveLength(0));
    expect(fetchMock).toHaveBeenCalledWith('/api/notices/t/dismiss', { method: 'POST' });
    // ...and back once the server refuses.
    release();
    await waitFor(() => expect(noticeHeadings()).toHaveLength(1));
    expect(noticeHeadings()[0]!.textContent).toContain('householdTransferredTitle');
  });
});

describe('AccountNoticesCard: dismissal stays true to the server', () => {
  /** Per-notice dismissal outcomes; GETs can be made to fail after a POST. */
  function serveScripted(
    initial: AccountNotice[],
    refuse: string[],
    { failGetsAfterPost = false } = {}
  ) {
    let list = [...initial];
    let posted = false;
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posted = true;
        const id = url.split('/')[3]!;
        if (refuse.includes(id)) {
          return { ok: false, status: 500, json: async () => ({}) } as Response;
        }
        list = list.filter((x) => x.id !== id);
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      }
      if (posted && failGetsAfterPost) {
        return { ok: false, status: 500, json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ data: list }) } as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  test('one dismissed, the next REFUSED: the first stays gone, the second comes back (the server is the truth)', async () => {
    serveScripted(
      [
        n('t', 'household_transferred', { household: 'Home', seniority: true }),
        n('c', 'categories_copied', { categories: ['Food'], shared_household: true }),
      ],
      ['c']
    );
    renderCard();

    await waitFor(() => expect(noticeHeadings()).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('button', { name: 'accountNotices.dismiss' })[0]!);
    await waitFor(() => expect(noticeHeadings()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'accountNotices.dismiss' }));

    await waitFor(() => {
      expect(noticeHeadings()).toHaveLength(1);
      expect(noticeHeadings()[0]!.textContent).toContain('categoriesCopiedTitle');
    });
    // And it stays that way: the dismissed one does not come back later.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(noticeHeadings().map((h) => h.textContent)).toEqual([
      'accountNotices.categoriesCopiedTitle {"categories":"Food"}',
    ]);
  });

  test('a refused dismissal comes back even when the refetch fails too (it is un-hidden, not refetched)', async () => {
    serveScripted(
      [n('t', 'household_transferred', { household: 'Home', seniority: true })],
      ['t'],
      {
        failGetsAfterPost: true,
      }
    );
    renderCard();

    await waitFor(() => expect(noticeHeadings()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'accountNotices.dismiss' }));

    await waitFor(() => expect(noticeHeadings()).toHaveLength(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(noticeHeadings()[0]!.textContent).toContain('householdTransferredTitle');
  });
});

describe('AccountNoticesCard: a second dismissal while the first is still in flight', () => {
  test('the first never reappears (each dismissal hides only its own id, and a refetch cannot unhide it)', async () => {
    let list = [
      n('t', 'household_transferred', { household: 'Home', seniority: true }),
      n('c', 'categories_copied', { categories: ['Food'], shared_household: true }),
    ];
    let releaseFirst: () => void = () => {};
    const firstHeld = new Promise<void>((r) => (releaseFirst = r));
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const id = url.split('/')[3]!;
        if (id === 't') await firstHeld; // the first dismissal is slow
        list = list.filter((x) => x.id !== id);
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ data: list }) } as Response;
    }) as unknown as typeof fetch;
    renderCard();

    await waitFor(() => expect(noticeHeadings()).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('button', { name: 'accountNotices.dismiss' })[0]!); // t, held
    await waitFor(() => expect(noticeHeadings()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'accountNotices.dismiss' })); // c, while t is pending

    // While t's request is still pending, t must not come back.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(noticeHeadings()).toHaveLength(0);

    releaseFirst();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(noticeHeadings()).toHaveLength(0);
  });
});
