# Story 9.9: Modernize tsconfig.json

Status: drafted

## Story

As a developer,
I want a modernized TypeScript configuration with strict type checking and path aliases,
So that I can catch type errors earlier, use cleaner imports, and leverage modern JavaScript features.

## Acceptance Criteria

**AC-9.9.1:** Enable Strict Mode
✅ Enable `strict: true` for full type safety (includes strictNullChecks, strictFunctionTypes, etc.)

**AC-9.9.2:** Add Path Aliases
✅ Configure path aliases: `@/lib/*`, `@/components/*`, `@/types/*`, `@/app/*`

**AC-9.9.3:** Update ES Target
✅ Update `target` to ES2022 (modern JavaScript features, better browser support)

**AC-9.9.4:** Modern Module Resolution
✅ Enable `moduleResolution: "bundler"` (Next.js 13+ recommended)

**AC-9.9.5:** Enable Library Checking
✅ Set `skipLibCheck: false` to catch third-party type errors (or keep `true` if too noisy)

**AC-9.9.6:** Fix New Type Errors
✅ Fix all new TypeScript errors introduced by strict mode

**AC-9.9.7:** Update Imports to Use Path Aliases
✅ Refactor all imports to use new path aliases (e.g., `@/lib/services/...` instead of `../../lib/services/...`)

**AC-9.9.8:** Validate Build
✅ Verify build succeeds with zero TypeScript errors

**AC-9.9.9:** Update Documentation
✅ Document tsconfig changes and path alias usage in developer guide

## Tasks / Subtasks

- [ ] Backup current tsconfig.json (AC: All)
  - [ ] Copy current `tsconfig.json` to `tsconfig.json.backup`
  - [ ] Review current configuration to understand baseline

- [ ] Enable strict mode (AC: 9.9.1, 9.9.6)
  - [ ] Update `tsconfig.json`: `"strict": true`
  - [ ] Run type check: `npx tsc --noEmit`
  - [ ] Capture all new TypeScript errors
  - [ ] Fix errors one by one:
    - [ ] Add null checks for potentially undefined values
    - [ ] Add proper type annotations for function parameters
    - [ ] Fix implicit `any` types
    - [ ] Fix strictNullChecks violations (e.g., `user.name` → `user?.name`)
    - [ ] Fix strictFunctionTypes issues
  - [ ] Verify zero TypeScript errors

- [ ] Configure path aliases (AC: 9.9.2, 9.9.7)
  - [ ] Update `tsconfig.json` `compilerOptions.paths`:
    ```json
    {
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "@/lib/*": ["src/lib/*"],
          "@/components/*": ["src/components/*"],
          "@/types/*": ["src/types/*"],
          "@/app/*": ["src/app/*"],
          "@/*": ["src/*"]
        }
      }
    }
    ```
  - [ ] Update all import statements across codebase:
    - [ ] Replace `../../lib/services/transactionService` with `@/lib/services/transactionService`
    - [ ] Replace `../../../components/Button` with `@/components/Button`
    - [ ] Replace `../../types/transaction.types` with `@/types/transaction.types`
  - [ ] Use find-and-replace or automated script for bulk updates

- [ ] Update ES target and module resolution (AC: 9.9.3, 9.9.4)
  - [ ] Update `tsconfig.json`:
    ```json
    {
      "compilerOptions": {
        "target": "ES2022",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "moduleResolution": "bundler"
      }
    }
    ```
  - [ ] Verify build still works with new target

- [ ] Configure library checking (AC: 9.9.5)
  - [ ] Evaluate `skipLibCheck: false` vs `true`
  - [ ] If too many third-party errors, keep `skipLibCheck: true` with comment explaining why
  - [ ] Otherwise, set `skipLibCheck: false` and fix third-party type errors

- [ ] Add additional strict options (AC: 9.9.1)
  - [ ] Enable `noUncheckedIndexedAccess: true` (arrays and objects require null checks)
  - [ ] Enable `noImplicitOverride: true` (require `override` keyword)
  - [ ] Enable `noFallthroughCasesInSwitch: true` (switch statement safety)
  - [ ] Enable `forceConsistentCasingInFileNames: true` (cross-platform safety)

