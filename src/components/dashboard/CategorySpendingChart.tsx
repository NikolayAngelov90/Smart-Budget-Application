'use client';

/**
 * CategorySpendingChart Component
 * Story 5.3: Monthly Spending by Category (Pie/Donut Chart)
 * Story 5.6: Added onClick handler for drill-down navigation
 * Story 7.3: Refactored to use centralized Realtime subscription manager
 * HP-1: follows the dashboard period selector; localized.
 *
 * Displays expense breakdown by category using Recharts PieChart
 */

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import {
  Box,
  Text,
  VStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Skeleton,
} from '@chakra-ui/react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { useSpendingByCategory } from '@/lib/hooks/useSpendingByCategory';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatCurrency } from '@/lib/utils/currency';
import { useChartColors } from '@/lib/hooks/useChartColors';
import type { DashboardPeriod } from '@/lib/utils/dashboardPeriod';

export interface CategorySpendingChartProps {
  month?: string; // YYYY-MM format, defaults to current month
  /** Dashboard period. Ignored when an explicit `month` is given. */
  period?: DashboardPeriod;
  chartType?: 'pie' | 'donut'; // Default: 'donut'
  height?: number; // Default: 300
}

/** Empty-state copy per period. A lookup, not a built string: Bulgarian
 *  inflects these differently and interpolation produces broken grammar. */
const EMPTY_COPY: Record<DashboardPeriod, string> = {
  week: 'noExpensesWeek',
  month: 'noExpensesMonth',
  quarter: 'noExpensesQuarter',
  year: 'noExpensesYear',
};

interface ChartDataPoint {
  name: string;
  value: number;
  color: string;
  percentage: number;
  category_id: string;
  [key: string]: string | number; // Index signature for Recharts compatibility
}

export function CategorySpendingChart({
  month,
  period,
  chartType = 'donut',
  height = 300,
}: CategorySpendingChartProps) {
  const t = useTranslations('dashboard');
  const chart = useChartColors();
  const { data, error, isLoading, mutate } = useSpendingByCategory(month, period);
  const { preferences } = useUserPreferences();
  const router = useRouter();
  const currencyCode = preferences?.currency_format;

  // Empty-state copy follows the window the SERVER aggregated, not the pending
  // selection: `keepPreviousData` keeps the outgoing figures on screen while the
  // next window loads, so labelling by selection would caption this year's
  // request with last month's data (the Story 16-6 lesson).
  const shownPeriod = data?.period ?? period ?? 'month';

  // Get current month in YYYY-MM format for drill-down navigation
  const currentMonth = month || data?.month || format(new Date(), 'yyyy-MM');

  // Subscribe to real-time transaction changes via centralized manager
  useRealtimeSubscription((event) => {
    console.log('[CategorySpendingChart] Realtime update received:', event.eventType);
    mutate();
  });

  // Error state
  if (error) {
    return (
      <Box p={6} bg="surface" borderRadius="lg" boxShadow="sm" borderWidth="1px" borderColor="border">
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertTitle>{t('categoryChartError')}</AlertTitle>
          <AlertDescription>{t('categoryChartErrorHint')}</AlertDescription>
        </Alert>
      </Box>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Box p={6} bg="surface" borderRadius="lg" boxShadow="sm" borderWidth="1px" borderColor="border">
        <Skeleton height="32px" width="250px" mb={4} />
        <Skeleton height={`${height}px`} borderRadius="md" />
      </Box>
    );
  }

  // Empty state
  if (!data || data.categories.length === 0) {
    return (
      // The card title lives on the page (one heading per card — the two used
      // to render on top of each other, the page's localized and this one's
      // hardcoded English).
      <Box p={6} bg="surface" borderRadius="lg" boxShadow="sm" borderWidth="1px" borderColor="border">
        <VStack py={8} spacing={3}>
          <Text fontSize="4xl" color="fg.subtle" aria-hidden="true">
            📊
          </Text>
          <Text fontSize="lg" fontWeight="medium" color="fg.muted">
            {t(EMPTY_COPY[shownPeriod])}
          </Text>
          <Text fontSize="sm" color="fg.subtle" textAlign="center">
            {t('noExpensesHint')}
          </Text>
        </VStack>
      </Box>
    );
  }

  // Prepare chart data
  const chartData: ChartDataPoint[] = data.categories.map((cat) => ({
    name: cat.category_name,
    value: cat.amount,
    color: cat.category_color,
    percentage: cat.percentage,
    category_id: cat.category_id,
  }));

  // Handle pie slice click for drill-down navigation (Story 5.6)
  const handlePieClick = (data: ChartDataPoint) => {
    router.push(`/transactions?category=${data.category_id}&month=${currentMonth}`);
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) => {
    if (active && payload && payload.length) {
      const firstPayload = payload[0];
      if (!firstPayload) return null;
      const data = firstPayload.payload;
      return (
        <Box
          bg="surface"
          p={3}
          borderRadius="md"
          boxShadow="lg"
          borderWidth="1px"
          borderColor="border"
        >
          <Text fontWeight="bold" fontSize="sm" mb={1}>
            {data.name}
          </Text>
          <Text fontSize="sm" color="fg">
            {formatCurrency(data.value, undefined, currencyCode)}
          </Text>
          <Text fontSize="xs" color="fg.subtle">
            {t('ofTotal', { percent: data.percentage.toFixed(1) })}
          </Text>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box
      p={6}
      bg="surface"
      borderRadius="lg"
      boxShadow="sm"
      borderWidth="1px"
      borderColor="border"
    >
      <VStack align="stretch" spacing={4}>
        {/* No heading here: the page titles this card. Rendering one in both
            places printed it twice, and only the page's was localized. */}
        <Text fontSize="sm" color="fg.muted">
          {t('categoryChartTotal', {
            amount: formatCurrency(data.total, undefined, currencyCode),
          })}
        </Text>

        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              innerRadius={chartType === 'donut' ? 50 : 0}
              fill={chart.accent}
              dataKey="value"
              onClick={(data) => handlePieClick(data)}
              cursor="pointer"
              role="button"
              tabIndex={0}
              aria-label={t('categoryChartAria')}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span style={{ fontSize: '14px', color: chart.tick }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Accessible data table (visually hidden) */}
        <table
          aria-label={t('categoryTableLabel')}
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          <thead>
            <tr>
              <th>{t('tableCategory')}</th>
              <th>{t('tableAmount')}</th>
              <th>{t('tablePercentage')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.categories.map((cat) => (
              <tr key={cat.category_id}>
                <td>{cat.category_name}</td>
                <td>{formatCurrency(cat.amount, undefined, currencyCode)}</td>
                <td>{cat.percentage.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VStack>
    </Box>
  );
}
