import { Metadata } from 'next';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { MarketIntelligenceDashboard } from '@/components/rate-cards/MarketIntelligenceDashboard';
import { MarketIntelligenceFilters } from '@/components/rate-cards/MarketIntelligenceFilters';
import { EmergingTrendsPanel } from '@/components/rate-cards/EmergingTrendsPanel';

export const metadata: Metadata = {
  title: 'Market Intelligence | Procurement Intelligence',
  description: 'Market insights and rate trends',
};

export default function MarketIntelligencePage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div>
        <h1 className="text-3xl font-bold">Market Intelligence</h1>
        <p className="text-muted-foreground">
          Analyze market trends and competitive positioning
        </p>
      </div>

      <MarketIntelligenceFilters />
      <MarketIntelligenceDashboard tenantId="default-tenant" />
      <EmergingTrendsPanel />
    </div>
  );
}
