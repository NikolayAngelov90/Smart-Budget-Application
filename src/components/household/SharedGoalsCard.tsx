'use client';

/**
 * SharedGoalsCard — Story 13.9 (fills the 13.8 seam)
 *
 * Shared household savings goals: list with total progress + per-member breakdown, a
 * contribute control, and a create form. Contributing also logs a "Savings" expense for
 * the contributor (handled server-side). Rendered in the household dashboard for members.
 */

import { useState } from 'react';
import {
  Card,
  CardBody,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Button,
  Progress,
  Divider,
  Box,
  useToast,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useHouseholdGoals } from '@/lib/hooks/useHouseholdGoals';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatAmount } from '@/lib/utils/formatAmount';

export function SharedGoalsCard() {
  const t = useTranslations('householdGoals');
  const toast = useToast();
  const { goals, isLoading, mutate } = useHouseholdGoals();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format || 'EUR';

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [contributeFor, setContributeFor] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  const handleCreate = async () => {
    const targetNum = parseFloat(target);
    if (!name.trim() || !Number.isFinite(targetNum) || targetNum <= 0) {
      toast({ title: t('invalidGoal'), status: 'error', duration: 3000, isClosable: true });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/households/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), target_amount: targetNum, deadline: deadline || null }),
      });
      if (!res.ok) throw new Error(t('createFailed'));
      await mutate();
      setName('');
      setTarget('');
      setDeadline('');
      setCreating(false);
      toast({ title: t('created'), status: 'success', duration: 3000, isClosable: true });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t('createFailed'), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setBusy(false);
    }
  };

  const handleContribute = async (goalId: string) => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: t('invalidAmount'), status: 'error', duration: 3000, isClosable: true });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/households/goals/${goalId}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      });
      if (!res.ok) throw new Error(t('contributeFailed'));
      await mutate();
      setContributeFor(null);
      setAmount('');
      toast({ title: t('contributed'), status: 'success', duration: 3000, isClosable: true });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t('contributeFailed'), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between" align="center">
            <Heading as="h2" size="md" color="gray.700">
              {t('heading')}
            </Heading>
            {!creating && (
              <Button size="xs" colorScheme="blue" variant="ghost" onClick={() => setCreating(true)}>
                {t('newGoal')}
              </Button>
            )}
          </HStack>

          {creating && (
            <VStack align="stretch" spacing={2} bg="gray.50" p={3} borderRadius="md">
              <Input size="sm" placeholder={t('name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} aria-label={t('name')} />
              <HStack>
                <Input size="sm" type="number" min={0} step="0.01" placeholder={t('target')} value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t('target')} />
                <Input size="sm" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label={t('deadline')} />
              </HStack>
              <HStack justify="flex-end">
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)} isDisabled={busy}>
                  {t('cancel')}
                </Button>
                <Button size="sm" colorScheme="blue" onClick={handleCreate} isLoading={busy} loadingText={t('create')}>
                  {t('create')}
                </Button>
              </HStack>
            </VStack>
          )}

          {isLoading ? null : goals.length === 0 ? (
            <Text fontSize="sm" color="gray.600">
              {t('none')}
            </Text>
          ) : (
            goals.map(({ goal, breakdown }) => {
              const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
              return (
                <Box key={goal.id}>
                  <Divider mb={2} />
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                      {goal.name}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {formatAmount(goal.current_amount, currency)} / {formatAmount(goal.target_amount, currency)}
                    </Text>
                  </HStack>
                  <Progress value={pct} size="sm" borderRadius="full" colorScheme={pct >= 100 ? 'green' : 'blue'} mb={2} />

                  {breakdown.length > 0 && (
                    <VStack align="stretch" spacing={0} mb={2}>
                      {breakdown.map((b) => (
                        <HStack key={b.user_id} justify="space-between">
                          <Text fontSize="xs" color="gray.500">
                            {b.email}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {formatAmount(Number(b.contributed), currency)}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  )}

                  {contributeFor === goal.id ? (
                    <HStack>
                      <Input
                        size="sm"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder={t('contributeAmount')}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        aria-label={t('contributeAmount')}
                        maxW="140px"
                      />
                      <Button size="sm" colorScheme="blue" onClick={() => handleContribute(goal.id)} isLoading={busy} loadingText={t('save')}>
                        {t('save')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setContributeFor(null)} isDisabled={busy}>
                        {t('cancel')}
                      </Button>
                    </HStack>
                  ) : (
                    <Button size="xs" variant="outline" onClick={() => { setContributeFor(goal.id); setAmount(''); }}>
                      {t('contribute')}
                    </Button>
                  )}
                </Box>
              );
            })
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
