-- Migration 041: atomic single-key preference writes (DW-2)
--
-- `user_profiles.preferences` is one JSONB column, and every preference write
-- went through a read-modify-write in application code: SELECT the current
-- object, spread the incoming partial over it in JS, UPDATE the whole thing.
--
-- Two overlapping writes therefore lose one of the changes:
--
--   1. PUT A reads {digest: true, push: true}
--   2. PUT B reads {digest: true, push: true}   -- same starting point
--   3. PUT A writes {digest: false, push: true}
--   4. PUT B writes {digest: true,  push: false} -- resurrects digest: true
--
-- The user sees a toggle flip back on by itself. Logged three times (8.3, 15.5,
-- 15.6), and Story 16-8 put the digest and all five push toggles in the SAME
-- settings section, so adjacent flips became the normal interaction rather than
-- an edge case.
--
-- `||` on jsonb is a shallow merge, evaluated inside the UPDATE. There is no
-- SELECT, so there is no window for a second writer to interleave. Shallow is
-- correct here: every preference is a scalar at the top level. If a nested
-- object is ever added, revisit — shallow merge would replace it wholesale.

CREATE OR REPLACE FUNCTION public.patch_user_preferences(p_patch jsonb)
RETURNS public.user_profiles
LANGUAGE plpgsql
-- INVOKER so the caller's RLS policies still apply; the WHERE below is a second
-- layer, not the only one.
SECURITY INVOKER
-- Pinned per the 038 hardening convention.
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.user_profiles;
BEGIN
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'patch_user_preferences: p_patch must be a JSON object';
  END IF;

  UPDATE public.user_profiles
  SET preferences = COALESCE(preferences, '{}'::jsonb) || p_patch
  -- initplan form, per the 035 RLS baseline.
  WHERE id = (SELECT auth.uid())
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'patch_user_preferences: no profile for the current user';
  END IF;

  RETURN v_profile;
END;
$$;

COMMENT ON FUNCTION public.patch_user_preferences(jsonb) IS
  'DW-2: merges a partial preferences object atomically. Replaces an application-side read-modify-write that let two quick toggle flips resurrect each other''s previous values.';

-- Default EXECUTE is granted to PUBLIC, and grants are ADDITIVE — revoke first.
REVOKE ALL ON FUNCTION public.patch_user_preferences(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.patch_user_preferences(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.patch_user_preferences(jsonb) TO authenticated;
