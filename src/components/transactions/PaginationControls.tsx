'use client';

/**
 * Pagination Controls Component
 * Story 9-7: Complete Story 6-3 Pagination UI
 *
 * AC-9.7.1: Page size selector (10, 25, 50, 100)
 * AC-9.7.2: Jump to page input with validation
 * AC-9.7.3: Persistent page size preference (localStorage)
 * AC-9.7.4: Dynamic total page count
 * AC-9.7.5: Mobile-responsive controls
 * AC-9.7.6: Validation and error handling
 * AC-9.7.7: Accessibility (keyboard nav, ARIA labels)
 */

import { useState, useCallback } from 'react';
import {
  Box,
  HStack,
  Button,
  IconButton,
  Text,
  Select,
  Input,
  FormControl,
  FormErrorMessage,
  Flex,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const LOCAL_STORAGE_KEY = 'transactions_page_size';

export interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
}

export function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: PaginationControlsProps) {
  const t = useTranslations('transactions');
  const [jumpToValue, setJumpToValue] = useState('');
  const [jumpToError, setJumpToError] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

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

  // AC-9.7.1: Handle page size change
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value, 10);
    onPageSizeChange(newSize);
  };

  // AC-9.7.2 & AC-9.7.6: Validate and jump to page
  const handleJumpToPage = useCallback(() => {
    const trimmed = jumpToValue.trim();
    if (!trimmed) {
      setJumpToError('');
      return;
    }

    const pageNum = parseInt(trimmed, 10);

    if (isNaN(pageNum) || !Number.isInteger(Number(trimmed))) {
      setJumpToError(t('enterValidPage'));
      return;
    }

    if (pageNum < 1 || pageNum > totalPages) {
      setJumpToError(t('pageMustBeBetween', { total: totalPages }));
      return;
    }

    setJumpToError('');
    setJumpToValue('');
    onPageChange(pageNum);
  }, [jumpToValue, totalPages, onPageChange, t]);

  const handleJumpToKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleJumpToPage();
    }
  };

  // Generate page numbers with ellipsis (max 7 buttons)
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 7;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
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

  // Don't show if no items
  if (totalItems === 0) {
    return null;
  }

  return (
    <Box w="full" py={4} aria-label={t('paginationControls')} role="navigation">
      {/* AC-9.7.5: Responsive layout */}
      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        gap={4}
      >
        {/* Page navigation buttons */}
        <HStack spacing={2} justify="center">
          {/* Previous Button */}
          <IconButton
            aria-label={t('goToPreviousPage')}
            icon={<ChevronLeftIcon />}
            onClick={handlePrevious}
            isDisabled={currentPage === 1 || isLoading}
            variant="outline"
            size={{ base: 'sm', md: 'md' }}
          />

          {/* Page Numbers - Desktop only */}
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
                  aria-label={t('goToPage', { page })}
                  aria-current={currentPage === page ? 'page' : undefined}
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
            aria-live="polite"
          >
            {t('pageOfTotal', { current: currentPage, total: totalPages })}
          </Text>

          {/* Next Button */}
          <IconButton
            aria-label={t('goToNextPage')}
            icon={<ChevronRightIcon />}
            onClick={handleNext}
            isDisabled={currentPage === totalPages || isLoading}
            variant="outline"
            size={{ base: 'sm', md: 'md' }}
          />
        </HStack>

        {/* AC-9.7.1 & AC-9.7.2: Page size + Jump to page controls */}
        <Flex
          direction={{ base: 'column', sm: 'row' }}
          gap={3}
          align={{ base: 'stretch', sm: 'center' }}
          justify="center"
        >
          {/* AC-9.7.1: Page size selector */}
          <HStack spacing={2}>
            <Text fontSize="sm" whiteSpace="nowrap" color="gray.600">
              {t('itemsPerPage')}
            </Text>
            <Select
              aria-label={t('itemsPerPage')}
              value={pageSize}
              onChange={handlePageSizeChange}
              size="sm"
              w="80px"
              isDisabled={isLoading}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </HStack>

          {/* AC-9.7.2: Jump to page */}
          {totalPages > 1 && (
            <FormControl isInvalid={!!jumpToError} maxW={{ base: 'full', sm: '200px' }}>
              <HStack spacing={2}>
                <Text fontSize="sm" whiteSpace="nowrap" color="gray.600">
                  {t('goTo')}
                </Text>
                <Input
                  aria-label={t('jumpToPage')}
                  placeholder={`1-${totalPages}`}
                  value={jumpToValue}
                  onChange={(e) => {
                    setJumpToValue(e.target.value);
                    if (jumpToError) setJumpToError('');
                  }}
                  onKeyDown={handleJumpToKeyDown}
                  onBlur={handleJumpToPage}
                  size="sm"
                  w="70px"
                  type="text"
                  inputMode="numeric"
                  isDisabled={isLoading}
                />
                <Button
                  size="sm"
                  onClick={handleJumpToPage}
                  isDisabled={isLoading || !jumpToValue.trim()}
                  aria-label={t('goToPageButton')}
                >
                  {t('go')}
                </Button>
              </HStack>
              {jumpToError && (
                <FormErrorMessage fontSize="xs" mt={1}>
                  {jumpToError}
                </FormErrorMessage>
              )}
            </FormControl>
          )}
        </Flex>
      </Flex>

      {/* Item count summary */}
      <Text
        fontSize="sm"
        color="gray.500"
        textAlign="center"
        mt={2}
        aria-live="polite"
      >
        {t('showingItems', { start: startItem, end: endItem, total: totalItems })}
      </Text>
    </Box>
  );
}
