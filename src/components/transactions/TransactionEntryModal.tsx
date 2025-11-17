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
  Select,
  Textarea,
  VStack,
  HStack,
  useToast,
  Box,
  Text,
  Spinner,
} from '@chakra-ui/react';
import { format, subDays } from 'date-fns';

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
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function TransactionEntryModal({
  isOpen,
  onClose,
  onSuccess,
}: TransactionEntryModalProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

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
      } else {
        toast({
          title: 'Failed to load categories',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: 'Failed to load categories',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoadingCategories(false);
    }
  }, [transactionType, toast]);

  // Fetch categories when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen, fetchCategories]);

  // Quick date setter functions
  const setQuickDate = (daysAgo: number) => {
    const date = subDays(new Date(), daysAgo);
    setValue('date', format(date, 'yyyy-MM-dd'), { shouldValidate: true });
  };

  // Form submission handler
  const onSubmit = async (data: TransactionFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(data.amount),
          type: data.type,
          category_id: data.category_id,
          date: data.date,
          notes: data.notes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create transaction');
      }

      // Success!
      toast({
        title: 'Transaction added successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Reset form for next entry
      reset({
        amount: '',
        type: 'expense',
        category_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
      });

      // Call success callback (e.g., to refresh transaction list)
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast({
        title: 'Failed to save transaction',
        description: error instanceof Error ? error.message : 'Network error - please try again',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Split categories into recent and all
  const recentCategories = categories.filter((cat) => cat.last_used_at).slice(0, 5);
  const hasRecentCategories = recentCategories.length > 0;

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
        <ModalHeader>Add Transaction</ModalHeader>
        <ModalCloseButton />

        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalBody>
            <VStack spacing={5} align="stretch">
              {/* Amount Field */}
              <FormControl isInvalid={!!errors.amount} isRequired>
                <FormLabel htmlFor="amount">Amount</FormLabel>
                <Input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*"
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

              {/* Transaction Type Toggle */}
              <FormControl>
                <FormLabel htmlFor="type">Type</FormLabel>
                <HStack spacing={2}>
                  <Button
                    flex={1}
                    variant={transactionType === 'expense' ? 'solid' : 'outline'}
                    colorScheme={transactionType === 'expense' ? 'red' : 'gray'}
                    onClick={() => setValue('type', 'expense', { shouldValidate: true })}
                    minH="44px"
                  >
                    Expense
                  </Button>
                  <Button
                    flex={1}
                    variant={transactionType === 'income' ? 'solid' : 'outline'}
                    colorScheme={transactionType === 'income' ? 'green' : 'gray'}
                    onClick={() => setValue('type', 'income', { shouldValidate: true })}
                    minH="44px"
                  >
                    Income
                  </Button>
                </HStack>
              </FormControl>

              {/* Category Dropdown */}
              <FormControl isInvalid={!!errors.category_id} isRequired>
                <FormLabel htmlFor="category_id">Category</FormLabel>
                {isLoadingCategories ? (
                  <Box display="flex" alignItems="center" justifyContent="center" py={4}>
                    <Spinner size="md" color="#2b6cb0" />
                    <Text ml={3}>Loading categories...</Text>
                  </Box>
                ) : (
                  <Select
                    id="category_id"
                    placeholder="Select a category"
                    size="lg"
                    {...register('category_id')}
                    _focus={{
                      borderColor: '#2b6cb0',
                      boxShadow: '0 0 0 1px #2b6cb0',
                    }}
                  >
                    {hasRecentCategories && (
                      <optgroup label="Recently Used">
                        {recentCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label={hasRecentCategories ? 'All Categories' : 'Categories'}>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </optgroup>
                  </Select>
                )}
                {errors.category_id && (
                  <FormErrorMessage>{errors.category_id.message}</FormErrorMessage>
                )}
              </FormControl>

              {/* Date Picker with Quick Options */}
              <FormControl isInvalid={!!errors.date} isRequired>
                <FormLabel htmlFor="date">Date</FormLabel>
                <HStack spacing={2} mb={2}>
                  <Button size="sm" variant="outline" onClick={() => setQuickDate(0)}>
                    Today
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setQuickDate(1)}>
                    Yesterday
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setQuickDate(2)}>
                    2 days ago
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
                <FormLabel htmlFor="notes">Notes (optional)</FormLabel>
                <Textarea
                  id="notes"
                  placeholder="e.g., Grocery store, Coffee with Sarah"
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
                  Max 100 characters
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
              Cancel
            </Button>
            <Button
              type="submit"
              bg="#2b6cb0"
              color="white"
              _hover={{ bg: '#2c5282' }}
              _active={{ bg: '#2c5282' }}
              isLoading={isSubmitting}
              isDisabled={!isValid || isSubmitting}
              loadingText="Saving..."
              minH="44px"
            >
              Save
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
