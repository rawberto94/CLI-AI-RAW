'use client';

import { useState, useEffect, useMemo } from 'react';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { DashboardKPICards } from '@/components/rate-cards/DashboardKPICards';
import { FinancialMetricsCards } from '@/components/rate-cards/FinancialMetricsCards';
import { PerformanceIndicators } from '@/components/rate-cards/PerformanceIndicators';
import { TopOpportunitiesWidget } from '@/components/rate-cards/TopOpportunitiesWidget';
import { DashboardTrendCharts } from '@/components/rate-cards/DashboardTrendCharts';
import { ClientOverviewWidget } from '@/components/rate-cards/ClientOverviewWidget';
import { BaselineTrackingWidget } from '@/components/rate-cards/BaselineTrackingWidget';
import { NegotiationStatusWidget } from '@/components/rate-cards/NegotiationStatusWidget';
import { useRouter } from 'next/navigation';
import { useRealTimeEvents } from '@/contexts/RealTimeContext';
import { Button } from '@/components/ui/button';
import { Upload, Plus } from 'lucide-react';

interface ClientMetrics {
  totalRateCards: number;
  uniqueSuppliers: number;
  geographicCoverage: number;
  serviceLineCoverage: number;
}

interface BaselineMetrics {
  totalBaselines: number;
  percentBaseline: number;
  percentTopQuartile: number;
  percentNegotiated: number;
  avgSavingsPerRate: number;
}

interface NegotiationMetrics {
  activeNegotiations: number;
  pendingApproval: number;
  completedThisMonth: number;
  avgNegotiationTime: number;
}

export default function RateCardDashboardPage() {
  const router = useRouter();
  const [clientMetrics, setClientMetrics] = useState<ClientMetrics | null>(null);
  const [baselineMetrics, setBaselineMetrics] = useState<BaselineMetrics | null>(null);
  const [negotiationMetrics, setNegotiationMetrics] = useState<NegotiationMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardMetrics();
  }, []);

  // Real-time updates for rate cards
  const eventHandlers = useMemo(() => ({
    'ratecard:created': () => {
      fetchDashboardMetrics(); // Refresh metrics on new rate card
    },
    'ratecard:updated': () => {
      fetchDashboardMetrics(); // Refresh metrics on update
    },
    'ratecard:imported': () => {
      fetchDashboardMetrics(); // Refresh metrics on import
    },
    'benchmark:calculated': () => {
      fetchDashboardMetrics(); // Refresh metrics on benchmark
    },
    'benchmark:invalidated': () => {
      fetchDashboardMetrics(); // Refresh metrics on invalidation
    },
  }), []);

  useRealTimeEvents(eventHandlers);

  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);
      
      const [clientRes, baselineRes, negotiationRes] = await Promise.all([
        fetch('/api/rate-cards/dashboard/client-metrics'),
        fetch('/api/rate-cards/dashboard/baseline-metrics'),
        fetch('/api/rate-cards/dashboard/negotiation-metrics'),
      ]);

      const [clientData, baselineData, negotiationData] = await Promise.all([
        clientRes.json(),
        baselineRes.json(),
        negotiationRes.json(),
      ]);

      setClientMetrics(clientData);
      setBaselineMetrics(baselineData);
      setNegotiationMetrics(negotiationData);
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rate Card Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor portfolio health and identify savings opportunities
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/rate-cards/import')} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import Rate Cards
          </Button>
          <Button onClick={() => router.push('/rate-cards/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rate Card
          </Button>
        </div>
      </div>

      {/* Client, Baseline, and Negotiation Widgets */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Client & Negotiation Overview</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {clientMetrics && (
            <ClientOverviewWidget metrics={clientMetrics} loading={loading} />
          )}
          {baselineMetrics && (
            <BaselineTrackingWidget metrics={baselineMetrics} loading={loading} />
          )}
          {negotiationMetrics && (
            <NegotiationStatusWidget 
              metrics={negotiationMetrics} 
              loading={loading}
              onViewOpportunities={() => router.push('/rate-cards/opportunities')}
            />
          )}
        </div>
      </section>

      {/* KPI Cards */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Portfolio Overview</h2>
        <DashboardKPICards />
      </section>

      {/* Financial Metrics */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Financial Performance</h2>
        <FinancialMetricsCards />
      </section>

      {/* Performance Indicators */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Performance Indicators</h2>
        <PerformanceIndicators />
      </section>

      {/* Top Opportunities and Trends */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <TopOpportunitiesWidget />
        </section>
        <section>
          <div className="space-y-6">
            <DashboardTrendCharts />
          </div>
        </section>
      </div>
    </div>
  );
}
