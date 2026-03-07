/**
 * Performance Monitoring Page
 * Displays real-time performance metrics and Core Web Vitals
 */

import { PerformanceMonitoringDashboard } from '@/components/monitoring/PerformanceMonitoringDashboard';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Performance Monitoring | ConTigo',
  description: 'Performance Monitoring — Manage and monitor your contract intelligence platform',
};


export default function PerformancePage() {
  return (
    <div className="container mx-auto py-8">
      <PerformanceMonitoringDashboard />
    </div>
  );
}
