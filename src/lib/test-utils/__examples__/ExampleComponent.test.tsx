/**
 * Example Test File - Test Utilities Usage
 * Demonstrates various testing patterns with the test utilities library
 */

import React from 'react';
import { render, screen, waitFor, userEvent, mockUser } from '@/lib/test-utils';

// Example component for testing
const ExampleComponent: React.FC<{ userId?: string }> = ({ userId }) => {
  const [count, setCount] = React.useState(0);

  return (
    <div>
      <h1>Example Component</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      {userId && <p>User ID: {userId}</p>}
    </div>
  );
};

describe('ExampleComponent', () => {
  /**
   * Example 1: Basic Rendering
   * Shows minimal test setup with automatic provider wrapping
   */
  test('renders component with all providers', () => {
    render(<ExampleComponent />);

    expect(screen.getByText('Example Component')).toBeInTheDocument();
    expect(screen.getByText('Count: 0')).toBeInTheDocument();
  });

  /**
   * Example 2: User Interactions
   * Shows how to simulate user clicks and verify state changes
   */
  test('increments count on button click', async () => {
    const user = userEvent.setup();

    render(<ExampleComponent />);

    const button = screen.getByRole('button', { name: /increment/i });

    await user.click(button);
    expect(screen.getByText('Count: 1')).toBeInTheDocument();

    await user.click(button);
    expect(screen.getByText('Count: 2')).toBeInTheDocument();
  });

  /**
   * Example 3: Custom Mock Overrides
   * Shows how to customize specific mocks via options parameter
   */
  test('uses custom Supabase mock', async () => {
    const { mockSupabase } = render(<ExampleComponent />, {
      mockSupabase: {
        select: jest.fn().mockResolvedValue({
          data: [{ id: 1, name: 'Test Item' }],
          error: null,
        }),
      },
    });

    // Simulate component making Supabase query
    const result = await mockSupabase.select();

    expect(result.data).toEqual([{ id: 1, name: 'Test Item' }]);
    expect(mockSupabase.select).toHaveBeenCalled();
  });

  /**
   * Example 4: Router Mock
   * Shows how to test navigation behavior
   */
  test('router push is available', () => {
    const { mockRouter } = render(<ExampleComponent />);

    // Simulate navigation
    mockRouter.push('/new-page');

    expect(mockRouter.push).toHaveBeenCalledWith('/new-page');
  });

  /**
   * Example 5: Toast Mock
   * Shows how to test notification behavior
   */
  test('toast functions are available', () => {
    const { mockToast } = render(<ExampleComponent />);

    // Simulate showing a toast
    mockToast.success('Operation successful!');

    expect(mockToast.success).toHaveBeenCalledWith('Operation successful!');
  });

  /**
   * Example 6: Custom User Session
   * Shows how to test authentication state
   */
  test('renders with custom user', () => {
    render(<ExampleComponent userId="test-user-123" />, {
      mockUser: {
        id: 'test-user-123',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: { full_name: 'Test User' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
      mockSession: {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_in: 3600,
        expires_at: Date.now() / 1000 + 3600,
        token_type: 'bearer',
        user: mockUser,
      },
    });

    expect(screen.getByText('User ID: test-user-123')).toBeInTheDocument();
  });

  /**
   * Example 7: Multiple Mock Overrides
   * Shows how to customize multiple mocks at once
   */
  test('uses multiple custom mocks', async () => {
    const { mockSupabase, mockRouter, mockToast } = render(
      <ExampleComponent />,
      {
        mockSupabase: {
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        },
        mockRouter: {
          push: jest.fn((path) => {
            console.log('Navigating to:', path);
            return Promise.resolve(true);
          }),
        },
        mockToast: {
          success: jest.fn((message) => {
            console.log('Toast:', message);
            return 'toast-id';
          }),
        },
      }
    );

    // Use all mocks
    await mockSupabase.select();
    mockRouter.push('/test');
    mockToast.success('All mocks working!');

    expect(mockSupabase.select).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/test');
    expect(mockToast.success).toHaveBeenCalledWith('All mocks working!');
  });

  /**
   * Example 8: Async Data Loading
   * Shows how to test components that load data asynchronously
   */
  test('waits for async data to load', async () => {
    const AsyncComponent = () => {
      const [data, setData] = React.useState<string | null>(null);

      React.useEffect(() => {
        setTimeout(() => {
          setData('Loaded data');
        }, 100);
      }, []);

      if (!data) {
        return <div>Loading...</div>;
      }

      return <div>{data}</div>;
    };

    render(<AsyncComponent />);

    // Initially shows loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Loaded data')).toBeInTheDocument();
    });
  });
});

/**
 * Integration Test Example
 * Shows a more complete test scenario with multiple interactions
 */
describe('Integration Example', () => {
  test('complete user flow with all features', async () => {
    const user = userEvent.setup();

    const CompleteComponent = () => {
      const [items, setItems] = React.useState<Array<{ id: number; name: string }>>([]);

      return (
        <div>
          <h1>Complete Example</h1>
          <button
            onClick={() => {
              setItems([{ id: 1, name: 'New Item' }]);
            }}
          >
            Load Items
          </button>
          <ul>
            {items.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        </div>
      );
    };

    const { mockSupabase, mockToast } = render(<CompleteComponent />, {
      mockSupabase: {
        select: jest.fn().mockResolvedValue({
          data: [{ id: 1, name: 'Test Item' }],
          error: null,
        }),
      },
    });

    // 1. Verify initial render
    expect(screen.getByText('Complete Example')).toBeInTheDocument();

    // 2. Click button to load items
    await user.click(screen.getByRole('button', { name: /load items/i }));

    // 3. Verify items appear
    await waitFor(() => {
      expect(screen.getByText('New Item')).toBeInTheDocument();
    });

    // 4. Verify mocks were used
    expect(mockSupabase.select).toBeDefined();
    expect(mockToast.success).toBeDefined();
  });
});
