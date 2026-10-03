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

## Known and unmitigated: the Docker Hub anonymous pull limit

`supabase start` pulls the local stack from Docker Hub. The anonymous pull limit
is **per IP**, and GitHub's runner IPs are shared, so the pull hits
`toomanyrequests` and retries:

| run | date | `toomanyrequests` occurrences | stack came up |
| --- | --- | --- | --- |
| 36862540428 | 2026-10-01 | 18 | yes |
| 37003980887 | 2026-10-02 | 19 | yes |
| 37118890489 | 2026-10-03 | 16 | yes |

Survived three times is not survivable. When it does stop the stack, the failure
will read as an infrastructure flake — which is how it gets re-run instead of
fixed. Two things are in place for that: the `Start Supabase` step captures its
output and emits a `::error::` **naming** the rate limit as the cause when the
step fails on it, and the count is printed even on a green run so the trend is
readable before the day it matters.

**The remedy itself is not in place, and needs a credential this repository does
not have.** Three options were considered:

1. **Authenticate the pull** — moves the limit from per-IP-anonymous to
   per-account, which is the actual fix. It needs a Docker Hub account and a
   read-only access token as `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`. The
   workflow step exists and is **inert until those secrets are set**; it prints
   which state it is in rather than passing quietly, because an unmitigated state
   that looks identical to a mitigated one is the shape of defect this repository
   keeps finding. **This is the chosen option, pending the credential.**
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

So: filed, counted, named when it bites, and honestly unfixed.
