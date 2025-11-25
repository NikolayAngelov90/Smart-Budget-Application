'use client';

/**
 * CategorySpendingChart Component
 * Story 5.3: Monthly Spending by Category (Pie/Donut Chart)
 *
 * Displays expense breakdown by category using Recharts PieChart
 */

import { useEffect } from 'react';
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
import { formatCurrency } from '@/lib/utils/currency';
import { createClient } from '@/lib/supabase/client';

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
  [key: string]: string | number; // Index signature for Recharts compatibility
}

export function CategorySpendingChart({
  month,
  chartType = 'donut',
  height = 300,
}: CategorySpendingChartProps) {
  const { data, error, isLoading, mutate } = useSpendingByCategory(month);
  const supabase = createClient();

  // Subscribe to real-time transaction changes
  useEffect(() => {
    const channel = supabase
      .channel('spending-by-category-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('[CategorySpendingChart] Realtime update received:', payload.eventType);
          mutate();
        }
      )
      .subscribe((status) => {
        console.log('[CategorySpendingChart] Realtime subscription status:', status);
      });

    return () => {
      console.log('[CategorySpendingChart] Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [supabase, mutate]);

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
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
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
      </VStack>
    </Box>
  );
}
