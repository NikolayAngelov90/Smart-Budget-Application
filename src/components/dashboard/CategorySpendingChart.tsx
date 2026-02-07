'use client';

/**
 * CategorySpendingChart Component
 * Story 5.3: Monthly Spending by Category (Pie/Donut Chart)
 * Story 5.6: Added onClick handler for drill-down navigation
 * Story 7.3: Refactored to use centralized Realtime subscription manager
 *
 * Displays expense breakdown by category using Recharts PieChart
 */

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Box,
  Heading,
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
import { formatCurrency } from '@/lib/utils/currency';

export interface CategorySpendingChartProps {
  month?: string; // YYYY-MM format, defaults to current month
  chartType?: 'pie' | 'donut'; // Default: 'donut'
  height?: number; // Default: 300
}

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
  chartType = 'donut',
  height = 300,
}: CategorySpendingChartProps) {
  const { data, error, isLoading, mutate } = useSpendingByCategory(month);
  const router = useRouter();

  // Get current month in YYYY-MM format for drill-down navigation
  const currentMonth = month || format(new Date(), 'yyyy-MM');

  // Subscribe to real-time transaction changes via centralized manager
  useRealtimeSubscription((event) => {
    console.log('[CategorySpendingChart] Realtime update received:', event.eventType);
    mutate();
  });

  // Error state
  if (error) {
    return (
      <Box p={6} bg="white" borderRadius="lg" boxShadow="sm" borderWidth="1px" borderColor="gray.200">
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertTitle>Failed to load spending data</AlertTitle>
          <AlertDescription>
            Unable to fetch category spending breakdown. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Box>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Box p={6} bg="white" borderRadius="lg" boxShadow="sm" borderWidth="1px" borderColor="gray.200">
        <Skeleton height="32px" width="250px" mb={4} />
        <Skeleton height={`${height}px`} borderRadius="md" />
      </Box>
    );
  }

  // Empty state
  if (!data || data.categories.length === 0) {
    return (
      <Box p={6} bg="white" borderRadius="lg" boxShadow="sm" borderWidth="1px" borderColor="gray.200">
        <Heading as="h3" size="md" mb={4} color="gray.700">
          Spending by Category
        </Heading>
        <VStack py={8} spacing={3}>
          <Text fontSize="4xl" color="gray.400">
            📊
          </Text>
          <Text fontSize="lg" fontWeight="medium" color="gray.600">
            No expenses this month
          </Text>
          <Text fontSize="sm" color="gray.500">
            Start adding transactions to see your spending breakdown
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
          bg="white"
          p={3}
          borderRadius="md"
          boxShadow="lg"
          borderWidth="1px"
          borderColor="gray.200"
        >
          <Text fontWeight="bold" fontSize="sm" mb={1}>
            {data.name}
          </Text>
          <Text fontSize="sm" color="gray.700">
            {formatCurrency(data.value)}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {data.percentage.toFixed(1)}% of total
          </Text>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box
      p={6}
      bg="white"
      borderRadius="lg"
      boxShadow="sm"
      borderWidth="1px"
      borderColor="gray.200"
    >
      <VStack align="stretch" spacing={4}>
        <Box>
          <Heading as="h3" size="md" color="gray.700" mb={1}>
            Spending by Category
          </Heading>
          <Text fontSize="sm" color="gray.600">
            Total: {formatCurrency(data.total)}
          </Text>
        </Box>

        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              innerRadius={chartType === 'donut' ? 50 : 0}
              fill="#8884d8"
              dataKey="value"
              onClick={(data) => handlePieClick(data)}
              cursor="pointer"
              role="button"
              tabIndex={0}
              aria-label="Category spending chart. Click on a category to view detailed transactions."
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
                <span style={{ fontSize: '14px', color: '#4A5568' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Accessible data table (visually hidden) */}
        <table
          aria-label="Category spending breakdown"
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
              <th>Category</th>
              <th>Amount</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {data?.categories.map((cat) => (
              <tr key={cat.category_id}>
                <td>{cat.category_name}</td>
                <td>{formatCurrency(cat.amount)}</td>
                <td>{cat.percentage.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VStack>
    </Box>
  );
}
