'use client';

/**
 * BudgetEditor Component — ADR-025
 *
 * Compact budget row for a category card: shows current-month progress against
 * the set monthly limit (or a "Set budget" affordance when none), with a popover
 * to set, change, or clear the limit. Expense categories owned by the user only.
 */

import { useState } from 'react';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { formatCurrency } from '@/lib/utils/currency';
import type { BudgetSummary } from '@/types/database.types';

interface BudgetEditorProps {
  categoryId: string;
  categoryName: string;
  /** Current budget summary for this category, or null when no budget is set */
  budget: BudgetSummary | null;
  currencyCode: string;
  /** Called after a successful save/clear so the caller can revalidate */
  onChanged: () => void;
}

// Quiet Ledger: budget health on-brand — evergreen (on track), amber (warning),
// clay (over). Not banking-alarm green/orange/red.
const STATUS_COLOR: Record<BudgetSummary['status'], string> = {
  ok: 'evergreen',
  warning: 'amber',
  over: 'clay',
};

export function BudgetEditor({
  categoryId,
  categoryName,
  budget,
  currencyCode,
  onChanged,
}: BudgetEditorProps) {
  const t = useTranslations('budgets');
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [amount, setAmount] = useState('');
  const [inputError, setInputError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const openEditor = () => {
    setAmount(budget ? budget.limit_amount.toFixed(2) : '');
    setInputError('');
    onOpen();
  };

  const handleSave = async () => {
    if (isSaving) return; // Enter key has no isLoading guard — block double-submit

    // Accept comma as decimal separator (bg locale keypads emit ','), reject any
    // other stray characters parseFloat would silently truncate ("10abc" → 10).
    const normalized = amount.trim().replace(',', '.');
    const parsed = parseFloat(normalized);
    if (
      !/^\d+(\.\d{1,2})?$/.test(normalized) ||
      isNaN(parsed) ||
      parsed <= 0 ||
      parsed > 9_999_999_999.99
    ) {
      setInputError(t('invalidAmount'));
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId, limit_amount: Math.round(parsed * 100) / 100 }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error?.message || 'Failed to save budget');
      }
      toast({
        title: t('savedSuccess', { name: categoryName }),
        status: 'success',
        duration: 2500,
        isClosable: true,
      });
      onClose();
      onChanged();
    } catch (error) {
      toast({
        title: t('saveFailed'),
        description: error instanceof Error ? error.message : undefined,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!budget || isSaving) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/budgets/${budget.id}`, { method: 'DELETE' });
      // 404 = already removed elsewhere (other tab/device) — desired state holds
      if (!response.ok && response.status !== 404) {
        throw new Error('Failed to clear budget');
      }
      toast({
        title: t('clearedSuccess', { name: categoryName }),
        status: 'success',
        duration: 2500,
        isClosable: true,
      });
      onClose();
      onChanged();
    } catch {
      toast({ title: t('clearFailed'), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setIsSaving(false);
    }
  };

  const editorPopover = (trigger: React.ReactElement) => (
    <Popover isOpen={isOpen} onClose={onClose} placement="bottom-start" isLazy>
      <PopoverTrigger>{trigger}</PopoverTrigger>
      <PopoverContent w="240px">
        <PopoverArrow />
        <PopoverBody>
          <FormControl isInvalid={!!inputError}>
            <FormLabel fontSize="sm" mb={1}>
              {t('monthlyLimitFor', { name: categoryName })}
            </FormLabel>
            <Input
              size="sm"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              autoFocus
              onChange={(e) => {
                setAmount(e.target.value);
                setInputError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            {inputError && <FormErrorMessage>{inputError}</FormErrorMessage>}
          </FormControl>
          <HStack mt={3} justify="flex-end" spacing={2}>
            {budget && (
              <Button
                size="xs"
                variant="ghost"
                colorScheme="red"
                onClick={handleClear}
                isDisabled={isSaving}
                minH={{ base: '44px', md: '32px' }}
              >
                {t('clear')}
              </Button>
            )}
            <Button
              size="xs"
              onClick={handleSave}
              isLoading={isSaving}
              minH={{ base: '44px', md: '32px' }}
            >
              {t('save')}
            </Button>
          </HStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );

  // No budget yet — quiet affordance to set one
  if (!budget) {
    return (
      <Box mt={2}>
        {editorPopover(
          <Button size="xs" variant="ghost" onClick={openEditor} minH={{ base: '44px', md: '32px' }}>
            {t('setBudget')}
          </Button>
        )}
      </Box>
    );
  }

  // Budget set — progress bar + amounts + edit trigger
  const pct = Math.min(budget.pct_used, 100);
  return (
    <Box mt={3}>
      <Flex justify="space-between" align="center" mb={1} gap={2}>
        <Text fontSize="xs" color="fg.muted">
          {t('spentOfLimit', {
            spent: formatCurrency(budget.spent, undefined, currencyCode),
            limit: formatCurrency(budget.limit_amount, undefined, currencyCode),
          })}
        </Text>
        {editorPopover(
          <Button size="xs" variant="ghost" onClick={openEditor} minH={{ base: '44px', md: '32px' }}>
            {t('edit')}
          </Button>
        )}
      </Flex>
      <Progress
        value={pct}
        size="sm"
        borderRadius="full"
        colorScheme={STATUS_COLOR[budget.status]}
        aria-label={t('progressAriaLabel', { name: categoryName, pct: budget.pct_used })}
      />
      {budget.status === 'over' && (
        <Text fontSize="xs" color="expense" mt={1}>
          {t('overBy', {
            amount: formatCurrency(Math.abs(budget.remaining), undefined, currencyCode),
          })}
        </Text>
      )}
    </Box>
  );
}
