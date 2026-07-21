-- Migration 040: Feature-disclosure backfill + atomic activity RPC (Story 15.7 review)
--
-- Two review fixes:
--   HIGH — user_feature_state has been dormant zeros since Epic 11, so making
--     the counter authoritative (15.7) hid heatmap/projections/subscriptions
--     from every ESTABLISHED user. Backfill the counters from real transaction
--     history AND pre-populate features_unlocked with already-earned keys so
--     established users get NO intro spam (pending = []). Re-run safe.
--   MED — recordFeatureActivity was a non-atomic read-modify-write (lost
--     increments under concurrent POSTs) and wrote last_active_date
--     unconditionally (could move BACKWARD → days_active double-count/farmable).
--     Replace with an atomic UPSERT-increment RPC: GREATEST() makes the date
--     forward-only, the CASE gates days_active, and the single statement is
--     race-free.
--
-- THRESHOLDS (30/14/50) are duplicated from src/lib/ai/disclosureCatalog.ts —
-- keep them in sync if the catalog changes.

-- 1) Atomic activity recorder. SECURITY INVOKER: runs as the authenticated
--    caller, so the owner-only RLS (011) is the gate and auth.uid() scopes the
--    write to the caller's own row. search_path pinned (038 hardening).
create or replace function public.record_feature_activity(p_today date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.user_feature_state (user_id, transactions_count, days_active, last_active_date)
  values (auth.uid(), 1, 1, p_today)
  on conflict (user_id) do update set
    transactions_count = user_feature_state.transactions_count + 1,
    days_active = user_feature_state.days_active
      + (case
           when user_feature_state.last_active_date is null
             or user_feature_state.last_active_date < p_today then 1
           else 0
         end),
    -- forward-only: a backdated log (resolveLogDay's ±1 clamp) must never move
    -- the marker back and re-open a "new day" for the same calendar day
    last_active_date = greatest(user_feature_state.last_active_date, p_today);
end;
$$;

revoke execute on function public.record_feature_activity(date) from public, anon;
grant execute on function public.record_feature_activity(date) to authenticated, service_role;

-- 2) Backfill from real transaction history. INSERT..ON CONFLICT so users who
--    lack a row (predate the signup insert) are seeded too. features_unlocked
--    merged (never lose an acknowledgment on a manual re-run).
insert into public.user_feature_state (user_id, transactions_count, days_active, last_active_date, features_unlocked)
select
  s.user_id, s.tx, s.days, s.last_date,
  (case when s.tx  >= 30 then array['heatmap']       else '{}'::text[] end
   || case when s.days >= 14 then array['projections']   else '{}'::text[] end
   || case when s.tx  >= 50 then array['subscriptions'] else '{}'::text[] end)
from (
  select user_id, count(*)::int as tx, count(distinct date)::int as days, max(date) as last_date
  from public.transactions
  group by user_id
) s
on conflict (user_id) do update set
  transactions_count = excluded.transactions_count,
  days_active = excluded.days_active,
  last_active_date = excluded.last_active_date,
  features_unlocked = coalesce(
    (select array_agg(distinct e)
     from unnest(user_feature_state.features_unlocked || excluded.features_unlocked) e),
    '{}'::text[]
  );
