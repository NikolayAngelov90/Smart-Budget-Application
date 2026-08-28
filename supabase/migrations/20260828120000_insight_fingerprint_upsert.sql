-- hp-10 — fingerprint + UPSERT, so a dismissal survives regeneration
--
-- THE DEFECT, observed rather than inferred. On 2026-08-28 the production data
-- showed one account with 12 insight rows sharing a SINGLE created_at to the
-- microsecond and ZERO dismissed, and a second account whose 6 dismissed rows
-- went to 0 in one regeneration. Reproduced end to end on the QA account: same
-- transaction, new row id, is_dismissed true -> false. Generation deletes every
-- row for the user and reinserts, so a dismissal lives exactly as long as the
-- next generation.
--
-- WHAT REPLACES THE DELETE
--
--   fingerprint  a stable identity for the CLAIM an insight makes, so the same
--                claim updates its row instead of minting a new one.
--   updated_at   when the row was last WRITTEN (insert or upsert).
--   sweep        the orchestrator deletes rows not produced by a successful run,
--                except dismissed ones. Delete-and-reinsert had exactly one
--                virtue — it garbage-collected — and UPSERT alone would leave a
--                stale "groceries up 40%" card on the dashboard forever.
--
-- WHY updated_at EXISTS AND created_at DOES NOT SUFFICE
--
-- The sweep must not delete rows a CONCURRENT run is still writing — the cron at
-- 00:00 on the 1st and a transaction trigger seconds earlier compute different
-- month buckets. Restricting the sweep to rows with `updated_at < run_started_at`
-- means a run only removes what existed before it began. created_at cannot do
-- this: after an upsert it still records the FIRST write, not the latest.
--
-- NO BACKFILL. DELIBERATE, NOT AN OMISSION.
--
-- UNIQUE (user_id, fingerprint) needs every existing row to have one, and for
-- the period-scoped types there is no honest source. The only timestamp on the
-- row is created_at, which is GENERATION time, not the analysis period. They
-- coincide today ONLY because the bug regenerates constantly, so every row was
-- written in the month it describes. A backfill from created_at would look
-- correct, pass its own tests, and encode the exact conflation this story
-- removes — the same trap as deriving hp-8's marker from MAX(created_at).
--
-- So existing rows are DELETED and the next run repopulates with real
-- fingerprints. Consistent with the settled Q4 answer: the engagement data has
-- been resetting constantly, there is no history to preserve. Two consequences,
-- noted rather than discovered: current dismissals go with them (they were being
-- destroyed on every regeneration anyway, so this costs nothing real), and the
-- €700 acceptance case restarts from a clean slate, which makes the post-deploy
-- verification measure the new mechanism rather than a mixture.

-- THE DEPLOY WINDOW, DECIDED RATHER THAN DISCOVERED.
--
-- hp-8 guarded NEW code meeting an OLD schema. This migration has the same race
-- running the OTHER way: if it lands before the Vercel deploy, the still-running
-- OLD code does `delete` + `insert` against a schema that now requires a
-- fingerprint it cannot compute, and every insert fails with 23502 — the same
-- not_null_violation the RLS suite asserts for a fingerprint-less row.
--
-- Blast radius, each point checked in the code rather than assumed:
--
--   transaction POST   SURVIVES. checkAndTriggerForTransactionCount is fired
--                      with .catch() (transactions/route.ts:403) and catches
--                      internally, so the user's transaction saves normally.
--   manual refresh     500s. POST /api/insights/generate propagates the throw to
--                      its catch and returns 500 for the length of the window.
--   the cron           INVOKED daily ("0 0 * * *"), but it NO-OPS except on the
--                      1st: route.ts:64-74 returns { skipped: true } before the
--                      user query and before any generateInsights call, so on
--                      any other day it touches no insight row and cannot reach
--                      an insert. In play ONLY if a deploy window spans 00:00
--                      UTC on the 1st — and if it does, the per-user try/catch
--                      at lines 119-131 contains it: each user logs and the run
--                      completes, no cascade.
--
--                      (Both halves of that matter. "Daily schedule" is true and
--                      "the cron is in play" does not follow from it — the same
--                      shape as a column-level REVOKE being valid SQL that a
--                      table-level grant makes a no-op.)
--   the READ path      DOES NOT THROW. GET /api/insights is a plain SELECT: it
--                      returns 200 with an empty list, and the dashboard renders
--                      its empty state (AIBudgetCoach.tsx:134). This is the point
--                      that decides the whole question — nothing user-facing
--                      errors on a page load.
--
-- So the window is a few minutes of "insights are empty and a manual refresh
-- errors", self-healing on the first generation after the deploy lands. The rows
-- are being deleted here anyway, so empty IS the intended transient state, not
-- corruption.
--
-- ACCEPTED EXPLICITLY, with no defensive branch. A second 42703-style escape
-- hatch would outlive its reason exactly as hp-8's does — that one is already
-- filed for removal, and adding another would be inconsistent with the argument
-- that filed it.
--
-- IF YOU SEE 23502 ON insights IN THE LOGS DURING A DEPLOY: do nothing. Wait for
-- the deploy to finish. It resolves itself on the next generation.

