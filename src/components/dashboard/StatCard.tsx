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
}

export function StatCard({
  label,
  value,
  trend,
  trendLabel,
  colorScheme,
  icon,
  isLoading = false,
}: StatCardProps) {
  // Determine trend type for arrow direction
  const trendType = trend >= 0 ? 'increase' : 'decrease';

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
          <StatArrow type={trendType} />
          {Math.abs(trend).toFixed(2)}% {trendLabel}
        </StatHelpText>
      </Stat>
    </Box>
  );
}
