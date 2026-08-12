# ADR-025: Budget Limits — Dedicated Table vs. Historical-Average Proxy

**Date**: 2026-06-03
**Status**: Accepted — implemented 2026-07-02 (migration 032 + `budgetResolver` + `/api/budgets` + budget UI; see `_bmad-output/implementation-artifacts/spec-adr-025-category-budgets.md`)
**Epic**: 13 — Household Collaboration (and forward to 14 — Values & Planning)
**Origin**: Epic 12 retrospective action item **PREP-2**
**Deciders**: Dev, PM, Architect

---

## Context

Smart Budget has never had a budget-limits table. Since Phase 1, "budget" has been an **implicit proxy**: each category's **3-month historical average** is treated as the soft target.

By the end of Epic 12 this proxy had become load-bearing in user-facing copy and logic:

- **FR2 / Story 12-2 (End-of-Month Forecast):** a category is flagged **"at risk"** when `projectedEOM > 3-month historical average`.
- **FR3 / Story 12-3 (Smart Nudges):** a nudge fires at **≥80% ("approaching")** / **≥100% ("exceeded")** of the historical average.
- **FR4 / Story 12-4 (Recovery Plans):** daily/weekly targets derived from historical minimums.
- Confirmed in code: `insightService.ts` ("Budget table is not part of the current MVP scope") and `forecastEngine.ts` (historical average used as the at-risk threshold).

Epic 13 and Epic 14 introduce requirements where the proxy starts to break down:

- **FR15 (Wishlist budget impact):** "impact on the **current month's remaining budget**." *Remaining* presupposes a target.
- **FR20 (Shared budget categories) / FR21 (Income-proportional splits) / FR12 (Shared dashboard "contribution progress"):** household members co-managing a shared category will expect to set a **shared monthly target**, not have it silently inferred from past spend.
- **FR34 (Values-based spending plan):** explicitly *not* "strict caps" — values are priorities, not hard limits.

### The core problem with the proxy

The historical-average proxy is **circular**: the budget is defined as *what you already spend*, so structurally you can never be meaningfully "over budget" for long, and the number drifts upward as spending rises. It cannot express **intentional** budgeting ("I *want* to spend ≤ €300 on dining"), which is the central promise of a budgeting app. It also has no natural owner in a household (whose average?).

---

## Decision Drivers

1. **Additive, non-breaking** — Phase 2 schema changes must be additive (architecture constraint); no breaking changes to Phase 1.
2. **Backward compatibility** — everything that works today on the proxy must keep working with zero migration of existing users.
3. **Household-aware** — must support a shared target on a shared category (`household_id`) for FR20/FR21/FR12.
4. **Single source of truth** — forecast, nudge, recovery, and wishlist logic must read the budget the same way, or copy diverges (Epic 11/12 taught us that duplication breeds the recurring-bug class).
5. **Avoid scope creep into Epic 13's critical path** — the *decision* and *schema* are needed now; the full UI can land in a dedicated story.

---

## Options Considered

### Option A — Keep the proxy only (status quo)
Never add a budget table; continue using the 3-month historical average everywhere.

**Pros:** zero new schema; nothing to migrate; simplest.
**Cons:** cannot express intentional budgets; "remaining budget" (FR15) is semantically wrong; no shared household target (FR20/FR21); the circular-definition problem persists; contradicts the product's core value proposition.

### Option B — Mandatory budget-limits table
Add a budgets table and require every category to have a limit; replace the proxy entirely.

**Pros:** clean, explicit, single concept.
**Cons:** breaks the "zero-config onboarding <2 min" promise (FR36) — new users would have no budgets and every budget-derived feature would go dark; forces a backfill/migration; large blast radius across forecast/nudge/recovery tests.

### Option C — Optional budget-limits table with proxy fallback *(recommended)*
Add an **optional** `category_budgets` table. A single resolver returns, per category: the **explicit limit if one is set**, otherwise the **3-month historical average** (current behavior). Household-shared categories can carry a household-scoped limit.

**Pros:** fully additive and backward-compatible (no limits set → identical to today); unblocks FR15/FR20/FR21 cleanly; lets the proxy remain the smart default so onboarding stays zero-config; one resolver = single source of truth.
**Cons:** two code paths behind the resolver (mitigated by centralizing them); slightly more logic in the engines (they already take inputs, so low cost).

---

## Decision

**Adopt Option C — an optional `category_budgets` table with a historical-average fallback, behind a single budget-resolver.**

### Proposed schema (additive migration, post-Epic-13-foundation)

```sql
-- Migration 0XX_category_budgets.sql  (number assigned at implementation time)
CREATE TABLE category_budgets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id  uuid REFERENCES households(id) ON DELETE CASCADE,   -- null = personal budget
  category_id   uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  period        text NOT NULL DEFAULT 'monthly',                    -- 'monthly' (future: 'weekly')
  limit_amount  numeric(12,2) NOT NULL CHECK (limit_amount >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, period, household_id)
);
-- RLS: dual-path per ADR-015 — owner (user_id = auth.uid())
--      OR household member where household_id matches, filtered by category visibility.
-- Index: idx_category_budgets_lookup on (user_id, category_id), idx_category_budgets_household on (household_id).
```

### Resolver contract (single source of truth)

```ts
// src/lib/ai/budgetResolver.ts  (pure; engines depend on this, never on raw averages)
interface ResolvedBudget {
  amount: number;
  source: 'explicit' | 'historical_average';
}
// resolveBudget(categoryId, { explicitLimit?, threeMonthAverage }): ResolvedBudget
// - explicitLimit present  -> { amount: explicitLimit, source: 'explicit' }
// - otherwise              -> { amount: threeMonthAverage, source: 'historical_average' }
```

`forecastEngine`, `nudgeEngine`, and `recoveryPlanner` consume `ResolvedBudget` instead of computing the average inline. The `source` field lets the UI honestly say "based on your average" vs. "your set budget" — the same honesty principle Story 12-8 used for uninstrumented analytics.

### Scope split
- **Now (this ADR):** decision + schema + resolver contract recorded so Epic 13 stories build against a stable concept.
- **Epic 13:** `category_budgets` migration + RLS land alongside the household-foundation story (so shared budgets are RLS-correct from day one); shared-category budget UI in FR20's story.
- **Epic 14:** wishlist "remaining budget" (FR15) reads the resolver; values plan (FR34) stays intentionally cap-free and does **not** write to this table.

---

## Consequences

**Positive:** intentional budgeting becomes possible without breaking zero-config onboarding; "remaining budget" and shared household targets become well-defined; engines converge on one budget source, killing the copy-divergence that caused recurring Epic 11/12 bugs.

**Negative / watch:** the resolver must be the *only* place the average-vs-explicit choice is made — add a lint/review check so no engine reintroduces an inline `historical average` as "the budget." Household budgets inherit all of ADR-015's RLS complexity (see PREP-1 / [rls-integration-test-strategy.md](../../docs/testing/rls-integration-test-strategy.md)).

**Follow-ups:** assign the migration number at implementation; decide whether `category_only` visibility exposes a shared budget's limit or only progress (likely progress-only, mirroring ADR-011).
