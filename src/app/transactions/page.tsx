'use client';

/**
 * Transactions Page
 * Story 3.2: Transaction List View with Filtering and Search
 *
 * Comprehensive transaction list with:
 * - Filtering by date range, category, and type
 * - Search with debouncing (300ms)
 * - Chronological ordering (newest first)
 * - Color-coded amounts (green income, red expense)
 * - Loading skeletons
 * - Empty states
 * - Mobile-responsive design
 */

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
  Container,
  Heading,
  VStack,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Button,
  Card,
  CardBody,
  Text,
  Skeleton,
  SkeletonText,
  Badge,
  IconButton,
  Flex,
  SimpleGrid,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  Progress,
} from '@chakra-ui/react';
import { CloseIcon, SearchIcon, EditIcon, DeleteIcon, ChevronLeftIcon, DownloadIcon } from '@chakra-ui/icons';
import useSWR from 'swr';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import TransactionEntryModal from '@/components/transactions/TransactionEntryModal';
import { CategoryBadge } from '@/components/categories/CategoryBadge';
import { FilterBreadcrumbs } from '@/components/transactions/FilterBreadcrumbs';
import { PaginationControls, DEFAULT_PAGE_SIZE, LOCAL_STORAGE_KEY } from '@/components/transactions/PaginationControls';
import { createClient } from '@/lib/supabase/client';
import { exportTransactionsToCSV } from '@/lib/services/exportService'; // Story 8.1
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatTransactionDate } from '@/lib/utils/dateFormatter';
import { useTranslations } from 'next-intl';

// Types
interface Category {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
}

interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category_id: string;
  date: string;
  notes: string | null;
  created_at: string;
  category: Category;
}

interface TransactionResponse {
  data: Transaction[];
  count: number;
  limit: number;
  offset: number;
}

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

