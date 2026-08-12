# Claude Code prompts — 2026-08-12

Orchestrated set for four items raised by Nikit. Run them in order; P1-A is a
read-only investigation that must be answered before P1-B is written.

Shared gate for every implementation prompt (do not restate it in chat, it is
already in each prompt): `npm run lint` → `npm run type-check` → `npm test` →
`npm run build`, plus `npm run test:rls` when a policy or migration is touched,
plus en/bg key parity in `messages/`.

## MCP servers available to Claude Code

Confirmed from `.mcp.json` and the allowlist in `.claude/settings.local.json`.
Each prompt below repeats the subset that is relevant to it, so they stay
copy-pasteable on their own.

| Server | Use it for | Do not use it for |
|---|---|---|
| **playwright** (`mcp__playwright__*`) | Driving a real browser: `browser_navigate`, `browser_resize`, `browser_take_screenshot`, `browser_snapshot`, `browser_click`, `browser_fill_form`, `browser_evaluate`, `browser_console_messages`, `browser_network_requests`. The only way to actually SEE a layout defect — jsdom cannot. | Replacing unit tests. A Playwright run is evidence, not a regression guard. |
| **supabase** (`mcp__claude_ai_Supabase__*`) | `execute_sql` for read-only inspection of live data and schema, `list_extensions`, `get_advisors` for RLS/perf/security warnings, `search_docs`, `get_publishable_keys`. | Applying migrations. Migrations go in `supabase/migrations/` as numbered SQL and are applied through the normal deploy path — never via `apply_migration` behind the repo's back. |
| **vercel** (`mcp__claude_ai_Vercel__*`) | `get_runtime_logs` and `get_runtime_errors` to see what production actually did, `list_deployments`, `get_deployment`, `get_web_analytics`, `get_access_to_vercel_url` to reach a protected preview. | Deploying, or changing project settings. |
| **canva** | Nothing in this batch. If a story needs an exported asset or a diagram, it is available — but none of these four items do. | Generating UI. The Quiet Ledger design system in `src/theme/` is the source of truth. |
| **GitHub** (`gh` CLI, token configured) | `gh run list` / `gh run view --log-failed` to read CI, `gh pr create` / `gh pr view` / `gh api` for the PR, `gh secret list` to confirm a variable exists in CI. The repo is `NikolayAngelov90/Smart-Budget-Application`, CI runs `test.yml` and `rls.yml`. | Merging. Nikit merges. Open the PR, report the run status, stop there. |

Standing rules for all of them: MCP and CLI tools here are for **observing** —
logs, CI results, live data, a rendered page. Every mutation to this project
goes through the repo, the test suite and the gate. If a call would change state
in Supabase, Vercel or GitHub (apply a migration, deploy, merge a PR, set a
secret), stop and ask first. And when you use one, say so and paste what it
returned; "I checked the logs" without the log line is not evidence.

---

## P1-A — Insights lifecycle audit (READ-ONLY, no code changes)

