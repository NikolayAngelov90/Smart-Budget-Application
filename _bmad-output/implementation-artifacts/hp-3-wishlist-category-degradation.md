# HP-3 — Say when the wishlist category list fails to load

**Type:** Hardening pass (post-Epic-16).
**Source:** `deferred-work.md` item 14, re-rated LOW → MED-UX during the Epic 16
retro action #4 re-triage.
**Shipped:** PR #32, `c5db1e1`.
**Status:** done — see Review below.
**Written:** 2026-08-11, retroactively (implemented without a story file).

---

## Why

`WishlistSection` fetched `/api/categories` and **discarded the `error`**:

```ts
const { data: categoriesData } = useSWR('/api/categories?type=expense', categoriesFetcher);
```

A failed request therefore rendered a picker containing nothing but the
"No category" placeholder. That reads as **"you have no categories"**, not
**"we couldn't load them"** — a silent failure, which the project's degradation
policy (`docs/api-conventions.md`) says enrichment must never be.

## Shape of the fix

The category is **optional**, so the correct shape is warn-and-continue, not
block:

- the picker is disabled — an enabled control with nothing in it invites a tap
  that does nothing;
- a helper line explains why;
- **the add still succeeds** with `category_id: null`.

## Acceptance criteria

1. A failed category fetch produces a visible, localized explanation.
2. The picker is disabled in that state rather than silently empty.
3. The explanation is associated with the control for screen readers.
4. The item can still be added while categories are unavailable.
5. No hint appears when the categories load normally.
6. `en` / `bg` key parity holds.

## Implementation note worth keeping

The first version set an explicit `id` on `FormHelperText` and a matching
`aria-describedby` on the `Select`. Chakra's `FormControl` **already** generates
both and links them, so the manual id replaced the generated one on one side and
the association broke — `aria-describedby` pointed at a non-existent element.

The a11y test caught it. The wiring is now left to `FormControl`, and the test
resolves every id in `aria-describedby` and asserts one actually holds the hint,
rather than merely checking the attribute is non-empty.

## Review

Post-merge adversarial review run 2026-08-11 over `84f6c8c..a7190ae`. Outcome
recorded in `hp-review-2026-08-11.md`.
