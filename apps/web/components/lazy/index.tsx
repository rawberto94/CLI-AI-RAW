// Lazy-loaded chart components for better performance
import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Loading skeleton component
const ChartSkeleton = () => (
  <div className="w-full h-[400px] bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
    <div className="text-gray-400">Loading chart...</div>
  </div>
);

// Lazy load heavy chart components
export const LazyInteractiveBoxPlot = dynamic(
  () => import('@/components/rate-cards/InteractiveBoxPlot'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Disable SSR for chart components
  }
);

export const LazyTimeSeriesChart = dynamic(
  () => import('@/components/rate-cards/TimeSeriesChart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const LazyGeographicHeatMap = dynamic(
  () => import('@/components/rate-cards/GeographicHeatMap'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const LazyComparisonBarChart = dynamic(
  () => import('@/components/rate-cards/ComparisonBarChart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

// Lazy load modal/dialog components
export const LazyManualRateCardInput = dynamic(
  () => import('@/components/rate-cards/ManualRateCardInput'),
  {
    loading: () => null, // No loading state for modals
  }
);

export const LazyBulkCSVUpload = dynamic(
  () => import('@/components/rate-cards/BulkCSVUpload'),
  {
    loading: () => null,
  }
);

export const LazyExtractFromContracts = dynamic(
  () => import('@/components/rate-cards/ExtractFromContracts'),
  {
    loading: () => null,
  }
);

// Lazy load data tables
export const LazyRateCardDataRepository = dynamic(
  () => import('@/components/rate-cards/RateCardDataRepository'),
  {
    loading: () => (
      <div className="w-full h-[600px] bg-gray-50 animate-pulse rounded-lg" />
    ),
  }
);

// Dashboard components
export const LazyCostSavingsDashboardWidget = dynamic(
  () => import('@/components/dashboard/CostSavingsDashboardWidget'),
  {
    loading: () => (
      <div className="w-full h-[300px] bg-gray-100 animate-pulse rounded-lg" />
    ),
  }
);

export const LazyEnhancedDashboard = dynamic(
  () => import('@/components/dashboard/EnhancedDashboard'),
  {
    loading: () => (
      <div className="w-full min-h-screen bg-gray-50 animate-pulse" />
    ),
  }
);

// Analytics visualizations
export const LazyAnalyticsChart = dynamic(
  () => import('@/components/analytics/AnalyticsChart').catch(() => ({ default: () => <ChartSkeleton /> })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

// Export all lazy components
export default {
  LazyInteractiveBoxPlot,
  LazyTimeSeriesChart,
  LazyGeographicHeatMap,
  LazyComparisonBarChart,
  LazyManualRateCardInput,
  LazyBulkCSVUpload,
  LazyExtractFromContracts,
  LazyRateCardDataRepository,
  LazyCostSavingsDashboardWidget,
  LazyEnhancedDashboard,
  LazyAnalyticsChart,
};
