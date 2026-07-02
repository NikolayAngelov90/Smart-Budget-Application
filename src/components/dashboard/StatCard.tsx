'use client';

/**
 * StatCard Component
 * Story 5.2: Financial Summary Cards
 *
 * Displays a financial metric with trend indicator
 */

import {
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Box,
  Skeleton,
  Icon as ChakraIcon,
} from '@chakra-ui/react';

export interface StatCardProps {
  label: string;
  value: string;
  trend: number;
  trendLabel: string;
  colorScheme: 'green' | 'red';
  icon?: React.ReactElement;
  isLoading?: boolean;
  /**
   * Whether an upward trend is good news (income/balance) or bad news (expenses).
   * Controls the trend arrow color: good = green, bad = red. Defaults to true.
   */
  trendIsPositiveGood?: boolean;
  /**
   * When false, the arrow + percentage are hidden and only trendLabel is shown
   * (e.g. savings rate with no income recorded yet). Defaults to true.
   */
  showTrend?: boolean;
}

export function StatCard({
  label,
  value,
  trend,
  trendLabel,
  colorScheme,
  icon,
  isLoading = false,
  trendIsPositiveGood = true,
  showTrend = true,
}: StatCardProps) {
  // Determine trend type for arrow direction
  const trendType = trend >= 0 ? 'increase' : 'decrease';
  const trendIsGood = trendIsPositiveGood ? trend >= 0 : trend <= 0;
  const trendColor = trendIsGood ? 'green.500' : 'red.500';

  if (isLoading) {
    return (
      <Box
        p={{ base: 4, md: 6 }}
        bg="white"
        borderRadius="lg"
        boxShadow="sm"
        borderWidth="1px"
        borderColor="gray.200"
      >
        <Skeleton height="20px" width="120px" mb={3} />
        <Skeleton height="48px" width="180px" mb={2} />
        <Skeleton height="16px" width="80px" />
      </Box>
    );
  }

  return (
    <Box
      p={{ base: 4, md: 6 }}
      bg="white"
      borderRadius="lg"
      boxShadow="sm"
      borderWidth="1px"
      borderColor="gray.200"
      transition="all 0.2s"
      _hover={{
        boxShadow: 'md',
        transform: 'translateY(-2px)',
      }}
    >
      <Stat>
        <StatLabel
          display="flex"
          alignItems="center"
          gap={2}
          fontSize={{ base: '0.75rem', md: '0.875rem' }}
          fontWeight="medium"
          color="gray.600"
          mb={2}
        >
          {icon && <ChakraIcon as={() => icon} boxSize={4} />}
          {label}
        </StatLabel>

        <StatNumber
          fontSize={{ base: '1.75rem', md: '2rem', lg: '2.5rem', xl: '3rem' }}
          fontWeight="bold"
          color={colorScheme === 'green' ? 'green.600' : 'red.600'}
          lineHeight="1.2"
          mb={2}
        >
          {value}
        </StatNumber>

        <StatHelpText fontSize={{ base: '0.75rem', md: '0.875rem' }} color="gray.600" mb={0}>
          {showTrend && <StatArrow type={trendType} color={trendColor} />}
          {showTrend ? `${Math.abs(trend).toFixed(1)}% ${trendLabel}` : trendLabel}
        </StatHelpText>
      </Stat>
    </Box>
  );
}
