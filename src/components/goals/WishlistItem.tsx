'use client';

/**
 * WishlistItem Component — Story 14.3 (FR15)
 *
 * One wishlist row: name, price, computed impact lines (month balance,
 * category budget, goal delay, value alignment) and status actions.
 * Impact copy is rendered here; the engine supplies numbers/flags only.
 */

import { Badge, Box, Button, Flex, HStack, Text, VStack } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { formatCurrency } from '@/lib/utils/currency';
import type { WishlistItemWithImpact, WishlistStatus } from '@/types/database.types';

interface WishlistItemProps {
  item: WishlistItemWithImpact;
  currencyCode: string;
  isUpdating: boolean;
  onStatusChange: (item: WishlistItemWithImpact, status: WishlistStatus) => void;
}

export function WishlistItem({ item, currencyCode, isUpdating, onStatusChange }: WishlistItemProps) {
  const t = useTranslations('wishlist');
  const { impact } = item;
  const isActive = item.status === 'active';

  const fmt = (n: number) => formatCurrency(n, undefined, currencyCode);

  return (
    <Box
      px={{ base: 4, md: 5 }}
      py={4}
      borderBottomWidth="1px"
      borderColor="gray.100"
      opacity={isActive ? 1 : 0.65}
    >
      <Flex justify="space-between" align="flex-start" gap={3} flexWrap="wrap">
        <VStack align="flex-start" spacing={1} flex={1} minW={0}>
          <HStack spacing={2} flexWrap="wrap">
            <Text fontWeight="semibold" noOfLines={1}>
              {item.name}
            </Text>
            <Text fontWeight="bold" color="gray.700" whiteSpace="nowrap">
              {fmt(item.price)}
            </Text>
            {item.category_name && (
              <Badge colorScheme="gray" fontSize="xs">
                {item.category_name}
              </Badge>
            )}
            {impact.aligned_value && (
              <Badge colorScheme="purple" fontSize="xs">
                {t('alignsWith', { value: impact.aligned_value })}
              </Badge>
            )}
            {item.status === 'purchased' && (
              <Badge colorScheme="green" fontSize="xs">
                {t('purchased')}
              </Badge>
            )}
            {item.status === 'removed' && (
              <Badge colorScheme="gray" fontSize="xs">
                {t('removed')}
              </Badge>
            )}
          </HStack>

          {/* Impact lines — shown for active items where the decision is still open */}
          {isActive && (
            <VStack align="flex-start" spacing={0.5}>
              {impact.category_budget && (
                <Text
                  fontSize="sm"
                  color={impact.category_budget.exceeds_budget ? 'red.600' : 'gray.600'}
                >
                  {impact.category_budget.exceeds_budget
                    ? t('exceedsBudget', {
                        category: impact.category_budget.category_name,
                        amount: fmt(Math.abs(impact.category_budget.remaining_after)),
                      })
                    : t('leavesBudget', {
                        amount: fmt(impact.category_budget.remaining_after),
                        category: impact.category_budget.category_name,
                        limit: fmt(impact.category_budget.limit_amount),
                      })}
                </Text>
              )}
              <Text fontSize="sm" color={impact.month_balance_after < 0 ? 'red.600' : 'gray.600'}>
                {t('monthBalanceAfter', { amount: fmt(impact.month_balance_after) })}
              </Text>
              {impact.goal_delay && (
                <Text fontSize="sm" color="orange.600">
                  {t('goalDelay', {
                    days: impact.goal_delay.delay_days,
                    goal: impact.goal_delay.goal_name,
                  })}
                </Text>
              )}
            </VStack>
          )}
        </VStack>

        <HStack spacing={2} flexShrink={0}>
          {isActive ? (
            <>
              <Button
                size="sm"
                colorScheme="green"
                variant="outline"
                minH={{ base: '44px', md: '32px' }}
                isDisabled={isUpdating}
                onClick={() => onStatusChange(item, 'purchased')}
              >
                {t('markPurchased')}
              </Button>
              <Button
                size="sm"
                colorScheme="gray"
                variant="ghost"
                minH={{ base: '44px', md: '32px' }}
                isDisabled={isUpdating}
                onClick={() => onStatusChange(item, 'removed')}
              >
                {t('markRemoved')}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              colorScheme="blue"
              minH={{ base: '44px', md: '32px' }}
              isDisabled={isUpdating}
              onClick={() => onStatusChange(item, 'active')}
            >
              {t('restore')}
            </Button>
          )}
        </HStack>
      </Flex>
    </Box>
  );
}