DELETE FROM public.insights;

ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN public.insights.fingerprint IS
  'Stable identity of the CLAIM this insight makes, so regeneration updates the '
  'row instead of minting a new one and destroying the dismissal. Per-type: '
  'unusual_expense keys on transaction_id alone (dismissing "I know about this '
  'purchase", not "I know about this number"); the period-scoped types key on '
  'type + category_id + the YYYY-MM they describe. Never includes rule_version — '
  'a wording change must not resurrect a dismissal.';

COMMENT ON COLUMN public.insights.updated_at IS
  'When this row was last written (insert or upsert). The sweep only removes '
  'rows older than the current run, so a concurrent run cannot delete rows this '
  'one is still writing.';

-- THE CONFLICT TARGET. TOTAL, NOT PARTIAL — and that is a correctness
-- requirement, not a preference.
--
-- Postgres will not infer a PARTIAL index from a bare
-- `ON CONFLICT (user_id, fingerprint)`: the statement's inference clause must
-- itself carry a WHERE implying the index predicate, and PostgREST's
-- `.upsert({ onConflict: 'user_id,fingerprint' })` emits none. A partial index
-- would therefore raise 42P10 — "no unique or exclusion constraint matching the
-- ON CONFLICT specification" — on the FIRST real generation, while every
-- mock-based test stayed green because a chain mock accepts any onConflict
-- string.
--
-- Making the column NOT NULL is what allows the index to be total, and it is
-- honest: there is no backfill, and all six insight types have a fingerprint
-- function, so no row can legitimately lack one. It also states hp-10's
-- premise — every insight has a stable identity — in the schema rather than by
-- convention.
ALTER TABLE public.insights
  ALTER COLUMN fingerprint SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS insights_user_fingerprint_key
  ON public.insights (user_id, fingerprint);

-- THE updated_at TRIGGER. Without it this whole design fails silently.
--
-- `DEFAULT NOW()` applies on INSERT ONLY. Every upsert of an EXISTING row is an
-- UPDATE, so without a trigger `updated_at` never advances, every previously
-- existing insight keeps a timestamp at or below the sweep watermark, and the
-- sweep deletes all of them on every run — the original bug restored with extra
-- steps.
--
-- The alternative, having the application write `updated_at`, reintroduces the
-- exact dependency the watermark exists to remove: the value would carry the APP
-- SERVER's clock while the watermark carries the DATABASE's, and a lambda whose
-- clock runs behind Postgres would write rows the sweep immediately deletes. The
-- trigger sets NOW() on the database, so both sides of the comparison come from
-- one clock and the skew cannot occur.
--
-- SCHEMA-QUALIFIED deliberately: `update_updated_at_column` exists in BOTH
-- `public` and `storage` on this project (verified in pg_proc), so an
-- unqualified reference is ambiguous under a different search_path.
--
-- NO `WHEN (OLD.* IS DISTINCT FROM NEW.*)` GUARD. That is the normal
-- optimisation and here it would be fatal: an insight whose content is unchanged
-- between runs is the COMMON case, the trigger would not fire, its timestamp
-- would stay below the watermark, and the sweep would delete precisely the
-- stable insights that should persist.
CREATE TRIGGER update_insights_updated_at
  BEFORE UPDATE ON public.insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- The sweep filters on (user_id, updated_at) and reads is_dismissed.
CREATE INDEX IF NOT EXISTS idx_insights_user_updated_at
  ON public.insights (user_id, updated_at);

-- Same lesson as hp-8, applied without being taught twice: a TABLE-level grant
-- covers columns added LATER, so `fingerprint` and `updated_at` would be
-- user-writable the moment they exist. A forged fingerprint is worse here than
-- a forged marker was: it would let a user collide their row with another
-- claim's identity, or detach it from the upsert entirely so it is never
-- refreshed and never swept.
--
-- THE RE-GRANT IS `is_dismissed, dismissed_at`, NOT `is_dismissed` ALONE.
-- Checked rather than assumed, because hp-8's first attempt shipped a control
-- that did nothing and this one would have broken dismissal outright: the
-- dismiss route writes BOTH columns with the USER client
-- (api/insights/[id]/dismiss/route.ts:45-47), relying on RLS plus an explicit
-- user_id check. Granting only is_dismissed would 42501 every dismissal — the
-- "narrowed too far" failure, which no negative assertion would have caught.
--
-- The route is deliberately left on the user client rather than moved to the
-- service role: service-role would bypass RLS on a user-initiated write, which
-- is a worse trade than letting a user set their own dismissed_at (an analytics
-- timestamp the route sets server-side anyway).
--
-- The six engagement columns (view_count, first_viewed_at, last_viewed_at,
-- metadata_expanded_count, last_metadata_expanded_at, dismissed_at) are READ by
-- api/insights/analytics but written by nothing today, so they need no grant
-- beyond dismissed_at.
REVOKE UPDATE ON public.insights FROM authenticated;
REVOKE UPDATE ON public.insights FROM anon;
GRANT UPDATE (is_dismissed, dismissed_at) ON public.insights TO authenticated;
