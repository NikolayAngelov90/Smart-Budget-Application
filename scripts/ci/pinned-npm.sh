#!/usr/bin/env bash
# ONE npm version for local and CI: the one package.json pins in "packageManager".
#
# WHY. In PR #104 a lockfile written by local npm 11.6.3 passed every local gate
# and failed `npm ci` in CI, where Node 22 bundles npm 10. The two majors resolve
# an optional peer dependency differently. "Dry-run with CI's npm before pushing"
# is a rule someone has to remember; this script makes the CI side follow the pin.
#
#   bash scripts/ci/pinned-npm.sh           install the pinned npm globally, then verify
#   bash scripts/ci/pinned-npm.sh --check   verify only: the npm on PATH IS the pinned one
#
# It FAILS (never warns) when the pin is missing or malformed, or when the npm on
# PATH after installing is not the pinned version. A pin that is silently skipped
# looks identical to a pin that works.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
spec="$(cd "$repo_root" && node -p "require('./package.json').packageManager || ''")"

if [[ ! "$spec" =~ ^npm@([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo "::error::package.json \"packageManager\" must be npm@X.Y.Z, got '${spec}'. Without it there is no pinned npm, and local and CI installs can write and read the lockfile with different npm majors (see PR #104)."
  exit 1
fi
want="${BASH_REMATCH[1]}"

if [[ "${1:-}" != "--check" ]]; then
  # From outside the repo, so nothing in the project's package.json can get in the way.
  (cd "${RUNNER_TEMP:-/tmp}" && npm install --global "npm@${want}" --no-audit --no-fund)
fi

have="$(npm --version)"
if [[ "$have" != "$want" ]]; then
  echo "::error::npm on PATH is ${have}; package.json pins ${want} (packageManager). Install it with: npm install --global npm@${want}"
  exit 1
fi
echo "pinned npm OK: ${have} (package.json packageManager: ${spec})"
