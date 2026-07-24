/**
 * Transaction Entry Modal Component
 * Story 3.1: Quick Transaction Entry Modal
 *
 * Modal for quick transaction entry optimized for <30 second completion
 *
 * Features:
 * - React Hook Form + Zod validation
 * - Auto-focus on amount input
 * - Numeric keyboard on mobile (inputMode="decimal")
 * - Auto-format amount to 2 decimal places
 * - Transaction type toggle (Expense/Income)
 * - Category dropdown (recently-used first)
 * - Date picker with quick options (Today, Yesterday, 2 days ago)
 * - Optional notes field (100 char limit)
 * - Save button disabled until required fields filled
 * - Optimistic UI updates
 * - Success toast + auto-close
 * - Full keyboard navigation
 * - Mobile responsive (full-screen on small devices, 600px centered on desktop)
 *
 * Usage:
 * <TransactionEntryModal
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   onSuccess={() => mutate('/api/transactions')}
 * />
 */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerBody,
  DrawerHeader,
  DrawerCloseButton,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  Textarea,
  VStack,
  HStack,
  Flex,
  useToast,
  useBreakpointValue,
  Box,
  Text,
  Spinner,
  Tooltip,
  Checkbox,
  Collapse,
} from '@chakra-ui/react';
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { format, subDays } from 'date-fns';
import { useTranslations } from 'next-intl';
import { CategoryMenu } from '@/components/categories/CategoryMenu';
import { useAllowance } from '@/lib/hooks/useAllowance';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { useSmartNudge } from '@/lib/hooks/useSmartNudge';
import { SmartNudge } from '@/components/ai/SmartNudge';
import { getEnabledCurrencies } from '@/lib/config/currencies';
import { triggerHaptic } from '@/lib/utils/haptic';
import { localDayKey } from '@/lib/ai/streakEngine';
import { useAchievementToast } from '@/lib/hooks/useAchievementToast';
import type { AchievementKey, NudgePayload } from '@/types/database.types';

// Transaction type
type TransactionType = 'expense' | 'income';

// Category interface
interface Category {
  id: string;
  name: string;
  color: string;
  type: TransactionType;
  last_used_at?: string | null;
  usage_count?: number;
  household_id?: string | null; // Story 13.6: shared categories can't be tagged to an allowance
}

// Form validation schema
const transactionSchema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      { message: 'Amount must be a positive number' }
    )
    .refine(
      (val) => {
        const decimals = val.split('.')[1];
        return !decimals || decimals.length <= 2;
      },
      { message: 'Amount can have maximum 2 decimal places' }
    ),
  type: z.enum(['expense', 'income']),
  category_id: z.string().min(1, 'Please select a category'),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().max(100, 'Notes must be 100 characters or less').optional(),
  currency: z.string().min(1).optional(), // Story 10-6
});

type TransactionFormData = z.infer<typeof transactionSchema>;

// Transaction interface for edit mode
interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category_id: string;
  date: string;
  notes?: string | null;
  currency?: string; // Story 10-6
  exchange_rate?: number | null; // Story 10-6
  category: {
    id: string;
    name: string;
    color: string;
    type: TransactionType;
  };
}

interface TransactionEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
  transaction?: Transaction | null;
}

