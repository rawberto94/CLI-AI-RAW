/**
 * Lazy-loaded Chart Components
 * Recharts is ~100KB+ - code split for faster initial page loads
 * 
 * Usage:
 * ```tsx
 * import { LazyLineChart, LazyBarChart } from '@/components/charts/lazy-charts';
 * 
 * // Instead of directly importing recharts, use lazy wrappers:
 * <Suspense fallback={<ChartSkeleton />}>
 *   <LazyLineChart data={data} {...props} />
 * </Suspense>
 * ```
 */

'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

// Skeleton loader for charts
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div 
      className="animate-pulse bg-muted rounded-lg flex items-center justify-center"
      style={{ height }}
    >
      <div className="text-muted-foreground text-sm">Loading chart...</div>
    </div>
  );
}

// Type-safe dynamic import wrapper
function createLazyChart<P extends object>(
  importFn: () => Promise<{ [key: string]: ComponentType<P> }>,
  exportName: string
) {
  return dynamic(
    () => importFn().then((mod) => ({ default: mod[exportName] as ComponentType<P> })),
    {
      loading: () => <ChartSkeleton />,
      ssr: false, // Charts don't need SSR
    }
  );
}

// Lazy ResponsiveContainer - needed for all charts
export const LazyResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);

// Lazy LineChart
export const LazyLineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  { 
    loading: () => <ChartSkeleton />,
    ssr: false 
  }
);

// Lazy Line component
export const LazyLine = dynamic(
  () => import('recharts').then((mod) => mod.Line),
  { ssr: false }
);

// Lazy AreaChart
export const LazyAreaChart = dynamic(
  () => import('recharts').then((mod) => mod.AreaChart),
  { 
    loading: () => <ChartSkeleton />,
    ssr: false 
  }
);

// Lazy Area component
export const LazyArea = dynamic(
  () => import('recharts').then((mod) => mod.Area),
  { ssr: false }
);

// Lazy BarChart
export const LazyBarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  { 
    loading: () => <ChartSkeleton />,
    ssr: false 
  }
);

// Lazy Bar component
export const LazyBar = dynamic(
  () => import('recharts').then((mod) => mod.Bar),
  { ssr: false }
);

// Lazy PieChart
export const LazyPieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  { 
    loading: () => <ChartSkeleton />,
    ssr: false 
  }
);

// Lazy Pie component
export const LazyPie = dynamic(
  () => import('recharts').then((mod) => mod.Pie),
  { ssr: false }
);

// Lazy ComposedChart
export const LazyComposedChart = dynamic(
  () => import('recharts').then((mod) => mod.ComposedChart),
  { 
    loading: () => <ChartSkeleton />,
    ssr: false 
  }
);

// Lazy RadarChart
export const LazyRadarChart = dynamic(
  () => import('recharts').then((mod) => mod.RadarChart),
  { 
    loading: () => <ChartSkeleton />,
    ssr: false 
  }
);

// Common recharts components (lazy loaded)
export const LazyXAxis = dynamic(
  () => import('recharts').then((mod) => mod.XAxis),
  { ssr: false }
);

export const LazyYAxis = dynamic(
  () => import('recharts').then((mod) => mod.YAxis),
  { ssr: false }
);

export const LazyCartesianGrid = dynamic(
  () => import('recharts').then((mod) => mod.CartesianGrid),
  { ssr: false }
);

export const LazyTooltip = dynamic(
  () => import('recharts').then((mod) => mod.Tooltip),
  { ssr: false }
);

export const LazyLegend = dynamic(
  () => import('recharts').then((mod) => mod.Legend),
  { ssr: false }
);

export const LazyCell = dynamic(
  () => import('recharts').then((mod) => mod.Cell),
  { ssr: false }
);

export const LazyReferenceLine = dynamic(
  () => import('recharts').then((mod) => mod.ReferenceLine),
  { ssr: false }
);

// Pre-composed chart components for common use cases
export const LazyTrendChart = dynamic(
  () => import('./enhanced-charts').then((mod) => mod.TrendChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false
  }
);

export const LazyDistributionChart = dynamic(
  () => import('./enhanced-charts').then((mod) => mod.DistributionChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false
  }
);

export const LazyComparisonChart = dynamic(
  () => import('./enhanced-charts').then((mod) => mod.ComparisonChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false
  }
);

// Re-export the skeleton for use in other components
export { ChartSkeleton as default };
