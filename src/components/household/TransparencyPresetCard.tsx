'use client';

/**
 * Transparency preset — Story 13.4, extracted in Story 17.1.
 *
 * This was ~45 lines inline inside `HouseholdSection`. It moved out so it can
 * live on `/household/sharing` rather than in the middle of member management.
 * The handler is carried over verbatim, including the two revalidations it
 * needs and the order they run in: `/api/categories` first because applying a
 * preset changes the visibility of the caller's shared categories, then the
 * household itself so the picker shows the now-saved value.
 *
 * NOTE ON SCOPE: this sets DEFAULTS for your shared categories. Per-category
 * visibility is a property of a category and is edited on `/categories` via
 * CategoryModal (`visibility_level`), not here — deliberately, so one value has
 * one place to be set.
 */

import { useState } from 'react';
import { Box, Card, CardBody, Heading, Select, Text, useToast } from '@chakra-ui/react';
import { useSWRConfig } from 'swr';
import { useTranslations } from 'next-intl';
import { useHousehold } from '@/lib/hooks/useHousehold';
import type { HouseholdPreset } from '@/types/database.types';

export function TransparencyPresetCard() {
  const t = useTranslations('household');
  const toast = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const { household, mutate } = useHousehold();
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);

  const handlePreset = async (preset: HouseholdPreset) => {
    setIsApplyingPreset(true);
    try {
      const response = await fetch('/api/households/preset', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      });
      if (!response.ok) throw new Error(t('presetFailed'));
      await globalMutate('/api/categories'); // visibility of the caller's shared categories changed
      await mutate(); // refresh household so the picker reflects the now-saved preset
      toast({ title: t('presetApplied'), status: 'success', duration: 3000, isClosable: true });
    } catch (presetError) {
      toast({
        title: presetError instanceof Error ? presetError.message : t('presetFailed'),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsApplyingPreset(false);
    }
  };

  if (!household) return null;

  const presetLabel = (preset: HouseholdPreset | string) =>
    preset === 'newlyweds'
      ? t('presetNewlyweds')
      : preset === 'roommates'
        ? t('presetRoommates')
        : preset === 'partners'
          ? t('presetPartners')
          : t('presetCustom');

  return (
    <Card>
      <CardBody>
        <Box>
          <Heading as="h2" size="sm" color="fg" mb={1}>
            {t('presetHeading')}
          </Heading>
          <Text fontSize="sm" color="fg.muted" mb={2}>
            {t('presetHint')}
          </Text>
          <Select
            placeholder={t('presetChoose')}
            value={household.preset ?? ''}
            isDisabled={isApplyingPreset}
            onChange={(e) => {
              if (e.target.value) handlePreset(e.target.value as HouseholdPreset);
            }}
            aria-label={t('presetHeading')}
            minH={{ base: '44px', sm: '40px' }}
          >
            <option value="newlyweds">{t('presetNewlyweds')}</option>
            <option value="roommates">{t('presetRoommates')}</option>
            <option value="partners">{t('presetPartners')}</option>
            <option value="custom">{t('presetCustom')}</option>
          </Select>
          {household.preset && (
            <Text fontSize="xs" color="fg.muted" mt={1}>
              {t('presetActive', { preset: presetLabel(household.preset) })}
            </Text>
          )}
        </Box>
      </CardBody>
    </Card>
  );
}
