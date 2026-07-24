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
import { AddIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import useSWR, { mutate as globalMutate } from 'swr';
import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layout/AppLayout';
import { CategoryModal } from '@/components/categories/CategoryModal';
import { CategoryBadge } from '@/components/categories/CategoryBadge';
import { BudgetEditor } from '@/components/categories/BudgetEditor';
import { useHousehold } from '@/lib/hooks/useHousehold';
import { useBudgets } from '@/lib/hooks/useBudgets';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatCurrency } from '@/lib/utils/currency';
import { EmptyState } from '@/components/shared/EmptyState';
import type { BudgetSummary } from '@/types/database.types';
import type { Category } from '@/types/category.types';

// Throws on HTTP errors so SWR surfaces the error state instead of treating
// an error payload as a successful (empty) categories response.
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json();
};

export default function CategoriesPage() {
  const t = useTranslations('categories');
  const tToast = useTranslations('toast');
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
  const { household } = useHousehold();
  const canShare = !!household;

  // ADR-025: personal monthly budgets per category (with current-month usage)
  const { data: budgetsData, mutate: mutateBudgets } = useBudgets();
  const { preferences } = useUserPreferences();
  const currencyCode = preferences?.currency_format || 'EUR';
  const budgetByCategory = new Map<string, BudgetSummary>(
    (budgetsData?.budgets ?? []).map((b) => [b.category_id, b])
  );

  // Story 16.3: current-month spend per category (expenses) for the card caption.
  const { data: spendingData } = useSWR('/api/dashboard/spending-by-category', fetcher);
  const spentByCategory = new Map<string, number>(
    (Array.isArray(spendingData?.categories)
      ? (spendingData.categories as Array<{ category_id: string; amount: number }>)
      : []
    ).map((c) => [c.category_id, c.amount])
  );
  // Until budgets load, hide the editor: a "Set budget" affordance over an unseen
  // existing limit invites a silent overwrite.
  const budgetsReady = budgetsData !== undefined;
  // Budget changes move the forecast's at-risk baseline — revalidate both.
  const handleBudgetChanged = () => {
    mutateBudgets();
    globalMutate('/api/dashboard/budget-forecast', undefined, { revalidate: true });
  };

  // Defensive: the `/api/categories` SWR key is shared and was historically
  // cached in two shapes (bare array vs `{ data }`). Tolerate both so a stale
  // localStorage cache can't blank the page (see FilterBreadcrumbs fetcher note).
  const categories: Category[] = Array.isArray(data) ? data : (data?.data ?? []);

  // Story 13.5 follow-up: share / un-share any of the user's own categories (incl. default).
  const handleToggleShare = async (category: Category) => {
    const next = !category.household_id;
    try {
      const response = await fetch(`/api/categories/${category.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: next }),
      });
      if (!response.ok) throw new Error('share failed');
      await mutate();
      toast({
        title: next ? t('sharedToHousehold', { name: category.name }) : t('unsharedFromHousehold', { name: category.name }),
        status: 'success',
        duration: 2500,
        isClosable: true,
      });
    } catch {
      toast({ title: t('shareFailed'), status: 'error', duration: 3500, isClosable: true });
    }
  };

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
      title: t('createdSuccess', { name: newCategory.name }),
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
      title: t('updatedSuccess', { name: updatedCategory.name }),
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
        title: t('deletedSuccessNamed', { name: categoryToDelete.name }),
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setCategoryToDelete(null);
      onDeleteClose();
    } catch (error) {
      console.error('Delete category error:', error);
      toast({
        title: tToast('error'),
        description:
          error instanceof Error ? error.message : t('failedToDelete'),
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
    <AppLayout>
      <Container maxW="container.xl" py={8}>
        <VStack align="stretch" spacing={6}>
          {/* Header */}
          <HStack justify="space-between">
            <Heading size="lg" color="fg" fontFamily="heading" letterSpacing="tight">
              {t('manageCategories')}
            </Heading>
            <Button
              leftIcon={<AddIcon />}
              onClick={onOpen}
              aria-label={t('addCategory')}
            >
              {t('addCategory')}
            </Button>
          </HStack>

          {/* Filter Tabs */}
          <Tabs
            variant="soft-rounded"
            colorScheme="brand"
            onChange={(index) => {
              const types: Array<'all' | 'income' | 'expense'> = ['all', 'expense', 'income'];
              setSelectedType(types[index] ?? 'all');
            }}
          >
            <TabList>
              <Tab>{t('allCategories')}</Tab>
              <Tab>{t('expense')}</Tab>
              <Tab>{t('income')}</Tab>
            </TabList>

            <TabPanels>
              <TabPanel px={0}>
                <CategoryList
                  categories={filteredCategories}
                  isLoading={isLoading}
                  error={error}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                  canShare={canShare}
                  onToggleShare={handleToggleShare}
                  budgetByCategory={budgetByCategory}
                  spentByCategory={spentByCategory}
                  budgetsReady={budgetsReady}
                  currencyCode={currencyCode}
                  onBudgetChanged={handleBudgetChanged}
                />
              </TabPanel>
              <TabPanel px={0}>
                <CategoryList
                  categories={filteredCategories}
                  isLoading={isLoading}
                  error={error}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                  canShare={canShare}
                  onToggleShare={handleToggleShare}
                  budgetByCategory={budgetByCategory}
                  spentByCategory={spentByCategory}
                  budgetsReady={budgetsReady}
                  currencyCode={currencyCode}
                  onBudgetChanged={handleBudgetChanged}
                />
              </TabPanel>
              <TabPanel px={0}>
                <CategoryList
                  categories={filteredCategories}
                  isLoading={isLoading}
                  error={error}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                  canShare={canShare}
                  onToggleShare={handleToggleShare}
                  budgetByCategory={budgetByCategory}
                  spentByCategory={spentByCategory}
                  budgetsReady={budgetsReady}
                  currencyCode={currencyCode}
                  onBudgetChanged={handleBudgetChanged}
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
    </AppLayout>
  );
}

interface CategoryListProps {
  categories: Category[];
  isLoading: boolean;
  error: unknown;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  canShare: boolean;
  onToggleShare: (category: Category) => void;
  budgetByCategory: Map<string, BudgetSummary>;
  spentByCategory: Map<string, number>;
  budgetsReady: boolean;
  currencyCode: string;
  onBudgetChanged: () => void;
}

function CategoryList({
  categories,
  isLoading,
  error,
  onEdit,
  onDelete,
  canShare,
  onToggleShare,
  budgetByCategory,
  spentByCategory,
  budgetsReady,
  currencyCode,
  onBudgetChanged,
}: CategoryListProps) {
  const t = useTranslations('categories');

  if (isLoading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="lg" color="accent" />
        <Text mt={4} color="fg.muted">
          {t('loading')}
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={10}>
        <Text color="expense" fontWeight="medium">{t('failedToLoad')}</Text>
      </Box>
    );
  }

  if (categories.length === 0) {
    return (
      <Box mt={4}>
        <EmptyState icon="🏷️" title={t('noCategories')} />
      </Box>
    );
  }

  return (
    <Grid
      templateColumns={{
        base: '1fr',
        sm: 'repeat(2, 1fr)',
        lg: 'repeat(3, 1fr)',
        xl: 'repeat(4, 1fr)',
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
          canShare={canShare}
          onToggleShare={onToggleShare}
          budget={budgetByCategory.get(category.id) ?? null}
          spent={spentByCategory.get(category.id)}
          budgetsReady={budgetsReady}
          currencyCode={currencyCode}
          onBudgetChanged={onBudgetChanged}
        />
      ))}
    </Grid>
  );
}

interface CategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  canShare: boolean;
  onToggleShare: (category: Category) => void;
  budget: BudgetSummary | null;
  spent?: number;
  budgetsReady: boolean;
  currencyCode: string;
  onBudgetChanged: () => void;
}

function CategoryCard({
  category,
  onEdit,
  onDelete,
  canShare,
  onToggleShare,
  budget,
  spent,
  budgetsReady,
  currencyCode,
  onBudgetChanged,
}: CategoryCardProps) {
  const t = useTranslations('categories');
  const isShared = !!category.household_id;
  // You can share/un-share your OWN categories (predefined included) when in a household.
  const showShareToggle = canShare && category.isOwn !== false;
  // ADR-025: budgets apply to your own expense categories, once budgets have loaded
  const canBudget = category.type === 'expense' && category.isOwn !== false && budgetsReady;

  return (
    <Box
      p={4}
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      bg="surface"
      _hover={{ boxShadow: 'md', borderColor: 'border.strong' }}
      transition="all 0.2s"
      position="relative"
      sx={{ '&:hover .cat-actions, &:focus-within .cat-actions': { opacity: 1 } }}
    >
      <HStack spacing={3} justify="space-between">
        {/* Category Badge with colored background */}
        <HStack spacing={2} flex={1} minW={0} flexWrap="wrap">
          <CategoryBadge category={category} variant="badge" size="md" />

          <HStack spacing={1} flexWrap="wrap">
            <Badge
              bg={category.type === 'income' ? 'income.subtle' : 'expense.subtle'}
              color={category.type === 'income' ? 'income' : 'expense'}
              fontSize="xs"
            >
              {category.type === 'income' ? t('income') : t('expense')}
            </Badge>
            {/* No "Default" badge: with every seeded category predefined it printed on
                each card (pure noise) and wrapped the badge row on narrow desktops.
                Predefined vs custom is already signalled by the absence of edit/delete. */}
            {isShared && (
              <Badge bg="accent.subtle" color="accent" fontSize="xs">
                {t('sharedLabel')}
              </Badge>
            )}
          </HStack>
        </HStack>

        {/* Actions: share toggle (any own category, incl. default) + edit/delete (custom only) */}
        {(showShareToggle || !category.is_predefined) && (
          <HStack
            className="cat-actions"
            spacing={1}
            opacity={{ base: 1, md: 0 }}
            transition="opacity 0.2s"
            flexShrink={0}
          >
            {showShareToggle && (
              <Button
                size="xs"
                variant={isShared ? 'solid' : 'outline'}
                minH={{ base: '44px', md: '28px' }}
                onClick={() => onToggleShare(category)}
              >
                {isShared ? t('stopSharing') : t('shareWithHousehold')}
              </Button>
            )}
            {!category.is_predefined && (
              <>
                <IconButton
                  aria-label={t('editCategoryAriaLabel')}
                  icon={<EditIcon />}
                  size="sm"
                  variant="ghost"
                  minW={{ base: '44px', md: '32px' }}
                  minH={{ base: '44px', md: '32px' }}
                  onClick={() => onEdit(category)}
                />
                <IconButton
                  aria-label={t('deleteCategoryAriaLabel')}
                  icon={<DeleteIcon />}
                  size="sm"
                  variant="ghost"
                  color="expense"
                  minW={{ base: '44px', md: '32px' }}
                  minH={{ base: '44px', md: '32px' }}
                  _hover={{ bg: 'expense.subtle' }}
                  onClick={() => onDelete(category)}
                />
              </>
            )}
          </HStack>
        )}
      </HStack>

      {/* Story 16.3: current-month spend on OWN expense cards without a set budget
          (budgeted cards show spend-vs-budget via BudgetEditor below). Only render
          when spend is actually known — the endpoint omits categories with no spend,
          so `undefined` means "loading / errored / nothing spent"; showing €0.00
          there would zero-fill an unknowable value (degradation policy). */}
      {category.type === 'expense' &&
        category.isOwn !== false &&
        !budget &&
        spent !== undefined && (
          <HStack mt={3} justify="space-between" spacing={2}>
            <Text
              fontSize="2xs"
              color="fg.subtle"
              textTransform="uppercase"
              letterSpacing="wide"
              fontWeight="semibold"
              noOfLines={1}
            >
              {t('spentThisMonth')}
            </Text>
            <Text
              className="tnum"
              fontFamily="heading"
              fontWeight={600}
              color="expense"
              fontSize="sm"
              flexShrink={0}
            >
              {formatCurrency(spent, undefined, currencyCode)}
            </Text>
          </HStack>
        )}

      {/* ADR-025: monthly budget progress + set/edit/clear (own expense categories) */}
      {canBudget && (
        <BudgetEditor
          categoryId={category.id}
          categoryName={category.name}
          budget={budget}
          currencyCode={currencyCode}
          onChanged={onBudgetChanged}
        />
      )}
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
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
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
            {t('deleteConfirmTitle')}
          </AlertDialogHeader>

          <AlertDialogBody>
            {t('deleteConfirmMessage', { name: category.name })}
            <br />
            <br />
            {t('deleteConfirmWarning')}
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onClose} isDisabled={isDeleting}>
              {tCommon('cancel')}
            </Button>
            <Button
              colorScheme="red"
              onClick={onConfirm}
              ml={3}
              isLoading={isDeleting}
              loadingText={t('deleting')}
            >
              {t('deleteAnyway')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}
