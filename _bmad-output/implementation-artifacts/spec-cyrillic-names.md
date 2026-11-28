---
title: 'Names in any script: one validator for every name field, with the database refusing what is never allowed'
type: 'bugfix'
created: '2026-11-27'
status: 'in-review'
baseline_commit: 'a21d243fc50295553ffb3bd398334cc00d6c2e1a'
review_loop_iteration: 1
context:
  - '{project-root}/docs/api-conventions.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** category names must match `/^[a-zA-Z0-9\s]+$/`, so a bilingual app rejects "Храна" for every Bulgarian user. The rule exists in three copies (form, create API, rename API). Every other name field (goals, shared goals, household, wishlist items, values, display name) has no character rule at all, so control and zero-width characters, doubled spaces and non-NFC text are all accepted.

**Approach (Niki, 2026-11-27):** ONE shared validator, used by the form AND the API of every name field. Allowed: letters of any script (`\p{L}`), combining marks (`\p{M}`), digits (`\p{N}`), the space, and `& - ' . , ( ) /`. Trim; collapse internal runs of spaces; normalise to NFC before validating and storing. The DATABASE enforces the "never allowed" half on the same columns: control and zero-width/format characters, untrimmed or doubled spaces, non-NFC text. One shared list of names runs through both, and they must agree. Case stays exact: "Храна" ≠ "храна", as "Food" ≠ "food" today. Emoji is out of scope (board).

## Boundaries & Constraints

**Always:**
- One definition: `src/lib/validation/names.ts` is the only place the rule lives in the app. A static test pins every name-writing form and route to it, and no local name regex may remain.
- The database CHECK names one function, `public.is_clean_name(text)`, used by all six columns. The agreement test generates the JS sets (`\p{Cc}`, `\p{Cf}`, the whitespace `trim()` removes) and checks every code point against the database.
- Each field keeps its current length limit: category 100, goal 200, shared goal 100, household 100, wishlist item 100, value 50. Display name, unlimited today, gets 100; all 3 existing ones fit. Lengths are counted in code points, as Postgres counts.
- Validation messages for names come from the message files (en and bg); the Bulgarian strings go in the report.
- Release order: APP FIRST, then the migration (see Design Notes). Re-measure every existing value against the exact database rule right before the apply.

