import { Metadata } from 'next';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { OpportunitiesList } from '@/components/rate-cards/OpportunitiesList';

export const metadata: Metadata = {
  title: 'Savings Opportunities | Procurement Intelligence',
  description: 'Identify and track cost savings opportunities',
};

export default function OpportunitiesPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div>
        <h1 className="text-3xl font-bold">Savings Opportunities</h1>
        <p className="text-muted-foreground">
          Identify, track, and realize cost savings opportunities
        </p>
      </div>

      <OpportunitiesList />
    </div>
  );
}
