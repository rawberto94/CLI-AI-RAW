import { Metadata } from 'next';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { SupplierRankings } from '@/components/rate-cards/SupplierRankings';
import { SupplierComparisonView } from '@/components/rate-cards/SupplierComparisonView';
import { Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Supplier Performance | Procurement Intelligence',
  description: 'Track supplier performance and competitiveness',
};

export default function SuppliersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-violet-50/20">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <RateCardBreadcrumbs />
        
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg shadow-green-500/25">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Supplier Performance
            </h1>
            <p className="text-slate-600">
              Track supplier competitiveness and performance metrics
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <SupplierRankings />
          <SupplierComparisonView supplierIds={[]} />
        </div>
      </div>
    </div>
  );
}
