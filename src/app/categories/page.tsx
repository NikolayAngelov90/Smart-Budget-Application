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

import React, { useState, useEffect } from 'react';
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
  Select,
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
import useSWR, { useSWRConfig } from 'swr';
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
import { useDatedParams } from '@/lib/hooks/useClientToday';

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
  // SCOPED mutate. The global `mutate` from 'swr' binds to SWR's own default
  // cache while every hook here reads the localStorage provider, so these
  // revalidations were no-ops (15-1).
  const { mutate: globalMutate } = useSWRConfig();

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
  // Reassign-then-delete: when the category is in use the server answers 409 and
  // we switch the dialog to "move its N transactions to <target>" mode.
  const [reassignCount, setReassignCount] = useState<number | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('');

  // Mobile "More" sheet deep-link: `/categories?new=1` (the sheet's inline "+")
  // opens the create modal on arrival, then strips the param so a refresh won't
  // reopen it. Read from window (not useSearchParams) to avoid a Suspense boundary.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1') {
      onOpen();
      window.history.replaceState(null, '', '/categories');
    }
  }, [onOpen]);

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
  // HP-7: live local day, so this key rolls over at midnight in an idle tab.
  const dated = useDatedParams();
  const { data: spendingData, mutate: mutateSpending } = useSWR(`/api/dashboard/spending-by-category?${dated}`, fetcher);
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
    // PREFIX match — the key now carries the client's local `?today=`.
    globalMutate(
      (key) => typeof key === 'string' && key.startsWith('/api/dashboard/budget-forecast'),
      undefined,
      { revalidate: true }
    );
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
    setReassignCount(null);
    setReassignTarget('');
    onDeleteOpen();
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/categories/${categoryToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        // Once a target has been chosen, send it; the first attempt sends none.
        body: JSON.stringify(reassignTarget ? { reassignTo: reassignTarget } : {}),
      });

      // 409 = the category is in use; switch the dialog to reassign mode.
      if (response.status === 409) {
        const result = await response.json().catch(() => ({}));

        // DW-5 #3: a shared category still labelling other members' spending is
        // refused outright. Reassigning on their behalf would rewrite someone
        // else's history, so there is nothing for the user to resolve here —
        // say why rather than offering a reassign picker that cannot help.
        if (result.sharedInUse) {
          setIsDeleting(false);
          setCategoryToDelete(null);
          toast({
            title: t('deleteSharedInUse', {
              count: result.otherMemberTransactionCount ?? 0,
            }),
            status: 'info',
            duration: 6000,
            isClosable: true,
          });
          return;
        }

        if (result.requiresReassign) {
          setReassignCount(result.transactionCount ?? 0);
          setIsDeleting(false);
          return;
        }
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to delete category');
      }

      // Optimistic list update; refresh spend + budgets since reassigning moved
      // transactions to the target and the deleted category's budget cascaded away.
      mutate(
        {
          data: categories.filter((cat) => cat.id !== categoryToDelete.id),
          count: categories.length - 1,
        },
        false
      );
      mutateSpending();
      mutateBudgets();

      toast({
        title: t('deletedSuccessNamed', { name: categoryToDelete.name }),
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setCategoryToDelete(null);
      setReassignCount(null);
      setReassignTarget('');
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
              reassignCount={reassignCount}
              reassignTarget={reassignTarget}
              onSelectTarget={setReassignTarget}
              // Same-type categories the transactions can move to (never the one being deleted).
              reassignOptions={categories.filter(
                (c) => c.type === categoryToDelete.type && c.id !== categoryToDelete.id
              )}
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

  // Grid tracks use minmax(0, 1fr), NOT bare `1fr`: a `1fr` track's min is
  // `auto` (min-content), so a card with wide content (long name + type + shared
  // badges, e.g. Bulgarian) grows its track and blows the whole grid past its
  // container, clipping the last column off the right edge. The 0 minimum lets
  // each column shrink to its fair share; content wraps/truncates in the card.
  return (
    <Grid
      templateColumns={{
        base: '1fr',
        sm: 'repeat(2, minmax(0, 1fr))',
        lg: 'repeat(3, minmax(0, 1fr))',
        xl: 'repeat(4, minmax(0, 1fr))',
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
      <HStack spacing={3} justify="space-between" align="flex-start">
        {/* Name pill on its OWN row, then the type/shared badges below — a single
            wrap row made the badges sit inline on short-named cards but stack under
            on long-named ones (ragged). Stacking keeps every card consistent. */}
        <VStack spacing={2} align="flex-start" flex={1} minW={0}>
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
        </VStack>

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
              minW={0}
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
  /** Non-null once the server reports the category is in use — switches to reassign mode. */
  reassignCount: number | null;
  reassignTarget: string;
  onSelectTarget: (id: string) => void;
  /** Same-type categories the transactions can be moved to. */
  reassignOptions: Category[];
}

function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  category,
  isDeleting,
  reassignCount,
  reassignTarget,
  onSelectTarget,
  reassignOptions,
}: DeleteConfirmationModalProps) {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const inUse = reassignCount !== null;
  const noTarget = inUse && reassignOptions.length === 0;
  // In reassign mode the delete can only proceed once a target is chosen.
  const confirmDisabled = inUse && (noTarget || !reassignTarget);

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
            {!inUse && (
              <>
                {t('deleteConfirmMessage', { name: category.name })}
                <br />
                <br />
                {t('deleteConfirmWarning')}
              </>
            )}

            {inUse && noTarget && (
              <Text>{t('reassignNoTarget', { count: reassignCount })}</Text>
            )}

            {inUse && !noTarget && (
              <>
                <Text mb={3}>
                  {t('reassignPrompt', { name: category.name, count: reassignCount })}
                </Text>
                <Select
                  placeholder={t('reassignPlaceholder')}
                  value={reassignTarget}
                  onChange={(e) => onSelectTarget(e.target.value)}
                  aria-label={t('reassignPlaceholder')}
                >
                  {reassignOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </>
            )}
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onClose} isDisabled={isDeleting}>
              {tCommon('cancel')}
            </Button>
            {!noTarget && (
              <Button
                colorScheme="red"
                onClick={onConfirm}
                ml={3}
                isLoading={isDeleting}
                loadingText={t('deleting')}
                isDisabled={confirmDisabled}
              >
                {inUse ? t('moveAndDelete') : t('deleteAnyway')}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}
