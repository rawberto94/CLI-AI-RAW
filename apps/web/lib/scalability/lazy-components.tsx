/**
 * Lazy Component Utilities
 * Utilities for lazy loading heavy components with proper error handling
 */

'use client';

import dynamic from 'next/dynamic';
import React, { ComponentType, Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeletons';

// ============================================================================
// Types
// ============================================================================

interface LazyLoadConfig<P = Record<string, unknown>> {
  /** Loading fallback component */
  loading?: ComponentType;
  /** Error fallback component */
  error?: ComponentType<{ error: Error; reset: () => void }>;
  /** Whether to disable SSR */
  ssr?: boolean;
  /** Preload on idle */
  preloadOnIdle?: boolean;
  /** Preload on interaction (hover) */
  preloadOnInteraction?: boolean;
}

// ============================================================================
// Default Loading Components
// ============================================================================

function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-pulse space-y-4 w-full max-w-md">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="text-red-500 mb-4">
        <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Failed to load component
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {error.message || 'Something went wrong'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

// ============================================================================
// Lazy Loading Utilities
// ============================================================================

/**
 * Create a lazily-loaded component with error boundary and loading state
 */
export function lazyComponent<P extends Record<string, unknown> = Record<string, unknown>>(
   
  importFn: () => Promise<{ default: ComponentType<any> }>,
  config: LazyLoadConfig<P> = {}
) {
  const {
    loading: LoadingComponent = DefaultLoadingFallback,
    ssr = false,
    preloadOnIdle = false,
  } = config;

  const LazyComponent = dynamic(importFn as () => Promise<{ default: ComponentType<P> }>, {
    loading: () => <LoadingComponent />,
    ssr,
  });

  // Preload on idle if configured
  if (preloadOnIdle && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as typeof window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
      importFn();
    });
  }

  return LazyComponent;
}
/**
 * Create a component that preloads on hover/focus
 */
export function withPreload<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  preloadFn: () => Promise<unknown>
) {
  let preloaded = false;

  const PreloadWrapper = React.forwardRef<unknown, P>((props, ref) => {
    const handlePreload = () => {
      if (!preloaded) {
        preloaded = true;
        preloadFn();
      }
    };

    return (
      <div
        onMouseEnter={handlePreload}
        onFocus={handlePreload}
        onTouchStart={handlePreload}
      >
        <Component {...(props as P)} ref={ref} />
      </div>
    );
  });

  PreloadWrapper.displayName = `WithPreload(${Component.displayName || Component.name})`;
  
  return PreloadWrapper;
}

/**
 * Preload a dynamic component
 */
export function preloadComponent(
  importFn: () => Promise<{ default: ComponentType<unknown> }>
): void {
  if (typeof window === 'undefined') return;

  // Use requestIdleCallback for non-critical preloads
  if ('requestIdleCallback' in window) {
    (window as typeof window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
      importFn().catch(() => {
        // Ignore preload errors
      });
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      importFn().catch(() => {
        // Ignore preload errors
      });
    }, 200);
  }
}

// ============================================================================
// Heavy Component Registry
// ============================================================================

/**
 * Registry of heavy components that should be lazy-loaded
 * These are components that significantly impact initial bundle size
 */
export const HeavyComponents = {
  // Charts and Data Visualization
  AnalyticsChart: lazyComponent(
    () => import('@/components/analytics/AnalyticsHub').then(m => ({ default: m.AnalyticsHub })),
    { preloadOnIdle: true }
  ),
  
  // AI Components (large AI libraries)
  AIChat: lazyComponent(
    () => import('@/components/ai/FloatingAIBubble').then(m => ({ default: m.FloatingAIBubble })),
    { ssr: false }
  ),
  
  // PDF Viewer / Artifact Viewer
  PDFViewer: lazyComponent(
    () => import('@/components/contracts/ArtifactViewer').then(m => ({ default: m.ArtifactViewer })),
    { ssr: false }
  ),
  
  // Rich Text Editor / AI Analysis
  RichTextEditor: lazyComponent(
    () => import('@/components/contracts/AIAnalysisPanel').then(m => ({ default: m.AIAnalysisPanel })),
    { ssr: false }
  ),
  
  // Data Tables with Virtual Scrolling
  VirtualDataTable: lazyComponent(
    () => import('@/components/ui/virtual-list').then(m => ({ default: m.VirtualList })),
    { ssr: false }
  ),
};

// ============================================================================
// Route Preloading
// ============================================================================

/**
 * Preload routes based on user interaction patterns
 */
export function setupRoutePreloading(): void {
  if (typeof window === 'undefined') return;

  // Common navigation paths to preload
  const preloadRoutes: Record<string, () => Promise<unknown>> = {
    '/contracts': () => import('@/app/contracts/page'),
    '/upload': () => import('@/app/upload/page'),
    '/analytics': () => import('@/app/analytics/page'),
    '/ai/chat': () => import('@/app/ai/chat/page'),
  };

  // Preload on idle after initial page load
  if ('requestIdleCallback' in window) {
    (window as typeof window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
      // Preload most common routes
      Object.values(preloadRoutes).slice(0, 2).forEach(preload => {
        preload().catch(() => {});
      });
    });
  }

  // Add intersection observer for link-based preloading
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const link = entry.target as HTMLAnchorElement;
        const href = link.getAttribute('href');
        if (href && preloadRoutes[href]) {
          preloadRoutes[href]().catch(() => {});
          observer.unobserve(link);
        }
      }
    });
  });

  // Observe navigation links
  document.querySelectorAll('a[href^="/"]').forEach((link) => {
    observer.observe(link);
  });
}
