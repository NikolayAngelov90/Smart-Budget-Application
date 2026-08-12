---
baseline_commit: ac301c9bf37020ef14ee4b05533e590591de5dfe
---

# Story 14.3: Wishlist with Budget Impact Analysis

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user considering a purchase,
I want to add items to a wishlist and see the projected impact on my existing goals and budget,
so that I can make informed decisions about discretionary spending.

## Acceptance Criteria

1. **Given** a logged-in user, **When** they add an item to their wishlist with a name and price (optionally linking an expense category), **Then** the item is saved and shows its computed impact immediately (auto-calculate on save — UX spec).
2. **And** the impact shows **effect on the current month's remaining budget**: when the linked category has an explicit budget (ADR-025), "leaves €X of your €Y {category} budget" or "exceeds your {category} budget by €Z"; the **month balance after purchase** (current income − expenses − price) is always shown.
3. **And** the impact shows **delay to the nearest savings goal deadline**: for the active goal with the soonest future deadline and unmet target, `delayDays = ceil(price / dailyRequired)` where `dailyRequired = (target_amount − current_amount) / daysToDeadline`; omitted when no such goal exists.
4. **And** the impact shows **which value the purchase aligns with** (highest-priority value mapped to the linked category) when a values plan (14.1) exists and a category is linked; omitted otherwise.
5. **And** the user can mark items **"purchased"** or **"removed"**; both leave the active list but remain queryable (soft status, not row deletion).
6. **And** the wishlist **persists across sessions** (DB table, not local state), owner-scoped — no household data.
7. **Given** the user has no budgets, no goals, and no values plan, **When** they add an item, **Then** the item still saves and shows only the month-balance impact (every enrichment degrades independently — zero-config safe).

## Tasks / Subtasks

