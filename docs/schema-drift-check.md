# The schema drift check

`.github/workflows/schema-drift.yml` compares **production's catalog** against the
catalog that `supabase/migrations/*` produces, daily and on every push to `main`.
One SQL file ([`scripts/schema-drift/dump-catalog.sql`](../scripts/schema-drift/dump-catalog.sql))
is run against both databases, so a difference cannot originate in how each side
was read. [`scripts/schema-drift/compare.mjs`](../scripts/schema-drift/compare.mjs)
classifies the result; acknowledged differences live in
[`supabase/schema-drift-allowlist.json`](../supabase/schema-drift-allowlist.json).

The two directions are not equally serious. Production having something the
migrations do not is a **hard fail** — that is the direction both 2026-09-24
vulnerabilities arrived by. The migrations having something production does not
is **pending**, and fails only once the newest migration file is more than seven
days old, because a deploy in flight looks exactly like that.

## The Postgres version pin is a maintained value, not a frozen one

Both this workflow and [`rls.yml`](../.github/workflows/rls.yml) pin
`supabase/setup-cli` to **2.105.0**, and they must pin the *same* version. This
check's entire claim is that it compares the stack the RLS suite validates
against with the stack serving users; two different local Postgres versions make
that claim false while the comparison still runs and still looks authoritative.

The CLI ships the local Postgres image, so `version: latest` means the local
Postgres **minor** version floats. On 2026-10-01 it moved 17.6 → 17.11 while
production stayed on 17.6. The version assertion sat *before* the comparison and
aborted, so three consecutive daily runs failed **without comparing a single
catalog object**. An assertion placed before the work converts any false positive
on the assertion into total blindness. Hence the split in `compare.mjs`:

| difference | where it is handled | why |
| --- | --- | --- |
| **major** (17 vs 15) | abort, before the comparison | privilege sets, default rendering and system views change between majors, so the comparison would be garbage — and printing garbage is worse than printing nothing |
| **minor** (17.6 vs 17.11) | run the comparison, report the findings, **fail at the end** | minor releases do not change catalog structure, so the comparison is meaningful and must run. It still fails: a green run with a warning in it is a green run, and nobody reads one |

When production's minor moves, the comparator says so in red with both versions
named. Bumping the pin — **here and in `rls.yml` together** — is the deliberate
response. Leaving it behind is also a decision, and it is the one that makes the
RLS suite prove isolation against a database production is not running.

### The pin carries a known unknown: CLI default grants

`rls.yml` pins 2.105.0 because v2.106.0 changed a default — new public-schema
objects are no longer auto-exposed to the Data API or auto-granted to roles. The
green drift baseline, however, was established under `version: latest`, i.e.
*after* that change. Pinning this check to 2.105.0 therefore builds the local
catalog under the **older** grant default for the first time.

If that default adds grants the migrations do not state explicitly, they will
appear as `MIGRATIONS_ONLY` grant entries and the check will go red. **That red
would be a finding, not noise:** it would mean the RLS suite has been proving
isolation against a privilege configuration production does not have — which is
exactly what this check exists to detect. The alternative, pinning this check to
some post-2.106.0 release so the dashboard stays green, would choose the green
over the information.

It cannot be settled offline: it needs a real run with both databases. Resolve it
by reading the output of a `workflow_dispatch` run, not by reasoning about it.

## The Docker Hub pull limit: measured, then fixed

`supabase start` pulls the local stack from Docker Hub. The **anonymous** pull
limit is per IP, and GitHub's runner IPs are shared, so the pull hit
`toomanyrequests` and retried:

| run | date | failed pulls | authenticated | stack came up |
| --- | --- | --- | --- | --- |
| 36862540428 | 2026-10-01 | 9 | no | yes |
| 37003980887 | 2026-10-02 | 14 | no | yes |
| 37118890489 | 2026-10-03 | 9 | no | yes |
| **37129917430** | **2026-10-03** | **0** | **yes** | **yes** |

The count is of `Error response from daemon: toomanyrequests` lines. Docker emits
two log lines per failed pull, so a grep for the bare string `toomanyrequests`
double-counts; an earlier version of this table said 18/19/16 for that reason.
The string also appears in this workflow's own error message, so a naive count of
the whole log is self-polluting — worth knowing before trusting a number from it.

**The fix was verified by effect, in two parts, because the first can hold while
the second fails.** `docker login` writing a config the Supabase CLI's pulls do
not consult would print `AUTHENTICATED` and change nothing. Both were checked:
the step printed `Login Succeeded` and `AUTHENTICATED`, **and** the failed-pull
count went to zero.

Survived three times is not survivable. When it does stop the stack, the failure
will read as an infrastructure flake — which is how it gets re-run instead of
fixed. Two things are in place for that: the `Start Supabase` step captures its
output and emits a `::error::` **naming** the rate limit as the cause when the
step fails on it, and the count is printed even on a green run so the trend is
readable before the day it matters.

**The remedy itself is not in place, and needs a credential this repository does
not have.** Three options were considered:

