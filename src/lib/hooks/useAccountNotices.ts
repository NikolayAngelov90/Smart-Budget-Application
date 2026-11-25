'use client';

/**
 * The signed-in person's undismissed account notices
 * (spec-account-deletion-notifications), biggest change first.
 *
 * `dismiss` hides the notice at once (optimistic) and rolls back if the server
 * refuses, so a failed dismissal shows the notice again instead of losing it.
 * It uses the hook's own bound `mutate`: the global one is inert under the
 * localStorage cache provider.
 */

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { byPriority, type AccountNotice } from '@/lib/accountNotices/noticeMessage';

export const ACCOUNT_NOTICES_KEY = '/api/notices';

async function fetcher(url: string): Promise<AccountNotice[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch account notices');
  const body = (await response.json()) as { data?: AccountNotice[] };
  return body.data ?? [];
}

export interface UseAccountNoticesResult {
  notices: AccountNotice[];
  isLoading: boolean;
  dismiss: (id: string) => Promise<void>;
}

export function useAccountNotices(): UseAccountNoticesResult {
  const { data, isLoading, mutate } = useSWR<AccountNotice[]>(ACCOUNT_NOTICES_KEY, fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const notices = useMemo(() => [...(data ?? [])].sort(byPriority), [data]);

  const dismiss = useCallback(
    async (id: string): Promise<void> => {
      const without = (current: AccountNotice[] | undefined) =>
        (current ?? []).filter((n) => n.id !== id);
      try {
        await mutate(
          async (current) => {
            const res = await fetch(`/api/notices/${id}/dismiss`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to dismiss notice');
            return without(current);
          },
          { optimisticData: without, rollbackOnError: true, revalidate: false }
        );
      } catch {
        // Rolled back: the notice is shown again, and the next dismiss retries.
      }
    },
    [mutate]
  );

  return { notices, isLoading, dismiss };
}
