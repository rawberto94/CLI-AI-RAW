import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard';

export const metadata = {
  title: 'System Monitoring | Contract Intelligence',
  description: 'Real-time system health and performance monitoring',
};

export default function MonitoringPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
      <div className="container mx-auto py-8">
        <MonitoringDashboard refreshInterval={5000} />
      </div>
    </div>
  );
}
