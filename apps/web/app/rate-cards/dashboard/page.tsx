import { Metadata } from 'next';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { DashboardKPICards } from '@/components/rate-cards/DashboardKPICards';
import { FinancialMetricsCards } from '@/components/rate-cards/FinancialMetricsCards';
import { PerformanceIndicators } from '@/components/rate-cards/PerformanceIndicators';
import { TopOpportunitiesWidget } from '@/components/rate-cards/TopOpportunitiesWidget';
import { DashboardTrendCharts } from '@/components/rate-cards/DashboardTrendCharts';

export const metadata: Metadata = {
  title: 'Rate Card Dashboard | Procurement Intelligence',
  description: 'Executive dashboard for rate card benchmarking and procurement analytics',
};

export default function RateCardDashboardPage() {
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
      </div>

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