```
Use the bmad-deep-recon skill.

SCOPE: read-only investigation of the AI Insights lifecycle. Do NOT change any
source file, migration, or test in this run. The deliverable is a findings
document, nothing else.

TOOLS: you have MCP servers attached — use them, this question cannot be fully
answered from source alone.
- supabase (`mcp__claude_ai_Supabase__*`): use `execute_sql` READ-ONLY against
  the live project to answer what the code cannot. Specifically: does an
  `insights` row survive across generations, or do the ids churn? Query
  `SELECT id, type, is_dismissed, dismissed_at, created_at FROM insights WHERE
  user_id = <my user> ORDER BY created_at DESC` and show me the id and
  created_at distribution — if every row shares a recent `created_at`, that is
  the delete-and-reinsert confirmed in production data, not just in the source.
  Check whether `dismissed_at` exists as a column at all, and whether any row
  has ever held a non-null value. Also run `get_advisors` and report anything
  it flags on `insights` or its dependent tables. SELECT only — no INSERT,
  UPDATE, DELETE, DDL, and absolutely no `apply_migration` in this run.
- vercel (`mcp__claude_ai_Vercel__*`): `get_runtime_logs` for
  `/api/cron/generate-insights` and `/api/insights/generate` over the last
  couple of weeks. I want the actual firing frequency, not the intended one —
  including whether the cron ever ran on a non-1st day, and how often the
  10-transaction path fired. This is the single best evidence for "a few days
  later". Also `get_runtime_errors` in case generation is failing partway and
  leaving the table in a half-written state.
- GitHub (`gh`): `gh log`/`gh api` to find when the delete-and-reinsert was
  introduced and whether any story or review ever discussed dismissal
  durability. If a past review raised it and it was deferred, I want to know.

Paste the actual query output and log lines into the findings document. A claim
without its evidence does not count.

CONTEXT — reported symptom
A user dismisses an insight on /insights. A few days later the same insight is
back on the screen, undismissed.

CONTEXT — what I already traced, treat as a hypothesis to VERIFY or REFUTE, not
as fact:
- `src/lib/services/insightService.ts` `generateInsights()` performs
  `adminClient.from('insights').delete().eq('user_id', userId)` — an unfiltered
  delete of ALL rows for the user, including `is_dismissed = true` — and then
  inserts a fresh set. New rows get new UUIDs and `is_dismissed` defaults to
  false in `supabase/migrations/001_initial_schema.sql`.
- The `insights` table has no stable identity for a logical insight: no
  fingerprint/dedupe key, no `(user_id, type, category_id, period)` unique
  constraint. Rows are identified only by a random UUID, so nothing can carry a
  dismissal forward across a regeneration.
- `dismissed_at` is written by `src/app/api/insights/[id]/dismiss/route.ts` but
  I could not find where it is READ. Confirm whether the column exists in a
  migration at all, and whether anything consumes it.
- The regeneration guard `isCacheValid()` is a module-level `Map` in a
  serverless runtime. It does not survive a cold start and is not shared across
  lambda instances, so the "1 hour TTL" is best-effort at most.
- Triggers found so far: `POST /api/insights/generate` (manual, rate-limited),
  `checkAndTriggerForTransactionCount()` on the 10-transaction threshold, and
  the daily cron `/api/cron/generate-insights` which no-ops unless
  `getUTCDate() === 1`. Find every other caller.

DELIVERABLES — write to `_bmad-output/insights-lifecycle-audit-2026-08-12.md`:

1. TRIGGER MAP. Every code path that can call `generateInsights()`, with the
   conditions and any rate limiting. Include cron entries from `vercel.json`.
   State plainly which path most plausibly explains "a few days later".

2. LIFECYCLE TABLE. For each of the six `insight_type` values
   (spending_increase, budget_recommendation, unusual_expense,
   positive_reinforcement, spending_anomaly, new_high_spend_category):
   the rule function that produces it, the exact analysis window it uses, its
   trigger threshold, and whether the same underlying situation can legitimately
   re-fire in a later month. Cite file:line for each.

3. DISMISSAL TRACE. Follow a dismissal end to end: UI handler → PUT endpoint →
   DB write → next generation → next read. Name the exact statement that
   destroys the dismissal. Confirm or refute the delete-and-reinsert hypothesis
   with the line number.

4. DATA-LOSS INVENTORY. Everything else the unfiltered delete destroys, beyond
   the dismissal flag: engagement/analytics rows keyed on `insights.id`
   (check `supabase/migrations/003_insights_engagement_analytics.sql` and
   `/api/insights/[id]/track`, `/api/insights/analytics`), any FK with
   ON DELETE CASCADE, notification deliveries referencing an insight id.
   This determines whether the fix is one table or several.

5. OPTIONS. Present 3 designs for making dismissal durable, each with a
   migration sketch, the changes to `generateInsights()`, the effect on
   engagement analytics, and the failure mode:
   (a) identity key — add a deterministic fingerprint column
       (e.g. type + category_id + period bucket + rule version), UNIQUE per
       user, and UPSERT instead of delete+insert, carrying `is_dismissed`
       forward;
   (b) suppression ledger — a separate `insight_dismissals` table keyed on the
       fingerprint with an expiry, generation filters against it;
   (c) scoped delete — delete only `is_dismissed = false` rows and dedupe new
       rows against surviving dismissed ones.
   For each, answer explicitly: if a user dismisses "Groceries up 40%" in
   August and groceries are up 40% again in October, SHOULD it re-appear? Say
   what each option does in that case.

6. RECOMMENDATION. One option, with the reasoning, and the open product
   questions I have to decide before implementation.

7. TEST GAP. Why the existing suite is green while this bug ships. Name the
   test files that should have caught it and the assertion each is missing.

Follow the repo's own conventions when reading tests: the shared Supabase chain
mock is `src/test-utils/supabaseChain.ts`, and a stub that ignores its arguments
will let a filter silently disappear — that is exactly the failure class here.

End with your confidence level per finding and anything you could not determine
from the code alone.
```

---

## P1-B — reply to the audit, §6 answers, and the two-story split

Audit received: `_bmad-output/insights-lifecycle-audit-2026-08-12.md`.
Paste the block below back to Claude Code.

