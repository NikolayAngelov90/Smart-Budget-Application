'use client';

/**
 * Categories Management Page
 * Story 4.2: Create Custom Categories
 * Story 4.3: Edit and Delete Custom Categories
 *
 * Displays list of user categories (predefined + custom) with ability to:
 * - View all categories with visual color badges
 * - Create new custom categories via modal
 * - Edit custom categories (name and color)
 * - Delete custom categories with confirmation
 * - Filter by type (income/expense)
 *
 * Integrates with:
 * - GET /api/categories for fetching categories
 * - PUT /api/categories/:id for updating categories
 * - DELETE /api/categories/:id for deleting categories
 * - CategoryModal for category creation and editing
 * - SWR for data fetching and cache management
 */

import React, { useState } from 'react';
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
  IconButton,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon, ChevronLeftIcon } from '@chakra-ui/icons';
import Link from 'next/link';
import useSWR from 'swr';
import { CategoryModal } from '@/components/categories/CategoryModal';
import { CategoryBadge } from '@/components/categories/CategoryBadge';
import type { Category } from '@/types/category.types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CategoriesPage() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const toast = useToast();
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleCategoryUpdated = (updatedCategory: Category) => {
    // Optimistic UI update
    mutate(
      {
        data: categories.map((cat) =>
          cat.id === updatedCategory.id ? updatedCategory : cat
        ),
        count: categories.length,
      },
      false
    );

    toast({
      title: `Category '${updatedCategory.name}' updated successfully`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });

    setSelectedCategory(null);
    onClose();
  };

  const handleEditClick = (category: Category) => {
    setSelectedCategory(category);
    onOpen();
  };

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
    onDeleteOpen();
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/categories/${categoryToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete category');
      }

      // Optimistic UI update
      mutate(
        {
          data: categories.filter((cat) => cat.id !== categoryToDelete.id),
          count: categories.length - 1,
        },
        false
      );

      toast({
        title: `Category '${categoryToDelete.name}' deleted successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setCategoryToDelete(null);
      onDeleteClose();
    } catch (error) {
      console.error('Delete category error:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete category',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModalClose = () => {
    setSelectedCategory(null);
    onClose();
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack align="stretch" spacing={6}>
        {/* Back to Dashboard Button */}
        <Box>
          <Button
            as={Link}
            href="/dashboard"
            leftIcon={<ChevronLeftIcon />}
            variant="ghost"
            colorScheme="blue"
            size="sm"
            _hover={{ bg: 'blue.50' }}
          >
            Back to Dashboard
          </Button>
        </Box>

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
              <CategoryList
                categories={filteredCategories}
                isLoading={isLoading}
                error={error}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
            </TabPanel>
            <TabPanel px={0}>
              <CategoryList
                categories={filteredCategories}
                isLoading={isLoading}
                error={error}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
            </TabPanel>
            <TabPanel px={0}>
              <CategoryList
                categories={filteredCategories}
                isLoading={isLoading}
                error={error}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Category Modal */}
        <CategoryModal
          isOpen={isOpen}
          onClose={handleModalClose}
          onSuccess={selectedCategory ? handleCategoryUpdated : handleCategoryCreated}
          editMode={!!selectedCategory}
          category={selectedCategory}
        />

        {/* Delete Confirmation Modal */}
        {categoryToDelete && (
          <DeleteConfirmationModal
            isOpen={isDeleteOpen}
            onClose={onDeleteClose}
            onConfirm={handleDeleteConfirm}
            category={categoryToDelete}
            isDeleting={isDeleting}
          />
        )}
      </VStack>
    </Container>
  );
}

interface CategoryListProps {
  categories: Category[];
  isLoading: boolean;
  error: unknown;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

function CategoryList({
  categories,
  isLoading,
  error,
  onEdit,
  onDelete,
}: CategoryListProps) {
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
        <CategoryCard
          key={category.id}
          category={category}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </Grid>
  );
}

interface CategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

function CategoryCard({ category, onEdit, onDelete }: CategoryCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Box
      p={4}
      border="1px"
      borderColor="gray.200"
      borderRadius="md"
      bg="white"
      _hover={{ boxShadow: 'md', borderColor: 'gray.300' }}
      transition="all 0.2s"
      position="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <HStack spacing={3} justify="space-between">
        {/* Category Badge with colored background */}
        <HStack spacing={3} flex={1}>
          <CategoryBadge category={category} variant="badge" size="md" />

          <HStack spacing={2}>
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
        </HStack>

        {/* Edit and Delete Buttons for Custom Categories */}
        {!category.is_predefined && (
          <HStack
            spacing={1}
            opacity={{ base: 1, md: isHovered ? 1 : 0 }}
            transition="opacity 0.2s"
          >
            <IconButton
              aria-label="Edit category"
              icon={<EditIcon />}
              size="sm"
              variant="ghost"
              colorScheme="blue"
              onClick={() => onEdit(category)}
            />
            <IconButton
              aria-label="Delete category"
              icon={<DeleteIcon />}
              size="sm"
              variant="ghost"
              colorScheme="red"
              onClick={() => onDelete(category)}
            />
          </HStack>
        )}
      </HStack>
    </Box>
  );
}

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  category: Category;
  isDeleting: boolean;
}

function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  category,
  isDeleting,
}: DeleteConfirmationModalProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
      isCentered
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Delete Category?
          </AlertDialogHeader>

          <AlertDialogBody>
            Are you sure you want to delete the <strong>{category.name}</strong> category?
            <br />
            <br />
            Any transactions using this category will become uncategorized and can be
            re-categorized later.
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onClose} isDisabled={isDeleting}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={onConfirm}
              ml={3}
              isLoading={isDeleting}
              loadingText="Deleting..."
            >
              Delete Anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}
