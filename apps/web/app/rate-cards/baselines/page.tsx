import { Metadata } from 'next';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { BaselinesList } from '@/components/rate-cards/BaselinesList';
import { BaselineTrackingDashboard } from '@/components/rate-cards/BaselineTrackingDashboard';
import { Button } from '@/components/ui/button';
import { Plus, Upload } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Baseline Rates | Procurement Intelligence',
  description: 'Manage and track baseline target rates',
};

export default function BaselinesPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Baseline Target Rates</h1>
          <p className="text-muted-foreground">
            Set and track baseline target rates for procurement goals
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/rate-cards/baselines/import">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import Baselines
            </Button>
          </Link>
          <Link href="/rate-cards/baselines/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Baseline
            </Button>
          </Link>
        </div>
      </div>

      <BaselineTrackingDashboard />
      <BaselinesList />
    </div>
  );
}