```
Audit accepted. The cold-start finding is the better call — I had the delete but
not the trigger, and "1 transaction in 24h against a 10-transaction gate" settles
it. Skipping bmad-deep-recon was also right: its research firewall makes project
code inadmissible, and the code and the production rows were the whole case.
Note that for future prompts.

Three corrections before the §6 answers, because two of them change your
recommended design.

CORRECTION 1 — the fingerprint cannot be one formula.
§5(a) proposes `type + category_id + period_bucket + rule_version` globally, but
§2 establishes that `unusual_expense` is anchored to a single transaction. Those
two statements contradict each other: a period bucket on `unusual_expense` means
the same flagged transaction returns next month. The fingerprint must be
PER-TYPE, defined in one table in the story:
  - unusual_expense        → type + transaction_id        (no period component)
  - spending_increase      → type + category_id + period
  - budget_recommendation  → type + category_id + period
  - positive_reinforcement → type + category_id + period
  - spending_anomaly       → type + category_id + period  ← see correction 2
  - new_high_spend_category→ type + category_id + period  ← see correction 2

CORRECTION 2 — "rolling" is not a period bucket.
§2 describes `spending_anomaly` and `new_high_spend_category` as rolling-window,
not month-aligned. A month bucket on a rolling window is arbitrary, and arbitrary
is how a fingerprint silently drifts and remints rows. Read those two engines and
state explicitly what their bucket is. If a rolling window genuinely has no
stable bucket, say so and propose something defensible — anchoring to the
triggering transaction, or to the ISO week — rather than defaulting to the month
because the other four use it. This is the highest-risk unknown in the design;
do not paper over it.

CORRECTION 3 — keep `rule_version` OUT of the fingerprint. (This answers Q3.)
Putting it in means bumping a rule version resurrects every dismissal of that
type, silently, as a side effect of an unrelated change. HP-5 changed
`recommendBudgetLimit`'s arithmetic — under your design that would have
un-dismissed every budget recommendation with nobody deciding it should. Store
`rule_version` as a plain column for debugging and analytics, keep it out of the
UNIQUE key, and make resurrection an explicit migration when a rule change
warrants it. Deliberate, not incidental.

§6 ANSWERS

Q1 — Should a dismissal expire when the period rolls over?
YES. New period, new fingerprint. If groceries are up 40% in August and again in
October, that is a new fact and it should surface again; dismissing August means
"I have seen August", not "never tell me about groceries". The user dismisses
twice, and that is correct. Your recommendation stands.

Q2 — Is `unusual_expense` different?
YES, permanent. It names one transaction, and the user dismissing it has said "I
know about this €80". Anchor it to `transaction_id` per correction 1. It never
returns.

Q3 — What is `rule_version` for?
Answered in correction 3: a column, not part of the key.

Q4 — Is the existing analytics data worth anything?
NO. It has been resetting on roughly every transaction, so there is no history to
preserve. Clean start, and say so in the story rather than pretending to migrate
something. Worth one line in the Epic 12-8 dashboard noting that data before this
fix is not comparable — otherwise someone will read the step change as a
behaviour change in users.

SEQUENCING — agreed, two stories, cold-start first.

STORY hp-8 — cold-start fail-open (do this one first, on its own)
But NOT the one-line `return false`. Failing closed means a genuinely new user
gets nothing until the 1st of the month or a manual refresh, which trades a
too-often bug for a never bug. Derive the "last generated" marker from the
database instead of the in-memory Map — `MAX(created_at)` on the user's insights
rows. It needs no migration (the data is already there), it survives cold starts
and it is shared across instances, so the 10-transaction gate finally does what
Story 6.5 AC1 always said it did.
  - `shouldTriggerGeneration()` counts transactions created since that timestamp.
  - No insights rows at all → genuinely never generated → generate. That keeps
    new-user onboarding working, which the one-liner breaks.
  - `isCacheValid()` may stay as a cheap in-process short-circuit, but it must
    not be the only guard. An empty Map means "I don't know", and "I don't know"
    must never authorise a destructive delete.
  - Consider whether the extra query per transaction POST is acceptable; it is
    indexed and off the response path, but measure rather than assume.
TESTS: the assertion §7 says is missing — `shouldTriggerGeneration` with an empty
cache and fewer than 10 transactions since the last generation returns FALSE.
That test fails today.

STORY hp-10 — fingerprint + UPSERT (after hp-8 is merged)
Option (a), with corrections 1-3 applied. Preserve `is_dismissed`,
`dismissed_at`, and all six engagement columns across regeneration. Migration
adds the fingerprint column plus `UNIQUE (user_id, fingerprint)`; replace
delete+insert with an upsert that updates content columns only.
TESTS, both of which fail today:
  - dismiss a row, run `generateInsights()`, assert it is STILL dismissed;
  - set `view_count`, regenerate, assert it survived.
Plus the chain-mock assertion §7 proposes, so a vanishing filter cannot go green
again.

Note hp-9 is already taken by the mobile-modal story, hence hp-10.

GO ON P2 NOW. It is independent of all of this — different files, no shared
state — so start it while hp-8 is being written. Do not wait on me.
```

