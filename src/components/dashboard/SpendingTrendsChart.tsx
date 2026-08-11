'use client';

/**
 * SpendingTrendsChart Component
 * Story 5.4: Spending Trends Over Time (Line Chart)
 * Story 5.6: Added onClick handler for drill-down navigation
 * Story 7.3: Refactored to use centralized Realtime subscription manager
 *
 * Displays a line chart showing income vs expenses trends over the last 6 months
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Box,
  Text,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Flex,
  Icon,
  useBreakpointValue,
  Skeleton,
} from '@chakra-ui/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { MdShowChart } from 'react-icons/md';
import { useTrends, MonthlyTrendData } from '@/lib/hooks/useTrends';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatCurrency } from '@/lib/utils/currency';
import { useChartColors } from '@/lib/hooks/useChartColors';

/**
 * Component props
 */
export interface SpendingTrendsChartProps {
  months?: number;                    // Number of months to display (default 6)
  height?: number;                    // Chart height in pixels (default 300)
}

/**
 * Recharts data format for line chart
 */
interface LineChartDataPoint {
  month: string;                      // Month label ("Jan", "Feb", etc.)
  monthYYYYMM: string;                // Month in YYYY-MM format for navigation
  income: number;                     // Income amount
  expenses: number;                   // Expenses amount
  [key: string]: string | number;     // Index signature for Recharts compatibility
}

/**
 * SpendingTrendsChart Component
 * Renders a responsive line chart showing income vs expenses trends
 */
