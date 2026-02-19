/**
 * Haptic Utility Tests
 * Story 10-8: Mobile-Optimized Touch UI
 * AC-10.8.11: Unit tests for haptic utility
 */

import { triggerHaptic } from '../haptic';

describe('triggerHaptic', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('calls navigator.vibrate with default 50ms pattern when supported', () => {
    const vibrateMock = jest.fn();
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: vibrateMock },
      writable: true,
      configurable: true,
    });

    triggerHaptic();

    expect(vibrateMock).toHaveBeenCalledTimes(1);
    expect(vibrateMock).toHaveBeenCalledWith(50);
  });

  it('calls navigator.vibrate with custom pattern when provided', () => {
    const vibrateMock = jest.fn();
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: vibrateMock },
      writable: true,
      configurable: true,
    });

    triggerHaptic(100);

    expect(vibrateMock).toHaveBeenCalledWith(100);
  });

  it('calls navigator.vibrate with array pattern', () => {
    const vibrateMock = jest.fn();
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: vibrateMock },
      writable: true,
      configurable: true,
    });

    triggerHaptic([100, 50, 100]);

    expect(vibrateMock).toHaveBeenCalledWith([100, 50, 100]);
  });

  it('is a no-op when navigator is undefined', () => {
    Object.defineProperty(global, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    // Should not throw
    expect(() => triggerHaptic()).not.toThrow();
  });

  it('is a no-op when navigator does not support vibrate', () => {
    Object.defineProperty(global, 'navigator', {
      value: {}, // No vibrate property
      writable: true,
      configurable: true,
    });

    // Should not throw
    expect(() => triggerHaptic(50)).not.toThrow();
  });
});