---

## P2 — Mobile modal safe-area and keyboard defects

```
Use the bmad-create-story skill, then bmad-dev-story, then bmad-code-review.

Story id: hp-9-mobile-modal-safe-area-and-keyboard
Track it in `_bmad-output/implementation-artifacts/sprint-status.yaml` under
`closed_work_log` alongside the other hp-N items (epics.md ends at 16; this is
hardening, not new scope).

TITLE: Insight detail modal and transaction composer are broken on notched iOS

DEFECT 1 — insight detail modal collides with the Dynamic Island
Device: iPhone 15 Pro Max, PWA standalone (no browser chrome in the capture).
File: `src/components/insights/InsightDetailModal.tsx`.

OBSERVED, from the attached screenshot — these are the acceptance criteria, not
my inference:
- The modal title starts at y=0. The system clock is drawn straight through the
  first line of the heading: "Unusual Healthcare expense: €80.00" renders as
  overlapping glyphs with "11:30" superimposed mid-word. It is unreadable.
- The type badge ("UNUSUAL EXPENSE") sits underneath the cellular, wifi and
  battery icons in the top-right, likewise overlapping.
- The `ModalCloseButton` X is drawn in the same band as the system status
  icons. Its tap target overlaps the region where a downward swipe opens
  Control Centre, so the primary way to close the modal is both invisible and
  hard to hit.
- Below the content there is a large empty region running to the bottom of the
  display, with nothing accounting for the home indicator.

CAUSE: it is the only modal in the codebase with no safe-area handling. It uses
`size={{ base: 'full' }}` via `useBreakpointValue` and
`maxH={{ base: '100vh', md: '90vh' }}` with `m={{ base: 0 }}`, while
`viewportFit: 'cover'` is set in `src/app/layout.tsx:40` — so the content box
starts at the physical top of the display.

SECONDARY, same screenshot, fix it or file it explicitly — do not silently
ignore it: on this warning-tone insight the badge is correctly red/orange, but
the metadata values "€80.00" and "2.2 σ above average" render in GREEN. Green
reads as "good" against a card whose whole point is "this looks wrong". Check
`getInsightToneTokens` in `src/lib/utils/insightGroups.ts` against
`src/components/insights/InsightMetadata.tsx` and report whether the metadata
values are meant to inherit the insight tone. If this is out of scope for a
layout story, say so and record it rather than fixing it half-way.

The correct pattern already exists in this repo — copy it, do not invent one:
- `src/components/transactions/TransactionEntryModal.tsx:817-829`
  (`pt="calc(env(safe-area-inset-top) + 0.5rem)"`, close button offset by
  `calc(env(safe-area-inset-top) + 0.75rem)`, body
  `pb="env(safe-area-inset-bottom)"`)
- `src/components/layout/Header.tsx:88-91`
- `src/components/layout/BottomNav.tsx:81-83`
- `src/components/layout/AppLayout.tsx:122-124` for the `100dvh` with `100vh`
  fallback pattern — `100vh` alone is wrong on iOS and this file still uses it.

DEFECT 2 — transaction composer opens with the keyboard already up and the
focused field is off-screen
File: `src/components/transactions/TransactionEntryModal.tsx`.

OBSERVED, from the attached screenshot — again, these are the criteria:
- The sheet opens with the numeric keypad already raised.
- The Amount field — the field that has focus — is NOT VISIBLE. It has been
  scrolled off the top of the screen. The user is typing into an input they
  cannot see. This is the worst part of the defect; the safe-area collision is
  cosmetic next to it.
- The drag handle and the DrawerHeader ("Add transaction" + close button) are
  gone from the viewport entirely, so the safe-area padding at lines 817-829
  has been scrolled away with them. The Expense/Income segmented control is now
  the topmost element, clipped at y=0, with the clock "11:29" drawn through it
  and the status icons over its right half.
- There is roughly a third of a screen of dead white space between the
  Cancel/Add row and the keyboard accessory bar. The sheet is sized against the
  layout viewport, so it reserves height the keyboard has already taken.

CAUSE: the amount field carries a bare `autoFocus` (line ~512) together with
`inputMode="decimal"`. iOS raises the keyboard while the bottom-sheet Drawer
(`placement="bottom"`, `size="full"`, `maxH="95vh"`, lines ~811-813) is still
animating in, then scrolls the document to bring the focused input into the
shrunken visual viewport. Because the drawer is a fixed-position overlay sized
in `vh`, that scroll drags the whole sheet up past its own header instead of
scrolling within `DrawerBody`.

Requirements:
- Do not auto-focus on touch/mobile. Keep the desktop behaviour (focus the
  amount field) — it is a real convenience there and the desktop Modal path is
  unaffected. Use the existing `isMobile` breakpoint value the component
  already computes rather than a user-agent sniff.
- If focus must eventually land on the amount field on mobile, it happens after
  the drawer transition completes, not during it.
- Size the sheet against the visual viewport so a raised keyboard cannot clip
  the submit button: prefer `dvh` units over `vh`, keep the existing safe-area
  padding.
- The submit button must remain reachable with the keyboard open.

ACCEPTANCE CRITERIA — write them so each is independently verifiable, and
include at minimum:
- Neither modal renders any content, text or control inside the top or bottom
  safe-area insets on a notched device. Specifically: no modal title or badge
  is ever overlapped by the system clock or the status icons.
- `InsightDetailModal` uses `dvh` with a `vh` fallback, matching
  `AppLayout.tsx:122-124`, and reserves `env(safe-area-inset-bottom)`.
- Opening the transaction composer on mobile does not raise the keyboard.
- Whenever the keyboard IS raised in the composer, the focused field stays
  visible and the sheet header remains on screen — the sheet itself must not
  scroll out of the viewport. Scrolling belongs to `DrawerBody`, not the page.
- No dead space between the form's last control and the keyboard: the sheet is
  sized against the visual viewport.
- Desktop focus behaviour is unchanged.
- Close/dismiss controls in both modals meet the 44px tap target the repo
  already enforces, and sit clear of the system status band.

TOOLS — use them, this is a layout bug and you cannot see it from source:
- playwright MCP (`mcp__playwright__*`) is attached. Before you change
  anything, REPRODUCE both defects: `browser_resize` to an iPhone 15 Pro Max
  viewport (393x852 CSS px, DPR 3), `browser_navigate` to the running app,
  open each modal, `browser_take_screenshot`. Then fix, then screenshot again.
  Put the before/after pair in the story file — that is the proof this is
  fixed, since no jsdom test can show it. `browser_evaluate` is how you read
  the computed `env(safe-area-inset-*)` values and the actual
  `visualViewport.height` with the keyboard up.
  Caveat, state it plainly if it bites: a desktop Chromium viewport has no
  physical notch, so `env(safe-area-inset-top)` resolves to 0 there. Emulate
  the insets (inject them as CSS custom properties, or use a device descriptor
  that provides them) and SAY that you did, rather than reporting a green
  screenshot that proves nothing.
- vercel MCP: `get_access_to_vercel_url` if you want to test against a preview
  deployment rather than `npm run dev` on port 3001. Preferable for the PWA
  standalone path, since that is where Nikit hit it.
- GitHub (`gh`): open the PR when the gate is green and report the `test.yml`
  run with `gh run view`. Do not merge.

TESTING — read `docs/testing-guidelines.md` first. Critically: jsdom has no
layout engine and reports every width as 0, so these regressions CANNOT be
caught by rendering. Playwright screenshots are the evidence; the REGRESSION
GUARD has to be source-level, in the style of
`src/components/household/__tests__/mobile-form-layout.test.ts`. Note that the
existing guard in that file has a `[^>]*` regex that does not span multi-line
JSX props — check it before copying it, and fix rather than propagate it if it
is still wrong. Add a guard asserting no `autoFocus` on the mobile path.

If the existing Playwright setup supports device descriptors in CI, add a
checked-in test with the iPhone 15 Pro Max descriptor. If it does not, say so
rather than adding a suite that cannot run in CI.

CONSTRAINTS: Chakra UI v2 with the Quiet Ledger theme — use semantic tokens
(`surface`, `fg`, `border.strong`, …), never raw hex. Respect
`prefers-reduced-motion`. Any new user-facing string needs both `messages/en`
and `messages/bg` keys; parity is enforced in CI.

GATE: `npm run lint` (max-warnings=0), `npm run type-check`, `npm test`,
`npm run build`. Then run bmad-code-review in a fresh context before merge.
```

