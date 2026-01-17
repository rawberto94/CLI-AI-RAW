'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Opportunity {
  id: string;
  rateCardEntryId: string;
  category: string;
  annualSavingsPotential: number;
  status: string;
  rateCardEntry?: {
    roleStandardized: string;
    supplierName: string;
    country: string;
  };
}

export function TopOpportunitiesWidget() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    try {
      const response = await fetch('/api/rate-cards/opportunities?limit=10&sortBy=annualSavingsPotential&sortOrder=desc');
      if (response.ok) {
        const data = await response.json();
        setOpportunities(data.opportunities || []);
      }
    } catch {
      // Error fetching top opportunities
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      HIGH_RATE: 'bg-red-100 text-red-800',
      VOLUME_DISCOUNT: 'bg-blue-100 text-blue-800',
      GEOGRAPHIC_ARBITRAGE: 'bg-purple-100 text-purple-800',
      SUPPLIER_CONSOLIDATION: 'bg-green-100 text-green-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      HIGH_RATE: 'High Rate',
      VOLUME_DISCOUNT: 'Volume Discount',
      GEOGRAPHIC_ARBITRAGE: 'Geographic Arbitrage',
      SUPPLIER_CONSOLIDATION: 'Supplier Consolidation',
    };
    return labels[category] || category;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Savings Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 animate-pulse rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (opportunities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Savings Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No opportunities identified yet.</p>
        </CardContent>
      </Card>
    );
  }

  const totalSavings = opportunities.reduce(
    (sum, opp) => sum + (opp.annualSavingsPotential || 0),
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Savings Opportunities
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            Total: {formatCurrency(totalSavings)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {opportunities.map((opp, index) => (
            <Link
              key={opp.id}
              href={`/rate-cards/opportunities/${opp.id}`}
              className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(opp.category)}`}>
                      {getCategoryLabel(opp.category)}
                    </span>
                  </div>
                  {opp.rateCardEntry && (
                    <div className="text-sm">
                      <p className="font-medium">{opp.rateCardEntry.roleStandardized}</p>
                      <p className="text-muted-foreground">
                        {opp.rateCardEntry.supplierName} • {opp.rateCardEntry.country}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(opp.annualSavingsPotential)}
                    </p>
                    <p className="text-xs text-muted-foreground">Annual savings</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t">
          <Link
            href="/rate-cards/opportunities"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all opportunities
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
