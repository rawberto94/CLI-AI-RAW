/**
 * Performance Monitoring Page
 * Displays real-time performance metrics and Core Web Vitals
 */

import { PerformanceMonitoringDashboard } from '@/components/monitoring/PerformanceMonitoringDashboard';

export default function PerformancePage() {
  return (
    <div className="container mx-auto py-8">
      <PerformanceMonitoringDashboard />
    </div>
  );
}