**Note:** attach both screenshots (composer with keyboard up, insight detail
modal) when you paste this prompt. The OBSERVED blocks above are written from
them, but the images make the severity obvious in a way the text does not.

**Suggested addition once the sheet is fixed:** the composer currently opens on
Expense with an empty amount and no keyboard. If you want the 30-second entry
target back, the right move is a tap-to-focus amount field with a visible
numeric affordance, not `autoFocus`. Worth a separate story — say the word and
I will write it.

---

## P2-R — reply to the PR #40 review round

```
Good report. Naming your own HIGH finding rather than burying it is the right
instinct, and the SSR crash story — green suite, broken page, caught only by
opening it — is worth more than the fix itself.

Three things before I merge #40.

1. SCOPE THE `@supports` BLOCK ANYWAY. I checked your reachability argument and
   it is nearly right, not right. `AIInsightCard.tsx:122` does gate on
   `isMobile && onOpenModal`, and `InsightDetailModal` is mounted only at
   `InsightsList.tsx:172`, so no modal opens at desktop width. But `isMobile`
   comes from `useBreakpointValue`, which is REACTIVE, while `isModalOpen` is
   independent state. Open the modal below `md`, then widen the window — or
   widen an iPad split view — and you have the modal open at desktop width with
   the broken cascade live. Uncommon, not unreachable. You already understand
   the fix and it is a scoping change; leaving a known-broken cascade in the
   tree on an unreachable argument that has a counterexample is not a trade I
   want. Fix it, and drop the "dead code" framing from the story.

2. RE-MEASURE AT 430×932. You measured at 393×852, which is the iPhone 15 Pro.
   The reported device is the Pro Max. You are right that the insets are
   identical so the arithmetic holds — but the story is the artefact someone
   reads in six months, and a figure attributed to the wrong device is the kind
   of small wrongness that discredits the rest of a correct analysis. Redo the
   screenshots at the real viewport and correct the `809.4px` figure.

3. KEEP THE "INSETS ARE INJECTED" CAVEAT PROMINENT. Do not soften it. Chromium
   reports 0, you injected the values, and nothing here is verified on hardware.
   That belongs at the top of the evidence section, not in a footnote. I will
   verify on my own device after merge and tell you what I see.

DO NOT FOLD THE OTHER MODALS INTO #40. `CategoryModal.tsx:224` and
`OnboardingModal.tsx:94` are a separate story — see below.

THE GUARD PROBLEM IS NOW A PROCESS RULE, NOT A REMINDER.
Three vacuous guards in one session, always the same shape: asserting on a
substring that something else in the file already produces. You have fixed each
instance; the shape keeps coming back because nothing in the workflow forces the
guard to prove itself. So, standing rule from here on, applied to every
source-level guard in this project:

  A guard is not done until it has been mutation-tested. Revert the fix it
  guards, run the test, CONFIRM IT FAILS, paste the failure output into the
  story, restore the fix. A guard with no recorded red state is not evidence and
  does not count toward the gate.

This is cheap — two commands — and it is the only thing that distinguishes a
guard from a comment that happens to execute.

AND THE GATE ITSELF IS INSUFFICIENT.
`lint → type-check → jest → build` all passed while the page returned 500. A
build compiles; it does not render. Add a smoke step and run it before every
"green" claim from now on: start the built app, request the primary routes
(`/dashboard`, `/insights`, `/transactions`, `/categories`, `/household`,
`/settings`), assert HTTP 200 and no error boundary in the HTML. Playwright is
already attached and `wait-on` is already a dependency, so this is a script, not
an infrastructure project. Propose it as part of hp-11 and wire it into
`test.yml` if it is stable.

NEXT — hp-11, then P3.

STORY hp-11 — remaining modals with the same safe-area defect
`CategoryModal.tsx:224` and `OnboardingModal.tsx:94`, both
`size={{ base: 'full', md: 'md' }}` over a bare `ModalContent`, both with the
`viewportFit: 'cover'` layout underneath. Same pattern, already understood, so
this should be small.
Priority reasoning, so it is on the record: `OnboardingModal` is the FIRST
SCREEN a new user sees. A broken first impression outranks a long household
page. That is why this goes before P3.
Include the smoke script here. Mutation-test every guard, per the rule above.
While you are in there: sweep for any other modal or drawer using
`size={{ base: 'full' }}` and report the full list, so this is the last time we
discover this class one file at a time.

Then P3 (household sub-pages), on a quiet tree, as planned.
```

