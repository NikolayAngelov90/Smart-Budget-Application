# Story 9.8: Create Deployment Checklist

Status: drafted

## Story

As a DevOps engineer,
I want a comprehensive pre-deployment checklist and automated validation script,
So that I can verify all critical systems are ready before production deployment and prevent deployment failures.

## Acceptance Criteria

**AC-9.8.1:** Deployment Checklist Document
✅ Create `docs/deployment-checklist.md` with comprehensive pre-deployment validation steps

**AC-9.8.2:** Environment Variable Validation
✅ Checklist includes verification of all required environment variables (Supabase, Redis, Analytics)

**AC-9.8.3:** Database Migration Verification
✅ Checklist includes steps to verify database migrations applied successfully

**AC-9.8.4:** Build and Type Check Validation
✅ Checklist includes commands to run build and type check

**AC-9.8.5:** Test Suite Execution
✅ Checklist includes running full test suite (unit + integration tests)

**AC-9.8.6:** Performance Benchmarks
✅ Checklist includes Lighthouse CI or performance validation steps

**AC-9.8.7:** Automated Validation Script
✅ Create `scripts/pre-deployment-check.js` (or .sh) to automate checklist validation

**AC-9.8.8:** Exit Codes and CI Integration
✅ Script exits with code 0 (success) or 1 (failure) for CI/CD integration

**AC-9.8.9:** Verbose Output
✅ Script provides clear output for each check (✅ PASS, ❌ FAIL, ⚠️ WARNING)

**AC-9.8.10:** Documentation
✅ README section or deployment guide explaining how to use checklist and script

## Tasks / Subtasks

