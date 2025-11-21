'use client';

import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { MarketIntelligenceDashboard } from '@/components/rate-cards/MarketIntelligenceDashboard';
import { MarketIntelligenceFilters } from '@/components/rate-cards/MarketIntelligenceFilters';
import { EmergingTrendsPanel } from '@/components/rate-cards/EmergingTrendsPanel';

export function MarketIntelligenceClientPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div>
        <h1 className="text-3xl font-bold">Market Intelligence</h1>
        <p className="text-muted-foreground">
          Analyze market trends and competitive positioning
        </p>
      </div>

      <MarketIntelligenceFilters onFilterChange={() => {}} />
      <MarketIntelligenceDashboard tenantId="default-tenant" />
      <EmergingTrendsPanel tenantId="default-tenant" />
    </div>
  );
}
