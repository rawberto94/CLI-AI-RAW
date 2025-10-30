'use client';

import { useState } from 'react';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { BenchmarkCard } from '@/components/rate-cards/BenchmarkCard';
import { SavingsAnalysisSection } from '@/components/rate-cards/SavingsAnalysisSection';
import { TrendVisualization } from '@/components/rate-cards/TrendVisualization';
import { CohortInformation } from '@/components/rate-cards/CohortInformation';
import { AdvancedFilters, FilterCriteria } from '@/components/rate-cards/AdvancedFilters';
import { RateCardDataRepository } from '@/components/rate-cards/RateCardDataRepository';
import { ManualRateCardInput } from '@/components/rate-cards/ManualRateCardInput';
import { BulkCSVUpload } from '@/components/rate-cards/BulkCSVUpload';
import { ExtractFromContracts } from '@/components/rate-cards/ExtractFromContracts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InteractiveBoxPlot } from '@/components/rate-cards/InteractiveBoxPlot';
import { TimeSeriesChart } from '@/components/rate-cards/TimeSeriesChart';
import { GeographicHeatMap } from '@/components/rate-cards/GeographicHeatMap';
import { ComparisonBarChart } from '@/components/rate-cards/ComparisonBarChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export default function RateBenchmarkingPage() {
  const [filters, setFilters] = useState<FilterCriteria>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [clientFilter, setClientFilter] = useState('');
  const [showBaselineOnly, setShowBaselineOnly] = useState(false);
  const [showNegotiatedOnly, setShowNegotiatedOnly] = useState(false);

  console.log('🔵 RateBenchmarkingPage rendering - buttons should be visible');

  const handleFilterChange = (newFilters: FilterCriteria) => {
    setFilters(newFilters);
    console.log('Filters applied:', newFilters);
    // TODO: Fetch data from API with filters
  };

  const handleFilterReset = () => {
    setFilters({});
    console.log('Filters reset');
    // TODO: Fetch data from API without filters
  };

  const handleDataRefresh = () => {
    setRefreshKey(prev => prev + 1);
    console.log('Data refreshed');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Rate Benchmarking</h1>
            <p className="text-muted-foreground">
              Analyze rates against market benchmarks and identify savings opportunities
            </p>
          </div>
          
          {/* Import Actions */}
          <div className="flex gap-2 flex-wrap">
            <ManualRateCardInput onSuccess={handleDataRefresh} />
            <BulkCSVUpload onSuccess={handleDataRefresh} />
            <ExtractFromContracts onSuccess={handleDataRefresh} />
          </div>
        </div>
      </div>

      {/* Client & Status Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Client & Status Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientFilter">Filter by Client</Label>
              <Input
                id="clientFilter"
                placeholder="Enter client name..."
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox
                id="baselineOnly"
                checked={showBaselineOnly}
                onCheckedChange={(checked) => setShowBaselineOnly(checked as boolean)}
              />
              <Label htmlFor="baselineOnly" className="cursor-pointer">
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                  ⭐ Baseline Only
                </Badge>
              </Label>
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox
                id="negotiatedOnly"
                checked={showNegotiatedOnly}
                onCheckedChange={(checked) => setShowNegotiatedOnly(checked as boolean)}
              />
              <Label htmlFor="negotiatedOnly" className="cursor-pointer">
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  ✓ Negotiated Only
                </Badge>
              </Label>
            </div>
          </div>
          {(clientFilter || showBaselineOnly || showNegotiatedOnly) && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {clientFilter && (
                <Badge variant="outline">Client: {clientFilter}</Badge>
              )}
              {showBaselineOnly && (
                <Badge variant="outline">Baseline Only</Badge>
              )}
              {showNegotiatedOnly && (
                <Badge variant="outline">Negotiated Only</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      <AdvancedFilters 
        onFilterChange={handleFilterChange}
        onReset={handleFilterReset}
      />

      {/* Tabs for different views */}
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dashboard">Dashboard View</TabsTrigger>
          <TabsTrigger value="repository">Data Repository</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-6">
            <BenchmarkCard />
            <SavingsAnalysisSection />
            
            {/* Baseline Comparison View */}
            {showBaselineOnly && (
              <Card>
                <CardHeader>
                  <CardTitle>Baseline Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ComparisonBarChart data={[]} />
                  <p className="text-sm text-muted-foreground mt-4">
                    Comparing baseline rates vs actual rates vs market benchmarks
                  </p>
                </CardContent>
              </Card>
            )}
            
            <TrendVisualization />
            <CohortInformation />
            
            {/* Geographic Heat Map */}
            {clientFilter && (
              <Card>
                <CardHeader>
                  <CardTitle>Geographic Distribution - {clientFilter}</CardTitle>
                </CardHeader>
                <CardContent>
                  <GeographicHeatMap data={[]} />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="repository" className="space-y-6">
          <RateCardDataRepository filters={filters} key={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