export default function TransactionEntryModal({
  isOpen,
  onClose,
  onSuccess,
  mode = 'create',
  transaction = null,
}: TransactionEntryModalProps) {
  const toast = useToast();
  const toastAchievements = useAchievementToast();
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const { nudge, showNudge, dismissNudge } = useSmartNudge();
  // AC-10.8.8: Use bottom sheet Drawer on mobile, centered Modal on desktop
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentCategories, setRecentCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Story 8.5: Check online status to disable mutations when offline
  const { isOnline } = useOnlineStatus();

  // Story 10-6: Currency support
  const { preferences } = useUserPreferences();
  const preferredCurrency = preferences?.currency_format || 'EUR';
  const enabledCurrencies = getEnabledCurrencies();
  const [selectedCurrency, setSelectedCurrency] = useState<string>(preferredCurrency);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  // Story 13.6: optional tagging to the private personal allowance (create + expense only).
  const { status: allowanceStatus } = useAllowance();
  const [useAllowanceTag, setUseAllowanceTag] = useState(false);

  // Story 16.2: secondary fields (date/notes) collapse behind "More details".
  // Edit mode seeds this open (below); `detailsOpen` is computed after the form
  // is set up so it can also auto-reveal on a hidden-field error.
  const [showDetails, setShowDetails] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    mode: 'onChange',
    defaultValues: {
      type: 'expense',
      date: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const transactionType = watch('type');
  const amountValue = watch('amount');
  const selectedCategoryId = watch('category_id');

  // Drive the "More details" disclosure from showDetails (so the toggle works in
  // edit mode too), and auto-reveal when a hidden secondary field is invalid.
  const detailsOpen = showDetails || !!errors.date || !!errors.notes;

  // Story 13.6: the allowance toggle is offered only for a NEW personal (non-shared) expense
  // when the user has an allowance configured.
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const canTagAllowance =
    mode === 'create' &&
    transactionType === 'expense' &&
    !!allowanceStatus?.allowance &&
    !!selectedCategory &&
    !selectedCategory.household_id;

  // Story 16.2: one-tap quick-pick chips = recently-used first, then most-used,
  // capped at 6 — the fast path; the full CategoryMenu covers the long tail.
  const quickCategories = useMemo(() => {
    const quick: Category[] = recentCategories.slice(0, 6);
    const seen = new Set(quick.map((c) => c.id));
    for (const c of [...categories].sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0))) {
      if (quick.length >= 6) break;
      if (!seen.has(c.id)) {
        quick.push(c);
        seen.add(c.id);
      }
    }
    return quick.slice(0, 6);
  }, [recentCategories, categories]);

  // Auto-format amount to 2 decimal places on blur
  const handleAmountBlur = () => {
    if (amountValue) {
      const parsed = parseFloat(amountValue);
      if (!isNaN(parsed)) {
        setValue('amount', parsed.toFixed(2), { shouldValidate: true });
      }
    }
  };

  // Fetch categories from API
  const fetchCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const response = await fetch(`/api/categories?type=${transactionType}`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || []);
        setRecentCategories(data.recent || []); // Story 4.5: Use recent categories from API
      } else {
        toast({
          title: t('failedToLoadCategories'),
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: t('failedToLoadCategories'),
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoadingCategories(false);
    }
  }, [transactionType, toast, t]);

  // Fetch categories when modal opens or type changes
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen, fetchCategories]);

  // Pre-fill form when editing a transaction
  useEffect(() => {
    if (isOpen && mode === 'edit' && transaction) {
      reset({
        amount: transaction.amount.toFixed(2),
        type: transaction.type,
        category_id: transaction.category_id,
        date: transaction.date,
        notes: transaction.notes || '',
        currency: transaction.currency || preferredCurrency,
      });
      setSelectedCurrency(transaction.currency || preferredCurrency);
      setExchangeRate(transaction.exchange_rate ?? null);
      setShowDetails(true); // edit: secondary fields open by default
    } else if (isOpen && mode === 'create') {
      // Reset to default values for create mode
      reset({
        amount: '',
        type: 'expense',
        category_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
        currency: preferredCurrency,
      });
      setSelectedCurrency(preferredCurrency);
      setExchangeRate(null);
      setUseAllowanceTag(false);
      setShowDetails(false);
    }
  }, [isOpen, mode, transaction, reset, preferredCurrency]);

  // Story 10-6 AC-10.6.5: Auto-fetch exchange rate when currency changes
  // Uses AbortController to cancel stale requests when currency changes rapidly
  useEffect(() => {
    if (selectedCurrency === preferredCurrency) {
      setExchangeRate(null);
      return;
    }

    const controller = new AbortController();
    async function fetchRate() {
      try {
        const response = await fetch(
          `/api/exchange-rates?base=${selectedCurrency}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error('Failed to fetch exchange rate');
        }
        const data = await response.json();
        const rate = data.rates?.[preferredCurrency];
        if (rate) {
          setExchangeRate(rate);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        toast({
          title: t('exchangeRateUnavailable') || 'Exchange rate unavailable',
          description: t('exchangeRateError') || 'Could not fetch exchange rate. You can still save the transaction.',
          status: 'warning',
          duration: 4000,
          isClosable: true,
        });
      }
    }

    fetchRate();
    return () => { controller.abort(); };
  }, [selectedCurrency, preferredCurrency, toast, t]);

  // Quick date setter functions
  const setQuickDate = (daysAgo: number) => {
    const date = subDays(new Date(), daysAgo);
    setValue('date', format(date, 'yyyy-MM-dd'), { shouldValidate: true });
  };

  // Form submission handler
  const onSubmit = async (data: TransactionFormData) => {
    // Story 8.5 AC-8.5.3: Prevent submission when offline
    if (!isOnline) {
      toast({
        title: t('offlineMessage'),
        description: t('offlineDescription'),
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let response;

      if (mode === 'edit' && transaction) {
        // Update existing transaction
        response = await fetch(`/api/transactions/${transaction.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(data.amount),
            type: data.type,
            category_id: data.category_id,
            date: data.date,
            notes: data.notes || undefined,
            currency: selectedCurrency,
            exchange_rate: exchangeRate,
          }),
        });
      } else {
        // Create new transaction
        response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(data.amount),
            type: data.type,
            category_id: data.category_id,
            date: data.date,
            notes: data.notes || undefined,
            currency: selectedCurrency,
            exchange_rate: exchangeRate,
            // Story 13.6: tag as private allowance spending when the toggle is eligible + on.
            allowance_id: canTagAllowance && useAllowanceTag ? allowanceStatus?.allowance?.id : undefined,
            // Story 15.1: the USER's calendar day, so the streak counts local days
            // (server clamps to ±1 day of its own clock)
            log_day: localDayKey(new Date()),
          }),
        });
      }

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error((responseData as { error?: string }).error || `Failed to ${mode === 'edit' ? 'update' : 'create'} transaction`);
      }

      // Story 12.3: Surface spending nudge if one fired (expense creates only)
      const nudgePayload = (responseData as { nudge?: NudgePayload | null }).nudge;
      if (nudgePayload && mode === 'create') {
        showNudge(nudgePayload);
      }

      // Story 15.3: celebrate newly unlocked achievements (create only). The
      // modal owns the response, so this single wiring point covers BOTH
      // mount points (dashboard modal + AppLayout quick-add).
      if (mode === 'create') {
        toastAchievements((responseData as { achievements?: AchievementKey[] }).achievements);
      }

      // Success!
      toast({
        title: mode === 'edit' ? t('updatedSuccess') : t('addedSuccess'),
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Reset form only if creating (for quick next entry)
      if (mode === 'create') {
        reset({
          amount: '',
          type: 'expense',
          category_id: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          notes: '',
          currency: preferredCurrency,
        });
        setSelectedCurrency(preferredCurrency);
        setExchangeRate(null);
        setUseAllowanceTag(false);
      setShowDetails(false);
      }

      // AC-10.8.6: Haptic feedback on successful transaction save
      triggerHaptic(50);

      // Call success callback (e.g., to refresh transaction list)
      if (onSuccess) {
        onSuccess();
      }

      // Keep modal open when a nudge fires so the user sees the coaching message;
      // dismiss button closes it. Auto-close when no nudge.
      if (!nudgePayload || mode !== 'create') {
        onClose();
      }
    } catch (error) {
      console.error(`Error ${mode === 'edit' ? 'updating' : 'creating'} transaction:`, error);
      toast({
        title: t('failedToSave'),
        description: error instanceof Error ? error.message : 'Network error - please try again',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit(onSubmit)}>
      <VStack spacing={5} align="stretch">
        {/* Story 12.3: Spending nudge banner — shown when transaction triggers a threshold */}
        <SmartNudge nudge={nudge} onDismiss={() => { dismissNudge(); onClose(); }} />

        {/* Amount — the hero of the composer (Story 16.2) */}
        <FormControl isInvalid={!!errors.amount} isRequired>
          <Flex align="center" justify="center" gap={1.5} minH="76px">
            <Text
              fontFamily="heading"
              fontSize={{ base: '2xl', md: '3xl' }}
              fontWeight={600}
              color="fg.muted"
              lineHeight={1}
            >
              {enabledCurrencies.find((c) => c.code === selectedCurrency)?.symbol ?? ''}
            </Text>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              pattern="^\d+(\.\d{1,2})?$"
              placeholder="0.00"
              aria-label={t('amount')}
              autoComplete="off"
              autoCorrect="off"
              autoFocus
              {...register('amount')}
              onBlur={handleAmountBlur}
              variant="unstyled"
              _focusVisible={{ boxShadow: 'focus', borderRadius: 'lg' }}
              className="tnum"
              fontFamily="heading"
              fontSize={{ base: '5xl', md: '6xl' }}
              fontWeight={700}
              letterSpacing="tight"
              textAlign="center"
              w="full"
              maxW="260px"
              color="fg"
              lineHeight={1}
              sx={{ '::placeholder': { color: 'paper.300' } }}
            />
          </Flex>
          {errors.amount && (
            <FormErrorMessage justifyContent="center">{errors.amount.message}</FormErrorMessage>
          )}
        </FormControl>

        {/* Story 10-6: Currency Selector (AC-10.6.3) */}
        {enabledCurrencies.length > 1 && (
          <FormControl>
            <FormLabel>{t('currency')}</FormLabel>
            <HStack spacing={2}>
              {enabledCurrencies.map((curr) => (
                <Button
                  key={curr.code}
                  flex={1}
                  size="sm"
                  variant={selectedCurrency === curr.code ? 'solid' : 'outline'}
                  onClick={() => {
                    setSelectedCurrency(curr.code);
                    setValue('currency', curr.code);
                  }}
                  minH="36px"
                >
                  {curr.symbol} {curr.code}
                </Button>
              ))}
            </HStack>
            {exchangeRate && selectedCurrency !== preferredCurrency && (
              <Text fontSize="xs" color="accent" mt={1}>
                1 {selectedCurrency} = {exchangeRate.toFixed(4)} {preferredCurrency}
              </Text>
            )}
          </FormControl>
        )}

        {/* Transaction Type — segmented control (Story 16.2) */}
        <FormControl>
          <HStack spacing={1} p={1} bg="surface.sunken" borderRadius="xl" role="group" aria-label={t('type')}>
            <Button
              flex={1}
              variant="unstyled"
              h="44px"
              borderRadius="lg"
              fontWeight={600}
              bg={transactionType === 'expense' ? 'expense' : 'transparent'}
              color={transactionType === 'expense' ? 'white' : 'fg.muted'}
              _hover={transactionType === 'expense' ? {} : { color: 'fg' }}
              _focusVisible={{ boxShadow: 'focus' }}
              onClick={() => {
                setValue('type', 'expense', { shouldValidate: true });
                setValue('category_id', '', { shouldValidate: true });
              }}
              aria-pressed={transactionType === 'expense'}
            >
              {t('expense')}
            </Button>
            <Button
              flex={1}
              variant="unstyled"
              h="44px"
              borderRadius="lg"
              fontWeight={600}
              bg={transactionType === 'income' ? 'income' : 'transparent'}
              color={transactionType === 'income' ? 'white' : 'fg.muted'}
              _hover={transactionType === 'income' ? {} : { color: 'fg' }}
              _focusVisible={{ boxShadow: 'focus' }}
              onClick={() => {
                setValue('type', 'income', { shouldValidate: true });
                setValue('category_id', '', { shouldValidate: true });
              }}
              aria-pressed={transactionType === 'income'}
            >
              {t('income')}
            </Button>
          </HStack>
        </FormControl>

        {/* Category — quick-pick chips (fast path) + full menu (Story 16.2) */}
        <FormControl isInvalid={!!errors.category_id} isRequired>
          <FormLabel htmlFor="category_id" fontSize="sm" color="fg.muted">{t('category')}</FormLabel>
          {isLoadingCategories ? (
            <Box display="flex" alignItems="center" justifyContent="center" py={4}>
              <Spinner size="md" color="accent" />
              <Text ml={3} color="fg.muted">{tCommon('loading')}</Text>
            </Box>
          ) : (
            <VStack align="stretch" spacing={2}>
              {quickCategories.length > 0 && (
                <Flex
                  gap={2}
                  overflowX="auto"
                  pb={1}
                  sx={{ scrollbarWidth: 'none', '::-webkit-scrollbar': { display: 'none' } }}
                >
                  {quickCategories.map((cat) => {
                    const active = selectedCategoryId === cat.id;
                    return (
                      <Button
                        key={cat.id}
                        variant="unstyled"
                        h="44px"
                        minH="44px"
                        px={3}
                        flexShrink={0}
                        display="inline-flex"
                        alignItems="center"
                        borderRadius="full"
                        borderWidth="1px"
                        borderColor={active ? 'accent' : 'border'}
                        bg={active ? 'accent.subtle' : 'surface'}
                        _focusVisible={{ boxShadow: 'focus' }}
                        onClick={() => setValue('category_id', cat.id, { shouldValidate: true })}
                        aria-pressed={active}
                      >
                        <HStack spacing={2}>
                          <Box w="9px" h="9px" borderRadius="full" bg={cat.color} flexShrink={0} />
                          <Text
                            fontSize="sm"
                            fontWeight={active ? 600 : 500}
                            color="fg"
                            whiteSpace="nowrap"
                            maxW="140px"
                            overflow="hidden"
                            textOverflow="ellipsis"
                          >
                            {cat.name}
                          </Text>
                        </HStack>
                      </Button>
                    );
                  })}
                </Flex>
              )}
              <CategoryMenu
                categories={categories}
                value={watch('category_id')}
                onChange={(categoryId) => setValue('category_id', categoryId, { shouldValidate: true })}
                placeholder={t('selectCategory')}
                isInvalid={!!errors.category_id}
                size="lg"
                recentCategories={recentCategories}
              />
            </VStack>
          )}
          {errors.category_id && (
            <FormErrorMessage>{errors.category_id.message}</FormErrorMessage>
          )}
        </FormControl>

        {/* Story 13.6: tag this expense to the private personal allowance */}
        {canTagAllowance && (
          <FormControl>
            <Checkbox
              isChecked={useAllowanceTag}
              onChange={(e) => setUseAllowanceTag(e.target.checked)}
              colorScheme="brand"
            >
              <Text fontSize="sm">{t('countTowardAllowance')}</Text>
            </Checkbox>
            <Text fontSize="xs" color="fg.subtle" mt={1} ml={6}>
              {t('allowancePrivacyHint')}
            </Text>
          </FormControl>
        )}

        {/* Story 16.2: secondary fields (date/notes) behind a "More details" disclosure */}
        <Button
          variant="ghost"
          size="sm"
          alignSelf="flex-start"
          px={0}
          color="fg.muted"
          onClick={() => setShowDetails((v) => !v)}
          rightIcon={detailsOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
          aria-expanded={detailsOpen}
        >
          {detailsOpen ? t('fewerDetails') : t('moreDetails')}
        </Button>
        <Collapse in={detailsOpen} animateOpacity>
          <VStack align="stretch" spacing={5}>
        {/* Date Picker with Quick Options */}
        <FormControl isInvalid={!!errors.date} isRequired>
          <FormLabel htmlFor="date">{t('date')}</FormLabel>
          <HStack spacing={2} mb={2}>
            <Button size="sm" variant="outline" onClick={() => setQuickDate(0)} minH="36px">
              {t('today')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setQuickDate(1)} minH="36px">
              {t('yesterday')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setQuickDate(2)} minH="36px">
              {t('twoDaysAgo')}
            </Button>
          </HStack>
          <Input
            id="date"
            type="date"
            size="lg"
            max={format(new Date(), 'yyyy-MM-dd')}
            {...register('date')}
            _focus={{
              borderColor: 'accent',
              boxShadow: '0 0 0 1px var(--chakra-colors-accent)',
            }}
          />
          {errors.date && <FormErrorMessage>{errors.date.message}</FormErrorMessage>}
        </FormControl>

        {/* Notes Field (Optional) */}
        <FormControl isInvalid={!!errors.notes}>
          <FormLabel htmlFor="notes">{t('notes')} ({tCommon('optional')})</FormLabel>
          <Textarea
            id="notes"
            placeholder={t('notesPlaceholder')}
            size="md"
            rows={2}
            maxLength={100}
            {...register('notes')}
            _focus={{
              borderColor: 'accent',
              boxShadow: '0 0 0 1px var(--chakra-colors-accent)',
            }}
          />
          {errors.notes && <FormErrorMessage>{errors.notes.message}</FormErrorMessage>}
          <Text fontSize="xs" color="fg.subtle" mt={1}>
            {t('maxCharacters', { max: 100 })}
          </Text>
        </FormControl>
          </VStack>
        </Collapse>
      </VStack>

      {/* Action buttons — pinned to the sheet foot so Save is always thumb-reachable
          even with "More details" expanded (Story 16.2 review). */}
      <Box
        mt={6}
        display="flex"
        justifyContent="flex-end"
        gap={3}
        position="sticky"
        bottom={0}
        bg="surface"
        borderTopWidth="1px"
        borderColor="border"
        pt={3}
        pb={isMobile ? 4 : 0}
      >
        <Button
          variant="ghost"
          onClick={onClose}
          isDisabled={isSubmitting}
          minH="48px"
        >
          {tCommon('cancel')}
        </Button>
        <Tooltip
          label={!isOnline ? t('availableWhenOnline') : ''}
          placement="top"
          hasArrow
        >
          <Button
            type="submit"
            bg="accent"
            color="white"
            _hover={{ bg: isOnline ? 'accent.emphasis' : 'accent' }}
            _active={{ bg: isOnline ? 'evergreen.700' : 'accent' }}
            isLoading={isSubmitting}
            isDisabled={!isValid || isSubmitting || !isOnline}
            loadingText="Saving..."
            minH="48px"
            opacity={!isOnline ? 0.4 : 1}
          >
            {mode === 'edit' ? tCommon('save') : t('add')}
          </Button>
        </Tooltip>
      </Box>
    </form>
  );

  // AC-10.8.8: Bottom sheet Drawer on mobile, centered Modal on desktop
  if (isMobile) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} placement="bottom" size="full">
        <DrawerOverlay />
        <DrawerContent borderTopRadius="xl" maxH="95vh">
          {/* Drag handle indicator */}
          <Box pt={3} pb={1} display="flex" justifyContent="center">
            <Box w="40px" h="4px" bg="border.strong" borderRadius="full" />
          </Box>
          <DrawerHeader borderBottomWidth="1px" py={3}>
            {mode === 'edit' ? t('editTransaction') : t('addTransaction')}
            <DrawerCloseButton />
          </DrawerHeader>
          <DrawerBody overflowY="auto" pb="env(safe-area-inset-bottom)">
            {formContent}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      isCentered
      closeOnOverlayClick={false}
      initialFocusRef={undefined}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{mode === 'edit' ? t('editTransaction') : t('addTransaction')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>{formContent}</ModalBody>
        <ModalFooter />
      </ModalContent>
    </Modal>
  );
}
