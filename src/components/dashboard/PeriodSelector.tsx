'use client';

/**
 * PeriodSelector — Story 16.6
 *
 * Week / Month / 3 Months / Year for the dashboard hero.
 *
 * A radiogroup rather than four buttons or a <Select>: these are four mutually
 * exclusive views of the same data, which is exactly what radio semantics
 * describe, and it gives keyboard users arrow-key movement between them for
 * free. Rendered as a segmented control because it has to sit inside the hero
 * without competing with the balance.
 */

import { HStack, Box, useRadio, useRadioGroup, type UseRadioProps } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import type { DashboardPeriod } from '@/lib/utils/dashboardPeriod';

const PERIODS: { value: DashboardPeriod; labelKey: string }[] = [
  { value: 'week', labelKey: 'periodWeek' },
  { value: 'month', labelKey: 'periodMonth' },
  { value: 'quarter', labelKey: 'periodQuarter' },
  { value: 'year', labelKey: 'periodYear' },
];

function PeriodOption({ label, ...radioProps }: UseRadioProps & { label: string }) {
  const { getInputProps, getRadioProps } = useRadio(radioProps);

  return (
    <Box as="label" cursor="pointer" flex="1 1 0" minW={0}>
      {/* aria-label is required, not belt-and-braces: Chakra marks the styled
          box below aria-hidden (the input carries the semantics), so the
          visible text contributes NOTHING to the accessible name. Without
          this the group announces as four unnamed radio buttons. */}
      <input {...getInputProps({ 'aria-label': label } as React.InputHTMLAttributes<HTMLInputElement>)} />
      <Box
        {...getRadioProps()}
        // 44px minimum: this is a primary mobile control.
        minH="44px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={{ base: 1, sm: 3 }}
        borderRadius="lg"
        fontSize={{ base: '2xs', sm: 'sm' }}
        fontWeight={600}
        color="fg.muted"
        // Deliberately NOT nowrap. Four segments splitting a 320px screen leave
        // ~57px each, and "3 Months" (and Bulgarian "Седмица"/"3 месеца") are
        // wider than that — with nowrap they silently spilled over the pill
        // edge. Wrapping inside the 44px box is the graceful failure; at 360px
        // and up everything still sits on one line.
        lineHeight={1.15}
        textAlign="center"
        transition="background 0.16s ease, color 0.16s ease"
        _checked={{ bg: 'surface', color: 'fg', boxShadow: 'sm' }}
        _hover={{ color: 'fg' }}
        _focusVisible={{ boxShadow: 'focus', outline: 'none' }}
      >
        {label}
      </Box>
    </Box>
  );
}

interface PeriodSelectorProps {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const t = useTranslations('dashboard');

  const { getRootProps, getRadioProps } = useRadioGroup({
    name: 'dashboard-period',
    value,
    onChange: (next) => onChange(next as DashboardPeriod),
  });

  return (
    <HStack
      {...getRootProps()}
      aria-label={t('periodLabel')}
      spacing={1}
      p={1}
      bg="surface.sunken"
      borderRadius="xl"
      w="full"
    >
      {PERIODS.map((period) => (
        <PeriodOption
          key={period.value}
          label={t(period.labelKey)}
          {...getRadioProps({ value: period.value })}
        />
      ))}
    </HStack>
  );
}
