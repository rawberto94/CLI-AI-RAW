import { OpportunityDetails } from '@/components/rate-cards/OpportunityDetails';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rate cards > Opportunities | ConTigo',
  description: 'Rate cards > Opportunities — Manage and monitor your contract intelligence platform',
};


export default async function OpportunityDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <div className="max-w-[1600px] mx-auto py-8">
      <OpportunityDetails opportunityId={params.id} />
    </div>
  );
}
