# Story 11.5: CI/CD & Test Coverage Hardening

Status: ready-for-dev

**Type:** Infrastructure
**Category:** Testing | CI/CD | Security
**Priority:** MEDIUM

## Story

As a platform engineer,
I want to harden the CI/CD pipeline with meaningful coverage thresholds, security scanning, and fix the gaps that allow low-quality code to pass,
So that the pipeline actually catches regressions and vulnerabilities before they reach production.

## Acceptance Criteria

**AC-11.5.1:** Raise Coverage Threshold
- In `.github/workflows/test.yml`, increase the coverage threshold from 5% to at least 30%
- Remove aspirational comments about targets and enforce the actual threshold

**AC-11.5.2:** Fix continue-on-error on Environment Check
- Remove `continue-on-error: true` from the environment variable check step in test.yml
- Environment validation should block the pipeline if required vars are missing

**AC-11.5.3:** Add npm audit to CI Pipeline
- Add a step in test.yml that runs `npm audit --audit-level=high` to catch known dependency vulnerabilities
- Use `continue-on-error: true` initially (advisory), with a plan to make it blocking

**AC-11.5.4:** Add Critical Missing Tests
- Add tests for the middleware (src/middleware.ts) - auth bypass, protected routes, public routes
- Add tests for at least 3 untested API routes (profile-picture, exchange-rates, insights/generate)
- Target: bring real line coverage above the new threshold

**AC-11.5.5:** Reduce Console Log Noise
- Replace raw `console.log/error/warn` calls in API routes with a thin logger utility that respects log levels
- Create `src/lib/utils/logger.ts` with `debug`, `info`, `warn`, `error` methods
- Suppress debug/info logs in production, keep warn/error

## Tasks / Subtasks

- [ ] Raise coverage threshold (AC: 11.5.1)
  - [ ] Update threshold check from 5% to 30% in test.yml
  - [ ] Remove aspirational comment
- [ ] Fix continue-on-error (AC: 11.5.2)
  - [ ] Remove `continue-on-error: true` from env check step
- [ ] Add npm audit step (AC: 11.5.3)
  - [ ] Add step after `npm ci` that runs `npm audit --audit-level=high`
  - [ ] Set `continue-on-error: true` for initial rollout
- [ ] Add critical missing tests (AC: 11.5.4)
  - [ ] Write middleware tests (auth bypass, protected routes, redirects)
  - [ ] Write exchange-rates route tests
  - [ ] Write insights/generate route tests
  - [ ] Write profile-picture route tests
- [ ] Create logger utility (AC: 11.5.5)
  - [ ] Create `src/lib/utils/logger.ts`
  - [ ] Replace console calls in API routes with logger
  - [ ] Respect NODE_ENV for log level filtering
- [ ] Verify all tests pass and coverage meets new threshold
