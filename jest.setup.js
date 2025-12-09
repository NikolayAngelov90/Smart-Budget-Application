// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

// Mock Chakra UI toast
jest.mock('@chakra-ui/react', () => {
  const actual = jest.requireActual('@chakra-ui/react')
  return {
    ...actual,
    useToast: jest.fn(() => jest.fn()),
  }
})

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createBrowserClient: jest.fn(() => require('./__tests__/setup/supabase-mock').mockSupabaseClient),
}))

// Mock Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => require('./__tests__/setup/supabase-mock').mockSupabaseClient),
}))

// Set test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock matchMedia for Chakra UI responsive hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
