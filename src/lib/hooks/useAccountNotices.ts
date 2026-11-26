'use client';

/**
 * The signed-in person's undismissed account notices
 * (spec-account-deletion-notifications), biggest change first.
 *
 * DISMISSAL, CONCURRENCY-SAFE. A dismissed notice is HIDDEN at once (a set of
 * ids local to this hook) and the list shown is the server's list minus that
 * set. Each dismissal touches only its own id:
 *   - refused -> its id is un-hidden, so it shows again (never silently lost);
 *   - accepted -> it stays hidden, and the cache is refreshed so the next visit
 *     (the cache persists in localStorage) does not flash it.
 * SWR's optimistic rollback was not used for this on purpose: rolling back one
 * dismissal restores a snapshot that can bring back ANOTHER, and a refetch that
 * lands while a dismissal is still in flight brings that one back (review 1).
 */

import { useCallback, useMemo, useState } from 'react';
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
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());

  const notices = useMemo(
    () => (data ?? []).filter((n) => !hidden.has(n.id)).sort(byPriority),
    [data, hidden]
  );

  const dismiss = useCallback(
    async (id: string): Promise<void> => {
      setHidden((prev) => new Set(prev).add(id));
      try {
        const res = await fetch(`/api/notices/${id}/dismiss`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to dismiss notice');
        // Accepted: keep it hidden; bring the persisted cache up to date.
        void mutate();
      } catch {
        // Refused (or offline): show THIS one again; the next dismiss retries.
        setHidden((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [mutate]
  );

  return { notices, isLoading, dismiss };
}
