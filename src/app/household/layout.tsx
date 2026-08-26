import type { Metadata } from 'next';
import { AppLayout } from '@/components/layout/AppLayout';
import { HouseholdRealtimeProvider } from '@/components/household/HouseholdRealtimeProvider';

export const metadata: Metadata = {
  title: 'Household | Smart Budget',
  description: 'Shared household spending, contributions, and goals',
};

/**
 * Story 17.1: the realtime revalidation is mounted HERE rather than on each
 * page, so it survives navigation between the index and its sub-pages. This
 * file stays a server component because it exports `metadata`, so the
 * subscription lives in a client child.
 */
export default function HouseholdLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <HouseholdRealtimeProvider>{children}</HouseholdRealtimeProvider>
    </AppLayout>
  );
}
