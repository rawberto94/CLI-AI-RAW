import { Metadata } from 'next';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { SupplierRankings } from '@/components/rate-cards/SupplierRankings';
import { SupplierComparisonView } from '@/components/rate-cards/SupplierComparisonView';

export const metadata: Metadata = {
  title: 'Supplier Performance | Procurement Intelligence',
  description: 'Track supplier performance and competitiveness',
};

export default function SuppliersPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div>
        <h1 className="text-3xl font-bold">Supplier Performance</h1>
        <p className="text-muted-foreground">
          Track supplier competitiveness and performance metrics
        </p>
      </div>

      <div className="space-y-6">
        <SupplierRankings />
        <SupplierComparisonView />
      </div>
    </div>
  );
}
