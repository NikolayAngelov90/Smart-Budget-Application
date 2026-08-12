# AI Insights lifecycle audit — 2026-08-12

**Scope:** read-only. No source, migration or test was changed in this run.
**Symptom:** a dismissed insight reappears, undismissed, a few days later.
**Verdict:** confirmed, with a cause more frequent than the one hypothesised.

> **Note on method.** The prompt specified the `bmad-deep-recon` skill. I did not
> use it: its governing rule is a research firewall — *"project context — briefs,
> PRDs, code, memory — … is inadmissible as evidence"* — and this audit's
> evidence **is** the code, the production database and the runtime logs. The
> deliverable spec below is unchanged.

---

## Headline

Two independent defects. The hypothesis in the prompt is the second one; the
first is what actually makes it fire "a few days later".

1. **The regeneration rate limiter fails OPEN on a cold start.**
   `shouldTriggerGeneration()` returns `true` when the in-memory cache has no
   entry for the user. On any cold lambda that is *every* user. So **a single
   transaction — not ten — regenerates every insight.**
2. **Regeneration deletes every row for the user, unfiltered**, including
   dismissed ones, then reinserts with fresh UUIDs and `is_dismissed` default
   `false`. Nothing carries a dismissal forward.

**Confidence: HIGH on both.** Each is confirmed in production data, not only in
source.

---

## 1. Trigger map

| # | Entry point | Condition | Rate limit | Evidence |
|---|---|---|---|---|
| 1 | `POST /api/transactions` → `checkAndTriggerForTransactionCount()` | **Any transaction when the lambda is cold** (intended: 10+ since last generation) | In-memory only; absent on cold start | `transactions/route.ts:403`, `insightService.ts:329-347` |
| 2 | `POST /api/insights/generate` | Manual, user-initiated | Rate-limited in route | `insights/generate/route.ts:76` |
| 3 | `GET /api/cron/generate-insights` | **Only when `getUTCDate() === 1`** | Daily cron, no-ops on other days | `cron/generate-insights/route.ts:63-71` |

`vercel.json` schedules `generate-insights` at `0 0 * * *` — daily — but the
route returns early unless it is the 1st:

```
cron/generate-insights/route.ts:63   const isFirstOfMonth = today.getUTCDate() === 1;
cron/generate-insights/route.ts:66   logger.info('Cron', `Skipped - Not start of month (Day: …)`);
```

**Which path explains the symptom: path 1, decisively.** Production evidence:

```
user_prefix | txn_created                   | insights_created              | seconds_before_batch
b11f65b7    | 2026-08-12 06:31:51.848261+00 | 2026-08-12 06:31:52.754143+00 | 1
```

A transaction was written, and **0.9 seconds later** the entire insight set was
replaced. 12 August is not the 1st, so the cron is excluded.

And the "10+" gate provably did not fire it:

```
txns_last_hour | txns_last_24h | txns_last_7d
1              | 1             | 13
```

**One** transaction in the preceding 24 hours. The threshold is 10.

### Why the limiter fails open

```ts
// insightService.ts:297-299
export async function shouldTriggerGeneration(userId: string): Promise<boolean> {
  const entry = generationCache.get(userId);
  if (!entry) return true; // Never generated before
```

`generationCache` is a module-level `Map` (`insightService.ts:38`). In a
serverless runtime it is empty on every cold start and is never shared between
concurrent instances. The call sequence is:

1. `isCacheValid(userId)` → no entry → `false` → does **not** return early.
2. `shouldTriggerGeneration(userId)` → no entry → **`true`**.
3. `generateInsights(userId, false)` → line 80 checks `isCacheValid` again →
   still no entry → proceeds.

Every guard on the path is the same absent Map. "Never generated before" is a
reasonable default for a persistent process and the wrong one here — the honest
reading of an empty cache in a lambda is *"I don't know"*, and the safe action
for a destructive operation is to do nothing.

---

## 2. Lifecycle table

| `insight_type` | Rule fn | Window | Threshold | Can legitimately re-fire later? |
|---|---|---|---|---|
| `spending_increase` | `detectSpendingIncrease` — `insightRules.ts:~60` | current vs previous month | >20% increase | **Yes** — a later month can genuinely rise again |
| `budget_recommendation` | `recommendBudgetLimit` — `insightRules.ts:137` | 3 **complete** prior months (HP-5) | ≥5 txns, full window, ≥20 rec. | **Yes** — the recommended figure moves as the baseline moves |
| `unusual_expense` | `flagUnusualExpense` — `insightRules.ts:261` | whole fetched set | >2σ outlier | **No** — it names one specific transaction |
| `positive_reinforcement` | `generatePositiveReinforcement` | current vs previous month | spending down | **Yes** |
| `spending_anomaly` | Epic-12 engine (`lib/ai/`) | rolling | anomaly score | **Yes** |
| `new_high_spend_category` | Epic-12 engine (`lib/ai/`) | rolling | new category above threshold | **Yes** |

