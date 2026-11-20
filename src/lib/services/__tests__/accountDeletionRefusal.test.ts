/**
 * spec-account-deletion-refused-message: reading what prepare_account_deletion
 * reported, choosing the refusal text that is TRUE, and naming the household and
 * its owner through the person's own session.
 */

import {
  readPreparedChanges,
  refusalOutcome,
  resolveRefusalNames,
} from '@/lib/services/accountDeletionRefusal';
import { createSupabaseMock } from '@/test-utils/supabaseChain';

describe('readPreparedChanges', () => {
  test('reads the two flags from prepare_account_deletion’s result', () => {
    expect(
      readPreparedChanges({
        ownership_transferred: true,
        shared_objects_moved: 9,
        categories_copied: 2,
        rows_repointed: 14,
      })
    ).toEqual({ ownershipTransferred: true, sharedObjectsMoved: true });
    expect(readPreparedChanges({ ownership_transferred: false, shared_objects_moved: 0 })).toEqual({
      ownershipTransferred: false,
      sharedObjectsMoved: false,
    });
  });

  test.each([
    ['null', null],
    ['a string', 'ok'],
    ['an array', [true, 1]],
    ['an empty object', {}],
    ['a non-boolean flag', { ownership_transferred: 'true', shared_objects_moved: 0 }],
    ['a missing count', { ownership_transferred: true }],
    ['a string count', { ownership_transferred: true, shared_objects_moved: '3' }],
    ['a negative count', { ownership_transferred: true, shared_objects_moved: -1 }],
    ['a fractional count', { ownership_transferred: true, shared_objects_moved: 1.5 }],
  ])('anything else (%s) is unrecognisable: null, never a guess', (_label, data) => {
    expect(readPreparedChanges(data)).toBeNull();
  });
});

describe('refusalOutcome', () => {
  test.each([
    [true, true, 'transferredShared'],
    [true, false, 'transferred'],
    [false, true, 'shared'],
    [false, false, 'unchanged'],
  ] as const)('transferred=%s, shared moved=%s -> %s', (transferred, moved, outcome) => {
    expect(refusalOutcome({ ownershipTransferred: transferred, sharedObjectsMoved: moved })).toBe(
      outcome
    );
  });
});

describe('resolveRefusalNames', () => {
  const me = 'user-refused';
  const owner = 'user-owner';
  const householdId = 'hh-1';

  function mockDb(overrides: {
    membership?: { data: unknown; error: unknown };
    household?: { data: unknown; error: unknown };
    members?: { data: unknown; error: unknown };
  }) {
    const db = createSupabaseMock({
      tables: {
        household_members: overrides.membership ?? {
          data: { household_id: householdId },
          error: null,
        },
        households: overrides.household ?? {
          data: { name: 'Вкъщи', created_by: owner },
          error: null,
        },
      },
      user: { id: me },
    });
    db.client.rpc.mockResolvedValue(
      overrides.members ?? {
        data: [
          { user_id: me, email: 'me@example.test', role: 'member' },
          { user_id: owner, email: 'owner@example.test', role: 'admin' },
        ],
        error: null,
      }
    );
    return db;
  }

  test('names the household and its owner (by email, as the household page does)', async () => {
    const db = mockDb({});

    await expect(resolveRefusalNames(db.client, me)).resolves.toEqual({
      household: 'Вкъщи',
      owner: 'owner@example.test',
    });

    // Scoped to THIS person's membership, THAT household, and its roster.
    expect(db.callsTo('household_members', 'eq')).toContainEqual(['user_id', me]);
    expect(db.callsTo('households', 'eq')).toContainEqual(['id', householdId]);
    expect(db.client.rpc).toHaveBeenCalledWith('household_members_list', {
      p_household_id: householdId,
    });
  });

  test.each([
    ['no membership', { membership: { data: null, error: null } }],
    ['the membership read fails', { membership: { data: null, error: { message: 'x' } } }],
    ['the household read fails', { household: { data: null, error: { message: 'x' } } }],
    ['the household has no name', { household: { data: { created_by: owner }, error: null } }],
    [
      'the person still owns it (flags and database disagree)',
      { household: { data: { name: 'Вкъщи', created_by: me }, error: null } },
    ],
    ['the roster read fails', { members: { data: null, error: { message: 'x' } } }],
    [
      'the owner is not in the roster',
      { members: { data: [{ user_id: me, email: 'me@example.test' }], error: null } },
    ],
  ])('cannot name them when %s: null, never a throw', async (_label, overrides) => {
    await expect(resolveRefusalNames(mockDb(overrides).client, me)).resolves.toBeNull();
  });

  test('a throwing client is contained: null', async () => {
    const db = mockDb({});
    db.client.rpc.mockRejectedValue(new Error('fetch failed'));
    await expect(resolveRefusalNames(db.client, me)).resolves.toBeNull();
  });
});
