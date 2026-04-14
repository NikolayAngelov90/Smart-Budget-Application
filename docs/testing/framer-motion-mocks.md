# Framer Motion Mocking Guide

## Problem

Framer Motion components (`motion.div`, `AnimatePresence`, etc.) cause test failures or unexpected behavior in Jest because:

1. They rely on browser animation APIs not available in jsdom
2. `AnimatePresence` delays unmounting, which breaks assertions that expect immediate DOM removal
3. Layout animations can interfere with element positioning queries

## Solution Architecture

We use a **two-level mock strategy**:

### Level 1: Global mock in `jest.setup.ts`

`jest.setup.ts` (or `jest.setup.js`) mounts a blanket mock for the entire test suite:

```ts
jest.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        // eslint-disable-next-line react/display-name
        ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
          React.createElement(tag, props, children),
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useAnimation: () => ({ start: jest.fn(), stop: jest.fn() }),
  useMotionValue: (initial: number) => ({ get: () => initial, set: jest.fn() }),
  useTransform: () => ({ get: jest.fn() }),
}));
```

This gives every `motion.div`, `motion.span`, etc. a passthrough implementation — they render as plain HTML elements with all non-animation props forwarded.

### Level 2: Local override in individual test files

When a test needs **different** framer-motion behavior (e.g., testing that an animation _does not_ fire, or testing a component that uses `useAnimation` return values), override locally:

```ts
// Override just AnimatePresence for this file
jest.mock('framer-motion', () => ({
  ...jest.requireActual('framer-motion'), // keep real implementations
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
```

**Important:** A local `jest.mock()` call at the top of a test file **completely replaces** the global mock for that module in that file. It does not merge with the global setup mock — you must spread `jest.requireActual` or re-declare everything you need.

## Common Pitfall: Unexpected Mock Conflict

**Symptom**: A test that uses `waitFor` to assert an element is removed from the DOM never resolves, even though the component correctly removes the element.

**Cause**: The global mock's `AnimatePresence` may still wrap exit children depending on the version. If a component uses a local framer-motion import that partially bypasses the global mock, animation delays re-emerge.

**Fix**: Add a local mock at the top of the affected test file that explicitly stubs `AnimatePresence`:

```ts
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
```

## Decision Rule

| Situation | Approach |
|---|---|
| Normal component tests | Rely on global mock — no action needed |
| Testing animation-dependent state (e.g., exit renders) | Add local mock to the test file |
| Testing a hook that returns motion values | Spy on `useMotionValue` return in the local mock |
| Integration test that tests full render tree | Global mock is sufficient; don't use `requireActual` (it will attempt browser APIs) |

## File Locations

- Global mock: `jest.setup.ts` (root)
- Example local override: `src/components/__tests__/TransactionModal.test.tsx`

## Related

- [Jest setup configuration](../../jest.config.js)
- [Integration test guide](./integration-test-guide.md)
