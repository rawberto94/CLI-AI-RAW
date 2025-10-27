import { Metadata } from 'next';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { RateCardFilters } from '@/components/rate-cards/RateCardFilters';
import { Button } from '@/components/ui/button';
import { Plus, Upload } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Rate Card Entries | Procurement Intelligence',
  description: 'View and manage all rate card entries',
};

export default function RateCardEntriesPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rate Card Entries</h1>
          <p className="text-muted-foreground">
            View, filter, and manage all rate card entries
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/rate-cards/upload">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
          </Link>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Rate Card
          </Button>
        </div>
      </div>

      <RateCardFilters />

      <div className="text-center py-12 text-muted-foreground">
        <p>Rate card entries list will be displayed here</p>
        <p className="text-sm mt-2">This component will show filtered rate cards with pagination</p>
      </div>
    </div>
  );
}
