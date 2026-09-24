-- ONE FILE, RUN AGAINST BOTH DATABASES. That is the point: the production
-- catalog and the migration-built catalog must be read by IDENTICAL queries, or
-- the comparison can report a difference that exists only in how it looked.
-- (An earlier hand comparison of two function bodies did exactly that — one side
-- stripped leading whitespace and the other did not, and both functions came out
-- "different" by exactly 2 characters.)
--
-- pg_catalog ONLY, NEVER information_schema. The production side connects as the
-- grantless `schema_reader` role, and information_schema views are
-- PRIVILEGE-FILTERED — `columns`, `table_privileges` and `column_privileges` all
-- carry a pg_has_role/has_*_privilege predicate, so a role with no grants sees
-- NOTHING through them and the dump would be silently empty. pg_catalog tables
-- carry PUBLIC SELECT (pg_class's ACL includes `=r/supabase_admin`), so a
-- grantless role reads all of this and not one row of user data.
--
-- Output is TSV, one record per line, first column is the record kind. Ordering is
-- deterministic so the two dumps are directly comparable.

\pset tuples_only on
\pset format unaligned
\pset fieldsep '\t'
\pset footer off

-- ---------------------------------------------------------------- TABLES
SELECT 'TABLE', c.relname
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- ---------------------------------------------------------------- COLUMNS
-- name, type, notnull and default. Nullability and default both matter: the
-- missing detected_subscriptions.currency was NOT NULL DEFAULT 'EUR', and a
-- column that matched on name and type but not on those would still break writes.
SELECT 'COLUMN',
       c.relname || '.' || a.attname,
       format_type(a.atttypid, a.atttypmod),
       a.attnotnull::text,
       coalesce(pg_get_expr(ad.adbin, ad.adrelid), '-')
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attname;

-- ---------------------------------------------------------------- RLS STATE
-- Whether RLS is enabled at all. A table with perfect policies and RLS switched
-- off has no protection, and the policy list alone cannot show that.
SELECT 'RLS', c.relname, c.relrowsecurity::text, c.relforcerowsecurity::text
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- ---------------------------------------------------------------- POLICIES
-- Built from pg_policy directly rather than the pg_policies view, so the shape
-- cannot change under us with a Postgres version bump.
SELECT 'POLICY',
       c.relname,
       p.polname,
       CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                     WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                     ELSE 'ALL' END,
       coalesce((SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
                 FROM pg_catalog.pg_roles r WHERE r.oid = ANY (p.polroles)), 'PUBLIC'),
       regexp_replace(coalesce(pg_get_expr(p.polqual, p.polrelid), 'NULL'), '\s+', ' ', 'g'),
       regexp_replace(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), 'NULL'), '\s+', ' ', 'g')
FROM pg_catalog.pg_policy p
JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, p.polname, p.polcmd;

-- ---------------------------------------------------------------- TABLE GRANTS
-- NULL relacl means DEFAULT privileges apply, and aclexplode over NULL returns
-- NOTHING — so "no rows" would read as "no grants" when it can mean the opposite.
-- A NULL is therefore emitted EXPLICITLY as its own record rather than as silence.
SELECT 'TGRANT-DEFAULT', c.relname, '(relacl is NULL — default privileges apply)'
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relacl IS NULL
ORDER BY c.relname;

SELECT 'TGRANT', c.relname, g.rolname, ae.privilege_type
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(c.relacl) ae
JOIN pg_catalog.pg_roles g ON g.oid = ae.grantee
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND g.rolname IN ('anon', 'authenticated')
ORDER BY c.relname, g.rolname, ae.privilege_type;

