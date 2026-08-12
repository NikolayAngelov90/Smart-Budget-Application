# Deployment Checklist

Pre-deployment validation guide for the Smart Budget Application.

## Quick Start (Automated)

```bash
# Run all pre-deployment checks automatically
npm run pre-deploy
```

The script validates environment variables, type checking, linting, tests, and build. See [Automated Validation](#automated-validation) for details.

---

## Manual Checklist

### 1. Environment Variables

Verify all required environment variables are set for the target environment.

**Required (All Environments):**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

**Required (Production):**
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth client ID
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- [ ] `GITHUB_CLIENT_ID` - GitHub OAuth client ID
- [ ] `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret
- [ ] `CRON_SECRET` - Cron job authentication (min 32 chars)
- [ ] `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL
- [ ] `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST token
- [ ] `NEXT_PUBLIC_APP_URL` - Deployed application URL

**Validation:**
```bash
node scripts/check-env-vars.js
```

### 2. Database Migrations

**Migrations deploy themselves on merge to `main`. Do not apply them by hand.**

The Supabase GitHub integration applies anything in `supabase/migrations/` that
is not yet recorded in the production ledger
(`supabase_migrations.schema_migrations`), and reports the outcome as the
**Supabase Preview** check on the merge commit.

**Why this changed (2026-08-12).** Migrations `001`–`040` were applied manually
in the SQL editor, which records nothing in the ledger. The integration therefore
believed all 39 were pending and, on every push to `main`, tried to replay them
against the live database — failing on the first `CREATE TYPE` because
production already had it. The check had never once succeeded. The ledger has now
been backfilled so it reflects reality.

**What that means in practice:**

- Add the migration file, open a PR, merge it. That is the whole process.
- **Check the "Supabase Preview" check on the merge commit** — it is the only
  signal that the migration actually landed. Green means applied.
- Applying by hand *as well* is now actively harmful: the statement runs, the
  ledger stays empty for that file, and the integration tries to apply it again
  on the next push.

**Filename convention.** `001`–`040` use an `NNN_` prefix. The two newest use
Supabase timestamp versions (`20260731072929_…`) because they were applied via
the MCP `apply_migration` tool, which records that form and requires the
filename to match. **New migrations should use the timestamp form** — it is what
the tooling expects, and it sorts after the numbered ones.

**Verification:** compare `supabase/migrations/` against the ledger — Supabase
dashboard → Database → Migrations. Anything in the folder but not in that list is
pending.

### 3. Type Check

```bash
npm run type-check
```
- [ ] Zero TypeScript errors

### 4. Linting

```bash
npm run lint
```
- [ ] Zero ESLint warnings or errors

### 5. Test Suite

```bash
npm test
```
- [ ] All tests passing
- [ ] No skipped tests

**With coverage:**
```bash
npm run test:coverage
```
- [ ] Coverage thresholds met (minimum 5%, target 30%)

### 6. Production Build

```bash
npm run build
```
- [ ] Build completes without errors
- [ ] No unexpected warnings

### 7. Performance Benchmarks

```bash
npm run benchmark
```
- [ ] Dashboard load < 2000ms
- [ ] Pie chart render < 100ms
- [ ] Line chart render < 150ms
- [ ] Real-time latency < 300ms

**Lighthouse CI (runs automatically on PRs):**
- [ ] Performance score >= 90
- [ ] Accessibility score >= 95
- [ ] Best Practices score >= 90

### 8. Pre-Deployment Manual Checks

- [ ] Supabase RLS policies enabled on all tables
- [ ] Redis connection healthy (`GET /api/health/redis`)
- [ ] OAuth redirect URIs updated for production domain
- [ ] CORS settings configured for production domain
- [ ] Error monitoring configured (if applicable)

### 9. Deployment

1. [ ] Deploy to staging first
2. [ ] Smoke test critical flows:
   - [ ] User registration and login
   - [ ] Social login (Google, GitHub)
   - [ ] Create/edit/delete transactions
   - [ ] View dashboard and charts
   - [ ] View and interact with insights
   - [ ] Export transactions (CSV/PDF)
   - [ ] Settings page loads
3. [ ] Deploy to production
4. [ ] Monitor error logs for 15 minutes post-deployment
5. [ ] Verify health endpoints respond:
   - `GET /api/health/redis` returns healthy status

---

## Automated Validation

The `scripts/pre-deployment-check.js` script automates checks 1-6.

```bash
npm run pre-deploy
```

**Output format:**
```
PRE-DEPLOYMENT VALIDATION
============================
[PASS] Environment variables: All 10 required variables present
[PASS] Type check: Passed (0 errors)
[PASS] Lint: Passed (0 warnings)
[PASS] Tests: All passed
[PASS] Build: Success
============================
PRE-DEPLOYMENT CHECKS PASSED
Ready to deploy!
```

**Exit codes:**
- `0` - All checks passed
- `1` - One or more checks failed

**CI/CD Integration:**
The script is designed for CI pipelines. The existing `.github/workflows/test.yml` workflow already runs these checks on every push to main. Use the script for local pre-deployment validation.

---

## CI/CD Workflows

| Workflow | Trigger | Checks |
|----------|---------|--------|
| `test.yml` | PR, push to main | Env-check, type check, lint, tests, build, benchmarks, pre-deployment-check, deploy, Vercel preview URL |
| `lighthouse.yml` | PR | Performance (≥90), accessibility (≥90), best practices (≥90) |
| `coverage.yml` | Daily / manual | Test coverage report |

### Pipeline Steps Added in Story 10-10

- **Env-check step** (`test` job): Runs `scripts/check-env-vars.js` with all required production secrets before the build step. Uses `continue-on-error: true` to avoid blocking forks without secrets configured.
- **Pre-deployment check** (`deploy` job): Runs `scripts/pre-deployment-check.js` after installing dependencies and before the Vercel deploy steps. Validates type-check, lint, tests, and build in the deploy environment.
- **Vercel preview URL** (`test` job, PR only): Deploys a preview build to Vercel and posts the preview URL as a PR comment using `actions/github-script`.
- **CI badge**: `README.md` now shows the live CI status badge linked to the `test.yml` workflow on `main`.

---

## Rollback Procedure

If issues are found after deployment:

1. Revert to previous deployment in Vercel dashboard
2. If database migration caused issues, apply rollback SQL manually
3. Verify rollback succeeded with smoke tests
4. Investigate root cause before re-deploying
