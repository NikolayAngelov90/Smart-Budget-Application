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

import { useState, useEffect, useCallback, useRef } from 'react';
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
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useToast,
} from '@chakra-ui/react';
import { CloseIcon, SearchIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import useSWR from 'swr';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import TransactionEntryModal from '@/components/transactions/TransactionEntryModal';
import { CategoryBadge } from '@/components/categories/CategoryBadge';
import { createClient } from '@/lib/supabase/client';

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

interface CategoryResponse {
  data: Category[];
  count: number;
}

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TransactionsPage() {
  // Get URL search params for drill-down navigation (Story 5.5)
  const searchParams = useSearchParams();

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

  // Toast for undo functionality
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

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
      } catch (error) {
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

  // Build query string for API
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();

    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (categoryFilter) params.append('category', categoryFilter);
    if (typeFilter !== 'all') params.append('type', typeFilter);
    if (debouncedSearch) params.append('search', debouncedSearch);
    params.append('limit', '100');
    params.append('offset', '0');

    return params.toString();
  }, [startDate, endDate, categoryFilter, typeFilter, debouncedSearch]);

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
  const { data: categoriesResponse } = useSWR<CategoryResponse>(
    '/api/categories',
    fetcher
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
        title: 'Connection restored',
        description: 'Your data will sync automatically',
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
        title: 'Connection lost',
        description: 'Changes will sync when connection is restored',
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
  }, [toast, mutate]);

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
        title: 'Transaction deleted successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
        position: 'bottom',
        render: ({ onClose }) => (
          <Box p={4} bg="green.500" borderRadius="md" color="white">
            <HStack justify="space-between">
              <Text>Transaction deleted successfully</Text>
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
                        title: 'Transaction restored',
                        status: 'success',
                        duration: 2000,
                      });
                    } else {
                      throw new Error('Failed to restore');
                    }
                  } catch (error) {
                    console.error('Error restoring transaction:', error);
                    toast({
                      title: 'Failed to restore transaction',
                      status: 'error',
                      duration: 3000,
                    });
                    // Revert optimistic update
                    mutate();
                  }
                }}
              >
                Undo
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
            title: 'Failed to delete transaction',
            description: 'The transaction has been restored',
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
        title: 'Failed to delete transaction',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsDeleting(false);
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
      ? 'No transactions found. Try different filters.'
      : 'No transactions yet. Add your first one!';

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
            Click the + button to add a transaction
          </Text>
        )}
      </Box>
    );
  };

  return (
    <AppLayout>
      <Container maxW="container.xl" py={6}>
        {/* Page Header */}
        <Heading as="h1" size="xl" mb={6} color="gray.800">
          Transactions
        </Heading>

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
                📡 You're offline - Changes will sync when connection is restored
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
                    Start Date
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
                    End Date
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
                    Category
                  </Text>
                  <Select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    placeholder="All Categories"
                    size="md"
                  >
                    {categoriesResponse?.data.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Box>

                {/* Type Filter */}
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.700">
                    Type
                  </Text>
                  <Select
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(e.target.value as 'all' | 'income' | 'expense')
                    }
                    size="md"
                  >
                    <option value="all">All</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </Select>
                </Box>
              </SimpleGrid>

              {/* Search Input */}
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.700">
                  Search
                </Text>
                <HStack>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <SearchIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      placeholder="Search by notes, category, or amount..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      size="md"
                    />
                  </InputGroup>
                  {searchQuery && (
                    <IconButton
                      aria-label="Clear search"
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
                    Clear All Filters
                  </Button>
                </Flex>
              )}
            </VStack>
          </CardBody>
        </Card>

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
            <Text color="red.600">Failed to load transactions. Please try again.</Text>
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
                              {format(new Date(transaction.date), 'MMM dd, yyyy')}
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
                            aria-label="Edit transaction"
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
                            aria-label="Delete transaction"
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
              Delete Transaction
            </AlertDialogHeader>

            <AlertDialogBody>
              Delete this transaction? This cannot be undone.
              <Text mt={2} fontSize="sm" color="gray.600">
                (You will have 5 seconds to undo after deletion)
              </Text>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteAlertClose} isDisabled={isDeleting}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={confirmDelete}
                ml={3}
                isLoading={isDeleting}
                loadingText="Deleting..."
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </AppLayout>
  );
}
