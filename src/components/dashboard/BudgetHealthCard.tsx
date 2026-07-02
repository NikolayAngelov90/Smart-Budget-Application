'use client';

/**
 * BudgetHealthCard Component — ADR-025
 *
 * Dashboard module showing month-to-date progress against the user's set
 * category budgets, most urgent first (over → warning → ok).
 *
 * Progressive disclosure: renders null while the user has no budgets —
 * zero-config users never see it (same pattern as AnnualizedProjections).
 */

import {
  Alert,
  AlertIcon,
  Box,
  Card,
  CardBody,
  Flex,
  Heading,
  Link as ChakraLink,
  Progress,
  Text,
  VStack,
} from '@chakra-ui/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useBudgets } from '@/lib/hooks/useBudgets';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatCurrency } from '@/lib/utils/currency';
import type { BudgetSummary } from '@/types/database.types';

const STATUS_COLOR: Record<BudgetSummary['status'], string> = {
  ok: 'green',
  warning: 'orange',
  over: 'red',
};

export function BudgetHealthCard() {
  const t = useTranslations('budgets');
  const { data } = useBudgets();
  const { preferences } = useUserPreferences();
  const currencyCode = preferences?.currency_format || 'EUR';

  // Progressive disclosure: most users have no budgets, so render nothing while
  // loading (no skeleton flash / layout shift) and nothing when empty. With
  // keepPreviousData, stale data keeps the card up through transient errors.
  if (!data || data.budgets.length === 0) return null;

  const overCount = data.budgets.filter((b) => b.status === 'over').length;

  return (
    <Box as="section" aria-label={t('healthTitle')} w="full" mb={{ base: 6, md: 8 }}>
      <Flex justify="space-between" align="baseline" mb={4}>
        <Heading as="h2" fontSize={{ base: '1.25rem', lg: '1.5rem' }} color="gray.700">
          {t('healthTitle')}
        </Heading>
        <ChakraLink
          as={Link}
          href="/categories"
          color="blue.500"
          fontWeight="medium"
          fontSize={{ base: 'sm', md: 'md' }}
          _hover={{ color: 'blue.600', textDecoration: 'underline' }}
        >
          {t('manageBudgets')}
        </ChakraLink>
      </Flex>

      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            {overCount > 0 && (
              <Alert status="warning" borderRadius="md" py={2}>
                <AlertIcon />
                <Text fontSize="sm">{t('overBudgetWarning', { count: overCount })}</Text>
              </Alert>
            )}

            {data.budgets.map((budget) => (
              <Box key={budget.id}>
                <Flex justify="space-between" align="center" mb={1} gap={2}>
                  <Flex align="center" gap={2} minW={0}>
                    <Box
                      w={2.5}
                      h={2.5}
                      borderRadius="full"
                      bg={budget.category_color}
                      flexShrink={0}
                      aria-hidden="true"
                    />
                    <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                      {budget.category_name}
                    </Text>
                  </Flex>
                  <Text
                    fontSize="sm"
                    color={budget.status === 'over' ? 'red.600' : 'gray.600'}
                    whiteSpace="nowrap"
                  >
                    {t('spentOfLimit', {
                      spent: formatCurrency(budget.spent, undefined, currencyCode),
                      limit: formatCurrency(budget.limit_amount, undefined, currencyCode),
                    })}
                  </Text>
                </Flex>
                <Progress
                  value={Math.min(budget.pct_used, 100)}
                  size="sm"
                  borderRadius="full"
                  colorScheme={STATUS_COLOR[budget.status]}
                  aria-label={t('progressAriaLabel', {
                    name: budget.category_name,
                    pct: budget.pct_used,
                  })}
                />
                {budget.status === 'over' ? (
                  <Text fontSize="xs" color="red.600" mt={1}>
                    {t('overBy', {
                      amount: formatCurrency(Math.abs(budget.remaining), undefined, currencyCode),
                    })}
                  </Text>
                ) : (
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    {t('remainingThisMonth', {
                      amount: formatCurrency(budget.remaining, undefined, currencyCode),
                    })}
                  </Text>
                )}
              </Box>
            ))}
          </VStack>
        </CardBody>
      </Card>
    </Box>
  );
}
