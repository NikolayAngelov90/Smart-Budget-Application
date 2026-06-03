# RLS Integration Test Strategy

**Status**: Proposed
**Origin**: Epic 12 retrospective action item **PREP-1** (blocker before Epic 13 `create-story`)
**Owners**: Dana (QA), Winston (Architect)
**Relates to**: ADR-015 (Household RLS), ADR-010/011 (household model + transparency), NFR9–NFR11

---

## Why this exists

Every integration test in the codebase today **mocks Supabase at the service boundary** (see [integration-test-guide.md](./integration-test-guide.md): "mocking Supabase at the service boundary rather than at individual function level"). That is correct and fast for single-user CRUD — but it has a structural blind spot:

> A mock returns whatever rows you tell it to. **It can never prove that the database refuses to return rows it shouldn't.**

Epic 13 introduces the first multi-tenant surface in the app. Its security requirements are not about application logic — they are about the **database**:

- **NFR9** — RLS on every table; no data without valid auth.
- **NFR10** — household isolation verified by integration tests **for every transparency level**.
- **NFR11** — cross-household leakage **impossible**, verified **at the database layer**.
- **FR23 / FR27** — isolation and transparency enforced "via any access path."

These cannot be satisfied by mocked tests. If we ship Epic 13 on the current pattern, every security AC ships **unverified** — exactly the kind of false confidence the Epic 12 retro flagged. This is why PREP-1 is a hard blocker before Epic 13 story creation.

The architecture already anticipated this (architecture.md): RLS expansion is "the single most complex architectural concern," and household features "need integration tests simulating multiple concurrent users with different transparency settings."

---

## What an RLS test must do that a unit test cannot

| Concern | Unit/mock test | RLS integration test |
|---|---|---|
| Service computes the right shape | ✅ | ✅ (incidental) |
| DB **rejects** unauthorized reads | ❌ (mock obeys you) | ✅ (policy enforced) |
| `category_only` returns sums but **blocks rows** | ❌ | ✅ |
| Removed member loses access immediately (FR22) | ❌ | ✅ |
| Direct API path can't bypass transparency | ❌ | ✅ |

**Rule of thumb for Epic 13:** business logic → keep mocking (fast). Any AC containing the words *isolation, transparency, private, shared, member access, leakage* → **must** have an RLS integration test against a real Postgres with the real policies applied.

---

## Approach

Run a real Postgres with our migrations + RLS policies applied, seed **two users in different households** (and members at each transparency level), then exercise reads/writes using **per-user anon clients that carry that user's JWT** — so `auth.uid()` is real and RLS evaluates exactly as in production.

### Environment

Use the Supabase CLI's local stack (Postgres + GoTrue + PostgREST), which mirrors production RLS behavior:

```bash
# one-time
npm i -D supabase
npx supabase init            # creates supabase/config.toml (migrations/ + seed.sql already exist)

# per run
npx supabase start           # boots local Postgres+Auth+PostgREST, applies supabase/migrations/*
npm run test:rls
npx supabase stop
```

`supabase start` prints the local API URL, `anon` key, and `service_role` key. Wire them to the test env:

```
RLS_TEST_SUPABASE_URL=http://127.0.0.1:54321
RLS_TEST_SUPABASE_ANON_KEY=<printed anon key>
RLS_TEST_SUPABASE_SERVICE_KEY=<printed service_role key>   # seeding only, never for assertions
```

> Alternative if local Docker is unavailable in CI: a dedicated throwaway Supabase **test project** with the same env vars. Same test code, slower.

### Per-user client helper

A real client must carry a real user session so `auth.uid()` is populated. The reference helper is [src/lib/test-utils/rlsClient.ts](../../src/lib/test-utils/rlsClient.ts):

- `isRlsHarnessConfigured()` — true only when the `RLS_TEST_*` env vars are present.
- `createServiceClient()` — service-role client for **seeding/teardown only** (it bypasses RLS; never assert reads through it).
- `signInAsTestUser(email, password)` — returns an **anon-key client authenticated as that user**; all assertions go through these so RLS is actually exercised.

### Gating (keeps the default suite green)

RLS tests live in `**/__tests__/**/*.rls.test.ts` and are **env-gated** — they `describe.skip` when `isRlsHarnessConfigured()` is false. So `npm test` on a laptop with no DB stays green; `npm run test:rls` (after `supabase start`) runs them for real. CI runs them in a job that boots the Supabase stack first.

> **Jest env note:** use the default jsdom environment (Node 22 has global `fetch`). Do **not** add `@jest-environment node` — this project's `jest.setup.js` accesses `window`, which throws under the node env. The harness imports the raw `@supabase/supabase-js` client, so it is unaffected by `jest.setup.js`'s global mock of `@/lib/supabase/server`.

`package.json` additions (when adopted):
```jsonc
"test:rls": "jest --testPathPattern='\\.rls\\.test\\.ts$' --runInBand"
```
`--runInBand` because tests share one database and seed/teardown around each other.

---

## Test pattern (the contract Epic 13 stories follow)

```
describe (gated) "Household isolation — <feature>"
  beforeAll : service client seeds → householdA{userA1,userA2}, householdB{userB1}
              with categories at each visibility_level (shared | category_only | private)
  afterAll  : service client deletes seeded rows (cascade)

  it "userB1 cannot read householdA shared transactions"     -> anon(userB1).select(...) returns []
  it "userA2 reads shared category rows in householdA"        -> returns rows
  it "userA2 on a category_only category gets sums, not rows" -> aggregate ok, row select []
  it "userA2 cannot read userA1's private/allowance rows"     -> returns []
  it "removed member loses access immediately (FR22)"         -> delete membership, re-query -> []
  it "expired/used invite token is rejected (FR19/ADR-016)"   -> accept fails
```

Assertions check **what the database returns to that authenticated user**, never what a service function computed. A passing `[]` where data exists in another household is the whole point.

### Coverage matrix to fill in Epic 13 (NFR10 — every transparency level)

| Reader \ Resource | shared | category_only | private/allowance |
|---|---|---|---|
| same-household member | rows ✅ | sums only, rows ❌ | ❌ |
| other-household user | ❌ | ❌ | ❌ |
| removed member (post-removal) | ❌ | ❌ | ❌ |

Every cell becomes at least one `it`. NFR11 ("impossible") means the "other-household" row must be ❌ for **every** resource type, including via RPC/aggregate paths.

---

## Definition of done for PREP-1

- [x] Strategy documented (this file) and the gap named.
- [x] Reference harness helper committed and env-gated ([rlsClient.ts](../../src/lib/test-utils/rlsClient.ts)) + a reference `.rls.test.ts` proving the pattern on **existing** tables (user-to-user transaction isolation), so Epic 13 starts from a working example, not a blank page.
- [ ] **(Epic 13 kickoff, not now)** `npm i -D supabase`, `supabase init`, add `test:rls` script, wire a CI job that boots the stack — done in the household-foundation story so the RLS lands tested from commit one.

The first two are deliverable pre-Epic-13 (no household tables required — the reference test uses `transactions`/`categories`). The third belongs with Epic 13's first story because it needs the household migrations to exist.
