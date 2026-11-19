-- =============================================================================
-- Account deletion that never destroys another member's data.
-- Spec: _bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md
--
-- TWO PRINCIPLES, which pull against each other; every step below names which
-- one decides:
--   P1  a member never loses their own data because someone else left
--   P2  a person who deletes their account leaves no personal data behind (FR38)
--
-- THE ORDERING RULE: every write in prepare_account_deletion is PREPARATORY -
-- valid whether or not the deletion follows. The server calls it first and
-- admin.deleteUser LAST, so a refused delete has destroyed nothing. (Before
-- this, the profile row was deleted first and a RESTRICT on
-- transactions.category_id could then refuse the auth delete half-way.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ONE definition of where a departing member's shared objects go.
--
-- Used by BOTH account deletion (below) and removeMember (householdMemberService),
-- which used to encode this rule separately and had drifted: it never moved
-- shared budgets, and a name collision made its category UPDATE fail silently.
-- The target is the household OWNER, households.created_by, read here and
-- nowhere else. (removeMember gave to the acting admin; the admin role is only
-- ever granted to the creator, so that was the same row - this states it once.)
-- P1: household-scoped objects follow the household.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reassign_member_shared_objects(p_household UUID, p_member UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_cat RECORD;
  v_name TEXT;
  v_n INTEGER;
  v_moved INTEGER := 0;
  v_count INTEGER;
BEGIN
  SELECT created_by INTO v_owner FROM public.households WHERE id = p_household;
  -- No household, or the member IS the owner (ownership must be transferred
  -- before calling this): nothing to move.
  IF v_owner IS NULL OR v_owner = p_member THEN
    RETURN 0;
  END IF;

  -- Shared categories. categories is UNIQUE(user_id, name, type), so a name the
  -- owner already uses gets a LANGUAGE-NEUTRAL numeric suffix ("Name 2") - never
  -- a translated word frozen into stored data. Base truncated to fit VARCHAR(100).
  FOR v_cat IN
    SELECT id, name, type FROM public.categories
     WHERE user_id = p_member AND household_id = p_household
     ORDER BY created_at, id
     FOR UPDATE
  LOOP
    v_name := v_cat.name;
    v_n := 1;
    WHILE EXISTS (
      SELECT 1 FROM public.categories
       WHERE user_id = v_owner AND name = v_name AND type = v_cat.type
    ) LOOP
      v_n := v_n + 1;
      v_name := left(v_cat.name, 100 - length(' ' || v_n)) || ' ' || v_n;
    END LOOP;
    UPDATE public.categories SET user_id = v_owner, name = v_name WHERE id = v_cat.id;
    v_moved := v_moved + 1;
  END LOOP;

  -- Shared budgets: the personal-budget unique index is WHERE household_id IS
  -- NULL, so shared budgets cannot collide.
  UPDATE public.category_budgets SET user_id = v_owner
   WHERE user_id = p_member AND household_id = p_household;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_moved := v_moved + v_count;

  UPDATE public.goals SET user_id = v_owner, updated_at = now()
   WHERE user_id = p_member AND household_id = p_household;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_moved := v_moved + v_count;

  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION public.reassign_member_shared_objects(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reassign_member_shared_objects(UUID, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_member_shared_objects(UUID, UUID) TO service_role;
COMMENT ON FUNCTION public.reassign_member_shared_objects(UUID, UUID) IS
  'The single definition of where a departing member''s shared categories/budgets/goals go (the household owner). Used by account deletion and removeMember. service_role only.';

-- -----------------------------------------------------------------------------
-- 2. The preparatory half of account deletion. Nothing here is destructive.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_account_deletion(p_user UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household UUID;
  v_new_owner UUID;
  v_transferred BOOLEAN := false;
  v_moved INTEGER := 0;
  v_copied INTEGER := 0;
  v_repointed INTEGER := 0;
  v_count INTEGER;
  v_target UUID;
  r RECORD;
BEGIN
  -- (a) OWNERSHIP + (b) SHARED OBJECTS, per household the user belongs to.
  -- One household per user is enforced in the service; looping is defensive.
  FOR v_household IN
    SELECT household_id FROM public.household_members WHERE user_id = p_user
  LOOP
    PERFORM 1 FROM public.households WHERE id = v_household FOR UPDATE;

    IF EXISTS (SELECT 1 FROM public.households WHERE id = v_household AND created_by = p_user) THEN
      -- P1: the household continues under the longest-standing remaining member.
      SELECT user_id INTO v_new_owner
        FROM public.household_members
       WHERE household_id = v_household AND user_id <> p_user
       ORDER BY joined_at ASC NULLS LAST, user_id ASC
       LIMIT 1;

      IF v_new_owner IS NOT NULL THEN
        UPDATE public.households SET created_by = v_new_owner, updated_at = now()
         WHERE id = v_household;
        UPDATE public.household_members SET role = 'admin'
         WHERE household_id = v_household AND user_id = v_new_owner;
        -- Keep "the admin IS the owner" true even if the auth delete is then
        -- refused: without this a failed deletion leaves a two-admin household,
        -- and "the admin" and created_by could name different people.
        UPDATE public.household_members SET role = 'member'
         WHERE household_id = v_household AND user_id = p_user;
        v_transferred := true;
      END IF;
      -- Sole member: nothing to transfer. The auth.users cascade deletes the
      -- household, as before (P2).
    END IF;

    -- Creator (now a member of a household owned by someone else) or plain
    -- member alike: their shared objects go to the owner. Returns 0 for a sole
    -- member, who is still the owner.
    v_moved := v_moved + public.reassign_member_shared_objects(v_household, p_user);
  END LOOP;

  -- (c) P1 for categories: every category the user STILL owns that another
  -- user's row references is copied to that user - or that user's existing
  -- same name+type category is reused (same user, type and name IS the same
  -- category for them) - and their rows repointed. Without this the auth.users
  -- cascade either deletes those rows (category_budgets, value_categories),
  -- detaches them (wishlist_items), or is REFUSED by transactions.category_id
  -- ON DELETE RESTRICT.
  FOR r IN
    SELECT DISTINCT c.id AS cat_id, ref.user_id AS other_user,
           c.name, c.type, c.color, c.visibility_level
      FROM public.categories c
      JOIN (
        SELECT user_id, category_id FROM public.transactions WHERE user_id <> p_user
        UNION
        SELECT user_id, category_id FROM public.category_budgets WHERE user_id <> p_user
        UNION
        SELECT user_id, category_id FROM public.value_categories WHERE user_id <> p_user
        UNION
        SELECT user_id, category_id FROM public.wishlist_items
         WHERE user_id <> p_user AND category_id IS NOT NULL
      ) ref ON ref.category_id = c.id
     WHERE c.user_id = p_user
  LOOP
    SELECT id INTO v_target FROM public.categories
     WHERE user_id = r.other_user AND name = r.name AND type = r.type;
    IF v_target IS NULL THEN
      INSERT INTO public.categories (user_id, name, color, type, is_predefined, household_id, visibility_level)
      VALUES (r.other_user, r.name, r.color, r.type, false, NULL, r.visibility_level)
      RETURNING id INTO v_target;
      v_copied := v_copied + 1;
    END IF;

    UPDATE public.transactions SET category_id = v_target
     WHERE user_id = r.other_user AND category_id = r.cat_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_repointed := v_repointed + v_count;

    -- A personal budget for the same period on the target already exists ->
    -- leave this one; the user keeps an equivalent budget, and the duplicate
    -- goes with the deleted category.
    UPDATE public.category_budgets b SET category_id = v_target
     WHERE b.user_id = r.other_user AND b.category_id = r.cat_id
       AND NOT (b.household_id IS NULL AND EXISTS (
         SELECT 1 FROM public.category_budgets x
          WHERE x.user_id = r.other_user AND x.household_id IS NULL
            AND x.category_id = v_target AND x.period = b.period));
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_repointed := v_repointed + v_count;

    -- value_categories is UNIQUE(value_id, category_id): skip a mapping that
    -- already exists on the target (it is the same mapping).
    UPDATE public.value_categories v SET category_id = v_target
     WHERE v.user_id = r.other_user AND v.category_id = r.cat_id
       AND NOT EXISTS (
         SELECT 1 FROM public.value_categories x
          WHERE x.value_id = v.value_id AND x.category_id = v_target);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_repointed := v_repointed + v_count;

    UPDATE public.wishlist_items SET category_id = v_target
     WHERE user_id = r.other_user AND category_id = r.cat_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_repointed := v_repointed + v_count;
  END LOOP;

  RETURN jsonb_build_object(
    'ownership_transferred', v_transferred,
    'shared_objects_moved', v_moved,
    'categories_copied', v_copied,
    'rows_repointed', v_repointed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_account_deletion(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion(UUID) TO service_role;
COMMENT ON FUNCTION public.prepare_account_deletion(UUID) IS
  'Preparatory half of account deletion: transfers household ownership, moves shared objects, copies member-referenced categories. Non-destructive by design; call before admin.deleteUser. service_role only.';

-- -----------------------------------------------------------------------------
-- 3. Shared-goal totals stay equal to their contributions.
--
-- goals.current_amount for a SHARED goal is defined as SUM(goal_contributions)
-- (householdGoalService recomputes it on every contribution, and goals are
-- shared only at creation). Contribution rows are deleted by the SCHEMA, not by
-- app code - goal_contributions.goal_id and .user_id are both ON DELETE CASCADE
-- (013_goals.sql) - so this fires on three paths:
--   1. ANY user deletes their account, plain member or creator: their
--      contributions cascade. Before this, a shared goal stayed overstated by
--      money with no row behind it. This is a FIX outside the creator path.
--   2. A goal is deleted: its contributions cascade; the goal is already gone,
--      so the UPDATE matches nothing.
--   3. The creator case.
-- SHARED GOALS ONLY: that is where the invariant is established. Recomputing a
-- personal goal could only "correct" a number never proved equal to its rows.
-- Statement-level with a transition table: one UPDATE per deleting statement
-- over the distinct goal ids, not a SUM per row.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_shared_goal_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.goals g
     SET current_amount = COALESCE(
           (SELECT SUM(gc.amount) FROM public.goal_contributions gc WHERE gc.goal_id = g.id), 0),
         updated_at = now()
   WHERE g.id IN (SELECT DISTINCT goal_id FROM deleted_contributions)
     AND g.household_id IS NOT NULL;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_shared_goal_totals() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_shared_goal_totals() FROM anon, authenticated;

DROP TRIGGER IF EXISTS goal_contributions_recompute_shared_total ON public.goal_contributions;
CREATE TRIGGER goal_contributions_recompute_shared_total
  AFTER DELETE ON public.goal_contributions
  REFERENCING OLD TABLE AS deleted_contributions
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.recompute_shared_goal_totals();

-- -----------------------------------------------------------------------------
-- 4. households.created_by is the OWNER, and only the server may change it.
--
-- Before this migration created_by decided one thing: the cascade when its user
-- is deleted. Now it decides who receives a departing member's shared objects
-- (reassign_member_shared_objects, above) and who owns the household after its
-- creator leaves. The households UPDATE policy lets an admin write ANY column
-- through PostgREST, so an admin could point created_by at another member or an
-- outsider and break "the admin is the owner" - which both functions above rely
-- on. household_members.role is already server-only (SELECT is its only policy);
-- this makes the other half of the invariant server-only too.
--
-- Same shape as enforce_category_visibility_owner (023 / 20260924100000):
-- service-role writes run with auth.uid() NULL and pass; nothing in the app
-- updates households through a user client (checked 2026-11-19).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_household_owner_server_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'households.created_by can only be changed by the server';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_household_owner_server_only ON public.households;
CREATE TRIGGER trg_household_owner_server_only
  BEFORE UPDATE ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_household_owner_server_only();

-- -----------------------------------------------------------------------------
-- 5. P2 for the EMAIL: invitations ADDRESSED to the person go with the account.
--
-- household_invitations.email is personal data that never contains the user id,
-- so no FK reaches it: before this, an invitation the person had accepted kept
-- their address (accepted_by merely went NULL) and stayed in the admin's
-- invitation list (listInvitations returns every status), and pending or revoked
-- invitations addressed to them stayed in other households.
--
-- DELETED, not anonymised: with accepted_by already NULL an anonymised row
-- carries nothing but an invented placeholder address. Invitations the person
-- SENT are other households' records and stay (invited_by goes NULL, as before).
--
-- A BEFORE DELETE trigger on auth.users, not a step in prepare_account_deletion:
--   - it runs INSIDE the auth delete's transaction, so a refused delete rolls it
--     back with everything else. Done in the preparation it would be destructive
--     before the destructive step, which that function must never be;
--   - BEFORE, because accepted_by still holds the id; the SET NULL action on
--     household_invitations.accepted_by runs after the row is gone;
--   - it covers every way an auth user is deleted, not only the app's path.
-- Precedent: on_auth_user_created (handle_new_user) is an app trigger on
-- auth.users; postgres holds TRIGGER on auth.users locally and in production
-- (checked read-only 2026-11-19). SECURITY DEFINER because the role GoTrue deletes
-- as has no rights on public tables.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_invitations_addressed_to_deleted_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.household_invitations
   WHERE accepted_by = OLD.id
      OR (OLD.email IS NOT NULL AND lower(email) = lower(OLD.email));
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_invitations_addressed_to_deleted_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_invitations_addressed_to_deleted_user() FROM anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_deleted_remove_invitations ON auth.users;
CREATE TRIGGER on_auth_user_deleted_remove_invitations
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_invitations_addressed_to_deleted_user();
