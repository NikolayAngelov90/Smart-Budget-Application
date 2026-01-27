# Test Utilities Guide

**Author:** BMAD Dev Agent
**Date:** 2026-01-26
**Story:** 9.2 - Create Test Utilities Library

---

## Overview

The test utilities library provides a centralized, pre-configured testing setup that eliminates 50-100 lines of boilerplate code per test file. Instead of manually mocking 6 provider layers (Chakra UI, SWR, Supabase Client, Supabase Auth, Next.js Router, react-hot-toast), you can now write tests with a single import.

**Before:** 50-100 lines of provider setup per test file
**After:** 1 line import, immediate testing

---

## Quick Start

### Basic Usage

```typescript
import { render, screen } from '@/lib/test-utils';

test('renders my component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello World')).toBeInTheDocument();
});
```

That's it! Your component is now wrapped with all 6 provider layers automatically.

---

## Core Features

### 1. Single Import Point

```typescript
// Everything you need from one import
import {
  render,
  screen,
  waitFor,
  fireEvent,
  userEvent,
  mockSupabase,
  mockRouter,
  mockToast,
} from '@/lib/test-utils';
```

### 2. Pre-Configured Providers

The `render()` function automatically wraps your component with:

1. **Chakra UI Provider** - Full theme and UI component support
2. **SWR Config** - Disabled revalidation for predictable tests
3. **Supabase Client Mock** - Database query mocks
4. **Supabase Auth Mock** - Authentication mocks
5. **Next.js Router Mock** - Navigation mocks
6. **Toast Mock** - Notification mocks

### 3. Customizable Mocks

Override any mock behavior via options parameter:

```typescript
const { mockSupabase, mockRouter } = render(<MyComponent />, {
  // Custom Supabase data
  mockSupabase: {
    select: jest.fn().mockResolvedValue({
      data: [{ id: 1, name: 'Test Item' }],
      error: null,
    }),
  },

  // Custom router behavior
  mockRouter: {
    push: jest.fn((path) => {
      console.log('Navigating to:', path);
      return Promise.resolve(true);
    }),
  },

  // Custom user session
  mockUser: {
    id: 'custom-user-id',
    email: 'custom@example.com',
  },
});
```

---

## Common Testing Patterns

### Testing Data Fetching with SWR

```typescript
import { render, screen, waitFor } from '@/lib/test-utils';

test('loads and displays transactions', async () => {
  const { mockSupabase } = render(<TransactionsList />, {
    mockSupabase: {
      select: jest.fn().mockResolvedValue({
        data: [
          { id: 1, amount: 100, description: 'Groceries' },
          { id: 2, amount: 50, description: 'Gas' },
        ],
        error: null,
      }),
    },
  });

  // Wait for data to load
  await waitFor(() => {
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Gas')).toBeInTheDocument();
  });

  // Verify Supabase was called
  expect(mockSupabase.select).toHaveBeenCalled();
});
```

### Testing Navigation with Router

```typescript
import { render, screen, userEvent } from '@/lib/test-utils';

test('navigates to settings on button click', async () => {
  const user = userEvent.setup();
  const { mockRouter } = render(<SettingsButton />);

  const button = screen.getByRole('button', { name: /settings/i });
  await user.click(button);

  expect(mockRouter.push).toHaveBeenCalledWith('/settings');
});
```

### Testing Toast Notifications

```typescript
import { render, screen, userEvent } from '@/lib/test-utils';

test('shows success toast on save', async () => {
  const user = userEvent.setup();
  const { mockToast } = render(<SaveButton />);

  const button = screen.getByRole('button', { name: /save/i });
  await user.click(button);

  expect(mockToast.success).toHaveBeenCalledWith('Saved successfully!');
});
```

### Testing Forms with Chakra UI

```typescript
import { render, screen, userEvent } from '@/lib/test-utils';

test('submits form with valid data', async () => {
  const user = userEvent.setup();
  const onSubmit = jest.fn();

  render(<MyForm onSubmit={onSubmit} />);

  // Fill out form
  await user.type(screen.getByLabelText(/name/i), 'John Doe');
  await user.type(screen.getByLabelText(/email/i), 'john@example.com');

  // Submit
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Verify submission
  expect(onSubmit).toHaveBeenCalledWith({
    name: 'John Doe',
    email: 'john@example.com',
  });
});
```

### Testing Authentication State

```typescript
import { render, screen } from '@/lib/test-utils';

test('shows user profile when authenticated', () => {
  render(<UserProfile />, {
    mockUser: {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User' },
    },
    mockSession: {
      access_token: 'mock-token',
      user: {
        id: 'user-123',
        email: 'test@example.com',
      },
    },
  });

  expect(screen.getByText('Test User')).toBeInTheDocument();
  expect(screen.getByText('test@example.com')).toBeInTheDocument();
});

test('shows login prompt when not authenticated', () => {
  render(<UserProfile />, {
    mockUser: null,
    mockSession: null,
  });

  expect(screen.getByText(/please log in/i)).toBeInTheDocument();
});
```

---

## Migration Guide

### Before: Manual Provider Setup