1. **Authenticate the pull** — moves the limit from per-IP-anonymous to
   per-account. **This is what is in place**, via `DOCKERHUB_USERNAME` /
   `DOCKERHUB_TOKEN` (a read-only access token). The step stays conditional and
   prints `ANONYMOUS` if the secrets are ever absent rather than passing quietly,
   because an unmitigated state that looks identical to a mitigated one is the
   shape of defect this repository keeps finding.
2. **A read-through registry mirror** (`registry-mirrors` in the runner's Docker
   daemon) — credential-free, and rejected on honesty grounds: the obvious
   candidate is tied to Google Container Registry, which has been deprecated,
   and whether it still proxies Docker Hub cannot be established without a CI
   run. A mirror that silently fails falls back to Docker Hub, so trying it would
   be safe but possibly ineffective — and "possibly ineffective" is not a state
   worth recording as a fix.
3. **Caching the images** (`docker save` / `actions/cache`) — the Supabase stack
   is several GB, which would consume most of the repository's 10 GB cache
   budget, and restoring it is not obviously faster than the pull it replaces.

So: counted, fixed, and verified by the count rather than by the absence of
noticed errors — a count is a measurement, an absence of noticed errors is an
impression.

## Eight defects, in the tool built to catch defects

In its first two weeks this check has contained:

1. an allowlist matcher that derived its required tokens from a prose field, so
   every entry matched nothing;
2. a test for that allowlist that could not have failed — it put the difference
   on the PENDING side, which exits 0 regardless, so it would have passed with
   the allowlist empty;
3. a layer error: `search_path` and `statement_timeout` reported as environment
   drift when they are role properties, because production was read as
   `schema_reader` and the local stack as superuser — the exact class of mistake
   this check exists to catch, committed inside the check;
4. a printed secret: `app.settings.jwt_secret` went into the CI log in clear;
5. `COSMETIC` counted as `pending`, so an object present on both sides with an
   identical normalised body was reported as absent from production;
6. an age gate reading the wrong commit, because `actions/checkout` is shallow by
   default and `git log -1 -- <file>` then returns the tip commit for every file;
7. the **non-vacuity floors** — this check's own anti-vacuity mechanism — covered
   by two tests that passed through a different code path. Disabling the floors
   entirely left both green: `BELOW FLOOR` is printed whether or not it fails the
   run, and a truncated fixture also drops its version rows, so the version
   assertion supplied the `HARD FAILURE` string and the exit code;
8. **security attributes not compared in the one case that needs them.** Replacing
   `secDiffers` with `false` left all 22 tests passing, because the one fixture
   that touched `proconfig` left the raw hash equal, so the cosmetic branch was
   unreachable. A function whose text changed, whose normalised body is identical
   and whose `SECURITY DEFINER` or `search_path` moved would have been classified
   COSMETIC and passed — a privilege change arriving disguised as a reformat.

7 and 8 were found on 2026-10-04 by a mutation sweep run *because a verdict had
been recorded without a measurement*: #64 said "13 guards, mutation-tested both
directions" and gave no result per guard. Re-running it properly is what surfaced
them. Reproduce the sweep with:

```
python scripts/mutation-harness.py scripts/schema-drift \
       scripts/schema-drift/mutations.json
```

**All eight were found by mutation-testing a guard or by reading output. None was
found by review**, including by the review that read the same files looking for
exactly this. A tool that catches defects is not thereby free of them, and the
practice that found these is the one most easily described as overhead.

Three rules follow. The first two are a pair; the third generalises past this
check entirely:

- **A guard is not done until it has been mutation-tested.** A guard with no
  recorded red state is not evidence that anything is checked — four of the six
  above were guards that could not fail.
- **READING THE OUTPUT *IS* THE CHECK.** A green badge says a process exited 0.
  It does not say what the process compared, how many rows it read, or whether it
  compared anything at all. Defects 1, 2, 5 and 6 all sat behind a green or a red
  that nobody had read the body of — and #6 was found only because the version
  abort forced someone to look at what the comparison actually printed.
- **A REDUNDANT CHECK IS NOT FREE THE WAY REDUNDANT STORAGE IS.** Two guards
  asserting the same precondition do not give you two chances to catch it: **the
  first one to speak defines the diagnosis, and nobody reads the second.** The CI
  copy of the RLS credentials check ran before the preflight and checked less —
  no variable names, no host check — so its weaker message is the one anybody
  would ever have seen, and the better one was unreachable in practice. When a
  check is duplicated, either delete the copy or make it *call* the original.

A corollary for any tool that reports on other tools, learned by breaking one:
**a summary must be computed from the data it summarises, never parsed out of it
a second, independent way.** The mutation harness derived its verdict from a
regex while printing a tally parsed separately, and printed `NO TEST WENT RED`
beneath `2 failed, 10 passed` three times in a row. A summary that *can* disagree
with its own data is a second source of truth about one fact. And a
*known*-broken instrument is worse than an unknown-broken one: the surprise is
already spent, so the next wrong reading does not startle anybody — that harness
was used twice more after it was first seen misreporting.