---

## P2-R2 — merge #40, then hp-0 (the gitignore finding) before hp-11

```
#40 is good — merge it.

Two notes on your report before the next thing, which is bigger than either of
us thought.

You are right that point 1 needed no code change, and saying so rather than
inventing a diff is the correct call. Catching the three other stale claims —
the `809.4px` ACs, `headerTop 59`, `autoFocus={!isMobile}` — while correcting one
figure is the more valuable half of that pass. A story that documents a fix that
is no longer the fix is worse than no story.

Now the thing you surfaced. You found that `_bmad-output/` is gitignored and hit
it as a "my story isn't visible to reviewers" problem. I checked the blast radius
and it is much larger than that. STOP AND FIX THIS BEFORE hp-11.

STORY hp-0 — put the BMAD output under version control
(numbered 0 because everything else is blocked behind it.)

FINDINGS — verify each, do not take them from me:
- `.gitignore:34` ignores `_bmad-output/`. `git ls-files _bmad-output/` returns
  ZERO tracked files.
- The live Phase 2 planning documents exist ONLY on local disk:
  `planning-artifacts/prd.md` (2026-03-23), `architecture.md` (2026-03-24),
  `ux-design-specification.md` (2026-03-25), `epics.md` (2026-07-23),
  `adr-023`, `adr-025`, and both 2026 implementation-readiness reports.
- The tracked `docs/` counterparts are all frozen at 2025-11-22 — Phase 1.
- So `docs/phase-1/epics.md` (86KB, epics 1-7) and `_bmad-output/.../epics.md` (45KB,
  epics 11-16) are NOT two versions of one document. They are two different
  documents sharing a filename. Same for the PRD and the architecture.
- `implementation-artifacts/sprint-status.yaml` — the tracking system for every
  epic from 11 to 16 and every hp-N item — is untracked. No history of a single
  status transition.
- 40+ story files: untracked.
- `docs/bmm-workflow-status.yaml` points at the 2025-11-22 `docs/` copies, so
  the workflow status describes Phase 1 as current.
- The `.gitignore` comment above the rule reads "BMAD Method Output (artifacts
  are project-specific, not framework)" — which is an argument for TRACKING
  them, sitting directly above the rule that discards them. `_bmad-output/`
  appears to have been grouped with `.claude/` and `.agents/`, where the
  "regenerable, tracking buys nothing" reasoning is correct. Output is not
  regenerable. The reasoning does not transfer.

DECISION (mine, so do not re-litigate it): `_bmad-output/` stays where it is and
becomes tracked. Do not move things into `docs/` — that would fight
`_bmad/config.toml`, which points `planning_artifacts` and
`implementation_artifacts` at `_bmad-output/`, and the next installer run would
undo it.

WORK:
1. Remove `_bmad-output/` from `.gitignore`. Keep `docs/llms-full.txt` ignored —
   that one IS a regenerable download and the reasoning does transfer.
2. BEFORE the first commit, scan everything under `_bmad-output/` for secrets
   and personal data. Non-negotiable: this is about to become permanent history.
   Check for tokens (`ghp_`, `github_pat_`, `sb_secret_`, `eyJhbGci`, `Bearer `),
   passwords, `.env` values, and any production PII. The insights audit quotes
   production rows — confirm the user identifiers there are truncated prefixes
   and not full UUIDs or emails. Report what you find BEFORE committing, and if
   anything needs redacting, redact it in the file rather than skipping the file.
3. Resolve the filename collision so nobody reads the wrong document. Move the
   2025-11-22 `docs/` planning copies to `docs/phase-1/` with a one-line header
   in each saying it is the superseded Phase 1 record and pointing at the live
   file. Do not delete them — they are the historical record and they are the
   only versioned copy that has ever existed.
4. Update `docs/bmm-workflow-status.yaml` to point at the live artefacts.
5. One bulk commit, message explaining WHY, so the next person reading
   `git log` understands this was a correction and not a dump.
6. Add a line to the README's documentation section stating where planning and
   implementation artefacts live, and that `docs/phase-1/` is historical.

VERIFY WHEN DONE: `git ls-files _bmad-output/ | wc -l` is non-zero,
`git check-ignore _bmad-output/implementation-artifacts/sprint-status.yaml`
returns nothing, and a fresh clone contains the Phase 2 PRD.

Two smaller things while you are in there:
- `_bmad-output/claude-code-prompts-2026-08-12.md` is my orchestration file for
  this batch. Fine to track.
- Do NOT go looking for a rotation runbook to commit. There is one, it lives
  deliberately outside the repo, and it stays there.

THEN hp-11 as planned, then P3.
```