- [ ] Create deployment checklist document (AC: 9.8.1-9.8.6)
  - [ ] Create `docs/deployment-checklist.md`
  - [ ] Add header and introduction explaining purpose
  - [ ] Section 1: Environment Variables
    - [ ] List all required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_POSTHOG_KEY`
    - [ ] Validation command: `node scripts/check-env-vars.js`
  - [ ] Section 2: Database Migrations
    - [ ] Command to check migration status: `supabase db diff`
    - [ ] Command to apply migrations: `supabase db push`
    - [ ] Verify no pending migrations before deployment
  - [ ] Section 3: Build Validation
    - [ ] Run build: `npm run build`
    - [ ] Verify build succeeds with no errors
    - [ ] Check build output size (warn if bundle > 1MB)
  - [ ] Section 4: Type Check
    - [ ] Run type check: `npm run type-check` (or `npx tsc --noEmit`)
    - [ ] Verify zero TypeScript errors
  - [ ] Section 5: Test Suite
    - [ ] Run all tests: `npm test`
    - [ ] Verify 100% test pass rate (no failures, no skipped tests)
    - [ ] Check test coverage: `npm run test:coverage` (optional)
  - [ ] Section 6: Performance Benchmarks
    - [ ] Run Lighthouse CI: `npm run lighthouse` (if configured)
    - [ ] Verify performance score ≥ 90
    - [ ] Check accessibility score ≥ 95
  - [ ] Section 7: Manual Checks
    - [ ] Verify Supabase RLS policies enabled
    - [ ] Verify Redis connection healthy
    - [ ] Verify analytics tracking enabled (if production)
    - [ ] Verify error tracking configured (Sentry, etc.)
  - [ ] Section 8: Deployment
    - [ ] Deploy to staging first
    - [ ] Smoke test critical flows (login, transactions, insights)
    - [ ] Deploy to production
    - [ ] Monitor error logs for 15 minutes post-deployment

- [ ] Create automated validation script (AC: 9.8.7-9.8.9)
  - [ ] Create `scripts/pre-deployment-check.js` (Node.js script)
  - [ ] Check 1: Environment variables
    - [ ] Read required env vars from `.env.example` or hardcoded list
    - [ ] Verify all required vars present
    - [ ] Output: ✅ Environment variables: OK or ❌ Missing: REDIS_URL
  - [ ] Check 2: Database migrations
    - [ ] Run `supabase db diff` and capture output
    - [ ] Verify no pending migrations
    - [ ] Output: ✅ Database migrations: Up to date
  - [ ] Check 3: Build
    - [ ] Run `npm run build` and capture exit code
    - [ ] Verify exit code 0 (success)
    - [ ] Output: ✅ Build: Success or ❌ Build failed (see logs)
  - [ ] Check 4: Type check
    - [ ] Run `npx tsc --noEmit` and capture exit code
    - [ ] Verify exit code 0 (no TypeScript errors)
    - [ ] Output: ✅ Type check: Passed
  - [ ] Check 5: Tests
    - [ ] Run `npm test` and capture exit code
    - [ ] Verify exit code 0 (all tests passed)
    - [ ] Output: ✅ Tests: All passed (300/300)
  - [ ] Check 6: Redis health (optional)
    - [ ] Ping Redis endpoint: `GET /api/health/redis`
    - [ ] Verify 200 response with `status: 'healthy'`
    - [ ] Output: ✅ Redis: Healthy or ⚠️ Redis: Not configured (skipping)
  - [ ] Final summary:
    - [ ] If all checks pass: `✅ PRE-DEPLOYMENT CHECKS PASSED - Ready to deploy!`
    - [ ] If any check fails: `❌ PRE-DEPLOYMENT CHECKS FAILED - Fix errors before deploying`
  - [ ] Exit with code 0 (all pass) or 1 (any fail)

- [ ] Add CI/CD integration support (AC: 9.8.8)
  - [ ] Create `.github/workflows/pre-deployment.yml` (GitHub Actions example)
  - [ ] Workflow triggers on: push to `main` branch
  - [ ] Steps:
    - [ ] Checkout code
    - [ ] Setup Node.js
    - [ ] Install dependencies
    - [ ] Run `node scripts/pre-deployment-check.js`
    - [ ] Fail workflow if script exits with code 1
  - [ ] (Optional) Add deployment gate: require pre-deployment checks to pass before manual approval

- [ ] Write documentation (AC: 9.8.10)
  - [ ] Add "Deployment" section to main README.md
  - [ ] Link to `docs/deployment-checklist.md`
  - [ ] Document manual checklist usage (for humans)
  - [ ] Document automated script usage:
    ```bash
    # Run pre-deployment checks
    node scripts/pre-deployment-check.js

    # Or use npm script
    npm run pre-deploy
    ```
  - [ ] Add CI/CD integration instructions

- [ ] Create helper scripts (AC: 9.8.2)
  - [ ] Create `scripts/check-env-vars.js`
  - [ ] Read required env vars from list
  - [ ] Check if present in process.env
  - [ ] Exit with code 0 (all present) or 1 (missing vars)

- [ ] Add npm scripts (AC: 9.8.7)
  - [ ] Add to `package.json`:
    ```json
    {
      "scripts": {
        "pre-deploy": "node scripts/pre-deployment-check.js",
        "type-check": "tsc --noEmit",
        "test:coverage": "jest --coverage"
      }
    }
    ```

- [ ] Write tests for validation script (AC: All)
  - [ ] Test script exits with 0 when all checks pass
  - [ ] Test script exits with 1 when environment vars missing
  - [ ] Test script exits with 1 when build fails
  - [ ] Test script exits with 1 when type check fails
  - [ ] Test script exits with 1 when tests fail
  - [ ] Test output formatting (✅, ❌, ⚠️ symbols)

## Dev Notes

- **Problem Solved:** Currently no formal pre-deployment checklist. Deployments rely on developer memory, leading to potential issues (missing env vars, migrations not applied, broken build).
- **Automation:** Manual checklists are prone to human error. Automated script ensures consistency and can be integrated into CI/CD pipeline.
- **CI/CD Integration:** Script designed to work in GitHub Actions, GitLab CI, CircleCI, etc. Exit codes (0/1) are standard for CI systems.
- **Performance Benchmarks:** Lighthouse CI is optional but recommended. Requires setup (lighthouse npm package, CI config).

### Project Structure Notes

**New Files:**
- `docs/deployment-checklist.md` - Manual deployment checklist
- `scripts/pre-deployment-check.js` - Automated validation script
- `scripts/check-env-vars.js` - Environment variable checker
- `.github/workflows/pre-deployment.yml` - GitHub Actions workflow (example)

**Modified Files:**
- `package.json` - Add npm scripts: `pre-deploy`, `type-check`, `test:coverage`
- `README.md` - Add "Deployment" section with checklist link

**Example Script Output:**
```bash
$ node scripts/pre-deployment-check.js

🚀 PRE-DEPLOYMENT VALIDATION
============================

✅ Environment variables: All required variables present
✅ Database migrations: Up to date
✅ Build: Success (output size: 847 KB)
✅ Type check: Passed (0 errors)
✅ Tests: All passed (300/300)
⚠️  Redis health: Skipping (not configured in dev environment)
⚠️  Lighthouse: Skipping (lighthouse not installed)

============================
✅ PRE-DEPLOYMENT CHECKS PASSED
Ready to deploy!
============================

Exit code: 0
```

**Alignment with Architecture:**
- Node.js scripting (consistent with existing tooling)
- CI/CD ready (exit codes, verbose output)
- No production code changes (developer/DevOps tooling only)

### References

- [Tech Spec: Epic 9 - Story 9-8 Acceptance Criteria](../tech-spec-epic-9.md#story-9-8-create-deployment-checklist)
- [Epic 8 Retrospective: Deployment Checklist Needed](../epic-8-retrospective.md#recommended-actions-for-future-epics)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)

## Dev Agent Record

### Context Reference

- [Story 9-8 Context](9-8-create-deployment-checklist.context.xml) - To be created during dev workflow

### Agent Model Used

TBD (Claude Sonnet 4.5)

### Debug Log References

TBD

### Completion Notes List

TBD - To be filled during implementation

### File List

TBD - To be filled during implementation
