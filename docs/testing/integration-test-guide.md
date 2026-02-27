# Integration Test Guide

**Story 10.9 — AC-10.9.11**

This guide documents integration test patterns for the Smart Budget Application. Integration tests verify complete request/response cycles at the API layer, mocking Supabase at the service boundary rather than at individual function level.

---

## Quick Start

```typescript
// Import pattern for API route integration tests
import { GET, POST } from '@/app/api/my-route/route';
import { createClient } from '@/lib/supabase/server';
jest.mock('@/lib/supabase/server');
```

---

## File Organization

```
src/app/api/
├── auth/__tests__/
│   └── onboarding.integration.test.ts    ← AC-10.9.1
├── transactions/__tests__/
│   ├── route.test.ts                     ← export/all=true (AC-10.9.6)
│   ├── all-param.test.ts                 ← edge cases
│   └── crud.integration.test.ts          ← POST/PUT/DELETE (AC-10.9.2)
├── categories/__tests__/
│   └── categories.integration.test.ts    ← full CRUD (AC-10.9.3)
├── dashboard/__tests__/
│   └── stats.integration.test.ts         ← aggregation + currency (AC-10.9.4)
└── insights/__tests__/
    └── insights.integration.test.ts      ← filters + dismiss flow (AC-10.9.5)
```

---

## Standard Boilerplate

Every API route integration test file must begin with:

```typescript
/**
 * @jest-environment node
 */

// CRITICAL: mock next/server BEFORE any imports
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      headers: new Headers(),
    })),
  },
}));

import { GET } from '@/app/api/my-route/route';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
```

**Why `@jest-environment node`?**
API routes use Node.js server APIs (Headers, NextResponse). The default `jsdom` environment doesn't have these. API tests must use `node`.

**Why mock `next/server` first?**
Next.js App Router uses edge runtime internals that aren't available in Jest. Mocking `next/server` prevents import errors.

---

## Chainable Mock Query Pattern

Supabase query builders chain multiple methods (`.from().select().eq().order()`). Use this pattern to make the chain both chainable and awaitable:

```typescript
let resolvedValue = { data: [], error: null, count: 0 };

const mockQuery = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  // Terminal methods that return a value
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  // Makes the chain itself awaitable
  then: jest.fn((resolve) => Promise.resolve(resolvedValue).then(resolve)),
  // Helper to change resolved value within a test
  mockResolvedValue: (value) => { resolvedValue = value; return mockQuery; },
};
```

### Multiple sequential queries

When a route makes 2+ queries (e.g., dashboard stats fetches current + previous month):

```typescript
let callCount = 0;
const responses = [
  { data: currentMonthData, error: null },
  { data: previousMonthData, error: null },
];

mockQuery.then.mockImplementation((resolve) => {
  const response = responses[callCount % responses.length];
  callCount++;
  return Promise.resolve(response).then(resolve);
});
```

---

## Mock Supabase Client

```typescript
const mockSupabase = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    }),
  },
  from: jest.fn(() => mockQuery),
};

mockCreateClient.mockResolvedValue(mockSupabase as any);
```

### Simulating unauthenticated requests

```typescript
mockSupabase.auth.getUser.mockResolvedValue({
  data: { user: null },
  error: new Error('Unauthorized'),
});
```

### Simulating database errors

```typescript
mockQuery.then.mockImplementation((resolve) =>
  Promise.resolve({ data: null, error: new Error('DB error') }).then(resolve)
);
// For .single() terminal method:
mockQuery.single.mockResolvedValue({
  data: null,
  error: { code: 'PGRST116', message: 'No rows found' },
});
```

---

## Mock Request Helper

```typescript
function createMockRequest(url: string, method = 'GET', body?: any): any {
  return {
    url,
    method,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => body,
    nextUrl: new URL(url),
  };
}
```

For routes that use `request.nextUrl.searchParams`, ensure `nextUrl` has a real `URLSearchParams` instance (as shown above with `new URL(url)`).

---

## Mocking External Services

Always mock services that make real HTTP calls (exchange rates, insight generation):

```typescript
// Prevent real API calls in dashboard stats tests
jest.mock('@/lib/services/exchangeRateService', () => ({
  getExchangeRates: jest.fn().mockResolvedValue({
    base: 'EUR',
    rates: { USD: 1.08, GBP: 0.86, EUR: 1 },
    date: '2026-01-01',
    cached: true,
    lastFetched: '2026-01-01T00:00:00Z',
  }),
}));

// Prevent insight triggers in transaction tests
jest.mock('@/lib/services/insightService', () => ({
  checkAndTriggerForTransactionCount: jest.fn(),
}));
```

---

## Component Integration Tests

For component-level tests (not API routes), use `renderWithProviders` from the test utilities library:

```typescript
import { renderWithProviders, screen, waitFor } from '@/lib/test-utils';

test('renders dashboard with stats', async () => {
  const { mockSupabase } = renderWithProviders(<DashboardStats />);

  // Customize mock responses
  mockSupabase.select.mockResolvedValue({
    data: [{ amount: 1000, type: 'income' }],
    error: null,
  });

  await waitFor(() => {
    expect(screen.getByText('€1,000.00')).toBeInTheDocument();
  });
});
```

See [test-utilities-guide.md](./test-utilities-guide.md) for full `renderWithProviders` documentation.

---

## Test Setup / Teardown

Always call `jest.clearAllMocks()` in `beforeEach` to prevent test pollution:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  // Re-initialize mocks here
});
```

---

## Coverage by Story

| AC | Test File | Coverage |
|----|-----------|----------|
| AC-10.9.1 | `auth/__tests__/onboarding.integration.test.ts` | POST seeds categories, 401, 400, 500 |
| AC-10.9.2 | `transactions/__tests__/crud.integration.test.ts` | POST create, PUT update, DELETE |
| AC-10.9.2 | `transactions/__tests__/route.test.ts` | GET list, all=true, filters, 401, 500 |
| AC-10.9.3 | `categories/__tests__/categories.integration.test.ts` | GET, POST+409, PUT+403, DELETE+orphan+403 |
| AC-10.9.4 | `dashboard/__tests__/stats.integration.test.ts` | sums, balance, trends, currency conversion |
| AC-10.9.5 | `insights/__tests__/insights.integration.test.ts` | GET filters, dismiss, undismiss |

---

## Running Integration Tests

```bash
# Run all tests
npx jest

# Run only integration tests
npx jest --testPathPattern="integration"

# Run specific file
npx jest src/app/api/dashboard/__tests__/stats.integration.test.ts

# Run with coverage
npx jest --coverage
```
