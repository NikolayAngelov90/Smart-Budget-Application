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
import { formatCurrency } from '@/lib/utils/currency';

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
 * Custom tooltip component for line chart
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: LineChartDataPoint;
    dataKey?: string;
    value?: number;
  }>;
}) {
  if (active && payload && payload.length) {
    const firstPayload = payload[0];
    if (!firstPayload) return null;
    const data = firstPayload.payload as LineChartDataPoint;
    const income = payload.find((p: { dataKey?: string; value?: number }) => p.dataKey === 'income')?.value ?? 0;
    const expenses = payload.find((p: { dataKey?: string; value?: number }) => p.dataKey === 'expenses')?.value ?? 0;

    return (
      <Box
        bg="white"
        p={3}
        borderRadius="md"
        boxShadow="lg"
        borderWidth="1px"
        borderColor="gray.200"
      >
        <Text fontWeight="bold" fontSize="sm" mb={2}>
          {data.month}
        </Text>
        <Text fontSize="sm" color="green.600" mb={1}>
          Income: {formatCurrency(Number(income))}
        </Text>
        <Text fontSize="sm" color="red.600">
          Expenses: {formatCurrency(Number(expenses))}
        </Text>
      </Box>
    );
  }
  return null;
}

/**
 * SpendingTrendsChart Component
 * Renders a responsive line chart showing income vs expenses trends
 */
export function SpendingTrendsChart({
  months = 6,
  height = 300,
}: SpendingTrendsChartProps) {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { data, error, isLoading, mutate } = useTrends(isMobile ? 3 : months);
  const router = useRouter();

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
        <AlertTitle>Failed to load spending trends</AlertTitle>
        <AlertDescription>
          Unable to fetch trends data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Box p={6} bg="white" borderRadius="lg" boxShadow="sm" borderWidth="1px" borderColor="gray.200">
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
        borderColor="gray.200"
        borderRadius="md"
        bg="gray.50"
      >
        <Icon as={MdShowChart} boxSize={12} color="gray.400" mb={3} />
        <Text fontSize="lg" fontWeight="medium" color="gray.600">
          Add transactions to see trends
        </Text>
        <Text fontSize="sm" color="gray.500" mt={1}>
          Your spending patterns will appear here
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
        borderColor="gray.200"
        borderRadius="md"
        bg="gray.50"
      >
        <Icon as={MdShowChart} boxSize={12} color="gray.400" mb={3} />
        <Text fontSize="lg" fontWeight="medium" color="gray.600">
          Add transactions to see trends
        </Text>
        <Text fontSize="sm" color="gray.500" mt={1}>
          Your spending patterns will appear here
        </Text>
      </Flex>
    );
  }

  return (
    <Box>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(data: any) => {
            if (data && data.activePayload && data.activePayload.length > 0) {
              handleLineClick(data.activePayload[0].payload);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Spending trends chart. Click on a data point to view transactions for that month."
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            dataKey="month"
            stroke="#718096"
            tick={{ fill: '#4A5568', fontSize: 12 }}
          />
          <YAxis
            stroke="#718096"
            tick={{ fill: '#4A5568', fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#CBD5E0', strokeWidth: 2 }} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="line"
            wrapperStyle={{ paddingTop: '10px' }}
          />
          <Line
            type="monotone"
            dataKey="income"
            name="Income"
            stroke="#38A169"
            strokeWidth={2}
            dot={{ fill: '#38A169', r: 4, cursor: 'pointer' }}
            activeDot={{ r: 6, cursor: 'pointer' }}
            cursor="pointer"
          />
          <Line
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke="#E53E3E"
            strokeWidth={2}
            dot={{ fill: '#E53E3E', r: 4, cursor: 'pointer' }}
            activeDot={{ r: 6, cursor: 'pointer' }}
            cursor="pointer"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Accessible data table (visually hidden) */}
      <table
        aria-label="Spending trends over time"
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
            <th>Month</th>
            <th>Income</th>
            <th>Expenses</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          {data?.months.map((monthData: MonthlyTrendData) => (
            <tr key={monthData.month}>
              <td>{monthData.monthLabel}</td>
              <td>{formatCurrency(monthData.income)}</td>
              <td>{formatCurrency(monthData.expenses)}</td>
              <td>{formatCurrency(monthData.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}