```typescript
// Old way - 50-100 lines of boilerplate
import { render } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { SWRConfig } from 'swr';

const mockToast = jest.fn();
jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
  useToast: () => mockToast,
}));

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue({ data: [], error: null }),
    // ... 20 more lines of mocking ...
  })),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
  usePathname: () => '/test',
}));

function renderWithProviders(ui) {
  return render(
    <ChakraProvider>
      <SWRConfig value={{ provider: () => new Map() }}>
        {ui}
      </SWRConfig>
    </ChakraProvider>
  );
}

test('my test', () => {
  renderWithProviders(<MyComponent />);
  // ... test code ...
});
```

### After: Test Utilities

```typescript
// New way - 1 line import
import { render, screen, mockSupabase, mockRouter } from '@/lib/test-utils';

test('my test', () => {
  const { mockSupabase, mockRouter } = render(<MyComponent />);

  // Customize mocks as needed
  mockSupabase.select.mockResolvedValue({
    data: [{ id: 1, name: 'Test' }],
    error: null,
  });

  // ... test code ...
  expect(mockRouter.push).toHaveBeenCalled();
});
```

### Migration Steps

1. **Remove manual provider setup** - Delete all custom provider wrappers and mock configurations
2. **Update imports** - Change from `@testing-library/react` to `@/lib/test-utils`
3. **Simplify test files** - Remove 50-100 lines of boilerplate per file
4. **Customize as needed** - Use options parameter to override specific mocks
5. **Run tests** - Verify all tests still pass with new utilities

---

## API Reference

### `render(ui, options?)`

Main render function with all providers.

**Parameters:**
- `ui: ReactElement` - Component to render
- `options?: CustomRenderOptions` - Optional mock overrides

**Returns:** `RenderResult` with attached mocks

**Options:**
```typescript
{
  mockSupabase?: Partial<MockSupabaseClient>;
  mockAuth?: Partial<MockSupabaseAuth>;
  mockRouter?: Partial<MockRouter>;
  mockToast?: Partial<MockToast>;
  mockSWRData?: Record<string, MockSWRReturn>;
  mockUser?: User | null;
  mockSession?: Session | null;
}
```

### Mock Helpers

```typescript
// Supabase
createMockSupabaseClient(overrides?)
createMockSupabaseAuth(user?, session?, overrides?)
mockUser // Default test user
mockSession // Default test session

// Router
createMockRouter(overrides?)
defaultMockRouter // Pre-configured router

// Toast
createMockToast(overrides?)
defaultMockToast // Pre-configured toast

// SWR
createMockSWRConfig()
createMockUseSWR(returnValue?)

// Chakra UI
ChakraTestProvider // Provider component
createMockDisclosure(initialOpen?)
createMockColorMode(initialMode?)
```

---

## Troubleshooting

### Issue: Mocks not working

**Problem:** Mock functions not being called in tests.

**Solution:** Ensure you're using the mocks returned from `render()`:

```typescript
const { mockSupabase, mockRouter } = render(<MyComponent />);

// Use the returned mocks, not new ones
expect(mockSupabase.select).toHaveBeenCalled();
```

### Issue: Type errors with custom mocks

**Problem:** TypeScript errors when providing custom mock overrides.

**Solution:** Use `Partial<>` types or cast to `jest.Mock`:

```typescript
render(<MyComponent />, {
  mockSupabase: {
    select: jest.fn().mockResolvedValue({ data: [], error: null }) as jest.Mock,
  },
});
```

### Issue: Tests failing after migration

**Problem:** Tests pass with manual setup but fail with test utilities.

**Solution:** Check for:
1. Missing mock data - provide custom data via options
2. Timing issues - use `waitFor()` for async operations
3. Provider order - test utilities match app provider structure

---

## Best Practices

1. **Use accessible queries** - Prefer `getByRole`, `getByLabelText` over `getByTestId`
2. **Test user behavior** - Click buttons, fill forms as users would
3. **Avoid implementation details** - Don't test state or internal functions
4. **Use userEvent over fireEvent** - More realistic user interactions
5. **Wait for async operations** - Always use `waitFor()` for data loading
6. **Customize mocks minimally** - Only override what you need to test
7. **Keep tests focused** - One assertion per test when possible
8. **Clean up after tests** - Automatic with `@testing-library/react`

---

## Examples

See `src/lib/test-utils/__examples__/ExampleComponent.test.tsx` for complete examples of:
- Basic component rendering
- Data fetching with SWR
- Form submission
- Navigation
- Toast notifications
- Authentication state
- Custom mock overrides

---

## Support

For issues or questions:
- Check this guide first
- Review example tests in `__examples__/`
- See Testing Library docs: https://testing-library.com
- Refer to Kent C. Dodds blog: https://kentcdodds.com/blog

---

## Changelog

### 2026-01-26 - Initial Release (Story 9.2)
- Created test utilities library
- Added renderWithProviders() with all 6 provider layers
- Implemented mock helpers for Supabase, Router, Toast, SWR
- Added TypeScript types for all utilities
- Created comprehensive documentation and migration guide
- Refactored 3 existing test files to use new utilities
