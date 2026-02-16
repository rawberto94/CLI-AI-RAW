/**
 * Anomaly Detection Dashboard Page
 */

import { AnomalyDetectionDashboard } from '@/components/rate-cards/AnomalyDetectionDashboard';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rate Anomalies | ConTigo',
  description: 'Rate Anomalies — Manage and monitor your contract intelligence platform',
};


export default function AnomaliesPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <AnomalyDetectionDashboard />
    </div>
  );
}
