/**
 * ServiceWorkerRegistrar — registers /sw.js so push subscription can resolve.
 * (The component gates on NODE_ENV='production', which SWC inlines at transform time;
 * we test the extracted registration helper directly instead.)
 */

import { registerServiceWorker } from '../ServiceWorkerRegistrar';

describe('registerServiceWorker', () => {
  afterEach(() => {
    // @ts-expect-error cleanup test-injected property
    delete navigator.serviceWorker;
  });

  it('registers /sw.js when service workers are supported', () => {
    const register = jest.fn().mockResolvedValue({});
    Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
    registerServiceWorker();
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('is a no-op when service workers are unsupported', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    expect(() => registerServiceWorker()).not.toThrow();
  });
});
