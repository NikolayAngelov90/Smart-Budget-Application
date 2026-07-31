'use client';

/**
 * MonthOverMonth Component
 * Story 5.5: Month-over-Month Comparison Highlights
 * Story 7.3: Refactored to use centralized Realtime subscription manager
 *
 * Displays significant spending changes (>20%) between current and previous month
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
  List,
  ListItem,
  Badge,
  Skeleton,
  Stack,
} from '@chakra-ui/react';
import { MdTrendingUp, MdTrendingDown, MdShowChart } from 'react-icons/md';
import { useMonthOverMonth, CategoryChangeData } from '@/lib/hooks/useMonthOverMonth';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatCurrency } from '@/lib/utils/currency';

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
  currencyCode,
}: {
  change: CategoryChangeData;
  onClick: () => void;
  currencyCode?: string;
}) {
  const t = useTranslations('dashboard');
  const isIncrease = change.direction === 'increase';
  const ArrowIcon = isIncrease ? MdTrendingUp : MdTrendingDown;
  const colorScheme = isIncrease ? 'red' : 'green';
  const arrow = isIncrease ? '↑' : '↓';

  return (
    <ListItem
      p={{ base: 3, md: 4 }}
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      bg="surface"
      cursor="pointer"
      onClick={onClick}
      _hover={{
        bg: 'surface.sunken',
        borderColor: 'border.strong',
        transform: 'translateY(-2px)',
        boxShadow: 'md',
      }}
      transition="all 0.2s"
      minH="44px"
    >
      <Flex align="center" justify="space-between" gap={{ base: 2, md: 3 }} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
        <Flex align="center" gap={2} flex={1} minW="0">
          <Icon
            as={ArrowIcon}
            boxSize={5}
            color={`${colorScheme}.500`}
            flexShrink={0}
          />
          <Text fontWeight="medium" fontSize={{ base: '0.875rem', lg: '1rem' }} noOfLines={1}>
            {change.categoryName}
          </Text>
        </Flex>

        <Flex align="center" gap={2} flexShrink={0}>
          <Badge
            colorScheme={colorScheme}
            fontSize={{ base: '0.75rem', md: '0.875rem' }}
            px={2}
            py={1}
            borderRadius="md"
          >
            {arrow} {Math.abs(change.percentChange).toFixed(0)}%
          </Badge>
          <Text fontSize={{ base: '0.625rem', md: '0.75rem' }} color="fg.muted" whiteSpace="nowrap" display={{ base: 'none', sm: 'block' }}>
            {t('momComparison', {
              current: formatCurrency(change.currentAmount, undefined, currencyCode),
              previous: formatCurrency(change.previousAmount, undefined, currencyCode),
            })}
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
  const t = useTranslations('dashboard');
  const router = useRouter();
  const { data, error, isLoading, mutate } = useMonthOverMonth(month);
  const { preferences } = useUserPreferences();
  const currencyCode = preferences?.currency_format;

  // Subscribe to real-time transaction changes via centralized manager
  useRealtimeSubscription((event) => {
    console.log('[MonthOverMonth] Realtime update received:', event.eventType);
    // Revalidate comparison data immediately when any transaction changes
    mutate();
  });

  // Handle click navigation to transactions page with filters
  const handleCategoryClick = (categoryId: string, currentMonth: string) => {
    // Navigate to transactions page with category and month filters
    router.push(`/transactions?category=${categoryId}&month=${currentMonth}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <Box>
        <Text
          as="h3"
          fontSize={{ base: '1.125rem', lg: '1.25rem' }}
          fontWeight="bold"
          mb={4}
        >
          {t('momTitle')}
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
        <Text
          as="h3"
          fontSize={{ base: '1.125rem', lg: '1.25rem' }}
          fontWeight="bold"
          mb={4}
        >
          {t('momTitle')}
        </Text>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertTitle>{t('momError')}</AlertTitle>
          <AlertDescription>{t('momErrorHint')}</AlertDescription>
        </Alert>
      </Box>
    );
  }

  // Empty state (no significant changes)
  if (!data || data.changes.length === 0) {
    return (
      <Box>
        <Text
          as="h3"
          fontSize={{ base: '1.125rem', lg: '1.25rem' }}
          fontWeight="bold"
          mb={4}
        >
          {t('momTitle')}
        </Text>
        <Flex
          direction="column"
          align="center"
          justify="center"
          minH="150px"
          borderWidth="1px"
          borderColor="border"
          borderRadius="md"
          bg="surface.sunken"
        >
          <Icon as={MdShowChart} boxSize={10} color="fg.subtle" mb={2} />
          <Text fontSize={{ base: '0.875rem', lg: '1rem' }} fontWeight="medium" color="fg.muted">
            {t('momEmpty')}
          </Text>
          <Text fontSize={{ base: '0.75rem', lg: '0.875rem' }} color="fg.subtle" mt={1}>
            {t('momEmptyHint')}
          </Text>
        </Flex>
      </Box>
    );
  }

  // Render changes list
  return (
    <Box>
      <Text
        as="h3"
        fontSize={{ base: '1.125rem', lg: '1.25rem' }}
        fontWeight="bold"
        mb={4}
      >
        {t('momTitle')}
      </Text>
      <List spacing={3}>
        {data.changes.map((change) => (
          <ChangeItem
            key={change.categoryId}
            change={change}
            onClick={() => handleCategoryClick(change.categoryId, data.currentMonth)}
            currencyCode={currencyCode}
          />
        ))}
      </List>
    </Box>
  );
}
