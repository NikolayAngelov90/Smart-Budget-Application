import type { Metadata } from 'next';
import { AppLayout } from '@/components/layout/AppLayout';

export const metadata: Metadata = {
  title: 'Household | Smart Budget',
  description: 'Shared household spending, contributions, and goals',
};

export default function HouseholdLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
