/**
 * Insights Pagination Component
 *
 * Displays pagination controls for navigating through pages of insights.
 * Supports Previous/Next buttons and page number display.
 *
 * Story 6.3: AC7 - Pagination UI
 */

'use client';

import { HStack, Button, Text, IconButton, Box } from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';

interface InsightsPaginationProps {
  currentPage: number;
  totalInsights: number;
  insightsPerPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function InsightsPagination({
  currentPage,
  totalInsights,
  insightsPerPage,
  onPageChange,
  isLoading = false,
}: InsightsPaginationProps) {
  const t = useTranslations('insights');
  const totalPages = Math.ceil(totalInsights / insightsPerPage);

  // Don't show pagination if there's only one page or no insights
  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 7; // Show max 7 page buttons

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, last page, and pages around current
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <Box
      w="full"
      py={6}
      display="flex"
      justifyContent="center"
      alignItems="center"
    >
      <HStack spacing={2}>
        {/* Previous Button */}
        <IconButton
          aria-label={t('previousPage')}
          icon={<ChevronLeftIcon />}
          onClick={handlePrevious}
          isDisabled={currentPage === 1 || isLoading}
          variant="outline"
          size={{ base: 'sm', md: 'md' }}
        />

        {/* Page Numbers */}
        <HStack spacing={1} display={{ base: 'none', md: 'flex' }}>
          {pageNumbers.map((page, index) => {
            if (page === '...') {
              return (
                <Text key={`ellipsis-${index}`} px={2} color="gray.500">
                  ...
                </Text>
              );
            }

            return (
              <Button
                key={page}
                onClick={() => onPageChange(page as number)}
                isDisabled={isLoading}
                variant={currentPage === page ? 'solid' : 'outline'}
                colorScheme={currentPage === page ? 'blue' : 'gray'}
                size="md"
                minW="40px"
              >
                {page}
              </Button>
            );
          })}
        </HStack>

        {/* Mobile: Current Page Display */}
        <Text
          display={{ base: 'block', md: 'none' }}
          px={4}
          fontSize="sm"
          fontWeight="medium"
        >
          {t('pageOfTotal', { current: currentPage, total: totalPages })}
        </Text>

        {/* Next Button */}
        <IconButton
          aria-label={t('nextPage')}
          icon={<ChevronRightIcon />}
          onClick={handleNext}
          isDisabled={currentPage === totalPages || isLoading}
          variant="outline"
          size={{ base: 'sm', md: 'md' }}
        />
      </HStack>
    </Box>
  );
}
