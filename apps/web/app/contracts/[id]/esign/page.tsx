import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import ESignaturePageClient from './ESignaturePageClient';

export const metadata = {
  title: 'E-Signature | ConTigo',
  description: 'Collect digital signatures for contracts',
};

export default function ESignaturePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ESignaturePageClient contractId={params.id} />
    </Suspense>
  );
}
