'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

// ── Types ────────────────────────────────────────────────────────────

interface PrefetchOptions {
  /** Priority determines stale-time and related-data depth */
  priority?: 'high' | 'normal' | 'low';
  /** Override default stale-time (ms) */
  staleTime?: number;
}

const PRIORITY_STALE_TIME: Record<string, number> = {
  high: 5 * 60 * 1000,   // 5 minutes
  normal: 60 * 1000,      // 1 minute
  low: 30 * 1000,         // 30 seconds
};

// ── Main hook ────────────────────────────────────────────────────────

/**
 * Smart prefetch hook that pre-loads contract data on hover/focus.
 *
 * - Debounces rapid hover events (100 ms)
 * - High-priority mode also prefetches artifacts
 * - Uses React Query cache so subsequent reads are instant
 * - Preloads the Next.js route for instant navigation
 */
export function useSmartPrefetch() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const prefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Prefetch a single contract (debounced) */
  const prefetchContract = useCallback(
    (contractId: string, options: PrefetchOptions = {}) => {
      const { priority = 'normal' } = options;
      const staleTime = options.staleTime ?? PRIORITY_STALE_TIME[priority];

      // Clear previous debounce
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }

      prefetchTimeoutRef.current = setTimeout(() => {
        // Core contract data
        queryClient.prefetchQuery({
          queryKey: ['contract', contractId],
          queryFn: async () => {
            const res = await fetch(`/api/contracts/${contractId}`);
            if (!res.ok) throw new Error('Failed to fetch contract');
            return res.json();
          },
          staleTime,
        });

        // High-priority: also prefetch artifacts
        if (priority === 'high') {
          queryClient.prefetchQuery({
            queryKey: ['contract', contractId, 'artifacts'],
            queryFn: async () => {
              const res = await fetch(`/api/contracts/${contractId}/artifacts`);
              if (!res.ok) throw new Error('Failed to fetch artifacts');
              return res.json();
            },
            staleTime: Math.round(staleTime / 2),
          });
        }

        // Preload the route for instant navigation
        router.prefetch(`/contracts/${contractId}`);
      }, 100); // 100 ms debounce
    },
    [queryClient, router],
  );

  /** Prefetch a batch during idle time (e.g. visible-in-viewport list items) */
  const prefetchContracts = useCallback(
    (contractIds: string[]) => {
      const schedule =
        typeof window !== 'undefined' && 'requestIdleCallback' in window
          ? window.requestIdleCallback
          : (cb: () => void) => setTimeout(cb, 1);

      schedule(() => {
        contractIds.forEach((id, idx) => {
          // Stagger to avoid request bursts
          setTimeout(() => {
            prefetchContract(id, { priority: 'low', staleTime: 30_000 });
          }, idx * 50);
        });
      });
    },
    [prefetchContract],
  );

  /** Cancel any pending prefetch */
  const cancelPrefetch = useCallback(() => {
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = null;
    }
  }, []);

  return { prefetchContract, prefetchContracts, cancelPrefetch };
}

// ── Scroll-based prefetch hook ───────────────────────────────────────

/**
 * Automatically prefetches contracts as they scroll into the viewport.
 * Attach `data-contract-id` to each row element for it to work.
 */
export function usePrefetchOnScroll(contracts: Array<{ id: string }>) {
  const { prefetchContracts } = useSmartPrefetch();
  const prefetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const newIds = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target.getAttribute('data-contract-id'))
          .filter(
            (id): id is string => !!id && !prefetchedRef.current.has(id),
          );

        if (newIds.length > 0) {
          newIds.forEach((id) => prefetchedRef.current.add(id));
          prefetchContracts(newIds);
        }
      },
      { rootMargin: '200px' }, // Start 200 px before viewport
    );

    contracts.forEach((c) => {
      const el = document.querySelector(`[data-contract-id="${c.id}"]`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [contracts, prefetchContracts]);
}
