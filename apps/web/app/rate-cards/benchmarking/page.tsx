import { Metadata } from 'next';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { BenchmarkCard } from '@/components/rate-cards/BenchmarkCard';
import { SavingsAnalysisSection } from '@/components/rate-cards/SavingsAnalysisSection';
import { TrendVisualization } from '@/components/rate-cards/TrendVisualization';
import { CohortInformation } from '@/components/rate-cards/CohortInformation';

export const metadata: Metadata = {
  title: 'Rate Benchmarking | Procurement Intelligence',
  description: 'Comprehensive rate card benchmarking and market analysis',
};

export default function RateBenchmarkingPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div>
        <h1 className="text-3xl font-bold">Rate Benchmarking</h1>
        <p className="text-muted-foreground">
          Analyze rates against market benchmarks and identify savings opportunities
        </p>
      </div>

      <div className="grid gap-6">
        <BenchmarkCard />
        <SavingsAnalysisSection />
        <TrendVisualization />
        <CohortInformation />
      </div>
    </div>
  );
}
