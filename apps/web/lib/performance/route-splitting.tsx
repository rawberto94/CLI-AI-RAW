/**
 * Route-Level Code Splitting Configuration
 * Defines lazy-loaded routes for optimal bundle splitting
 * Requirements: 4.3
 */

import dynamic from 'next/dynamic';

/**
 * Lazy-loaded page components
 * These are loaded on-demand when the route is accessed
 */

// Analytics routes
export const AnalyticsPage = dynamic(() => import('@/app/analytics/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const AnalyticsArtifactsPage = dynamic(() => import('@/app/analytics/artifacts/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const AnalyticsSuppliersPage = dynamic(() => import('@/app/analytics/suppliers/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const AnalyticsNegotiationPage = dynamic(() => import('@/app/analytics/negotiation/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const AnalyticsSavingsPage = dynamic(() => import('@/app/analytics/savings/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const AnalyticsRenewalsPage = dynamic(() => import('@/app/analytics/renewals/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const AnalyticsProcurementPage = dynamic(() => import('@/app/analytics/procurement/page'), {
  loading: () => <PageLoadingSkeleton />,
});

// Rate cards routes
export const RateCardsDashboardPage = dynamic(() => import('@/app/rate-cards/dashboard/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const RateCardsEntriesPage = dynamic(() => import('@/app/rate-cards/entries/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const RateCardsBenchmarkingPage = dynamic(() => import('@/app/rate-cards/benchmarking/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const RateCardsOpportunitiesPage = dynamic(() => import('@/app/rate-cards/opportunities/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const RateCardsMarketIntelligencePage = dynamic(() => import('@/app/rate-cards/market-intelligence/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const RateCardsClusteringPage = dynamic(() => import('@/app/rate-cards/clustering/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const RateCardsForecastsPage = dynamic(() => import('@/app/rate-cards/forecasts/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const RateCardsCompetitiveIntelligencePage = dynamic(() => import('@/app/rate-cards/competitive-intelligence/page'), {
  loading: () => <PageLoadingSkeleton />,
});

// Monitoring routes
export const MonitoringPage = dynamic(() => import('@/app/monitoring/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const PerformanceMonitoringPage = dynamic(() => import('@/app/monitoring/performance/page'), {
  loading: () => <PageLoadingSkeleton />,
});

// Contract routes
export const ContractDetailPage = dynamic(() => import('@/app/contracts/[id]/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const ContractEnhancedPage = dynamic(() => import('@/app/contracts/[id]/enhanced/page'), {
  loading: () => <PageLoadingSkeleton />,
});

export const ContractStateOfTheArtPage = dynamic(() => import('@/app/contracts/[id]/state-of-the-art/page'), {
  loading: () => <PageLoadingSkeleton />,
});

// Upload routes
export const UploadPage = dynamic(() => import('@/app/upload/page'), {
  loading: () => <PageLoadingSkeleton />,
});

/**
 * Page loading skeleton component
 */
function PageLoadingSkeleton() {
  return null; // Placeholder - actual skeleton should be in a .tsx file
}

/**
 * Preload critical routes
 * Call this function to preload routes that are likely to be accessed
 */
export function preloadCriticalRoutes() {
  if (typeof window === 'undefined') return;

  // Preload dashboard and analytics (most commonly accessed)
  const criticalRoutes = [
    AnalyticsPage,
    RateCardsDashboardPage,
  ];

  criticalRoutes.forEach((route) => {
    if (route && typeof (route as any).preload === 'function') {
      (route as any).preload();
    }
  });
}

/**
 * Preload route on hover
 * Use this for navigation links to preload on hover
 */
export function preloadOnHover(route: any) {
  return {
    onMouseEnter: () => {
      if (route && typeof route.preload === 'function') {
        route.preload();
      }
    },
  };
}

/**
 * Route prefetch configuration
 */
export const routePrefetchConfig = {
  // High priority routes (preload immediately)
  high: [
    '/analytics',
    '/rate-cards/dashboard',
  ],
  
  // Medium priority routes (preload on idle)
  medium: [
    '/contracts',
    '/rate-cards/entries',
    '/rate-cards/benchmarking',
  ],
  
  // Low priority routes (load on demand)
  low: [
    '/monitoring',
    '/settings',
    '/rate-cards/clustering',
  ],
};

/**
 * Initialize route prefetching based on priority
 */
export function initializeRoutePrefetching() {
  if (typeof window === 'undefined') return;

  // Preload high priority routes immediately
  setTimeout(() => {
    preloadCriticalRoutes();
  }, 1000);

  // Preload medium priority routes on idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      routePrefetchConfig.medium.forEach((route) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        document.head.appendChild(link);
      });
    });
  }
}
