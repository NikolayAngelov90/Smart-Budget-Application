/**
 * Analytics charts tests — Story 12.8
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { InsightEngagementChart } from '@/components/analytics/InsightEngagementChart';
import { ExportUsageChart } from '@/components/analytics/ExportUsageChart';
import { PwaInstallsChart } from '@/components/analytics/PwaInstallsChart';
import { WauTrendChart } from '@/components/analytics/WauTrendChart';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Recharts ResponsiveContainer needs a non-zero size in jsdom
jest.mock('recharts', () => {
  const Original = jest.requireActual('recharts');
  return {
    ...Original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 300 }}>{children}</div>
    ),
  };
});

const renderWithChakra = (ui: React.ReactElement) => render(<ChakraProvider>{ui}</ChakraProvider>);

describe('analytics charts', () => {
  describe('InsightEngagementChart', () => {
    it('shows no-data message when empty', () => {
      renderWithChakra(<InsightEngagementChart data={[]} />);
      expect(screen.getByText('noData')).toBeInTheDocument();
    });

    it('renders the section heading with data', () => {
      renderWithChakra(
        <InsightEngagementChart data={[{ insight_type: 'spending_anomaly', views: 5, dismissals: 2 }]} />
      );
      expect(screen.getByRole('heading', { name: 'insightEngagement' })).toBeInTheDocument();
      expect(screen.queryByText('noData')).not.toBeInTheDocument();
    });
  });

  describe('ExportUsageChart', () => {
    it('shows no-data when both counts are zero', () => {
      renderWithChakra(<ExportUsageChart data={{ csv_count: 0, pdf_count: 0, csv_total_transactions: 0, pdf_total_pages: 0 }} />);
      expect(screen.getByText('noData')).toBeInTheDocument();
    });

    it('renders volume stats with data', () => {
      renderWithChakra(<ExportUsageChart data={{ csv_count: 3, pdf_count: 1, csv_total_transactions: 42, pdf_total_pages: 5 }} />);
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('PwaInstallsChart', () => {
    it('shows total and no-data when empty', () => {
      renderWithChakra(<PwaInstallsChart data={[]} total={0} />);
      expect(screen.getByText('noData')).toBeInTheDocument();
    });

    it('renders with platform data', () => {
      renderWithChakra(<PwaInstallsChart data={[{ platform: 'iOS', count: 4 }]} total={4} />);
      expect(screen.getByRole('heading', { name: 'pwaInstalls' })).toBeInTheDocument();
      expect(screen.queryByText('noData')).not.toBeInTheDocument();
    });
  });

  describe('WauTrendChart', () => {
    it('shows no-data when empty', () => {
      renderWithChakra(<WauTrendChart data={[]} />);
      expect(screen.getByText('noData')).toBeInTheDocument();
    });

    it('renders with weekly data', () => {
      renderWithChakra(<WauTrendChart data={[{ week_start: '2026-06-01', active_users: 3 }]} />);
      expect(screen.getByRole('heading', { name: 'wauTrend' })).toBeInTheDocument();
    });
  });
});
