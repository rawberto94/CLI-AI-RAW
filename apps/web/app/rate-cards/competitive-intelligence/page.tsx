'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CompetitivenessGauge } from '@/components/rate-cards/CompetitivenessGauge';
import { MarketPositionChart } from '@/components/rate-cards/MarketPositionChart';
import { TopOpportunitiesTable } from '@/components/rate-cards/TopOpportunitiesTable';
import { AtRiskRatesAlert } from '@/components/rate-cards/AtRiskRatesAlert';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const fetchCompetitiveMetrics = async () => {
  const response = await fetch('/api/rate-cards/competitive-intelligence?tenantId=default-tenant');
  if (!response.ok) throw new Error('Failed to load competitive intelligence');
  return response.json();
};

export default function CompetitiveIntelligencePage() {
  const { 
    data: metrics, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['competitive-intelligence'],
    queryFn: fetchCompetitiveMetrics,
    staleTime: 60 * 1000, // Consider fresh for 1 minute
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Failed to load competitive intelligence data
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getTrendIcon = () => {
    if (metrics.trends.direction === 'improving') {
      return <TrendingUp className="h-5 w-5 text-green-500" />;
    } else if (metrics.trends.direction === 'declining') {
      return <TrendingDown className="h-5 w-5 text-red-500" />;
    }
    return <Minus className="h-5 w-5 text-gray-500" />;
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Competitive Intelligence Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor your market position and identify opportunities for improvement
        </p>
      </div>

      {/* Overall Score and Market Position */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CompetitivenessGauge
          score={metrics.overallScore}
          ranking={metrics.marketPosition.ranking}
        />
        
        <Card>
          <CardHeader>
            <CardTitle>Market Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Percentile Rank</span>
                  <span className="text-2xl font-bold">{metrics.marketPosition.percentile}th</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${metrics.marketPosition.percentile}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-sm text-muted-foreground">Trend</span>
                <div className="flex items-center gap-2">
                  {getTrendIcon()}
                  <span className="font-medium capitalize">{metrics.trends.direction}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Price Competitiveness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Math.round(metrics.priceCompetitiveness.score)}%</div>
            <p className="text-sm text-muted-foreground mt-2">
              {metrics.priceCompetitiveness.competitiveRatesCount} of{' '}
              {metrics.priceCompetitiveness.totalRatesCount} rates competitive
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Avg {metrics.priceCompetitiveness.avgRateVsMarket > 0 ? '+' : ''}
              {metrics.priceCompetitiveness.avgRateVsMarket.toFixed(1)}% vs market
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Roles</span>
                <span className="font-semibold">{metrics.coverageAnalysis.rolesCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Geographies</span>
                <span className="font-semibold">{metrics.coverageAnalysis.geographiesCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Suppliers</span>
                <span className="font-semibold">{metrics.coverageAnalysis.suppliersCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">At-Risk Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{metrics.atRiskRates.length}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Rates requiring immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Market Position Chart */}
      <MarketPositionChart metrics={metrics} />

      {/* Top Opportunities */}
      <TopOpportunitiesTable opportunities={metrics.topOpportunities} />

      {/* At-Risk Rates */}
      {metrics.atRiskRates.length > 0 && (
        <AtRiskRatesAlert atRiskRates={metrics.atRiskRates} />
      )}

      {/* Gap Areas */}
      {metrics.coverageAnalysis.gapAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Coverage Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {metrics.coverageAnalysis.gapAreas.map((gap: string, index: number) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  {gap}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
