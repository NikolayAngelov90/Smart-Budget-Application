const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  // NAMING THESE REPLACES JEST'S DEFAULTS, so node_modules and .next are
  // re-listed deliberately rather than inherited.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/\.next/',
    // The masked-failure detector's MUST-FIND CONTROL. It is deliberately dirty
    // - it passes while emitting a swallowed TypeError - so it must never run in
    // the ordinary suite, never print its noise, and never count toward the test
    // tally or the CI floor. scripts/ci/detect-masked-failures.sh runs it by
    // overriding this ignore, which is the only context it belongs in.
    'masked-failure-fixture',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    // TEST-SUPPORT CODE IS NOT PRODUCT CODE, so it must not move the coverage
    // ratio either way. src/lib/test-utils was missing here until 2026-11-18:
    // it was instrumented but never run by the unit suite, read as 0%, and
    // turned codecov/patch red on rlsClient.ts - code that runs in the RLS job.
    // The SAME patterns are in codecov.yml; scripts/ci/check-coverage-scope.mjs
    // fails CI if a support file reaches the report or a product file leaves it.
    '!src/test-utils/**',
    '!src/lib/test-utils/**',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  coverageReporters: [
    'text',           // Display coverage in terminal
    'lcov',           // Generate lcov.info for Codecov
    'json',           // Generate coverage-final.json for Codecov
    'json-summary',   // Generate coverage-summary.json for threshold check
  ],
  // Story 9.1, 10-1: Transform ESM modules (upstash, next-intl, use-intl)
  transformIgnorePatterns: [
    'node_modules/(?!(@upstash|uncrypto|next-intl|use-intl)/)',
  ],
  // Coverage thresholds removed here - allowing gradual improvement.
  //
  // TWO INSTRUMENTS, DIFFERENT JOBS, AND ONLY ONE CAN FIRE ON ORDINARY WORK:
  //
  //   test.yml "Check coverage threshold" - a CATASTROPHE CANARY, not a drift
  //     gate. It fails below 30% on Math.min across the four metrics; the real
  //     figure is 57.29% (branches, the lowest), so no incremental change moves
  //     it. It fires if someone deletes the test suite. That is worth having and
  //     it is NOT coverage protection.
  //
  //   codecov.yml patch/project - the actual drift gate. `target: auto` with a
  //     1% threshold compares against the BASE COMMIT, so it can and does fail on
  //     ordinary work: it caught EmptyInsightsState at 0% patch on PR #59.
  //
  // A gate labelled as protecting coverage that cannot fail is decorative. This
  // one is harmless only because the real gate sits beside it - so say which is
  // which, here and in test.yml.
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
