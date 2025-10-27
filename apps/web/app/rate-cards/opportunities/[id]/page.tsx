import { OpportunityDetails } from '@/components/rate-cards/OpportunityDetails';

export default function OpportunityDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-8">
      <OpportunityDetails opportunityId={params.id} />
    </div>
  );
}
