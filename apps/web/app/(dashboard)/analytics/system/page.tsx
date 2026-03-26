'use client';

/**
 * System Analytics Page
 * 
 * Comprehensive analytics and monitoring dashboard combining
 * real-time metrics, performance data, and system health.
 */

import { Suspense, lazy } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
const RealTimeDashboard = lazy(() => import('@/components/analytics/RealTimeDashboard').then(m => ({ default: m.RealTimeDashboard })));
const DashboardBuilder = lazy(() => import('@/components/analytics/DashboardBuilder').then(m => ({ default: m.DashboardBuilder })));
const PerformanceMonitoringDashboard = lazy(() => import('@/components/monitoring/PerformanceMonitoringDashboard').then(m => ({ default: m.PerformanceMonitoringDashboard })));

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

export default function SystemAnalyticsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Analytics</h1>
          <p className="text-muted-foreground">
            Monitor system performance, view real-time metrics, and build custom dashboards
          </p>
        </div>
      </div>

      <Tabs defaultValue="realtime" className="space-y-6">
        <TabsList>
          <TabsTrigger value="realtime">Real-Time Metrics</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="builder">Dashboard Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="realtime">
          <Suspense fallback={<LoadingSkeleton />}>
            <RealTimeDashboard refreshInterval={30000} />
          </Suspense>
        </TabsContent>

        <TabsContent value="performance">
          <Suspense fallback={<LoadingSkeleton />}>
            <PerformanceMonitoringDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="builder">
          <Suspense fallback={<LoadingSkeleton />}>
            <DashboardBuilder
              onSave={(config) => {
                console.warn('Dashboard saved:', config);
                // In production, save to API
              }}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
