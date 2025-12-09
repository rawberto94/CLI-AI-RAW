'use client';

import { useState, useMemo, useCallback } from 'react';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { BenchmarkCard } from '@/components/rate-cards/BenchmarkCard';
import { SavingsAnalysisSection } from '@/components/rate-cards/SavingsAnalysisSection';
import { TrendVisualization } from '@/components/rate-cards/TrendVisualization';
import { CohortInformation } from '@/components/rate-cards/CohortInformation';
import { AdvancedFilters, FilterCriteria } from '@/components/rate-cards/AdvancedFilters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

// Lazy load heavy components for better performance
import {
  LazyInteractiveBoxPlot as InteractiveBoxPlot,
  LazyTimeSeriesChart as TimeSeriesChart,
  LazyGeographicHeatMap as GeographicHeatMap,
  LazyComparisonBarChart as ComparisonBarChart,
  LazyRateCardDataRepository as RateCardDataRepository,
  LazyManualRateCardInput as ManualRateCardInput,
  LazyBulkCSVUpload as BulkCSVUpload,
  LazyExtractFromContracts as ExtractFromContracts,
} from '@/components/lazy';
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

  // Rate benchmarking page rendering

  const handleFilterChange = useCallback((newFilters: FilterCriteria) => {
    setFilters(newFilters);
    // Filters applied - fetch data from API
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters({});
    // Filters reset - fetch all data
  }, []);

  const handleDataRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    // Data refreshed
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="container mx-auto p-6 space-y-6">
        <RateCardBreadcrumbs />
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                  Rate Benchmarking
                </h1>
                <p className="text-slate-600">
                  Analyze rates against market benchmarks and identify savings opportunities
                </p>
              </div>
            </div>
            
            {/* Import Actions */}
            <div className="flex gap-2 flex-wrap">
              <ManualRateCardInput onSuccess={handleDataRefresh} />
              <BulkCSVUpload onSuccess={handleDataRefresh} />
              <ExtractFromContracts onSuccess={handleDataRefresh} />
            </div>
          </div>
        </motion.div>

        {/* Client & Status Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Client & Status Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientFilter" className="text-slate-700">Filter by Client</Label>
                  <Input
                    id="clientFilter"
                    placeholder="Enter client name..."
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="bg-white"
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
      </motion.div>

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
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle>Baseline Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ComparisonBarChart data={[]} />
                  <p className="text-sm text-slate-500 mt-4">
                    Comparing baseline rates vs actual rates vs market benchmarks
                  </p>
                </CardContent>
              </Card>
            )}
            
            <TrendVisualization />
            <CohortInformation />
            
            {/* Geographic Heat Map */}
            {clientFilter && (
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
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
    </div>
  );
}
