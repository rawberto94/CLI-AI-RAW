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

export default function RateBenchmarkingPage() {
  const [filters, setFilters] = useState<FilterCriteria>({});
  const [refreshKey, setRefreshKey] = useState(0);

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
            <TrendVisualization />
            <CohortInformation />
          </div>
        </TabsContent>

        <TabsContent value="repository" className="space-y-6">
          <RateCardDataRepository filters={filters} key={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
