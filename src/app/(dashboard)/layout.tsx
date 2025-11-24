import type { Metadata } from 'next';
import { AppLayout } from '@/components/layout/AppLayout';

export const metadata: Metadata = {
  title: 'Dashboard | Smart Budget',
  description: 'Your financial dashboard with AI-powered insights',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