This split matters for the fix: **`unusual_expense` is anchored to a single
transaction and should stay dismissed forever**, while the period-scoped types
arguably *should* return in a new period. A single global policy will be wrong
for one group or the other.

---

## 3. Dismissal trace

1. **UI** — insights list dismiss control.
2. **Endpoint** — `PUT /api/insights/[id]/dismiss/route.ts:45-53`:
   ```ts
   const updatePayload = { is_dismissed: true, dismissed_at: new Date().toISOString() };
   ```
   Correct, and RLS-scoped. There is also an `undismiss` route.
3. **DB** — row updated in place.
4. **Next generation** — `insightService.ts:251-255`:
   ```ts
   // Delete old insights for this user (to avoid accumulation)
   const { error: deleteError } = await adminClient
     .from('insights')
     .delete()
     .eq('user_id', userId);
   ```
   **This is the statement that destroys the dismissal.** Filtered by `user_id`
   only — no `is_dismissed` predicate. Uses the **admin (service-role) client**,
   so RLS does not constrain it.
5. **Reinsert** — new rows, new UUIDs, `is_dismissed` defaults `false`
   (`001_initial_schema.sql`).

**Hypothesis: CONFIRMED**, at `insightService.ts:252-255`.

### Production confirmation

Every row a user has shares one microsecond-identical `created_at` — the
signature of a single batch insert with no survivors:

```
user_prefix | created_at                    | rows_in_batch | dismissed | with_dismissed_at
b11f65b7    | 2026-08-12 06:31:52.754143+00 | 8             | 0         | 0
dd9be3b3    | 2026-07-25 07:49:58.893468+00 | 6             | 0         | 0
```

14 rows, **2 distinct creation instants, 0 dismissed, 0 with `dismissed_at`** —
despite the reported dismissals. Nothing has ever survived a regeneration.

### One hypothesis REFUTED

The prompt states `dismissed_at` is written but could not be found being read.
It **is** read — `api/insights/analytics/route.ts:170-172`, which sorts by it to
report the most recent dismissal. The column exists (added in
`003_insights_engagement_analytics.sql:12`). It simply never holds a value long
enough to be useful.

---

## 4. Data-loss inventory

**No foreign key references `insights.id`** — verified against
`information_schema`; the query returned zero rows. So there is no cascade. The
loss is worse than a cascade would be, because the analytics live *on the row*:

`003_insights_engagement_analytics.sql:9-15` adds to `insights`:

- `view_count`
- `first_viewed_at`
- `last_viewed_at`
- `dismissed_at`
- `metadata_expanded_count`
- `last_metadata_expanded_at`

Every one is destroyed on every regeneration. Consequences:

- `/api/insights/[id]/track` writes engagement that is wiped ~on the next
  transaction.
- `/api/insights/analytics` (the Epic 12-8 dashboard) reports on a table that
  resets constantly — **its numbers are not trustworthy today**, independently
  of the dismissal bug.
- The two indexes built for analytics (`idx_insights_engagement`,
  `idx_insights_dismissed`) index columns that never accumulate data.

**So the fix is one table, but two features:** dismissal durability *and*
engagement analytics.

---

## 5. Options

### (a) Identity key — fingerprint + UPSERT

Add a deterministic `fingerprint` (e.g. `type + category_id + period_bucket +
rule_version`), `UNIQUE (user_id, fingerprint)`. Replace delete+insert with
UPSERT that preserves `is_dismissed`, `dismissed_at` and the engagement columns.

- **Migration:** add column, backfill, add unique index.
- **`generateInsights()`:** compute fingerprint per insight; `upsert` on
  conflict, updating content columns only.
- **Analytics:** *preserved and finally meaningful* — a row accumulates views
  across regenerations.
- **Failure mode:** fingerprint design is the whole risk. Too coarse and a
  genuinely new insight is suppressed; too fine (e.g. amount in the key) and
  every regeneration mints a new row, restoring today's behaviour silently.
- **August→October "Groceries up 40%":** **re-appears**, because the period
  bucket differs. Dismissing August does not mute October.

### (b) Suppression ledger — separate table

`insight_dismissals (user_id, fingerprint, dismissed_at, expires_at)`.
Generation filters candidates against it. `insights` keeps churning.

