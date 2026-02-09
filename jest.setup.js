// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Polyfill for jsPDF (requires TextEncoder/TextDecoder for Node.js)
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for Next.js server APIs (Request/Response)
// Required for testing Next.js API routes that use NextRequest/NextResponse
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(url, init = {}) {
      // Store internal state without setting properties that might be getters in subclasses
      Object.defineProperty(this, '_url', { value: url, writable: true });
      Object.defineProperty(this, '_init', { value: init, writable: true });
      Object.defineProperty(this, '_method', { value: init.method || 'GET', writable: true });
      Object.defineProperty(this, '_headers', { value: new Headers(init.headers || {}), writable: true });
      Object.defineProperty(this, '_body', { value: init.body || null, writable: true });
    }
    get url() { return this._url; }
    get method() { return this._method; }
    get headers() { return this._headers; }
    get body() { return this._body; }

    // Parse JSON from request body
    async json() {
      if (typeof this._body === 'string') {
        return JSON.parse(this._body);
      }
      if (this._body && typeof this._body === 'object') {
        return this._body;
      }
      throw new Error('Request body is not JSON');
    }

    // Parse text from request body
    async text() {
      if (typeof this._body === 'string') {
        return this._body;
      }
      return String(this._body || '');
    }
  };
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init = {}) {
      Object.defineProperty(this, '_body', { value: body, writable: true });
      Object.defineProperty(this, '_init', { value: init, writable: true });
      Object.defineProperty(this, '_status', { value: init.status || 200, writable: true });
      Object.defineProperty(this, '_statusText', { value: init.statusText || '', writable: true });
      Object.defineProperty(this, '_headers', { value: new Headers(init.headers || {}), writable: true });
    }
    get body() { return this._body; }
    get status() { return this._status; }
    get statusText() { return this._statusText; }
    get headers() { return this._headers; }

    // Parse JSON from response body
    async json() {
      if (typeof this._body === 'string') {
        return JSON.parse(this._body);
      }
      return this._body;
    }

    // Parse text from response body
    async text() {
      if (typeof this._body === 'string') {
        return this._body;
      }
      return String(this._body || '');
    }

    // Static method to create JSON response (like NextResponse.json)
    static json(data, init = {}) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
    }
  };
}

if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init) {
      Object.defineProperty(this, '_map', { value: new Map(), writable: false });
      if (init) {
        if (typeof init === 'object') {
          Object.entries(init).forEach(([key, value]) => {
            this._map.set(key.toLowerCase(), String(value));
          });
        }
      }
    }
    get(name) {
      return this._map.get(String(name).toLowerCase()) || null;
    }
    set(name, value) {
      this._map.set(String(name).toLowerCase(), String(value));
    }
    has(name) {
      return this._map.has(String(name).toLowerCase());
    }
    delete(name) {
      this._map.delete(String(name).toLowerCase());
    }
    forEach(callback) {
      this._map.forEach((value, key) => callback(value, key, this));
    }
    entries() {
      return this._map.entries();
    }
    keys() {
      return this._map.keys();
    }
    values() {
      return this._map.values();
    }
  };
}

// Mock next-intl (ESM module that Jest cannot parse directly)
// Load actual English translations so existing tests that query for English text continue to work
jest.mock('next-intl', () => {
  const messages = require('./messages/en.json');
  return {
    useTranslations: jest.fn((namespace) => {
      const nsMessages = messages[namespace] || {};
      const t = (key, params) => {
        const value = nsMessages[key];
        if (value === undefined) return `${namespace}.${key}`;
        if (params) {
          return Object.entries(params).reduce(
            (str, [k, v]) => String(str).replace(`{${k}}`, String(v)),
            value
          );
        }
        return value;
      };
      t.rich = (key, params) => {
        const value = nsMessages[key];
        return value !== undefined ? value : `${namespace}.${key}`;
      };
      return t;
    }),
    useLocale: jest.fn(() => 'en'),
    useMessages: jest.fn(() => messages),
    useNow: jest.fn(() => new Date()),
    useTimeZone: jest.fn(() => 'UTC'),
    NextIntlClientProvider: ({ children }) => children,
  };
})

// Mock next-intl/server (ESM module)
jest.mock('next-intl/server', () => ({
  getLocale: jest.fn(async () => 'en'),
  getMessages: jest.fn(async () => ({})),
  getTranslations: jest.fn(async () => (key) => key),
  getRequestConfig: jest.fn((fn) => fn),
}))

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
