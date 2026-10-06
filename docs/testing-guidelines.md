# Testing Guidelines

This document outlines testing standards, patterns, and best practices for the Smart Budget Application.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Types](#test-types)
- [Test File Organization](#test-file-organization)
- [Testing Tools and Setup](#testing-tools-and-setup)
- [Mocking Strategies](#mocking-strategies)
- [Browser Tests (Playwright)](#browser-tests-playwright)
- [Writing Good Tests](#writing-good-tests)
- [Coverage Expectations](#coverage-expectations)
- [Running Tests](#running-tests)
- [Common Testing Patterns](#common-testing-patterns)

## Testing Philosophy

Our testing approach prioritizes:

1. **Behavior over Implementation**: Test what the code does, not how it does it
2. **User-Centric Testing**: Test from the user's perspective using semantic queries
3. **Maintainability**: Write tests that are resilient to refactoring
4. **Fast Feedback**: Keep tests fast to encourage frequent execution
5. **Confidence**: Focus on critical paths and edge cases that matter

## Test Types

### Unit Tests

Test individual functions, utilities, and business logic in isolation.

**When to Write:**
- Pure functions and utilities
- Business logic (calculations, validations, transformations)
- Service layer functions
- Helper functions

**Example:**
```typescript
// __tests__/lib/utils/formatters.test.ts
import { formatCurrency, formatDate } from '@/lib/utils/formatters';

describe('formatCurrency', () => {
  it('formats positive amounts with currency symbol', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats negative amounts with minus sign', () => {
    expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatCurrency(10.999)).toBe('$11.00');
  });
});
```

### Component Tests

Test React components in isolation with mocked dependencies.

**When to Write:**
- UI components
- Forms and validation
- User interactions
- Conditional rendering
- Accessibility features

**Example:**
```typescript
// __tests__/components/CategoryBadge.test.tsx
import { render, screen } from '@testing-library/react';
import { CategoryBadge } from '@/components/CategoryBadge';

describe('CategoryBadge', () => {
  const mockCategory = {
    id: '1',
    name: 'Groceries',
    color: '#FF6B6B',
    icon: 'shopping_cart',
  };

  it('renders category name', () => {
    render(<CategoryBadge category={mockCategory} variant="badge" />);
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });

  it('applies category color to badge background', () => {
    render(<CategoryBadge category={mockCategory} variant="badge" />);
    const badge = screen.getByText('Groceries').closest('span');
    expect(badge).toHaveStyle({ backgroundColor: '#FF6B6B' });
  });

  it('renders icon when provided', () => {
    render(<CategoryBadge category={mockCategory} variant="badge" />);
    expect(screen.getByText('shopping_cart')).toBeInTheDocument();
  });
});
```

### Integration Tests

Test interactions between multiple components or API routes.

**When to Write:**
- API route handlers
- Multi-component workflows
- Data fetching and mutations
- Authentication flows

**Example:**
```typescript
// __tests__/app/api/transactions/route.test.ts
import { POST } from '@/app/api/transactions/route';
import { createMocks } from 'node-mocks-http';

describe('POST /api/transactions', () => {
  it('creates a new transaction successfully', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {
        amount: 50.00,
        description: 'Groceries',
        category_id: 'cat-123',
        transaction_type: 'expense',
      },
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data).toHaveProperty('id');
    expect(data.message).toBe('Transaction created successfully');
  });

  it('returns 400 for invalid amount', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {
        amount: -10, // Invalid: negative amount
        description: 'Test',
        category_id: 'cat-123',
      },
    });

    const response = await POST(req as any);
    expect(response.status).toBe(400);
  });
});
```

## Test File Organization

Tests mirror the source directory structure under `__tests__/`:

```
__tests__/
├── app/
│   ├── api/
│   │   ├── transactions/
│   │   │   └── route.test.ts
│   │   └── categories/
│   │       └── route.test.ts
│   └── (pages)/
│       └── dashboard/
│           └── page.test.tsx
├── components/
│   ├── CategoryBadge.test.tsx
│   ├── StatCard.test.tsx
│   └── transactions/
│       └── FilterBreadcrumbs.test.tsx
└── lib/
    ├── services/
    │   └── insightsService.test.ts
    └── utils/
        └── formatters.test.ts
```

**Naming Convention:**
- Test files: `[filename].test.ts` or `[filename].test.tsx`
- Test setup: `setupTests.ts`
- Test utilities: `testUtils.tsx`, `mockData.ts`

## Testing Tools and Setup

### Core Testing Libraries

- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **@testing-library/jest-dom**: Custom matchers for DOM assertions
- **@testing-library/user-event**: Simulates user interactions

### Setup Files

**jest.config.ts:**
```typescript
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
  ],
};
```

**jest.setup.ts:**
```typescript
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/test-path',
}));

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));
```

## Mocking Strategies

### Mocking Supabase Client

```typescript
import { createClient } from '@/lib/supabase/client';

// Mock the module
jest.mock('@/lib/supabase/client');

describe('My Test', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('fetches transactions from Supabase', async () => {
    mockSupabase.single.mockResolvedValue({
      data: { id: '1', amount: 50 },
      error: null,
    });

    // Your test code here
  });
});
```

### Mocking SWR Data Fetching

```typescript
import useSWR from 'swr';

jest.mock('swr');

describe('Component with SWR', () => {
  it('displays loading state', () => {
    (useSWR as jest.Mock).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
    });

    render(<MyComponent />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays data when loaded', () => {
    (useSWR as jest.Mock).mockReturnValue({
      data: { transactions: [{ id: '1', amount: 50 }] },
      error: undefined,
      isLoading: false,
    });

    render(<MyComponent />);
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });
});
```

### Mocking Next.js Router

```typescript
import { useRouter } from 'next/navigation';

jest.mock('next/navigation');

describe('Navigation Test', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
    });
  });

  it('navigates to dashboard on button click', () => {
    render(<MyComponent />);
    fireEvent.click(screen.getByRole('button', { name: /dashboard/i }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});
```

### Mocking Chakra UI Toast

```typescript
import { useToast } from '@chakra-ui/react';

jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
  useToast: jest.fn(),
}));

describe('Toast Test', () => {
  const mockToast = jest.fn();

  beforeEach(() => {
    (useToast as jest.Mock).mockReturnValue(mockToast);
  });

  it('shows success toast on save', async () => {
    render(<MyForm />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        status: 'success',
        duration: 3000,
      });
    });
  });
});
```

## Browser Tests (Playwright)

Jest and jsdom cannot catch a page that fails to render. A build compiles; it
does not render, and jsdom has no server and no layout engine. `/dashboard`
returned **HTTP 500 on every authenticated render** while lint, type-check, jest
and the build were all green (hp-13). Browser tests are the only instrument for
that class.

`scripts/smoke-routes.ts` is the working example — authenticated, read-only,
run against the deployed app by the `Tests` workflow. Read it before writing
another one.

### Four traps, all of which cost real time here

**1. `fill()` before hydration silently does nothing.**

The login submit button is `isDisabled={!email || !password}`, bound to React
state. Playwright's `fill()` sets the DOM value and dispatches input events —
but if React has not hydrated yet, nothing is listening, state never updates,
and the button stays disabled **forever**. `click()` then waits out its whole
timeout on an element that will never become actionable.

This **passed locally and hung against production**: fast local hydration hid it.
Anything bound to React state has this problem, not just this button.

```ts
await field.fill(value);
// Then WAIT for the state-derived effect, and re-fill if hydration lost the race.
await page.waitForFunction(() => {
  const b = document.querySelector('form button[type="submit"]');
  return b instanceof HTMLButtonElement && !b.disabled;
}, undefined, { timeout: 10_000 });
```

**2. Error-page markers can ship in every healthy page.**

`"This page could not be found"` is bundled into **every** page by Next, so using
it as a failure marker failed all seven routes on a perfectly healthy build. That
is the mirror image of a vacuous guard — a check that can never *pass*. It is the
worse kind, because a permanently red check gets deleted, and the discipline goes
with it.

**Verify every marker against a known-good 200 page before trusting it.** A 404
belongs to the status assertion anyway.

**3. A 200 does not mean you are where you asked to be.**

If the session silently fails, every route redirects to `/login`, which returns
200. The run goes green having tested nothing. Assert the landed pathname, not
just the status.

**4. Unauthenticated checks miss authenticated bugs.**

Unauthenticated `/dashboard` returns 307; the 500 only appeared once signed in. A
smoke test asserting "200 or 3xx" would have stayed green for that bug's entire
life.

### Constraints on the QA account

It has a second driver — a local Playwright session someone else may be running
at the same time.

- **Read-only.** Navigate and assert; never create, edit or delete. Two agents
  writing to one account is a race. Navigation is safe: insight generation is the
  destructive path and is reachable only from `/api/insights/generate` and from
  `checkAndTriggerForTransactionCount`, called inside **POST** at
  `src/app/api/transactions/route.ts`.
- **Structural invariants only.** Assertions must hold on an empty account and a
  full one. "Renders 200 with no error boundary" survives someone deleting
  everything; "shows the transactions list" does not.
- **No sign-out or session revocation on teardown** — it would kick a concurrent
  local session out mid-run. Closing the browser is the whole teardown.
- **429 is not a failure.** Only `/api/insights/generate` is rate limited here,
  and Supabase rate-limits its own auth endpoints. "Too many requests right now"
  is not "the app is broken", and failing on it manufactures the false red that
  gets the check disabled.
- **Credentials come from `${{ secrets.* }}`**, never inline, and never printed.
  Truncate Playwright errors before logging them: a `fill()` failure can carry
  its argument, which is the password.

## Writing Good Tests

### Use Semantic Queries

Prefer queries that reflect how users interact with your app:

**Good:**
```typescript
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText(/email address/i);
screen.getByText(/welcome back/i);
screen.getByPlaceholderText(/search transactions/i);
```

**Avoid:**
```typescript
screen.getByTestId('submit-btn'); // Use only as last resort
container.querySelector('.submit-button'); // Too implementation-specific
```

### Test Behavior, Not Implementation

**Good:**
```typescript
it('allows user to add a transaction', async () => {
  render(<TransactionForm />);

  // User actions
  await userEvent.type(screen.getByLabelText(/amount/i), '50.00');
  await userEvent.type(screen.getByLabelText(/description/i), 'Groceries');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  // Verify outcome
  expect(screen.getByText(/transaction saved/i)).toBeInTheDocument();
});
```

**Avoid:**
```typescript
it('calls handleSubmit when form is submitted', () => {
  const handleSubmit = jest.fn();
  render(<TransactionForm onSubmit={handleSubmit} />);

  fireEvent.submit(screen.getByRole('form'));

  expect(handleSubmit).toHaveBeenCalled(); // Tests implementation detail
});
```

### Test Edge Cases and Error States

```typescript
describe('TransactionList', () => {
  it('displays empty state when no transactions', () => {
    render(<TransactionList transactions={[]} />);
    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
  });

  it('displays error message on fetch failure', () => {
    (useSWR as jest.Mock).mockReturnValue({
      data: undefined,
      error: new Error('Network error'),
      isLoading: false,
    });

    render(<TransactionList />);
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('handles large transaction amounts correctly', () => {
    const transaction = { amount: 999999.99, description: 'Big expense' };
    render(<TransactionItem transaction={transaction} />);
    expect(screen.getByText('$999,999.99')).toBeInTheDocument();
  });
});
```

### Write Descriptive Test Names

**Good:**
```typescript
it('displays validation error when amount is negative');
it('disables submit button while form is submitting');
it('filters transactions by selected category');
```

**Avoid:**
```typescript
it('works correctly');
it('test form validation');
it('should work');
```

### Use Arrange-Act-Assert Pattern

```typescript
it('updates transaction when edit form is submitted', async () => {
  // Arrange
  const transaction = { id: '1', amount: 50, description: 'Original' };
  const onUpdate = jest.fn();
  render(<EditTransactionForm transaction={transaction} onUpdate={onUpdate} />);

  // Act
  await userEvent.clear(screen.getByLabelText(/description/i));
  await userEvent.type(screen.getByLabelText(/description/i), 'Updated');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  // Assert
  expect(onUpdate).toHaveBeenCalledWith({
    ...transaction,
    description: 'Updated',
  });
});
```

### Clean Up After Tests

```typescript
describe('Component with subscriptions', () => {
  let unsubscribe: jest.Mock;

  beforeEach(() => {
    unsubscribe = jest.fn();
    mockSupabase.channel.mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = render(<MyComponent />);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
```

## Coverage Expectations

### Coverage Targets

- **New Code**: Aim for **90% coverage** on new files and features
- **Critical Paths**: 100% coverage for authentication, payment, data mutations
- **Baseline**: Maintain at least **30-40% overall coverage** across the codebase
- **Legacy Code**: Improve coverage incrementally when modifying existing files

### What to Prioritize

**High Priority:**
- Business logic and calculations
- API routes and data mutations
- Authentication and authorization
- Form validation
- Error handling
- Critical user flows

**Lower Priority:**
- UI styling and layout
- Simple presentational components
- Third-party library wrappers
- Configuration files

### Coverage Reports

View coverage reports after running tests:

```bash
npm run test:coverage
```

Reports are generated in `coverage/`:
- `coverage/lcov-report/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV format for CI/CD integration

## Running Tests

### Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- CategoryBadge.test.tsx

# Run tests matching a pattern
npm test -- --testNamePattern="validates form"

# Run tests for changed files only
npm test -- --onlyChanged
```

### Debugging Tests

**Run tests with Node debugger:**
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

**Add debugging output:**
```typescript
import { screen, debug } from '@testing-library/react';

it('my test', () => {
  render(<MyComponent />);

  // Print entire DOM tree
  debug();

  // Print specific element
  debug(screen.getByRole('button'));
});
```

### CI/CD Integration

Tests run automatically on:
- Every commit (via GitHub Actions)
- Pull request creation
- Pre-deployment checks

**GitHub Actions Workflow:**
```yaml
- name: Run Tests
  run: npm test -- --coverage --ci

- name: Upload Coverage to Codecov
  uses: codecov/codecov-action@v3
```

## Common Testing Patterns

### Testing Forms

```typescript
it('validates required fields on submit', async () => {
  render(<TransactionForm />);

  // Submit empty form
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));

  // Check for validation errors
  expect(screen.getByText(/amount is required/i)).toBeInTheDocument();
  expect(screen.getByText(/description is required/i)).toBeInTheDocument();
});
```

### Testing Async Operations

```typescript
it('loads and displays transactions', async () => {
  render(<TransactionList />);

  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  // Verify data is displayed
  expect(screen.getByText('Groceries')).toBeInTheDocument();
});
```

### Testing Accessibility

```typescript
it('has accessible form labels', () => {
  render(<TransactionForm />);

  expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
});

it('has proper ARIA attributes', () => {
  render(<ErrorAlert message="Error occurred" />);

  const alert = screen.getByRole('alert');
  expect(alert).toHaveAttribute('aria-live', 'polite');
});
```

### Testing Conditional Rendering

```typescript
it('shows edit button only for transaction owner', () => {
  const ownTransaction = { id: '1', user_id: 'current-user' };
  render(<TransactionItem transaction={ownTransaction} currentUserId="current-user" />);

  expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
});

it('hides edit button for other users transactions', () => {
  const otherTransaction = { id: '1', user_id: 'other-user' };
  render(<TransactionItem transaction={otherTransaction} currentUserId="current-user" />);

  expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
});
```

---

## Where the tests are, and how to count them

**For any question of the form "how many test files do X", the domain is
`jest --listTests`, not a glob with a path in it.** When the tool has its own
notion of the domain, that notion is authoritative and ours is a guess that
happens to be checkable.

**A scoped search that returns RESULTS gives no signal that its scope was
wrong.** An empty result prompts you to widen; a non-empty one suppresses the
instinct. That is the vacuity problem in the *search* direction rather than the
assertion direction, and it is how the figures below were wrong for a week.

### The measurement, 2026-10-05

`jest --listTests` collects **263** files from **four** top-level roots:

| root | files |
| --- | --- |
| `src/**/__tests__/` | 242 |
| `__tests__/` (repo root) | 15 |
| `scripts/**/__tests__/` | 5 |
| `docs/sprint-artifacts/__tests__/` | 1 |

An earlier note in this file said "two places". It was itself short, by the same
mechanism it was describing.

Corrected counts over jest's domain, where `src/`-scoped greps had reported
`158 / 0 / 148`:

| | over jest's 263 |
| --- | --- |
| files calling `clearAllMocks` | **166** |
| files calling `resetAllMocks` | **0** |
| `clearAllMocks` **and** setting a mock implementation | **155** |

155, not 148. It does not change the decision — 155 and 148 rank identically —
but it was wrong in a known direction and only a file-location correction
surfaced it.

### A `.test.tsx` that has never run

`src/lib/test-utils/__examples__/ExampleComponent.test.tsx` is **not collected**.
`testMatch` is `**/__tests__/**/*.test.ts(x)`, and `__examples__` is not
`__tests__`:

```
$ npx jest ExampleComponent
Pattern: ExampleComponent - 0 matches
```

It contains **2 `describe` blocks, 9 `it` blocks and 18 `expect()` calls**, none
of which has ever executed. Its header presents it as documentation of the test
utilities, so the exclusion may well be deliberate — but a file that looks like a
test, is named like a test and contains eighteen assertions is one somebody will
eventually add a real assertion to without noticing it does not run. Either move
it into a `__tests__/` directory or drop the `.test` from its name; both make its
status legible, and the current state does not.

### The sweep's DOMAIN is complete; its SENSITIVITY is not

The `--randomize` order-dependence sweep used `jest` itself, so its domain was
always the full 263 — unlike the hand-rolled greps, it was never path-scoped.

**But a complete domain is not a complete population.** The sweep detects a
load-sensitive race only on the runs where the race is actually lost, and running
the whole suite makes losing *less* likely: under contention each test takes
roughly two to three times as long (614ms vs 276ms, measured on the same test),
which is time the race needs to settle.

The evidence is one test measured twice, with **its own code unchanged between
the two measurements** (`git log` over the file and its component: nothing; the
only source change in the window was a different file):

| instrument | `TransactionEntryModal composer › renders one-tap category chips` |
| --- | --- |
| full-suite sweep, 15 seeds, 2026-10-04 | present at **3** of 15 |
| full-suite sweep, 15 seeds, 2026-10-05 | present at **0** of 15 |
| that file alone, `--randomize --seed=4` | **5 to 9 of 10** |

The full-suite instrument's own detection of this test moved from 3/15 to 0/15
for reasons outside the code. So the figure to quote is not "0 against 9" but
"3-of-15-or-0-of-15, depending on the day, against 6-to-9-of-10" — and the
conclusion is the same but stronger: **the seven suites are a LOWER BOUND on the
population, not the population.**

**TWO EXPLANATIONS FOR THE DISAGREEMENT WERE OFFERED AND BOTH ARE REFUTED.** The
observation is reproducible; the mechanism is not known.

| hypothesis | test | result |
| --- | --- | --- |
| contention — the full suite is slower, so the race settles | full suite with `--maxWorkers=1`, seed 4 | finds the **identical** 22 tests as the parallel run, 0 difference in either direction; the composer file **PASSES**. 51s serial vs ~40s parallel, so contention was modest anyway |
| a single-file run executes **in-band** rather than in a worker, a different environment | composer alone, default vs `--maxWorkers=2`, 10 runs each | 7/10 vs 6/10 — inside the ±1-in-8 resolution |

So: isolated runs of that file fail 6–9 times in 10, and every full-suite
configuration tried — parallel across 15 seeds, serial at one — passes it. The
`Tests` workflow is 25 for 25 green. What the disagreement is *caused* by is
open, and saying so is better than offering a third untested mechanism.

An earlier version of this section said they were the whole population. They are
the whole of what this instrument found.

## Does the NAME claim more than the assertions establish?

Nothing in any toolchain checks a test's name against what it tests, and the name
is what anyone greps when asking "is this covered?". So a name that overreaches
lies in the direction of reassurance, to a reader who has no way to notice.

`useAppearance.test.tsx` had six tests called **"falls back to system for
garbage: X"**. The assertions were true. The code was right — `readAppearance()`
falls back to the *session* preference and only then to `'system'`, which is
deliberate and documented at its declaration, so a user with blocked storage
still sees their click take effect. What was false was **the names**: they
claimed an unconditional fallback while establishing "falls back to system
*given this particular setup*", and the setup was supplied by declaration order.

They now read "...(no session choice)", and the condition they do not cover —
invalid storage **with** a session choice — is asserted separately.

So, while naming a test: **does the name claim more than the assertions
establish?** It is the same shape as every other defect in this session — a claim
true at one scope, read as true at a broader one — arriving in the one place no
tool looks.

## TRAP: `jest.resetModules()` will not fix a module singleton under static imports

It is the obvious reach when a module-level `let` leaks between tests, and the
reason it fails is not obvious. `resetModules()` clears the registry so the *next*
`require` builds a fresh module — but static `import` bindings already evaluated
at the top of the test file keep pointing at the **old** instance. Re-import the
functions dynamically and you now hold two copies: the hook rendered by your
component comes from the stale module, the functions you assert on come from the
fresh one, and they do not share the singleton you were trying to reset.

What works instead: **put the tests that must not see the singleton in their own
file.** Jest gives each test *file* its own registry, so the state starts clean
and nothing in that file sets it. That is why `useAppearance.pure.test.tsx`
exists.

## A test can be TRUE and UNUSABLE, and the suite reports only the first

Two axes, and CI measures one of them:

| axis | question | who notices |
| --- | --- | --- |
| **what the result means** | does this pass establish the property it names? | CI, if the test ever goes red |
| **what the test is usable for** | can this test be run on its own? | nobody, until someone tries |

`jest -t "<one test>"` is what you run while working on that test. CI never does
it, so CI is **structurally blind** to the second axis: a test can be correct,
assert exactly what it claims, pass in the suite forever, and be impossible to
run by itself.

Found in `BalanceFlowHero.period.test.tsx`: five of its ten tests failed when run
individually, with a hard `TypeError`, while the file passed 10/10 as a whole.
They were true and unusable. See that file's header for the mechanism.

### The running count, gathered free

Checking this costs nothing on a file already open, so every order-dependence
diagnosis records it. One file is an anecdote; six would say whether the class is
endemic or a singleton.

| file | tests runnable individually | mechanism |
| --- | --- | --- |
| `BalanceFlowHero.period.test.tsx` | **5 of 10** | user-event / zag prototype collision |
| `useAppearance.test.tsx` + `.pure` | **9 of 9** groups | module singleton |
| `exchangeRateService.test.ts` | **21 of 21** | mock-state leak |

Three files to go: `OfflineBanner`, `generate-insights` cron, `GoalCard`.

**AND THE COUNT MAY BE MEASURING MECHANISM RATHER THAN PREVALENCE.** Only the
prototype collision produces the unusable-alone symptom; a module singleton or a
leaked mock does not prevent running a test by itself at all. So four clean
results would not establish that the class is rare — only that we diagnosed four
files of the other kind.

The question that actually scopes it is one search, and it has been run: the
collision needs **both** `userEvent.setup()` (which patches
`HTMLElement.prototype.focus` as a getter) **and** a component mounting
`@zag-js/focus-visible`, which in this tree is reachable only through Chakra's
`use-radio` and `use-checkbox`. Measured 2026-10-06: **4 of 264 test files call
`userEvent.setup()`**, and the other three render no radio, checkbox or switch at
all. All four are clean across four seeds each. **The population is one file, and
it is fixed.**

**This is also why a file-level isolation sweep would not have found it.**
BalanceFlowHero passes as a whole file; only `-t` on a single test fails. A
60-invocation file-level sample returned 0 findings, which was the right answer
to the wrong question.

## Two rules for writing an async test

### What did I await, and is what I am asserting guaranteed by it?

Both order-dependence defects found so far had **different causes and the same
shape: awaited one signal, asserted on another.** Unlike either fix, the shape is
usable *before* the bug exists, so it belongs in the author's head rather than in
a post-mortem.

| what was awaited | what it actually tells you | what was asserted |
| --- | --- | --- |
| `expect(fetch).toHaveBeenCalled()` | the request went out | that `mutate` had **not** been called — i.e. that the *handler* had already decided not to |
| `findByRole(...)` resolved | the node existed **at that moment** | that the same node is still in the document now |

Neither second column follows from the first. In the first case the assertion was
true of a version that calls `mutate` one microtask later; in the second the node
was legitimately replaced by a re-render between the await and the assertion, and
the error says so exactly — *"element could not be found in the document"*, not
"could not find an element".

So while writing an async assertion, ask the three questions in order: **what did
I await, what am I asserting, and is the second guaranteed by the first?** If it
is not, await the thing you are actually asserting about — and prefer re-querying
inside `waitFor` over holding a node across an await, because `waitFor` retries
the lookup and a held reference cannot survive a remount.

### A before/after comparison is only valid if both halves saw the same conditions

And on a **load-sensitive** rate, "the same conditions" excludes *"I ran a full
test suite in between"*.

Measured on `TransactionEntryModal.composer.test.tsx`, under
`--randomize --seed=4`, with the file **byte-identical to HEAD** throughout:

| measurement | result |
| --- | --- |
| baseline, early in the session | 5 of 10 failing |
| baseline again, after several full-suite runs | **9 of 10 failing** |
| two interleaved arms, same code, same batch | 6 of 8 and 7 of 8 |

The first two are the same code and differ by nearly a factor of two. A
conclusion of the form "my fix made it worse", drawn by comparing a candidate
against the earlier baseline, was therefore **withdrawn for invalid design** —
not disproven, which is a different and weaker reason to drop a claim.

Interleaving the arms **is** valid: both see the same load. Its resolution is
about **±1 in 8**, from the identical-code pair above, and that is the precision
any claim about such a rate has to live inside. A fix that takes 7/8 to 0/8 is
believable; one that takes 7/8 to 5/8 is not distinguishable from noise.

## Test order dependence — measured 2026-10-03/04, fix pending

`jest --randomize` shuffles test order within a file. The suite passes in
declaration order and does not pass under shuffling, which means some tests pass
because of the order they are written in rather than because of what they assert.

**Measured over 15 seeds.** The cumulative union plateaus: 25 of 27 tests and 7
of 8 suites appeared by seed 4, and seeds 5-12 added nothing at all. So the
population is a handful of files, not an open-ended audit.

| suite                                                              | tests  |
| ------------------------------------------------------------------ | ------ |
| BalanceFlowHero period selector                                    | 10     |
| readAppearance / isAppearance / resolveAppearance                  | 6      |
| exchangeRateService                                                | 4      |
| OfflineBanner                                                      | 3      |
| TransactionEntryModal composer · generate-insights cron · GoalCard | 1 each |

`BalanceFlowHero.period.test.tsx` is the clearest case: **10/10 pass in
declaration order and 10/10 fail under shuffling**, with
`TypeError: Cannot set property focus of #<HTMLElement> which has only a getter`
— a one-time stub that only the first test to run can install.

### One of them was a timing flake, not an order dependency — FIXED 2026-10-05

A fixed seed was otherwise reproducible: seed 3 run five times on the same commit
gave byte-identical failure sets four times out of five. The one test that varied
was **`__tests__/components/insights/RefreshInsightsButton.test.tsx › does NOT
revalidate when the refresh request fails`** — `Expected 0, Received 1`.

**Two corrections to an earlier version of this section.** It named
`empty-state-affordance.test.tsx`, which merely *mocks* `RefreshInsightsButton`
and does not contain that test; the real suite lives in the root `__tests__/`
tree, which a `src/`-scoped search misses. And it claimed the test "passes 8/8
alone under shuffling and fails only in a full-suite run". Both measurements were
taken against the wrong file. Measured correctly: **12/12 in declaration order,
and roughly 1 run in 6 failing when that file is shuffled on its own.** It
reproduces in isolation, which is what made it diagnosable.

**The conclusion drawn from the wrong measurements happened to survive, and that
is the problem.** "Fix or quarantine this test before pinning a seed" was right,
and it was reached from three false premises — passes alone, fails only in a full
suite, `--runInBand` does not stabilise it — every one of them measured against a
file that merely mocks the component under test. Being right by luck is not being
right by method, and the next time the luck will not hold. The `src/`-scoped
search that produced the wrong file is the mechanical cause: this repository has
test trees in **two** places, `src/**/__tests__/` and a root `__tests__/`, and a
search of one silently answers for both.

**The mechanism.** `should disable button during API call` mocks `fetch` with a
promise that resolves `ok: true` after a **100ms `setTimeout`**, clicks, asserts
the button is disabled — and ends. The timer then fires inside the *next* test,
the handler sees `ok: true` and calls `mutate()`, and the next test's
`beforeEach` has already run `clearAllMocks()`. So a call belonging to one test
is attributed to the next one. It only bites when the shuffle places
`does NOT revalidate...` immediately after it. **A test must not outlive
itself.**

Two more defects in the same file, both of the same family:

- the negative assertion waited only for `expect(fetch).toHaveBeenCalled()`,
  which resolves while the response is still being handled — so it asserted
  "mutate has not been called *yet*", which is also true of a version that calls
  it a microtask later. It now waits for the failure path to settle (the error
  toast, then the button re-enabling);
- `beforeEach` used `mockClear()`, which clears recorded calls and **leaves the
  implementation**, so the 100ms delayed-resolve `mockImplementation` survived
  into every later test. Masked only because each test queues its own
  `mockResolvedValueOnce`. Now `mockReset()`. Same gotcha as #66's pushService
  leak.

**After the fix, a pinned seed IS a stable gate** — the precondition for the
remedy. Seed 3, five full-suite runs: `14 failed` every time, and **one distinct
failure-set hash** where there had been two. The fix was also mutation-tested:
making a failed response skip its `throw` so the handler reaches `mutate()`
reddens the test 4 runs out of 4, deterministically, where the old version caught
it 1 in 6.

**The suite union therefore reads 7, not 8** — the eighth entered in exactly one
of fifteen seeds and was this flake.

The composer flake that was tracked separately is in this population
(`renders one-tap category chips`, seeds 4, 8 and 14), so it is not a timing
problem and does not need its own investigation.

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library Documentation](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Component Library](./component-library.md)
- [API Conventions](./api-conventions.md)
