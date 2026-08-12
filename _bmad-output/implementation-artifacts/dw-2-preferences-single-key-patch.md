---
baseline_commit: 1515d55
source: deferred-work.md (8.3 origin; re-logged from 15-5 and 15-6 — three times total)
---

# Story DW-2: Single-key preference writes (kill the JSONB read-modify-write race)

Status: in-review

## Story

As a person changing several settings in a row,
I want every toggle I flip to stay flipped,
so that turning one thing off does not quietly turn another back on.

## Problem

`user_profiles.preferences` is a single JSONB column, and every preference write
goes through a **read-modify-write in application code**
(`src/lib/services/settingsService.ts:136-145`): SELECT the current
`preferences`, spread the incoming partial over it in JS, UPDATE the whole
object.

Two writes that overlap therefore lose one of the changes:

1. PUT A reads `{digest: true, push: true}`
2. PUT B reads `{digest: true, push: true}` — same starting point
3. PUT A writes `{digest: false, push: true}`
4. PUT B writes `{digest: true, push: false}` — **resurrects `digest: true`**

The user sees the digest toggle flip back on by itself.

This is not theoretical. The Settings UI writes one preference per toggle, and
Story 16-8 put the digest and all five push toggles **in the same section**, so
adjacent flips are now the normal interaction, not an edge case. The item has
been logged three times (originally 8.3, again by 15-5, again by 15-6), each
time noting the surface had grown.

The optimistic UI makes it worse: the toggle shows the user's intent
immediately, the PUT succeeds, and the resurrected value only appears on the
next profile fetch — so it looks like the app forgot, not like it failed.

## Acceptance Criteria

1. **Given** two preference writes that overlap in time **When** both complete **Then** both changes are present — neither resurrects the other's previous value.
2. **And** this holds without the client serialising its writes; correctness must not depend on UI timing.
3. **Given** a single-key write **When** it is applied **Then** only that key changes; every other key in `preferences` is untouched, including keys the server's TypeScript types do not know about.
4. **Given** a write for a key that does not exist yet **Then** it is created (a user who has never set a preference must still be able to set one).
5. **Given** an invalid key or value **Then** the request is rejected with a 4xx and `preferences` is not modified.
6. **Given** the existing PUT contract **Then** current callers keep working — this must not require a coordinated client/server deploy.
7. **Given** verification **Then** `tsc`, `lint`, full `jest` (baseline 2276 — zero regressions) and `next build` pass, and a test demonstrates AC1 by interleaving two writes.

## Tasks / Subtasks

- [x] **Task 1: Decide the mechanism (AC: 1, 2, 3)**
  - [x] Preferred: move the merge into Postgres so the read and write are one
        statement — `preferences = preferences || $1::jsonb` (shallow merge,
        atomic). No SELECT, so no window to interleave.
  - [x] Alternative if a merge is not viable: an optimistic version column on
        `user_profiles` and a retry. Heavier; only if the JSONB operator is ruled out.
- [x] **Task 2: Implement (AC: 3, 4, 5, 6)**
  - [x] Replace the JS merge in `settingsService.ts:136-145`.
  - [x] Keep the route contract (`PUT /api/user/profile` with a partial
        `preferences`) so no client changes are needed.
  - [x] Validate keys against the known preference set; reject unknown keys.
- [x] **Task 3: Prove the race is gone (AC: 1, 7)**
  - [x] A test that issues two overlapping writes to DIFFERENT keys and asserts
        both survive. It must FAIL against the current implementation — verify
        that before fixing, or the test proves nothing.
- [x] **Task 4: Verify (AC: 7)**

## Dev Notes

- **The race lives at `src/lib/services/settingsService.ts:136-145`** — the
  `.select('preferences')` / `.single()` followed by a spread and an update.
  That SELECT is the whole problem; removing it is the fix.
- `preferences || jsonb` is a **shallow** merge, which is exactly right here:
  every preference is a scalar at the top level. If a nested object is ever
  added, revisit — shallow merge would replace it wholesale.
- A migration is likely needed if the write moves into an RPC. Migrations
  020-040 are all applied in prod; follow the existing numbering and the RLS
  conventions — `(select auth.uid())` initplan form, and REVOKE explicitly
  because Supabase grants ALL to `authenticated` on new objects by default.
- **Do not reach for a client-side mutex.** AC2 exists because the previous
  three deferrals all assumed the UI would avoid the race, and each time the UI
  changed and the race came back.
- The optimistic-update path in `useSettingsProfile.updatePreference` reverts on
  failure and mutates `PROFILE_KEY` on success; a server-side fix needs no
  change there, which is the point of AC6.
- Related but out of scope: `disclosure_show_all` also revalidates
  `DISCLOSURE_KEY` on flip. Leave that alone.

## Implementation notes

- **Task 1 chose the Postgres merge**, not the version column: migration 041 adds
  `patch_user_preferences(jsonb)` doing `preferences || p_patch` inside the
  UPDATE. No SELECT, so no window.
- **AC1 was proven non-vacuously.** The interleaving test releases both reads
  only after the first write lands. A throwaway probe implementing the OLD
  read-modify-write against the same fake DB and the same schedule flips
  `weekly_digest_enabled` back to `true` — so the test fails against the old
  implementation, which is what makes it worth having.
- **Deploy order is safe either way** (AC6 went further than written): if 041 is
  not applied, the service detects the missing function and falls back to the old
  merge with a loud warning, rather than failing every preference write. A real
  patch error still throws.
- Unknown keys are rejected (AC5). Previously anything the client sent was merged
  into the JSONB verbatim and lived there forever, invisible to the types.

## Outstanding

- **Migration 041 must be applied to production.** Until then the fallback path
  runs and the race persists — the warning in the logs is the signal.