- **Migration:** new table + RLS.
- **`generateInsights()`:** filter before insert.
- **Analytics:** **still destroyed** — engagement stays on the churning table.
- **Failure mode:** two sources of truth; a fingerprint change orphans the
  ledger silently.
- **August→October:** re-appears *if* `expires_at` has passed — the only option
  with an explicit "mute for N days" knob.

### (c) Scoped delete — keep dismissed rows

`delete().eq('user_id', …).eq('is_dismissed', false)`, then dedupe new rows
against the survivors.

- **Migration:** none.
- **`generateInsights()`:** one predicate, plus dedupe logic.
- **Analytics:** preserved *only* for dismissed rows.
- **Failure mode:** dismissed rows accumulate forever with no expiry, and
  without a fingerprint the dedupe has nothing reliable to compare on — it would
  have to match on title text, which changes with the amounts. **This is the
  cheapest change and the one most likely to half-work.**
- **August→October:** never re-appears — the dismissed August row blocks it
  permanently, which is wrong for period-scoped types.

---

## 6. Recommendation

**Option (a), fingerprint + UPSERT** — but it must be paired with the
cold-start fix, and the cold-start fix should land **first and separately**.

Reasoning:

- It is the only option that fixes **both** losses (dismissal *and* engagement
  analytics) with one mechanism.
- It gives the period-scoped types the right behaviour for free: a new period is
  a new fingerprint, so a dismissal does not mute a genuinely new situation.
- (c) is tempting and cheap, but without a fingerprint its dedupe has no stable
  thing to compare, and it makes dismissals permanent for exactly the types that
  should recur.

**Sequencing.** The cold-start defect is a one-line change with no schema
impact, and on its own it cuts regeneration frequency from *"most transactions"*
to *"the 1st of the month, plus manual"*. That alone converts the bug from
"happens constantly" to "happens monthly" and buys time to design the
fingerprint properly. Doing it second would waste that.

### Product questions to decide before implementation

1. **Should a dismissal expire?** If groceries are up 40% in August and again in
   October, must the user dismiss twice? My recommendation says yes (new period,
   new fingerprint) — confirm.
2. **`unusual_expense` is different.** It names one transaction. Should that
   dismissal be permanent, unlike the period types?
3. **What is `rule_version` for?** If a rule's arithmetic changes (as
   `recommendBudgetLimit` just did in HP-5), should previously dismissed
   insights of that type return, on the grounds that the number is now
   different?
4. **Is the existing analytics data worth anything?** It is currently reset
   constantly, so there is no history to migrate — a clean start is honest.

---

## 7. Test gap — why the suite is green while this ships

**2504 tests pass.** None of them asserts that a dismissal survives a
regeneration, because none of them runs the two operations in sequence.

| File | Missing assertion |
|---|---|
| `src/lib/services/__tests__/insightService.*.test.ts` | Dismiss a row, call `generateInsights()`, assert it is still dismissed. The delete is asserted only for "old insights are removed" — the test encodes the bug as intended behaviour. |
| `src/app/api/insights/[id]/dismiss/__tests__/` | Covers the write in isolation. Nothing covers durability, which is the only property a user experiences. |
| `insightService` trigger tests | `shouldTriggerGeneration` is never exercised with an **empty cache**, which is the production-normal state. A test asserting "returns false when nothing is known" would have failed immediately. |
| — (absent) | No test asserts the engagement columns survive regeneration. |

**The deeper reason** is the one this project has now hit repeatedly: the chain
mock. Per `src/test-utils/supabaseChain.ts`, a stub that ignores its arguments
lets a filter vanish while staying green — and here the *absence* of an
`is_dismissed` filter is precisely the defect. A test asserting
`expect(db.callsTo('insights','eq')).toContainEqual(['is_dismissed', false])`
would fail today and pass after the fix.

---

## DECISIONS — settled with Nikit 2026-08-12 (supersede §5/§6 where they differ)

Audit accepted. Three corrections to the recommended design, then the answers.

### C1 — the fingerprint is PER-TYPE, not one formula

§5(a) proposed one global formula, which contradicts §2: a period component on
`unusual_expense` would return the same flagged transaction next month. The
story defines this table:

| type | fingerprint |
|---|---|
| `unusual_expense` | `type + transaction_id` — **no period component** |
| `spending_increase` | `type + category_id + period` |
| `budget_recommendation` | `type + category_id + period` |
| `positive_reinforcement` | `type + category_id + period` |
| `spending_anomaly` | `type + category_id + period` — **see C2** |
| `new_high_spend_category` | `type + category_id + period` — **see C2** |

