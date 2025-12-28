/**
 * Rate Card Monitoring Dashboard Page
 * Real-time monitoring of rate changes and market movements
 */

import { RealTimeRateMonitoring } from '@/components/rate-cards/RealTimeRateMonitoring';

export default function RateMonitoringPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <RealTimeRateMonitoring />
    </div>
  );
}
