'use client';

/**
 * ContributionSplitCard — Story 13.7
 *
 * Shows each household member's contribution percentage, fair share of the shared pot,
 * amount contributed, and progress. The caller can set their OWN percentage. No income is
 * ever shown — only percentages and the resulting shared-expense shares.
 *
 * Rendered by HouseholdSection only when the user belongs to a household.
 */

import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Button,
  Progress,
  Divider,
  Badge,
  useToast,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useContributions } from '@/lib/hooks/useContributions';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatAmount } from '@/lib/utils/formatAmount';

export function ContributionSplitCard() {
  const t = useTranslations('contribution');
  const toast = useToast();
  const { summary, isLoading, mutate } = useContributions();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format || 'EUR';

  const [value, setValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const splits = summary?.splits ?? [];
  const self = splits.find((s) => s.isSelf) ?? null;
  const sumPct = splits.reduce((sum, s) => sum + (s.percentage ?? 0), 0);
  const showNormalizedHint = sumPct > 0 && Math.round(sumPct) !== 100;

  const beginEdit = () => {
    setValue(self?.percentage != null ? String(self.percentage) : '');
    setEditing(true);
  };

  const handleSave = async () => {
    const pct = parseFloat(value);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast({ title: t('invalidPercentage'), status: 'error', duration: 3000, isClosable: true });
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/households/contribution', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentage: pct }),
      });
      if (!response.ok) throw new Error(t('saveFailed'));
      await mutate();
      setEditing(false);
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

  if (isLoading || !summary) return null;

  return (
    <Box>
      <Divider my={2} />
      <Heading as="h3" size="sm" color="gray.700" mb={1}>
        {t('heading')}
      </Heading>
      <Text fontSize="sm" color="gray.600" mb={3}>
        {t('hint')}
      </Text>

      {splits.length === 0 ? (
        <Text fontSize="sm" color="gray.600">
          {t('none')}
        </Text>
      ) : (
        <VStack align="stretch" spacing={3}>
          {splits.map((s) => {
            const pctDisplay = Math.min(100, Math.round(s.progress * 100));
            return (
              <Box key={s.user_id}>
                <HStack justify="space-between" mb={1}>
                  <HStack spacing={2}>
                    <Text fontSize="sm" fontWeight="medium" color="gray.800">
                      {s.isSelf ? t('you') : s.email}
                    </Text>
                    {s.percentage != null && (
                      <Badge colorScheme="blue" borderRadius="full" px={2}>
                        {s.percentage}%
                      </Badge>
                    )}
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    {t('fairShare')}: {formatAmount(s.fairShare, currency)}
                  </Text>
                </HStack>
                <Progress
                  value={pctDisplay}
                  size="sm"
                  borderRadius="full"
                  colorScheme={s.progress >= 1 ? 'green' : 'blue'}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {t('contributed')}: {formatAmount(s.contributed, currency)}
                </Text>
              </Box>
            );
          })}

          {showNormalizedHint && (
            <Text fontSize="xs" color="orange.500">
              {t('normalizedHint')}
            </Text>
          )}

          {/* Set the caller's own percentage */}
          {editing ? (
            <HStack>
              <Input
                type="number"
                min={0}
                max={100}
                step="1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t('yourPercentage')}
                aria-label={t('yourPercentage')}
                maxW="120px"
              />
              <Button size="sm" colorScheme="blue" onClick={handleSave} isLoading={isSaving} loadingText={t('save')}>
                {t('save')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} isDisabled={isSaving}>
                {t('cancel')}
              </Button>
            </HStack>
          ) : (
            <Button size="sm" variant="outline" alignSelf="flex-start" onClick={beginEdit}>
              {t('yourPercentage')}
            </Button>
          )}
        </VStack>
      )}
    </Box>
  );
}
