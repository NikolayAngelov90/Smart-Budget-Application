'use client';

/**
 * MonthOverMonth Component
 * Story 5.5: Month-over-Month Comparison Highlights
 *
 * Displays significant spending changes (>20%) between current and previous month
 */

import { useEffect } from 'react';
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
  List,
  ListItem,
  Badge,
  Skeleton,
  Stack,
} from '@chakra-ui/react';
import { MdTrendingUp, MdTrendingDown, MdShowChart } from 'react-icons/md';
import { useMonthOverMonth, CategoryChangeData } from '@/lib/hooks/useMonthOverMonth';
import { formatCurrency } from '@/lib/utils/currency';
import { createClient } from '@/lib/supabase/client';

/**
 * Component props
 */
export interface MonthOverMonthProps {
  month?: string;  // Optional month in YYYY-MM format (defaults to current)
}

/**
 * Individual change item component
 */
function ChangeItem({
  change,
  onClick,
}: {
  change: CategoryChangeData;
  onClick: () => void;
}) {
  const isIncrease = change.direction === 'increase';
  const ArrowIcon = isIncrease ? MdTrendingUp : MdTrendingDown;
  const colorScheme = isIncrease ? 'red' : 'green';
  const arrow = isIncrease ? '↑' : '↓';

  return (
    <ListItem
      p={3}
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="md"
      bg="white"
      cursor="pointer"
      onClick={onClick}
      _hover={{
        bg: 'gray.50',
        borderColor: 'gray.300',
        transform: 'translateY(-2px)',
        boxShadow: 'md',
      }}
      transition="all 0.2s"
    >
      <Flex align="center" justify="space-between" gap={3}>
        <Flex align="center" gap={2} flex={1}>
          <Icon
            as={ArrowIcon}
            boxSize={5}
            color={`${colorScheme}.500`}
          />
          <Text fontWeight="medium" fontSize="sm" noOfLines={1}>
            {change.categoryName}
          </Text>
        </Flex>

        <Flex align="center" gap={2}>
          <Badge
            colorScheme={colorScheme}
            fontSize="sm"
            px={2}
            py={1}
            borderRadius="md"
          >
            {arrow} {Math.abs(change.percentChange).toFixed(0)}%
          </Badge>
          <Text fontSize="xs" color="gray.600" whiteSpace="nowrap">
            {formatCurrency(change.currentAmount)} vs {formatCurrency(change.previousAmount)}
          </Text>
        </Flex>
      </Flex>
    </ListItem>
  );
}

/**
 * MonthOverMonth Component
 * Renders a list of significant spending changes between months
 */
export function MonthOverMonth({ month }: MonthOverMonthProps) {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useMonthOverMonth(month);
  const supabase = createClient();

  // Subscribe to real-time transaction changes
  useEffect(() => {
    const channel = supabase
      .channel('month-over-month-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('[MonthOverMonth] Realtime update received:', payload.eventType);
          // Revalidate comparison data immediately when any transaction changes
          mutate();
        }
      )
      .subscribe((status) => {
        console.log('[MonthOverMonth] Realtime subscription status:', status);
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('[MonthOverMonth] Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [supabase, mutate]);

  // Handle click navigation to transactions page with filters
  const handleCategoryClick = (categoryId: string, currentMonth: string) => {
    // Navigate to transactions page with category and month filters
    router.push(`/transactions?category=${categoryId}&month=${currentMonth}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <Box>
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          This Month vs Last Month
        </Text>
        <Stack spacing={3}>
          <Skeleton height="60px" borderRadius="md" />
          <Skeleton height="60px" borderRadius="md" />
          <Skeleton height="60px" borderRadius="md" />
        </Stack>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box>
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          This Month vs Last Month
        </Text>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertTitle>Failed to load comparison</AlertTitle>
          <AlertDescription>
            Unable to fetch month-over-month data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Box>
    );
  }

  // Empty state (no significant changes)
  if (!data || data.changes.length === 0) {
    return (
      <Box>
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          This Month vs Last Month
        </Text>
        <Flex
          direction="column"
          align="center"
          justify="center"
          minH="150px"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="md"
          bg="gray.50"
        >
          <Icon as={MdShowChart} boxSize={10} color="gray.400" mb={2} />
          <Text fontSize="md" fontWeight="medium" color="gray.600">
            No significant changes this month
          </Text>
          <Text fontSize="sm" color="gray.500" mt={1}>
            Spending changes &lt;20% are not shown
          </Text>
        </Flex>
      </Box>
    );
  }

  // Render changes list
  return (
    <Box>
      <Text fontSize="lg" fontWeight="bold" mb={4}>
        This Month vs Last Month
      </Text>
      <List spacing={3}>
        {data.changes.map((change) => (
          <ChangeItem
            key={change.categoryId}
            change={change}
            onClick={() => handleCategoryClick(change.categoryId, data.currentMonth)}
          />
        ))}
      </List>
    </Box>
  );
}
