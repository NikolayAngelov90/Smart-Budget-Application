# hp-9 — Insight detail modal and transaction composer are broken on notched iOS

**Type:** Hardening pass (post-Epic-16). `epics.md` ends at 16; tracked in
`sprint-status.yaml` under `closed_work_log` with the other `hp-N` items.
**Status:** in review
**Device:** iPhone 15 Pro Max, PWA standalone — **430×932 CSS px**, DPR 3

> ## ⚠ THE INSETS ARE INJECTED. NOTHING HERE IS VERIFIED ON HARDWARE.
>
> Desktop Chromium has no physical notch, so `env(safe-area-inset-*)` resolves
> to **0**, and Chromium exposes no API to set it. Every "after" measurement and
> screenshot below was taken with the iPhone 15 Pro Max portrait values
> (**top 59px, bottom 34px**) **injected as a stylesheet** overriding the same
> properties the fix sets, with both bands tinted red.
>
> The **rule** is what the fix owns; the injection supplies the **value** the
> device would. That means these results prove the layout is correct *given*
> those insets — they do **not** prove the device reports them, nor that iOS
> composites as expected. Confirm on real hardware before treating this as
> closed.
>
> The "before" capture needed no injection: content at y=0 is inside any
> non-zero inset.

---

## Defect 1 — insight detail modal collides with the Dynamic Island

`src/components/insights/InsightDetailModal.tsx`: `size='full'` on base,
`maxH='100vh'`, `m=0`, and no safe-area handling, while `viewportFit: 'cover'`
(`layout.tsx:40`) puts the content box at the physical top of the display.

> An earlier draft called this *"the only modal in the codebase with no
> safe-area handling"*. **That is false.** `CategoryModal.tsx:224` and
> `OnboardingModal.tsx:94` have the same defect — filed as **hp-11**, which also
> sweeps for the rest of the class rather than finding them one file at a time.

### Measured before (Playwright, 393×852 — the Pro; see the note under Defect 2)

```
modalContent   top 0    bottom 852   paddingTop 0px   margin 0px   maxHeight 852px
header         top 0
closeButton    top 16   40×40
paddingBottom  0px
```

Against the device insets (top 59, bottom 34): header, title, badge and close
button **all** inside the Dynamic Island band; **nothing** reserved for the home
indicator. That matches the report exactly — clock drawn through the heading,
badge under the status icons, X in the Control-Centre swipe region.

### Measured after

```
header         top 59   (was 0)
title          top 75   (was 0)
badge          top 75
closeButton    top 71   (was 16)   44×44 (was 40×40)
paddingBottom  34px     (was 0px)
stillCollides  header:false title:false badge:false closeButton:false
```

### Fix

