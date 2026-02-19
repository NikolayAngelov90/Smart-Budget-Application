'use client';

/**
 * usePullToRefresh Hook
 * Story 10-8: Mobile-Optimized Touch UI
 *
 * AC-10.8.4: Pull-to-refresh gesture on scroll containers triggers SWR revalidation.
 *
 * Attach the returned `containerRef` to any element within the scrollable area.
 * The hook will find the nearest [data-scroll-container] ancestor (AppLayout's
 * main content Box) and attach touch listeners to it.
 *
 * The callback fires when the user pulls down more than THRESHOLD px from the top.
 * Only activates when the scroll container is at scrollTop === 0.
 *
 * Usage:
 *   const { containerRef, isRefreshing } = usePullToRefresh(() => mutate('/api/transactions'));
 *   <Box ref={containerRef}>...</Box>  // any element inside the scroll area
 */

import { useRef, useState, useCallback, useEffect } from 'react';

const THRESHOLD = 80; // px of pull required to trigger refresh

interface UsePullToRefreshOptions {
  /** Whether pull-to-refresh is enabled. Default: true. */
  enabled?: boolean;
}

interface UsePullToRefreshReturn {
  /** Attach to any element inside the scrollable area. */
  containerRef: React.RefObject<HTMLDivElement>;
  /** True while the refresh callback is executing. */
  isRefreshing: boolean;
  /** Current pull distance in px (0 when not pulling). */
  pullDistance: number;
}

/**
 * Find the nearest scrollable ancestor with data-scroll-container attribute,
 * falling back to the element itself.
 */
function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  let current: HTMLElement | null = el;
  while (current) {
    if (current.dataset.scrollContainer === 'true') return current;
    current = current.parentElement;
  }
  return el;
}

export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
  options: UsePullToRefreshOptions = {}
): UsePullToRefreshReturn {
  const { enabled = true } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  // Gesture tracking refs (avoid re-renders during active gesture)
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const scrollElRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const scrollEl = scrollElRef.current;
    if (!scrollEl || scrollEl.scrollTop !== 0) return;
    const touch = e.touches[0];
    if (!touch) return;
    startYRef.current = touch.clientY;
    isPullingRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const scrollEl = scrollElRef.current;
    if (!scrollEl || scrollEl.scrollTop !== 0) {
      setPullDistance(0);
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;
    const delta = touch.clientY - startYRef.current;
    if (delta <= 0) {
      setPullDistance(0);
      isPullingRef.current = false;
      return;
    }

    // Pulling downward while at top
    isPullingRef.current = true;
    // Apply resistance: pull distance feels progressively harder
    const resistedDistance = Math.min(delta * 0.5, THRESHOLD * 1.5);
    setPullDistance(resistedDistance);

    // Prevent browser's native pull-to-refresh / over-scroll
    if (delta > 5) {
      e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) {
      setPullDistance(0);
      return;
    }

    // Read pullDistance from state — but to avoid closure stale issue, check pullDistance ref
    const currentPull = pullDistance;
    isPullingRef.current = false;
    setPullDistance(0);

    if (currentPull < THRESHOLD * 0.5) {
      return;
    }

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [pullDistance, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    // Find the actual scroll container (AppLayout's content Box marked with data-scroll-container)
    const scrollEl = findScrollContainer(el);
    scrollElRef.current = scrollEl;

    if (!scrollEl) return;

    // overscroll-behavior-y: contain prevents browser's native pull-to-refresh competing
    scrollEl.style.overscrollBehaviorY = 'contain';

    scrollEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    scrollEl.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      scrollEl.removeEventListener('touchstart', handleTouchStart);
      scrollEl.removeEventListener('touchmove', handleTouchMove);
      scrollEl.removeEventListener('touchend', handleTouchEnd);
      scrollEl.style.overscrollBehaviorY = '';
      scrollElRef.current = null;
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, isRefreshing, pullDistance };
}
