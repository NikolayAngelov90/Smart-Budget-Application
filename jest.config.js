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
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    // Test-only helper — exercised by its own suite, but it is scaffolding,
    // not shipped code, so it should not move the coverage ratio.
    '!src/test-utils/**',
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