- [x] Task 1: Migration `supabase/migrations/033_wishlist_items.sql` (AC: #1, #5, #6) — `wishlist_items`: id, user_id (FK auth.users CASCADE), category_id nullable (FK categories SET NULL), name CHECK 1–100 trimmed, price NUMERIC(12,2) CHECK > 0, status CHECK IN ('active','purchased','removed') DEFAULT 'active', timestamps + updated_at trigger. Owner-only flat RLS (031 style) **with the 032 lessons**: INSERT/UPDATE `WITH CHECK` constrains `category_id IS NULL OR category_id IN (own expense categories)`; explicit `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated` + `GRANT ALL … TO service_role`.
- [x] Task 2: Types (AC: #1–#4) — `WishlistItem` row + `Database.Tables.wishlist_items` entry + `WishlistItemImpact` / `WishlistItemWithImpact` / `WishlistResponse` in `src/types/database.types.ts` (near the 14.x types).
- [x] Task 3: Pure engine `src/lib/ai/wishlistImpactEngine.ts` (AC: #2, #3, #4, #7) — `computeWishlistImpact(input)` per the Impact math spec below; no DB, no currency formatting, divide-by-zero/past-deadline/met-target guards. Per the Impact math spec (normative), the engine consumes the EXPLICIT budget row only — deliberately no `resolveBudget` average-fallback (a wishlist purchase isn't spend yet; ADR-025 `source` semantics cited in the module docblock). *(Reworded post-review: the original task line contradicted the math spec.)*
- [x] Task 4: Service `src/lib/services/wishlistService.ts` (AC: #1, #5, #6) — AUTH-SCOPED client (valuesService/budgetService pattern): `listWishlist`, `createItem` (validates optional category via RLS-visible lookup: own + expense, else `WishlistCategoryError`), `updateStatus` (own row, whitelist 'purchased' | 'removed' | 'active', 0-row → NotFound), no service-role.
- [x] Task 5: API (AC: #1–#7) — `GET/POST /api/wishlist` + `PATCH /api/wishlist/[id]` (zod; price positive, ≤2dp, ≤ 9_999_999_999.99 — reuse the budgets PUT refine; name 1–100; status enum; 401/400/404). GET assembles impact inputs in ONE parallel batch: month transactions (income+expense, month-bounded both ends, stored `exchange_rate` conversion like `budgets/route.ts`), `category_budgets` rows, nearest-deadline goal (`goals` select, `deadline not null`, order asc, limit 1 — cast client to generic `SupabaseClient`, goals are NOT in the typed schema), values plan via `getValuesPlan` — each wrapped so failures degrade that enrichment to null (AC #7), never 500 the list.
- [x] Task 6: Hook + UI (AC: #1, #2, #3, #4, #5) — `src/lib/hooks/useWishlist.ts` (SWR, key `/api/wishlist`, fetcher throws on !ok); `src/components/goals/WishlistSection.tsx` + `src/components/goals/WishlistItem.tsx` mounted on `/goals` page below the goals grid: add form (name, price, optional category select from own expense categories), impact lines per item, Purchased/Removed actions with optimistic mutate, empty state, error state; mobile-first (44px targets), calm financial tone.
- [x] Task 7: i18n (all UI strings) — new `wishlist` namespace in `messages/en.json` + `messages/bg.json` (parity enforced by translations.test.ts).
- [x] Task 8: Tests — engine units (each impact + every guard from the spec below), service (chainable mock incl. category validation + 0-row status update), route tests (`@jest-environment node`, 401/400/404, degradation paths, impact assembly), WishlistSection component states.
- [x] Task 9: Verification — `npm run lint`, `npm run type-check`, full `npm test`, `npm run build`; Dev Agent Record + File List + Change Log; status → review; sprint-status 14-3 → review.

### Review Findings

- [x] [Review][Patch] Goals query: expired/met goals starve the 10-row window — add `.gte('deadline', todayKey)` server-side [src/app/api/wishlist/route.ts]
- [x] [Review][Patch] `@jest-environment node` pragma dead in 2nd docblock (Jest honors only the first) [src/app/api/wishlist/__tests__/route.test.ts; same class in src/app/api/budgets/__tests__/route.test.ts]
- [x] [Review][Patch] Error branch hides cached wishlist despite `keepPreviousData` — render stale data through transient errors [src/components/goals/WishlistSection.tsx]
- [x] [Review][Patch] Spend-query failure fabricates `spent: 0` budget line — suppress `category_budget` when the spend query errors [src/app/api/wishlist/route.ts]
- [x] [Review][Patch] Month-totals failure fabricates `−price` balance — make `month_balance_after` nullable, null on failure; also null impact for non-active rows (misleading once purchased) [src/app/api/wishlist/route.ts; src/types/database.types.ts]
- [x] [Review][Patch] UPDATE RLS `WITH CHECK` re-validates category on status-only PATCH — bricks items whose shared category was reassigned by 13-11; relax UPDATE to ownership-only (INSERT stays fully guarded) + drop redundant `idx_wishlist_items_user` [supabase/migrations/033_wishlist_items.sql]
- [x] [Review][Patch] Fixed `1e-6` epsilon rejects legit 2-decimal prices at high magnitude — use `Number(v.toFixed(2)) === v` [src/app/api/wishlist/route.ts; src/app/api/budgets/route.ts]
- [x] [Review][Patch] `round2` can emit `-0` → gray "-€0.00" [src/lib/ai/wishlistImpactEngine.ts]
- [x] [Review][Patch] bg `invalidPrice` mistranslation ("макс. 2 знака" = max 2 characters) [messages/bg.json]
- [x] [Review][Patch] Client price validation lacks the server's magnitude cap [src/components/goals/WishlistSection.tsx]
- [x] [Review][Patch] Single `updatingId` slot re-enables buttons mid-flight on rapid dual status changes — use a Set [src/components/goals/WishlistSection.tsx]
- [x] [Review][Patch] Detached `FormErrorMessage` never aria-associated; >100-char name highlights the Price field — per-field error attribution [src/components/goals/WishlistSection.tsx]
- [x] [Review][Patch] Status change is post-hoc revalidate, not the task's "optimistic mutate" [src/components/goals/WishlistSection.tsx]
- [x] [Review][Patch] GET docblock overclaims "the list never 500s" (listWishlist throws if 033 missing) — fix wording [src/app/api/wishlist/route.ts]
- [x] [Review][Patch] `global.fetch` stubbed in beforeEach, never restored [src/components/goals/__tests__/WishlistSection.test.tsx]
- [x] [Review][Patch] Missing boundary tests: price 0.01/max-cap, name at exactly 100 chars [engine + route tests]
- [x] [Review][Patch] Story Task 3 wording contradicts the normative Impact math spec (resolveBudget import) — reconcile doc [this story file]
- [x] [Review][Defer] Server-timezone month window (UTC on Vercel) — same class already deferred for /api/budgets + budget-forecast in the ADR-025 review — deferred, pre-existing pattern
- [x] [Review][Defer] No live-rate fallback for foreign-currency tx without stored rate — same class deferred for /api/budgets — deferred, pre-existing pattern
- [x] [Review][Defer] Categories dropdown fetch error renders silently empty Select [WishlistSection.tsx] — deferred, polish (optional field, needs new i18n keys)
- [x] [Review][Defer] `delay_days` uncapped for nearly-met goals (can report absurd horizons) — deferred, product copy decision
- [x] [Review][Defer] History toggle stays open after last item restored → auto-expands later [WishlistSection.tsx] — deferred, cosmetic
- [x] [Review][Defer] Category-budget line silently suppressed if the categories name lookup fails (coupling between enrichments) — deferred, degradation is still graceful

## Dev Notes

### Impact math spec (deterministic — the engine implements exactly this)

Input: `{ price, monthIncome, monthExpenses, categoryBudget?: { limitAmount, spent } | null, nearestGoal?: { name, targetAmount, currentAmount, deadline (YYYY-MM-DD), today } | null, alignedValueName?: string | null }`

- `monthBalanceAfter = monthIncome − monthExpenses − price` (always present).
- Category budget impact (only when `categoryBudget` present): `remainingAfter = limitAmount − spent − price`; `exceedsBudget = remainingAfter < 0`. The route passes the EXPLICIT budget row only — do NOT fall back to historical average here (a wishlist purchase isn't spend yet; only intentional limits are meaningful targets). Cite ADR-025's `source` semantics in a comment.
- Goal delay (only when `nearestGoal` present): `daysToDeadline = ceil((deadline − today) / 86400000)`; guards → null impact when `daysToDeadline ≤ 0` OR `targetAmount ≤ currentAmount`; else `dailyRequired = (targetAmount − currentAmount) / daysToDeadline`; `delayDays = ceil(price / dailyRequired)`. Parse `deadline` as a date-only string — construct with `new Date(y, m−1, d)` from split parts, NEVER `new Date('YYYY-MM-DD')` (UTC-midnight parse; same class as the 14-2 review MED and the stats-route fix in 3d36e63).
- Value alignment: pass-through of `alignedValueName` (resolution happens in the route via `getValuesPlan` — first value in priority-ASC order whose `category_ids` contains the item's category).

### Architecture & data-model decisions

- **Migration 033 is additive, owner-only.** Personal feature like 024/031/032 — flat `auth.uid() = user_id` policies, NO dual-path/household branch. Table name is `wishlist_items` (ADR-013 says "wishlists"; the row IS the item — one table suffices; note the variance). `category_id` is `ON DELETE SET NULL` so deleting a category degrades the item's impact instead of destroying the wish. [Source: supabase/migrations/032_category_budgets.sql; _bmad-output/planning-artifacts/architecture.md#ADR-013]
- **Impact is computed at read time, never persisted.** Budgets/goals/values change constantly; stored impact would go stale instantly. GET recomputes from live data (same philosophy as 13-10's on-demand household insights). Auto-"calculate on save" (UX spec) falls out free: POST returns `{ data: item }`, client revalidates GET.
- **Pure engine, Epic-12 style.** All math in `wishlistImpactEngine.ts`, typed input → typed output, no DB/no currency/no i18n text (numbers + flags + names only; the card renders copy). Mirror `valuesSpendingEngine.ts` structure. [Source: src/lib/ai/valuesSpendingEngine.ts]
- **ADR-025 wiring:** the route reads `category_budgets` directly (explicit limits only — see Impact math spec) and spends via the month query with stored-rate conversion, exactly like `GET /api/budgets`. Degrade on error (empty budgets) like the forecast route — never 500 because 033/032 isn't applied. [Source: src/app/api/budgets/route.ts; src/app/api/dashboard/budget-forecast/route.ts (budgetsResult.error branch)]
- **Goals gotcha:** `goals` is NOT in the typed `Database` schema — cast the client to generic `SupabaseClient` for the goals query, as `goalService.ts` does. Select the soonest `deadline not null` goal, `order('deadline', asc).limit(1)` — same query shape as the nudge helper's goal lookup. [Source: src/lib/services/goalService.ts; src/app/api/transactions/route.ts evaluateNudgeForTransaction]
- **Zero-config safety (AC #7):** every enrichment is independent — no budgets → no category line; no goals → no delay line; no plan → no value chip. The month balance line always renders (income/expenses may be 0). The card is NOT progressive-disclosure-hidden: the wishlist is user-initiated on /goals, so an empty state with the add form is correct (unlike dashboard cards).
- **Status is a soft state machine:** `active → purchased | removed` (and back to `active` allowed — cheap undo). Rows are never hard-deleted by the UI; "persists across sessions" (AC #6) includes history. Filter the default list to `active` with a subtle toggle to view purchased/removed.
- **Currency:** card formats with `formatCurrency(..., preferences?.currency_format || 'EUR')`; engine/API stay currency-agnostic raw numbers. [Source: src/components/dashboard/BudgetHealthCard.tsx]

### Files to touch

- NEW `supabase/migrations/033_wishlist_items.sql`
- UPDATE `src/types/database.types.ts` (Database.Tables.wishlist_items + WishlistItem/WishlistItemImpact/WishlistItemWithImpact/WishlistResponse)
- NEW `src/lib/ai/wishlistImpactEngine.ts`
- NEW `src/lib/services/wishlistService.ts`
- NEW `src/app/api/wishlist/route.ts` (GET, POST) + `src/app/api/wishlist/[id]/route.ts` (PATCH)
- NEW `src/lib/hooks/useWishlist.ts`
- NEW `src/components/goals/WishlistSection.tsx` + `src/components/goals/WishlistItem.tsx`
- UPDATE `src/app/goals/page.tsx` (mount WishlistSection below goals grid)
- UPDATE `messages/en.json`, `messages/bg.json` (new `wishlist` namespace)
- NEW tests: `src/lib/ai/__tests__/wishlistImpactEngine.test.ts`, `src/lib/services/__tests__/wishlistService.test.ts`, `src/app/api/wishlist/__tests__/route.test.ts`, `src/components/goals/__tests__/WishlistSection.test.tsx`

### Project Structure Notes

- Components live in `src/components/goals/` per the architecture tree (`WishlistItem.tsx` is explicitly planned there). [Source: _bmad-output/planning-artifacts/architecture.md lines 576-581]
- Next 15 dynamic route params are `Promise` — `{ params }: { params: Promise<{ id: string }> }` then `await params`. [Source: src/app/api/budgets/[id]/route.ts]
- Route tests: `@jest-environment node` FIRST docblock, mock `next/server` before imports, chainable Supabase mock with `is`/`lte`/thenable terminals; mock the service module with `jest.requireActual` spread so error classes stay `instanceof`-able. [Source: src/app/api/budgets/__tests__/route.test.ts]
- SWR fetchers must throw on `!res.ok` (error payloads rendered as data crashed the transactions page — fixed 2f0a89c). [Source: src/lib/hooks/useBudgets.ts]
- Form input: accept comma decimals (bg keypads), validate with `/^\d+([.,]\d{1,2})?$/` + positive, guard double-submit on Enter — the BudgetEditor pattern. [Source: src/components/categories/BudgetEditor.tsx handleSave]
- en/bg parity enforced by `translations.test.ts`; engine emits NO user-facing text so everything i18n-able lives in the card.

### Previous story intelligence (14-2 + ADR-025 spec, commit ac301c9)

- DATE columns are `'YYYY-MM-DD'` strings — bucket/compare by month-key string or split-parts local Date, never `new Date(dateString)` (UTC-midnight misbucketing; bit 14-2 in review, fixed again in stats 3d36e63).
- Migration review lessons just landed in 032: strictly positive amounts at DB + zod + client; `WITH CHECK` must constrain FK ownership/type, not just `user_id`; explicit GRANTs for the CLI ≥2.106 unpin plan. Repeat all three in 033.
- Reviewers flagged select-then-insert TOCTOU on budgets; wishlist POST is insert-only (no unique constraint) so no race handling needed — don't cargo-cult it.
- 1641 tests green as of ac301c9; keep zero-config identity: no existing test may need behavioral changes (this story only adds).

### Testing standards summary

- Engine: pure units — every branch of the Impact math spec (budget over/under, no-budget, goal delay happy path, past deadline, met target, zero daysToDeadline, no goal, value alignment present/absent, price at boundaries).
- Service: chainable mock — category validation (foreign → error, income → error, null ok), status whitelist, 0-row update → NotFound.
- Route: 401s, zod 400s (price 0, negative, 3dp, name empty/101 chars, bad status), POST happy path, GET impact assembly + each degradation (budgets error, goals error, no plan), PATCH 404.
- Component: add-item flow (optimistic), impact lines render/omit correctly, purchased/removed actions, empty state.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 14.3 (lines 698-711)]
- [Source: _bmad-output/planning-artifacts/prd.md#FR15 (line 361)]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-013 (lines 169-172); component tree (lines 576-581)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Forms (line 931) — "Auto-calculate impact on save"]
- [Source: _bmad-output/implementation-artifacts/spec-adr-025-category-budgets.md — resolver contract, review lessons, Suggested Review Order]
- [Source: src/lib/ai/budgetResolver.ts; src/app/api/budgets/route.ts; supabase/migrations/032_category_budgets.sql]
- [Source: src/lib/services/goalService.ts (generic-client cast); src/types/database.types.ts#Goal (line 1485)]
- [Source: _bmad-output/implementation-artifacts/14-2-values-context-spending-view.md — template, engine style, review lessons]

## Dev Agent Record

### Agent Model Used

claude-fable-5

### Debug Log References

- None — tsc/eslint clean first pass; all 55 new tests green first run; full suite green.

### Completion Notes List

- **Migration 033** `wishlist_items`: owner-only flat RLS with all three 032 review lessons applied up front (strictly positive price at DB CHECK; INSERT/UPDATE `WITH CHECK` constrains linked category to the caller's own EXPENSE categories or NULL; explicit GRANTs for the CLI ≥2.106 unpin plan). `category_id ON DELETE SET NULL` so category deletion degrades impact instead of destroying the wish.
- **Pure engine** `computeWishlistImpact` (Epic-12 style): month balance always present; category-budget impact only for EXPLICIT budgets (deliberately no historical-average fallback — a wishlist purchase isn't spend yet, so only intentional limits are meaningful; documented in the module docblock per ADR-025's source semantics); goal delay `ceil(price / dailyRequired)` with met-target/past-deadline/zero-days/malformed-date guards; deadline parsed via split-parts local Date (never `new Date('YYYY-MM-DD')` — the 14-2 timezone lesson).
- **Impact computed at read time, never persisted** — GET assembles month totals (stored-rate currency conversion), explicit budgets, the nearest UNMET future-deadline goal (fetches 10 by deadline asc, picks in route — the soonest-deadline goal may already be met), and the values plan, all in one parallel batch. Every enrichment degrades independently to null with a warn log (AC #7) — the list never 500s because 032/033 isn't applied or a feature has no data. Goals queried via generic `SupabaseClient` cast (goals aren't in the typed schema — goalService pattern).
- **Value alignment**: first value in priority-ASC plan order whose `category_ids` contains the item's category (plan order IS priority order — 14-2 note).
- **UI**: `WishlistSection` on /goals below the goals grid — add form (name, price with comma-decimal normalization + regex validation + double-submit guard — BudgetEditor pattern; optional own-expense-category select), active list with impact lines (over-budget red, goal delay orange, value chip purple), Purchased/Removed soft-status actions with revalidate, Restore from a history toggle, empty/error/skeleton states, 44px mobile touch targets. Status flips are soft transitions — rows are never hard-deleted (AC #5/#6).
- **Verification**: lint clean (`--max-warnings=0`), `tsc --noEmit` clean, full jest 1696 passed / 54 skipped (Docker-gated RLS), production build compiles `/api/wishlist` + `/api/wishlist/[id]`.
- **Deploy note**: apply `supabase/migrations/033_wishlist_items.sql` manually in the Supabase SQL editor (with 032 if not yet applied) — Vercel does not run migrations; the GET degrades gracefully until applied but POST will fail.

### File List

**New**
- `supabase/migrations/033_wishlist_items.sql`
- `src/lib/ai/wishlistImpactEngine.ts`
- `src/lib/services/wishlistService.ts`
- `src/app/api/wishlist/route.ts`
- `src/app/api/wishlist/[id]/route.ts`
- `src/lib/hooks/useWishlist.ts`
- `src/components/goals/WishlistSection.tsx`
- `src/components/goals/WishlistItem.tsx`
- `src/lib/ai/__tests__/wishlistImpactEngine.test.ts`
- `src/lib/services/__tests__/wishlistService.test.ts`
- `src/app/api/wishlist/__tests__/route.test.ts`
- `src/components/goals/__tests__/WishlistSection.test.tsx`

**Updated**
- `src/types/database.types.ts` (wishlist_items table typing + WishlistItem/WishlistItemImpact/WishlistItemWithImpact/WishlistResponse)
- `src/app/goals/page.tsx` (mount WishlistSection)
- `messages/en.json`, `messages/bg.json` (new `wishlist` namespace)

### Change Log

- 2026-07-02: Story 14.3 implemented — wishlist with read-time budget/goal/value impact analysis (migration 033 owner-only RLS, pure wishlistImpactEngine, GET/POST /api/wishlist + PATCH /:id, WishlistSection on /goals, en/bg i18n, 55 new tests). lint/tsc clean; jest 1696 passed / 54 skipped; build green. Status → review.
- 2026-07-02: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor): 0 HIGH; 17 patch findings ALL applied in-session (goals-window starvation fix, honest degradation — null balance / suppressed budget line instead of fabricated numbers, null impact for non-active rows, UPDATE RLS ownership-only to survive 13-11 reassignment, toFixed decimal check here + budgets route, −0 normalization, optimistic status mutate + Set-based in-flight guard, per-field aria-associated errors, client magnitude cap, bg translation fix, first-docblock jest pragmas, fetch restore, boundary tests); 6 deferred to deferred-work.md; 5 dismissed as noise. jest 1705 passed / 54 skipped; lint/tsc/build clean. Status → done.

## Senior Developer Review (AI)

**Outcome:** Approve — all patch-class findings resolved in-session (see Review Findings checklist above; deferrals recorded in deferred-work.md).