Copied from the existing patterns, not invented:
`TransactionEntryModal.tsx:817-829` (the Drawer's insets) and
`AppLayout.tsx:122-124` (100dvh with a 100vh fallback).

- `pt`/`pb` of `env(safe-area-inset-top/bottom)` on base only — desktop unchanged.
- Both size tiers inside one `sx`: `100vh`/`100dvh` at base, `90vh`/`90dvh`
  inside `@media (min-width: 48em)`. The breakpoint has to live in `sx` — see
  the review section for why an unscoped `@supports` block outranked `maxH`.
- Close button offset `calc(env(safe-area-inset-top) + 0.75rem)`, and pinned to
  **44×44** (it measured 40×40 with `size="lg"` alone, under the repo's rule).

### Found while fixing, not in the report

With the safe-area padding applied, the badge sat **underneath the close
button** — the header never reserved a column for an absolutely-positioned
control, so it had been laying content under it all along. Fixed with
`pr={{ base: '4rem', md: 6 }}` — responsive, so the desktop header does not
lose a column to a control that only overlaps on mobile.

---

## Defect 2 — composer opens with the keyboard up and the focused field off-screen

`src/components/transactions/TransactionEntryModal.tsx`. The amount field
carried a bare `autoFocus` (line ~512) with `inputMode="decimal"`. iOS raises
the keyboard while the bottom-sheet Drawer is still animating in, then scrolls
the document to bring the focused input into the shrunken visual viewport —
dragging the whole fixed-position sheet up past its own header.

### Fix

- `autoFocus={!isMobile && !hasCoarsePointer}`. Width alone is not enough —
  the Pro Max in LANDSCAPE is 932x430, which resolves to `md`; see the review
  section. Neither signal is a user-agent sniff. Desktop is unchanged.
- Sheet sized `95dvh` with a `95vh` fallback, so a raised keyboard shrinks the
  sheet instead of leaving dead space above the keyboard accessory bar.
- Existing safe-area padding on the sheet left intact (guarded by a test).

### Measured after — at 430×932

```
amountFieldIsFocused    false        (was: focused, keyboard up)
activeElement           BUTTON
drawerMaxHeight         885.4px      = 95dvh of 932
headerTop               65  visible  (was: scrolled off the top)
drawerCloseButtonSize   44×44        (was 32×32 — see review)
```

An earlier draft recorded `809.4px` here. That is 95dvh of **852** — the iPhone
15 **Pro**, not the Pro Max this story is about. The insets are identical
between the two, so the safe-area arithmetic was unaffected, but the figure was
attributed to the wrong device and is corrected above.

---

## Secondary — metadata values were green on a warning insight

**Fixed, not filed.** `InsightMetadata.tsx:109` hardcoded
`color={highlight ? 'accent' : 'fg'}` — evergreen — so an `unusual_expense`
card showed a clay badge above green numbers. Green reads as "good" on a card
whose whole point is "this looks wrong".

`insightGroups.ts` already maps every type to a tone and its docblock states the
tokens exist *"so every insight surface colours identically"*. The component
simply was not consulting them. So this is applying an existing decision, not
making a new one — which is why it is in scope rather than filed.

Highlighted values now use `getInsightToneTokens(insight.type).fg`: clay for
expense, amber for warning, evergreen for recommendations and progress. Visible
in the after screenshot — `€13.72` and `-2.1 σ above average` are clay.

---

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| 1 | No content inside the top or bottom insets on a notched device | Measurement above; all four collision flags false |
| 2 | No title or badge overlapped by the clock or status icons | header/title/badge top ≥ 59 |
| 3 | `InsightDetailModal` uses `dvh` with a `vh` fallback and reserves the bottom inset | `@supports` block; `paddingBottom 34px` |
| 4 | Opening the composer on mobile does not raise the keyboard | `amountFieldIsFocused: false` |
| 5 | Sheet header stays on screen; scrolling belongs to `DrawerBody` | `headerTop 65`, visible |
| 6 | No dead space — sheet sized against the visual viewport | `maxHeight 885.4px` = 95dvh of 932 |
| 7 | Desktop focus behaviour unchanged | `autoFocus={!isMobile && !hasCoarsePointer}`; desktop Modal path untouched |
| 8 | Close controls meet 44px and sit clear of the status band | Insight modal 44×44 at top 71; drawer close button 44×44 |

---

## Evidence

Screenshots in `_bmad-output/screenshots/`:

| file | what it shows |
|---|---|
| `hp9-insight-modal-BEFORE.png` | content at y=0; title and close button inside the band |
| `hp9-insight-modal-AFTER-430x932.png` | 430×932, insets injected and tinted red; all content clear |

See the banner at the top of this document for what the injection does and does
not prove. Note `_bmad-output/` is gitignored, so these are local-only and are
**not** visible to a reviewer of the PR.


---

## Testing

`src/components/insights/__tests__/modal-safe-area.test.ts` — 10 source-level
assertions (11 after the review). jsdom has no layout engine and reports every offset as 0, so neither
defect is reachable by rendering; Playwright is the visual proof and this is the
regression guard.

The `[^>]*` regex the prompt warned about in `mobile-form-layout.test.ts` was
already replaced with a brace-aware extractor in HP-6, so there was nothing to
propagate.

### Mutation evidence — recorded red states

Per the standing rule: a guard with no recorded red state is not evidence. Each
mutation reverts one fix, runs the suite, and is then restored.

**1. Remove the primary fix** (`pt={{ base: 'env(safe-area-inset-top)', md: 0 }}`)
— the padding that stops the title rendering under the Dynamic Island:

```
× reserves both insets ON THE CONTENT BOX (6 ms)
Tests: 1 failed, 10 passed, 11 total
```

**2. Unscope the `@supports` block** (delete the `@media (min-width: 48em)` tier)
— reintroducing the cascade defect:

```
× sizes with dvh and a vh fallback at BOTH tiers (3 ms)
Tests: 1 failed, 10 passed, 11 total
```

**3. Restore the bare `autoFocus`:**

```
× never carries a bare autoFocus (4 ms)
× gates focus on pointer type as well as width (3 ms)
Tests: 2 failed, 8 passed, 10 total
```

For the record, the FIRST version of mutation 1 produced
`Tests: 10 passed, 10 total` — the guard was green with the fix deleted. That is
what the rule exists to catch.

One authoring note: the bare-`autoFocus` guard initially failed against correct
code, because the fix's own explanatory comment contains the word `autoFocus` in
prose. Comments are now stripped before matching — a guard that trips on the
sentence explaining it is worse than no guard.

**Playwright in CI:** not added. The existing Playwright setup is used for
benchmarks, not device-descriptor UI tests, and adding a suite that cannot run
in CI would be worse than none — as instructed, saying so rather than adding it.

---

## Adversarial review — run before the PR, findings applied

Not clean. Two HIGH, and one of the HIGHs was mine.

**H1 — my guard was vacuous for the primary fix.** It asserted only that
`env(safe-area-inset-top)` appeared *somewhere* in the file, which the close
button's own `top` already satisfied. Mutation-tested: deleting the `pt` that
stops the title rendering under the Dynamic Island left **all ten tests green**.
Now tied to the property (`pt={{ base: 'env(...)' }}`), and re-mutation-tested —
it fails.

This is the third time this session I have shipped a guard that passes without
its fix. The pattern is always the same: assert on a *substring* that something
else in the file also produces.

**H2 — an unscoped `@supports` block outranked the `md` breakpoint.** `maxH={{
md: '90vh' }}` emits a `@media` rule; my `sx` emitted `@supports (height:
100dvh)` at equal specificity, and Emotion places `sx` last, so it won at every
width. Both tiers now live inside `sx`, explicitly scoped.

**On reachability — I was wrong, and the fix stands regardless.** I argued this
was unreachable: `AIInsightCard.tsx:122` gates on `if (isMobile && onOpenModal)`
and the modal is mounted only at `InsightsList.tsx:172`, so no modal *opens* at
desktop width. True as far as it goes, and it does not go far enough.

`isMobile` comes from `useBreakpointValue`, which is **reactive**, while
`isModalOpen` is independent state. **Open the modal below `md`, then widen the
window** — or resize an iPad split view — and the modal is open at desktop width
with the broken cascade live. Uncommon, not unreachable, and a counterexample
that takes one drag to produce.

"Dead code" was the wrong call. Leaving a known-broken cascade in the tree on a
reachability argument is a bad trade when the fix is a scoping change I had
already written.

**Also applied:**

- `autoFocus` gate was width-only, and iPhone 15 Pro Max in **landscape** is
  932×430 → resolves to `md` → autoFocus back on, on the exact target device.
  Now `!isMobile && !hasCoarsePointer`.
- `DrawerCloseButton` was 32×32. With `autoFocus` gone it is the first tabbable
  and therefore the primary mobile control — pinned to 44px.
- `highlightColor` defaulted to `'accent'`, which would hand the next `highlight`
  call site green text on a warning card. Default removed.
- `pr="4rem"` was unconditional, costing the desktop header 40px of column.
  Now `{{ base: '4rem', md: 6 }}`.

**Introduced and caught while fixing the above:** `useMediaQuery(..., { ssr:
false })` makes Chakra read `window` immediately → `ReferenceError: window is
not defined` → the page 500s. The test suite was green throughout; only opening
the page found it. Dropped the option.

### Filed, not fixed

The commit's claim that `InsightDetailModal` was *"the only modal with no
safe-area handling"* is **false**. `CategoryModal.tsx:224` and
`OnboardingModal.tsx:94` are both `size={{ base: 'full' }}` with no
`env(safe-area-inset-*)` anywhere. `CategoryModal` pairs it with a bare
`<ModalCloseButton />` at `top: 2` (8px — deep inside the 59px band), and
`OnboardingModal`'s `pt={8}` (32px) does not clear 59px either — and that one is
the first screen a new user sees. Out of scope here; worth its own story.

---

## Gate

`tsc` clean · `lint` clean (max-warnings=0) · **2514 tests pass** (+10) ·
`build` clean.
