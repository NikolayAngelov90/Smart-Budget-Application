# hp-8 — insights regenerated on every write after a cold start

Status: in review

## The defect

`shouldTriggerGeneration` read a module-level `Map`:

```ts
const entry = generationCache.get(userId);
if (!entry) return true; // Never generated before
```

On a serverless cold start that Map is empty. Every user looked "never
generated", the 10-transaction gate was skipped, and insights regenerated on
essentially every transaction POST — each run deleting and reinserting every
row, which is what destroyed dismissals (the symptom that started the audit).

The shape: **three states — not loaded / never generated / generated at T —
squeezed into two**, with the missing one collapsing into the expensive answer.
The same shape as 17-1's `inHousehold = !isLoading && !!household`, where "still
loading" collapsed into "has no household".

## Marker choice, and why not the cheaper one

The brief said to derive the marker from `MAX(insights.created_at)`. **That is
correct today and correct only because of the defect hp-10 removes.** Generation
currently deletes every row and reinserts, so each row's `created_at` IS the last
run. hp-10 replaces that with fingerprint + UPSERT precisely so rows SURVIVE —
after which a row created in August and refreshed in October still reads August,
the "transactions since last generation" count spans months, the gate clears on
nearly every POST, and this bug returns. Silently: no test fails, no error
appears, the counter just reads stale.

`MAX(updated_at)` fails for a **second, independent reason** that also rules out
any row-derived marker: a run producing ZERO insights has no row to touch.
`generateInsights` explicitly supports that case — `// Update cache even if no
insights generated` — because the marker records that generation RAN, not what it
wrote. Users with sparse data generate nothing, and they are exactly the ones
whose gate would then clear forever.

**Chosen: `user_profiles.insights_last_generated_at`** — an explicit run-level
marker on a per-user table, unaffected by whatever happens to insight rows.

### The qualifier that matters

`user_profiles` carries a full owner UPDATE policy (`auth.uid() = id`), so a bare
column there is **writable by the user through PostgREST**. Unprotected, a user
could set the marker to a future date and permanently suppress their own insight
generation, or to the epoch and force regeneration on every write. That is the
forgeable-server-state pattern this project has already hit twice.

So the migration also does:

```sql
REVOKE UPDATE (insights_last_generated_at) ON public.user_profiles FROM authenticated;
REVOKE INSERT (insights_last_generated_at) ON public.user_profiles FROM authenticated;
```

SELECT stays — the value is not secret, and a client may want to show "last
refreshed". Only writing is restricted, and writes go through the service role.

**GRANTs in Postgres are additive**, so a later `GRANT UPDATE ON user_profiles TO
authenticated` would silently restore write access to this column. That needs an
RLS test — see Follow-up below.

## The seam test, written now rather than deferred

The brief asked for a test pinning the marker's meaning under UPSERT semantics,
and for it to be written in hp-8 if possible. It was:

> `advances even when no insight row is written`

Because the marker is run-level, that test never mentions insight rows, so it
holds before and after hp-10 **without modification**. If it ever needs changing
to accommodate hp-10, the marker has been re-coupled to row lifetime and the bug
is back — which makes the test a tripwire as well as a guard.

## Deploy-window escape hatch

The migration applies when main merges; Vercel deploys on the same merge, in no
guaranteed order. There is a window where this code runs against a schema without
the column, and throwing there would 500 `/api/insights/generate` and the cron
for its duration.

`readLastGeneratedAt` therefore degrades to `null` — the pre-hp-8 behaviour, no
worse than yesterday, self-healing once the column exists — **for Postgres error
42703 (undefined_column) only**. Every other failure still throws, per the
degradation policy: answering "never generated" on a connection error would
regenerate for every user on every write, which is this bug wearing a hat.

## Mutation evidence

Baseline 8 passed. Each mutation reverted afterwards.

```
M1  restore the in-memory Map (the original bug)   2 failed, 5 passed
      × does NOT regenerate when the marker is recent …
      × THROWS on a marker read failure instead of guessing
M2  swallow the read error into "never generated"  1 failed, 6 passed
      × THROWS on a marker read failure instead of guessing
M3  write the marker with the USER client          2 failed, 5 passed
      × advances even when no insight row is written
      × is written with the SERVICE ROLE …
```

**Discriminating power, stated plainly:** of the 8 tests, M1 is caught by 2, M2
by 1, M3 by 2. `treats a NULL marker as never generated` and `regenerates once
the 10-transaction threshold is crossed` pass with the Map restored — they pin
behaviour hp-8 preserves, and are regression cover rather than guards for this
fix.

## Also fixed here

`__tests__/lib/services/insightService.test.ts` called `jest.resetModules()` to
clear the Map, then re-required the service. With the Map gone that reset is not
just obsolete, it is harmful: the re-required module gets a FRESH mock of
`@/lib/supabase/server`, so the `mockResolvedValue` configured on the imported
reference no longer applies and `createClient()` resolves undefined. Removed.

Its sibling `should return true if 10+ transactions since last generation`
asserts only `expect(shouldTriggerGeneration).toBeDefined()` — a vacuous test
that passes whatever the function does. Left in place but annotated, with the
real coverage in the new suite.

## Follow-up, deliberately not done here

**An RLS test proving the column REVOKE holds.** It belongs in the `.rls.test.ts`
suite, which runs against a real local Postgres — the only place a column
privilege can actually be exercised. It is not written yet because that suite
currently green-skips locally (hp-14) and I will not add a guard whose red state
I cannot observe. Added to hp-14's scope so the two land together.

Until then the REVOKE is verified by reading the migration, and the service-role
write path is pinned by `is written with the SERVICE ROLE` above.

## Gate

lint clean (`npm run lint`, `--max-warnings=0`) · type-check clean · jest
**2569 → 2577** · production build clean.

---

## The reported bug, closed on evidence — 2026-08-28

hp-8 and hp-10 together fix what Nikit originally reported: a dismissed insight
returning. He reports it now behaving correctly, and that impression was
converted into row state rather than accepted as the close, because "looks right"
is not the same claim as "the dismissal survived a regeneration".

Read-only on his account, the €700 Shopping insight for the 16 July transaction
`a0f9c251`:

```
rows for this transaction   1
id                          a282abfa-2fef-4a87-a909-9692f118fe54
is_dismissed                true
created_at                  2026-08-28 12:07:31.948
dismissed_at                2026-08-28 12:07:39.593
updated_at                  2026-08-28 12:10:08.250
upserted_after_dismissal    true
```

The timeline is the proof. The row was created by the post-migration
regeneration, dismissed 8 seconds later, and then a generation ran 2.5 minutes
AFTER the dismissal — `updated_at` advanced on the SAME id while `is_dismissed`
stayed true, and no second row was minted beside it.

Before hp-10 that same sequence produced a new id with `is_dismissed` reset to
false, observed both on his account (12 rows, one timestamp, zero dismissed) and
reproduced on QA.

No writes were made to his account at any point.