**Ask First:** the migration apply (Niki's yes for the exact SHA, under the production-migration rule).

**Never:**
- Change uniqueness or case behaviour.
- Edit a frozen migration.
- Allow emoji in this story.
- Touch the password-strength rules (board: their own auth PR).

## I/O & Edge-Case Matrix

| Scenario | Input | Expected | Layer |
|---|---|---|---|
| Bulgarian | "Храна", "Сметки за ток", "Дрехи & обувки", "Кафе (вкъщи)" | accepted, stored as typed | form, API, DB |
| Mixed script | "Café Кафе 2" | accepted | form, API, DB |
| Untidy spaces | "  Храна   за  дома " | stored "Храна за дома" | form/API normalise; the DB refuses untrimmed or doubled spaces |
| Control character | "Хра\tна", "A\u0007" | rejected | form, API, DB |
| Zero-width | "Хра​на", "a‍b" | rejected | form, API, DB |
| Empty after trim | "   " | rejected | form, API, DB |
| NFC | "й" (decomposed й) | stored "й"; equals the composed name, so a duplicate is a 409 | API normalises; the DB refuses non-NFC |
| Emoji / NBSP / # | "Food 🍕", "a b", "#1" | rejected by the validator; the DB allows them (not in the never-allowed half) | form, API |
| Rename collision | a 100-char name with a space at the cut, moved to an owner who has the name | "… 2" with no doubled space; deletion and removal still succeed | DB |

</frozen-after-approval>

## Code Map

- `src/components/categories/CategoryModal.tsx:58`, `src/app/api/categories/route.ts:181`, `src/app/api/categories/[id]/route.ts:27` -- the ASCII rule, three copies (zod `.refine`). The duplicate pre-checks (`route.ts:252`, `[id]/route.ts:113`) use exact `.eq('name', name)`; that must receive the NORMALISED name.
- Goals: `src/app/api/goals/route.ts:63` and `[id]/route.ts:73` (manual trim, max 200); `src/components/goals/GoalForm.tsx:40` (zod, max 200).
- Shared goals: `src/app/api/households/goals/route.ts:19` (zod trim 1-100); `src/components/household/SharedGoalsCard.tsx:51` (manual trim, maxLength 100); `householdGoalService.ts:113` trims again.
- Household: `src/app/api/households/route.ts:24` (zod trim 1-100); `src/components/household/HouseholdCreateCard.tsx:36` (manual trim); `householdService.createHousehold:82` trims again. No rename path exists.
- Wishlist: `src/app/api/wishlist/route.ts:33` (zod trim 1-100); `src/components/goals/WishlistSection.tsx:114` (manual, `nameError`). `wishlist/[id]` does not rename.
- Values: `src/app/api/values/route.ts:18`, `[id]/route.ts:19` (zod trim 1-50); `src/components/values/ValuesPlanSection.tsx:75,96` (manual trim, maxLength 50).
- Display name: `src/app/api/user/profile/route.ts:88` (NO validation) → `settingsService.updateUserProfile:182`. Forms: `src/components/settings/sections/AccountSection.tsx` via `src/lib/hooks/useSettingsProfile.ts:144`, and `src/components/common/OnboardingModal.tsx:44` (zod max 100) → `src/app/page.tsx:100`. Profiles are created with no display_name; the signup trigger `handle_new_user` never writes one (production checked).
- SQL writers of names: `seed_user_categories` (fixed clean English names); `prepare_account_deletion` copies (existing names); `private.move_member_shared_objects` renames with `left(name, 100 - length(' ' || n)) || ' ' || n`. That can produce a DOUBLED space when the cut lands after a space, which a new CHECK would refuse inside account deletion and member removal (the critical path). Fix: `rtrim(...)` in a replacement of that function (20261125100000 is frozen; a new migration may replace the function).
- Columns: `categories.name` VARCHAR(100), `households.name` VARCHAR(100), `goals.name` / `wishlist_items.name` / `user_values.name` / `user_profiles.display_name` TEXT (display_name nullable). Existing CHECKs on households, values and wishlist are length-only; categories and goals have none.
- Production measured 2026-11-27: PG 17.6, ICU provider, en_US.UTF-8; `lower('Храна')='храна'`; NFC available; a zero-width space is NOT `[[:cntrl:]]`. 0 existing names fail the proposed rule. The local stack is identical.
- Tests to extend: `CategoryModal.test.tsx`, `GoalForm.test.tsx`, `WishlistSection.test.tsx`, `OnboardingModal.test.tsx`; route tests under `api/{categories,goals,households,wishlist,values,user/profile}/__tests__`.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/validation/names.ts` (+ test) -- `normalizeName`, `checkName(raw, field)` returning `{ok, name, problem}`, `nameSchema(field)` for zod, `NAME_LIMITS` -- the one definition.
- [x] `messages/{en,bg}.json` -- a `names` namespace: empty / tooLong {max} / invalidCharacters.
- [x] Every API route above -- validate and store the normalised name; 400 with `problem` on failure.
- [x] Every form above -- validate with the shared rule; show the translated message.
- [x] `supabase/migrations/<ts>_clean_names.sql` -- `public.is_clean_name(text)` (IMMUTABLE, `search_path=''`); 6 CHECKs; `move_member_shared_objects` replaced with the rtrim fix only.
- [x] Tests: validator unit tests (accept/reject/NFC/collapse/limits, plus the must-find against ASCII classes); the static one-definition guard; route tests per field; form tests for the zod forms; a new RLS test (the agreement corpus, the exhaustive Cc/Cf/whitespace sweep, each column's CHECK, the rename near 100 chars, a Cyrillic insert through the real client).
- [x] Board: emoji as a later choice; password strength counting `\p{Lu}`/`\p{Ll}` (its own auth PR).

**Acceptance Criteria:**
- Given the QA account in Bulgarian in the browser, when a Cyrillic category is created, then it is listed, and deleting it removes it (exact names reported).
- Given each guard, when it is mutated, then its expected test fails, with the red state recorded.
- Given the branch's code on the OLD schema (main's migrations), when the full suites run, then only the tests of the new migration fail.

## Design Notes

**App first, then the migration (the opposite of #108–#110).** Those migrations only ADDED capabilities, so old code could not notice them. This one CONSTRAINS writes, and today's app can produce values it refuses: a tab inside a category name (its `\s` allows it), doubled spaces anywhere, an untrimmed display name. Applied first, a few writes from the still-deployed app would fail during the window. The new app normalises and validates before any write and needs nothing from the migration, so it runs on the old schema. So: merge, deploy, re-measure, then apply (the "merged" case of the production-migration rule). The drift check reports the file as pending meanwhile, which is allowed for 7 days.

**The two halves.** Postgres has no `\p{L}`/`\p{M}`, so the database cannot enforce the allowed set exactly; it enforces the never-allowed half exactly. The agreement test is exhaustive where it matters: every code point JS classes as `Cc` or `Cf`, and every one `trim()` removes, is generated in JS and checked against the database.

## Verification

**Commands:**
- the verify steps, `npm run test:order`, `next build` -- expected: green.
- `npm run test:rls` on the local stack -- expected: green.
- the mutation harness -- expected: every guard killed by its expected test.
- the branch's suites on the OLD schema -- expected: only the new-migration tests fail.

## Review (iteration 1, 2026-11-28): three reviewers, triage

Blind hunter (B), edge-case hunter (E), verification-gap reviewer (V). The triage decisions were made in session before a context reset and were not written down then; this table was rebuilt on 2026-11-28 from the three saved reports, against what the code now does. Each row says what happened and where the evidence is.

**Fixed:**
- **Invisible characters inside the allowed classes** (B). U+034F, the variation selectors and the Hangul fillers are `\p{M}`/`\p{L}`, so a name could look like "Храна" and be different data. Now `\p{Default_Ignorable_Code_Point}` is refused in the app, and the database's never-allowed class is Cc ∪ Cf ∪ DI ∪ Zl ∪ Zp (27 ranges). RLS test 2 now sweeps that whole set.
- **The keycap emoji** "1️⃣" (B). It is refused by its variation selector (DI). A bare digit plus the enclosing keycap mark (`1` U+20E3) is still accepted, because the rule allows any combining mark: listed for Niki below.
- **A name with no letter or digit** (B, E). The new problem is `needsLetter`. A combining mark with nothing under it, or four or more stacked, is `invalidCharacters` (E: "Zalgo").
- **Autocorrect punctuation** (B, E). ’ ‘ ʼ map to `'`, and ‐ ‑ ‒ – — ― − map to `-`. Every space separator (Zs: a pasted no-break space, the ideographic space) becomes a plain space before validation. Decisions for Niki below.
- **No data clean-up before the CHECKs** (B). The migration now tidies `display_name` first: NFC, trim, collapse, and empty becomes NULL. Every other column is re-measured right before the apply (see "Apply" below).
- **The replaced `private.move_member_shared_objects` could undo later work** (B). Checked: 20261125100000 is its only earlier definition. Its body diffs against the new one in exactly one changed line, plus two comment lines.
- **`problem` missing on most routes; messages misstating the reason** (B, V). Every name route now returns `problem` with a message saying what is wrong. Documented in `docs/api-conventions.md`. The route tests pin the exact code and message per input, and that a non-name failure carries no `problem`.
- **Profile: a non-string `display_name` got "Display name is required"** (B). It is now a 400 "display_name must be a string or null".
- **Length counted two ways** (B, E, V). `maxLength` (UTF-16 units) is removed from every name input. `householdService`, `valuesService` and now `householdGoalService` use `checkName` instead of their own copies. Tests at the limit use non-BMP letters.
- **The OAuth callback wrote `display_name` raw, and ignored a returned `{ error }`** (V, E). It now pre-fills only a name the rule accepts, stores it normalised, and logs both a returned and a thrown error. The callback is in `NAME_WRITERS`.
- **The onboarding pre-fill could open with an error on a field the person never typed** (E). It is now shown normalised, or empty if the rule refuses it. An empty field leaves the stored name unchanged.
- **A refused value rename closed the editor and lost the text** (B, E). `onRename` now returns whether it saved. A refusal, from the rule or from the server (409), keeps the editor open.
- **The shared-goal target toast still asked for a name** (V). It now reads `invalidTarget`. `wishlist.invalidName`, which nothing used, is removed from both message files.
- **Four forms untested; mocks blind to wrong wiring** (B, V). Added `src/lib/validation/__tests__/name-forms.test.tsx` (household, shared goal, values add/rename, account display name). It uses the real messages through the namespace-aware global mock, with `{max}` filled. GoalForm, CategoryModal and WishlistSection each test their own limit (200, 100, 100).
- **Untested spec rows** (B). A decomposed "Чай" duplicate is a 409. The rename near 100 characters is tested through account deletion as well as removal. Signed-in users write five columns through RLS (the household name is written by the server only).
- **No single shared list** (B). `src/lib/test-utils/nameCorpus.ts` is the one list. The validator test and the database test both run all of it.
- **Guard blind spots** (B, E). `NAME_WRITERS` is no longer trusted alone. A discovery scan finds every file that writes a name table, posts to its API, or is its route; each must be a name writer or carry a reason; stale entries fail. The ASCII scan now catches any `[a-z]` or `[A-Z]` range and `\w`. Both scanners are checked on synthetic fixtures and a file count. The schema scan also covers `display_name:`. The widened scan found the reset-password page's password rules (board).
- **Invisible characters written literally in test source** (B). All are escapes now, checked by a script over the story's files.
- **Hygiene** (B, E). CategoryModal's NFC test unmounts. RLS test 4 asserts every setup step. The RLS file sets a 120 s timeout.

**Accepted or deferred (board, each with a `status:` line):**
- **Persian/Urdu ZWNJ and Sinhala ZWJ inside words** (E). Deferred. A safe version allows a joiner only between two letters, in the app and the database together.
- **A legacy name outside the rule blocks an unrelated edit** (B, E). Accepted, unless the pre-apply measurement finds one. The form says why.
- **Emoji**: Niki's decision, still a product choice for later.

**Dismissed, with the evidence:**
- **"The agreement test does not run in CI"** (B). It does. `rls.yml` uses the local-supabase action, which exports `LOCAL_DB_URL` (`.github/actions/local-supabase/action.yml:177`). `account-deletion.rls.test.ts` already depends on it.
- **"Settings keeps showing the raw display name after a save"** (B). The hook's sync effect sets the field from the saved profile. `name-forms.test.tsx` shows the field holding "Иван Петров" after "  Иван   Петров " is saved.
- **"WishlistSection's stored message stays in the old language after a locale switch"** (B). Switching language sets the cookie and reloads the page, so the form state does not survive the switch.
- **"`is_clean_name` belongs in `private`; REVOKE FROM PUBLIC could block writes by other roles"** (B). Every role whose writes run the CHECK must be able to execute it. `authenticated` has no USAGE on `private`, by design. Measured on the local stack, which is migration-identical: every function writing a name table runs as `postgres` (definer) or as its caller (`authenticated`/`service_role`), and all three may execute it. The sign-up trigger `handle_new_user` is a definer owned by `postgres`, so `supabase_auth_admin` needs no grant. The same query runs read-only in production before the apply. Calling it as an RPC reveals nothing: it is a pure function of its argument.
- **"A refused onboarding name drops currency and onboarding_completed with it"** (E). The modal validates with the same function as the route, so the server cannot refuse a name the modal sent. The guard keeps one definition.
- **"Name the offending character in the message"** (B). After normalising, only control and invisible characters remain, and those come from a paste. The message lists what is allowed. Rejected for this story.
- **Goals PUT says "cannot be empty" where POST says "is required"** (B). Kept, so existing clients and tests see the same text. Both now carry `problem: 'empty'`.

**Deviations from the frozen intent, for Niki to confirm:**
- The matrix row "Emoji / NBSP / #" says a no-break space is refused. The review changed that: every space separator becomes a plain space, then trim and collapse apply. A pasted name with a no-break space now saves as the person sees it.
- Typographic apostrophes and dashes become `'` and `-` (the frozen allowed set unchanged).
- `needsLetter` and the combining-mark limits are new refusals.
- A digit plus the enclosing keycap mark (`1⃣`, no variation selector) is accepted, because the rule allows any combining mark.

## Results (2026-11-28, local, after the review fixes)

- **Verify** (CI's test job). `npm ci` cannot run locally because VS Code's Jest runner holds a native file. An interrupted run removed `node_modules/next`; a normal `npm install` restored it, with the lockfile unchanged. Every later step, in CI's order: type check, lint, format, `test:coverage`, coverage scope, coverage threshold, audit, all `ok`. Tests: `Tests:       98 skipped, 3184 passed, 3282 total`.
- **Pinned order:** `ok: 3184 tests ran, in the pinned order 20261029`.
- **Build:** `next build` exit 0.
- **RLS, full suite, on the final migration:** `Test Suites: 15 passed, 15 total` / `Tests:       98 passed, 98 total`.
- **New code × OLD schema** (main's migrations, this file held out): `Test Suites: 1 failed, 14 passed, 15 total` / `Tests:       5 failed, 93 passed, 98 total`. The 5 failures are exactly `names.rls.test.ts` tests 1-5, this migration's own. After that run, the file went back with the same sha256 (`4c7d4656…`) and the local stack was reset onto it.
- **Mutation harness:** 39 of 39 mutants killed by the expected test, each checked for the right red (the expected detail in the failing title or body). The mutants: the validator (10), the database function, CHECKs, grant and rename (7), the guard and its scanners (6), the forms (11), the API and services (5). Examples of the reds:
  - D1, Hangul filler allowed: `"label": "a Hangul filler (an invisible letter)"`, `- "dbRaw": false` / `+ "dbRaw": true`.
  - D7, authenticated cannot execute: `- "refused": "23514"` / `+ "refused": "42501"`.
  - G1, an unclassified write site: `+ "src/lib/services/mutantWriter.ts"`.
  - Files and database were restored afterwards: the names suites and RLS test pass again.
- **Browser, QA account, Bulgarian** (dev server on the PRODUCTION database, `html lang = bg`):
  - created „Тест кирилица 1504" through the „Добави категория" modal: id `1219ea87-d3f3-434b-9186-c2957395eecf`, type expense;
  - it was listed, and deleted through that row's „Изтрий категория" button and „Изтрий въпреки това";
  - the API list afterwards: `11 categories; identical to before (id, name, colour, type): true`.
  - Production, read-only, the same query before and after: `categories 11, custom 0, fingerprint 7494cfea3052149c6059a3de4c52bde0`, and the deleted id is absent (`deleted_id_present 0`).

## Apply (production): checklist, filled in as it happens

Release order: app first. Merge, deploy, then these read-only measurements, then Niki's yes for the exact SHA, then `supabase db push` with the dry-run gate (#103–#110 model).
1. Every value of the six columns against BOTH halves, as counts per column (no names read): the database half, written out in SQL against the migration's exact class; and the app half (the allowed set, `needsLetter`, the mark limits).
2. The functions that write a name table in production, the role each runs as, and EXECUTE on `is_clean_name` for every writer role (the query from the dismissal above). `seed_user_categories` exists in production only, so its literal names are checked against the rule too.
3. The `display_name` rows the tidy UPDATE would change: a count only.