### C2 — "rolling" is not a period bucket (HIGHEST-RISK UNKNOWN)

§2 describes `spending_anomaly` and `new_high_spend_category` as rolling-window,
not month-aligned. A month bucket over a rolling window is arbitrary, and
arbitrary is how a fingerprint drifts and silently remints rows.

**hp-10 must read those two engines and state their bucket explicitly.** If a
rolling window genuinely has no stable bucket, propose something defensible —
anchor to the triggering transaction, or to the ISO week — rather than
defaulting to the month because the other four use it. Do not paper over it.

### C3 — `rule_version` stays OUT of the fingerprint (this answers Q3)

In the key, bumping a rule version resurrects every dismissal of that type as a
silent side effect of an unrelated change. HP-5 changed `recommendBudgetLimit`'s
arithmetic — under the original proposal that would have un-dismissed every
budget recommendation with nobody deciding it should.

Store it as a plain column for debugging and analytics; keep it out of the
UNIQUE key. Resurrection becomes an explicit migration when a rule change
warrants it. **Deliberate, not incidental.**

### Answers

- **Q1 — dismissal expires with the period: YES.** New period, new fingerprint.
  Dismissing August means "I have seen August", not "never mention groceries".
  The user dismisses twice and that is correct.
- **Q2 — `unusual_expense` is different: YES, permanent.** Anchored to
  `transaction_id` per C1. It never returns.
- **Q3 —** see C3.
- **Q4 — existing analytics data is worth nothing.** It has reset on roughly
  every transaction, so there is no history to migrate. Clean start, stated
  plainly rather than pretending to migrate. **Add one line to the Epic 12-8
  dashboard noting data before this fix is not comparable** — otherwise the step
  change reads as a change in user behaviour.

### Sequencing — two stories, cold-start first

**`hp-8` — cold-start fail-open. Ship alone, first.**

NOT the one-line `return false`: failing closed means a genuinely new user gets
nothing until the 1st or a manual refresh — trading a too-often bug for a never
bug. Derive the marker from the **database**: `MAX(created_at)` on the user's
insights rows. No migration needed (the data is already there), it survives cold
starts, and it is shared across instances — so the 10-transaction gate finally
does what Story 6.5 AC1 always claimed.

- `shouldTriggerGeneration()` counts transactions created since that timestamp.
- **No insights rows at all → genuinely never generated → generate.** Keeps
  new-user onboarding working, which the one-liner breaks.
- `isCacheValid()` may remain as a cheap in-process short-circuit but must not
  be the only guard. An empty Map means "I don't know", and "I don't know" must
  never authorise a destructive delete.
- Measure the extra query per transaction POST rather than assuming — it is
  indexed and off the response path, but measure.

**Test (fails today):** `shouldTriggerGeneration` with an empty cache and fewer
than 10 transactions since the last generation returns **FALSE**.

**`hp-10` — fingerprint + UPSERT.** After hp-8 merges. Option (a) with C1–C3
applied. Preserve `is_dismissed`, `dismissed_at` and all six engagement columns.
Migration adds the fingerprint column and `UNIQUE (user_id, fingerprint)`;
delete+insert becomes an upsert updating content columns only.

**Tests (both fail today):** dismiss → regenerate → still dismissed; set
`view_count` → regenerate → survived. Plus the §7 chain-mock assertion so a
vanishing filter cannot go green again.

*(`hp-9` is taken by the mobile-modal story, hence `hp-10`.)*

---

## Confidence and limits

| Finding | Confidence | Basis |
|---|---|---|
| Unfiltered delete destroys dismissals | **HIGH** | Source line + 14/14 production rows in 2 batches, 0 dismissed |
| Cold-start fail-open is the dominant trigger | **HIGH** | 1 txn in 24h vs a 10-txn gate; batch written 0.9s after a transaction |
| Monthly cron is *not* the cause | **HIGH** | Neither batch was created on the 1st |
| Engagement analytics also destroyed | **HIGH** | Columns are on `insights`; no FK indirection |
| `dismissed_at` is read | **HIGH** | `analytics/route.ts:170-172` |
| Fingerprint design specifics | **MEDIUM** | Depends on the product answers in §6 |

**Could not determine.** Vercel runtime logs returned empty for the last 24h and
timed out over 7d — Hobby-plan retention is too short to reconstruct firing
frequency. The database timestamps proved to be stronger evidence than the logs
would have been, so this did not block the audit. If per-invocation frequency is
ever needed, it has to be instrumented rather than recovered.
