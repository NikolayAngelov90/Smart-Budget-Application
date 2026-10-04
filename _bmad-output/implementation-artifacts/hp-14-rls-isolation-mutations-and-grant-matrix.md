# hp-14 — the isolation guarantees, mutation-tested; and the grant/policy matrix

Two halves of one question: **does the RLS suite actually detect a breach of the
guarantee the README advertises, and are the privileges behind that guarantee
layered or single-ply?**

Status: **done**, 2026-10-04. The local-green-skip half closed earlier in #70.

---

## Part 1 — why a red mutation in the local suite says anything about production

A red test proves the suite can detect a broken policy **in whatever database the
suite happens to be talking to**. That it says anything about production depends
on a four-link chain, and every link has been false at some point in this
project's life. Written down because neither of us will remember it:

| # | link | evidence, 2026-10-04 |
| --- | --- | --- |
| 1 | `rls.yml` and `schema-drift.yml` pin `supabase/setup-cli` to the **same** version, so the RLS stack and the drift-checked stack are one stack | both `version: 2.105.0` |
| 2 | `server_version_num` is asserted, so that stack matches production's Postgres | latest drift run: `production 17.6 (170006)` / `migrations 17.6 (170006)` / `match` |
| 3 | the schema was reconciled and the drift check is green, so the policies, trigger and columns are the same objects | reconciled by #68 (2026-10-03); drift green on `86240a8`, `hard failures: 0` |
| 4 | the preflight guarantees the suite **runs** rather than green-skipping, so a pass is a pass | #70's CI run: `13 passed, 13 total` / `65 passed, 65 total` |

