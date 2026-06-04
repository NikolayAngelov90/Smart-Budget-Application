/**
 * @jest-environment node
 *
 * Household invitations RLS tests — Story 13.2.
 *
 * Node env (Node's global fetch); env-gated via rlsDescribe (skips without RLS_TEST_*).
 * Verifies invitations are visible ONLY to household admins (SELECT-only RLS via
 * is_household_admin), and that no one can write them via an anon client
 * (no INSERT policy — writes are service-role only). NFR10/NFR11.
 */

import {
  rlsDescribe,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  signInAsTestUser,
} from '@/lib/test-utils/rlsClient';

const PWD = 'rls-test-passw0rd!';
const stamp = Date.now();
const a1Email = `rls-inv-a1-${stamp}@example.test`; // admin of A
const a2Email = `rls-inv-a2-${stamp}@example.test`; // member of A
const b1Email = `rls-inv-b1-${stamp}@example.test`; // admin of B (outsider to A)

rlsDescribe('Household invitations isolation (Story 13.2)', () => {
  let a1Id: string;
  let a2Id: string;
  let b1Id: string;
  let householdAId: string;
  let inviteAId: string;

  beforeAll(async () => {
    const svc = createServiceClient();
    a1Id = await createTestUser(a1Email, PWD);
    a2Id = await createTestUser(a2Email, PWD);
    b1Id = await createTestUser(b1Email, PWD);

    const { data: hA } = await svc
      .from('households')
      .insert({ name: 'Invite Household A', created_by: a1Id })
      .select('id')
      .single();
    householdAId = hA!.id;
    await svc.from('household_members').insert([
      { household_id: householdAId, user_id: a1Id, role: 'admin' },
      { household_id: householdAId, user_id: a2Id, role: 'member' },
    ]);

    const { data: hB } = await svc
      .from('households')
      .insert({ name: 'Invite Household B', created_by: b1Id })
      .select('id')
      .single();
    await svc.from('household_members').insert({ household_id: hB!.id, user_id: b1Id, role: 'admin' });

    const { data: inv } = await svc
      .from('household_invitations')
      .insert({
        household_id: householdAId,
        email: 'guest@example.test',
        invited_by: a1Id,
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      })
      .select('id')
      .single();
    inviteAId = inv!.id;
  });

  afterAll(async () => {
    if (a1Id) await deleteTestUser(a1Id);
    if (a2Id) await deleteTestUser(a2Id);
    if (b1Id) await deleteTestUser(b1Id);
  });

  it('admin (a1) CAN read their household invitations', async () => {
    const a1 = await signInAsTestUser(a1Email, PWD);
    const { data } = await a1.from('household_invitations').select('id').eq('id', inviteAId);
    expect(data).toHaveLength(1);
  });

  it('non-admin member (a2) CANNOT read invitations', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    const { data } = await a2.from('household_invitations').select('id').eq('household_id', householdAId);
    expect(data).toEqual([]);
  });

  it('outsider (b1) CANNOT read household A invitations', async () => {
    const b1 = await signInAsTestUser(b1Email, PWD);
    const { data } = await b1.from('household_invitations').select('id').eq('household_id', householdAId);
    expect(data).toEqual([]);
  });

  it('no anon client can INSERT an invitation (writes are service-role only)', async () => {
    const a1 = await signInAsTestUser(a1Email, PWD); // even the admin, via anon client
    const { error } = await a1.from('household_invitations').insert({
      household_id: householdAId,
      email: 'sneaky@example.test',
      invited_by: a1Id,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
    expect(error).not.toBeNull(); // no INSERT policy → denied

    const svc = createServiceClient();
    const { data } = await svc
      .from('household_invitations')
      .select('id')
      .eq('household_id', householdAId)
      .eq('email', 'sneaky@example.test');
    expect(data).toEqual([]);
  });
});
