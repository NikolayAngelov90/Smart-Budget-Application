'use client';

/**
 * Category Modal Component
 * Story 4.2: Create Custom Categories
 * Story 4.3: Edit and Delete Custom Categories
 *
 * Modal for creating and editing custom categories with:
 * - Name input (max 100 characters)
 * - Type selector (Income/Expense) - read-only in edit mode
 * - Color picker (12 predefined theme colors)
 * - Form validation via React Hook Form + Zod
 * - Optimistic UI updates
 * - Error handling for duplicates and network issues
 * - Full keyboard accessibility
 * - Mobile responsive (full-screen on small devices)
 * - Edit mode: pre-fills form with existing category data
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  VStack,
  HStack,
  Box,
  Text,
  Grid,
  useToast,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Category } from '@/types/category.types';

// Validation schema (used for both create and edit)
const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name too long')
    .trim()
    .refine((val) => /^[a-zA-Z0-9\s]+$/.test(val), {
      message: 'Only letters, numbers, and spaces allowed',
    }),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  type: z.enum(['income', 'expense']),
});

type FormData = z.infer<typeof createCategorySchema>;

// 12 predefined theme colors from Chakra UI palette
const PRESET_COLORS = [
  { name: 'Blue', value: '#4299e1' },     // Trust Blue
  { name: 'Red', value: '#f56565' },      // Coral Red
  { name: 'Purple', value: '#9f7aea' },   // Purple
  { name: 'Teal', value: '#38b2ac' },     // Teal
  { name: 'Orange', value: '#ed8936' },   // Orange
  { name: 'Green', value: '#48bb78' },    // Green
  { name: 'Pink', value: '#ed64a6' },     // Pink
  { name: 'Cyan', value: '#0bc5ea' },     // Cyan
  { name: 'Yellow', value: '#ecc94b' },   // Yellow
  { name: 'Indigo', value: '#667eea' },   // Indigo
  { name: 'Gray', value: '#718096' },     // Gray
  { name: 'Emerald', value: '#38a169' },  // Emerald (Salary green from defaults)
];

const DEFAULT_COLOR = PRESET_COLORS[0]?.value ?? '#4299e1';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (category: Category) => void;
  editMode?: boolean;
  category?: Category | null;
}

export function CategoryModal({
  isOpen,
  onClose,
  onSuccess,
  editMode = false,
  category = null,
}: CategoryModalProps) {
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_COLOR);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const toast = useToast();
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const tTransactions = useTranslations('transactions');

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(createCategorySchema),
    mode: 'onChange',
    defaultValues: {
      type: 'expense',
      color: DEFAULT_COLOR,
    },
  });

  const selectedType = watch('type');

  // Pre-fill form when in edit mode
  useEffect(() => {
    if (editMode && category && isOpen) {
      setValue('name', category.name);
      setValue('color', category.color);
      setValue('type', category.type);
      setSelectedColor(category.color);
    } else if (!editMode && isOpen) {
      // Reset to defaults when opening in create mode
      reset();
      setSelectedColor(DEFAULT_COLOR);
    }
  }, [editMode, category, isOpen, setValue, reset]);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setValue('color', color, { shouldValidate: true });
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setApiError(null);

    try {
      const url = editMode && category ? `/api/categories/${category.id}` : '/api/categories';
      const method = editMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          color: data.color,
          ...(editMode ? {} : { type: data.type }), // Type only sent in create mode
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setApiError('Category name already exists for this type');
        } else if (response.status === 403) {
          setApiError('Cannot modify predefined categories');
        } else {
          setApiError(result.error || `Failed to ${editMode ? 'update' : 'create'} category`);
        }
        setIsSubmitting(false);
        return;
      }

      // Success
      if (onSuccess) {
        onSuccess(result.data);
      }

      // Reset form and close modal
      reset();
      setSelectedColor(DEFAULT_COLOR);
      setApiError(null);
      onClose();
    } catch (error) {
      console.error(`Category ${editMode ? 'update' : 'creation'} error:`, error);
      setApiError('Network error. Please try again.');
      toast({
        title: t('networkError'),
        description: `Failed to ${editMode ? 'update' : 'create'} category. Please check your connection.`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setSelectedColor(DEFAULT_COLOR);
    setApiError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size={{ base: 'full', md: 'md' }}
      motionPreset="slideInBottom"
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{editMode ? t('editCategory') : t('addCategory')}</ModalHeader>
        <ModalCloseButton />

        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalBody>
            <VStack spacing={5}>
              {/* Category Name */}
              <FormControl isInvalid={!!errors.name}>
                <FormLabel>{t('categoryName')}</FormLabel>
                <HStack>
                  <Box
                    w={6}
                    h={6}
                    borderRadius="full"
                    bg={selectedColor}
                    flexShrink={0}
                    aria-label="Selected color preview"
                  />
                  <Input
                    {...register('name')}
                    placeholder={t('categoryNamePlaceholder')}
                    maxLength={100}
                    autoFocus
                  />
                </HStack>
                <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
              </FormControl>

              {/* Type Selector */}
              <FormControl isInvalid={!!errors.type}>
                <FormLabel>{tTransactions('type')}</FormLabel>
                <HStack spacing={3}>
                  <Button
                    flex={1}
                    variant={selectedType === 'expense' ? 'solid' : 'outline'}
                    colorScheme={selectedType === 'expense' ? 'red' : 'gray'}
                    onClick={() => setValue('type', 'expense', { shouldValidate: true })}
                    type="button"
                    isDisabled={editMode}
                    cursor={editMode ? 'not-allowed' : 'pointer'}
                  >
                    {tTransactions('expense')}
                  </Button>
                  <Button
                    flex={1}
                    variant={selectedType === 'income' ? 'solid' : 'outline'}
                    colorScheme={selectedType === 'income' ? 'green' : 'gray'}
                    onClick={() => setValue('type', 'income', { shouldValidate: true })}
                    type="button"
                    isDisabled={editMode}
                    cursor={editMode ? 'not-allowed' : 'pointer'}
                  >
                    {tTransactions('income')}
                  </Button>
                </HStack>
                {editMode && (
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Category type cannot be changed after creation
                  </Text>
                )}
                <FormErrorMessage>{errors.type?.message}</FormErrorMessage>
              </FormControl>

              {/* Color Picker */}
              <FormControl isInvalid={!!errors.color}>
                <FormLabel>{t('color')}</FormLabel>
                <Grid templateColumns="repeat(6, 1fr)" gap={2}>
                  {PRESET_COLORS.map((color) => (
                    <Box
                      key={color.value}
                      w={10}
                      h={10}
                      borderRadius="md"
                      bg={color.value}
                      cursor="pointer"
                      border="3px solid"
                      borderColor={selectedColor === color.value ? 'blue.500' : 'transparent'}
                      transition="all 0.2s"
                      _hover={{
                        transform: 'scale(1.1)',
                        borderColor: selectedColor === color.value ? 'blue.600' : 'gray.300',
                      }}
                      onClick={() => handleColorSelect(color.value)}
                      aria-label={`Select ${color.name} color`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleColorSelect(color.value);
                        }
                      }}
                    />
                  ))}
                </Grid>
                <FormErrorMessage>{errors.color?.message}</FormErrorMessage>
              </FormControl>

              {/* API Error Display */}
              {apiError && (
                <Box
                  w="full"
                  p={3}
                  bg="red.50"
                  border="1px"
                  borderColor="red.200"
                  borderRadius="md"
                >
                  <Text color="red.600" fontSize="sm">
                    {apiError}
                  </Text>
                </Box>
              )}
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleClose} isDisabled={isSubmitting}>
              {tCommon('cancel')}
            </Button>
            <Button
              colorScheme="blue"
              type="submit"
              isLoading={isSubmitting}
              isDisabled={!isValid || isSubmitting}
            >
              {tCommon('save')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