function TransactionsContent() {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');

  // Get URL search params for drill-down navigation (Story 5.5)
  const searchParams = useSearchParams();

  // Get user preferences for date formatting (Story 8.3)
  const { preferences } = useUserPreferences();
  const dateFormat = preferences?.date_format || 'MM/DD/YYYY';

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Edit modal state
  const { isOpen: isEditModalOpen, onOpen: onEditModalOpen, onClose: onEditModalClose } = useDisclosure();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Delete confirmation state
  const { isOpen: isDeleteAlertOpen, onOpen: onDeleteAlertOpen, onClose: onDeleteAlertClose } = useDisclosure();
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Export loading state (Story 8.1)
  const [isExporting, setIsExporting] = useState(false);

  // Progress modal for large exports (AC-8.1.9)
  const { isOpen: isProgressModalOpen, onOpen: onProgressModalOpen, onClose: onProgressModalClose } = useDisclosure();
  const [exportProgress, setExportProgress] = useState(0);

  // Toast for undo functionality
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Story 9-7: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if ([10, 25, 50, 100].includes(parsed)) return parsed;
      }
    }
    return DEFAULT_PAGE_SIZE;
  });

  // Network status tracking (Task 6)
  const [isOnline, setIsOnline] = useState(true);

  // Initialize filters from URL query parameters (Story 5.5 drill-down)
  useEffect(() => {
    if (filtersInitialized) return; // Only initialize once

    const categoryParam = searchParams.get('category');
    const monthParam = searchParams.get('month');

    if (categoryParam) {
      setCategoryFilter(categoryParam);
    }

    if (monthParam) {
      // Parse month in YYYY-MM format and set date range
      try {
        const monthDate = new Date(`${monthParam}-01`);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        setStartDate(format(monthStart, 'yyyy-MM-dd'));
        setEndDate(format(monthEnd, 'yyyy-MM-dd'));
      } catch {
        console.error('Invalid month parameter:', monthParam);
      }
    }

    setFiltersInitialized(true);
  }, [searchParams, filtersInitialized]);

  // Debounce search query (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Story 9-7: Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, categoryFilter, typeFilter, debouncedSearch]);

  // Build query string for API (Story 9-7: dynamic pagination)
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();

    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (categoryFilter) params.append('category', categoryFilter);
    if (typeFilter !== 'all') params.append('type', typeFilter);
    if (debouncedSearch) params.append('search', debouncedSearch);
    params.append('limit', pageSize.toString());
    params.append('offset', ((currentPage - 1) * pageSize).toString());

    return params.toString();
  }, [startDate, endDate, categoryFilter, typeFilter, debouncedSearch, pageSize, currentPage]);

  // Fetch transactions with optimized SWR configuration
  const {
    data: transactionsResponse,
    error: transactionsError,
    isLoading: transactionsLoading,
    mutate,
  } = useSWR<TransactionResponse>(
    `/api/transactions?${buildQueryString()}`,
    fetcher,
    {
      revalidateOnFocus: true, // Sync when tab regains focus
      revalidateOnReconnect: true, // Sync when internet reconnects
      dedupingInterval: 2000, // Prevent excessive requests (2 seconds)
      errorRetryCount: 3, // Retry failed requests up to 3 times
      focusThrottleInterval: 5000, // Throttle focus revalidation (5 seconds)
    }
  );

  // Fetch categories for filter dropdown
  // Note: Different pages use different fetchers, so cache might be:
  // - Array: [...] (from FilterBreadcrumbs)
  // - Object: { data: [...] } (from categories page)
  const { data: categoriesResponse } = useSWR<
    Category[] | { data: Category[]; count: number; recent?: Category[] }
  >('/api/categories', fetcher);

  // Normalize categories to array regardless of cache structure
  const categories: Category[] = Array.isArray(categoriesResponse)
    ? categoriesResponse
    : categoriesResponse?.data || [];

  // Real-time sync via Supabase Realtime subscriptions (Tasks 2-3)
  useEffect(() => {
    const supabase = createClient();

    // Subscribe to real-time changes on transactions table
    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('Real-time event received:', payload.eventType);

          // Revalidate SWR cache to fetch fresh data with all relationships
          // This ensures category details and other joins are included
          mutate();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time sync active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time channel error');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Real-time subscription timed out');
        }
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('🔌 Unsubscribing from real-time channel');
      supabase.removeChannel(channel);
    };
  }, [mutate]); // Only depend on mutate, not filters

  // Network status monitoring (Task 6)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 Connection restored');
      toast({
        title: t('connectionRestored'),
        description: t('dataWillSync'),
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // Auto-retry: revalidate data when connection restored
      mutate();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📡 Connection lost');
      toast({
        title: t('connectionLost'),
        description: t('changesWillSync'),
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
    };

    // Set initial status
    setIsOnline(navigator.onLine);

    // Listen for connection changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, mutate, t]);

  // Check if any filters are active
  const hasActiveFilters =
    startDate || endDate || categoryFilter || typeFilter !== 'all' || searchQuery;

  // Clear all filters
  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setCategoryFilter('');
    setTypeFilter('all');
    setSearchQuery('');
  };

  // Story 9-7: AC-9.7.1 & AC-9.7.3: Handle page size change with localStorage persistence
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, newSize.toString());
    }
  };

  // Edit transaction handler
  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    onEditModalOpen();
  };

  // Handle successful edit
  const handleEditSuccess = () => {
    mutate(); // Refresh transactions list
    setEditingTransaction(null);
  };

  // Delete transaction handler - shows confirmation dialog
  const handleDelete = (transaction: Transaction) => {
    setDeletingTransaction(transaction);
    onDeleteAlertOpen();
  };

  // Confirm delete with optimistic update and undo
  const confirmDelete = async () => {
    if (!deletingTransaction) return;

    const transactionToDelete = deletingTransaction;
    setIsDeleting(true);

    try {
      // Optimistic update: remove from cache immediately
      mutate(
        (currentData: TransactionResponse | undefined) => {
          if (!currentData) return currentData;
          return {
            ...currentData,
            data: currentData.data.filter((t: Transaction) => t.id !== transactionToDelete.id),
            count: currentData.count - 1,
          };
        },
        false // Don't revalidate yet
      );

      // Close alert dialog
      onDeleteAlertClose();
      setDeletingTransaction(null);

      // Store deleted transaction for undo
      let isUndone = false;

      // Show success toast with undo button
      toast({
        title: t('deletedSuccess'),
        status: 'success',
        duration: 5000,
        isClosable: true,
        position: 'bottom',
        render: ({ onClose }) => (
          <Box p={4} bg="green.500" borderRadius="md" color="white">
            <HStack justify="space-between">
              <Text>{t('deletedSuccess')}</Text>
              <Button
                size="sm"
                variant="solid"
                bg="white"
                color="green.500"
                onClick={async (e) => {
                  e.preventDefault();
                  isUndone = true;
                  onClose();

                  // Restore transaction via POST (recreate)
                  try {
                    const response = await fetch('/api/transactions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        amount: transactionToDelete.amount,
                        type: transactionToDelete.type,
                        category_id: transactionToDelete.category_id,
                        date: transactionToDelete.date,
                        notes: transactionToDelete.notes || undefined,
                      }),
                    });

                    if (response.ok) {
                      // Refresh list
                      mutate();
                      toast({
                        title: t('transactionRestored'),
                        status: 'success',
                        duration: 2000,
                      });
                    } else {
                      throw new Error('Failed to restore');
                    }
                  } catch (error) {
                    console.error('Error restoring transaction:', error);
                    toast({
                      title: t('failedToRestore'),
                      status: 'error',
                      duration: 3000,
                    });
                    // Revert optimistic update
                    mutate();
                  }
                }}
              >
                {t('undo')}
              </Button>
            </HStack>
          </Box>
        ),
      });

      // Set timeout to actually delete after 5 seconds
      setTimeout(async () => {
        if (isUndone) return;

        // Actually delete from server
        try {
          const response = await fetch(`/api/transactions/${transactionToDelete.id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            throw new Error('Failed to delete transaction');
          }

          // Revalidate to ensure consistency
          mutate();
        } catch (error) {
          console.error('Error deleting transaction:', error);
          // Rollback optimistic update
          mutate();
          toast({
            title: t('failedToDelete'),
            description: t('transactionHasBeenRestored'),
            status: 'error',
            duration: 5000,
          });
        }
      }, 5000);
    } catch (error) {
      console.error('Error in delete flow:', error);
      // Rollback optimistic update
      mutate();
      toast({
        title: t('failedToDelete'),
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Story 8.1: Export all transactions to CSV
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      // Fetch all transactions without pagination
      const response = await fetch('/api/transactions?all=true');
      if (!response.ok) {
        throw new Error('Failed to fetch transactions for export');
      }

      const data: TransactionResponse = await response.json();

      if (data.data.length === 0) {
        toast({
          title: t('noTransactionsToExport'),
          description: t('addTransactionsFirst'),
          status: 'info',
          duration: 3000,
        });
        return;
      }

      // AC-8.1.9: Show progress modal for large datasets (>5,000 transactions)
      const isLargeDataset = data.data.length > 5000;
      if (isLargeDataset) {
        setExportProgress(0);
        onProgressModalOpen();
      }

      // Export to CSV using export service with progress callback
      await exportTransactionsToCSV(
        data.data,
        isLargeDataset ? (progress) => setExportProgress(progress) : undefined
      );

      // Close progress modal if open
      if (isLargeDataset) {
        onProgressModalClose();
      }

      // AC-8.1.11: Success toast
      toast({
        title: t('csvExportedSuccess'),
        description: t('exportedCount', { count: data.data.length }),
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error exporting transactions:', error);

      // Close progress modal if open
      if (isProgressModalOpen) {
        onProgressModalClose();
      }

      toast({
        title: t('exportFailed'),
        description: t('exportFailedDescription'),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Format amount with color-coding
  const formatAmount = (amount: number, type: 'income' | 'expense') => {
    const formatted = amount.toFixed(2);
    const prefix = type === 'income' ? '+' : '-';
    const color = type === 'income' ? 'green.500' : 'red.500';

    return { formatted: `${prefix}$${formatted}`, color };
  };

  // Render loading skeletons
  const renderSkeletons = () => (
    <VStack spacing={4} w="full">
      {[...Array(5)].map((_, index) => (
        <Card key={index} w="full">
          <CardBody>
            <HStack justify="space-between">
              <VStack align="start" spacing={2} flex={1}>
                <HStack>
                  <Skeleton height="20px" width="80px" />
                  <Skeleton height="20px" width="100px" />
                </HStack>
                <SkeletonText noOfLines={1} width="200px" />
              </VStack>
              <Skeleton height="24px" width="100px" />
            </HStack>
          </CardBody>
        </Card>
      ))}
    </VStack>
  );

  // Render empty state
  const renderEmptyState = () => {
    const hasFilters = hasActiveFilters;
    const message = hasFilters
      ? t('noTransactionsFiltered')
      : t('noTransactions');

    return (
      <Box
        textAlign="center"
        py={16}
        px={6}
        bg="gray.50"
        borderRadius="lg"
        border="1px"
        borderColor="gray.200"
      >
        <Text fontSize="xl" color="gray.600" mb={4}>
          {message}
        </Text>
        {!hasFilters && (
          <Text fontSize="sm" color="gray.500">
            {t('clickToAdd')}
          </Text>
        )}
      </Box>
    );
  };

  return (
    <AppLayout>
      <Container maxW="container.xl" py={6}>
        {/* Back to Dashboard Link (Story 5.6) */}
        <Box mb={4}>
          <Button
            as={Link}
            href="/dashboard"
            leftIcon={<ChevronLeftIcon />}
            variant="ghost"
            colorScheme="blue"
            size="sm"
            _hover={{ bg: 'blue.50' }}
          >
            {t('backToDashboard')}
          </Button>
        </Box>

        {/* Page Header */}
        <Flex justify="space-between" align="center" mb={6}>
          <Heading as="h1" size="xl" color="gray.800">
            {t('title')}
          </Heading>
          {/* Story 8.1: Export to CSV Button */}
          <Button
            leftIcon={<DownloadIcon />}
            colorScheme="blue"
            variant="outline"
            onClick={handleExportCSV}
            size={{ base: 'sm', md: 'md' }}
            isLoading={isExporting}
            loadingText={t('exporting')}
          >
            {t('exportTransactionsCSV')}
          </Button>
        </Flex>

        {/* Offline Indicator Banner (Task 6) */}
        {!isOnline && (
          <Box
            bg="orange.100"
            border="1px"
            borderColor="orange.300"
            borderRadius="md"
            p={3}
            mb={4}
          >
            <HStack>
              <Text fontSize="sm" fontWeight="medium" color="orange.800">
                {t('offlineBanner')}
              </Text>
            </HStack>
          </Box>
        )}

        {/* Filter Controls */}
        <Card mb={6}>
          <CardBody>
            <VStack spacing={4} align="stretch">
              {/* Mobile: Vertical Stack, Desktop: Horizontal Grid */}
              <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                {/* Date Range Filters */}
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.700">
                    {t('startDate')}
                  </Text>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    size="md"
                  />
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.700">
                    {t('endDate')}
                  </Text>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    size="md"
                  />
                </Box>

                {/* Category Filter */}
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.700">
                    {t('category')}
                  </Text>
                  <Select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    placeholder={t('allCategories')}
                    size="md"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Box>

                {/* Type Filter */}
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.700">
                    {t('type')}
                  </Text>
                  <Select
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(e.target.value as 'all' | 'income' | 'expense')
                    }
                    size="md"
                  >
                    <option value="all">{t('all')}</option>
                    <option value="income">{t('income')}</option>
                    <option value="expense">{t('expense')}</option>
                  </Select>
                </Box>
              </SimpleGrid>

              {/* Search Input */}
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.700">
                  {tCommon('search')}
                </Text>
                <HStack>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <SearchIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      placeholder={t('searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      size="md"
                    />
                  </InputGroup>
                  {searchQuery && (
                    <IconButton
                      aria-label={t('clearSearch')}
                      icon={<CloseIcon />}
                      onClick={() => setSearchQuery('')}
                      variant="ghost"
                      size="sm"
                    />
                  )}
                </HStack>
              </Box>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <Flex justify="flex-end">
                  <Button
                    onClick={handleClearFilters}
                    variant="outline"
                    size="sm"
                    colorScheme="gray"
                  >
                    {t('clearAllFilters')}
                  </Button>
                </Flex>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Filter Breadcrumbs (Story 7.3) */}
        <FilterBreadcrumbs />

        {/* Transaction List */}
        {transactionsLoading && renderSkeletons()}

        {!transactionsLoading && transactionsError && (
          <Box
            textAlign="center"
            py={8}
            px={6}
            bg="red.50"
            borderRadius="lg"
            border="1px"
            borderColor="red.200"
          >
            <Text color="red.600">{t('failedToLoadRetry')}</Text>
          </Box>
        )}

        {!transactionsLoading &&
          !transactionsError &&
          transactionsResponse?.data.length === 0 &&
          renderEmptyState()}

        {!transactionsLoading &&
          !transactionsError &&
          transactionsResponse &&
          transactionsResponse.data.length > 0 && (
            <VStack spacing={4} align="stretch">
              {transactionsResponse.data.map((transaction) => {
                const { formatted, color } = formatAmount(
                  transaction.amount,
                  transaction.type
                );

                return (
                  <Card
                    key={transaction.id}
                    _hover={{ shadow: 'md' }}
                    transition="all 0.2s"
                  >
                    <CardBody>
                      <Flex
                        direction={{ base: 'column', md: 'row' }}
                        justify="space-between"
                        align={{ base: 'flex-start', md: 'center' }}
                        gap={{ base: 3, md: 4 }}
                      >
                        {/* Left: Date, Category, Notes */}
                        <VStack align="flex-start" spacing={1} flex={1}>
                          <HStack spacing={3}>
                            <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                              {formatTransactionDate(transaction.date, dateFormat)}
                            </Text>
                            <Badge
                              colorScheme={
                                transaction.type === 'income' ? 'green' : 'red'
                              }
                              fontSize="xs"
                            >
                              {transaction.type}
                            </Badge>
                          </HStack>

                          <CategoryBadge
                            category={transaction.category}
                            variant="dot"
                            size="md"
                          />

                          {transaction.notes && (
                            <Text fontSize="sm" color="gray.600">
                              {transaction.notes}
                            </Text>
                          )}
                        </VStack>

                        {/* Middle: Action Buttons */}
                        <HStack spacing={2}>
                          <IconButton
                            aria-label={t('editTransactionAriaLabel')}
                            icon={<EditIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="blue"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(transaction);
                            }}
                            _hover={{ bg: 'blue.50' }}
                          />
                          <IconButton
                            aria-label={t('deleteTransactionAriaLabel')}
                            icon={<DeleteIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(transaction);
                            }}
                            _hover={{ bg: 'red.50' }}
                          />
                        </HStack>

                        {/* Right: Amount */}
                        <Text
                          fontSize={{ base: 'xl', md: '2xl' }}
                          fontWeight="bold"
                          color={color}
                          whiteSpace="nowrap"
                        >
                          {formatted}
                        </Text>
                      </Flex>
                    </CardBody>
                  </Card>
                );
              })}
            </VStack>
          )}

        {/* Story 9-7: Pagination Controls */}
        {!transactionsLoading && !transactionsError && transactionsResponse && (
          <PaginationControls
            currentPage={currentPage}
            totalItems={transactionsResponse.count}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            isLoading={transactionsLoading}
          />
        )}
      </Container>

      {/* Edit Transaction Modal */}
      <TransactionEntryModal
        isOpen={isEditModalOpen}
        onClose={() => {
          onEditModalClose();
          setEditingTransaction(null);
        }}
        onSuccess={handleEditSuccess}
        mode="edit"
        transaction={editingTransaction}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteAlertClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              {t('deleteConfirmTitle')}
            </AlertDialogHeader>

            <AlertDialogBody>
              {t('deleteConfirmBody')}
              <Text mt={2} fontSize="sm" color="gray.600">
                {t('undoHint')}
              </Text>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteAlertClose} isDisabled={isDeleting}>
                {tCommon('cancel')}
              </Button>
              <Button
                colorScheme="red"
                onClick={confirmDelete}
                ml={3}
                isLoading={isDeleting}
                loadingText={t('deleting')}
              >
                {tCommon('delete')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Progress Modal for Large Exports (AC-8.1.9) */}
      <Modal
        isOpen={isProgressModalOpen}
        onClose={() => {}} // Prevent manual close during export
        closeOnOverlayClick={false}
        closeOnEsc={false}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t('exportingTransactions')}</ModalHeader>
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Text>
                {t('processingLargeDataset')}
              </Text>
              <Progress
                value={exportProgress}
                size="lg"
                colorScheme="blue"
                hasStripe
                isAnimated
              />
              <Text fontSize="sm" color="gray.600" textAlign="center">
                {t('percentComplete', { percent: exportProgress })}
              </Text>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </AppLayout>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <Container maxW="container.xl" py={6}>
            <Skeleton height="40px" width="200px" mb={6} />
            <Card mb={6}>
              <CardBody>
                <VStack spacing={4}>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} w="full">
                    <Skeleton height="40px" />
                    <Skeleton height="40px" />
                    <Skeleton height="40px" />
                    <Skeleton height="40px" />
                  </SimpleGrid>
                  <Skeleton height="40px" w="full" />
                </VStack>
              </CardBody>
            </Card>
            <VStack spacing={4} w="full">
              {[...Array(5)].map((_, index) => (
                <Card key={index} w="full">
                  <CardBody>
                    <Skeleton height="80px" />
                  </CardBody>
                </Card>
              ))}
            </VStack>
          </Container>
        </AppLayout>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
