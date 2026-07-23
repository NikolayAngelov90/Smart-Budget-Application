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
  Spinner,
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
  Divider,
} from '@chakra-ui/react';
import { CloseIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon, DownloadIcon } from '@chakra-ui/icons';
import useSWR from 'swr';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { bg } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import TransactionEntryModal from '@/components/transactions/TransactionEntryModal';
import { FilterBreadcrumbs } from '@/components/transactions/FilterBreadcrumbs';
import { PaginationControls, DEFAULT_PAGE_SIZE, LOCAL_STORAGE_KEY } from '@/components/transactions/PaginationControls';
import { SwipeableRow } from '@/components/transactions/SwipeableRow';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { groupTransactionsByDate } from '@/lib/utils/groupTransactionsByDate';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { createClient } from '@/lib/supabase/client';
import { exportTransactionsToCSV } from '@/lib/services/exportService'; // Story 8.1
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatCurrencyWithSign } from '@/lib/utils/currency';
import { getEnabledCurrencies } from '@/lib/config/currencies';
import { useTranslations, useLocale } from 'next-intl';

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
  currency?: string; // Story 10-6
  exchange_rate?: number | null; // Story 10-6
  created_at: string;
  category: Category;
}

interface TransactionResponse {
  data: Transaction[];
  count: number;
  limit: number;
  offset: number;
}

// Fetcher function for SWR — throws on HTTP errors so SWR surfaces the error state
// instead of rendering an error payload as data (which crashed the list view).
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json();
};

