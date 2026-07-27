'use client';

/**
 * Appearance (Light / Dark / System) — Story 16.5
 *
 * A radio group rather than a toggle: the choice is three-way, and "System" is
 * a real option (follow the OS), not the absence of one. Rendered as segmented
 * buttons so it reads natively on mobile while staying keyboard- and
 * screen-reader-operable via the underlying radios.
 */

import { Box, HStack, Text, useRadio, useRadioGroup, type UseRadioProps } from '@chakra-ui/react';
import { SunIcon, MoonIcon, SettingsIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';
import type { ComponentType, ReactNode } from 'react';
import { useAppearance, type Appearance } from '@/lib/hooks/useAppearance';

interface SegmentProps extends UseRadioProps {
  icon: ComponentType;
  label: string;
  children: ReactNode;
}

function Segment({ icon, label, children, ...radioProps }: SegmentProps) {
  const { getInputProps, getRadioProps } = useRadio(radioProps);

  return (
    <Box as="label" flex={1} minW={0}>
      {/* The visible label lives inside the getRadioProps box, which Chakra
          marks aria-hidden — so the accessible name has to come from the input
          itself or the radio is announced with no name at all. */}
      <input {...getInputProps({ 'aria-label': label })} />
      <HStack
        {...getRadioProps()}
        justify="center"
        spacing={{ base: 1, sm: 2 }}
        cursor="pointer"
        borderRadius="lg"
        // ≥44px touch target
        minH="44px"
        px={{ base: 1, sm: 3 }}
        minW={0}
        color="fg.muted"
        transition="all 0.15s"
        _checked={{ bg: 'surface', color: 'accent', boxShadow: 'sm', fontWeight: 'semibold' }}
        _hover={{ color: 'fg' }}
        _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' }}
      >
        <Box as={icon} boxSize={4} flexShrink={0} aria-hidden />
        {/* Hidden below 380px: at 320px there is only ~28px left for text, so
            the label would render as an ellipsis. The icon + the input's
            aria-label still identify each option. */}
        <Text fontSize="sm" noOfLines={1} display={{ base: 'none', sm: 'block' }}>
          {children}
        </Text>
      </HStack>
    </Box>
  );
}

export function AppearanceSection() {
  const t = useTranslations('settings');
  const { preference, setPreference } = useAppearance();

  const options: Array<{ value: Appearance; label: string; icon: ComponentType }> = [
    { value: 'light', label: t('appearanceLight'), icon: SunIcon },
    { value: 'dark', label: t('appearanceDark'), icon: MoonIcon },
    { value: 'system', label: t('appearanceSystem'), icon: SettingsIcon },
  ];

  const { getRootProps, getRadioProps } = useRadioGroup({
    name: 'appearance',
    value: preference,
    onChange: (next) => setPreference(next as Appearance),
  });

  return (
    <Box>
      <Text fontSize="sm" color="fg.muted" mb={3}>
        {t('appearanceDescription')}
      </Text>
      <HStack
        {...getRootProps()}
        spacing={1}
        p={1}
        bg="surface.sunken"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border"
        role="radiogroup"
        aria-label={t('appearanceHeading')}
      >
        {options.map((option) => (
          <Segment
            key={option.value}
            icon={option.icon}
            label={option.label}
            {...getRadioProps({ value: option.value })}
          >
            {option.label}
          </Segment>
        ))}
      </HStack>
    </Box>
  );
}
