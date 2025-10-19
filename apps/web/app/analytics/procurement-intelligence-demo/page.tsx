'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataModeToggle, DataModeIndicator } from '@/components/analytics/DataModeToggle';
import {
  useRateBenchmarking,
  useSupplierAnalytics,
  useNegotiationPrep,
  useSavingsPipeline,
  useRenewalRadar,
  useProviderHealth,
  type DataMode
} from '@/hooks/useProcurementIntelligence';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeletons';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Procurement Intelligence Demo Page
 * Demonstrates all 5 intelligence modules with mode switching
 */
export default function ProcurementIntelligenceDemoPage() {
  const [mode, setMode] = useState<DataMode>('mock');
  const { health } = useProviderHealth();

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Procurement Intelligence Demo</h1>
          <p className="text-muted-foreground mt-2">
            Interactive demonstration of all 5 procurement intelligence modules
          </p>
        </div>
        <DataModeToggle currentMode={mode} onModeChange={setMode} />
      </div>

      {/* Provider Health Status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Provider Health Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              {Object.entries(health).map(([provider, status]) => (
                <div key={provider} className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">
                    {provider.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </div>
                  <div className="flex justify-center gap-2">
                    <Badge variant={status.real ? 'default' : 'destructive'} className="text-xs">
                      Real: {status.real ? '✓' : '✗'}
                    </Badge>
                    <Badge variant={status.mock ? 'default' : 'destructive'} className="text-xs">
                      Mock: {status.mock ? '✓' : '✗'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Module Tabs */}
      <Tabs defaultValue="rate-benchmarking" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="rate-benchmarking">Rate Benchmarking</TabsTrigger>
          <TabsTrigger value="supplier-analytics">Supplier Analytics</TabsTrigger>
          <TabsTrigger value="negotiation-prep">Negotiation Prep</TabsTrigger>
          <TabsTrigger value="savings-pipeline">Savings Pipeline</TabsTrigger>
          <TabsTrigger value="renewal-radar">Renewal Radar</TabsTrigger>
        </TabsList>

        {/* Rate Benchmarking Tab */}
        <TabsContent value="rate-benchmarking">
          <RateBenchmarkingDemo mode={mode} />
        </TabsContent>

        {/* Supplier Analytics Tab */}
        <TabsContent value="supplier-analytics">
          <SupplierAnalyticsDemo mode={mode} />
        </TabsContent>

        {/* Negotiation Prep Tab */}
        <TabsContent value="negotiation-prep">
          <NegotiationPrepDemo mode={mode} />
        </TabsContent>

        {/* Savings Pipeline Tab */}
        <TabsContent value="savings-pipeline">
          <SavingsPipelineDemo mode={mode} />
        </TabsContent>

        {/* Renewal Radar Tab */}
        <TabsContent value="renewal-radar">
          <RenewalRadarDemo mode={mode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Rate Benchmarking Demo Component
 */
function RateBenchmarkingDemo({ mode }: { mode: DataMode }) {
  const { data, loading, error, metadata } = useRateBenchmarking({
    lineOfService: 'Software Development',
    seniority: 'Senior',
    geography: 'North America - West Coast'
  }, mode);

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorDisplay message={error} />;
  if (!data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Market Rates</CardTitle>
              <CardDescription>Senior Software Developer - West Coast</CardDescription>
            </div>
            <DataModeIndicator mode={metadata?.mode as DataMode || mode} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <MetricCard label="Average" value={`$${data.marketRates.average}/hr`} />
            <MetricCard label="Median (P50)" value={`$${data.marketRates.p50}/hr`} />
            <MetricCard label="P25" value={`$${data.marketRates.p25}/hr`} />
            <MetricCard label="P75" value={`$${data.marketRates.p75}/hr`} />
          </div>
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Sample Size: {data.marketRates.count} rates analyzed
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Source: {metadata?.source}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Trends</CardTitle>
          <CardDescription>Last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.trends.slice(-6).map((trend, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-sm">{trend.period}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">${trend.value}/hr</span>
                  <TrendIndicator value={trend.change} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Supplier Analytics Demo Component
 */
function SupplierAnalyticsDemo({ mode }: { mode: DataMode }) {
  const { data, loading, error, metadata } = useSupplierAnalytics({
    supplierId: 'SUP001',
    timeframe: '12months'
  }, mode);

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorDisplay message={error} />;
  if (!data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle>Performance Metrics</CardTitle>
            <DataModeIndicator mode={metadata?.mode as DataMode || mode} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScoreBar label="Delivery" score={data.performance.deliveryScore} />
          <ScoreBar label="Quality" score={data.performance.qualityScore} />
          <ScoreBar label="Cost Efficiency" score={data.performance.costEfficiency} />
          <ScoreBar label="Risk" score={data.performance.riskScore} inverse />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MetricCard label="Credit Rating" value={data.financialHealth.creditRating} />
          <MetricCard label="Revenue" value={`$${(data.financialHealth.revenue / 1000000).toFixed(1)}M`} />
          <MetricCard label="Profit Margin" value={`${(data.financialHealth.profitMargin * 100).toFixed(1)}%`} />
          <MetricCard label="Debt Ratio" value={`${(data.financialHealth.debtRatio * 100).toFixed(1)}%`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relationship</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MetricCard label="Active Contracts" value={data.relationships.contractCount.toString()} />
          <MetricCard label="Total Value" value={`$${(data.relationships.totalValue / 1000000).toFixed(1)}M`} />
          <MetricCard label="Avg Duration" value={`${data.relationships.averageContractLength} months`} />
          <MetricCard label="Renewal Rate" value={`${(data.relationships.renewalRate * 100).toFixed(0)}%`} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Negotiation Prep Demo Component
 */
function NegotiationPrepDemo({ mode }: { mode: DataMode }) {
  const { data, loading, error, metadata } = useNegotiationPrep({
    contractId: 'CNT001',
    category: 'Software Development'
  }, mode);

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorDisplay message={error} />;
  if (!data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Leverage Points</CardTitle>
              <CardDescription>{data.leveragePoints.length} identified</CardDescription>
            </div>
            <DataModeIndicator mode={metadata?.mode as DataMode || mode} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.leveragePoints.slice(0, 4).map((point, idx) => (
              <div key={idx} className="border-l-2 border-primary pl-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{point.type}</span>
                  <Badge variant={
                    point.impact === 'high' ? 'default' :
                    point.impact === 'medium' ? 'secondary' : 'outline'
                  } className="text-xs">
                    {point.impact}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{point.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>Top savings opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recommendations.slice(0, 3).map((rec, idx) => (
              <div key={idx} className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium">{rec.action}</span>
                  <span className="text-sm font-bold text-green-600">
                    ${(rec.expectedSavings / 1000).toFixed(0)}K
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{rec.rationale}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Savings Pipeline Demo Component
 */
function SavingsPipelineDemo({ mode }: { mode: DataMode }) {
  const { data, loading, error, metadata } = useSavingsPipeline({
    timeframe: '12months'
  }, mode);

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorDisplay message={error} />;
  if (!data) return null;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Pipeline Overview</CardTitle>
              <CardDescription>{data.opportunities.length} opportunities</CardDescription>
            </div>
            <DataModeIndicator mode={metadata?.mode as DataMode || mode} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Pipeline" value={`$${(data.pipeline.total / 1000).toFixed(0)}K`} />
            <MetricCard label="Identified" value={`$${((data.pipeline.byStatus.identified || 0) / 1000).toFixed(0)}K`} />
            <MetricCard label="In Progress" value={`$${((data.pipeline.byStatus.in_progress || 0) / 1000).toFixed(0)}K`} />
            <MetricCard label="Realized" value={`$${((data.pipeline.byStatus.realized || 0) / 1000).toFixed(0)}K`} />
          </div>
          <div className="space-y-2">
            {data.opportunities.slice(0, 5).map((opp) => (
              <div key={opp.id} className="flex justify-between items-center p-2 hover:bg-muted rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{opp.title}</span>
                    <Badge variant="outline" className="text-xs">{opp.category}</Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">${(opp.potentialSavings / 1000).toFixed(0)}K</div>
                  <div className="text-xs text-muted-foreground">{(opp.probability * 100).toFixed(0)}% likely</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Renewal Radar Demo Component
 */
function RenewalRadarDemo({ mode }: { mode: DataMode }) {
  const { data, loading, error, metadata } = useRenewalRadar({
    timeframe: '3months'
  }, mode);

  if (loading) return <Skeleton className="h-64" />;
  if (error) return <ErrorDisplay message={error} />;
  if (!data) return null;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Upcoming Renewals</CardTitle>
              <CardDescription>Next 3 months</CardDescription>
            </div>
            <DataModeIndicator mode={metadata?.mode as DataMode || mode} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <MetricCard label="Total Contracts" value={data.riskAnalysis.totalContracts.toString()} />
            <MetricCard label="Total Value" value={`$${(data.riskAnalysis.totalValue / 1000000).toFixed(1)}M`} />
            <MetricCard label="High Risk" value={(data.riskAnalysis.riskDistribution.high || 0).toString()} />
          </div>
          <div className="space-y-2">
            {data.upcomingRenewals.slice(0, 5).map((renewal) => (
              <div key={renewal.contractId} className="flex justify-between items-center p-2 hover:bg-muted rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{renewal.supplier}</span>
                    <Badge variant={
                      renewal.riskLevel === 'high' ? 'destructive' :
                      renewal.riskLevel === 'medium' ? 'default' : 'secondary'
                    } className="text-xs">
                      {renewal.riskLevel}
                    </Badge>
                    {renewal.autoRenewal && (
                      <Badge variant="outline" className="text-xs">Auto-Renewal</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(renewal.renewalDate).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">${(renewal.value / 1000).toFixed(0)}K</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Components

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function ScoreBar({ label, score, inverse = false }: { label: string; score: number; inverse?: boolean }) {
  const color = inverse
    ? score > 70 ? 'bg-red-500' : score > 40 ? 'bg-yellow-500' : 'bg-green-500'
    : score > 70 ? 'bg-green-500' : score > 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-medium">{score}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function TrendIndicator({ value }: { value: number }) {
  if (Math.abs(value) < 0.1) {
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
  return value > 0 ? (
    <div className="flex items-center gap-1 text-green-600">
      <TrendingUp className="h-4 w-4" />
      <span className="text-xs">+{value.toFixed(1)}%</span>
    </div>
  ) : (
    <div className="flex items-center gap-1 text-red-600">
      <TrendingDown className="h-4 w-4" />
      <span className="text-xs">{value.toFixed(1)}%</span>
    </div>
  );
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{message}</span>
        </div>
      </CardContent>
    </Card>
  );
}
