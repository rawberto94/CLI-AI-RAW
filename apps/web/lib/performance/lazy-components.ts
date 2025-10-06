/**
 * Lazy Component Loader
 * Optimizes bundle size by lazy loading heavy components
 */

import dynamic from 'next/dynamic';

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
  () => import('@/components/import/ColumnMappingInterface'),
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-screen" />,
    ssr: false,
  }
);

export const LazyValidationReview = dynamic(
  () => import('@/components/import/ValidationReview'),
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-screen" />,
    ssr: false,
  }
);
