-- =============================================================================
-- Names in any script: the database refuses what is NEVER allowed in a name.
-- Spec: _bmad-output/implementation-artifacts/spec-cyrillic-names.md
--
-- The app's one name rule (src/lib/validation/names.ts) allows letters of any
-- script, combining marks, digits, the space and & - ' . , ( ) /, and stores a
-- name NFC-normalised, trimmed, with runs of spaces collapsed. The database
-- enforces the half that must never be stored, whoever writes: control and
-- zero-width/format characters, untrimmed or doubled spaces, non-NFC text.
-- (Postgres regexes have no \p{L} / \p{M}, so the allowed set itself stays in
-- the app.) One function, used by the CHECK on every name column; an RLS test
-- generates the JS sets (\p{Cc}, \p{Cf}, what trim() removes) and checks every
-- code point against it.
--
-- RELEASE ORDER: APP FIRST, then this migration. Unlike #108-#110 it CONSTRAINS
-- writes, and the app deployed before this story can produce values it refuses
-- (a tab inside a category name, doubled spaces, an untrimmed display name). The
-- new app normalises and validates before every write and needs nothing from
-- here. Every existing value is re-measured against this exact rule right before
-- the apply. 20261125100000 is FROZEN; its move function is REPLACED below with
-- one line changed.
-- =============================================================================

-- ALTER TABLE ... ADD CONSTRAINT takes ACCESS EXCLUSIVE on each table while it
-- validates the existing rows (tiny tables). If a lock is not free within 500 ms
-- the apply fails cleanly and can be run again. RESET at the end.
SET lock_timeout = '500ms';

