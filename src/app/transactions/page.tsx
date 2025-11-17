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

import { useState, useEffect, useCallback } from 'react';
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
} from '@chakra-ui/react';
import { CloseIcon, SearchIcon } from '@chakra-ui/icons';
import useSWR from 'swr';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';

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
  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

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

  // Fetch transactions
  const {
    data: transactionsResponse,
    error: transactionsError,
    isLoading: transactionsLoading,
  } = useSWR<TransactionResponse>(
    `/api/transactions?${buildQueryString()}`,
    fetcher
  );

  // Fetch categories for filter dropdown
  const { data: categoriesResponse } = useSWR<CategoryResponse>(
    '/api/categories',
    fetcher
  );

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
                    _hover={{ shadow: 'md', cursor: 'pointer' }}
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

                          <HStack spacing={2}>
                            <Box
                              w="12px"
                              h="12px"
                              borderRadius="full"
                              bg={transaction.category.color}
                            />
                            <Text fontSize="md" fontWeight="medium" color="gray.800">
                              {transaction.category.name}
                            </Text>
                          </HStack>

                          {transaction.notes && (
                            <Text fontSize="sm" color="gray.600">
                              {transaction.notes}
                            </Text>
                          )}
                        </VStack>

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
    </AppLayout>
  );
}
