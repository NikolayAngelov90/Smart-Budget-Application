'use client';

/**
 * Category Modal Component
 * Story 4.2: Create Custom Categories
 *
 * Modal for creating custom categories with:
 * - Name input (max 100 characters)
 * - Type selector (Income/Expense)
 * - Color picker (12 predefined theme colors)
 * - Form validation via React Hook Form + Zod
 * - Optimistic UI updates
 * - Error handling for duplicates and network issues
 * - Full keyboard accessibility
 * - Mobile responsive (full-screen on small devices)
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import type { Category } from '@/types/category.types';

// Validation schema
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

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (category: Category) => void;
}

export function CategoryModal({ isOpen, onClose, onSuccess }: CategoryModalProps) {
  const [selectedColor, setSelectedColor] = useState<string>(PRESET_COLORS[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const toast = useToast();

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
      color: PRESET_COLORS[0].value,
    },
  });

  const selectedType = watch('type');

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setValue('color', color, { shouldValidate: true });
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setApiError(null);

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          color: data.color,
          type: data.type,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setApiError('Category name already exists for this type');
        } else {
          setApiError(result.error || 'Failed to create category');
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
      setSelectedColor(PRESET_COLORS[0].value);
      setApiError(null);
      onClose();
    } catch (error) {
      console.error('Category creation error:', error);
      setApiError('Network error. Please try again.');
      toast({
        title: 'Network Error',
        description: 'Failed to create category. Please check your connection.',
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
    setSelectedColor(PRESET_COLORS[0].value);
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
        <ModalHeader>Add Category</ModalHeader>
        <ModalCloseButton />

        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalBody>
            <VStack spacing={5}>
              {/* Category Name */}
              <FormControl isInvalid={!!errors.name}>
                <FormLabel>Category Name</FormLabel>
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
                    placeholder="e.g., Groceries, Coffee, etc."
                    maxLength={100}
                    autoFocus
                  />
                </HStack>
                <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
              </FormControl>

              {/* Type Selector */}
              <FormControl isInvalid={!!errors.type}>
                <FormLabel>Type</FormLabel>
                <HStack spacing={3}>
                  <Button
                    flex={1}
                    variant={selectedType === 'expense' ? 'solid' : 'outline'}
                    colorScheme={selectedType === 'expense' ? 'red' : 'gray'}
                    onClick={() => setValue('type', 'expense', { shouldValidate: true })}
                    type="button"
                  >
                    Expense
                  </Button>
                  <Button
                    flex={1}
                    variant={selectedType === 'income' ? 'solid' : 'outline'}
                    colorScheme={selectedType === 'income' ? 'green' : 'gray'}
                    onClick={() => setValue('type', 'income', { shouldValidate: true })}
                    type="button"
                  >
                    Income
                  </Button>
                </HStack>
                <FormErrorMessage>{errors.type?.message}</FormErrorMessage>
              </FormControl>

              {/* Color Picker */}
              <FormControl isInvalid={!!errors.color}>
                <FormLabel>Color</FormLabel>
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
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              type="submit"
              isLoading={isSubmitting}
              isDisabled={!isValid || isSubmitting}
            >
              Save
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
