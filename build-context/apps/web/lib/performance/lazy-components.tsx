/**
 * Lazy Component Loader
 * Optimizes bundle size by lazy loading heavy components
 * Implements route-level code splitting and component lazy loading
 * Requirements: 4.3
 */

import dynamic from 'next/dynamic';
import React from 'react';

// Loading skeleton component
const LoadingSkeleton = ({ height = 'h-96' }: { height?: string }) => (
  <div className={`animate-pulse bg-gray-200 ${height} rounded-lg`} />
);

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-96">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
  </div>
);

// Heavy UI components - load on demand
export const LazyContractDetailTabs = dynamic(
  () => import('@/components/contracts/ContractDetailTabs').then(mod => ({ default: mod.ContractDetailTabs })),
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />,
    ssr: false,
  }
);

export const LazyAdvancedSearchModal = dynamic(
  () => import('@/components/contracts/AdvancedSearchModal').then(mod => ({ default: mod.AdvancedSearchModal })),
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-screen" />,
    ssr: false,
  }
);

export const LazyBenchmarkVisualization = dynamic(
  () => import('@/components/use-cases/rate-benchmarking/BenchmarkVisualization'),
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />,
    ssr: false,
  }
);

export const LazyAIChatInterface = dynamic(
  () => import('@/components/use-cases/rate-benchmarking/AIChatInterface'),
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />,
    ssr: false,
  }
);

export const LazyScenarioModeling = dynamic(
  () => import('@/components/use-cases/rate-benchmarking/ScenarioModeling'),
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />,
    ssr: false,
  }
);

export const LazyMarketIntelligence = dynamic(
  () => import('@/components/use-cases/rate-benchmarking/MarketIntelligence'),
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />,
    ssr: false,
  }
);

// Chart components - load on demand
export const LazyInteractiveRateChart = dynamic(
  () => import('@/components/use-cases/negotiation-prep/InteractiveRateChart'),
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-80 rounded-lg" />,
    ssr: false,
  }
);

// Export utilities - load on demand
export const LazyExportDialog = dynamic(
  () => import('@/components/use-cases/rate-benchmarking/ExportDialog'),
  {
    loading: () => null,
    ssr: false,
  }
);

// Import wizards - load on demand
export const LazyColumnMappingInterface = dynamic(
  () => import('@/components/import/ColumnMappingInterface').then(mod => ({ default: mod.default || mod })) as any as any,
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-screen" />,
    ssr: false,
  }
);

export const LazyValidationReview = dynamic(
  () => import('@/components/import/ValidationReview').then(mod => ({ default: mod.default || mod })) as any as any,
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-screen" />,
    ssr: false,
  }
);

// Analytics components - load on demand
export const LazyAnalyticsHub = dynamic(
  () => import('@/components/analytics/AnalyticsHub').then(mod => ({ default: mod.default || mod })) as any as any,
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

export const LazyOptimizedAnalyticsComponents = dynamic(
  () => import('@/components/analytics/OptimizedAnalyticsComponents').then(mod => ({ default: mod.default || mod })) as any,
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

// Rate card components - load on demand
export const LazyRateCardTable = dynamic(
  () => import('@/components/rate-cards/RateCardTable').then(mod => ({ default: mod.RateCardTable })),
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

export const LazyRateCardFilters = dynamic(
  () => import('@/components/rate-cards/RateCardFilters').then(mod => ({ default: mod.default || mod })) as any,
  {
    loading: () => <LoadingSkeleton height="h-32" />,
    ssr: false,
  }
);

export const LazyBenchmarkCard = dynamic(
  () => import('@/components/rate-cards/BenchmarkCard').then(mod => ({ default: mod.default || mod })) as any,
  {
    loading: () => <LoadingSkeleton height="h-64" />,
    ssr: false,
  }
);

// Monitoring components - load on demand
export const LazyMonitoringDashboard = dynamic(
  () => import('@/components/monitoring/MonitoringDashboard').then(mod => ({ default: mod.default || mod })) as any,
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

export const LazyPerformanceMonitoringDashboard = dynamic(
  () => import('@/components/monitoring/PerformanceMonitoringDashboard').then(mod => ({ default: mod.PerformanceMonitoringDashboard })),
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

export const LazyConnectionManagementDashboard = dynamic(
  () => import('@/components/monitoring/ConnectionManagementDashboard').then(mod => ({ default: mod.default || mod })) as any,
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

// Contract components - load on demand
export const LazyArtifactDisplay = dynamic(
  () => import('@/components/contracts/ArtifactDisplay').then(mod => ({ default: mod.default || mod })) as any,
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

export const LazyEnhancedUploadZone = dynamic(
  () => import('@/components/upload/EnhancedUploadZone').then(mod => ({ default: mod.default || mod })) as any,
  {
    loading: () => <LoadingSkeleton height="h-64" />,
    ssr: false,
  }
);

// Dashboard components - load on demand
export const LazyIntelligenceDashboard = dynamic(
  () => import('@/components/dashboard/IntelligenceDashboard'),
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

export const LazyCostSavingsDashboardWidget = dynamic(
  () => import('@/components/dashboard/SavingsTrackerWidget').then(mod => ({ default: mod.SavingsTrackerWidget })),
  {
    loading: () => <LoadingSkeleton height="h-64" />,
    ssr: false,
  }
);

// AI components — FloatingAIBubble is the canonical chatbot (loaded in ConditionalLayout)
// ChatAssistant, ProfessionalChatbot, UnifiedChatbot, EnhancedChatbot are deprecated duplicates

// Search components - load on demand
export const LazySmartSearch = dynamic(
  () => import('@/components/search/SmartSearch').then(mod => ({ default: mod.default || mod })) as any,
  {
    loading: () => <LoadingSkeleton height="h-16" />,
    ssr: false,
  }
);

/**
 * Utility function to create lazy loaded components with custom loading
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: {
    loading?: () => React.ReactElement;
    ssr?: boolean;
  }
) {
  return dynamic(importFn, {
    loading: options?.loading || (() => <LoadingSkeleton />),
    ssr: options?.ssr ?? false,
  });
}

/**
 * Preload a lazy component
 */
export function preloadComponent(component: any) {
  if (component && typeof component.preload === 'function') {
    component.preload();
  }
}
