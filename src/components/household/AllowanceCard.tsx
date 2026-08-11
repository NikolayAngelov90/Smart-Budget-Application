'use client';

/**
 * AllowanceCard — Story 13.6
 *
 * Shows the member's PRIVATE personal allowance: budget, current-month spend, remaining,
 * with a progress bar and an edit form. A lock indicator reinforces that the data is
 * owner-only (no other household member can see it).
 *
 * Rendered by HouseholdSection only when the user belongs to a household.
 */

import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Stack,
  Text,
  Input,
  Select,
  Button,
  Progress,
  Divider,
  Icon,
  useToast,
} from '@chakra-ui/react';
import { LockIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';
import { useAllowance } from '@/lib/hooks/useAllowance';
import { formatAmount } from '@/lib/utils/formatAmount';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from '@/lib/utils/constants';

export function AllowanceCard() {
  const t = useTranslations('allowance');
  const toast = useToast();
  const { status, isLoading, mutate } = useAllowance();

  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [isSaving, setIsSaving] = useState(false);

  const allowance = status?.allowance ?? null;
  const spent = status?.spent ?? 0;
  const displayCurrency = allowance?.currency ?? currency;

  const beginEdit = () => {
    setAmount(allowance ? String(allowance.monthly_amount) : '');
    setCurrency(allowance?.currency ?? DEFAULT_CURRENCY);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value < 0) {
      toast({ title: t('invalidAmount'), status: 'error', duration: 3000, isClosable: true });
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/allowance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_amount: value, currency }),
      });
      if (!response.ok) throw new Error(t('saveFailed'));
      await mutate();
      setIsEditing(false);
      toast({ title: t('saved'), status: 'success', duration: 3000, isClosable: true });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t('saveFailed'),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return null;

  const remaining = allowance ? allowance.monthly_amount - spent : 0;
  const pct = allowance && allowance.monthly_amount > 0
    ? Math.min(100, (spent / allowance.monthly_amount) * 100)
    : 0;

  return (
    <Box>
      <Divider my={2} />
      <HStack justify="space-between" align="center" mb={1}>
        <HStack spacing={2}>
          <Heading as="h3" size="sm" color="fg">
            {t('heading')}
          </Heading>
          <Icon as={LockIcon} boxSize={3} color="fg.subtle" aria-hidden />
        </HStack>
        {!isEditing && (
          <Button size="sm" variant="ghost" onClick={beginEdit} minH={{ base: '44px', sm: '32px' }}>
            {allowance ? t('edit') : t('setup')}
          </Button>
        )}
      </HStack>
      <Text fontSize="xs" color="fg.subtle" mb={3}>
        {t('privacyNote')}
      </Text>

      {isEditing ? (
        <VStack align="stretch" spacing={2}>
          <Stack direction={{ base: 'column', sm: 'row' }} spacing={2}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('amountLabel')}
              aria-label={t('amountLabel')}
              minH={{ base: '44px', sm: '40px' }}
            />
            <Select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label={t('currencyLabel')}
              maxW={{ base: 'full', sm: '100px' }}
              minH={{ base: '44px', sm: '40px' }}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Stack>
          <HStack justify="flex-end">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} isDisabled={isSaving} minH={{ base: '44px', sm: '32px' }}>
              {t('cancel')}
            </Button>
            <Button size="sm" colorScheme="brand" onClick={handleSave} isLoading={isSaving} loadingText={t('save')} minH={{ base: '44px', sm: '32px' }}>
              {t('save')}
            </Button>
          </HStack>
        </VStack>
      ) : allowance ? (
        <VStack align="stretch" spacing={2}>
          <HStack justify="space-between">
            <Text fontSize="sm" color="fg.muted">
              {t('budgetLabel')}
            </Text>
            <Text fontSize="sm" fontWeight="semibold" color="fg">
              {formatAmount(allowance.monthly_amount, displayCurrency)}
            </Text>
          </HStack>
          <Progress value={pct} size="sm" borderRadius="full" colorScheme={remaining < 0 ? 'expense' : 'brand'} />
          <HStack justify="space-between">
            <Text fontSize="xs" color="fg.subtle">
              {t('spentLabel')}: {formatAmount(spent, displayCurrency)}
            </Text>
            <Text fontSize="xs" color={remaining < 0 ? 'expense' : 'fg.subtle'}>
              {t('remainingLabel')}: {formatAmount(remaining, displayCurrency)}
            </Text>
          </HStack>
        </VStack>
      ) : (
        <Text fontSize="sm" color="fg.muted">
          {t('none')}
        </Text>
      )}
    </Box>
  );
}
