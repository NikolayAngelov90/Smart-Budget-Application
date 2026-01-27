/**
 * Unit Tests for Test Utilities
 * Tests that the test utilities library functions correctly
 */

import React from 'react';
import { screen } from '@testing-library/react';
import {
  renderWithProviders,
  createMockSupabaseClient,
  createMockRouter,
  createMockToast,
  mockUser,
  mockSession,
} from '../index';

describe('renderWithProviders', () => {
  test('renders component successfully', () => {
    const TestComponent = () => <div>Test Component</div>;

    renderWithProviders(<TestComponent />);

    expect(screen.getByText('Test Component')).toBeInTheDocument();
  });

  test('returns mockSupabase in result', () => {
    const TestComponent = () => <div>Test</div>;

    const result = renderWithProviders(<TestComponent />);

    expect(result.mockSupabase).toBeDefined();
    expect(result.mockSupabase.from).toBeDefined();
    expect(result.mockSupabase.select).toBeDefined();
  });

  test('returns mockAuth in result', () => {
    const TestComponent = () => <div>Test</div>;

    const result = renderWithProviders(<TestComponent />);

    expect(result.mockAuth).toBeDefined();
    expect(result.mockAuth.getUser).toBeDefined();
    expect(result.mockAuth.getSession).toBeDefined();
  });

  test('returns mockRouter in result', () => {
    const TestComponent = () => <div>Test</div>;

    const result = renderWithProviders(<TestComponent />);

    expect(result.mockRouter).toBeDefined();
    expect(result.mockRouter.push).toBeDefined();
    expect(result.mockRouter.back).toBeDefined();
  });

  test('returns mockToast in result', () => {
    const TestComponent = () => <div>Test</div>;

    const result = renderWithProviders(<TestComponent />);

    expect(result.mockToast).toBeDefined();
    expect(result.mockToast.success).toBeDefined();
    expect(result.mockToast.error).toBeDefined();
    expect(result.mockToast.loading).toBeDefined();
    expect(result.mockToast.dismiss).toBeDefined();
    expect(result.mockToast.promise).toBeDefined();
    expect(jest.isMockFunction(result.mockToast.success)).toBe(true);
  });

  test('accepts custom mockSupabase overrides', () => {
    const TestComponent = () => <div>Test</div>;
    const customSelect = jest.fn().mockResolvedValue({ data: [], error: null });

    const result = renderWithProviders(<TestComponent />, {
      mockSupabase: {
        select: customSelect,
      },
    });

    expect(result.mockSupabase.select).toBe(customSelect);
  });

  test('accepts custom mockUser', () => {
    const TestComponent = () => <div>Test</div>;
    const customUser = {
      id: 'custom-id',
      email: 'custom@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated' as const,
      created_at: new Date().toISOString(),
    };

    renderWithProviders(<TestComponent />, {
      mockUser: customUser,
    });

    // Test passes if no errors thrown
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  test('accepts null mockUser for unauthenticated state', () => {
    const TestComponent = () => <div>Test</div>;

    renderWithProviders(<TestComponent />, {
      mockUser: null,
      mockSession: null,
    });

    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});

describe('createMockSupabaseClient', () => {
  test('creates mock with chainable methods', () => {
    const mock = createMockSupabaseClient();

    expect(mock.from).toBeDefined();
    expect(mock.select).toBeDefined();
    expect(mock.insert).toBeDefined();
    expect(mock.update).toBeDefined();
    expect(mock.delete).toBeDefined();
    expect(mock.eq).toBeDefined();
  });

  test('methods return this for chaining', () => {
    const mock = createMockSupabaseClient();

    const result = mock.from('test').select('*');

    expect(result).toBe(mock);
    expect(mock.from).toHaveBeenCalledWith('test');
    expect(mock.select).toHaveBeenCalledWith('*');
  });

  test('accepts custom overrides', () => {
    const customSelect = jest.fn();
    const mock = createMockSupabaseClient({
      select: customSelect,
    });

    expect(mock.select).toBe(customSelect);
  });
});

describe('createMockRouter', () => {
  test('creates mock with navigation methods', () => {
    const mock = createMockRouter();

    expect(mock.push).toBeDefined();
    expect(mock.replace).toBeDefined();
    expect(mock.back).toBeDefined();
    expect(mock.forward).toBeDefined();
    expect(mock.refresh).toBeDefined();
  });

  test('push returns promise', async () => {
    const mock = createMockRouter();

    const result = await mock.push('/test');

    expect(result).toBe(true);
    expect(mock.push).toHaveBeenCalledWith('/test');
  });

  test('accepts custom overrides', () => {
    const customPush = jest.fn();
    const mock = createMockRouter({
      push: customPush,
    });

    expect(mock.push).toBe(customPush);
  });
});

describe('createMockToast', () => {
  test('creates mock with toast methods', () => {
    const mock = createMockToast();

    expect(mock.success).toBeDefined();
    expect(mock.error).toBeDefined();
    expect(mock.loading).toBeDefined();
    expect(mock.dismiss).toBeDefined();
  });

  test('success returns toast id', () => {
    const mock = createMockToast();

    const id = mock.success('Test message');

    expect(id).toBe('toast-success-id');
    expect(mock.success).toHaveBeenCalledWith('Test message');
  });

  test('accepts custom overrides', () => {
    const customSuccess = jest.fn();
    const mock = createMockToast({
      success: customSuccess,
    });

    expect(mock.success).toBe(customSuccess);
  });
});

describe('mockUser and mockSession', () => {
  test('mockUser has required fields', () => {
    expect(mockUser.id).toBeDefined();
    expect(mockUser.email).toBeDefined();
    expect(mockUser.app_metadata).toBeDefined();
    expect(mockUser.user_metadata).toBeDefined();
    expect(mockUser.aud).toBe('authenticated');
    expect(mockUser.created_at).toBeDefined();
  });

  test('mockSession has required fields', () => {
    expect(mockSession.access_token).toBeDefined();
    expect(mockSession.refresh_token).toBeDefined();
    expect(mockSession.expires_in).toBeDefined();
    expect(mockSession.expires_at).toBeDefined();
    expect(mockSession.token_type).toBe('bearer');
    expect(mockSession.user).toBeDefined();
  });

  test('mockSession user matches mockUser', () => {
    expect(mockSession.user.id).toBe(mockUser.id);
    expect(mockSession.user.email).toBe(mockUser.email);
  });
});
