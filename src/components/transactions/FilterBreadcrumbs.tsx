'use client';

/**
 * FilterBreadcrumbs Component
 * Story 7.3: Code Quality Improvements
 *
 * Displays active drill-down filters (category and/or month) with a clear button.
 * Reads filter state from URL query parameters and provides visual feedback for active filters.
 *
 * Features:
 * - Displays category name (from ID lookup) with color badge
 * - Displays formatted month (e.g., "November 2024")
 * - Clear button removes all filters and navigates to base /transactions page
 * - Only renders when filters are active (returns null otherwise)
 */

import { useSearchParams, useRouter } from 'next/navigation';
import { HStack, Text, IconButton, Box } from '@chakra-ui/react';
import { MdClose } from 'react-icons/md';
import useSWR from 'swr';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { CategoryBadge } from '@/components/categories/CategoryBadge';

/**
 * Category type (matches CategoryBadge interface)
 */
interface Category {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
}

interface CategoriesResponse {
  data: Category[];
}

/**
 * Fetcher for SWR.
 *
 * IMPORTANT: the SWR key `/api/categories` is SHARED with the Categories page,
 * ValuesPlanSection and the Transactions page. SWR caches by key regardless of
 * the fetcher, and the other consumers store/read the full `{ data: [...] }`
 * object. Returning the bare array here previously poisoned that shared cache,
 * so after visiting Transactions the Categories page read `data.data` off an
 * array and rendered "No categories found". Keep the `{ data }` shape.
 */
async function fetcher(url: string): Promise<CategoriesResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch categories');
  }
  return response.json(); // { data: [...], recent: [...], count: number }
}

/**
 * FilterBreadcrumbs Component
 * Displays active category and/or month filters
 */
export function FilterBreadcrumbs() {
  const t = useTranslations('transactions');
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get filter values from URL
  const categoryId = searchParams.get('category');
  const month = searchParams.get('month');

  // Fetch categories for name lookup (shared `{ data }` shape — see fetcher note)
  const { data } = useSWR<CategoriesResponse>('/api/categories', fetcher);

  // If no filters active, don't render breadcrumbs
  if (!categoryId && !month) {
    return null;
  }

  // Find category by ID
  const category = categoryId
    ? data?.data?.find((c) => c.id === categoryId)
    : null;

  // Format month display
  let monthFormatted: string | null = null;
  if (month) {
    try {
      const [year = '', monthNum = ''] = month.split('-');
      const date = new Date(parseInt(year), parseInt(monthNum) - 1);
      monthFormatted = format(date, 'MMMM yyyy'); // e.g., "November 2024"
    } catch (error) {
      console.error('[FilterBreadcrumbs] Error formatting month:', error);
      monthFormatted = month; // Fallback to raw value
    }
  }

  // Handle clear filters button
  const handleClearFilters = () => {
    router.push('/transactions');
  };

  return (
    <Box
      bg="gray.50"
      borderRadius="md"
      p={4}
      mb={4}
      borderWidth="1px"
      borderColor="gray.200"
    >
      <HStack spacing={3} align="center" flexWrap="wrap">
        <Text fontSize="sm" fontWeight="semibold" color="gray.700">
          {t('filtering')}
        </Text>

        {/* Category filter */}
        {category && (
          <CategoryBadge
            category={category}
            variant="badge"
            size="sm"
          />
        )}

        {/* Month filter */}
        {monthFormatted && (
          <Text fontSize="sm" fontWeight="medium" color="gray.700">
            {monthFormatted}
          </Text>
        )}

        {/* Clear filters button */}
        <IconButton
          aria-label={t('clearFilters')}
          icon={<MdClose />}
          size="sm"
          variant="ghost"
          colorScheme="gray"
          onClick={handleClearFilters}
          ml="auto"
        />
      </HStack>
    </Box>
  );
}