**Break any link and a red mutation proves only that the suite can detect a
broken policy in a database nobody uses.** That was literally the situation until
two weeks ago: link 1 was false (`latest` vs `2.105.0`), link 2 was false
(`config.toml` said major 15 against production's 17), and link 4 was false
locally. Mutation (b) below, run against the CI schema in that era, would have
passed — while production was in exactly the state the mutation simulates.

The mutation is the **last** link in that chain, not the whole argument.

---

## Part 2 — the mutations, and which assertion each one reddens

Run on the pinned CI stack by dispatching `rls.yml` on a throwaway branch
(`workflow_dispatch` added in #72 for this purpose). Each mutation was pushed,
run, read, then **reverted on the same branch and re-run** — a suite that is red
before and after proves nothing about the mutation.

Baseline, `main` @ `657bd88`: `13 suites / 65 tests passed`.

### (a) cross-user write — forge the `transactions` INSERT `WITH CHECK`

`022_shared_categories.sql`: the owner conjunct `auth.uid() = user_id` → `true`,
so any authenticated user may insert a row attributed to anybody.

```
FAIL  referenceIsolation.rls.test.ts
  ● RLS reference — transaction isolation between users
    › other user (user B) CANNOT write into user A’s scope
Tests: 1 failed, 64 passed, 65 total      (12 suites PASS, transparency among them)
```

**Exactly one assertion, and it is the predicted one.** Mapping holds.

### (b) transparency — neuter the owner-only visibility trigger

`20260924100000_close_drifted_production_policies.sql`: the guard condition in
`enforce_category_visibility_owner()` → `IF false THEN`, so it never raises. This
is the exact state production was in until 2026-09-24.

```
FAIL  transparency.rls.test.ts
  ● Transparency per-category controls (Story 13.4)
    › a member CANNOT change another owner’s category visibility (owner-only trigger)
Tests: 1 failed, 64 passed, 65 total      (referenceIsolation PASSES)
```

**Exactly one assertion, and it is the predicted one.** Mapping holds.

### (a′) cross-user read — open the `transactions` SELECT policy

`023_transparency.sql`: the owner disjunct → `true`. Reported separately because
it reddens **six** suites, and that is correct rather than imprecise.

```
● referenceIsolation › other user (user B) CANNOT read user A’s transaction
● transparency      › member sees shared transactions, but NOT category_only or private
● allowance         › a co-member CANNOT see allowance transactions
● contributions     › B’s category_only transaction rows remain invisible to A (13.4 still holds)
● member-removal    › after removal, B loses access to ALL shared data + aggregates
● shared-categories › member (a2) CAN see a shared-category transaction; outsider (b1) CANNOT
```

The `transactions` SELECT policy has two disjuncts — owner, and
household-member-plus-shared-visibility. Replacing the owner disjunct with `true`
grants blanket read, which genuinely breaks **six distinct product guarantees**,
each independently asserted in its own suite. The suites are not failing to test
what their names say; one policy is the single mechanism behind six promises.

**The isolating mutations are the ones that test the mapping, and both mapped
one-to-one.** This one tests something else and answers it well: the read
guarantee is defended in six places, not one.

### Restore — the non-vacuity half

Each mutation reverted on its own branch, tree verified **byte-identical to
`main` by tree hash**, and re-run:

| branch head | result |
| --- | --- |
| `75f3615` (a reverted) | success |
| `a44de2e` (a′ reverted) | success |
| `9483810` (b reverted) | success |

Red with the mutation, green without, same branch. Experiment branches deleted;
nothing was merged.

---

## Part 3 — the grant/policy matrix

The deliverable from the deferred note: per table, **(table-level grants ×
RLS UPDATE policy breadth × privilege-bearing columns)**, flagging where two of
the three line up. Read-only against production, 2026-10-04.

### The one case where all THREE line up

**`categories.visibility_level`.**

| layer | state |
| --- | --- |
| table grant | `authenticated`: table-wide `INSERT, UPDATE` |
| UPDATE policy | `is_predefined = false AND (auth.uid() = user_id OR is_household_member(household_id, auth.uid()))` — **permits any household member to update a category they do not own** |
| privilege-bearing column | `visibility_level` — decides whether a category's transactions are visible to the household |

So the **only** control standing between a member and re-pointing another
member's category from `private` to `shared` is
`trg_category_visibility_owner` — and **mutation (b) proves it is the sole
control**, because neutering the trigger made the assertion fail. If the policy
had refused the update, the trigger would never have fired and (b) would have
stayed green.

That trigger did not exist in production until 2026-09-24. The matrix explains
why that gap was exploitable rather than merely untidy: all three layers aligned
and the single intended control was absent.

### Two of three: latent, safe today by an absence

| table | column | grant | UPDATE policy | why it is safe today |
| --- | --- | --- | --- | --- |
| `household_members` | `role` (`admin`\|`member`) | wide `INSERT, UPDATE` | **none** | RLS default-denies. The day a legitimate UPDATE policy is added for an unrelated reason, `role` comes with it — on the most consequential column in the app |
| `household_invitations` | `status` | wide `INSERT, UPDATE` | none | same shape |

### Done correctly — the pattern worth copying

| table | how |
| --- | --- |
| `user_profiles` | table-level UPDATE **revoked**, then UPDATE granted on exactly `display_name`, `preferences`, `profile_picture_url`. `analytics_viewer` is therefore not updatable by `authenticated` at all |
| `insights` | same shape: table UPDATE revoked, granted on the seven engagement columns only |

Both are two-layer: the grant would refuse the write even if a policy permitted
it. That is the column-allowlist pattern, and it is the one to copy.

### NEW FINDING — the exemplar REVOKEs only covered half the roles

The deferred note cites `036_user_achievements.sql:39-43` and
`037_comeback_challenges.sql:34-36` as "done correctly already, with explicit
REVOKEs". They revoke from **`authenticated`** and not from **`anon`**:

```sql
REVOKE UPDATE, DELETE ON user_achievements FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON comeback_challenges FROM authenticated;
```

Measured in production:

| table | `authenticated` wide | `anon` wide |
| --- | --- | --- |
| `user_achievements` | `INSERT` (UPDATE correctly revoked) | **`INSERT, UPDATE`** |
| `comeback_challenges` | — (all correctly revoked) | **`INSERT, UPDATE`** |

Supabase's default privileges grant the same table-wide rights to `anon`, and
grants are additive, so a REVOKE naming one role leaves the other intact. Both
tables are server-derived lifecycle tables whose whole point is that they must not
be forgeable through PostgREST.

**Not exploitable today**: both have RLS on with no INSERT/UPDATE policy at all,
so writes are denied whatever the grant says. Which is precisely the pattern the
note named — *safe by a single layer, with the second absent* — now found on the
two tables held up as the examples of having both.

### The systemic version

`anon` holds table-wide `INSERT, UPDATE` on **24 of 26** public tables. Only
`notification_deliveries` and `user_profiles` are clean. It is harmless for the
same reason throughout: RLS policies match on `auth.uid()`, which is NULL for an
unauthenticated caller. One layer, everywhere.

### Recommendation, not done here

A `REVOKE INSERT, UPDATE, DELETE ... FROM anon` sweep would complete the second
layer. It is cheap and it is a **production grants change**, so it is a decision
rather than a cleanup: the live risk today is zero, the benefit is that a future
permissive policy cannot silently become exploitable, and the cost is a migration
that touches privileges on every table. Filed for that decision.

---

## Acceptance

- [x] Local `test:rls` cannot pass by skipping — #70, with the before/after
      measured (`exit 0` with `65 skipped` → `exit 1` naming each missing var)
- [x] Mutation (a) cross-user reddens `referenceIsolation`, by named assertion
- [x] Mutation (b) transparency reddens `transparency`, by named assertion
- [x] Each mutation reverted and the suite confirmed green again
- [x] The chain from "a test went red" to "production is covered" written down
- [x] Grant/policy matrix delivered, with the 2-of-3 and 3-of-3 cases named
