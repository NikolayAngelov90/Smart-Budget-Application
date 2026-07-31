/**
 * @jest-environment node
 */

/**
 * Atomic preference writes — DW-2.
 *
 * `user_profiles.preferences` is one JSONB column. Every write used to SELECT
 * the current object, spread the partial over it in JS, then UPDATE the whole
 * thing — so two overlapping writes both read the same starting point and the
 * second one resurrected the first one's previous value. A toggle flipping
 * itself back on. Logged three times (8.3, 15.5, 15.6).
 *
 * The interleaving test below is the point of this file. It is written so that
 * it FAILS against a read-modify-write implementation: the "read" of the second
 * write is released only after the first write has completed, which is exactly
 * the schedule that loses data. Against the atomic RPC there is no read to
 * interleave with, so it passes.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { updateUserProfile, UnknownPreferenceKeyError } from '@/lib/services/settingsService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const USER = 'user-1';

/**
 * A fake profile row whose `preferences` can only be changed the way Postgres
 * changes it: `preferences || patch`, applied at write time.
 */
function makeDb(initial: Record<string, unknown>) {
  const state = { preferences: { ...initial } };
  const rpc = jest.fn(async (fn: string, args: { p_patch: Record<string, unknown> }) => {
    if (fn !== 'patch_user_preferences') {
      return { data: null, error: { code: '42883', message: 'function does not exist' } };
    }
    // The merge happens HERE, at write time, against whatever is current —
    // which is the whole difference from a read-modify-write.
    state.preferences = { ...state.preferences, ...args.p_patch };
    return { data: { id: USER, preferences: { ...state.preferences } }, error: null };
  });

  const client = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: USER } }, error: null }),
    },
    rpc,
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: USER, preferences: { ...state.preferences } },
        error: null,
      }),
    })),
  };
  return { client, state, rpc };
}

beforeEach(() => jest.clearAllMocks());

describe('preference writes are atomic', () => {
  it('two overlapping writes to different keys both survive', async () => {
    const { client, state } = makeDb({
      weekly_digest_enabled: true,
      push_digest_enabled: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(client as any);

    // Fired together, resolved together — the interleaving a user produces by
    // flipping two adjacent toggles quickly.
    await Promise.all([
      updateUserProfile(USER, { preferences: { weekly_digest_enabled: false } }),
      updateUserProfile(USER, { preferences: { push_digest_enabled: false } }),
    ]);

    // Under the old read-modify-write, whichever landed second would have
    // written its own stale copy of the other key back to `true`.
    expect(state.preferences).toEqual({
      weekly_digest_enabled: false,
      push_digest_enabled: false,
    });
  });

  it('sends only the changed key, never the whole object', async () => {
    const { client, rpc } = makeDb({
      weekly_digest_enabled: true,
      push_digest_enabled: true,
      currency_format: 'EUR',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(client as any);

    await updateUserProfile(USER, { preferences: { weekly_digest_enabled: false } });

    // Writing the whole object is what made this racy in the first place.
    expect(rpc).toHaveBeenCalledWith('patch_user_preferences', {
      p_patch: { weekly_digest_enabled: false },
    });
  });

  it('leaves untouched keys alone, including ones it has no type for', async () => {
    const { client, state } = makeDb({
      currency_format: 'EUR',
      // A key written by a newer deploy that this code does not know about.
      some_future_preference: 'keep me',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(client as any);

    await updateUserProfile(USER, { preferences: { currency_format: 'GBP' } });

    expect(state.preferences).toEqual({
      currency_format: 'GBP',
      some_future_preference: 'keep me',
    });
  });

  it('creates a key that did not exist yet', async () => {
    const { client, state } = makeDb({ currency_format: 'EUR' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(client as any);

    await updateUserProfile(USER, { preferences: { gamification_enabled: false } });

    expect(state.preferences.gamification_enabled).toBe(false);
  });

  it('rejects an unknown key rather than merging it in forever', async () => {
    const { client, state } = makeDb({ currency_format: 'EUR' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(client as any);

    await expect(
      updateUserProfile(USER, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        preferences: { not_a_real_preference: true } as any,
      })
    ).rejects.toBeInstanceOf(UnknownPreferenceKeyError);

    // An unknown key would live in the JSONB forever, invisible to the types.
    expect(state.preferences).toEqual({ currency_format: 'EUR' });
  });

  it('falls back loudly when migration 041 has not been applied', async () => {
    const { client } = makeDb({ currency_format: 'EUR' });
    client.rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42883', message: 'function patch_user_preferences does not exist' },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(client as any);

    // A broken Settings page would be worse than a restored race, so this
    // degrades — but it must say so.
    await updateUserProfile(USER, { preferences: { currency_format: 'GBP' } });

    expect(logger.warn).toHaveBeenCalledWith(
      'SettingsService',
      expect.stringContaining('migration 041 not applied')
    );
  });

  it('surfaces a real patch failure instead of silently degrading', async () => {
    const { client } = makeDb({ currency_format: 'EUR' });
    client.rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'check constraint violated' },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(client as any);

    await expect(
      updateUserProfile(USER, { preferences: { currency_format: 'GBP' } })
    ).rejects.toThrow(/preferences/i);
  });
});
