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

import { useEffect, useState, useCallback } from 'react';
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
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  Textarea,
  VStack,
  HStack,
  useToast,
  Box,
  Text,
  Spinner,
  Tooltip,
} from '@chakra-ui/react';
import { format, subDays } from 'date-fns';
import { useTranslations } from 'next-intl';
import { CategoryMenu } from '@/components/categories/CategoryMenu';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { getEnabledCurrencies } from '@/lib/config/currencies';

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
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
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
    }
  }, [isOpen, mode, transaction, reset, preferredCurrency]);

  // Story 10-6 AC-10.6.5: Auto-fetch exchange rate when currency changes
  useEffect(() => {
    if (selectedCurrency === preferredCurrency) {
      setExchangeRate(null);
      return;
    }

    let cancelled = false;
    async function fetchRate() {
      try {
        const response = await fetch(
          `/api/exchange-rates?base=${selectedCurrency}`
        );
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (cancelled) return;
        const rate = data.rates?.[preferredCurrency];
        if (rate) {
          setExchangeRate(rate);
        }
      } catch {
        // Silently fail - exchange rate is optional
      }
    }

    fetchRate();
    return () => { cancelled = true; };
  }, [selectedCurrency, preferredCurrency]);

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
          }),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${mode === 'edit' ? 'update' : 'create'} transaction`);
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
      }

      // Call success callback (e.g., to refresh transaction list)
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: 'full', md: 'xl' }}
      isCentered
      closeOnOverlayClick={false}
      initialFocusRef={undefined}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{mode === 'edit' ? t('editTransaction') : t('addTransaction')}</ModalHeader>
        <ModalCloseButton />

        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalBody>
            <VStack spacing={5} align="stretch">
              {/* Amount Field */}
              <FormControl isInvalid={!!errors.amount} isRequired>
                <FormLabel htmlFor="amount">{t('amount')}</FormLabel>
                <Input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  pattern="^\d+(\.\d{1,2})?$"
                  placeholder="0.00"
                  size="lg"
                  fontSize="2xl"
                  fontWeight="semibold"
                  textAlign="right"
                  autoFocus
                  {...register('amount')}
                  onBlur={handleAmountBlur}
                  _focus={{
                    borderColor: '#2b6cb0',
                    boxShadow: '0 0 0 1px #2b6cb0',
                  }}
                />
                {errors.amount && (
                  <FormErrorMessage>{errors.amount.message}</FormErrorMessage>
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
                        colorScheme={selectedCurrency === curr.code ? 'blue' : 'gray'}
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
                    <Text fontSize="xs" color="blue.600" mt={1}>
                      1 {selectedCurrency} = {exchangeRate.toFixed(4)} {preferredCurrency}
                    </Text>
                  )}
                </FormControl>
              )}

              {/* Transaction Type Toggle */}
              <FormControl>
                <FormLabel htmlFor="type">{t('type')}</FormLabel>
                <HStack spacing={2}>
                  <Button
                    flex={1}
                    variant={transactionType === 'expense' ? 'solid' : 'outline'}
                    colorScheme={transactionType === 'expense' ? 'red' : 'gray'}
                    onClick={() => setValue('type', 'expense', { shouldValidate: true })}
                    minH="44px"
                  >
                    {t('expense')}
                  </Button>
                  <Button
                    flex={1}
                    variant={transactionType === 'income' ? 'solid' : 'outline'}
                    colorScheme={transactionType === 'income' ? 'green' : 'gray'}
                    onClick={() => setValue('type', 'income', { shouldValidate: true })}
                    minH="44px"
                  >
                    {t('income')}
                  </Button>
                </HStack>
              </FormControl>

              {/* Category Dropdown */}
              <FormControl isInvalid={!!errors.category_id} isRequired>
                <FormLabel htmlFor="category_id">{t('category')}</FormLabel>
                {isLoadingCategories ? (
                  <Box display="flex" alignItems="center" justifyContent="center" py={4}>
                    <Spinner size="md" color="#2b6cb0" />
                    <Text ml={3}>{tCommon('loading')}</Text>
                  </Box>
                ) : (
                  <CategoryMenu
                    categories={categories}
                    value={watch('category_id')}
                    onChange={(categoryId) => setValue('category_id', categoryId, { shouldValidate: true })}
                    placeholder={t('selectCategory')}
                    isInvalid={!!errors.category_id}
                    size="lg"
                    recentCategories={recentCategories}
                  />
                )}
                {errors.category_id && (
                  <FormErrorMessage>{errors.category_id.message}</FormErrorMessage>
                )}
              </FormControl>

              {/* Date Picker with Quick Options */}
              <FormControl isInvalid={!!errors.date} isRequired>
                <FormLabel htmlFor="date">{t('date')}</FormLabel>
                <HStack spacing={2} mb={2}>
                  <Button size="sm" variant="outline" onClick={() => setQuickDate(0)}>
                    {t('today')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setQuickDate(1)}>
                    {t('yesterday')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setQuickDate(2)}>
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
                    borderColor: '#2b6cb0',
                    boxShadow: '0 0 0 1px #2b6cb0',
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
                    borderColor: '#2b6cb0',
                    boxShadow: '0 0 0 1px #2b6cb0',
                  }}
                />
                {errors.notes && <FormErrorMessage>{errors.notes.message}</FormErrorMessage>}
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {t('maxCharacters', { max: 100 })}
                </Text>
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={onClose}
              isDisabled={isSubmitting}
              minH="44px"
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
                bg="#2b6cb0"
                color="white"
                _hover={{ bg: isOnline ? '#2c5282' : '#2b6cb0' }}
                _active={{ bg: isOnline ? '#2c5282' : '#2b6cb0' }}
                isLoading={isSubmitting}
                isDisabled={!isValid || isSubmitting || !isOnline}
                loadingText="Saving..."
                minH="44px"
                opacity={!isOnline ? 0.4 : 1}
              >
                {mode === 'edit' ? tCommon('save') : t('add')}
              </Button>
            </Tooltip>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
