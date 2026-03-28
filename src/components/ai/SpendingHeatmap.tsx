'use client';

/**
 * SpendingHeatmap Component
 * Story 11.3: Spending Heatmap
 *
 * Wrapper providing:
 * - Month navigation (previous/next with future-month guard)
 * - Progressive disclosure: renders null when user lacks 7+ days of data
 * - "View as table" / "View as grid" accessibility toggle
 * - Loading skeleton
 *
 * Placement: Dashboard page, below Month-over-Month comparison.
 */

import { useState } from 'react';
import {
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Skeleton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HeatmapGrid } from './HeatmapGrid';
import { useSpendingHeatmap } from '@/lib/hooks/useSpendingHeatmap';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

export function SpendingHeatmap() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [showTable, setShowTable] = useState(false);

  const t = useTranslations('heatmap');
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format ?? '';

  const { data, hasEnoughData, isLoading } = useSpendingHeatmap(selectedYear, selectedMonth);

  // Progressive disclosure: hide entirely until user has enough data
  if (!hasEnoughData && !isLoading) return null;

  const isCurrentMonth =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleDayClick = (date: string) => {
    router.push(`/transactions?date=${date}`);
  };

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(
    new Date(selectedYear, selectedMonth - 1, 1)
  );

  return (
    <Box as="section" aria-label={t('title')}>
      <VStack align="stretch" spacing={4}>
        {/* Header row with title and controls */}
        <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
          <VStack align="start" spacing={0}>
            <Heading as="h2" fontSize={{ base: '1.25rem', lg: '1.5rem' }} color="gray.700">
              {t('title')}
            </Heading>
            <Text fontSize="sm" color="gray.500">
              {t('subtitle', { month: monthLabel, year: selectedYear })}
            </Text>
          </VStack>

          <HStack spacing={2}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
            >
              {showTable ? t('viewAsGrid') : t('viewAsTable')}
            </Button>
            <IconButton
              aria-label={t('previousMonth')}
              icon={<ChevronLeftIcon />}
              size="sm"
              variant="ghost"
              onClick={goToPreviousMonth}
            />
            <IconButton
              aria-label={t('nextMonth')}
              icon={<ChevronRightIcon />}
              size="sm"
              variant="ghost"
              isDisabled={isCurrentMonth}
              onClick={goToNextMonth}
            />
          </HStack>
        </HStack>

        {/* Content: skeleton while loading, grid/table when ready */}
        {isLoading ? (
          <Skeleton height="160px" borderRadius="md" data-testid="heatmap-skeleton" />
        ) : (
          <HeatmapGrid
            entries={data}
            year={selectedYear}
            month={selectedMonth}
            currency={currency}
            showTable={showTable}
            onDayClick={handleDayClick}
          />
        )}
      </VStack>
    </Box>
  );
}
