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

Ensure all Supabase migrations have been applied.

**Migration files (in order):**
1. `001_initial_schema.sql` - Core tables (users, transactions, categories)
2. `002_insights_rls_policies.sql` - Row-level security for insights
3. `003_insights_engagement_analytics.sql` - Analytics tracking tables
4. `004_user_profiles_table.sql` - User profile data
5. `005_analytics_events_table.sql` - Event analytics
6. `006_user_sessions_table.sql` - Device session management

**Verification:**
```bash
# Check for pending migrations
supabase db diff

# Apply migrations
supabase db push
```

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
| `test.yml` | PR, push to main | Type check, lint, tests, build, benchmarks, deploy |
| `lighthouse.yml` | PR | Performance, accessibility, best practices |
| `coverage.yml` | Daily / manual | Test coverage report |

---

## Rollback Procedure

If issues are found after deployment:

1. Revert to previous deployment in Vercel dashboard
2. If database migration caused issues, apply rollback SQL manually
3. Verify rollback succeeded with smoke tests
4. Investigate root cause before re-deploying
