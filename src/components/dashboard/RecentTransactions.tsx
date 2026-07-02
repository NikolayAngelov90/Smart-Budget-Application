'use client';

/**
 * RecentTransactions Component
 *
 * Dashboard module showing the latest 5 transactions so users can confirm
 * recent activity at a glance without leaving the dashboard.
 * Reuses the transactions API + CategoryBadge, revalidates on realtime events.
 */

import {
  Box,
  Card,
  CardBody,
  Flex,
  Heading,
  HStack,
  Link as ChakraLink,
  Skeleton,
  Text,
  VStack,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CategoryBadge } from '@/components/categories/CategoryBadge';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatTransactionDate } from '@/lib/utils/dateFormatter';
import { formatCurrencyWithSign } from '@/lib/utils/currency';

export const RECENT_TRANSACTIONS_KEY = '/api/transactions?limit=5&offset=0';

interface RecentTransaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  notes: string | null;
  currency?: string;
  category: {
    id: string;
    name: string;
    color: string;
    type: 'income' | 'expense';
  };
}

interface TransactionsResponse {
  data: RecentTransaction[];
  count: number;
}

async function fetcher(url: string): Promise<TransactionsResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch recent transactions');
  }
  return response.json();
}

export function RecentTransactions() {
  const t = useTranslations('dashboard');
  const { preferences } = useUserPreferences();
  const dateFormat = preferences?.date_format || 'MM/DD/YYYY';
  const currencyCode = preferences?.currency_format || 'EUR';

  const { data, error, isLoading, mutate } = useSWR<TransactionsResponse>(
    RECENT_TRANSACTIONS_KEY,
    fetcher,
    {
      dedupingInterval: 5000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    }
  );

  // Keep the list fresh when transactions change anywhere in the app
  useRealtimeSubscription(() => {
    mutate();
  });

  const transactions = data?.data ?? [];

  return (
    <Box w="full">
      <Flex justify="space-between" align="baseline" mb={4}>
        <Heading as="h2" fontSize={{ base: '1.25rem', lg: '1.5rem' }} color="gray.700">
          {t('recentTransactions')}
        </Heading>
        <ChakraLink
          as={Link}
          href="/transactions"
          color="blue.500"
          fontWeight="medium"
          fontSize={{ base: 'sm', md: 'md' }}
          _hover={{ color: 'blue.600', textDecoration: 'underline' }}
        >
          {t('viewAllTransactions')}
        </ChakraLink>
      </Flex>

      {isLoading && (
        <VStack spacing={2} align="stretch">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="56px" borderRadius="md" />
          ))}
        </VStack>
      )}

      {!isLoading && error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {t('failedToLoadTransactions')}
        </Alert>
      )}

      {!isLoading && !error && transactions.length === 0 && (
        <Card>
          <CardBody>
            <Text color="gray.500" fontSize="sm" textAlign="center" py={2}>
              {t('noRecentTransactions')}
            </Text>
          </CardBody>
        </Card>
      )}

      {!isLoading && !error && transactions.length > 0 && (
        <Card>
          <CardBody p={0}>
            <VStack spacing={0} align="stretch" divider={<Box borderBottomWidth="1px" borderColor="gray.100" />}>
              {transactions.map((transaction) => {
                const signedAmount =
                  transaction.type === 'expense' ? -transaction.amount : transaction.amount;
                const formatted = formatCurrencyWithSign(
                  signedAmount,
                  true,
                  undefined,
                  transaction.currency || currencyCode
                );

                return (
                  <Flex
                    key={transaction.id}
                    px={{ base: 4, md: 5 }}
                    py={3}
                    justify="space-between"
                    align="center"
                    gap={3}
                  >
                    <VStack align="flex-start" spacing={0.5} flex={1} minW={0}>
                      <CategoryBadge category={transaction.category} variant="dot" size="sm" />
                      <HStack spacing={2} maxW="full">
                        <Text fontSize="xs" color="gray.500" whiteSpace="nowrap">
                          {formatTransactionDate(transaction.date, dateFormat)}
                        </Text>
                        {transaction.notes && (
                          <Text fontSize="xs" color="gray.500" noOfLines={1}>
                            {transaction.notes}
                          </Text>
                        )}
                      </HStack>
                    </VStack>
                    <Text
                      fontSize={{ base: 'sm', md: 'md' }}
                      fontWeight="semibold"
                      color={transaction.type === 'income' ? 'green.600' : 'red.600'}
                      whiteSpace="nowrap"
                    >
                      {formatted}
                    </Text>
                  </Flex>
                );
              })}
            </VStack>
          </CardBody>
        </Card>
      )}
    </Box>
  );
}
