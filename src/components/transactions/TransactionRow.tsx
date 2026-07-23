'use client';

import { Flex, HStack, IconButton, Text, VStack, Box, VisuallyHidden } from '@chakra-ui/react';
import { EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { CategoryBadge } from '@/components/categories/CategoryBadge';

interface RowCategory {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
}

interface TransactionRowProps {
  category: RowCategory;
  type: 'income' | 'expense';
  notes: string | null;
  /** Already sign-formatted, e.g. "-€42.00" / "+€1,000.00". */
  amountFormatted: string;
  /** Optional converted equivalent when the tx currency differs from preferred. */
  convertedText?: string | null;
  /** Localized "Income"/"Expense" — used in the amount's accessible name so
   *  meaning is never conveyed by colour alone. */
  typeLabel: string;
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * One calm transaction line: category identity + optional note on the left,
 * signed amount on the right (evergreen income / clay expense, tabular). Sits on
 * a shared surface — no heavy card per row (Story 16.1). Desktop shows inline
 * edit/delete; mobile uses the swipe actions from SwipeableRow.
 */
export function TransactionRow({
  category,
  type,
  notes,
  amountFormatted,
  convertedText,
  typeLabel,
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const amountColor = type === 'income' ? 'income' : 'expense';

  return (
    <Flex
      align="center"
      gap={3}
      px={{ base: 4, md: 5 }}
      py={3}
      minH="60px"
      _hover={{ bg: 'surface.hover' }}
      transition="background 0.15s ease"
    >
      <Box flex={1} minW={0} overflow="hidden">
        <CategoryBadge category={category} variant="dot" size="md" />
        {notes && (
          <Text fontSize="sm" color="fg.muted" noOfLines={1} mt={0.5}>
            {notes}
          </Text>
        )}
      </Box>

      {/* Desktop inline actions — mobile uses swipe (SwipeableRow) */}
      <HStack spacing={1} display={{ base: 'none', md: 'flex' }} flexShrink={0}>
        <IconButton
          aria-label={editLabel}
          icon={<EditIcon />}
          size="sm"
          variant="ghost"
          onClick={onEdit}
        />
        <IconButton
          aria-label={deleteLabel}
          icon={<DeleteIcon />}
          size="sm"
          variant="ghost"
          color="expense"
          _hover={{ bg: 'expense.subtle' }}
          onClick={onDelete}
        />
      </HStack>

      <VStack align="flex-end" spacing={0} flexShrink={0}>
        {/* Visually-hidden type so screen readers announce "Income/Expense"
            reliably — aria-label on a <p> (Text) is name-prohibited and dropped. */}
        <VisuallyHidden>{typeLabel}</VisuallyHidden>
        <Text
          className="tnum"
          fontFamily="heading"
          fontSize={{ base: 'md', md: 'lg' }}
          fontWeight={600}
          color={amountColor}
          whiteSpace="nowrap"
        >
          {amountFormatted}
        </Text>
        {convertedText && (
          <Text fontSize="xs" color="fg.subtle" whiteSpace="nowrap">
            {convertedText}
          </Text>
        )}
      </VStack>
    </Flex>
  );
}