function TransactionsContent() {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');

  // Get URL search params for drill-down navigation (Story 5.5)
  const searchParams = useSearchParams();

  // Get user preferences (currency formatting; Story 8.3)
  const { preferences } = useUserPreferences();

  // Locale for the date-group headers (Story 16.1)
  const locale = useLocale();
  const dateLocale = locale === 'bg' ? bg : undefined;

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [currencyFilter, setCurrencyFilter] = useState(''); // Story 10-6: currency filter
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Mobile: collapse the filter grid behind a toggle so the transaction list isn't
  // pushed off-screen on small viewports (search stays visible).
  const { isOpen: mobileFiltersOpen, onToggle: onToggleMobileFilters } = useDisclosure();

  // Edit modal state
  const { isOpen: isEditModalOpen, onOpen: onEditModalOpen, onClose: onEditModalClose } = useDisclosure();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Create modal state — opened from the empty-state CTA (Story 16.1)
  const { isOpen: isCreateModalOpen, onOpen: onCreateModalOpen, onClose: onCreateModalClose } = useDisclosure();

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
  }, [startDate, endDate, categoryFilter, typeFilter, currencyFilter, debouncedSearch]);

  // Build the active filter params — shared by the list query and CSV export
  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();

    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (categoryFilter) params.append('category', categoryFilter);
    if (typeFilter !== 'all') params.append('type', typeFilter);
    if (currencyFilter) params.append('currency', currencyFilter);
    if (debouncedSearch) params.append('search', debouncedSearch);

    return params;
  }, [startDate, endDate, categoryFilter, typeFilter, currencyFilter, debouncedSearch]);

  // Build query string for API (Story 9-7: dynamic pagination)
  const buildQueryString = useCallback(() => {
    const params = buildFilterParams();
    params.append('limit', pageSize.toString());
    params.append('offset', ((currentPage - 1) * pageSize).toString());

    return params.toString();
  }, [buildFilterParams, pageSize, currentPage]);

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

  // AC-10.8.4: Pull-to-refresh
  const { containerRef: pullToRefreshRef, isRefreshing } = usePullToRefresh(
    useCallback(async () => {
      await mutate();
    }, [mutate])
  );

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
    startDate || endDate || categoryFilter || typeFilter !== 'all' || currencyFilter || searchQuery;

  // Count active filters inside the collapsible grid (search is always visible, so excluded)
  const activeFilterCount =
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (currencyFilter ? 1 : 0);

  // Clear all filters
  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setCategoryFilter('');
    setTypeFilter('all');
    setCurrencyFilter('');
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
          <Box p={4} bg="income" borderRadius="lg" color="white">
            <HStack justify="space-between">
              <Text>{t('deletedSuccess')}</Text>
              <Button
                size="sm"
                variant="solid"
                bg="white"
                color="income"
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
                        currency: transactionToDelete.currency,
                        exchange_rate: transactionToDelete.exchange_rate,
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

  // Story 8.1: Export transactions to CSV, respecting the active filters/date range
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      // Fetch all matching transactions without pagination
      const exportParams = buildFilterParams();
      exportParams.append('all', 'true');
      const response = await fetch(`/api/transactions?${exportParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions for export');
      }

      const data: TransactionResponse = await response.json();

      if (data.data.length === 0) {
        toast({
          title: t('noTransactionsToExport'),
          description: hasActiveFilters
            ? t('noTransactionsToExportFiltered')
            : t('addTransactionsFirst'),
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
        isLargeDataset ? (progress) => setExportProgress(progress) : undefined,
        currencyCode
      );

      // Close progress modal if open
      if (isLargeDataset) {
        onProgressModalClose();
      }

      // AC-8.1.11: Success toast
      toast({
        title: t('csvExportedSuccess'),
        description: hasActiveFilters
          ? t('exportedCountFiltered', { count: data.data.length })
          : t('exportedCount', { count: data.data.length }),
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

  // Format amount with color-coding using shared currency utility
  const currencyCode = preferences?.currency_format || 'EUR';

  // Story 10-6: Format amount with original currency and optional converted equivalent
  const formatAmount = (
    amount: number,
    type: 'income' | 'expense',
    transactionCurrency?: string,
    exchangeRate?: number | null
  ) => {
    const signedAmount = type === 'expense' ? -amount : amount;
    const txCurrency = transactionCurrency || currencyCode;
    const formatted = formatCurrencyWithSign(signedAmount, true, undefined, txCurrency);
    // Quiet Ledger semantic tokens (evergreen income / clay expense).
    const color = type === 'income' ? 'income' : 'expense';

    // Show converted equivalent if currency differs from preferred (AC-10.6.6)
    let convertedText: string | null = null;
    if (txCurrency !== currencyCode && exchangeRate) {
      const convertedAmount = amount * exchangeRate;
      const signedConverted = type === 'expense' ? -convertedAmount : convertedAmount;
      convertedText = t('convertedAmount', {
        amount: formatCurrencyWithSign(signedConverted, true, undefined, currencyCode),
      });
    }

    return { formatted, color, convertedText };
  };

  // Render loading skeletons — mirrors the grouped-row shape (Story 16.1)
  const renderSkeletons = () => (
    <Box>
      <Skeleton height="12px" width="90px" mb={2} ml={1} borderRadius="full" />
      <Box
        bg="surface"
        borderWidth="1px"
        borderColor="border"
        borderRadius="xl"
        overflow="hidden"
        boxShadow="sm"
      >
        {[...Array(5)].map((_, index) => (
          <Box key={index}>
            {index > 0 && <Divider borderColor="border" />}
            <Flex align="center" gap={3} px={{ base: 4, md: 5 }} py={3} minH="60px">
              <VStack align="start" spacing={2} flex={1}>
                <Skeleton height="16px" width="120px" />
                <SkeletonText noOfLines={1} width="160px" />
              </VStack>
              <Skeleton height="20px" width="80px" />
            </Flex>
          </Box>
        ))}
      </Box>
    </Box>
  );

  // Render empty state — distinct guidance for filtered-empty vs. no-data.
  const renderEmptyState = () => {
    if (hasActiveFilters) {
      return (
        <EmptyState
          icon="🔎"
          title={t('noTransactionsFiltered')}
          description={t('noMatchDescription')}
          cta={
            <Button variant="soft" onClick={handleClearFilters}>
              {t('clearAllFilters')}
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon="🪙"
        title={t('emptyTitle')}
        description={t('emptyDescription')}
        cta={
          <Button variant="solid" onClick={onCreateModalOpen}>
            {t('addTransaction')}
          </Button>
        }
      />
    );
  };

  return (
    <AppLayout>
      <Container maxW="container.xl" py={6}>
        {/* Page Header */}
        <Flex
          justify="space-between"
          align={{ base: 'flex-start', sm: 'center' }}
          direction={{ base: 'column', sm: 'row' }}
          gap={{ base: 3, sm: 0 }}
          mb={6}
        >
          <Heading as="h1" size="xl" color="fg" letterSpacing="tight">
            {t('title')}
          </Heading>
          {/* Story 8.1: Export to CSV Button */}
          <Button
            leftIcon={<DownloadIcon />}
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
            bg="warning.subtle"
            borderWidth="1px"
            borderColor="amber.300"
            borderRadius="lg"
            p={3}
            mb={4}
          >
            <HStack>
              <Text fontSize="sm" fontWeight="medium" color="warning.fg">
                {t('offlineBanner')}
              </Text>
            </HStack>
          </Box>
        )}

        {/* Filter Controls */}
        <Card mb={6}>
          <CardBody>
            <VStack spacing={4} align="stretch">
              {/* Mobile filter toggle — keeps the list in view; hidden on desktop where the grid always shows */}
              <Flex display={{ base: 'flex', md: 'none' }} justify="space-between" align="center">
                <Button
                  onClick={onToggleMobileFilters}
                  variant="outline"
                  size="sm"
                  rightIcon={mobileFiltersOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  aria-expanded={mobileFiltersOpen}
                >
                  {t('filters')}
                  {activeFilterCount > 0 && (
                    <Badge ml={2} bg="accent.subtle" color="accent" borderRadius="full" px={2}>
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
                {hasActiveFilters && (
                  <Button onClick={handleClearFilters} variant="ghost" size="sm" colorScheme="gray">
                    {t('clearAllFilters')}
                  </Button>
                )}
              </Flex>

              {/* Filter grid — always shown on desktop, collapsible on mobile */}
              <Box display={{ base: mobileFiltersOpen ? 'block' : 'none', md: 'block' }}>
              {/* Mobile: Vertical Stack, Desktop: Horizontal Grid */}
              <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={4}>
                {/* Date Range Filters */}
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2} color="fg.muted">
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
                  <Text fontSize="sm" fontWeight="medium" mb={2} color="fg.muted">
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
                  <Text fontSize="sm" fontWeight="medium" mb={2} color="fg.muted">
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
                  <Text fontSize="sm" fontWeight="medium" mb={2} color="fg.muted">
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

                {/* Story 10-6: Currency Filter (AC-10.6.7) */}
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2} color="fg.muted">
                    {t('currency')}
                  </Text>
                  <Select
                    value={currencyFilter}
                    onChange={(e) => setCurrencyFilter(e.target.value)}
                    placeholder={t('allCurrencies')}
                    size="md"
                  >
                    {getEnabledCurrencies().map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.symbol} {curr.code}
                      </option>
                    ))}
                  </Select>
                </Box>
              </SimpleGrid>
              </Box>

              {/* Search Input — always visible */}
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

              {/* Clear Filters Button — desktop only (mobile clear lives in the toggle row) */}
              {hasActiveFilters && (
                <Flex justify="flex-end" display={{ base: 'none', md: 'flex' }}>
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

        {/* AC-10.8.4: Pull-to-refresh indicator */}
        {isRefreshing && (
          <Flex justify="center" py={3}>
            <Spinner size="sm" color="accent" />
          </Flex>
        )}

        {/* Transaction List — ref attached for pull-to-refresh hook */}
        <Box ref={pullToRefreshRef}>
        {transactionsLoading && renderSkeletons()}

        {!transactionsLoading && transactionsError && (
          <Box
            textAlign="center"
            py={8}
            px={6}
            bg="expense.subtle"
            borderRadius="xl"
            borderWidth="1px"
            borderColor="expense"
          >
            <Text color="expense" fontWeight="medium">{t('failedToLoadRetry')}</Text>
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
            <VStack spacing={{ base: 6, md: 7 }} align="stretch">
              {groupTransactionsByDate(transactionsResponse.data, {
                todayLabel: t('groupToday'),
                yesterdayLabel: t('groupYesterday'),
                locale: dateLocale,
              }).map((group) => (
                <Box as="section" key={group.key}>
                  {/* Date header — Today / Yesterday / weekday · date */}
                  <Text
                    fontSize="2xs"
                    fontWeight="semibold"
                    letterSpacing="wider"
                    textTransform="uppercase"
                    color="fg.muted"
                    mb={2}
                    ml={1}
                  >
                    {group.label}
                  </Text>

                  {/* The group's rows share one calm surface, split by hairlines. */}
                  <Box
                    bg="surface"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="xl"
                    overflow="hidden"
                    boxShadow="sm"
                  >
                    {group.items.map((transaction, i) => {
                      const { formatted, convertedText } = formatAmount(
                        transaction.amount,
                        transaction.type,
                        transaction.currency,
                        transaction.exchange_rate
                      );

                      return (
                        <Box key={transaction.id}>
                          {i > 0 && <Divider borderColor="border" />}
                          {/* AC-10.8.3: swipe left=Delete, swipe right=Edit (mobile) */}
                          <SwipeableRow
                            onDelete={() => handleDelete(transaction)}
                            onEdit={() => handleEdit(transaction)}
                          >
                            <TransactionRow
                              category={transaction.category}
                              type={transaction.type}
                              notes={transaction.notes}
                              amountFormatted={formatted}
                              convertedText={convertedText}
                              typeLabel={t(transaction.type)}
                              editLabel={t('editTransactionAriaLabel')}
                              deleteLabel={t('deleteTransactionAriaLabel')}
                              onEdit={() => handleEdit(transaction)}
                              onDelete={() => handleDelete(transaction)}
                            />
                          </SwipeableRow>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </VStack>
          )}

        {/* Story 9-7: Pagination Controls */}
        </Box>{/* end pull-to-refresh wrapper */}

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

      {/* Create Transaction Modal — opened from the empty-state CTA (Story 16.1) */}
      <TransactionEntryModal
        isOpen={isCreateModalOpen}
        onClose={onCreateModalClose}
        onSuccess={() => {
          mutate();
          onCreateModalClose();
        }}
        mode="create"
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
                colorScheme="brand"
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
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={4} w="full">
                    <Skeleton height="40px" />
                    <Skeleton height="40px" />
                    <Skeleton height="40px" />
                    <Skeleton height="40px" />
                    <Skeleton height="40px" />
                  </SimpleGrid>
                  <Skeleton height="40px" w="full" />
                </VStack>
              </CardBody>
            </Card>
            <Box
              bg="surface"
              borderWidth="1px"
              borderColor="border"
              borderRadius="xl"
              overflow="hidden"
              boxShadow="sm"
            >
              {[...Array(5)].map((_, index) => (
                <Box key={index}>
                  {index > 0 && <Divider borderColor="border" />}
                  <Box px={{ base: 4, md: 5 }} py={3} minH="60px">
                    <Skeleton height="40px" />
                  </Box>
                </Box>
              ))}
            </Box>
          </Container>
        </AppLayout>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