-- -----------------------------------------------------------------------------
-- 1. The never-allowed half, as one function.
--    STRICT: NULL in, NULL out, so a CHECK passes a NULL display name (cleared).
--    The never-allowed half: empty, untrimmed, doubled spaces, non-NFC, and any
--    control, format, default-ignorable (invisible) or line-separator character.
--    IMMUTABLE and with an empty search_path: it reads nothing but its argument.
--    The character sets are written out, not taken from [[:cntrl:]] / [[:space:]],
--    whose meaning depends on the collation's ctype; the RLS test pins them to
--    JavaScript's own classes.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_clean_name(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT p_name <> ''
     -- trimmed: no white space at either end (the set JavaScript's trim() removes)
     AND p_name !~ '^[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]'
     AND p_name !~ '[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]$'
     -- runs of spaces collapsed
     AND position('  ' IN p_name) = 0
     -- one form for one name ("й" composed, never и + breve)
     AND p_name IS NFC NORMALIZED
     -- control (Cc), format (Cf) and other invisible (Default_Ignorable_Code_Point)
     -- characters, and line/paragraph separators (Zl, Zp): generated from
     -- JavaScript's own classes (Node 22, Unicode 16.0); the RLS test re-derives
     -- the set at run time and checks every code point against this list.
     AND p_name !~ '[\u0001-\u001F\u007F-\u009F\u00AD\u034F\u0600-\u0605\u061C\u06DD\u070F\u0890-\u0891\u08E2\u115F-\u1160\u17B4-\u17B5\u180B-\u180F\u200B-\u200F\u2028-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFFB\U000110BD\U000110CD\U00013430-\U0001343F\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0000-\U000E0FFF]'
$$;

REVOKE ALL ON FUNCTION public.is_clean_name(TEXT) FROM PUBLIC, anon;
-- The CHECKs run as whoever writes: the signed-in user (through RLS) or the server.
GRANT EXECUTE ON FUNCTION public.is_clean_name(TEXT) TO authenticated, service_role;
COMMENT ON FUNCTION public.is_clean_name(TEXT) IS
  'The never-allowed half of the name rule (spec-cyrillic-names): non-empty, trimmed, no doubled spaces, NFC, no control (Cc) or format (Cf) characters. Used by the CHECK on every name column; the allowed set lives in src/lib/validation/names.ts.';

-- -----------------------------------------------------------------------------
-- 2. Every name column refuses it. Existing values were measured clean, and are
--    re-measured right before the apply. Display names alone are tidied first:
--    the settings form used to store exactly what was typed (an emptied field as
--    '', stray spaces), and tidying one is lossless - an empty name becomes NULL
--    (no name), and NFC, trimming and collapsing spaces change nothing visible.
--    Other names are never changed by a migration: a refusal there stops the
--    apply, cleanly, for a person to look at.
-- -----------------------------------------------------------------------------
UPDATE public.user_profiles
   SET display_name = nullif(regexp_replace(btrim(normalize(display_name, NFC)), ' {2,}', ' ', 'g'), '')
 WHERE display_name IS NOT NULL
   AND display_name IS DISTINCT FROM
       nullif(regexp_replace(btrim(normalize(display_name, NFC)), ' {2,}', ' ', 'g'), '');

ALTER TABLE public.categories
  ADD CONSTRAINT categories_name_clean CHECK (public.is_clean_name(name));
ALTER TABLE public.goals
  ADD CONSTRAINT goals_name_clean CHECK (public.is_clean_name(name));
ALTER TABLE public.households
  ADD CONSTRAINT households_name_clean CHECK (public.is_clean_name(name));
ALTER TABLE public.wishlist_items
  ADD CONSTRAINT wishlist_items_name_clean CHECK (public.is_clean_name(name));
ALTER TABLE public.user_values
  ADD CONSTRAINT user_values_name_clean CHECK (public.is_clean_name(name));
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_display_name_clean CHECK (public.is_clean_name(display_name));

-- -----------------------------------------------------------------------------
-- 3. The one database writer that MAKES a name: the shared-category rename in
--    account deletion and member removal ("Name 2"). Its cut could end just
--    after a space and leave a doubled space, which the CHECK above would refuse
--    inside a deletion's or a removal's critical path. Replaced with that line
--    changed (rtrim); the rest is 20261125100000's definition, unchanged.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.move_member_shared_objects(
  p_household UUID,
  p_member UUID,
  p_cause TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_household_name TEXT;
  v_departing UUID := CASE WHEN p_cause = 'account_deleted' THEN p_member END;
  v_cat RECORD;
  v_name TEXT;
  v_n INTEGER;
  v_moved INTEGER := 0;
  v_budgets INTEGER := 0;
  v_goals INTEGER := 0;
  v_renamed_from TEXT[] := '{}';
  v_renamed_to TEXT[] := '{}';
  v_i INTEGER;
  v_kind TEXT;
  v_state TEXT;
  v_message TEXT;
BEGIN
  SELECT created_by, name INTO v_owner, v_household_name
    FROM public.households WHERE id = p_household;
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
      -- rtrim (spec-cyrillic-names): a cut just after a space would otherwise
      -- leave a DOUBLED space before the suffix, which public.is_clean_name refuses.
      v_name := rtrim(left(v_cat.name, 100 - length(' ' || v_n)), ' ') || ' ' || v_n;
    END LOOP;
    UPDATE public.categories SET user_id = v_owner, name = v_name WHERE id = v_cat.id;
    v_moved := v_moved + 1;

    -- A renamed category is the surprise worth a notice; an unrenamed one keeps
    -- the name the owner already saw. Remembered here, told below.
    IF v_name <> v_cat.name THEN
      v_renamed_from := v_renamed_from || v_cat.name::text;
      v_renamed_to := v_renamed_to || v_name;
    END IF;
  END LOOP;

  -- Shared budgets: the personal-budget unique index is WHERE household_id IS
  -- NULL, so shared budgets cannot collide.
  UPDATE public.category_budgets SET user_id = v_owner
   WHERE user_id = p_member AND household_id = p_household;
  GET DIAGNOSTICS v_budgets = ROW_COUNT;

  UPDATE public.goals SET user_id = v_owner, updated_at = now()
   WHERE user_id = p_member AND household_id = p_household;
  GET DIAGNOSTICS v_goals = ROW_COUNT;

  v_moved := v_moved + v_budgets + v_goals;

  -- The owner's notices, OFF THE CRITICAL PATH: a failure here - even the writer
  -- missing - rolls back these notices alone and is recorded (section 3).
  IF p_cause IS NOT NULL THEN
    BEGIN
      v_kind := 'category_renamed';
      FOR v_i IN 1 .. coalesce(array_length(v_renamed_from, 1), 0) LOOP
        PERFORM private.record_account_notice(
          v_owner, 'category_renamed', p_cause, p_household,
          jsonb_build_object('household', v_household_name,
                             'from', v_renamed_from[v_i], 'to', v_renamed_to[v_i]),
          v_departing
        );
      END LOOP;

      v_kind := 'shared_plans_received';
      IF v_budgets + v_goals > 0 THEN
        PERFORM private.record_account_notice(
          v_owner, 'shared_plans_received', p_cause, p_household,
          jsonb_build_object('household', v_household_name, 'goals', v_goals, 'budgets', v_budgets),
          v_departing
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_state := SQLSTATE;
      v_message := SQLERRM;
      BEGIN
        INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
        VALUES (CASE WHEN v_departing IS NULL THEN 'write' ELSE 'stage' END, v_kind, v_state);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
      END;
      RAISE WARNING 'owner notices not recorded (kind %): % (%)', v_kind, v_message, v_state;
    END;
  END IF;

  RETURN v_moved;
END;
$$;

RESET lock_timeout;