-- ---------------------------------------------------------------- COLUMN GRANTS
-- Same NULL caveat: attacl NULL means "no column-specific grant", which is the
-- normal case and is NOT the same as "no access" — the table grant still applies.
-- Only non-NULL attacl is emitted, because that is the deliberate narrowing
-- (hp-8's per-column re-grant on user_profiles, hp-10's on insights).
SELECT 'CGRANT', c.relname, a.attname, g.rolname, ae.privilege_type
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(a.attacl) ae
JOIN pg_catalog.pg_roles g ON g.oid = ae.grantee
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND a.attnum > 0 AND NOT a.attisdropped
  AND g.rolname IN ('anon', 'authenticated')
ORDER BY c.relname, a.attname, g.rolname, ae.privilege_type;

-- ---------------------------------------------------------------- FUNCTIONS
-- TWO hashes per function, deliberately.
--   raw        exact definition — catches everything, including comment edits
--   normalised comments stripped, whitespace collapsed — catches BEHAVIOUR
-- The comparator uses the PAIR to classify a mismatch: raw differs while
-- normalised matches is COSMETIC; normalised differs is BEHAVIOURAL.
--
-- The normalised form is for CLASSIFICATION ONLY and is never the sole basis for
-- calling two functions equal, because `--` also appears inside string literals
-- and stripping it there would corrupt the text being compared. Same class as a
-- regex for MAD matching inside "made".
--
-- prosecdef and proconfig are separate fields: SECURITY DEFINER and a pinned
-- search_path are security properties, and seed_user_categories differs between
-- production and the migrations on exactly the second one.
SELECT 'FUNCTION',
       n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       md5(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')),
       md5(lower(regexp_replace(regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))),
       p.prosecdef::text,
       coalesce(array_to_string(p.proconfig, ','), '(none)')
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
ORDER BY 2;

-- ---------------------------------------------------------------- TRIGGERS
SELECT 'TRIGGER', c.relname, t.tgname,
       md5(regexp_replace(pg_get_triggerdef(t.oid), '\s+', ' ', 'g'))
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- ---------------------------------------------------------------- ENVIRONMENT
-- WHY THESE ARE HERE. The schema comparison found a Postgres MAJOR VERSION
-- mismatch (local 15, production 17) by accident: PG17 added the MAINTAIN
-- privilege, which happened to show up in aclexplode as 52 phantom grant
-- differences. A version difference that changed BEHAVIOUR without changing the
-- catalog's shape would have been invisible to the same check.
--
-- So the environment is compared explicitly rather than inferred from artefacts.
-- server_version_num is a HARD assertion in the comparator; the rest are reported
-- as classification, because most are irrelevant to what the RLS suite proves and
-- the ones that matter should be named rather than guessed at.

SELECT 'SETTING', name, setting
FROM pg_catalog.pg_settings
WHERE name IN (
  'server_version', 'server_version_num', 'server_encoding', 'client_encoding',
  'TimeZone', 'DateStyle', 'IntervalStyle', 'standard_conforming_strings',
  'search_path', 'row_security', 'statement_timeout',
  'default_transaction_isolation', 'default_transaction_read_only',
  'transform_null_equals', 'array_nulls', 'backslash_quote',
  'default_text_search_config', 'bytea_output', 'extra_float_digits'
)
ORDER BY name;

-- Collation and the locale PROVIDER. Provider matters on its own: ICU and libc
-- order and compare text differently, and text comparison appears inside policy
-- predicates. Production uses ICU (datlocprovider = 'i').
SELECT 'DBPROPS', 'collation',
       'encoding=' || pg_encoding_to_char(encoding)
       || ' collate=' || datcollate
       || ' ctype=' || datctype
       || ' locale_provider=' || datlocprovider::text
FROM pg_catalog.pg_database
WHERE datname = current_database();

-- Extension NAME, VERSION and SCHEMA. The uuid-ossp schema difference is already
-- an allowlisted finding; a version difference in pgcrypto or uuid-ossp would
-- change generated values and has never been checked at all.
SELECT 'EXTENSION', e.extname, e.extversion || ' schema=' || n.nspname
FROM pg_catalog.pg_extension e
JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;
