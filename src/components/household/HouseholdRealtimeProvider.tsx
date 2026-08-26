'use client';

/**
 * Keeps household aggregates fresh on every /household route — Story 17.1.
 *
 * This logic lived in `src/app/household/page.tsx` when Household was one page.
 * Now that it is an index plus four sub-pages, it is mounted once by
 * `src/app/household/layout.tsx` so it keeps working on whichever route is
 * showing, instead of being copied five times.
 *
 * WHY A COMPONENT AND NOT THE LAYOUT ITSELF: `layout.tsx` is a server component
 * exporting `metadata`, and `'use client'` cannot coexist with that export. So
 * the layout stays a server component and renders this around its children.
 *
 * Everything below is carried over verbatim, and each part earns its place:
 *
 *  - SCOPED mutate from `useSWRConfig`. The global `mutate` imported from 'swr'
 *    binds to SWR's own default cache while every hook here reads the
 *    localStorage provider, so those revalidations were silent no-ops (15-1).
 *  - 150ms trailing guard, so a burst of inserts from another member collapses
 *    into one refresh. SWR dedupes too, but this stops the burst at the source.
 *  - unmount cleanup, so a queued revalidation cannot fire after you leave.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';

export function HouseholdRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { mutate: globalMutate } = useSWRConfig();

  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revalidate = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      globalMutate('/api/households/category-totals');
      globalMutate('/api/households/contributions');
      globalMutate('/api/households/goals'); // a contribution also logs a transaction → keep goals fresh
      globalMutate('/api/households/insights'); // shared spend changed → recompute insights
    }, 150);
    // `mutate` from useSWRConfig is referentially stable.
  }, [globalMutate]);
  useRealtimeSubscription(revalidate);

  useEffect(() => () => {
    if (pending.current) clearTimeout(pending.current);
  }, []);

  return <>{children}</>;
}
