'use client';

/**
 * Categories Management Page
 * Story 4.2: Create Custom Categories
 *
 * Displays list of user categories (predefined + custom) with ability to:
 * - View all categories with visual color badges
 * - Create new custom categories via modal
 * - Filter by type (income/expense)
 *
 * Integrates with:
 * - GET /api/categories for fetching categories
 * - CategoryModal for category creation
 * - SWR for data fetching and cache management
 */

import { useState } from 'react';
import {
  Box,
  Container,
  Heading,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  Grid,
  Spinner,
  useDisclosure,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import useSWR from 'swr';
import { CategoryModal } from '@/components/categories/CategoryModal';
import type { Category } from '@/types/category.types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CategoriesPage() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');

  // Fetch categories with SWR
  const { data, error, isLoading, mutate } = useSWR('/api/categories', fetcher);

  const categories: Category[] = data?.data || [];

  // Filter categories by type
  const filteredCategories =
    selectedType === 'all'
      ? categories
      : categories.filter((cat) => cat.type === selectedType);

  const handleCategoryCreated = (newCategory: Category) => {
    // Optimistic UI update
    mutate(
      {
        data: [...categories, newCategory],
        count: categories.length + 1,
      },
      false
    );

    toast({
      title: `Category '${newCategory.name}' created successfully`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });

    onClose();
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack align="stretch" spacing={6}>
        {/* Header */}
        <HStack justify="space-between">
          <Heading size="lg">Manage Categories</Heading>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="blue"
            onClick={onOpen}
            aria-label="Add Category"
          >
            Add Category
          </Button>
        </HStack>

        {/* Filter Tabs */}
        <Tabs
          variant="soft-rounded"
          colorScheme="blue"
          onChange={(index) => {
            const types: Array<'all' | 'income' | 'expense'> = ['all', 'expense', 'income'];
            setSelectedType(types[index]);
          }}
        >
          <TabList>
            <Tab>All Categories</Tab>
            <Tab>Expense</Tab>
            <Tab>Income</Tab>
          </TabList>

          <TabPanels>
            <TabPanel px={0}>
              <CategoryList categories={filteredCategories} isLoading={isLoading} error={error} />
            </TabPanel>
            <TabPanel px={0}>
              <CategoryList categories={filteredCategories} isLoading={isLoading} error={error} />
            </TabPanel>
            <TabPanel px={0}>
              <CategoryList categories={filteredCategories} isLoading={isLoading} error={error} />
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Category Modal */}
        <CategoryModal
          isOpen={isOpen}
          onClose={onClose}
          onSuccess={handleCategoryCreated}
        />
      </VStack>
    </Container>
  );
}

interface CategoryListProps {
  categories: Category[];
  isLoading: boolean;
  error: unknown;
}

function CategoryList({ categories, isLoading, error }: CategoryListProps) {
  if (isLoading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="lg" color="blue.500" />
        <Text mt={4} color="gray.600">
          Loading categories...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={10}>
        <Text color="red.500">Failed to load categories. Please try again.</Text>
      </Box>
    );
  }

  if (categories.length === 0) {
    return (
      <Box textAlign="center" py={10}>
        <Text color="gray.500">No categories found.</Text>
      </Box>
    );
  }

  return (
    <Grid
      templateColumns={{
        base: '1fr',
        sm: 'repeat(2, 1fr)',
        md: 'repeat(3, 1fr)',
        lg: 'repeat(4, 1fr)',
      }}
      gap={4}
      mt={4}
    >
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </Grid>
  );
}

interface CategoryCardProps {
  category: Category;
}

function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Box
      p={4}
      border="1px"
      borderColor="gray.200"
      borderRadius="md"
      bg="white"
      _hover={{ boxShadow: 'md', borderColor: 'gray.300' }}
      transition="all 0.2s"
    >
      <HStack spacing={3}>
        {/* Color Badge */}
        <Box
          w={4}
          h={4}
          borderRadius="full"
          bg={category.color}
          flexShrink={0}
        />

        <VStack align="start" spacing={0} flex={1}>
          <Text fontWeight="semibold" fontSize="md">
            {category.name}
          </Text>
          <HStack spacing={2} mt={1}>
            <Badge
              colorScheme={category.type === 'income' ? 'green' : 'red'}
              fontSize="xs"
            >
              {category.type}
            </Badge>
            {category.is_predefined && (
              <Badge colorScheme="gray" fontSize="xs">
                Default
              </Badge>
            )}
          </HStack>
        </VStack>
      </HStack>
    </Box>
  );
}
