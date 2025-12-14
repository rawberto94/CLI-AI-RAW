// Lazy-loaded chart components for better performance
import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Loading skeleton component
const ChartSkeleton = () => (
  <div className="w-full h-[400px] bg-muted animate-pulse rounded-lg flex items-center justify-center">
    <div className="text-muted-foreground">Loading chart...</div>
  </div>
);

// Lazy load heavy chart components with named exports
export const LazyInteractiveBoxPlot = dynamic(
  () => import('@/components/rate-cards/InteractiveBoxPlot').then(mod => mod.InteractiveBoxPlot),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Disable SSR for chart components
  }
);

export const LazyTimeSeriesChart = dynamic(
  () => import('@/components/rate-cards/TimeSeriesChart').then(mod => mod.TimeSeriesChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const LazyGeographicHeatMap = dynamic(
  () => import('@/components/rate-cards/GeographicHeatMap').then(mod => mod.GeographicHeatMap),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const LazyComparisonBarChart = dynamic(
  () => import('@/components/rate-cards/ComparisonBarChart').then(mod => mod.ComparisonBarChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

// Lazy load modal/dialog components
export const LazyManualRateCardInput = dynamic(
  () => import('@/components/rate-cards/ManualRateCardInput').then(mod => mod.ManualRateCardInput),
  {
    loading: () => null, // No loading state for modals
  }
);

export const LazyBulkCSVUpload = dynamic(
  () => import('@/components/rate-cards/BulkCSVUpload').then(mod => mod.BulkCSVUpload),
  {
    loading: () => null,
  }
);

export const LazyExtractFromContracts = dynamic(
  () => import('@/components/rate-cards/ExtractFromContracts').then(mod => mod.ExtractFromContracts),
  {
    loading: () => null,
  }
);

// Lazy load data tables
export const LazyRateCardDataRepository = dynamic(
  () => import('@/components/rate-cards/RateCardDataRepository').then(mod => mod.RateCardDataRepository),
  {
    loading: () => (
      <div className="w-full h-[600px] bg-muted/40 animate-pulse rounded-lg" />
    ),
  }
);

// Dashboard components
export const LazyCostSavingsDashboardWidget = dynamic(
  () => import('@/components/dashboard/CostSavingsDashboardWidget').then(mod => mod.CostSavingsDashboardWidget),
  {
    loading: () => (
      <div className="w-full h-[300px] bg-muted animate-pulse rounded-lg" />
    ),
  }
);

export const LazyEnhancedDashboard = dynamic(
  () => import('@/components/dashboard/EnhancedDashboard').then(mod => mod.EnhancedDashboard),
  {
    loading: () => (
      <div className="w-full min-h-[600px] bg-muted/40 animate-pulse rounded-lg" />
    ),
  }
);

// Analytics components
export const LazyAnalyticsHub = dynamic(
  () => import('@/components/analytics/AnalyticsHub').then(mod => mod.AnalyticsHub),
  {
    loading: () => (
      <div className="w-full min-h-[600px] bg-muted/40 animate-pulse rounded-lg" />
    ),
    ssr: false,
  }
);

export const LazyForecastingDashboard = dynamic(
  () => import('@/components/analytics/ForecastingDashboard').then(mod => mod.ForecastingDashboard),
  {
    loading: () => (
      <div className="w-full min-h-[500px] bg-muted/40 animate-pulse rounded-lg" />
    ),
    ssr: false,
  }
);

// Contract heavy components
export const LazyAIAnalysisPanel = dynamic(
  () => import('@/components/contracts/AIAnalysisPanel').then(mod => mod.AIAnalysisPanel),
  {
    loading: () => (
      <div className="w-full h-[400px] bg-muted animate-pulse rounded-lg" />
    ),
    ssr: false,
  }
);

export const LazyEnhancedArtifactViewer = dynamic(
  () => import('@/components/contracts/EnhancedArtifactViewer').then(mod => mod.EnhancedArtifactViewer),
  {
    loading: () => (
      <div className="w-full h-[500px] bg-muted animate-pulse rounded-lg" />
    ),
    ssr: false,
  }
);

export const LazyPDFViewer = dynamic(
  () => import('@/components/contracts/PDFViewer').then(mod => mod.default),
  {
    loading: () => (
      <div className="w-full h-[600px] bg-muted animate-pulse rounded-lg flex items-center justify-center">
        <div className="text-muted-foreground">Loading PDF viewer...</div>
      </div>
    ),
    ssr: false,
  }
);

export const LazyRedlineEditor = dynamic(
  () => import('@/components/contracts/RedlineEditor').then(mod => mod.default),
  {
    loading: () => (
      <div className="w-full h-[500px] bg-muted animate-pulse rounded-lg" />
    ),
    ssr: false,
  }
);

export const LazyVersionCompare = dynamic(
  () => import('@/components/contracts/VersionCompare').then(mod => mod.VersionCompare),
  {
    loading: () => (
      <div className="w-full h-[600px] bg-muted animate-pulse rounded-lg" />
    ),
    ssr: false,
  }
);

// AI components
export const LazyFloatingAIBubble = dynamic(
  () => import('@/components/ai/FloatingAIBubble').then(mod => mod.FloatingAIBubble),
  {
    loading: () => null,
    ssr: false,
  }
);

// Approval components
export const LazyApprovalWorkflow = dynamic(
  () => import('@/components/approvals/ApprovalWorkflow').then(mod => mod.ApprovalWorkflow),
  {
    loading: () => (
      <div className="w-full h-[400px] bg-muted animate-pulse rounded-lg" />
    ),
  }
);

// Export all lazy components
const LazyComponents = {
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
  LazyAnalyticsHub,
  LazyForecastingDashboard,
  LazyAIAnalysisPanel,
  LazyEnhancedArtifactViewer,
  LazyPDFViewer,
  LazyRedlineEditor,
  LazyVersionCompare,
  LazyFloatingAIBubble,
  LazyApprovalWorkflow,
};
export default LazyComponents;
