---
baseline_commit: 1515d55
source: deferred-work.md — the items that are decisions, not defects
---

# DW-5: Deferred items that need a product decision

Status: decided 2026-07-30 — see Decisions

Not a story. These six entries cannot be implemented as written because each
asks a question rather than describing a defect. Each is small once decided —
mostly under an hour — so the decision is the whole cost.

Answer them and they can be batched into one PR.

---

### 1. `delay_days` is uncapped

**Now:** a goal €1 short with a long horizon reports absurd delays — "30,000
days". Arithmetically correct, useless to read.

**Options:**
- **(a)** Cap the number and reword past the cap ("more than 2 years").
- **(b)** Show a qualitative band instead of a count ("months", "years").
- **(c)** Suppress the line entirely beyond a threshold.

**Recommendation: (a).** Keeps the precise figure where it is meaningful and
degrades honestly where it is not.

---

### 2. Should shared-goal contributors earn goal achievements?

**Now:** the score route scopes goals with `.eq(user_id)`, so a household member
who helps reach a **shared** goal they did not create keeps `first_goal` and
`goal_reached` locked forever.

**Options:**
- **(a)** Contributing to a reached shared goal unlocks them.
- **(b)** Only the creator earns them (today's behaviour, made explicit).
- **(c)** Separate shared-goal achievements.

**Recommendation: (a).** The feature exists to make saving collaborative;
locking the badge behind who typed the goal in undercuts that. Note it widens
the 15-2 data-scope decision, so it is a real change, not a tweak.

---

### 3. Deleting a shared category holding other members' transactions

**Now:** the route's orphan step is owner-only under RLS, so the delete either
fails on the FK or partially orphans. Neither is a good outcome.

**Options:**
- **(a)** Admin-only deletion for shared categories.
- **(b)** Service-role orphaning so all members' transactions are handled.
- **(c)** Refuse while any other member's transactions reference it, and say so.

**Recommendation: (c) plus (a).** Refusing with a clear reason beats a partial
write; admin-only narrows who can hit it. Overlaps 13-11.

---

### 4. Any household member can rename or delete shared categories

**Now:** "manageable by all", per the original AC. Deferred asking whether that
is still the intent now that transparency presets and admin roles exist.

**Options:**
- **(a)** Keep it — households are small and trusted.
- **(b)** Admin-only for rename/delete; all members may still use them.

**Recommendation: (b)**, and it pairs naturally with #3. Renaming a category
silently relabels other people's spending history.

---

### 5. Epic-12 insight types have no metadata renderer

**Now:** `spending_anomaly` and `new_high_spend_category` show "No additional
details available", a divider, then a bold "Why am I seeing this?" heading with
nothing under it.

**Options:**
- **(a)** Build renderers (anomalous amount vs usual, the triggering category).
- **(b)** Hide "See details" when there is nothing to show.

**Recommendation: (b) now, (a) later.** (b) removes a visibly broken panel
cheaply; (a) is a genuine feature. This is tracked as the open question in
**DW-3**, which fixes the empty-heading render either way.

---

### 6. Goal-earlier badge copy nuance

**Now:** the badge assumes the user saves at exactly the deadline-required pace
AND redirects 100% of simulated savings into the nearest goal. Both assumptions
are invisible in the copy, so the badge overstates its confidence.

**Options:**
- **(a)** Add the conditional ("if these savings go toward the goal").
- **(b)** Leave it — it is a simulator, users expect projections.

**Recommendation: (a).** One clause, and it stops the number reading as a promise.

---

## If you want a default

Taking every recommendation gives one small PR: cap `delay_days`, admin-only
shared-category rename/delete with a clear refusal when other members' data is
referenced, hide the empty "See details", and add the conditional clause. The
only one that is genuinely a feature decision rather than a fix is **#2**
(shared-goal achievements) — that one is worth a real opinion.


---

# Decisions (2026-07-30)

| # | Item | Decision |
|---|---|---|
| 1 | `delay_days` uncapped | **Cap and reword past the cap.** |
| 2 | Shared-goal achievements | **Contributors earn them.** Anyone who contributed to a shared goal that is reached unlocks `first_goal` / `goal_reached`. |
| 3 | Shared-category deletion holding others' transactions | **Refuse with a clear reason** while another member's transactions reference it. No partial write, no silent orphaning. |
| 4 | Who may rename/delete shared categories | **Admins only.** Renaming silently relabels other members' spending history. |
| 5 | Epic-12 insight metadata | **Hide "See details"** when there is nothing to show — trigger, divider and heading together. Real renderers stay on the backlog. |
| 6 | Goal-earlier badge conditional | **NOT taken.** Deliberately left as-is; the badge stays as it reads today. |

Notes on scope, now that the decisions are known:

- **#2 is not a copy fix.** It changes how the gamification score route scopes
  goals (`.eq(user_id)`), which was a deliberate Story 15-2 data-scope decision.
  Split out as **DW-6** rather than smuggled into a batch of small fixes.
- **#3 + #4 are one change** — both land in the shared-category permission path.
- **#5** is folded into **DW-3**, which already has to fix the empty-heading
  render; its open question is now answered.
- **#1** is self-contained in the wishlist impact engine.

So: #1, #3, #4 ship as **DW-7** (small, batched). #5 is absorbed by DW-3. #2
becomes DW-6. #6 needs nothing.
