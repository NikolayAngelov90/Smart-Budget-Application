# HP-4 — Household mobile forms stop squeezing their inputs

**Type:** Hardening pass (post-Epic-16).
**Source:** Epic 13 retro action #3, carried unfixed through the Epic 13, 15 and
16 retrospectives as "household mobile legibility", blocked each time on needing
a screenshot from Nikit.
**Shipped:** PR #33, `a7190ae` (+ follow-up test commits on the same branch).
**Status:** done — see Review below.
**Written:** 2026-08-11, retroactively (implemented without a story file).

---

## The logged cause was wrong

It was recorded as a **contrast** problem for three retros. It is not. A WCAG
audit of every text node on `/household`, in **both themes**, alpha-blended
against the real composited background, returns **zero AA failures**. Story 16-7
fixed contrast when it moved goals/household onto the Quiet Ledger design
system; the note predates that.

Verified with Playwright against a dev server rather than by asking for another
screenshot — see the `browser-verification-workflow` note.

## The actual defect: layout

Every household form put its input and its submit button in a fixed `<HStack>`.
The button keeps its natural width, so the input absorbs all the squeeze.

Measured at 320px, **7 of 8 controls were narrower than their own placeholder**,
and all 8 were under the project's 44px mobile size:

| Field | space | needs | short |
|---|---|---|---|
| Задайте вашия процент | 58px | 172px | 114 |
| Краен срок (date) | 62px | 139px | 77 |
| name@email.com | 71px | 122px | 51 |
| Месечна сума | 76px | 103px | 27 |

The worst is **create-household, and it fails at 390px** — 52px for a 165px
placeholder, so a new user saw "Име на" with no way to tell what the field
wanted. **Invisible in English**: "Create household" is short, "Създай
домакинство" is not.

## Acceptance criteria

1. No form control sits directly inside a fixed `HStack` in the household
   components.
2. Rows stack on `base` and return to a row from `sm` up — desktop unchanged.
3. Every control declares a 44px mobile height.
4. At 320px and 390px: no control narrower than its own placeholder, and no
   horizontal overflow.
5. Contrast is not touched — it was never the problem.

## Verification

Browser-measured before and after. After: 0 truncated, 0 under 44px, no
horizontal overflow; create field 84px → 284px; desktop still a row at 768px
(451px input, 40px tall).

The audit was run against the **production** database via the dev server. The
household created for it was removed afterwards, guarded by id and a
zero-transaction check; the pre-existing household (2 members, 52 transactions)
was verified intact.

## Tests

Two suites. `mobile-form-layout.test.ts` is a **source-level** guard on purpose,
and says so: jsdom has no layout engine, every width it reports is 0, so a
render test cannot see this class of bug at all. It found a fifth squeezed row
(contribute-to-goal) that the browser pass missed, because that form only exists
once a shared goal does.

`household-forms.render.test.tsx` adds the render coverage these four components
never had — codecov correctly failed the first two attempts, once because the
components executed nowhere, once because the tests asserted fields *render* but
never typed into them, leaving each `onChange` closure uncovered.

## Review

Post-merge adversarial review run 2026-08-11 over `84f6c8c..a7190ae`. Outcome
recorded in `hp-review-2026-08-11.md`.
