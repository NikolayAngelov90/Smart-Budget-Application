/**
 * Test Data Fixtures
 * Reusable test data for consistent testing
 */

export const mockUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  password: 'TestPass123!',
  user_metadata: {
    full_name: 'Test User',
  },
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
}

export const mockCategories = [
  // Default expense categories
  { id: 'cat-1', name: 'Dining', color: '#f56565', type: 'expense', is_predefined: true, user_id: mockUser.id },
  { id: 'cat-2', name: 'Transport', color: '#4299e1', type: 'expense', is_predefined: true, user_id: mockUser.id },
  { id: 'cat-3', name: 'Entertainment', color: '#9f7aea', type: 'expense', is_predefined: true, user_id: mockUser.id },
  { id: 'cat-4', name: 'Utilities', color: '#48bb78', type: 'expense', is_predefined: true, user_id: mockUser.id },
  { id: 'cat-5', name: 'Shopping', color: '#ed8936', type: 'expense', is_predefined: true, user_id: mockUser.id },
  { id: 'cat-6', name: 'Healthcare', color: '#38b2ac', type: 'expense', is_predefined: true, user_id: mockUser.id },
  { id: 'cat-7', name: 'Rent', color: '#e53e3e', type: 'expense', is_predefined: true, user_id: mockUser.id },
  // Default income categories
  { id: 'cat-8', name: 'Salary', color: '#38a169', type: 'income', is_predefined: true, user_id: mockUser.id },
  { id: 'cat-9', name: 'Freelance', color: '#4299e1', type: 'income', is_predefined: true, user_id: mockUser.id },
  { id: 'cat-10', name: 'Investment', color: '#9f7aea', type: 'income', is_predefined: true, user_id: mockUser.id },
  { id: 'cat-11', name: 'Gift', color: '#f56565', type: 'income', is_predefined: true, user_id: mockUser.id },
  // Custom category
  { id: 'cat-12', name: 'Custom Category', color: '#805ad5', type: 'expense', is_predefined: false, user_id: mockUser.id },
]

export const mockTransactions = [
  {
    id: 'txn-1',
    user_id: mockUser.id,
    amount: 50.00,
    type: 'expense',
    category_id: 'cat-1',
    description: 'Lunch at restaurant',
    date: '2024-11-15',
    created_at: '2024-11-15T12:00:00Z',
  },
  {
    id: 'txn-2',
    user_id: mockUser.id,
    amount: 30.00,
    type: 'expense',
    category_id: 'cat-2',
    description: 'Uber ride',
    date: '2024-11-14',
    created_at: '2024-11-14T09:00:00Z',
  },
  {
    id: 'txn-3',
    user_id: mockUser.id,
    amount: 5000.00,
    type: 'income',
    category_id: 'cat-8',
    description: 'Monthly salary',
    date: '2024-11-01',
    created_at: '2024-11-01T00:00:00Z',
  },
  {
    id: 'txn-4',
    user_id: mockUser.id,
    amount: 480.00,
    type: 'expense',
    category_id: 'cat-1',
    description: 'Restaurant expenses this month',
    date: '2024-11-01',
    created_at: '2024-11-01T00:00:00Z',
  },
  {
    id: 'txn-5',
    user_id: mockUser.id,
    amount: 340.00,
    type: 'expense',
    category_id: 'cat-1',
    description: 'Restaurant expenses last month',
    date: '2024-10-01',
    created_at: '2024-10-01T00:00:00Z',
  },
]

export const mockInsights = [
  {
    id: 'insight-1',
    user_id: mockUser.id,
    type: 'high_spending_category',
    priority: 'high',
    title: 'High spending on Dining',
    message: 'Your spending on Dining ($480) is 41% higher than last month ($340)',
    actionable: true,
    action_url: '/transactions?category=cat-1&month=2024-11',
    dismissed: false,
    created_at: '2024-11-15T00:00:00Z',
  },
  {
    id: 'insight-2',
    user_id: mockUser.id,
    type: 'savings_opportunity',
    priority: 'medium',
    title: 'Potential savings opportunity',
    message: 'You could save $100/month by reducing dining expenses',
    actionable: true,
    action_url: '/categories/cat-1',
    dismissed: false,
    created_at: '2024-11-14T00:00:00Z',
  },
  {
    id: 'insight-3',
    user_id: mockUser.id,
    type: 'positive_trend',
    priority: 'low',
    title: 'Good job on savings!',
    message: 'Your total expenses decreased by 5% this month',
    actionable: false,
    dismissed: false,
    created_at: '2024-11-13T00:00:00Z',
  },
]