- [ ] Validate build and tests (AC: 9.9.8)
  - [ ] Run build: `npm run build`
  - [ ] Verify build succeeds with zero errors
  - [ ] Run type check: `npm run type-check`
  - [ ] Verify zero TypeScript errors
  - [ ] Run tests: `npm test`
  - [ ] Verify all tests still pass (imports not broken by path alias changes)

- [ ] Update Jest configuration (AC: 9.9.2)
  - [ ] Update `jest.config.js` to support path aliases:
    ```js
    module.exports = {
      moduleNameMapper: {
        '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
        '^@/components/(.*)$': '<rootDir>/src/components/$1',
        '^@/types/(.*)$': '<rootDir>/src/types/$1',
        '^@/app/(.*)$': '<rootDir>/src/app/$1',
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    };
    ```

- [ ] Update documentation (AC: 9.9.9)
  - [ ] Create or update `docs/development/typescript-guide.md`
  - [ ] Document strict mode benefits and common patterns
  - [ ] Document path alias usage with examples
  - [ ] Document how to add new path aliases
  - [ ] Add troubleshooting section for common strict mode errors

- [ ] Create migration guide (AC: 9.9.9)
  - [ ] Document breaking changes from tsconfig update
  - [ ] Provide examples of strict mode fixes:
    ```typescript
    // Before (loose)
    function getUserName(user) {
      return user.name;
    }

    // After (strict)
    function getUserName(user: User | null): string {
      return user?.name ?? 'Unknown';
    }
    ```

## Dev Notes

- **Why Strict Mode?** Catches bugs at compile time instead of runtime. Prevents common errors like null reference exceptions, type mismatches.
- **Why Path Aliases?** Cleaner imports, easier refactoring, less brittle (no need to update `../../../` when moving files).
- **Why ES2022?** Modern JavaScript features (top-level await, class fields, optional chaining). ES2022 supported by all modern browsers and Node.js 16+.
- **Breaking Changes:** Enabling strict mode will introduce many TypeScript errors. Budget time for fixing (estimated 4-8 hours based on codebase size).
- **Incremental Adoption:** If strict mode errors overwhelming, consider enabling strict checks one at a time (`strictNullChecks`, `strictFunctionTypes`, etc.).

### Project Structure Notes

**Modified Files:**
- `tsconfig.json` - Main TypeScript configuration
- `jest.config.js` - Add path alias support for tests
- All `.ts` and `.tsx` files - Update imports to use path aliases, fix strict mode errors
- `docs/development/typescript-guide.md` - Documentation

**New Files:**
- `tsconfig.json.backup` - Backup of original config

**Example tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/lib/*": ["src/lib/*"],
      "@/components/*": ["src/components/*"],
      "@/types/*": ["src/types/*"],
      "@/app/*": ["src/app/*"],
      "@/*": ["src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

**Alignment with Architecture:**
- TypeScript for type safety (existing pattern)
- Next.js 13+ best practices (bundler module resolution)
- Modern JavaScript features (ES2022 target)

### References

- [Tech Spec: Epic 9 - Story 9-9 Acceptance Criteria](../tech-spec-epic-9.md#story-9-9-modernize-tsconfigjson)
- [Epic 8 Retrospective: TypeScript Type Issues](../epic-8-retrospective.md#what-could-improve-)
- [TypeScript Strict Mode Documentation](https://www.typescriptlang.org/tsconfig#strict)
- [Next.js TypeScript Documentation](https://nextjs.org/docs/app/building-your-application/configuring/typescript)
- [TypeScript Path Mapping Documentation](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)

## Dev Agent Record

### Context Reference

- [Story 9-9 Context](9-9-modernize-tsconfig.context.xml) - To be created during dev workflow

### Agent Model Used

TBD (Claude Sonnet 4.5)

### Debug Log References

TBD

### Completion Notes List

TBD - To be filled during implementation

### File List

TBD - To be filled during implementation