export function SpendingTrendsChart({
  months = 6,
  height = 300,
}: SpendingTrendsChartProps) {
  const t = useTranslations('dashboard');
  // `ssr: false` so this resolves on the first CLIENT render instead of
  // returning `undefined` and then flipping. Without it a phone painted "Last 6
  // months", fired a `months=6` request, then re-rendered to 3 and fired a
  // SECOND request — a visible caption flip and a wasted fetch on every mobile
  // dashboard load, showing the mislabelled window this change exists to fix.
  const isMobile = useBreakpointValue({ base: true, md: false }, { ssr: false });
  const requestedMonths = isMobile ? 3 : months;
  const { data, error, isLoading, mutate } = useTrends(requestedMonths);
  const { preferences } = useUserPreferences();
  const router = useRouter();
  const currencyCode = preferences?.currency_format;
  // Mode-aware palette — recharts takes raw colour strings, so light-mode hex
  // would be unreadable on the dark canvas.
  const chart = useChartColors();

  /**
   * Custom tooltip component for line chart
   */
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      payload: LineChartDataPoint;
      dataKey?: string;
      value?: number;
    }>;
  }) => {
    if (active && payload && payload.length) {
      const firstPayload = payload[0];
      if (!firstPayload) return null;
      const tooltipData = firstPayload.payload as LineChartDataPoint;
      const income = payload.find((p: { dataKey?: string; value?: number }) => p.dataKey === 'income')?.value ?? 0;
      const expenses = payload.find((p: { dataKey?: string; value?: number }) => p.dataKey === 'expenses')?.value ?? 0;

      return (
        <Box
          bg="surface"
          p={3}
          borderRadius="md"
          boxShadow="lg"
          borderWidth="1px"
          borderColor="border"
        >
          <Text fontWeight="bold" fontSize="sm" mb={2}>
            {tooltipData.month}
          </Text>
          <Text fontSize="sm" color="income" mb={1}>
            {t('seriesIncome')}: {formatCurrency(Number(income), undefined, currencyCode)}
          </Text>
          <Text fontSize="sm" color="expense">
            {t('seriesExpenses')}: {formatCurrency(Number(expenses), undefined, currencyCode)}
          </Text>
        </Box>
      );
    }
    return null;
  };

  // Subscribe to real-time transaction changes via centralized manager
  useRealtimeSubscription((event) => {
    console.log('[SpendingTrendsChart] Realtime update received:', event.eventType);
    // Revalidate trends data immediately when any transaction changes
    mutate();
  });

  // Error state
  if (error) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        <AlertTitle>{t('trendsError')}</AlertTitle>
        <AlertDescription>{t('trendsErrorHint')}</AlertDescription>
      </Alert>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Box p={6} bg="surface" borderRadius="lg" boxShadow="sm" borderWidth="1px" borderColor="border">
        <Skeleton height="32px" width="220px" mb={4} />
        <Skeleton height={`${height}px`} borderRadius="md" />
      </Box>
    );
  }

  // Transform data for Recharts
  const chartData: LineChartDataPoint[] =
    data?.months.map((monthData: MonthlyTrendData) => ({
      month: monthData.monthLabel,
      monthYYYYMM: monthData.month, // YYYY-MM format for navigation
      income: monthData.income,
      expenses: monthData.expenses,
    })) ?? [];

  // Handle line chart click for drill-down navigation (Story 5.6)
  const handleLineClick = (data: LineChartDataPoint | null) => {
    if (data && data.monthYYYYMM) {
      router.push(`/transactions?month=${data.monthYYYYMM}`);
    }
  };

  // Empty state
  if (!isLoading && chartData.length === 0) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        minH={`${height}px`}
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
        bg="surface.sunken"
      >
        <Icon as={MdShowChart} boxSize={12} color="fg.subtle" mb={3} />
        <Text fontSize="lg" fontWeight="medium" color="fg.muted">
          {t('trendsEmpty')}
        </Text>
        <Text fontSize="sm" color="fg.subtle" mt={1}>
          {t('trendsEmptyHint')}
        </Text>
      </Flex>
    );
  }

  // Check if all months have zero values
  const hasData = chartData.some((d) => d.income > 0 || d.expenses > 0);

  if (!isLoading && !hasData) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        minH={`${height}px`}
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
        bg="surface.sunken"
      >
        <Icon as={MdShowChart} boxSize={12} color="fg.subtle" mb={3} />
        <Text fontSize="lg" fontWeight="medium" color="fg.muted">
          {t('trendsEmpty')}
        </Text>
        <Text fontSize="sm" color="fg.subtle" mt={1}>
          {t('trendsEmptyHint')}
        </Text>
      </Flex>
    );
  }

  return (
    <Box>
      {/* States the window actually DRAWN, counted from the response — not the
          number requested.
          The page heading used to carry "(Last 6 Months)" while the chart
          dropped to 3 points on mobile. HP-1 fixed that by labelling from the
          request, which is still the wrong source: a user with two months of
          history got a 2-point line under "Last 6 months", because the point
          count comes from the API. The sibling donut labels from `data.period`
          for exactly this reason. */}
      <Text fontSize="sm" color="fg.muted" mb={2}>
        {t('spendingTrendsWindow', { count: chartData.length || requestedMonths })}
      </Text>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onClick={(data) => {
            if (data && data.activeTooltipIndex != null) {
              const point = chartData[data.activeTooltipIndex as number];
              if (point) handleLineClick(point);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={t('trendsChartAria')}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
          <XAxis
            dataKey="month"
            stroke={chart.axis}
            tick={{ fill: chart.tick, fontSize: 12 }}
          />
          <YAxis
            stroke={chart.axis}
            tick={{ fill: chart.tick, fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value, undefined, currencyCode)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: chart.cursor, strokeWidth: 2 }} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="line"
            wrapperStyle={{ paddingTop: '10px' }}
          />
          <Line
            type="monotone"
            dataKey="income"
            name={t('seriesIncome')}
            stroke={chart.income}
            strokeWidth={2}
            dot={{ fill: chart.income, r: 4, cursor: 'pointer' }}
            activeDot={{ r: 6, cursor: 'pointer' }}
            cursor="pointer"
          />
          <Line
            type="monotone"
            dataKey="expenses"
            name={t('seriesExpenses')}
            stroke={chart.expense}
            strokeWidth={2}
            dot={{ fill: chart.expense, r: 4, cursor: 'pointer' }}
            activeDot={{ r: 6, cursor: 'pointer' }}
            cursor="pointer"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Accessible data table (visually hidden) */}
      <table
        aria-label={t('trendsTableLabel')}
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
            <th>{t('tableMonth')}</th>
            <th>{t('seriesIncome')}</th>
            <th>{t('seriesExpenses')}</th>
            <th>{t('tableNet')}</th>
          </tr>
        </thead>
        <tbody>
          {data?.months.map((monthData: MonthlyTrendData) => (
            <tr key={monthData.month}>
              <td>{monthData.monthLabel}</td>
              <td>{formatCurrency(monthData.income, undefined, currencyCode)}</td>
              <td>{formatCurrency(monthData.expenses, undefined, currencyCode)}</td>
              <td>{formatCurrency(monthData.net, undefined, currencyCode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}
