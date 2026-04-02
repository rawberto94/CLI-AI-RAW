/**
 * Rate Card Monitoring Dashboard Page
 * Real-time monitoring of rate changes and market movements
 */

import { RealTimeRateMonitoring } from '@/components/rate-cards/RealTimeRateMonitoring';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rate Monitoring | ConTigo',
  description: 'Rate Monitoring — Manage and monitor your contract intelligence platform',
};


export default function RateMonitoringPage() {
  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4">
      <RealTimeRateMonitoring />
    </div>
  );
}
