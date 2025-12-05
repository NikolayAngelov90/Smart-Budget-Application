import type { Metadata } from 'next';
import { AppLayout } from '@/components/layout/AppLayout';

export const metadata: Metadata = {
  title: 'AI Insights | Smart Budget',
  description: 'View and manage your personalized AI budget insights',
};

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
