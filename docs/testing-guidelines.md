# Testing Guidelines

This document outlines testing standards, patterns, and best practices for the Smart Budget Application.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Types](#test-types)
- [Test File Organization](#test-file-organization)
- [Testing Tools and Setup](#testing-tools-and-setup)
- [Mocking Strategies](#mocking-strategies)
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

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library Documentation](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Component Library](./component-library.md)
- [API Conventions](./api-conventions.md)
