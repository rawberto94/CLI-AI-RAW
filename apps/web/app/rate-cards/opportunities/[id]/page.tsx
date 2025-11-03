import { OpportunityDetails } from '@/components/rate-cards/OpportunityDetails';

export default async function OpportunityDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <div className="container mx-auto py-8">
      <OpportunityDetails opportunityId={params.id} />
    </div>
  );
}
