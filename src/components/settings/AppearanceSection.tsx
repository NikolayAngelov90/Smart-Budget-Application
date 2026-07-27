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
  children: ReactNode;
}

function Segment({ icon, children, ...radioProps }: SegmentProps) {
  const { getInputProps, getRadioProps } = useRadio(radioProps);

  return (
    <Box as="label" flex={1} minW={0}>
      <input {...getInputProps()} />
      <HStack
        {...getRadioProps()}
        justify="center"
        spacing={2}
        cursor="pointer"
        borderRadius="lg"
        // ≥44px touch target
        minH="44px"
        px={3}
        color="fg.muted"
        transition="all 0.15s"
        _checked={{ bg: 'surface', color: 'accent', boxShadow: 'sm', fontWeight: 'semibold' }}
        _hover={{ color: 'fg' }}
        _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' }}
      >
        <Box as={icon} boxSize={4} aria-hidden />
        <Text fontSize="sm" noOfLines={1}>
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
            {...getRadioProps({ value: option.value })}
          >
            {option.label}
          </Segment>
        ))}
      </HStack>
    </Box>
  );
}