---

## P3 — Split the Household page into sub-pages

```
Use the bmad-create-story skill, then bmad-dev-story, then bmad-code-review.

Story id: 17-1-household-information-architecture
This starts Epic 17 (Information Architecture). Add the epic to
`_bmad-output/implementation-artifacts/sprint-status.yaml` under
`development_status` following the existing `epic-N` / `N-M-slug` key shape, and
validate with `sprint_plan.py validate` before you finish.

TITLE: Household screen becomes an index with sub-pages, mirroring Settings

PROBLEM: `src/app/household/page.tsx` renders one long scroll — household
insights, combined spending, shared goals, then `HouseholdSection`, which itself
nests create/join, the transparency preset, invitations, member management, the
personal allowance and the contribution split editor (227 lines across
`src/components/household/*.tsx`, 1333 lines total). Shared read-only aggregates
and destructive management actions sit in the same column with no hierarchy. On
mobile it is a very long scroll to reach member removal.

PRIOR ART — this is exactly the problem Story 16.8 solved for Settings. Read
`src/app/(dashboard)/settings/page.tsx` (the index) and
`src/components/settings/SettingsSubPage.tsx` (the shared shell with the back
affordance, 44px target and `_focusVisible={{ boxShadow: 'focus' }}`) before
designing anything. Reuse that pattern; generalise `SettingsSubPage` into a
shared sub-page shell if that is cleaner than duplicating it — propose which in
the story, do not decide silently.

PROPOSED GROUPING — challenge it if the code suggests better seams:
- `/household` — index. When in a household: the read-only overview
  (`HouseholdInsightsCard`, `CombinedSpendingCard`, `SharedGoalsCard`) plus a
  navigation list into the groups below. When NOT in a household: only the
  create form and `PendingInviteBanner` — no empty group rows into screens that
  cannot do anything yet.
- `/household/members` — `HouseholdMembers` + `HouseholdInvites`.
  Member removal is destructive and belongs visually apart, the way
  `DangerZoneSection` sits apart on the Settings index.
- `/household/sharing` — transparency preset and per-category transparency.
- `/household/money` — `AllowanceCard` + `ContributionSplitCard`.
- `/household/goals` — shared goals detail, if `SharedGoalsCard` has more than
  a summary to show. If it does not, leave goals on the index and say so.

REQUIREMENTS:
- Every sub-page is membership-gated. A non-member hitting the URL directly
  must not see a broken shell — redirect to `/household` or render the same
  gate the index uses. Server-side transparency enforcement via the
  membership-gated RPCs is unchanged; this is presentation only.
- The realtime revalidation currently in `page.tsx` (the 150ms trailing-guard
  `useRealtimeSubscription` that mutates category-totals, contributions, goals
  and insights) must keep working on whichever sub-page is mounted. Lift it to
  `src/app/household/layout.tsx` rather than copying it four times. Keep the
  scoped `useSWRConfig` mutate — the global `mutate` from 'swr' is a no-op
  against the localStorage cache provider (see the 15-1 comment in the file).
  Keep the unmount cleanup of the pending timeout.
- Navigation entry points: the desktop sidebar and the mobile More sheet point
  at `/household`; they should continue to. Check
  `src/components/layout/MoreSheet.tsx` and the sidebar for any deep links into
  household sub-content that would now be stale.
- No behaviour change to any household API route, RPC or RLS policy. This story
  moves components between routes and adds an index; if you find yourself
  editing `src/lib/services/household*.ts`, stop and flag it.

i18n: new titles, descriptions and back-link labels need both `messages/en` and
`messages/bg`. Reuse the `householdDashboard` / `household` namespaces rather
than inventing a third. Key parity is enforced in CI.

A11Y: sub-page back links get a 44px minimum target and the `boxShadow: 'focus'`
ring — the UA default ring is near-invisible on the dark canvas and this is the
primary way out of a sub-page. Headings stay in order (one h1 per page).

TOOLS:
- playwright MCP (`mcp__playwright__*`): walk the new IA end to end before you
  call it done — index → each sub-page → back, at both a phone viewport and
  desktop. Screenshot each sub-page into the story file. Also verify the
  realtime revalidation still fires after the lift to `layout.tsx`: open a
  sub-page, use `browser_network_requests` to confirm the SWR keys revalidate
  when household data changes, rather than assuming the hook still runs.
- supabase MCP: `execute_sql` READ-ONLY if you need to confirm what a real
  household row looks like, and `get_advisors` at the end to confirm you have
  not disturbed anything policy-side. No DDL, no `apply_migration` — this story
  should not touch the database at all, and reaching for a migration is a
  signal you have gone out of scope.
- vercel MCP: `get_runtime_errors` after the preview deploy, to catch a
  sub-route that 500s only in the server-rendered path.
- GitHub (`gh`): open the PR, report `test.yml` and `rls.yml` runs. Do not
  merge.

TESTING: mirror `src/app/(dashboard)/settings/__tests__/sub-routes.test.tsx` —
that file is the template for asserting each route renders its own group and
nothing else. Keep the existing `src/app/household/__tests__` coverage green;
where a test asserted that a component renders on `/household`, move the
assertion to the sub-route rather than deleting it.

GATE: `npm run lint`, `npm run type-check`, `npm test`, `npm run build`. RLS is
untouched, but run `npm run test:rls` anyway since household transparency is the
most policy-sensitive area of the app. Then bmad-code-review in a fresh context.
```

---

## Order of execution

1. **P1-A** now — read-only, produces the audit. No risk.
2. **P2** in parallel — independent of the insights work, touches only two
   component files.
3. **P1-B** after the audit is read and the product questions are answered.
4. **P3** last — largest blast radius, and it is a refactor, so it wants a quiet
   tree.
